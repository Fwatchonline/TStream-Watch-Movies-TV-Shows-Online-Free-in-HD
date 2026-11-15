import { Hono } from 'hono';
import { USER_AGENT } from '../utils/helpers';
import { safeFetchStream, ProxySecurityError } from '../utils/safeProxyFetch';

export const imageProxyRoute = new Hono();

const ALLOWED_IMAGE_HOSTS = new Set([
  'image.tmdb.org',
  'images.metahub.space',
  'live.metahub.space',
  'episodes.metahub.space',
  'static.tvmaze.com',
  'images.unsplash.com'
]);

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB cap per cached asset
const MAX_CACHE_ENTRIES = 250;
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedImageEntry {
  body: Buffer;
  contentType: string;
  expiresAt: number;
}

const imageCache = new Map<string, CachedImageEntry>();

function isAllowedImageUrl(rawUrl: string): URL | null {
  if (!rawUrl || rawUrl.length > 2048) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.port && parsed.port !== '443' && parsed.port !== '80') return null;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_IMAGE_HOSTS.has(host)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setBoundedImageCache(key: string, entry: CachedImageEntry) {
  if (imageCache.has(key)) {
    imageCache.delete(key);
  }
  imageCache.set(key, entry);
  while (imageCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey !== undefined) {
      imageCache.delete(oldestKey);
    } else {
      break;
    }
  }
}

imageProxyRoute.get('/', async c => {
  const rawUrl = c.req.query('url') || '';
  const targetUrl = isAllowedImageUrl(rawUrl);
  if (!targetUrl) {
    return c.json({ error: 'Image host is not permitted by allowlist' }, 403);
  }

  const cacheKey = targetUrl.toString();
  const cached = imageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    c.header('Content-Type', cached.contentType);
    c.header('Cache-Control', 'public, max-age=86400');
    return c.body(new Uint8Array(cached.body), 200);
  }

  try {
    const result = await safeFetchStream(
      cacheKey,
      {
        'User-Agent': USER_AGENT,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      c.req.raw.signal,
      'GET'
    );

    const finalParsed = isAllowedImageUrl(result.finalUrl);
    if (!finalParsed) {
      result.response.destroy();
      return c.json({ error: 'Redirect target is not permitted by allowlist' }, 403);
    }

    const status = result.response.statusCode || 502;
    if (status < 200 || status >= 300) {
      result.response.destroy();
      return c.text('Upstream image unavailable', status as any);
    }

    const rawContentType = result.response.headers['content-type'];
    const contentType = Array.isArray(rawContentType)
      ? rawContentType[0] || ''
      : rawContentType || '';

    if (!contentType.toLowerCase().startsWith('image/')) {
      result.response.destroy();
      return c.json({ error: 'Upstream response is not an image' }, 502);
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of result.response) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > MAX_IMAGE_BYTES) {
        result.response.destroy();
        return c.json({ error: 'Image exceeds maximum allowed size' }, 413);
      }
      chunks.push(buf);
    }

    const body = Buffer.concat(chunks);
    const normalizedType = contentType.split(';')[0].trim() || 'image/jpeg';

    setBoundedImageCache(cacheKey, {
      body,
      contentType: normalizedType,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    c.header('Content-Type', normalizedType);
    c.header('Cache-Control', 'public, max-age=86400');
    return c.body(new Uint8Array(body), 200);
  } catch (error: any) {
    if (error instanceof ProxySecurityError) {
      return c.json({ error: 'Upstream destination blocked by security policy' }, 403);
    }
    return c.json({ error: 'Image temporarily unavailable' }, 502);
  }
});
