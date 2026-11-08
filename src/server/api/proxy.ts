import { Hono } from 'hono';
import { Readable } from 'node:stream';
import { USER_AGENT } from '../utils/helpers';
import {
    safeFetchStream,
    ProxySecurityError
} from '../utils/safeProxyFetch';

export const proxyRoute = new Hono();

const EMBED_ORIGIN = 'https://nextgencloudfabric.com';
const MAX_MANIFEST_SIZE = 5 * 1024 * 1024;

function safeHeaderUrl(raw: string | undefined, originOnly = false): string | undefined {
    if (!raw || raw.length > 2048) return undefined;

    try {
        const parsed = new URL(raw);

        if (
            !['http:', 'https:'].includes(parsed.protocol) ||
            parsed.username ||
            parsed.password
        ) return undefined;

        return originOnly ? parsed.origin : parsed.href;
    } catch {
        return undefined;
    }
}

function rewriteM3u8(
    body: string,
    originalUrl: string,
    extraParams = ''
): string {
    const lines = body.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#')) {
            lines[i] = line.replace(
                /(URI=["'])([^"']+)(["'])/g,
                (match, before, uri, after) => {
                    try {
                        const absoluteUrl = new URL(uri, originalUrl).href;
                        return `${before}/api/proxy?url=${encodeURIComponent(absoluteUrl)}${extraParams}${after}`;
                    } catch {
                        return match;
                    }
                }
            );
        } else {
            try {
                const absoluteUrl = new URL(line, originalUrl).href;
                lines[i] =
                    `/api/proxy?url=${encodeURIComponent(absoluteUrl)}${extraParams}`;
            } catch {
                // Keep malformed lines unchanged.
            }
        }
    }

    return lines.join('\n');
}

function responseHeader(
    response: import('node:http').IncomingMessage,
    name: string
): string | undefined {
    const value = response.headers[name.toLowerCase()];
    return Array.isArray(value) ? value.join(', ') : value;
}

async function readManifest(
    response: import('node:http').IncomingMessage
): Promise<string> {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of response) {
        const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk);

        total += buffer.length;

        if (total > MAX_MANIFEST_SIZE) {
            response.destroy();
            throw new Error('HLS manifest exceeds maximum size');
        }

        chunks.push(buffer);
    }

    return Buffer.concat(chunks).toString('utf8');
}

proxyRoute.options('*', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Range, Content-Type');
    c.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
    return c.body(null, 204);
});

proxyRoute.all('*', async (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');

    const method = c.req.method;

    if (method !== 'GET' && method !== 'HEAD') {
        return c.text('Method not allowed', 405);
    }

    const rawUrl = c.req.query('url');

    if (!rawUrl) {
        return c.json({ error: 'Missing url' }, 400);
    }

    const queryReferer = c.req.query('referer');
    const queryOrigin = c.req.query('origin');

    let referer = safeHeaderUrl(queryReferer) || `${EMBED_ORIGIN}/`;
    let origin = safeHeaderUrl(queryOrigin, true) || EMBED_ORIGIN;

    try {
        const target = new URL(rawUrl);

        if (target.hostname.toLowerCase().includes('videodownloader.site')) {
            referer = 'https://videodownloader.site/';
            origin = 'https://videodownloader.site';
        }
    } catch {
        return c.json({ error: 'Invalid upstream URL' }, 400);
    }

    const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Referer': referer,
        'Origin': origin
    };

    const range = c.req.header('range');

    if (range && /^bytes=\d*-\d*(,\d*-\d*)*$/.test(range)) {
        headers.Range = range;
    }

    let extraParams = '';

    if (queryReferer && safeHeaderUrl(queryReferer)) {
        extraParams += `&referer=${encodeURIComponent(referer)}`;
    }

    if (queryOrigin && safeHeaderUrl(queryOrigin, true)) {
        extraParams += `&origin=${encodeURIComponent(origin)}`;
    }

    if (c.req.query('va')) {
        extraParams += '&va=1';
    }

    try {
        const result = await safeFetchStream(
            rawUrl,
            headers,
            c.req.raw.signal,
            method as 'GET' | 'HEAD'
        );

        const response = result.response;
        const status = response.statusCode || 502;

        if (!response.complete && response.destroyed) {
            return c.text('Upstream connection failed', 502);
        }

        if (status < 200 || status >= 300) {
            response.destroy();
            return c.text('Upstream error', status as any);
        }

        if (status === 206) {
            c.status(206);
        } else {
            c.status(status as any);
        }

        const contentRange = responseHeader(response, 'content-range');
        const acceptRanges = responseHeader(response, 'accept-ranges');
        const contentType = (
            responseHeader(response, 'content-type') || ''
        ).toLowerCase();

        if (contentRange) c.header('Content-Range', contentRange);
        if (acceptRanges) c.header('Accept-Ranges', acceptRanges);

        if (method === 'HEAD') {
            const type = responseHeader(response, 'content-type');
            const length = responseHeader(response, 'content-length');

            if (type) c.header('Content-Type', type);
            if (length) c.header('Content-Length', length);

            response.destroy();
            return c.body(null, status as any);
        }

        const isM3u8 =
            result.finalUrl.toLowerCase().includes('.m3u8') ||
            contentType.includes('mpegurl') ||
            contentType.includes('x-mpegurl');

        if (isM3u8) {
            const text = await readManifest(response);

            if (text.includes('#EXTM3U')) {
                c.header('Content-Type', 'application/vnd.apple.mpegurl');
                c.header('Cache-Control', 'no-cache');

                return c.body(
                    rewriteM3u8(text, result.finalUrl, extraParams)
                );
            }

            c.header('Content-Type', 'video/mp2t');
            c.header('Cache-Control', 'public, max-age=86400');
            return c.body(text);
        }

        const contentLength = responseHeader(response, 'content-length');

        if (contentLength) {
            c.header('Content-Length', contentLength);
        }

        const isTs =
            /\.ts(?:$|[?#])/i.test(result.finalUrl) ||
            result.finalUrl.includes('/content/') ||
            result.finalUrl.includes('page-');

        const safeContentType = isTs
            ? 'video/mp2t'
            : (
                !contentType || contentType.includes('text/html')
                    ? 'video/mp4'
                    : contentType
            );

        c.header('Content-Type', safeContentType);
        c.header('Cache-Control', 'public, max-age=86400');

        return c.body(Readable.toWeb(response) as ReadableStream);
    } catch (error: any) {
        if (error instanceof ProxySecurityError) {
            return c.json(
                { error: 'Upstream destination blocked by security policy' },
                403
            );
        }

        console.error('[TStream proxy]', error.message);

        return c.json(
            { error: 'Stream temporarily unavailable or offline' },
            502
        );
    }
});
