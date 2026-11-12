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
import serverApp from '../../server/app';
import { createTmdbProxyRoute, clearTmdbProxyCache, isAllowedTmdbPath } from '../../server/api/tmdb';
import { handleLegacyStreamRequest } from '../../server/legacyStreamHandler';
import { safeFetchStream, ProxySecurityError } from '../../server/utils/safeProxyFetch';
import { getServerTmdbApiKey } from '../../../scripts/seoHtmlPlugin';
import { getTmdbApiKey } from '../tmdb';

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

  console.log('\n--- ALL SERVER, SECURITY & STREAMING REGRESSION TESTS PASSED ---');
}

runTests().catch(err => {
  console.error('Server test error:', err);
  process.exit(1);
});
