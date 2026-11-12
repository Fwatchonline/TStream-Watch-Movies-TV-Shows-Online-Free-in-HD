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
const TRACKING_PARAMS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'session']);

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

const cachedBaseTemplate = loadDistTemplate();

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
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);

  if (req.method === 'HEAD') {
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Length', String(stat.size));
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

function hasFunctionalQueryParams(searchParams: URLSearchParams): boolean {
  for (const key of searchParams.keys()) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) {
      return true;
    }
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '/';
  const parsedUrl = new URL(reqUrl, `http://127.0.0.1:${PORT}`);
  const pathname = parsedUrl.pathname;

  // 1. Health Check endpoint (must remain fast & reliable)
  if (pathname === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'tstream-production',
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

  // 3. Hono streaming/subtitle API routes (/api/proxy*, /api/stream/*, /api/subtitle-proxy*)
  if (
    pathname.startsWith('/api/proxy') ||
    pathname.startsWith('/api/stream/') ||
    pathname.startsWith('/api/subtitle-proxy')
  ) {
    return honoListener(req, res);
  }

  // 4. Unknown API routes -> Genuine 404 JSON (never HTML)
  if (pathname.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
      const isImmutableAsset = pathname.startsWith('/assets/');
      const cacheControl = isImmutableAsset
        ? 'public, max-age=31536000, immutable'
        : ASSET_EXT_REGEX.test(pathname)
          ? 'public, max-age=86400'
          : 'no-cache';
      sendStaticFile(req, res, exactFilePath, cacheControl);
      return;
    }
  }

  // Missing static file extensions must return HTTP 404 (never fall back to SPA HTML)
  if (ASSET_EXT_REGEX.test(pathname)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
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
  const template = cachedBaseTemplate || loadDistTemplate();
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
    console.error('[TStream Production Server Error]', err?.message || err);
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
