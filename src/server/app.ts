import { Hono } from 'hono';
import { proxyRoute } from './api/proxy';
import { streamRoute } from './api/stream';
import { subtitleProxyRoute } from './api/subtitleProxy';

const app = new Hono();

// Mount streaming and subtitle routes
app.route('/api/proxy', proxyRoute);
app.route('/api/stream', streamRoute);
app.route('/api/subtitle-proxy', subtitleProxyRoute);

export default app;
