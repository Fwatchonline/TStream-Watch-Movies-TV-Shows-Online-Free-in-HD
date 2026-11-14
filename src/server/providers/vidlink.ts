import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { fetchJson, USER_AGENT } from '../utils/helpers';

export class VidLinkProvider implements VideoProvider {
    key = 'vidlink';
    label = 'Pulse';
    priority = 6;
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
            const encRes = await fetchJson(
                `https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(String(id))}`,
                {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(5000)
                }
            ).catch(() => null);

            const encodedTmdb = encRes?.result;
            if (!encodedTmdb) {
                return { success: false, source: this.key, error: 'Encryption failed' };
            }

            const apiUrl =
                type === 'tv'
                    ? `https://vidlink.pro/api/b/tv/${encodedTmdb}/${season || 1}/${episode || 1}?multiLang=0`
                    : `https://vidlink.pro/api/b/movie/${encodedTmdb}?multiLang=0`;

            const data = await fetchJson(apiUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Referer: 'https://vidlink.pro/',
                    Origin: 'https://vidlink.pro'
                },
                signal: AbortSignal.timeout(this.timeout)
            }).catch(() => null);

            const qualities = data?.stream?.qualities;
            const playlist = data?.stream?.playlist;
            const sources: NonNullable<StreamResult['sources']> = [];

            if (qualities && typeof qualities === 'object') {
                for (const qKey of ['1080', '720', '480', 'auto']) {
                    const q = qualities[qKey];
                    if (q?.url && q.codecName !== 'hevc' && !String(q.url).includes('/h265/')) {
                        const qLabel = qKey === 'auto' ? 'Auto' : `${qKey}p`;
                        sources.push({
                            name: `${this.label} (${qLabel})`,
                            url: `/api/proxy?url=${encodeURIComponent(q.url)}&referer=${encodeURIComponent('https://vidlink.pro/')}&origin=${encodeURIComponent('https://vidlink.pro')}`,
                            quality: qLabel,
                            type: String(q.url).includes('.m3u8') ? 'hls' : 'mp4'
                        });
                    }
                }
            }

            if (sources.length === 0 && typeof playlist === 'string' && playlist.startsWith('http')) {
                sources.push({
                    name: `${this.label} (Auto HLS)`,
                    url: `/api/proxy?url=${encodeURIComponent(playlist)}&referer=${encodeURIComponent('https://vidlink.pro/')}&origin=${encodeURIComponent('https://vidlink.pro')}`,
                    quality: 'Auto',
                    type: 'hls'
                });
            }

            if (!sources.length) {
                return { success: false, source: this.key, error: 'No browser-compatible links' };
            }

            return {
                success: true,
                source: this.key,
                url: sources[0].url,
                type: (sources[0].type as 'hls' | 'mp4') || 'hls',
                sources
            };
        } catch (err: any) {
            return { success: false, source: this.key, error: err.message };
        }
    }
}
