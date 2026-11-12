import { Hono } from 'hono';
import { getTmdbApiKey } from '../utils/helpers';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MAX_CACHE_ENTRIES = 400;
const FRESH_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh
const STALE_TTL_MS = 60 * 60 * 1000; // 1 hour stale-while-error fallback

interface TmdbCacheEntry {
  status: number;
  body: string;
  contentType: string;
  freshUntil: number;
  staleUntil: number;
}

const tmdbCache = new Map<string, TmdbCacheEntry>();
const inFlightRequests = new Map<string, Promise<TmdbCacheEntry>>();

const ALLOWED_TMDB_PATH_PATTERNS = [
  /^\/discover\/(movie|tv)$/,
  /^\/search\/(movie|tv|multi|collection|keyword|person)$/,
  /^\/trending\/(all|movie|tv)\/(day|week)$/,
  /^\/tv\/on_the_air$/,
  /^\/collection\/\d+$/,
  /^\/(movie|tv)\/\d+$/,
  /^\/(movie|tv)\/\d+\/external_ids$/,
  /^\/tv\/\d+\/season\/\d+$/,
  /^\/tv\/\d+\/season\/\d+\/episode\/\d+$/,
  /^\/person\/popular$/,
  /^\/person\/\d+$/
];

const ALLOWED_QUERY_KEYS = new Set([
  'page',
  'query',
  'sort_by',
  'with_genres',
  'with_keywords',
  'with_networks',
  'with_watch_providers',
  'with_companies',
  'with_origin_country',
  'watch_region',
  'vote_average.gte',
  'vote_count.gte',
  'primary_release_year',
  'first_air_date_year',
  'air_date.gte',
  'air_date.lte',
  'include_adult',
  'append_to_response',
  'language'
]);

export function isAllowedTmdbPath(tmdbPath: string): boolean {
  return ALLOWED_TMDB_PATH_PATTERNS.some(re => re.test(tmdbPath));
}

function setBoundedCache(key: string, entry: TmdbCacheEntry) {
  if (tmdbCache.has(key)) {
    tmdbCache.delete(key);
  }
  tmdbCache.set(key, entry);
  while (tmdbCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = tmdbCache.keys().next().value;
    if (oldestKey !== undefined) {
      tmdbCache.delete(oldestKey);
    } else {
      break;
    }
  }
}

export function clearTmdbProxyCache() {
  tmdbCache.clear();
  inFlightRequests.clear();
}

export function createTmdbProxyRoute(
  options: { fetchImpl?: typeof fetch; getApiKey?: () => string } = {}
): Hono {
  const route = new Hono();
  const fetchImpl = options.fetchImpl || fetch;
  const resolveApiKey = options.getApiKey || getTmdbApiKey;

  route.options('*', c => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    return c.body(null, 204);
  });

  route.all('*', async c => {
    const method = c.req.method;
    if (method !== 'GET' && method !== 'HEAD') {
      return c.json({ error: 'Method not allowed' }, 405);
    }

    const parsedReqUrl = new URL(c.req.url);
    let tmdbPath = parsedReqUrl.pathname;
    if (tmdbPath.startsWith('/api/tmdb')) {
      tmdbPath = tmdbPath.slice('/api/tmdb'.length);
    }
    if (!tmdbPath.startsWith('/')) {
      tmdbPath = '/' + tmdbPath;
    }
    if (tmdbPath.length > 1 && tmdbPath.endsWith('/')) {
      tmdbPath = tmdbPath.slice(0, -1);
    }

    if (!isAllowedTmdbPath(tmdbPath)) {
      return c.json({ error: 'Unsupported TMDB endpoint' }, 400);
    }

    const apiKey = resolveApiKey();
    if (!apiKey) {
      c.header('Cache-Control', 'no-store');
      return c.json(
        { error: 'TMDB metadata service is not configured on the server' },
        503
      );
    }

    const forwardParams = new URLSearchParams();
    for (const [k, v] of parsedReqUrl.searchParams.entries()) {
      if (k === 'api_key') continue; // Never allow client override of server credentials
      if (ALLOWED_QUERY_KEYS.has(k) && v.length <= 300) {
        forwardParams.append(k, v);
      }
    }

    const cacheKey = `${tmdbPath}?${forwardParams.toString()}`;
    const now = Date.now();
    const cached = tmdbCache.get(cacheKey);

    if (cached && cached.freshUntil > now) {
      c.header('Content-Type', cached.contentType);
      c.header('Cache-Control', 'public, max-age=300');
      if (method === 'HEAD') {
        return c.body(null, cached.status as any);
      }
      return c.body(cached.body, cached.status as any);
    }

    let pending = inFlightRequests.get(cacheKey);
    if (!pending) {
      const upstreamParams = new URLSearchParams(forwardParams);
      upstreamParams.set('api_key', apiKey);
      const upstreamUrl = `${TMDB_BASE_URL}${tmdbPath}?${upstreamParams.toString()}`;

      pending = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const upstreamRes = await fetchImpl(upstreamUrl, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
          });

          if (upstreamRes.status === 429 || upstreamRes.status >= 500) {
            const err: any = new Error(`TMDB upstream returned HTTP ${upstreamRes.status}`);
            err.status = 503;
            throw err;
          }

          const body = await upstreamRes.text();
          const entry: TmdbCacheEntry = {
            status: upstreamRes.status,
            body,
            contentType: 'application/json; charset=utf-8',
            freshUntil: Date.now() + (upstreamRes.status === 200 ? FRESH_TTL_MS : 60 * 1000),
            staleUntil: Date.now() + (upstreamRes.status === 200 ? STALE_TTL_MS : 60 * 1000)
          };

          if (upstreamRes.status === 200) {
            setBoundedCache(cacheKey, entry);
          }
          return entry;
        } finally {
          clearTimeout(timeout);
        }
      })().finally(() => {
        inFlightRequests.delete(cacheKey);
      });

      inFlightRequests.set(cacheKey, pending);
    }

    try {
      const entry = await pending;
      c.header('Content-Type', entry.contentType);
      c.header(
        'Cache-Control',
        entry.status === 200 ? 'public, max-age=300' : 'no-store'
      );
      if (method === 'HEAD') {
        return c.body(null, entry.status as any);
      }
      return c.body(entry.body, entry.status as any);
    } catch {
      // Stale-valid fallback if transient upstream error/timeout occurred
      if (cached && cached.staleUntil > Date.now() && cached.status === 200) {
        c.header('Content-Type', cached.contentType);
        c.header('Cache-Control', 'public, max-age=60');
        c.header('X-TStream-Cache', 'stale');
        if (method === 'HEAD') {
          return c.body(null, 200);
        }
        return c.body(cached.body, 200);
      }

      c.header('Cache-Control', 'no-store');
      return c.json(
        { error: 'TMDB metadata service temporarily unavailable' },
        503
      );
    }
  });

  return route;
}

export const tmdbRoute = createTmdbProxyRoute();
