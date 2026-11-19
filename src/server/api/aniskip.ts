import { Hono } from 'hono';

export interface AniSkipInterval {
  skipType: 'op' | 'ed' | 'recap' | 'mixed-op' | 'mixed-ed';
  startTime: number;
  endTime: number;
  skipId?: string;
  episodeLength?: number;
}

interface CacheEntry {
  expiresAt: number;
  found: boolean;
  intervals: AniSkipInterval[];
}

const ANISKIP_CACHE_TTL_MS = 30 * 60 * 1000;
const ANISKIP_MAX_CACHE_ENTRIES = 300;
const ANISKIP_TIMEOUT_MS = 5000;

export function createAniSkipRoute(options: { fetchImpl?: typeof fetch } = {}): Hono {
  const route = new Hono();
  const fetchFn = options.fetchImpl || fetch;
  const cache = new Map<string, CacheEntry>();

  route.get('/skip-times/:malId/:episode', async (c) => {
    const rawMalId = c.req.param('malId');
    const rawEpisode = c.req.param('episode');

    if (!/^\d+$/.test(rawMalId) || !/^\d+$/.test(rawEpisode)) {
      return c.json({ success: false, error: 'Invalid malId or episode parameter.' }, 400);
    }

    const malId = parseInt(rawMalId, 10);
    const episode = parseInt(rawEpisode, 10);
    if (malId <= 0 || episode <= 0) {
      return c.json({ success: false, error: 'malId and episode must be positive integers.' }, 400);
    }

    const rawLength = c.req.query('episodeLength');
    const episodeLength = rawLength && /^\d+(\.\d+)?$/.test(rawLength) ? rawLength : '0';
    const cacheKey = `${malId}:${episode}`;

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      c.header('Cache-Control', 'public, max-age=1800');
      return c.json({
        success: true,
        found: cached.found,
        malId,
        episode,
        intervals: cached.intervals,
        cached: true
      });
    }

    const endpoint = `https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types=op&types=ed&types=recap&types=mixed-op&types=mixed-ed&episodeLength=${episodeLength}`;

    try {
      const res = await fetchFn(endpoint, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TStream/1.0 (+https://tstream.online)'
        },
        signal: AbortSignal.timeout(ANISKIP_TIMEOUT_MS)
      });

      if (res.status === 404) {
        if (cache.size >= ANISKIP_MAX_CACHE_ENTRIES) {
          const oldest = cache.keys().next().value;
          if (oldest) cache.delete(oldest);
        }
        cache.set(cacheKey, {
          expiresAt: Date.now() + ANISKIP_CACHE_TTL_MS,
          found: false,
          intervals: []
        });
        c.header('Cache-Control', 'public, max-age=1800');
        return c.json({
          success: true,
          found: false,
          malId,
          episode,
          intervals: []
        });
      }

      if (!res.ok) {
        return c.json({
          success: true,
          found: false,
          malId,
          episode,
          intervals: [],
          upstreamStatus: res.status
        });
      }

      const data = await res.json().catch(() => null) as any;
      const rawResults = Array.isArray(data?.results) ? data.results : [];
      const intervals: AniSkipInterval[] = [];

      for (const item of rawResults) {
        const start = Number(item?.interval?.startTime);
        const end = Number(item?.interval?.endTime);
        const skipType = String(item?.skipType || '');
        if (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start >= 0 &&
          end > start &&
          (skipType === 'op' ||
            skipType === 'ed' ||
            skipType === 'recap' ||
            skipType === 'mixed-op' ||
            skipType === 'mixed-ed')
        ) {
          intervals.push({
            skipType,
            startTime: start,
            endTime: end,
            skipId: item?.skipId ? String(item.skipId) : undefined,
            episodeLength: Number.isFinite(Number(item?.episodeLength)) ? Number(item.episodeLength) : undefined
          });
        }
      }

      if (cache.size >= ANISKIP_MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(cacheKey, {
        expiresAt: Date.now() + ANISKIP_CACHE_TTL_MS,
        found: intervals.length > 0,
        intervals
      });

      c.header('Cache-Control', 'public, max-age=1800');
      return c.json({
        success: true,
        found: intervals.length > 0,
        malId,
        episode,
        intervals
      });
    } catch {
      return c.json({
        success: true,
        found: false,
        malId,
        episode,
        intervals: []
      });
    }
  });

  return route;
}

export const aniSkipRoute = createAniSkipRoute();
