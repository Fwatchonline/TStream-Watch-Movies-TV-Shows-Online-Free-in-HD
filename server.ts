import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getRequestListener } from '@hono/node-server';
import serverApp from './src/server/app.ts';
import { handleLegacyStreamRequest } from './src/server/legacyStreamHandler.ts';
import { renderSeoResult, render503Html } from './scripts/seoHtmlPlugin.ts';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

const ASSET_EXT_REGEX = /\.(?:js|mjs|css|map|json|webmanifest|xml|txt|png|jpe?g|gif|webp|svg|ico|woff2?|mp4|webm|m3u8|ts)$/i;
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'yclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
  'source',
  'session',
  'sid',
  '_ga',
  '_gl'
]);

const honoListener = getRequestListener(serverApp.fetch);

function loadDistTemplate(): string | null {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    return fs.readFileSync(indexPath, 'utf8');
  }
  const rootIndexPath = path.resolve(process.cwd(), 'index.html');
  if (fs.existsSync(rootIndexPath)) {
    return fs.readFileSync(rootIndexPath, 'utf8');
  }
  return null;
}

let cachedBaseTemplate = loadDistTemplate();

function resolveSafeDistFile(urlPath: string): string | null {
  let decodedPath = urlPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const relPath = decodedPath.replace(/^\/+/, '');
  const candidate = path.resolve(DIST_DIR, relPath);
  if (candidate !== DIST_DIR && !candidate.startsWith(DIST_DIR + path.sep)) {
    return null;
  }
  try {
    if (fs.existsSync(DIST_DIR) && fs.existsSync(candidate)) {
      const realDist = fs.realpathSync(DIST_DIR);
      const realCandidate = fs.realpathSync(candidate);
      if (realCandidate !== realDist && !realCandidate.startsWith(realDist + path.sep)) {
        return null;
      }
      return realCandidate;
    }
  } catch {
    return null;
  }
  return candidate;
}

function sendStaticFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  filePath: string,
  cacheControl: string
) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Content-Length', String(stat.size));

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

function hasFunctionalQueryParams(searchParams: URLSearchParams): boolean {
  for (const key of searchParams.keys()) {
    const lower = key.toLowerCase();
    if (!TRACKING_PARAMS.has(lower) && !lower.startsWith('utm_')) {
      return true;
    }
  }
  return false;
}

function getStaticCacheControl(pathname: string): string {
  if (pathname.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  if (pathname === '/robots.txt' || pathname.endsWith('.xml') || pathname.endsWith('.webmanifest') || pathname.endsWith('.json')) {
    return 'public, max-age=300, must-revalidate';
  }
  if (ASSET_EXT_REGEX.test(pathname)) {
    return 'public, max-age=86400';
  }
  return 'no-cache';
}

function resolveCommitSha(): string {
  const fromEnv = (process.env.APP_COMMIT_SHA || '').trim();
  if (fromEnv) return fromEnv;

  for (const relFile of ['.release-commit', 'dist/.release-commit']) {
    try {
      const fullPath = path.resolve(process.cwd(), relFile);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8').trim();
        if (content) return content;
      }
    } catch {
      // ignore read errors
    }
  }
  return 'local';
}

const RELEASE_COMMIT_SHA = resolveCommitSha();

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '/';
  const parsedUrl = new URL(reqUrl, `http://127.0.0.1:${PORT}`);
  const pathname = parsedUrl.pathname;

  // 1. Health Check endpoint (must remain fast & reliable)
  if (pathname === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'tstream-production',
        version: RELEASE_COMMIT_SHA,
        commitSha: RELEASE_COMMIT_SHA,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      })
    );
    return;
  }

  // 2. Legacy stream endpoints (/api/stream-resolve & /api/stream-proxy)
  if (pathname === '/api/stream-resolve' || pathname === '/api/stream-proxy') {
    await handleLegacyStreamRequest(req, res);
    return;
  }

  // 3. Hono API routes (/api/proxy*, /api/stream/*, /api/subtitle-proxy*, /api/tmdb*, /api/aniskip*, /api/anilist*, /api/anime*, /api/catalog/live*, /api/image-proxy*)
  if (
    pathname.startsWith('/api/proxy') ||
    pathname.startsWith('/api/stream/') ||
    pathname.startsWith('/api/subtitle-proxy') ||
    pathname === '/api/tmdb' ||
    pathname.startsWith('/api/tmdb/') ||
    pathname.startsWith('/api/aniskip') ||
    pathname.startsWith('/api/anilist') ||
    pathname.startsWith('/api/anime') ||
    pathname.startsWith('/api/catalog/live') ||
    pathname.startsWith('/api/image-proxy')
  ) {
    // Strip/overwrite internal verified socket IP header so client spoofing cannot bypass rate limits
    req.headers['x-tstream-verified-ip'] = req.socket?.remoteAddress || '';
    return honoListener(req, res);
  }

  // 4. Unknown API routes -> Genuine 404 JSON (never HTML)
  if (pathname.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Method Not Allowed');
    return;
  }

  // 5. Direct static assets inside dist/ (JS, CSS, sitemaps, robots, icons, images)
  const exactFilePath = resolveSafeDistFile(pathname);
  if (exactFilePath && fs.existsSync(exactFilePath) && fs.statSync(exactFilePath).isFile()) {
    // Only serve index.html directly when exact path IS '/' without functional query params
    if (pathname !== '/' && pathname !== '/index.html') {
      sendStaticFile(req, res, exactFilePath, getStaticCacheControl(pathname));
      return;
    }
  }

  // Missing static file extensions must return HTTP 404 (never fall back to SPA HTML)
  if (ASSET_EXT_REGEX.test(pathname)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end('Not Found');
    return;
  }

  // 6. Serve pre-rendered static HTML when exact route HTML exists and no functional query params alter meta/canonical
  if (!hasFunctionalQueryParams(parsedUrl.searchParams) && pathname !== '/404') {
    const cleanRel = pathname.replace(/^\/+|\/+$/g, '');
    const prerenderedPath = cleanRel
      ? resolveSafeDistFile(`/${cleanRel}/index.html`)
      : resolveSafeDistFile('/index.html');
    if (prerenderedPath && fs.existsSync(prerenderedPath) && fs.statSync(prerenderedPath).isFile()) {
      sendStaticFile(req, res, prerenderedPath, 'public, max-age=300, must-revalidate');
      return;
    }
  }

  // 7. Dynamic SSR SEO Rendering for live TMDB titles, episodes, tags, paginated hubs, 404s & 503s
  if (!cachedBaseTemplate) {
    cachedBaseTemplate = loadDistTemplate();
  }
  const template = cachedBaseTemplate;
  if (!template) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Production build missing (dist/index.html not found). Run npm run build.');
    return;
  }

  try {
    const seoRes = await renderSeoResult(template, reqUrl);
    res.statusCode = seoRes.status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (seoRes.status === 503) {
      res.setHeader('Retry-After', '30');
      res.setHeader('Cache-Control', 'no-store');
    } else if (seoRes.status === 404 || seoRes.isNoindex) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    }

    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(seoRes.html);
  } catch (err: any) {
    const safeMsg = String(err?.message || err || 'Unknown error').replace(/([?&]api_key=)[^&\s]+/gi, '$1[REDACTED]');
    console.error('[TStream Production Server Error]', safeMsg);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Retry-After', '30');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(render503Html(template));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[TStream] Hybrid SEO + API production server listening on http://${HOST}:${PORT}`);
});
