import { VideoProvider, StreamResult, ProviderConfig, Subtitle } from '../types';
import { USER_AGENT } from '../utils/helpers';

const WING_BASE = 'https://api.wing.st';
const ENC_API = 'https://enc-dec.app/api';
const CINEJOY_REFERER = 'https://cinejoy.pk/';
const CINEJOY_ORIGIN = 'https://cinejoy.pk';
const DEFAULT_SERVERS = ['Light', 'Lisbon', 'Sirius', 'Rigel'];

const BASE_HEADERS = {
    Accept: '*/*',
    Origin: CINEJOY_ORIGIN,
    Referer: CINEJOY_REFERER,
    'User-Agent': USER_AGENT
};

let cachedServers: { list: string[]; expiresAt: number } | null = null;
let serversInFlight: Promise<string[]> | null = null;

function b64UrlToBuffer(b64u: string): Buffer {
    const pad = (4 - (b64u.length % 4)) % 4;
    const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
    return Buffer.from(b64, 'base64');
}

function bufferToB64Url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getWingServers(): Promise<string[]> {
    const now = Date.now();
    if (cachedServers && cachedServers.expiresAt > now) {
        return cachedServers.list;
    }
    if (serversInFlight) {
        return serversInFlight;
    }

    serversInFlight = (async () => {
        try {
            const res = await fetch(`${WING_BASE}/servers`, {
                headers: BASE_HEADERS,
                signal: AbortSignal.timeout(4000)
            });
            if (res.ok) {
                const data = await res.json();
                const names = Array.isArray(data?.servers)
                    ? data.servers
                          .map((s: any) => String(s?.name || '').trim())
                          .filter((name: string) => Boolean(name) && name !== 'Warsaw')
                    : [];
                if (names.length > 0) {
                    cachedServers = { list: names, expiresAt: Date.now() + 10 * 60 * 1000 };
                    return names;
                }
            }
        } catch {
            // Fall back to verified fast default servers
        }
        return DEFAULT_SERVERS;
    })().finally(() => {
        serversInFlight = null;
    });

    return serversInFlight;
}

export class CinejoyProvider implements VideoProvider {
    key = 'cinejoy';
    label = 'Aether';
    priority = 1;
    enabled = true;
    timeout = 9500;
    private fetchImpl: typeof fetch;

    constructor(config?: ProviderConfig & { fetchImpl?: typeof fetch }) {
        if (config?.label !== undefined) this.label = config.label;
        if (config?.priority !== undefined) this.priority = config.priority;
        if (config?.enabled !== undefined) this.enabled = config.enabled;
        if (config?.timeout !== undefined) this.timeout = config.timeout;
        this.fetchImpl = config?.fetchImpl || fetch;
    }

    private async fetchSingleServer(
        serverName: string,
        id: string,
        type: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<{ sources: NonNullable<StreamResult['sources']>; subtitles: Subtitle[] } | null> {
        const mediaTypeParam = type === 'tv' ? 'series' : 'movie';
        const targetUrl =
            type === 'tv'
                ? `${WING_BASE}/?title=&type=${mediaTypeParam}&year=&imdb=&tmdb=${encodeURIComponent(id)}&server=${encodeURIComponent(serverName)}&season=${season || 1}&episode=${episode || 1}`
                : `${WING_BASE}/?title=&type=${mediaTypeParam}&year=&imdb=&tmdb=${encodeURIComponent(id)}&server=${encodeURIComponent(serverName)}`;

        const encRes = await this.fetchImpl(
            `${ENC_API}/enc-cinejoy?url=${encodeURIComponent(targetUrl)}`,
            {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(4500)
            }
        );
        if (!encRes.ok) return null;
        const encJson = await encRes.json();
        if (encJson?.status !== 200 || !encJson?.result?.data || !encJson?.result?.state) {
            return null;
        }

        const payloadBuf = b64UrlToBuffer(String(encJson.result.data));
        const wingRes = await this.fetchImpl(`${WING_BASE}/g`, {
            method: 'POST',
            headers: BASE_HEADERS,
            body: new Uint8Array(payloadBuf),
            signal: AbortSignal.timeout(6000)
        });
        if (!wingRes.ok) return null;

        const respBuf = Buffer.from(await wingRes.arrayBuffer());
        if (respBuf.length === 0) return null;

        const decRes = await this.fetchImpl(`${ENC_API}/dec-cinejoy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
            body: JSON.stringify({
                text: bufferToB64Url(respBuf),
                state: encJson.result.state
            }),
            signal: AbortSignal.timeout(4500)
        });
        if (!decRes.ok) return null;
        const decJson = await decRes.json();
        if (decJson?.status !== 200) return null;

        const streamList = decJson?.result?.data?.stream;
        if (!Array.isArray(streamList) || streamList.length === 0) {
            return null;
        }

        const sources: NonNullable<StreamResult['sources']> = [];
        const subtitles: Subtitle[] = [];

        for (const item of streamList) {
            const rawUrl = String(item?.playlist || item?.url || '').trim();
            if (!/^https?:\/\//i.test(rawUrl)) continue;
            const streamType = rawUrl.toLowerCase().includes('.mp4') ? 'mp4' : 'hls';
            const proxiedUrl = `/api/proxy?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(CINEJOY_REFERER)}&origin=${encodeURIComponent(CINEJOY_ORIGIN)}`;
            sources.push({
                name: `${this.label} · ${serverName}`,
                url: proxiedUrl,
                quality: String(item?.quality || (streamType === 'hls' ? '1080p Auto' : '1080p')),
                type: streamType
            });

            if (Array.isArray(item?.captions)) {
                for (const cap of item.captions) {
                    const capUrl = String(cap?.url || '').trim();
                    if (/^https?:\/\//i.test(capUrl)) {
                        subtitles.push({
                            label: String(cap?.label || cap?.id || 'English').toUpperCase(),
                            file: capUrl,
                            type: capUrl.toLowerCase().includes('.srt') ? 'srt' : 'vtt',
                            language: String(cap?.id || 'en')
                        });
                    }
                }
            }
        }

        return sources.length > 0 ? { sources, subtitles } : null;
    }

    async getStream(
        id: string,
        type: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<StreamResult> {
        try {
            const serverList = this.fetchImpl === fetch ? await getWingServers() : ['Light', 'Lisbon'];
            const preferredOrder = DEFAULT_SERVERS.filter(s => serverList.includes(s));
            const remaining = serverList.filter(s => !preferredOrder.includes(s));
            const candidates = [...preferredOrder, ...remaining].slice(0, 4);

            const settled = await Promise.allSettled(
                candidates.map(srv => this.fetchSingleServer(srv, id, type, season, episode))
            );

            const allSources: NonNullable<StreamResult['sources']> = [];
            const allSubtitles: Subtitle[] = [];
            const seenUrls = new Set<string>();
            const seenSubUrls = new Set<string>();

            for (const item of settled) {
                if (item.status === 'fulfilled' && item.value) {
                    for (const src of item.value.sources) {
                        if (!seenUrls.has(src.url)) {
                            seenUrls.add(src.url);
                            allSources.push(src);
                        }
                    }
                    for (const sub of item.value.subtitles) {
                        if (!seenSubUrls.has(sub.file)) {
                            seenSubUrls.add(sub.file);
                            allSubtitles.push(sub);
                        }
                    }
                }
            }

            if (allSources.length === 0) {
                return { success: false, source: this.key, error: 'No playable streams found' };
            }

            return {
                success: true,
                source: this.key,
                url: allSources[0].url,
                type: (allSources[0].type as 'hls' | 'mp4') || 'hls',
                sources: allSources,
                ...(allSubtitles.length > 0 ? { subtitles: allSubtitles } : {})
            };
        } catch (err: any) {
            return { success: false, source: this.key, error: err?.message || 'CineJoy resolution failed' };
        }
    }
}
