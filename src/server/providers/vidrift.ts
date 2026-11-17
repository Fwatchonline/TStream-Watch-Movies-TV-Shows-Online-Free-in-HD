import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { USER_AGENT } from '../utils/helpers';

const BASE = 'https://embed.vidrift.in';

export class VidRiftProvider implements VideoProvider {
    key = 'vidrift';
    label = 'Nimbus';
    priority = 10;
    enabled = true;
    timeout = 9000;

    constructor(config?: ProviderConfig) {
        if (config?.label !== undefined) this.label = config.label;
        if (config?.priority !== undefined) this.priority = config.priority;
        if (config?.enabled !== undefined) this.enabled = config.enabled;
        if (config?.timeout !== undefined) this.timeout = config.timeout;
    }

    async getStream(id: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<StreamResult> {
        try {
            const endpoint =
                type === 'tv'
                    ? `${BASE}/embed/tv/${id}/${season || 1}/${episode || 1}`
                    : `${BASE}/embed/movie/${id}`;

            const res = await fetch(endpoint, {
                headers: {
                    Referer: `${BASE}/`,
                    Origin: BASE,
                    'User-Agent': USER_AGENT
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!res.ok) {
                return { success: false, source: this.key, error: 'Fetch failed' };
            }

            const html = await res.text();
            const metaMatch = html.match(/var\s+embedMeta\s*=\s*(\{[\s\S]*?\});/);
            if (metaMatch) {
                const embedMeta = JSON.parse(metaMatch[1]);
                if (Array.isArray(embedMeta.orionStreams) && embedMeta.orionStreams.length > 0) {
                    const sources = embedMeta.orionStreams
                        .filter((item: any) => item?.url)
                        .map((item: any, idx: number) => {
                            const fullUrl = String(item.url).startsWith('http')
                                ? String(item.url)
                                : new URL(String(item.url), BASE).href;
                            const sType = fullUrl.includes('.mp4') ? 'mp4' : 'hls';
                            return {
                                name: idx === 0 ? this.label : `${this.label} · Stream ${idx + 1}`,
                                url: `/api/proxy?url=${encodeURIComponent(fullUrl)}&referer=${encodeURIComponent(`${BASE}/`)}&origin=${encodeURIComponent(BASE)}`,
                                quality: item.quality || '1080p',
                                type: sType
                            };
                        });

                    if (sources.length > 0) {
                        return {
                            success: true,
                            source: this.key,
                            url: sources[0].url,
                            type: sources[0].type as 'hls' | 'mp4',
                            sources
                        };
                    }
                }
            }

            return { success: false, source: this.key, error: 'No Nimbus stream found' };
        } catch (err: any) {
            return { success: false, source: this.key, error: err.message };
        }
    }
}
