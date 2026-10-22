import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { resolveAllDirectStreams } from './src/services/directStreamEngine';

function rewriteM3u8(manifest: string, baseUrl: string, ref?: string, orig?: string): string {
  const base = new URL(baseUrl);
  const lines = manifest.split('\n');
  const rewritten = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI=')) {
        return trimmed.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
          const abs = new URL(uri, base).href;
          const params = new URLSearchParams({ url: abs });
          if (ref) params.set('ref', ref);
          if (orig) params.set('orig', orig);
          return `URI="/api/stream-proxy?${params.toString()}"`;
        });
      }
      return line;
    }
    const absUrl = new URL(trimmed, base).href;
    const params = new URLSearchParams({ url: absUrl });
    if (ref) params.set('ref', ref);
    if (orig) params.set('orig', orig);
    return `/api/stream-proxy?${params.toString()}`;
  });
  return rewritten.join('\n');
}

function streamApiPlugin(): Plugin {
  const handleRequest = async (req: any, res: any, next: any) => {
    const url = req.url || '';

    // Handle CORS preflight
    if (req.method === 'OPTIONS' && (url.startsWith('/api/stream-resolve') || url.startsWith('/api/stream-proxy'))) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.statusCode = 204;
      res.end();
      return;
    }

    // 1. /api/stream-resolve
    if (url.startsWith('/api/stream-resolve')) {
      try {
        const parsed = new URL(url, 'http://localhost:3000');
        const tmdbId = parsed.searchParams.get('tmdbId') || '';
        const seasonStr = parsed.searchParams.get('season');
        const episodeStr = parsed.searchParams.get('episode');
        const provider = parsed.searchParams.get('provider') || undefined;

        const season = seasonStr ? parseInt(seasonStr, 10) : undefined;
        const episode = episodeStr ? parseInt(episodeStr, 10) : undefined;

        const rawResults = await resolveAllDirectStreams(tmdbId, season, episode, provider);

        const results = rawResults.map(r => ({
          ...r,
          streams: r.streams.map(s => {
            let playUrl = s.url;
            // Route through proxy if it is HLS or has custom headers
            if (s.type === 'hls' || s.headers?.Referer || s.headers?.Origin) {
              const params = new URLSearchParams({ url: s.url });
              if (s.headers?.Referer) params.set('ref', s.headers.Referer);
              if (s.headers?.Origin) params.set('orig', s.headers.Origin);
              playUrl = `/api/stream-proxy?${params.toString()}`;
            }
            return {
              ...s,
              playUrl,
              directUrl: s.url
            };
          })
        }));

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ success: true, results }));
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 2. /api/stream-proxy
    if (url.startsWith('/api/stream-proxy')) {
      try {
        const parsed = new URL(url, 'http://localhost:3000');
        const targetUrl = parsed.searchParams.get('url');
        if (!targetUrl) {
          res.statusCode = 400;
          res.end('Missing url parameter');
          return;
        }

        const ref = parsed.searchParams.get('ref') || '';
        const orig = parsed.searchParams.get('orig') || '';

        const upstreamHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': '*/*'
        };
        if (ref) upstreamHeaders['Referer'] = ref;
        if (orig) upstreamHeaders['Origin'] = orig;
        if (req.headers['range']) {
          upstreamHeaders['Range'] = req.headers['range'];
        }

        const upstream = await fetch(targetUrl, { headers: upstreamHeaders });
        const ct = (upstream.headers.get('content-type') || '').toLowerCase();
        const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || targetUrl.includes('.m3u8');

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

        if (isM3u8) {
          const text = await upstream.text();
          const effectiveBaseUrl = upstream.url || targetUrl;
          const rewritten = rewriteM3u8(text, effectiveBaseUrl, ref, orig);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.statusCode = upstream.status;
          res.end(rewritten);
          return;
        }

        res.statusCode = upstream.status;
        const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
        for (const h of passHeaders) {
          const val = upstream.headers.get(h);
          if (val) res.setHeader(h, val);
        }

        if (targetUrl.includes('.ts') || targetUrl.includes('/convert/')) {
          res.setHeader('Content-Type', 'video/mp2t');
        } else if (targetUrl.includes('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        }

        if (!upstream.body) {
          res.end();
          return;
        }

        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (err: any) {
        if (!res.headersSent) {
          res.statusCode = 502;
          res.end('Upstream error: ' + err.message);
        }
      }
      return;
    }

    next();
  };

  return {
    name: 'stream-api-plugin',
    configureServer(server) {
      server.middlewares.use(handleRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest);
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), streamApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

