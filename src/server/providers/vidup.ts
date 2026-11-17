import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { USER_AGENT } from '../utils/helpers';

const VIDUP_BASE = 'https://vidup.to';
const ENC_API = 'https://enc-dec.app/api';

export class VidUpProvider implements VideoProvider {
    key = 'vidup';
    label = 'Cobalt';
    priority = 4;
    enabled = true;
    timeout = 10000;
    private fetchImpl: typeof fetch;

    constructor(config?: ProviderConfig & { fetchImpl?: typeof fetch }) {
        if (config?.label !== undefined) this.label = config.label;
        if (config?.priority !== undefined) this.priority = config.priority;
        if (config?.enabled !== undefined) this.enabled = config.enabled;
        if (config?.timeout !== undefined) this.timeout = config.timeout;
        this.fetchImpl = config?.fetchImpl || fetch;
    }

    async getStream(
        id: string,
        type: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<StreamResult> {
        try {
            const pageUrl =
                type === 'tv'
                    ? `${VIDUP_BASE}/tv/${id}/${season || 1}/${episode || 1}/`
                    : `${VIDUP_BASE}/movie/${id}`;

            const pageRes = await this.fetchImpl(pageUrl, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(5000)
            });
            if (!pageRes.ok) {
                return { success: false, source: this.key, error: `Page fetch HTTP ${pageRes.status}` };
            }
            const html = await pageRes.text();
            const tokenMatch = html.match(/\\?"(?:en|token)\\?":\\?"([^"\\]+)\\?"/);
            if (!tokenMatch?.[1]) {
                return { success: false, source: this.key, error: 'Page token missing' };
            }

            const s1Res = await this.fetchImpl(
                `${ENC_API}/enc-vidup?text=${encodeURIComponent(tokenMatch[1])}&stage=1`,
                {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(4500)
                }
            );
            if (!s1Res.ok) return { success: false, source: this.key, error: 'Stage 1 encode failed' };
            const s1Json = await s1Res.json();
            if (s1Json?.status !== 200 || !s1Json?.result?.stage1) {
                return { success: false, source: this.key, error: 'Invalid stage 1 response' };
            }

            const baseHeaders: Record<string, string> = {
                'User-Agent': USER_AGENT,
                Referer: `${VIDUP_BASE}/`,
                'X-Requested-With': 'XMLHttpRequest',
                ...(s1Json.result.token ? { 'X-CSRF-Token': String(s1Json.result.token) } : {})
            };

            const s1Post = await this.fetchImpl(s1Json.result.stage1, {
                method: 'POST',
                headers: baseHeaders,
                signal: AbortSignal.timeout(5000)
            });
            if (!s1Post.ok) return { success: false, source: this.key, error: 'Stage 1 POST failed' };
            const s1Text = await s1Post.text();

            const s2Res = await this.fetchImpl(
                `${ENC_API}/enc-vidup?text=${encodeURIComponent(s1Text)}&stage=2`,
                {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(4500)
                }
            );
            if (!s2Res.ok) return { success: false, source: this.key, error: 'Stage 2 encode failed' };
            const s2Json = await s2Res.json();
            if (
                s2Json?.status !== 200 ||
                !s2Json?.result?.servers ||
                !s2Json?.result?.stream
            ) {
                return { success: false, source: this.key, error: 'Invalid stage 2 response' };
            }

            const stage2Headers: Record<string, string> = {
                ...baseHeaders,
                ...(s2Json.result.token ? { 'X-CSRF-Token': String(s2Json.result.token) } : {})
            };
            const serversEncRes = await this.fetchImpl(s2Json.result.servers, {
                method: 'POST',
                headers: stage2Headers,
                signal: AbortSignal.timeout(5000)
            });
            if (!serversEncRes.ok) return { success: false, source: this.key, error: 'Servers fetch failed' };
            const serversEncrypted = await serversEncRes.text();

            const serversDecRes = await this.fetchImpl(`${ENC_API}/dec-vidup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                body: JSON.stringify({ text: serversEncrypted }),
                signal: AbortSignal.timeout(4500)
            });
            if (!serversDecRes.ok) return { success: false, source: this.key, error: 'Servers decrypt failed' };
            const serversDecJson = await serversDecRes.json();
            if (serversDecJson?.status !== 200 || !Array.isArray(serversDecJson?.result) || serversDecJson.result.length === 0) {
                return { success: false, source: this.key, error: 'No VidUp servers found' };
            }

            const targetServers = serversDecJson.result.slice(0, 2);
            const settled = await Promise.allSettled(
                targetServers.map(async (srv: any) => {
                    if (!srv?.data) return null;
                    const streamEncRes = await this.fetchImpl(`${s2Json.result.stream}/${srv.data}`, {
                        method: 'POST',
                        headers: stage2Headers,
                        signal: AbortSignal.timeout(5500)
                    });
                    if (!streamEncRes.ok) return null;
                    const streamEncrypted = await streamEncRes.text();

                    const streamDecRes = await this.fetchImpl(`${ENC_API}/dec-vidup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                        body: JSON.stringify({ text: streamEncrypted }),
                        signal: AbortSignal.timeout(4500)
                    });
                    if (!streamDecRes.ok) return null;
                    const decJson = await streamDecRes.json();
                    const rawUrl = String(decJson?.result?.url || '').trim();
                    if (decJson?.status !== 200 || !/^https?:\/\//i.test(rawUrl)) return null;

                    const noRef = Boolean(decJson?.result?.noReferrer);
                    const streamType = rawUrl.toLowerCase().includes('.mp4') ? 'mp4' : 'hls';
                    const proxiedUrl = noRef
                        ? `/api/proxy?url=${encodeURIComponent(rawUrl)}`
                        : `/api/proxy?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(`${VIDUP_BASE}/`)}&origin=${encodeURIComponent(VIDUP_BASE)}`;

                    const serverLabel = String(srv?.name || 'Primary').trim();
                    return {
                        name: `${this.label} · ${serverLabel}`,
                        url: proxiedUrl,
                        quality: streamType === 'hls' ? '4K / 1080p Auto' : '1080p',
                        type: streamType
                    };
                })
            );

            const sources: NonNullable<StreamResult['sources']> = [];
            const seenUrls = new Set<string>();
            for (const item of settled) {
                if (item.status === 'fulfilled' && item.value && !seenUrls.has(item.value.url)) {
                    seenUrls.add(item.value.url);
                    sources.push(item.value);
                }
            }

            if (sources.length === 0) {
                return { success: false, source: this.key, error: 'No playable streams found' };
            }

            return {
                success: true,
                source: this.key,
                url: sources[0].url,
                type: (sources[0].type as 'hls' | 'mp4') || 'hls',
                sources
            };
        } catch (err: any) {
            return { success: false, source: this.key, error: err?.message || 'VidUp resolution failed' };
        }
    }
}
