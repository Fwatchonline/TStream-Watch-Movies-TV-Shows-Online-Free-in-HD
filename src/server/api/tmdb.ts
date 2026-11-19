import { Hono } from 'hono';
import { getTmdbApiKey } from '../utils/helpers';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MAX_CACHE_ENTRIES = 400;
const FRESH_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh
const STALE_TTL_MS = 60 * 60 * 1000; // 1 hour stale-while-error fallback

const DEFAULT_RATE_LIMIT_MAX = 120;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_RATE_LIMIT_CLIENTS = 2000;

interface TmdbCacheEntry {
  status: number;
  body: string;
  contentType: string;
  freshUntil: number;
  staleUntil: number;
}

const tmdbCache = new Map<string, TmdbCacheEntry>();
const inFlightRequests = new Map<string, Promise<TmdbCacheEntry>>();
// Process-local bounded sliding-window rate limiter store (complements Nginx edge limits)
const rateLimitStore = new Map<string, number[]>();

const ALLOWED_TMDB_PATH_PATTERNS = [
  /^\/discover\/(movie|tv)$/,
  /^\/(movie|tv)\/top_rated$/,
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
  'language',
  'with_original_language'
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

export function clearTmdbRateLimits() {
  rateLimitStore.clear();
}

function parsePositiveInt(val: string | undefined, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function isValidIpLiteral(candidate: string): boolean {
  const clean = candidate.trim();
  if (!clean || clean.length > 64) return false;
  // IPv4 or IPv6 hex/colon/dot (including IPv4-mapped IPv6 like ::ffff:127.0.0.1)
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(clean)) {
    return clean.split('.').every(octet => Number(octet) <= 255);
  }
  return /^[0-9a-fA-F:.]+$/.test(clean) && clean.includes(':');
}

export function extractVerifiedClientIp(
  reqHeaders: Headers,
  socketRemoteAddress?: string,
  trustProxy: boolean = false
): string {
  // Server middleware (server.ts / vite.config.ts) overwrites x-tstream-verified-ip from socket.remoteAddress
  const verifiedSocket = (reqHeaders.get('x-tstream-verified-ip') || socketRemoteAddress || '').trim();

  if (trustProxy) {
    const xff = reqHeaders.get('x-forwarded-for');
    if (xff) {
      const hops = xff
        .split(',')
        .map(s => s.trim())
        .filter(isValidIpLiteral);
      // Rightmost client/proxy hop added by trusted Nginx proxy is safest against left-side spoofing
      if (hops.length > 0) {
        return hops[hops.length - 1];
      }
    }
    const realIp = (reqHeaders.get('x-real-ip') || '').trim();
    if (isValidIpLiteral(realIp)) {
      return realIp;
    }
  }

  if (verifiedSocket && isValidIpLiteral(verifiedSocket)) {
    return verifiedSocket;
  }
  return 'local-client';
}

function buildAllowedOriginsSet(explicitOrigins?: string[]): Set<string> {
  const origins = new Set<string>(['https://tstream.online']);

  const envAppUrl = (process.env.APP_URL || '').trim();
  if (envAppUrl) {
    try {
      origins.add(new URL(envAppUrl).origin);
    } catch {
      // ignore invalid URL
    }
  }

  const rawExtra = [
    ...(explicitOrigins || []),
    ...(process.env.TMDB_ALLOWED_ORIGINS || '').split(','),
    ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')
  ];

  for (const item of rawExtra) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    try {
      origins.add(new URL(trimmed).origin);
    } catch {
      // ignore invalid origin
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  return origins;
}

function isOriginAllowed(originHeader: string, hostHeader: string | null, allowedOrigins: Set<string>): boolean {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    return false;
  }

  if (allowedOrigins.has(parsedOrigin.origin)) {
    return true;
  }

  if (hostHeader) {
    const cleanHost = hostHeader.trim().toLowerCase();
    if (parsedOrigin.host.toLowerCase() === cleanHost) {
      return true;
    }
  }

  return false;
}

function checkRateLimit(
  clientKey: string,
  maxRequests: number,
  windowMs: number,
  maxClients: number,
  now = Date.now()
): { allowed: boolean; remaining: number; resetEpochSec: number; retryAfterSec: number } {
  const cutoff = now - windowMs;
  const existing = rateLimitStore.get(clientKey) || [];
  const active = existing.filter(ts => ts > cutoff);

  if (active.length >= maxRequests) {
    // Keep client recency accurate in bounded map
    rateLimitStore.delete(clientKey);
    rateLimitStore.set(clientKey, active);
    const oldest = active[0] || now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    const resetEpochSec = Math.ceil((oldest + windowMs) / 1000);
    return { allowed: false, remaining: 0, resetEpochSec, retryAfterSec };
  }

  active.push(now);
  if (rateLimitStore.has(clientKey)) {
    rateLimitStore.delete(clientKey);
  }
  rateLimitStore.set(clientKey, active);
  while (rateLimitStore.size > maxClients) {
    const oldestClient = rateLimitStore.keys().next().value;
    if (oldestClient !== undefined) {
      rateLimitStore.delete(oldestClient);
    } else {
      break;
    }
  }

  const oldestActive = active[0] || now;
  const resetEpochSec = Math.ceil((oldestActive + windowMs) / 1000);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - active.length),
    resetEpochSec,
    retryAfterSec: 0
  };
}

export interface TmdbProxyOptions {
  fetchImpl?: typeof fetch;
  getApiKey?: () => string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  maxRateLimitEntries?: number;
  allowedOrigins?: string[];
  trustProxy?: boolean;
}

/**
 * Creates the hardened server-side TMDB proxy route.
 * Rate limiting here is process-local and bounded in memory (sliding window LRU);
 * production clusters should keep single worker or layer Nginx edge limits above Node.
 */
export function createTmdbProxyRoute(options: TmdbProxyOptions = {}): Hono {
  const route = new Hono();
  const fetchImpl = options.fetchImpl || fetch;
  const resolveApiKey = options.getApiKey || getTmdbApiKey;
  const rateLimitMax = options.rateLimitMax ?? parsePositiveInt(process.env.TMDB_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
  const rateLimitWindowMs =
    options.rateLimitWindowMs ?? parsePositiveInt(process.env.TMDB_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
  const maxRateLimitEntries = options.maxRateLimitEntries ?? DEFAULT_MAX_RATE_LIMIT_CLIENTS;
  const allowedOrigins = buildAllowedOriginsSet(options.allowedOrigins);
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === 'true';

  route.options('*', c => {
    c.header('Vary', 'Origin');
    const originHeader = c.req.header('origin');
    const hostHeader = c.req.header('host') || null;
    if (originHeader) {
      if (!isOriginAllowed(originHeader, hostHeader, allowedOrigins)) {
        return c.json({ error: 'Origin not allowed' }, 403);
      }
      c.header('Access-Control-Allow-Origin', originHeader);
    }
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    c.header('Access-Control-Max-Age', '600');
    return c.body(null, 204);
  });

  route.all('*', async c => {
    c.header('Vary', 'Origin');
    const originHeader = c.req.header('origin');
    const hostHeader = c.req.header('host') || null;
    if (originHeader) {
      if (!isOriginAllowed(originHeader, hostHeader, allowedOrigins)) {
        c.header('Cache-Control', 'no-store');
        return c.json({ error: 'Origin not allowed' }, 403);
      }
      c.header('Access-Control-Allow-Origin', originHeader);
    }

    const method = c.req.method;
    if (method !== 'GET' && method !== 'HEAD') {
      return c.json({ error: 'Method not allowed' }, 405);
    }

    const socketRemoteIp = (c.env as any)?.incoming?.socket?.remoteAddress as string | undefined;
    const clientIp = extractVerifiedClientIp(c.req.raw.headers, socketRemoteIp, trustProxy);
    const rateStatus = checkRateLimit(clientIp, rateLimitMax, rateLimitWindowMs, maxRateLimitEntries);

    c.header('X-RateLimit-Limit', String(rateLimitMax));
    c.header('X-RateLimit-Remaining', String(rateStatus.remaining));
    c.header('X-RateLimit-Reset', String(rateStatus.resetEpochSec));

    if (!rateStatus.allowed) {
      c.header('Retry-After', String(rateStatus.retryAfterSec));
      c.header('Cache-Control', 'no-store');
      return c.json({ error: 'Too many requests to TMDB proxy' }, 429);
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
