import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolveAllDirectStreams } from './src/services/directStreamEngine.ts';
import { seoHtmlPlugin } from './scripts/seoHtmlPlugin.ts';
import { getRequestListener } from '@hono/node-server';
import serverApp from './src/server/app.ts';
import {
  safeFetchStream,
  ProxySecurityError
} from './src/server/utils/safeProxyFetch.ts';
import { pipeline } from 'node:stream/promises';


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
  const honoListener = getRequestListener(serverApp.fetch);

  const handleRequest = async (req: any, res: any, next: any) => {
    const url = req.url || '';

    // Route new Hono streaming proxy and orchestrator
    if (url.startsWith('/api/proxy') || url.startsWith('/api/stream/')) {
      return honoListener(req, res);
    }

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
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ success: false, error: err.message, results: [] }));
      }
      return;
    }


    // 2. /api/stream-proxy — SSRF protected legacy Fmov proxy
    if (url.startsWith('/api/stream-proxy')) {
      const cors = () => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
      };

      cors();

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.end('Method not allowed');
        return;
      }

      let controller: AbortController | undefined;

      try {
        const parsed = new URL(url, 'http://localhost:3000');
        const targetUrl = parsed.searchParams.get('url');

        if (!targetUrl) {
          res.statusCode = 400;
          res.end('Missing url parameter');
          return;
        }

        const safeHeaderUrl = (raw: string | null, originOnly = false) => {
          if (!raw || raw.length > 2048) return '';

          try {
            const value = new URL(raw);

            if (
              !['http:', 'https:'].includes(value.protocol) ||
              value.username ||
              value.password
            ) return '';

            return originOnly ? value.origin : value.href;
          } catch {
            return '';
          }
        };

        const ref = safeHeaderUrl(parsed.searchParams.get('ref'));
        const orig = safeHeaderUrl(parsed.searchParams.get('orig'), true);

        const upstreamHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Encoding': 'identity'
        };

        if (ref) upstreamHeaders['Referer'] = ref;
        if (orig) upstreamHeaders['Origin'] = orig;

        const range = req.headers['range'];

        if (
          typeof range === 'string' &&
          /^bytes=(?:\d+-\d*|-\d+)(?:,(?:\d+-\d*|-\d+))*$/.test(range)
        ) {
          upstreamHeaders['Range'] = range;
        }

        controller = new AbortController();

        req.once('aborted', () => controller?.abort());

        res.once('close', () => {
          if (!res.writableEnded) controller?.abort();
        });

        const method: 'GET' | 'HEAD' =
          req.method === 'HEAD' ? 'HEAD' : 'GET';

        const result = await safeFetchStream(
          targetUrl,
          upstreamHeaders,
          controller.signal,
          method
        );

        const upstream = result.response;
        const status = upstream.statusCode || 502;
        const contentType =
          String(upstream.headers['content-type'] || '').toLowerCase();

        res.statusCode = status;

        if (status === 206) {
          const value = upstream.headers['content-range'];
          if (value) res.setHeader('Content-Range', value);
        }

        const acceptRanges = upstream.headers['accept-ranges'];
        if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

        if (method === 'HEAD') {
          for (const h of ['content-type', 'content-length']) {
            const value = upstream.headers[h];
            if (value) res.setHeader(h, value);
          }

          upstream.destroy();
          res.end();
          return;
        }

        // Pass upstream error responses without following unsafe redirects.
        if (status < 200 || status >= 300) {
          for (const h of ['content-type', 'content-length', 'cache-control']) {
            const value = upstream.headers[h];
            if (value) res.setHeader(h, value);
          }

          await pipeline(upstream, res);
          return;
        }

        const isM3u8 =
          result.finalUrl.toLowerCase().includes('.m3u8') ||
          contentType.includes('mpegurl') ||
          contentType.includes('x-mpegurl');

        if (isM3u8) {
          const chunks: Buffer[] = [];
          let total = 0;
          const MAX_MANIFEST_SIZE = 5 * 1024 * 1024;

          for await (const chunk of upstream) {
            const buffer = Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk);

            total += buffer.length;

            if (total > MAX_MANIFEST_SIZE) {
              upstream.destroy();
              throw new Error('HLS manifest exceeds maximum size');
            }

            chunks.push(buffer);
          }

          const text = Buffer.concat(chunks).toString('utf8');

          if (text.includes('#EXTM3U')) {
            const rewritten = rewriteM3u8(
              text,
              result.finalUrl,
              ref,
              orig
            );

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(rewritten);
            return;
          }

          res.setHeader('Content-Type', 'video/mp2t');
          res.end(text);
          return;
        }

        const passHeaders = [
          'content-type',
          'content-length',
          'content-range',
          'accept-ranges',
          'cache-control'
        ];

        for (const h of passHeaders) {
          const value = upstream.headers[h];
          if (value) res.setHeader(h, value);
        }

        if (
          /\.ts(?:$|[?#])/i.test(result.finalUrl) ||
          result.finalUrl.includes('/convert/')
        ) {
          res.setHeader('Content-Type', 'video/mp2t');
        } else if (/\.mp4(?:$|[?#])/i.test(result.finalUrl)) {
          res.setHeader('Content-Type', 'video/mp4');
        }

        await pipeline(upstream, res);

      } catch (err: any) {
        if (res.headersSent) {
          res.destroy(err);
          return;
        }

        if (err instanceof ProxySecurityError) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Upstream destination blocked by security policy'
          }));
          return;
        }

        console.error('[TStream legacy proxy]', err.message);

        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Stream temporarily unavailable or offline'
        }));
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
    plugins: [
      react(),
      tailwindcss(),
      streamApiPlugin(),
      seoHtmlPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'apple-touch-icon.png',
          'icon.svg',
          'logo.png',
          'og-image.png'
        ],
        manifest: {
          id: '/',
          name: 'T Stream — Watch Movies & TV Shows Online Free',
          short_name: 'T Stream',
          description: 'Stream trending movies, series, and anime in 4K UHD and 1080p Full HD with multilingual subtitles and multi-server playback.',
          theme_color: '#F5C400',
          background_color: '#121215',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'tmdb-images-cache',
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 60 * 60 * 24 * 14
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd()),
      },
    },
    preview: {
      allowedHosts: ['tstream.online', 'www.tstream.online'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

