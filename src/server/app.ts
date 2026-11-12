import { Hono } from 'hono';
import { proxyRoute } from './api/proxy';
import { streamRoute } from './api/stream';
import { subtitleProxyRoute } from './api/subtitleProxy';
import { tmdbRoute } from './api/tmdb';

const app = new Hono();

// Mount streaming, subtitle, and TMDB proxy routes
app.route('/api/proxy', proxyRoute);
app.route('/api/stream', streamRoute);
app.route('/api/subtitle-proxy', subtitleProxyRoute);
app.route('/api/tmdb', tmdbRoute);

export default app;
