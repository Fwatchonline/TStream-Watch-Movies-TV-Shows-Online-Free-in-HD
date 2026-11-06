import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { fetchJson, USER_AGENT } from '../utils/helpers';

export class BoxMovieProvider implements VideoProvider {
    key = 'boxmovie';
    label = 'BoxMovie';
    priority = 5;
    enabled = true;
    timeout = 8000;

    constructor(config?: ProviderConfig) {
        if (config?.priority !== undefined) this.priority = config.priority;
        if (config?.enabled !== undefined) this.enabled = config.enabled;
        if (config?.timeout !== undefined) this.timeout = config.timeout;
    }

    async getStream(id: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<StreamResult> {
        try {
            const query = new URLSearchParams({
                type: type === 'tv' ? 'tv' : 'movie',
                id: String(id)
            });
            if (type === 'tv') {
                query.set('season', String(season || 1));
                query.set('episode', String(episode || 1));
            }

            const url = `https://themoviebox.uk/api/resolve?${query.toString()}`;
            const data = await fetchJson(url, {
                headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
                signal: AbortSignal.timeout(this.timeout)
            }).catch(() => null);

            if (!data?.success || !Array.isArray(data.sources) || data.sources.length === 0) {
                return { success: false, source: this.key, error: 'No streams from BoxMovie' };
            }

            const sources = data.sources
                .filter((s: any) => s && (s.original_url || s.url))
                .map((s: any) => {
                    const rawUrl = s.original_url || s.url;
                    let qLabel = '1080p';
                    const sName = String(s.server || '').toLowerCase();
                    if (sName.includes('720')) qLabel = '720p';
                    else if (sName.includes('480')) qLabel = '480p';

                    return {
                        name: `BoxMovie · ${qLabel}`,
                        url: `/api/proxy?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent('https://videodownloader.site/')}`,
                        quality: qLabel,
                        type: 'mp4' as const
                    };
                });

            if (sources.length === 0) return { success: false, source: this.key, error: 'Empty BoxMovie sources' };

            return {
                success: true,
                source: this.key,
                url: sources[0].url,
                type: 'mp4',
                sources
            };
        } catch (err: any) {
            return { success: false, source: this.key, error: err.message };
        }
    }
}
