import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { fetchJson, USER_AGENT, getTmdbApiKey } from '../utils/helpers';

const API_BASE = 'https://streamdata.vaplayer.ru/api.php';
const EMBED_ORIGIN = 'https://nextgencloudfabric.com';

function extractStreamUrls(obj: any, urls = new Set<string>()): Set<string> {
    if (!obj) return urls;
    if (typeof obj === 'string') {
        if (obj.startsWith('http') && (obj.includes('.m3u8') || obj.includes('.mp4'))) {
            urls.add(obj);
        }
    } else if (Array.isArray(obj)) {
        for (const item of obj) extractStreamUrls(item, urls);
    } else if (typeof obj === 'object') {
        for (const val of Object.values(obj)) {
            extractStreamUrls(val, urls);
        }
    }
    return urls;
}

export class VidAPIProvider implements VideoProvider {
    key = 'vidapi';
    label = 'Sigma';
    priority = 8;
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
            const isImdb = id.startsWith('tt');
            const primaryUrl = isImdb
                ? `${API_BASE}?imdb=${id}&type=${type}${type === 'tv' ? `&season=${season}&episode=${episode}` : ''}`
                : `${API_BASE}?tmdb=${id}&type=${type}${type === 'tv' ? `&season=${season}&episode=${episode}` : ''}`;

            const referer = type === 'tv'
                ? `${EMBED_ORIGIN}/embed/tv/${id}/${season || 1}/${episode || 1}`
                : `${EMBED_ORIGIN}/embed/movie/${id}`;

            const data = await fetchJson(primaryUrl, {
                headers: {
                    'Accept': '*/*',
                    'Origin': EMBED_ORIGIN,
                    'Referer': referer,
                    'User-Agent': USER_AGENT
                },
                signal: AbortSignal.timeout(this.timeout)
            }).catch(() => null);

            let streamUrls = Array.from(extractStreamUrls(data));

            // If TMDB ID is not found, fallback to IMDb ID
            if (!streamUrls.length && !isImdb) {
                try {
                    const apiKey = getTmdbApiKey();
                    const extRes = await fetchJson(
                        `https://api.themoviedb.org/3/${type}/${id}/external_ids?api_key=${apiKey}`,
                        { signal: AbortSignal.timeout(3000) }
                    ).catch(() => null);

                    const imdbId = extRes?.imdb_id;
                    if (imdbId && imdbId.startsWith('tt')) {
                        const imdbUrl = `${API_BASE}?imdb=${imdbId}&type=${type}${type === 'tv' ? `&season=${season}&episode=${episode}` : ''}`;
                        const imdbData = await fetchJson(imdbUrl, {
                            headers: { 'Accept': '*/*', 'Origin': EMBED_ORIGIN, 'Referer': referer, 'User-Agent': USER_AGENT },
                            signal: AbortSignal.timeout(this.timeout)
                        }).catch(() => null);

                        if (imdbData) streamUrls = Array.from(extractStreamUrls(imdbData));
                    }
                } catch {
                    // Fallback attempt ignored
                }
            }

            if (!streamUrls.length) return { success: false, source: this.key, error: 'No stream URLs found' };

            const primaryStream = streamUrls[0];
            const proxiedUrl = `/api/proxy?url=${encodeURIComponent(primaryStream)}&va=1&referer=${encodeURIComponent(`${EMBED_ORIGIN}/`)}&origin=${encodeURIComponent(EMBED_ORIGIN)}`;

            return {
                success: true,
                source: this.key,
                url: proxiedUrl,
                type: primaryStream.includes('.m3u8') ? 'hls' : 'mp4',
                sources: streamUrls.map((s, idx) => ({
                    name: `${this.label} · Stream ${idx + 1}`,
                    url: `/api/proxy?url=${encodeURIComponent(s)}&va=1&referer=${encodeURIComponent(`${EMBED_ORIGIN}/`)}&origin=${encodeURIComponent(EMBED_ORIGIN)}`,
                    quality: s.includes('.m3u8') ? '1080p Auto' : '1080p',
                    type: s.includes('.m3u8') ? 'hls' : 'mp4'
                }))
            };
        } catch (err: any) {
            return { success: false, source: this.key, error: err.message };
        }
    }
}
