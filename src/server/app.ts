import { Hono } from 'hono';
import { proxyRoute } from './api/proxy';
import { streamRoute } from './api/stream';

const app = new Hono();

// Mount streaming routes
app.route('/api/proxy', proxyRoute);
app.route('/api/stream', streamRoute);

export default app;
