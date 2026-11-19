import { Hono } from 'hono';
import { StreamRequest, VideoProvider } from '../types';
import {
    getActiveProviders,
    getProviderLatencyMs,
    recordProviderLatency,
    recordProviderPlaybackOutcome,
    getProviderHealthRecords
} from '../providers';
import { enrichSourcesWithRealQuality, normalizeConcreteQuality, qualityRankScore } from '../utils/qualityProbe';
import { getCachedTmdbMappingForAnime, resolveTmdbIdForAnime } from './anilist';

const DEFAULT_PROVIDER_TIMEOUT_MS = 12000;
const STREAM_CACHE_TTL_MS = 90_000;
const MAX_STREAM_CACHE_ENTRIES = 250;

export interface StreamRouteOptions {
    getProviders?: () => VideoProvider[];
    recordLatency?: (key: string, latencyMs: number, succeeded: boolean, opts?: { timedOut?: boolean; error?: string }) => void;
    getLatency?: (key: string) => number | null;
    enrichSources?: (
        sources: NonNullable<Awaited<ReturnType<VideoProvider['getStream']>>['sources']>
    ) => Promise<NonNullable<Awaited<ReturnType<VideoProvider['getStream']>>['sources']>>;
    timeoutMs?: number;
}

interface CachedStreamResponse {
    expiresAt: number;
    payload: Record<string, any>;
}

export function createStreamRoute(options: StreamRouteOptions = {}): Hono {
    const route = new Hono();
    const getProvidersFn = options.getProviders || (() => getActiveProviders());
    const recordLatencyFn = options.recordLatency || recordProviderLatency;
    const getLatencyFn = options.getLatency || getProviderLatencyMs;
    const enrichSourcesFn = options.enrichSources || ((srcs) => enrichSourcesWithRealQuality(srcs));
    const providerTimeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
    const responseCache = new Map<string, CachedStreamResponse>();

    route.get('/providers', (c) => {
        const healthRecords = getProviderHealthRecords();
        const healthMap = new Map(healthRecords.map((h) => [h.key, h]));
        const list = getProvidersFn().map((p, index) => {
            const h = healthMap.get(p.key);
            return {
                key: p.key,
                label: p.label,
                priority: p.priority,
                rank: index + 1,
                estimatedResponseTimeMs: getLatencyFn(p.key),
                healthScore: h?.healthScore ?? 90,
                successRate: h?.successRate ?? 1,
                enabled: p.enabled !== false
            };
        });
        return c.json({
            success: true,
            fastest: list[0] || null,
            providers: list
        });
    });

    route.get('/health', (c) => {
        const records = getProviderHealthRecords();
        return c.json({
            success: true,
            updatedAt: new Date().toISOString(),
            providers: records
        });
    });

    route.post('/health/outcome', async (c) => {
        try {
            const body = await c.req.json().catch(() => null) as {
                provider?: string;
                succeeded?: boolean;
                reason?: string;
                responseTimeMs?: number;
            } | null;

            const key = String(body?.provider || '').trim().toLowerCase();
            if (!key) {
                return c.json({ success: false, error: 'Missing provider key.' }, 400);
            }
            const succeeded = Boolean(body?.succeeded);
            recordProviderPlaybackOutcome(key, succeeded, body?.reason);
            if (typeof body?.responseTimeMs === 'number' && Number.isFinite(body.responseTimeMs)) {
                recordLatencyFn(key, body.responseTimeMs, succeeded, { error: body?.reason });
            }
            return c.json({ success: true, provider: key, recorded: true });
        } catch {
            return c.json({ success: false, error: 'Invalid health outcome payload.' }, 400);
        }
    });

    route.get('/:type/:id', async (c) => {
        const rawType = c.req.param('type');
        if (rawType !== 'movie' && rawType !== 'tv' && rawType !== 'anime') {
            return c.json({ success: false, error: 'Invalid media type. Expected "movie", "tv", or "anime".' }, 400);
        }
        const type: 'movie' | 'tv' | 'anime' = rawType;

        const id = c.req.param('id');
        if (!id || !/^\d+$/.test(id) || parseInt(id, 10) <= 0) {
            return c.json({ success: false, error: 'Invalid or missing numeric media ID.' }, 400);
        }

        const rawSeason = c.req.query('season');
        const rawEpisode = c.req.query('episode');
        const rawTmdbId = (c.req.query('tmdbId') || '').trim();
        const rawMalId = (c.req.query('malId') || '').trim();
        const rawTitle = (c.req.query('title') || '').trim();
        const rawAudioType = c.req.query('audio') === 'dub' ? 'dub' : 'sub';
        const preferredProvider = (c.req.query('provider') || '').trim().toLowerCase() || undefined;
        const singleMode = c.req.query('single') === '1' || c.req.query('only') === '1';
        const bypassCache = c.req.query('refresh') === '1';
        const excludeParam = (c.req.query('exclude') || '').trim().toLowerCase();
        const excludedProviders = new Set(
            excludeParam ? excludeParam.split(',').map((s) => s.trim()).filter(Boolean) : []
        );

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

        // For anime requests, prefer mapped TMDB ID (explicit query, server cache, or title lookup)
        let effectiveTmdbId = type === 'anime' ? (/^\d+$/.test(rawTmdbId) ? rawTmdbId : undefined) : id;
        if (type === 'anime' && !effectiveTmdbId) {
            const anilistNum = parseInt(id, 10);
            const cachedMapping = getCachedTmdbMappingForAnime(anilistNum);
            if (cachedMapping?.tmdbId) {
                effectiveTmdbId = String(cachedMapping.tmdbId);
            } else if (rawTitle && !options.getProviders) {
                const resolved = await resolveTmdbIdForAnime({
                    anilistId: anilistNum,
                    malId: /^\d+$/.test(rawMalId) ? parseInt(rawMalId, 10) : undefined,
                    title: rawTitle
                }).catch(() => null);
                if (resolved?.tmdbId) {
                    effectiveTmdbId = String(resolved.tmdbId);
                }
            }
        }
        const streamRequest: StreamRequest = {
            mediaType: type,
            tmdbId: effectiveTmdbId,
            anilistId: type === 'anime' ? parseInt(id, 10) : undefined,
            malId: /^\d+$/.test(rawMalId) ? parseInt(rawMalId, 10) : undefined,
            title: rawTitle || undefined,
            season: type === 'movie' ? undefined : season ?? 1,
            episode: type === 'movie' ? undefined : episode ?? 1,
            audioType: rawAudioType
        };

        const cacheKey = `${type}:${id}:${effectiveTmdbId || ''}:${season ?? ''}:${episode ?? ''}:${rawAudioType}:${preferredProvider || ''}:${singleMode ? 1 : 0}:${excludeParam}`;
        if (!bypassCache && !options.getProviders) {
            const cached = responseCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return c.json({ ...cached.payload, cached: true });
            }
        }

        let activeList = getProvidersFn();
        if (excludedProviders.size > 0) {
            activeList = activeList.filter((p) => !excludedProviders.has(p.key.toLowerCase()));
        }
        if (singleMode && preferredProvider && preferredProvider !== 'all') {
            const matched = activeList.filter((p) => p.key.toLowerCase() === preferredProvider);
            if (matched.length > 0) {
                activeList = matched;
            }
        }

        const results: Array<{
            key: string;
            label: string;
            priority: number;
            responseTimeMs: number;
            quality?: string;
            url: string;
            type: 'hls' | 'mp4' | 'dash';
            sources: NonNullable<Awaited<ReturnType<VideoProvider['getStream']>>['sources']>;
        }> = [];
        let failedProviders = 0;

        // Query active providers in parallel and benchmark real response times
        await Promise.allSettled(
            activeList.map(async (provider) => {
                const startedAt = Date.now();
                let timer: ReturnType<typeof setTimeout> | undefined;
                try {
                    const invokeProvider = async () => {
                        if (typeof provider.resolveStream === 'function') {
                            return provider.resolveStream(streamRequest);
                        }
                        if (type === 'anime') {
                            if (!effectiveTmdbId) {
                                return {
                                    success: false,
                                    source: provider.key,
                                    error: 'Anime title requires TMDB mapping for this provider'
                                };
                            }
                            return provider.getStream(effectiveTmdbId, 'tv', season ?? 1, episode ?? 1);
                        }
                        return provider.getStream(id, type, season, episode);
                    };

                    const res = await Promise.race([
                        invokeProvider(),
                        new Promise<never>((_, reject) => {
                            timer = setTimeout(() => reject(new Error('Provider timeout')), providerTimeoutMs);
                        })
                    ]);

                    const responseTimeMs = Math.max(0, Date.now() - startedAt);
                    const succeeded = Boolean(res.success && res.url);
                    recordLatencyFn(provider.key, responseTimeMs, succeeded, {
                        error: succeeded ? undefined : res.error || 'No stream returned'
                    });

                    if (succeeded && res.url) {
                        const rawSources = Array.isArray(res.sources) ? res.sources : [];
                        const enrichedSources =
                            rawSources.length > 0
                                ? await enrichSourcesFn(rawSources).catch(() => rawSources)
                                : [];

                        let bestQuality: string | undefined;
                        let bestScore = -1;
                        for (const src of enrichedSources) {
                            const concrete = normalizeConcreteQuality(src.quality) || src.quality;
                            const score = qualityRankScore(concrete);
                            if (concrete && score > bestScore) {
                                bestScore = score;
                                bestQuality = concrete;
                            }
                        }

                        results.push({
                            key: provider.key,
                            label: provider.label,
                            priority: provider.priority,
                            responseTimeMs,
                            ...(bestQuality ? { quality: bestQuality } : {}),
                            url: enrichedSources[0]?.url || res.url,
                            type: (enrichedSources[0]?.type as 'hls' | 'mp4' | 'dash') || res.type || 'hls',
                            sources: enrichedSources
                        });
                    }
                } catch (err: any) {
                    const responseTimeMs = Math.max(0, Date.now() - startedAt);
                    const msg = String(err?.message || 'Upstream failure');
                    recordLatencyFn(provider.key, responseTimeMs, false, {
                        timedOut: /timeout/i.test(msg),
                        error: msg
                    });
                    failedProviders++;
                } finally {
                    if (timer) clearTimeout(timer);
                }
            })
        );

        const primaryKey = preferredProvider && preferredProvider !== 'all' ? preferredProvider : 'cinejoy';
        results.sort((a, b) => {
            const aPref = a.key.toLowerCase() === primaryKey ? 0 : 1;
            const bPref = b.key.toLowerCase() === primaryKey ? 0 : 1;
            if (aPref !== bPref) return aPref - bPref;
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
        const responsePayload = {
            success: true,
            source: primary.key,
            primaryServer: primary.label,
            ...(primary.quality ? { quality: primary.quality } : {}),
            responseTimeMs: primary.responseTimeMs,
            url: primary.url,
            type: primary.type,
            servers: results
        };

        if (!options.getProviders) {
            if (responseCache.size >= MAX_STREAM_CACHE_ENTRIES) {
                const oldestKey = responseCache.keys().next().value;
                if (oldestKey) responseCache.delete(oldestKey);
            }
            responseCache.set(cacheKey, {
                expiresAt: Date.now() + STREAM_CACHE_TTL_MS,
                payload: responsePayload
            });
        }

        return c.json(responsePayload);
    });

    return route;
}

export const streamRoute = createStreamRoute();
