import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { seoHtmlPlugin } from './scripts/seoHtmlPlugin.ts';
import { getRequestListener } from '@hono/node-server';
import serverApp from './src/server/app.ts';
import { handleLegacyStreamRequest } from './src/server/legacyStreamHandler.ts';

function streamApiPlugin(): Plugin {
  const honoListener = getRequestListener(serverApp.fetch);

  const handleRequest = async (req: any, res: any, next: any) => {
    const url = req.url || '';

    if (url.split('?')[0] === '/api/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', service: 'tstream-vite' }));
      return;
    }

    // Route Hono streaming proxy, orchestrator, subtitle proxy, and TMDB API proxy
    if (
      url.startsWith('/api/proxy') ||
      url.startsWith('/api/stream/') ||
      url.startsWith('/api/subtitle-proxy') ||
      url.startsWith('/api/tmdb')
    ) {
      return honoListener(req, res);
    }

    // Route legacy /api/stream-resolve & /api/stream-proxy
    const handled = await handleLegacyStreamRequest(req, res);
    if (handled) return;

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

