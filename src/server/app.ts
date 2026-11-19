import { Hono } from 'hono';
import { aniListRoute } from './api/anilist';
import { aniSkipRoute } from './api/aniskip';
import { imageProxyRoute } from './api/imageProxy';
import { liveCatalogRoute } from './api/liveCatalog';
import { proxyRoute } from './api/proxy';
import { streamRoute } from './api/stream';
import { subtitleProxyRoute } from './api/subtitleProxy';
import { tmdbRoute } from './api/tmdb';

const app = new Hono();

// Mount streaming, subtitle, anilist, aniskip, image proxy, live fallback catalog, and TMDB proxy routes
app.route('/api/anilist', aniListRoute);
app.route('/api/anime', aniListRoute);
app.route('/api/aniskip', aniSkipRoute);
app.route('/api/image-proxy', imageProxyRoute);
app.route('/api/catalog/live', liveCatalogRoute);
app.route('/api/proxy', proxyRoute);
app.route('/api/stream', streamRoute);
app.route('/api/subtitle-proxy', subtitleProxyRoute);
app.route('/api/tmdb', tmdbRoute);

export default app;
