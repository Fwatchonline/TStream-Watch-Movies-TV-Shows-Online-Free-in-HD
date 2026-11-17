import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { fetchJson, USER_AGENT } from '../utils/helpers';

const API_BASE = 'https://api.fmov.my/api/streams/vidlink';

export class EclipseProvider implements VideoProvider {
    key = 'eclipse';
    label = 'Spectra';
    priority = 9;
    enabled = true;
    timeout = 8000;

    constructor(config?: ProviderConfig) {
        if (config?.label !== undefined) this.label = config.label;
        if (config?.priority !== undefined) this.priority = config.priority;
        if (config?.enabled !== undefined) this.enabled = config.enabled;
        if (config?.timeout !== undefined) this.timeout = config.timeout;
    }

    async getStream(id: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<StreamResult> {
        try {
            const endpoint = type === 'tv'
                ? `${API_BASE}/series/${id}?season=${season || 1}&episode=${episode || 1}`
                : `${API_BASE}/movie/${id}`;

            const data = await fetchJson(endpoint, {
                headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
                signal: AbortSignal.timeout(this.timeout)
            }).catch(() => null);

            if (!data?.success || !Array.isArray(data.streams) || data.streams.length === 0) {
                return { success: false, source: this.key, error: 'No streams from Spectra' };
            }

            const playable = data.streams.filter((s: any) => s?.url && !s.url.toLowerCase().endsWith('.mkv'));
            if (!playable.length) return { success: false, source: this.key, error: 'No compatible mp4 streams' };

            const qRank = (q?: string) => {
                const s = String(q || '').toLowerCase();
                if (s.includes('2160') || s.includes('4k')) return 2160;
                if (s.includes('1440')) return 1440;
                if (s.includes('1080')) return 1080;
                if (s.includes('720')) return 720;
                if (s.includes('480')) return 480;
                return 0;
            };

            const sources = playable
                .map((s: any) => ({
                    name: `${this.label} · ${s.quality || '1080p'}`,
                    url: `/api/proxy?url=${encodeURIComponent(s.url)}`,
                    quality: s.quality || '1080p',
                    type: s.url.includes('.m3u8') ? 'hls' : 'mp4'
                }))
                .sort((a: any, b: any) => qRank(b.quality) - qRank(a.quality));

            return {
                success: true,
                source: this.key,
                url: sources[0].url,
                type: sources[0].type as any,
                sources
            };
        } catch (err: any) {
            return { success: false, source: this.key, error: err.message };
        }
    }
}
