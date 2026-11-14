/**
 * Server Security, TMDB Proxy, Streaming & Subtitle Regression Tests (Phase 3)
 * Covers:
 * - Part 7: Zero VITE_TMDB_API_KEY in frontend/CI/server lookup; TMDB server proxy allowlist, key stripping, 503 when unconfigured, caching, coalescing, stale fallback
 * - Part 10: Streaming endpoints validation (invalid TMDB ID, unsupported methods), SSRF protections, HLS manifest & subtitle proxy behavior
 * - Part 12: Cache eviction & timeout handling
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { webcrypto } from 'node:crypto';
import serverApp from '../../server/app';
import {
  createTmdbProxyRoute,
  clearTmdbProxyCache,
  clearTmdbRateLimits,
  isAllowedTmdbPath
} from '../../server/api/tmdb';
import { createStreamRoute } from '../../server/api/stream';
import {
  providers as providerRegistry,
  getActiveProviders,
  recordProviderLatency,
  clearProviderLatencies,
  getProviderLatencyMs
} from '../../server/providers';
import { decryptVidRockStreamUrl } from '../../server/providers/vidrock';
import { validateSourceUrl } from '../../server/utils/validator';
import { handleLegacyStreamRequest } from '../../server/legacyStreamHandler';
import { safeFetchStream, ProxySecurityError } from '../../server/utils/safeProxyFetch';
import { getServerTmdbApiKey } from '../../../scripts/seoHtmlPlugin';
import { getTmdbApiKey } from '../tmdb';
import { DEFAULT_SERVERS, pickEffectiveDefaultServer } from '../embedServers';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function runLegacyHandlerTest(
  method: string,
  url: string
): Promise<{ status: number; body: string; headers: Record<string, any> }> {
  return await new Promise((resolve, reject) => {
    const req: any = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = {};

    const headers: Record<string, any> = {};
    const chunks: Buffer[] = [];
    const res: any = new EventEmitter();
    res.statusCode = 200;
    res.headersSent = false;
    res.writableEnded = false;
    res.setHeader = (k: string, v: any) => {
      headers[k.toLowerCase()] = v;
    };
    res.end = (chunk?: any) => {
      res.writableEnded = true;
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
        headers
      });
    };
    res.destroy = () => {
      res.writableEnded = true;
    };

    handleLegacyStreamRequest(req as http.IncomingMessage, res as http.ServerResponse).catch(reject);
  });
}

async function runTests() {
  console.log('--- Running TStream Server, Security & Streaming Regression Tests ---\n');
  clearTmdbProxyCache();

  // 1. Credential protection checks
  assert(getTmdbApiKey() === '', 'Frontend getTmdbApiKey returns empty string (zero key exposure in browser)');

  const prevViteKey = process.env.VITE_TMDB_API_KEY;
  const prevServerKey = process.env.TMDB_API_KEY;
  process.env.VITE_TMDB_API_KEY = 'should_never_be_used_on_server';
  delete process.env.TMDB_API_KEY;
  assert(getServerTmdbApiKey() === '', 'getServerTmdbApiKey strictly ignores VITE_TMDB_API_KEY');
  if (prevViteKey !== undefined) process.env.VITE_TMDB_API_KEY = prevViteKey;
  else delete process.env.VITE_TMDB_API_KEY;
  if (prevServerKey !== undefined) process.env.TMDB_API_KEY = prevServerKey;

  // Verify no VITE_TMDB_API_KEY left in src/ or .env.example or CI env injection
  const srcFilesToCheck = [
    'src/services/tmdb.ts',
    'src/services/collectionStore.ts',
    'src/services/newEpisodes.ts',
    'src/services/subtitles.ts',
    'src/pages/CollectionsPage.tsx',
    '.env.example'
  ];
  for (const rel of srcFilesToCheck) {
    const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    assert(!content.includes('VITE_TMDB_API_KEY'), `${rel} has zero VITE_TMDB_API_KEY references`);
  }
  const workflowContent = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/deploy-tstream.yml'), 'utf8');
  assert(!/VITE_TMDB_API_KEY\s*:/.test(workflowContent), '.github/workflows/deploy-tstream.yml never injects VITE_TMDB_API_KEY into build env');

  // 2. TMDB Proxy allowlist & unconfigured 503
  assert(isAllowedTmdbPath('/discover/movie'), 'TMDB proxy allows /discover/movie');
  assert(isAllowedTmdbPath('/tv/1396/season/1/episode/1'), 'TMDB proxy allows episode endpoint');
  assert(!isAllowedTmdbPath('/account/123'), 'TMDB proxy blocks private /account endpoint');
  assert(!isAllowedTmdbPath('/movie/550/../../evil'), 'TMDB proxy blocks traversal paths');

  const unconfiguredTmdb = createTmdbProxyRoute({ getApiKey: () => '' });
  const resUnconf = await unconfiguredTmdb.request('/discover/movie');
  assert(
    resUnconf.status === 503 && resUnconf.headers.get('cache-control') === 'no-store',
    '/api/tmdb returns 503 with Cache-Control: no-store when TMDB_API_KEY is unset'
  );

  // 3. TMDB Proxy caching, api_key override stripping & coalescing
  let fetchCalls = 0;
  const mockTmdbApp = createTmdbProxyRoute({
    getApiKey: () => 'server-secret-value',
    fetchImpl: (async (url: string | URL | Request) => {
      fetchCalls++;
      const urlStr = String(url);
      assert(urlStr.includes('api_key=server-secret-value') && !urlStr.includes('attacker-key'), 'TMDB proxy injects server key and strips client api_key override');
      return new Response(JSON.stringify({ results: [{ id: 100, title: 'Proxy Test' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch
  });

  const [r1, r2] = await Promise.all([
    mockTmdbApp.request('/discover/movie?page=1&api_key=attacker-key'),
    mockTmdbApp.request('/discover/movie?page=1&api_key=attacker-key')
  ]);
  assert(r1.status === 200 && r2.status === 200 && fetchCalls === 1, 'TMDB proxy coalesces concurrent duplicate requests and caches response');

  const postMethodRes = await mockTmdbApp.request('/discover/movie', { method: 'POST' });
  assert(postMethodRes.status === 405, 'TMDB proxy rejects POST method with 405');

  const headMethodRes = await mockTmdbApp.request('/discover/movie?page=1', { method: 'HEAD' });
  assert(headMethodRes.status === 200 && (await headMethodRes.text()) === '', 'TMDB proxy supports HEAD with empty body');

  // 4. Streaming & Hono API regression checks
  const badStreamType = await serverApp.request('/api/stream/anime/123');
  assert(badStreamType.status === 400, '/api/stream rejects invalid media type with 400');

  const badStreamId = await serverApp.request('/api/stream/movie/abc');
  assert(badStreamId.status === 400, '/api/stream rejects non-numeric TMDB ID with 400');

  const badSeason = await serverApp.request('/api/stream/tv/1396?season=0');
  assert(badSeason.status === 400, '/api/stream rejects season=0 with 400');

  const proxyMissingUrl = await serverApp.request('/api/proxy');
  assert(proxyMissingUrl.status === 400, '/api/proxy rejects missing url parameter with 400');

  const proxyBadMethod = await serverApp.request('/api/proxy?url=https://example.com', { method: 'POST' });
  assert(proxyBadMethod.status === 405, '/api/proxy rejects POST method with 405');

  const proxySsrfLoopback = await serverApp.request('/api/proxy?url=http://127.0.0.1/admin');
  assert(proxySsrfLoopback.status === 403, '/api/proxy blocks SSRF loopback destination with 403');

  const proxySsrfMeta = await serverApp.request('/api/proxy?url=http://169.254.169.254/latest/meta-data/');
  assert(proxySsrfMeta.status === 403, '/api/proxy blocks cloud metadata 169.254.169.254 with 403');

  const subMissingUrl = await serverApp.request('/api/subtitle-proxy');
  assert(subMissingUrl.status === 400, '/api/subtitle-proxy rejects missing url with 400');

  const subSsrfBlocked = await serverApp.request('/api/subtitle-proxy?url=http://192.168.1.1/sub.vtt');
  assert(subSsrfBlocked.status === 403, '/api/subtitle-proxy blocks private LAN SSRF destination with 403');

  // 5. Legacy stream handler checks (/api/stream-resolve & /api/stream-proxy)
  const legacyMissingId = await runLegacyHandlerTest('GET', '/api/stream-resolve');
  assert(legacyMissingId.status === 400, 'Legacy /api/stream-resolve rejects missing tmdbId with 400');

  const legacyPostResolve = await runLegacyHandlerTest('POST', '/api/stream-resolve?tmdbId=550');
  assert(legacyPostResolve.status === 405, 'Legacy /api/stream-resolve rejects POST with 405');

  const legacyProxyMissing = await runLegacyHandlerTest('GET', '/api/stream-proxy');
  assert(legacyProxyMissing.status === 400, 'Legacy /api/stream-proxy rejects missing url with 400');

  const legacyProxySsrf = await runLegacyHandlerTest('GET', '/api/stream-proxy?url=http://localhost/secret.m3u8');
  assert(legacyProxySsrf.status === 403, 'Legacy /api/stream-proxy blocks localhost SSRF with 403');

  // 6. Direct safeFetchStream SSRF unit guard
  let ssrfThrew = false;
  try {
    await safeFetchStream('http://10.0.0.1/video.mp4', {});
  } catch (err) {
    ssrfThrew = err instanceof ProxySecurityError;
  }
  assert(ssrfThrew, 'safeFetchStream throws ProxySecurityError on RFC1918 private network');

  // 7. Phase 4 Task 6: Top-Rated endpoint allowlist, TMDB Rate Limiting & Restricted CORS
  assert(
    isAllowedTmdbPath('/movie/top_rated') && isAllowedTmdbPath('/tv/top_rated'),
    'TMDB proxy allowlist permits /movie/top_rated and /tv/top_rated'
  );

  clearTmdbProxyCache();
  clearTmdbRateLimits();
  let limitedUpstreamHits = 0;
  const rateLimitedRoute = createTmdbProxyRoute({
    getApiKey: () => 'rate-test-secret',
    rateLimitMax: 2,
    rateLimitWindowMs: 60_000,
    allowedOrigins: ['https://tstream.online'],
    trustProxy: false,
    fetchImpl: (async () => {
      limitedUpstreamHits++;
      return new Response(JSON.stringify({ results: [{ id: 1, title: 'Rate OK' }] }), { status: 200 });
    }) as typeof fetch
  });

  // 7A. Requests within limit succeed with X-RateLimit-* headers
  const rl1 = await rateLimitedRoute.request('/discover/movie?page=1', {
    headers: { 'x-tstream-verified-ip': '198.51.100.10', Origin: 'https://tstream.online' }
  });
  const rl2 = await rateLimitedRoute.request('/discover/movie?page=1', {
    headers: { 'x-tstream-verified-ip': '198.51.100.10', Origin: 'https://tstream.online' }
  });
  // 7B. Requests exceeding limit receive HTTP 429 + Retry-After + zero leak
  const rl3 = await rateLimitedRoute.request('/discover/movie?page=1', {
    headers: { 'x-tstream-verified-ip': '198.51.100.10', Origin: 'https://tstream.online' }
  });
  assert(
    rl1.status === 200 &&
      rl1.headers.get('access-control-allow-origin') === 'https://tstream.online' &&
      rl1.headers.get('x-ratelimit-limit') === '2' &&
      rl2.status === 200 &&
      limitedUpstreamHits === 1 && // cached response served on 2nd hit
      rl3.status === 429 &&
      Boolean(rl3.headers.get('retry-after')) &&
      rl3.headers.get('x-ratelimit-remaining') === '0',
    'Task 6: Rate limiter enforces per-client window (429 + Retry-After + rate-limit headers) even on cached responses'
  );

  // 7C. Spoofing X-Forwarded-For does NOT bypass rate limiter when trustProxy=false
  const spoofedBypass = await rateLimitedRoute.request('/discover/movie?page=1', {
    headers: {
      'x-tstream-verified-ip': '198.51.100.10',
      'x-forwarded-for': '203.0.113.250'
    }
  });
  assert(
    spoofedBypass.status === 429,
    'Task 6: Spoofed X-Forwarded-For cannot bypass rate limiter when TRUST_PROXY is false'
  );

  // 7D. Different client IP remains independent
  const otherIpRes = await rateLimitedRoute.request('/discover/movie?page=2', {
    headers: { 'x-tstream-verified-ip': '198.51.100.99' }
  });
  assert(otherIpRes.status === 200, 'Task 6: Different verified client IP has separate rate-limit quota');

  // 7E. Restricted CORS policy blocks untrusted origin (403) and drops wildcard *
  const badOriginGet = await rateLimitedRoute.request('/discover/movie?page=1', {
    headers: { 'x-tstream-verified-ip': '198.51.100.99', Origin: 'https://evil-attacker.example.com' }
  });
  const badOriginOptions = await rateLimitedRoute.request('/discover/movie?page=1', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil-attacker.example.com' }
  });
  assert(
    badOriginGet.status === 403 &&
      badOriginOptions.status === 403 &&
      badOriginGet.headers.get('access-control-allow-origin') !== '*',
    'Task 6: CORS rejects untrusted Origin with HTTP 403 and never emits wildcard Access-Control-Allow-Origin: *'
  );

  // 8. Streaming Providers Registry, Core-Default + Progressive Loading & Fastest-First Fallbacks
  clearProviderLatencies();
  const activeProviders = getActiveProviders();
  const expectedOrder = ['vidrock', 'boxmovie', 'meowtv', 'vidapi', 'eclipse', 'vidrift', 'vidlink', 'lmscript'];
  assert(
    expectedOrder.every(k => Boolean(providerRegistry[k])) &&
      activeProviders.length === 8 &&
      activeProviders.map(p => p.key).join(',') === expectedOrder.join(','),
    'All 8 providers (Core default first, then BoxMovie, Apex, Vector, Eclipse, Orion, Pulse, Valence) are registered in expected order'
  );

  // 8A. Core ('vidrock') stays primary default when healthy; fallback servers rank fastest-first by RTT
  const slowCoreProvider = {
    key: 'vidrock',
    label: 'Core',
    priority: 1,
    enabled: true,
    async getStream() {
      await new Promise(r => setTimeout(r, 85));
      return { success: true, source: 'vidrock', url: '/api/proxy?url=https%3A%2F%2Fcore.example%2Fv.m3u8', type: 'hls' as const };
    }
  };
  const mediumFallbackProvider = {
    key: 'slow_server',
    label: 'SlowFallback',
    priority: 3,
    enabled: true,
    async getStream() {
      await new Promise(r => setTimeout(r, 45));
      return { success: true, source: 'slow_server', url: '/api/proxy?url=https%3A%2F%2Fslow.example%2Fv.m3u8', type: 'hls' as const };
    }
  };
  const fastFallbackProvider = {
    key: 'fast_server',
    label: 'FastFallback',
    priority: 5,
    enabled: true,
    async getStream() {
      await new Promise(r => setTimeout(r, 10));
      return { success: true, source: 'fast_server', url: '/api/proxy?url=https%3A%2F%2Ffast.example%2Fv.m3u8', type: 'hls' as const };
    }
  };

  const latencyTracker = new Map<string, number>();
  const benchmarkStreamRoute = createStreamRoute({
    getProviders: () => [slowCoreProvider, mediumFallbackProvider, fastFallbackProvider],
    recordLatency: (key, ms) => latencyTracker.set(key, ms),
    getLatency: (key) => latencyTracker.get(key) ?? null
  });

  const fastestRes = await benchmarkStreamRoute.request('/movie/550');
  const fastestJson = await fastestRes.json() as any;
  assert(
    fastestRes.status === 200 &&
      fastestJson.source === 'vidrock' &&
      fastestJson.primaryServer === 'Core' &&
      fastestJson.servers.length === 3 &&
      fastestJson.servers[0].key === 'vidrock' &&
      fastestJson.servers[1].key === 'fast_server' &&
      fastestJson.servers[2].key === 'slow_server' &&
      fastestJson.servers[1].responseTimeMs <= fastestJson.servers[2].responseTimeMs,
    'Stream orchestrator puts Core (vidrock) first by default and ranks fallback servers fastest-first'
  );

  // 8B. Explicit ?provider= selection moves selected provider first while retaining Core & fallbacks
  const overrideRes = await benchmarkStreamRoute.request('/movie/550?provider=slow_server');
  const overrideJson = await overrideRes.json() as any;
  assert(
    overrideRes.status === 200 &&
      overrideJson.source === 'slow_server' &&
      overrideJson.servers[1].key === 'fast_server',
    'Explicit ?provider= preference promotes chosen provider first with fastest fallback second'
  );

  // 8C. Rolling latency tracking promotes fastest healthy provider in getActiveProviders()
  recordProviderLatency('vidrock', 45, true);
  recordProviderLatency('vidapi', 320, true);
  recordProviderLatency('eclipse', 110, true);
  const dynamicOrder = getActiveProviders();
  assert(
    dynamicOrder[0].key === 'vidrock' &&
      dynamicOrder[1].key === 'eclipse' &&
      dynamicOrder[2].key === 'vidapi' &&
      getProviderLatencyMs('vidrock') === 45,
    'Rolling provider latency promotes genuinely fastest provider to rank #1 in getActiveProviders()'
  );
  clearProviderLatencies();

  // 8D. GET /api/stream/providers exposes full provider directory with Core default first
  const providersListRes = await serverApp.request('/api/stream/providers');
  const providersListJson = await providersListRes.json() as any;
  assert(
    providersListRes.status === 200 &&
      providersListJson.fastest?.key === 'vidrock' &&
      Array.isArray(providersListJson.providers) &&
      providersListJson.providers.length === 8,
    'GET /api/stream/providers returns all 8 active providers with Core (vidrock) first by default'
  );

  // 8F. Progressive 2-phase loading (?provider=vidrock&single=1 then ?exclude=vidrock)
  const calledKeys: string[] = [];
  const progressiveRoute = createStreamRoute({
    getProviders: () => [
      {
        key: 'vidrock',
        label: 'Core',
        priority: 1,
        enabled: true,
        async getStream() {
          calledKeys.push('vidrock');
          return { success: true, source: 'vidrock', url: '/api/proxy?url=https%3A%2F%2Fcore.example%2Fmaster.m3u8', type: 'hls' as const };
        }
      },
      {
        key: 'boxmovie',
        label: 'BoxMovie',
        priority: 2,
        enabled: true,
        async getStream() {
          calledKeys.push('boxmovie');
          await new Promise(r => setTimeout(r, 35));
          return { success: true, source: 'boxmovie', url: '/api/proxy?url=https%3A%2F%2Fbox.example%2Fv.mp4', type: 'mp4' as const };
        }
      },
      {
        key: 'meowtv',
        label: 'Apex',
        priority: 3,
        enabled: true,
        async getStream() {
          calledKeys.push('meowtv');
          await new Promise(r => setTimeout(r, 10));
          return { success: true, source: 'meowtv', url: '/api/proxy?url=https%3A%2F%2Fapex.example%2Fv.m3u8', type: 'hls' as const };
        }
      }
    ]
  });

  const phase1Res = await progressiveRoute.request('/movie/550?provider=vidrock&single=1');
  const phase1Json = await phase1Res.json() as any;
  assert(
    phase1Res.status === 200 &&
      phase1Json.source === 'vidrock' &&
      phase1Json.servers.length === 1 &&
      calledKeys.length === 1 &&
      calledKeys[0] === 'vidrock',
    'Phase 1 (?provider=vidrock&single=1) queries ONLY Core (vidrock) without waiting for other servers'
  );

  calledKeys.length = 0;
  const phase2Res = await progressiveRoute.request('/movie/550?exclude=vidrock');
  const phase2Json = await phase2Res.json() as any;
  assert(
    phase2Res.status === 200 &&
      !calledKeys.includes('vidrock') &&
      calledKeys.includes('boxmovie') &&
      calledKeys.includes('meowtv') &&
      phase2Json.servers.length === 2 &&
      phase2Json.servers[0].key === 'meowtv' &&
      phase2Json.servers[1].key === 'boxmovie',
    'Phase 2 (?exclude=vidrock) skips Core and loads remaining servers sorted fastest-first'
  );

  // 8E. VidRock AES-GCM decrypt roundtrip + validator SSRF/HTML rejection
  const gcmKeyHex = '7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f';
  const rawKey = new Uint8Array(gcmKeyHex.length / 2);
  for (let i = 0; i < rawKey.length; i++) rawKey[i] = parseInt(gcmKeyHex.slice(i * 2, i * 2 + 2), 16);
  const cryptoKey = await webcrypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const iv = new Uint8Array(12).fill(7);
  const encryptedBuf = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode('https://cdn.example.com/master.m3u8')
  );
  const combined = new Uint8Array(iv.length + encryptedBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuf), iv.length);
  const b64url = Buffer.from(combined).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decrypted = await decryptVidRockStreamUrl(b64url);
  assert(
    decrypted === 'https://cdn.example.com/master.m3u8',
    'VidRock AES-GCM decryptor accurately decodes encrypted stream URLs'
  );

  const mockHtmlReject = (async () => new Response('<html>CF</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })) as typeof fetch;
  const mockHlsOk = (async () => new Response('#EXTM3U', { status: 206, headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } })) as typeof fetch;
  assert(
    !(await validateSourceUrl('http://127.0.0.1/internal.m3u8')) &&
      !(await validateSourceUrl('https://cdn.example.com/cf.m3u8', {}, mockHtmlReject)) &&
      (await validateSourceUrl('https://cdn.example.com/ok.m3u8', {}, mockHlsOk)),
    'validateSourceUrl rejects internal SSRF/HTML pages and accepts verified HLS/MP4 streams'
  );

  // 8G. Separate Movie vs TV Series default server resolution
  const adminPrefs = {
    movieServerId: 'server_4_fmov',
    tvServerId: 'server_1_direct',
    movieDirectProvider: 'boxmovie',
    tvDirectProvider: 'vidrock'
  };
  const resolvedMovieOn = pickEffectiveDefaultServer('movie', DEFAULT_SERVERS, true, adminPrefs);
  const resolvedTvOn = pickEffectiveDefaultServer('tv', DEFAULT_SERVERS, true, adminPrefs);
  const resolvedTvWhenDirectOff = pickEffectiveDefaultServer('tv', DEFAULT_SERVERS, false, adminPrefs);
  assert(
    resolvedMovieOn.id === 'server_4_fmov' &&
      resolvedTvOn.id === 'server_1_direct' &&
      resolvedTvWhenDirectOff.type === 'embed' &&
      resolvedTvWhenDirectOff.id === 'server_2_movietvapi',
    'pickEffectiveDefaultServer resolves separate Admin defaults for Movies vs TV Series and falls back to Embed when Direct Stream is OFF'
  );

  console.log('\n--- ALL SERVER, SECURITY & STREAMING REGRESSION TESTS PASSED ---');
}

runTests().catch(err => {
  console.error('Server test error:', err);
  process.exit(1);
});
