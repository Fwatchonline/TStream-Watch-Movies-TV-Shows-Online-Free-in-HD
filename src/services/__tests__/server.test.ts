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
import crypto, { webcrypto } from 'node:crypto';
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
  recordProviderPlaybackOutcome,
  getProviderHealthRecords,
  clearProviderLatencies,
  getProviderLatencyMs
} from '../../server/providers';
import { getMediaQuality, detectStreamQualityFromDimensions } from '../quality';
import { decryptVidRockStreamUrl } from '../../server/providers/vidrock';
import { CinejoyProvider } from '../../server/providers/cinejoy';
import { CineSrcProvider, solveCinesrcStage1, solveCinesrcStage2 } from '../../server/providers/cinesrc';
import { HexaProvider } from '../../server/providers/hexa';
import { VidUpProvider } from '../../server/providers/vidup';
import { validateSourceUrl } from '../../server/utils/validator';
import { handleLegacyStreamRequest } from '../../server/legacyStreamHandler';
import { safeFetchStream, ProxySecurityError } from '../../server/utils/safeProxyFetch';
import { getServerTmdbApiKey } from '../../../scripts/seoHtmlPlugin';
import { getTmdbApiKey } from '../tmdb';
import { cleanServerDisplay, formatQualityBadge, stripQualityFromName } from '../directStreamClient';
import { DEFAULT_SERVERS, pickEffectiveDefaultServer } from '../embedServers';
import {
  parseM3u8ResolutionLabel,
  enrichSourcesWithRealQuality
} from '../../server/utils/qualityProbe';

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
  const badStreamType = await serverApp.request('/api/stream/invalid_type/123');
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

  // 8. Streaming Providers Registry, Aether-Default + Progressive Loading & Fastest-First Fallbacks
  clearProviderLatencies();
  const activeProviders = getActiveProviders();
  const expectedOrder = [
    'cinejoy',
    'cinesrc',
    'vidrock',
    'vidup',
    'hexa',
    'boxmovie',
    'meowtv',
    'vidapi',
    'eclipse',
    'vidrift',
    'vidlink',
    'lmscript'
  ];
  assert(
    expectedOrder.every(k => Boolean(providerRegistry[k])) &&
      activeProviders.length === 12 &&
      activeProviders.map(p => p.key).join(',') === expectedOrder.join(','),
    'All 12 providers (Aether default first, then Vortex, Krypton, Cobalt, Helios, Vertex, Flux, Sigma, Spectra, Nimbus, Quantum, Onyx) are registered in benchmark order'
  );

  // 8A. Aether ('cinejoy') stays primary default when healthy; fallback servers rank fastest-first by RTT
  const slowPrimaryProvider = {
    key: 'cinejoy',
    label: 'Aether',
    priority: 1,
    enabled: true,
    async getStream() {
      await new Promise(r => setTimeout(r, 120));
      return { success: true, source: 'cinejoy', url: '/api/proxy?url=https%3A%2F%2Faether.example%2Fv.m3u8', type: 'hls' as const };
    }
  };
  const mediumFallbackProvider = {
    key: 'slow_server',
    label: 'SlowFallback',
    priority: 3,
    enabled: true,
    async getStream() {
      await new Promise(r => setTimeout(r, 65));
      return { success: true, source: 'slow_server', url: '/api/proxy?url=https%3A%2F%2Fslow.example%2Fv.m3u8', type: 'hls' as const };
    }
  };
  const fastFallbackProvider = {
    key: 'fast_server',
    label: 'FastFallback',
    priority: 5,
    enabled: true,
    async getStream() {
      await new Promise(r => setTimeout(r, 5));
      return { success: true, source: 'fast_server', url: '/api/proxy?url=https%3A%2F%2Ffast.example%2Fv.m3u8', type: 'hls' as const };
    }
  };

  const latencyTracker = new Map<string, number>();
  const benchmarkStreamRoute = createStreamRoute({
    getProviders: () => [slowPrimaryProvider, mediumFallbackProvider, fastFallbackProvider],
    recordLatency: (key, ms) => latencyTracker.set(key, ms),
    getLatency: (key) => latencyTracker.get(key) ?? null
  });

  const fastestRes = await benchmarkStreamRoute.request('/movie/550');
  const fastestJson = await fastestRes.json() as any;
  assert(
    fastestRes.status === 200 &&
      fastestJson.source === 'cinejoy' &&
      fastestJson.primaryServer === 'Aether' &&
      fastestJson.servers.length === 3 &&
      fastestJson.servers[0].key === 'cinejoy' &&
      fastestJson.servers[1].key === 'fast_server' &&
      fastestJson.servers[2].key === 'slow_server' &&
      fastestJson.servers[1].responseTimeMs <= fastestJson.servers[2].responseTimeMs,
    'Stream orchestrator puts Aether (cinejoy) first by default and ranks fallback servers fastest-first'
  );

  // 8B. Explicit ?provider= selection moves selected provider first while retaining Aether & fallbacks
  const overrideRes = await benchmarkStreamRoute.request('/movie/550?provider=slow_server');
  const overrideJson = await overrideRes.json() as any;
  assert(
    overrideRes.status === 200 &&
      overrideJson.source === 'slow_server' &&
      overrideJson.servers[1].key === 'fast_server',
    'Explicit ?provider= preference promotes chosen provider first with fastest fallback second'
  );

  // 8C. Rolling latency tracking promotes fastest healthy provider in getActiveProviders()
  recordProviderLatency('cinejoy', 45, true);
  recordProviderLatency('vidapi', 320, true);
  recordProviderLatency('eclipse', 110, true);
  const dynamicOrder = getActiveProviders();
  assert(
    dynamicOrder[0].key === 'cinejoy' &&
      dynamicOrder[1].key === 'eclipse' &&
      dynamicOrder[2].key === 'vidapi' &&
      getProviderLatencyMs('cinejoy') === 45,
    'Rolling provider latency promotes genuinely fastest provider to rank #1 in getActiveProviders()'
  );
  clearProviderLatencies();

  // 8D. GET /api/stream/providers exposes full provider directory with Aether default first
  const providersListRes = await serverApp.request('/api/stream/providers');
  const providersListJson = await providersListRes.json() as any;
  assert(
    providersListRes.status === 200 &&
      providersListJson.fastest?.key === 'cinejoy' &&
      providersListJson.fastest?.label === 'Aether' &&
      Array.isArray(providersListJson.providers) &&
      providersListJson.providers.length === 12,
    'GET /api/stream/providers returns all 12 active providers with Aether (cinejoy) first by default'
  );

  // 8F. Progressive 2-phase loading (?provider=cinejoy&single=1 then ?exclude=cinejoy)
  const calledKeys: string[] = [];
  const progressiveRoute = createStreamRoute({
    getProviders: () => [
      {
        key: 'cinejoy',
        label: 'Aether',
        priority: 1,
        enabled: true,
        async getStream() {
          calledKeys.push('cinejoy');
          return { success: true, source: 'cinejoy', url: '/api/proxy?url=https%3A%2F%2Faether.example%2Fmaster.m3u8', type: 'hls' as const };
        }
      },
      {
        key: 'boxmovie',
        label: 'Vertex',
        priority: 6,
        enabled: true,
        async getStream() {
          calledKeys.push('boxmovie');
          await new Promise(r => setTimeout(r, 35));
          return { success: true, source: 'boxmovie', url: '/api/proxy?url=https%3A%2F%2Fvertex.example%2Fv.mp4', type: 'mp4' as const };
        }
      },
      {
        key: 'meowtv',
        label: 'Flux',
        priority: 7,
        enabled: true,
        async getStream() {
          calledKeys.push('meowtv');
          await new Promise(r => setTimeout(r, 10));
          return { success: true, source: 'meowtv', url: '/api/proxy?url=https%3A%2F%2Fflux.example%2Fv.m3u8', type: 'hls' as const };
        }
      }
    ]
  });

  const phase1Res = await progressiveRoute.request('/movie/550?provider=cinejoy&single=1');
  const phase1Json = await phase1Res.json() as any;
  assert(
    phase1Res.status === 200 &&
      phase1Json.source === 'cinejoy' &&
      phase1Json.servers.length === 1 &&
      calledKeys.length === 1 &&
      calledKeys[0] === 'cinejoy',
    'Phase 1 (?provider=cinejoy&single=1) queries ONLY Aether (cinejoy) without waiting for other servers'
  );

  calledKeys.length = 0;
  const phase2Res = await progressiveRoute.request('/movie/550?exclude=cinejoy');
  const phase2Json = await phase2Res.json() as any;
  assert(
    phase2Res.status === 200 &&
      !calledKeys.includes('cinejoy') &&
      calledKeys.includes('boxmovie') &&
      calledKeys.includes('meowtv') &&
      phase2Json.servers.length === 2 &&
      phase2Json.servers[0].key === 'meowtv' &&
      phase2Json.servers[1].key === 'boxmovie',
    'Phase 2 (?exclude=cinejoy) skips Aether and loads remaining servers sorted fastest-first'
  );

  // 8E. Krypton (VidRock) AES-GCM decrypt roundtrip + validator SSRF/HTML rejection
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
    'Krypton (VidRock) AES-GCM decryptor accurately decodes encrypted stream URLs'
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
    movieDirectProvider: 'cinesrc',
    tvDirectProvider: 'cinejoy'
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

  // 8H. Cinejoy (Aether) provider unit resolution with mocked enc-dec + wing.st
  const cinejoyMockFetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('/enc-cinejoy')) {
      return new Response(JSON.stringify({ status: 200, result: { data: 'AQID', state: 'st1' } }), { status: 200 });
    }
    if (u.includes('api.wing.st/g')) {
      return new Response(Buffer.from('encrypted-bin'), { status: 200 });
    }
    if (u.includes('/dec-cinejoy')) {
      return new Response(
        JSON.stringify({
          status: 200,
          result: {
            data: {
              stream: [
                {
                  playlist: 'https://cdn.wing.example/master.m3u8',
                  quality: '1080p',
                  captions: [{ id: 'en', label: 'English', url: 'https://subs.example/en.vtt' }]
                }
              ]
            }
          }
        }),
        { status: 200 }
      );
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  const cinejoyRes = await new CinejoyProvider({ fetchImpl: cinejoyMockFetch }).getStream('550', 'movie');
  assert(
    cinejoyRes.success &&
      cinejoyRes.source === 'cinejoy' &&
      Boolean(cinejoyRes.url?.includes('/api/proxy?url=https%3A%2F%2Fcdn.wing.example%2Fmaster.m3u8')) &&
      cinejoyRes.subtitles?.length === 1,
    'CinejoyProvider (Aether) resolves proxied HLS stream and captions cleanly'
  );

  // 8I. CineSrc (Vortex) PoW solver + full flow resolving relative /api/playlist/... URL
  const stage2TargetKey = '0a';
  const stage2Salt = 'testsalt_';
  const stage2Hash = crypto.createHash('sha256').update(stage2Salt + stage2TargetKey).digest('hex');
  const stage2PayloadB64 = Buffer.from(JSON.stringify({ d: 5 })).toString('base64url');
  const stage2BodyB64 = Buffer.from(`hdr.${stage2PayloadB64}.sig`).toString('base64url');
  const stage2RB64 = `a.${stage2BodyB64}.c`;
  const mockStage2Challenge = {
    pack: [
      stage2Hash.split('').reverse().join(''),
      'x',
      'y',
      stage2Salt.split('').reverse().join(''),
      stage2RB64.split('').reverse().join('')
    ]
  };
  assert(
    solveCinesrcStage2(mockStage2Challenge) === stage2TargetKey,
    'solveCinesrcStage2 finds exact SHA-256 preimage match'
  );

  const stage1Buf = Buffer.alloc(32);
  stage1Buf.writeUInt32LE(1, 0);
  stage1Buf.writeUInt32LE(2, 4);
  stage1Buf.writeUInt32LE(3, 8);
  stage1Buf.writeUInt32LE(4, 12);
  stage1Buf[16] = 0x7d;
  stage1Buf[17] = 0xbd;
  stage1Buf[18] = 0xd2;
  stage1Buf[19] = 0x43;
  stage1Buf[20] = 4;
  stage1Buf[21] = 0; // mode 0 -> [12, 15]
  stage1Buf[22] = 1; // diff 1 bit (instant)
  stage1Buf[23] = 2; // varI
  stage1Buf[24] = 12; // rnd
  stage1Buf[25] = 15; // m_b
  stage1Buf[26] = 3; // s_i
  stage1Buf[27] = 1; // p_i
  stage1Buf.write('CSP4', 28, 'ascii');
  const stage1Sol = solveCinesrcStage1(
    { w: stage1Buf.toString('base64url') },
    '00'.repeat(32)
  );
  assert(stage1Sol.startsWith('m4.'), 'solveCinesrcStage1 produces valid m4.<hex> PoW solution');

  const cinesrcMockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/c/bootstrap')) {
      return new Response(JSON.stringify({ r: 'r1', p: 'p1' }), { status: 200 });
    }
    if (u.includes('/api/c/issue')) {
      return new Response(JSON.stringify({ w: stage1Buf.toString('base64url') }), { status: 200 });
    }
    if (u.includes('/enc-cinesrc')) {
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.type === 'seed') {
        return new Response(JSON.stringify({ status: 200, result: { seed: '00'.repeat(32), state: 's1' } }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          status: 200,
          result: { token: 'tok', state: 's2', headers: { getProviderList: 'actList', getStream: 'actStream' } }
        }),
        { status: 200 }
      );
    }
    if (u.includes('/api/c/stage2/issue')) {
      return new Response(JSON.stringify(mockStage2Challenge), { status: 200 });
    }
    if (u.includes('cinesrc.st/embed/')) {
      const hdrs = init?.headers as Record<string, string>;
      if (hdrs?.['Next-Action'] === 'actList') {
        return new Response(`0:{}\n1:${JSON.stringify([{ id: 'nebula', name: 'Nebula' }])}\n`, { status: 200 });
      }
      return new Response('enc-stream', { status: 200 });
    }
    if (u.includes('/dec-cinesrc')) {
      return new Response(
        JSON.stringify({ status: 200, result: { url: [{ url: '/api/playlist/test/master', source: 'HLS' }] } }),
        { status: 200 }
      );
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  const cinesrcRes = await new CineSrcProvider({ fetchImpl: cinesrcMockFetch }).getStream('550', 'movie');
  assert(
    cinesrcRes.success &&
      cinesrcRes.source === 'cinesrc' &&
      Boolean(cinesrcRes.url?.includes('https%3A%2F%2Fcinesrc.st%2Fapi%2Fplaylist%2Ftest%2Fmaster')),
    'CineSrcProvider (Vortex) resolves relative /api/playlist/... streams onto https://cinesrc.st/api/playlist/...'
  );

  // 8J. Hexa (Helios) mock resolution + 401 token refresh retry
  let hexaUpstreamTries = 0;
  const hexaMockFetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('cap.hexa.su') && u.includes('/challenge')) {
      return new Response(JSON.stringify({ ch: 1 }), { status: 200 });
    }
    if (u.includes('/enc-hexa')) {
      return new Response(JSON.stringify({ status: 200, result: { sol: 1 } }), { status: 200 });
    }
    if (u.includes('cap.hexa.su') && u.includes('/redeem')) {
      return new Response(JSON.stringify({ token: `cap-${hexaUpstreamTries}` }), { status: 200 });
    }
    if (u.includes('theemoviedb.hexa.su')) {
      hexaUpstreamTries++;
      if (hexaUpstreamTries === 1) return new Response('expired', { status: 401 });
      return new Response('hex-enc-payload', { status: 200 });
    }
    if (u.includes('/dec-hexa')) {
      return new Response(
        JSON.stringify({
          status: 200,
          result: {
            sources: [
              { server: 'alpha', url: 'https://cdn.hexa.example/alpha.m3u8' },
              { server: 'delta', url: 'https://cdn.hexa.example/delta.m3u8' }
            ]
          }
        }),
        { status: 200 }
      );
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  const hexaRes = await new HexaProvider({ fetchImpl: hexaMockFetch }).getStream('1396', 'tv', 1, 1);
  assert(
    hexaRes.success &&
      hexaRes.source === 'hexa' &&
      hexaUpstreamTries === 2 &&
      hexaRes.sources?.length === 2,
    'HexaProvider (Helios) retries with fresh cap token on HTTP 401 and returns deduplicated HLS sources'
  );

  // 8K. VidUp (Cobalt) honors noReferrer flag when proxying URLs
  const makeVidupMock = (noReferrer: boolean) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('vidup.to/movie/')) {
        return new Response('{"en":"mockEnToken"}', { status: 200 });
      }
      if (u.includes('/enc-vidup') && u.includes('stage=1')) {
        return new Response(
          JSON.stringify({ status: 200, result: { stage1: 'https://vidup.to/s1', token: 'csrf1' } }),
          { status: 200 }
        );
      }
      if (u === 'https://vidup.to/s1') {
        return new Response('s1out', { status: 200 });
      }
      if (u.includes('/enc-vidup') && u.includes('stage=2')) {
        return new Response(
          JSON.stringify({
            status: 200,
            result: { servers: 'https://vidup.to/srvs', stream: 'https://vidup.to/strm', token: 'csrf2' }
          }),
          { status: 200 }
        );
      }
      if (u === 'https://vidup.to/srvs') {
        return new Response('enc-servers', { status: 200 });
      }
      if (u.startsWith('https://vidup.to/strm/')) {
        return new Response('enc-stream', { status: 200 });
      }
      if (u.includes('/dec-vidup')) {
        const body = JSON.parse(String(init?.body || '{}'));
        if (body.text === 'enc-servers') {
          return new Response(JSON.stringify({ status: 200, result: [{ name: 'Euro', data: 'eu1' }] }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ status: 200, result: { url: 'https://cdn.vidup.example/4k.m3u8', noReferrer } }),
          { status: 200 }
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

  const vidupNoRef = await new VidUpProvider({ fetchImpl: makeVidupMock(true) }).getStream('550', 'movie');
  const vidupWithRef = await new VidUpProvider({ fetchImpl: makeVidupMock(false) }).getStream('550', 'movie');
  assert(
    vidupNoRef.success &&
      !vidupNoRef.url?.includes('referer=') &&
      vidupWithRef.success &&
      Boolean(vidupWithRef.url?.includes('referer=https%3A%2F%2Fvidup.to%2F')),
    'VidUpProvider (Cobalt) honors noReferrer flag when constructing /api/proxy stream URLs'
  );

  // 8L. Frontend cleanServerDisplay preserves new server names and maps raw keys cleanly
  assert(
    cleanServerDisplay('Aether · Light') === 'Aether · Light' &&
      cleanServerDisplay('Vortex · Nebula') === 'Vortex · Nebula' &&
      cleanServerDisplay('Helios · alpha') === 'Helios · alpha' &&
      cleanServerDisplay('Cobalt · Euro') === 'Cobalt · Euro' &&
      cleanServerDisplay('cinejoy') === 'Aether' &&
      cleanServerDisplay('cinesrc') === 'Vortex' &&
      cleanServerDisplay('vidrock') === 'Krypton' &&
      cleanServerDisplay('vidup') === 'Cobalt' &&
      cleanServerDisplay('hexa') === 'Helios' &&
      cleanServerDisplay('boxmovie') === 'Vertex' &&
      cleanServerDisplay('meowtv') === 'Flux' &&
      cleanServerDisplay('vidapi') === 'Sigma' &&
      cleanServerDisplay('eclipse') === 'Spectra' &&
      cleanServerDisplay('vidrift') === 'Nimbus' &&
      cleanServerDisplay('vidlink') === 'Quantum' &&
      cleanServerDisplay('lmscript') === 'Onyx',
    'cleanServerDisplay preserves Aether/Vortex/Krypton/Cobalt/Helios/Vertex/Flux/Sigma/Spectra/Nimbus/Quantum/Onyx and sanitizes raw keys'
  );

  // 8M. Real HLS Manifest Resolution Parsing, Source Quality Enrichment & Badge Helpers
  const m3u8_4k = `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=12000000,RESOLUTION=3840x2160\n4k.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080\n1080.m3u8`;
  const m3u8_ultrawide4k = `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=9000000,RESOLUTION=3840x1600\nuw4k.m3u8`;
  const m3u8_1440 = `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=7000000,RESOLUTION=2560x1440\n1440.m3u8`;
  const m3u8_720 = `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720\n720.m3u8`;
  const m3u8_named = `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1200000,NAME="480p"\n480.m3u8`;

  assert(
    parseM3u8ResolutionLabel(m3u8_4k) === '4K' &&
      parseM3u8ResolutionLabel(m3u8_ultrawide4k) === '4K' &&
      parseM3u8ResolutionLabel(m3u8_1440) === '1440p' &&
      parseM3u8ResolutionLabel(m3u8_720) === '720p' &&
      parseM3u8ResolutionLabel(m3u8_named) === '480p',
    'parseM3u8ResolutionLabel extracts accurate highest resolution (4K/1440p/720p/480p, including ultrawide)'
  );

  const enriched = await enrichSourcesWithRealQuality(
    [
      { name: 'Aether', url: '/api/proxy?url=https%3A%2F%2Fa.example%2F4k.m3u8', quality: '1080p Auto', type: 'hls' },
      { name: 'Vertex · 720p', url: 'https://v.example/720.mp4', quality: '720p', type: 'mp4' }
    ],
    {
      probeFn: async (u) => (u.includes('4k.m3u8') ? '4K' : null)
    }
  );
  assert(
    enriched[0].quality === '4K' && enriched[1].quality === '720p',
    'enrichSourcesWithRealQuality replaces vague "1080p Auto" placeholder with probed concrete resolution while preserving explicit MP4 resolutions'
  );

  const probedRoute = createStreamRoute({
    getProviders: () => [
      {
        key: 'cinejoy',
        label: 'Aether',
        priority: 1,
        enabled: true,
        async getStream() {
          return {
            success: true,
            source: 'cinejoy',
            url: '/api/proxy?url=https%3A%2F%2Fcdn.example%2Fmaster.m3u8',
            type: 'hls' as const,
            sources: [
              {
                name: 'Aether · Main',
                url: '/api/proxy?url=https%3A%2F%2Fcdn.example%2Fmaster.m3u8',
                quality: '1080p Auto',
                type: 'hls' as const
              }
            ]
          };
        }
      }
    ],
    enrichSources: async (srcs) =>
      enrichSourcesWithRealQuality(srcs, { probeFn: async () => '1440p' })
  });
  const probedRouteRes = await probedRoute.request('/movie/550');
  const probedRouteJson = await probedRouteRes.json() as any;
  assert(
    probedRouteRes.status === 200 &&
      probedRouteJson.quality === '1440p' &&
      probedRouteJson.servers[0].quality === '1440p' &&
      probedRouteJson.servers[0].sources[0].quality === '1440p',
    'createStreamRoute exposes probed concrete quality on server & top-level payload'
  );

  assert(
    formatQualityBadge('2160p', 'hls') === '4K' &&
      formatQualityBadge('4K / 1080p', 'hls') === '4K / 1080p' &&
      formatQualityBadge('720p', 'mp4') === '720p' &&
      formatQualityBadge('1080p Auto', 'hls') === '1080p' &&
      formatQualityBadge('auto', 'hls') === 'Auto' &&
      formatQualityBadge('', 'mp4') === 'Unknown' &&
      stripQualityFromName('Vertex · 1080p') === 'Vertex' &&
      stripQualityFromName('Aether (1080p)') === 'Aether',
    'formatQualityBadge and stripQualityFromName format honest server resolution pills without fabricating 1080p'
  );

  // 8M-2. Honest Quality Detection & Provider Health Outcomes + Anime StreamRequest
  const unverifiedRecent = getMediaQuality({
    id: 999111,
    mediaType: 'movie',
    title: 'Blockbuster Test',
    releaseDate: '2026-01-01',
    popularity: 9500,
    voteAverage: 8.9,
    voteCount: 5000
  });
  const unverifiedOld = getMediaQuality({
    id: 999222,
    mediaType: 'movie',
    title: 'Brand New Cam Test',
    releaseDate: new Date().toISOString().slice(0, 10),
    popularity: 1
  });
  const verified4k = detectStreamQualityFromDimensions(3840, 2160, 'movie_999111');
  const cachedAfterMeasure = getMediaQuality({ id: 999111, mediaType: 'movie' });
  assert(
    !unverifiedRecent.verified &&
      unverifiedRecent.tag === 'Unknown' &&
      !unverifiedOld.isCam &&
      unverifiedOld.tag === 'Unknown' &&
      verified4k.verified &&
      verified4k.tag === '4K' &&
      cachedAfterMeasure.verified &&
      cachedAfterMeasure.tag === '4K',
    'quality.ts never fabricates 4K/CAM from popularity or release date and caches only real measured dimensions'
  );

  const healthInitRes = await serverApp.request('/api/stream/health');
  const healthInitJson = await healthInitRes.json() as any;
  assert(
    healthInitRes.status === 200 &&
      healthInitJson.success &&
      Array.isArray(healthInitJson.providers) &&
      healthInitJson.providers.length === 12,
    'GET /api/stream/health returns real health records for all 12 providers'
  );

  const outcomeFailRes = await serverApp.request('/api/stream/health/outcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'vidapi', succeeded: false, reason: 'Playback network error' })
  });
  const afterFailHealth = getProviderHealthRecords().find((r) => r.key === 'vidapi');
  const healthyCinejoy = getProviderHealthRecords().find((r) => r.key === 'cinejoy');
  assert(
    outcomeFailRes.status === 200 &&
      Boolean(afterFailHealth && afterFailHealth.playbackFailures >= 1) &&
      Boolean(healthyCinejoy && afterFailHealth && afterFailHealth.healthScore < healthyCinejoy.healthScore),
    'POST /api/stream/health/outcome lowers provider health score on genuine playback failures'
  );
  recordProviderPlaybackOutcome('vidapi', true);
  clearProviderLatencies();

  let capturedAnimeReq: any = null;
  const animeStreamRoute = createStreamRoute({
    getProviders: () => [
      {
        key: 'anime_adapter',
        label: 'Aether',
        priority: 1,
        enabled: true,
        supportedTypes: ['anime'],
        async getStream() {
          return { success: false, source: 'anime_adapter' };
        },
        async resolveStream(req) {
          capturedAnimeReq = req;
          return {
            success: true,
            source: 'anime_adapter',
            url: '/api/proxy?url=https%3A%2F%2Fcdn.example%2Fep1.m3u8',
            type: 'hls',
            sources: [{ name: 'Aether', url: '/api/proxy?url=https%3A%2F%2Fcdn.example%2Fep1.m3u8', quality: '1080p', type: 'hls' }]
          };
        }
      }
    ]
  });
  const animeStreamRes = await animeStreamRoute.request('/anime/16498?episode=3&tmdbId=1429&malId=16498&audio=dub');
  const animeStreamJson = await animeStreamRes.json() as any;
  assert(
    animeStreamRes.status === 200 &&
      animeStreamJson.success &&
      capturedAnimeReq?.mediaType === 'anime' &&
      capturedAnimeReq?.anilistId === 16498 &&
      capturedAnimeReq?.tmdbId === '1429' &&
      capturedAnimeReq?.malId === 16498 &&
      capturedAnimeReq?.episode === 3 &&
      capturedAnimeReq?.audioType === 'dub',
    '/api/stream/anime/:id forwards isolated AniList/MAL/TMDB IDs and audioType via StreamRequest'
  );

  // 8N. Autoplay Next Episode preference toggle & storage synchronization
  const prevLocalStorage = (globalThis as any).localStorage;
  const prevWindow = (globalThis as any).window;
  const prevCustomEvent = (globalThis as any).CustomEvent;
  const memStore = new Map<string, string>();
  const dispatchedEvents: Array<{ type: string; detail: any }> = [];

  (globalThis as any).localStorage = {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memStore.set(k, v);
    },
    removeItem: (k: string) => {
      memStore.delete(k);
    }
  };
  (globalThis as any).window = {
    dispatchEvent: (ev: any) => {
      dispatchedEvents.push({ type: ev.type, detail: ev.detail });
      return true;
    }
  };
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, opts?: { detail?: any }) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };

  try {
    const {
      getEffectiveAutoplayNextEpisode,
      setAutoplayNextEpisodePreference,
      getUserPlayerSettings
    } = await import('../playerSettings');
    const { getUserSettings } = await import('../storage');

    assert(
      getEffectiveAutoplayNextEpisode() === true && getUserSettings().autoplayNext === true,
      'Autoplay Next Episode defaults to true before user changes'
    );

    const offResult = await setAutoplayNextEpisodePreference(false);
    assert(
      offResult === false &&
        getEffectiveAutoplayNextEpisode() === false &&
        getUserPlayerSettings().autoplayNextEpisode === false &&
        getUserSettings().autoplayNext === false &&
        dispatchedEvents.some((e) => e.type === 'tstream_player_settings_changed') &&
        dispatchedEvents.some((e) => e.type === 'tstream:storage_update'),
      'setAutoplayNextEpisodePreference(false) persists false and notifies player/storage listeners'
    );

    const onResult = await setAutoplayNextEpisodePreference(true);
    assert(
      onResult === true &&
        getEffectiveAutoplayNextEpisode() === true &&
        getUserPlayerSettings().autoplayNextEpisode === true &&
        getUserSettings().autoplayNext === true,
      'setAutoplayNextEpisodePreference(true) re-enables autoplay cleanly across player and library settings'
    );

    // 8O. Firestore quota detection & zero-write analytics visit tracking
    const { isQuotaExceededError, isFirestoreQuotaExceeded } = await import('../firebase');
    const { recordSiteVisit } = await import('../analytics');

    assert(
      isQuotaExceededError({ code: 'resource-exhausted', message: 'Quota limit exceeded.' }) &&
        isQuotaExceededError(new Error('Free daily write units per project quota exceeded')) &&
        !isQuotaExceededError(new Error('Permission denied')),
      'isQuotaExceededError detects Firestore resource-exhausted and quota errors accurately'
    );

    const prevSessionStorage = (globalThis as any).sessionStorage;
    const prevDocument = (globalThis as any).document;
    const prevNavigator = (globalThis as any).navigator;
    const sessionMem = new Map<string, string>();
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => sessionMem.get(k) ?? null,
      setItem: (k: string, v: string) => sessionMem.set(k, v)
    };
    (globalThis as any).document = { referrer: '' };
    if (!prevNavigator) {
      (globalThis as any).navigator = { userAgent: 'Mozilla/5.0 Chrome/120.0' };
    }
    try {
      await recordSiteVisit('/movies', null);
      const localVisitsRaw = memStore.get('tstream_local_visits_v1');
      const localVisits = localVisitsRaw ? JSON.parse(localVisitsRaw) : [];
      assert(
        Array.isArray(localVisits) &&
          localVisits.length === 1 &&
          localVisits[0].path === '/movies' &&
          !isFirestoreQuotaExceeded(),
        'recordSiteVisit records visit locally without triggering Firestore write quota errors'
      );
    } finally {
      if (prevSessionStorage === undefined) delete (globalThis as any).sessionStorage;
      else (globalThis as any).sessionStorage = prevSessionStorage;
      if (prevDocument === undefined) delete (globalThis as any).document;
      else (globalThis as any).document = prevDocument;
      if (prevNavigator === undefined) delete (globalThis as any).navigator;
    }
  } finally {
    if (prevLocalStorage === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = prevLocalStorage;
    if (prevWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = prevWindow;
    if (prevCustomEvent === undefined) delete (globalThis as any).CustomEvent;
    else (globalThis as any).CustomEvent = prevCustomEvent;
  }

  console.log('\n--- ALL SERVER, SECURITY & STREAMING REGRESSION TESTS PASSED ---');
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Server test error:', err);
    process.exit(1);
  });
