import { lookup as dnsLookup } from 'node:dns/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { BlockList, isIP } from 'node:net';

export class ProxySecurityError extends Error {
    statusCode = 403;

    constructor(message: string) {
        super(message);
        this.name = 'ProxySecurityError';
    }
}

const blockedIPv4 = new BlockList();

const blockedIPv4Ranges: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
];

for (const [network, prefix] of blockedIPv4Ranges) {
    blockedIPv4.addSubnet(network, prefix, 'ipv4');
}

const globalIPv6 = new BlockList();
globalIPv6.addSubnet('2000::', 3, 'ipv6');

const blockedIPv6 = new BlockList();

for (const [network, prefix] of [
    ['2001::', 23],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['3fff::', 20]
] as Array<[string, number]>) {
    blockedIPv6.addSubnet(network, prefix, 'ipv6');
}

interface SafeAddress {
    address: string;
    family: number;
}

interface SafeResponse {
    response: http.IncomingMessage;
    finalUrl: string;
}

function isPublicAddress(address: SafeAddress): boolean {
    const family = isIP(address.address);

    if (family !== address.family) return false;

    if (family === 4) {
        return !blockedIPv4.check(address.address, 'ipv4');
    }

    if (family === 6) {
        return globalIPv6.check(address.address, 'ipv6') &&
            !blockedIPv6.check(address.address, 'ipv6');
    }

    return false;
}

function validateUrl(raw: string): URL {
    let url: URL;

    try {
        url = new URL(raw);
    } catch {
        throw new ProxySecurityError('Invalid upstream URL');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new ProxySecurityError('Only HTTP and HTTPS are allowed');
    }

    if (url.username || url.password) {
        throw new ProxySecurityError('URL credentials are not allowed');
    }

    const expectedPort = url.protocol === 'https:' ? '443' : '80';
    const effectivePort = url.port || expectedPort;

    if (effectivePort !== expectedPort) {
        throw new ProxySecurityError('Non-standard upstream ports are blocked');
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const normalized = hostname.replace(/\.$/, '');

    const blockedSuffixes = [
        '.localhost',
        '.local',
        '.internal',
        '.home.arpa',
        '.test',
        '.invalid',
        '.example',
        '.lan',
        '.home'
    ];

    if (
        !normalized ||
        normalized === 'localhost' ||
        blockedSuffixes.some(suffix => normalized.endsWith(suffix))
    ) {
        throw new ProxySecurityError('Local hostnames are blocked');
    }

    url.hash = '';
    return url;
}

async function resolvePublicAddresses(url: URL): Promise<SafeAddress[]> {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const literalFamily = isIP(hostname);

    let addresses: SafeAddress[];

    try {
        if (literalFamily) {
            addresses = [{
                address: hostname,
                family: literalFamily
            }];
        } else {
            addresses = await dnsLookup(hostname, {
                all: true,
                verbatim: true
            });
        }
    } catch {
        throw new ProxySecurityError('Unable to resolve upstream hostname');
    }

    if (!addresses.length || addresses.length > 32) {
        throw new ProxySecurityError('Invalid DNS response');
    }

    // Reject the entire hostname if ANY DNS answer is non-public.
    if (addresses.some(address => !isPublicAddress(address))) {
        throw new ProxySecurityError('Private or reserved IP address blocked');
    }

    return addresses;
}

function requestOnce(
    url: URL,
    address: SafeAddress,
    headers: Record<string, string>,
    signal?: AbortSignal,
    method: 'GET' | 'HEAD' = 'GET'
): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error('Client request aborted'));
            return;
        }

        const hostname = url.hostname.replace(/^\[|\]$/g, '');
        const transport = url.protocol === 'https:' ? https : http;

        const options: any = {
            protocol: url.protocol,
            hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            method,
            headers,

            // Pin the socket to the already validated DNS address.
            // The original hostname remains intact for HTTP Host and TLS.
            lookup: (
                _host: string,
                options: any,
                callback: (...args: any[]) => void
            ) => {
                if (options?.all) {
                    callback(null, [{
                        address: address.address,
                        family: address.family
                    }]);
                } else {
                    callback(null, address.address, address.family);
                }
            }
        };

        if (url.protocol === 'https:' && !isIP(hostname)) {
            options.servername = hostname;
        }

        const req = transport.request(options, resolve);

        const abort = () => req.destroy(new Error('Client request aborted'));

        if (signal) {
            signal.addEventListener('abort', abort, { once: true });
            req.once('close', () => signal.removeEventListener('abort', abort));
        }

        req.setTimeout(30000, () => {
            req.destroy(new Error('Upstream request timeout'));
        });

        req.once('error', reject);
        req.end();
    });
}

export async function safeFetchStream(
    rawUrl: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
    method: 'GET' | 'HEAD' = 'GET'
): Promise<SafeResponse> {
    let currentUrl = validateUrl(rawUrl);

    const MAX_REDIRECTS = 5;
    const redirectStatuses = new Set([301, 302, 303, 307, 308]);

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
        if (signal?.aborted) {
            throw new Error('Client request aborted');
        }

        currentUrl = validateUrl(currentUrl.toString());

        const addresses = await resolvePublicAddresses(currentUrl);

        let upstream: http.IncomingMessage | undefined;
        let lastError: unknown;

        // Try each validated public address if a connection fails.
        for (const address of addresses) {
            try {
                upstream = await requestOnce(
                    currentUrl,
                    address,
                    headers,
                    signal,
                    method
                );
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!upstream) {
            throw lastError || new Error('Unable to connect to upstream');
        }

        const status = upstream.statusCode || 502;
        const location = upstream.headers.location;

        if (redirectStatuses.has(status) && location) {
            upstream.destroy();

            if (redirect >= MAX_REDIRECTS) {
                throw new ProxySecurityError('Too many upstream redirects');
            }

            let nextUrl: URL;

            try {
                nextUrl = new URL(location, currentUrl);
            } catch {
                throw new ProxySecurityError('Invalid redirect URL');
            }

            if (
                currentUrl.protocol === 'https:' &&
                nextUrl.protocol !== 'https:'
            ) {
                throw new ProxySecurityError('HTTPS downgrade redirect blocked');
            }

            // Next iteration performs DNS and IP validation again.
            currentUrl = nextUrl;
            continue;
        }

        return {
            response: upstream,
            finalUrl: currentUrl.toString()
        };
    }

    throw new ProxySecurityError('Unable to complete upstream request');
}
