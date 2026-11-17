import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { getTmdbApiKey } from '../utils/helpers';

export class LMScriptProvider implements VideoProvider {
    key = 'lmscript';
    label = 'Onyx';
    priority = 12;
    enabled = true;
    timeout = 10000;

    constructor(config?: ProviderConfig) {
        if (config?.label !== undefined) this.label = config.label;
        if (config?.priority !== undefined) this.priority = config.priority;
        if (config?.enabled !== undefined) this.enabled = config.enabled;
        if (config?.timeout !== undefined) this.timeout = config.timeout;
    }

    async getStream(id: string, type: "movie" | "tv", season?: number, episode?: number): Promise<StreamResult> {
        try {
            if (type === 'tv') {
                return { success: false, source: this.key, error: 'TV not supported by LMScript' };
            }

            const apiKey = getTmdbApiKey();
            if (!apiKey) return { success: false, source: this.key, error: 'TMDB API key not configured' };

            const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}`, {
                signal: AbortSignal.timeout(4000)
            });
            if (!tmdbRes.ok) return { success: false, source: this.key, error: 'Failed to fetch TMDB info' };
            const tmdbData = await tmdbRes.json();
            const name = tmdbData.title || tmdbData.original_title;
            if (!name) return { success: false, source: this.key, error: 'No movie title' };

            const url = `https://lmscript.xyz/v1/movies?filters[q]=${encodeURIComponent(name)}&expand=streams`;
            const response = await fetch(url, { signal: AbortSignal.timeout(this.timeout) });
            const data = await response.json() as any;

            const movie = data.items?.find((item: any) => `${item.tmdb_prefix}` === `${id}` || `${item.tmdb_id}` === `${id}`);
            if (!movie || !movie.streams) return { success: false, source: this.key, error: 'Not found in LMScript' };

            const streams = movie.streams;
            const qScore = (q: string) => {
                const s = q.toLowerCase();
                if (s.includes('2160') || s.includes('4k')) return 2160;
                if (s.includes('1440')) return 1440;
                if (s.includes('1080')) return 1080;
                if (s.includes('720')) return 720;
                if (s.includes('480')) return 480;
                return 0;
            };
            const qualities = Object.keys(streams).sort((a, b) => qScore(b) - qScore(a));
            if (!qualities.length) return { success: false, source: this.key, error: 'No streams' };

            const bestQuality = qualities[0];
            const streamUrl = streams[bestQuality];

            return {
                success: true,
                source: this.key,
                url: `/api/proxy?url=${encodeURIComponent(streamUrl)}`,
                type: streamUrl.includes('.m3u8') ? 'hls' : 'mp4',
                sources: qualities.map(q => ({
                    name: `${this.label} · ${q}`,
                    url: `/api/proxy?url=${encodeURIComponent(streams[q])}`,
                    type: streams[q].includes('.m3u8') ? 'hls' : 'mp4',
                    quality: q
                }))
            };
        } catch (e: any) {
            return { success: false, source: this.key, error: e.message };
        }
    }
}
