import { Hono } from 'hono';
import { VideoProvider } from '../types';
import { getActiveProviders, getProviderLatencyMs, recordProviderLatency } from '../providers';

const DEFAULT_PROVIDER_TIMEOUT_MS = 12000;

export interface StreamRouteOptions {
    getProviders?: () => VideoProvider[];
    recordLatency?: (key: string, latencyMs: number, succeeded: boolean) => void;
    getLatency?: (key: string) => number | null;
    timeoutMs?: number;
}

export function createStreamRoute(options: StreamRouteOptions = {}): Hono {
    const route = new Hono();
    const getProvidersFn = options.getProviders || (() => getActiveProviders());
    const recordLatencyFn = options.recordLatency || recordProviderLatency;
    const getLatencyFn = options.getLatency || getProviderLatencyMs;
    const providerTimeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

    route.get('/providers', (c) => {
        const list = getProvidersFn().map((p, index) => ({
            key: p.key,
            label: p.label,
            priority: p.priority,
            rank: index + 1,
            estimatedResponseTimeMs: getLatencyFn(p.key),
            enabled: p.enabled !== false
        }));
        return c.json({
            success: true,
            fastest: list[0] || null,
            providers: list
        });
    });

    route.get('/:type/:id', async (c) => {
        const rawType = c.req.param('type');
        if (rawType !== 'movie' && rawType !== 'tv') {
            return c.json({ success: false, error: 'Invalid media type. Expected "movie" or "tv".' }, 400);
        }
        const type: 'movie' | 'tv' = rawType;

        const id = c.req.param('id');
        if (!id || !/^\d+$/.test(id) || parseInt(id, 10) <= 0) {
            return c.json({ success: false, error: 'Invalid or missing numeric TMDB id.' }, 400);
        }

        const rawSeason = c.req.query('season');
        const rawEpisode = c.req.query('episode');
        const preferredProvider = (c.req.query('provider') || '').trim().toLowerCase() || undefined;
        let season: number | undefined;
        let episode: number | undefined;

        if (rawSeason !== undefined) {
            if (!/^\d+$/.test(rawSeason) || parseInt(rawSeason, 10) < 1) {
                return c.json({ success: false, error: 'Invalid season parameter.' }, 400);
            }
            season = parseInt(rawSeason, 10);
        }

        if (rawEpisode !== undefined) {
            if (!/^\d+$/.test(rawEpisode) || parseInt(rawEpisode, 10) < 1) {
                return c.json({ success: false, error: 'Invalid episode parameter.' }, 400);
            }
            episode = parseInt(rawEpisode, 10);
        }

        const activeList = getProvidersFn();
        const results: Array<{
            key: string;
            label: string;
            priority: number;
            responseTimeMs: number;
            url: string;
            type: 'hls' | 'mp4' | 'dash';
            sources: NonNullable<Awaited<ReturnType<VideoProvider['getStream']>>['sources']>;
        }> = [];
        let failedProviders = 0;

        // Query all active providers in parallel and benchmark real response times
        await Promise.allSettled(
            activeList.map(async (provider) => {
                const startedAt = Date.now();
                let timer: ReturnType<typeof setTimeout> | undefined;
                try {
                    const res = await Promise.race([
                        provider.getStream(id, type, season, episode),
                        new Promise<never>((_, reject) => {
                            timer = setTimeout(() => reject(new Error('Provider timeout')), providerTimeoutMs);
                        })
                    ]);
                    const responseTimeMs = Math.max(0, Date.now() - startedAt);
                    const succeeded = Boolean(res.success && res.url);
                    recordLatencyFn(provider.key, responseTimeMs, succeeded);

                    if (succeeded && res.url) {
                        results.push({
                            key: provider.key,
                            label: provider.label,
                            priority: provider.priority,
                            responseTimeMs,
                            url: res.url,
                            type: res.type || 'hls',
                            sources: res.sources || []
                        });
                    }
                } catch {
                    const responseTimeMs = Math.max(0, Date.now() - startedAt);
                    recordLatencyFn(provider.key, responseTimeMs, false);
                    failedProviders++;
                } finally {
                    if (timer) clearTimeout(timer);
                }
            })
        );

        // Fastest responding working provider comes FIRST (honoring explicit ?provider= override if selected)
        results.sort((a, b) => {
            if (preferredProvider) {
                const aPref = a.key.toLowerCase() === preferredProvider ? 0 : 1;
                const bPref = b.key.toLowerCase() === preferredProvider ? 0 : 1;
                if (aPref !== bPref) return aPref - bPref;
            }
            if (a.responseTimeMs !== b.responseTimeMs) {
                return a.responseTimeMs - b.responseTimeMs;
            }
            return a.priority - b.priority;
        });

        if (results.length === 0) {
            if (activeList.length > 0 && failedProviders === activeList.length) {
                return c.json(
                    { success: false, error: 'Upstream stream providers are temporarily unavailable or timed out.' },
                    503
                );
            }
            return c.json(
                { success: false, error: 'No active server returned a working stream for this title.' },
                404
            );
        }

        const primary = results[0];

        return c.json({
            success: true,
            source: primary.key,
            primaryServer: primary.label,
            responseTimeMs: primary.responseTimeMs,
            url: primary.url,
            type: primary.type,
            servers: results
        });
    });

    return route;
}

export const streamRoute = createStreamRoute();
