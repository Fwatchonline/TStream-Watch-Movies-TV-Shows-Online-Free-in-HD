import { Hono } from 'hono';
import { safeFetchStream, ProxySecurityError } from '../utils/safeProxyFetch';

export const subtitleProxyRoute = new Hono();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const MAX_SUBTITLE_SIZE = 5 * 1024 * 1024;

subtitleProxyRoute.options('*', (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  c.header('Access-Control-Allow-Headers', '*');
  return c.body(null, 204);
});

subtitleProxyRoute.get('*', async (c) => {
  c.header('Access-Control-Allow-Origin', '*');

  const targetUrl = c.req.query('url');
  if (!targetUrl) {
    return c.text('Missing url parameter', 400);
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return c.text('Invalid url protocol', 400);
    }
  } catch {
    return c.text('Invalid subtitle URL', 400);
  }

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/vtt,text/plain,*/*'
  };

  if (targetUrl.includes('vdrk.site')) {
    headers['Referer'] = 'https://sub.vdrk.site/';
    headers['Origin'] = 'https://sub.vdrk.site';
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 10000);
  const combinedSignal =
    typeof AbortSignal.any === 'function'
      ? AbortSignal.any([c.req.raw.signal, timeoutController.signal])
      : timeoutController.signal;

  try {
    const { response } = await safeFetchStream(targetUrl, headers, combinedSignal, 'GET');
    const status = response.statusCode || 502;

    if (status < 200 || status >= 300) {
      response.destroy();
      return c.text(`Upstream returned ${status}`, (status >= 400 && status <= 599 ? status : 502) as any);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of response) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > MAX_SUBTITLE_SIZE) {
        response.destroy();
        return c.text('Subtitle file exceeds maximum allowed size', 502);
      }
      chunks.push(buf);
    }
    const buffer = Buffer.concat(chunks);

    // Multi-encoding detector: Try UTF-8 first, fallback to Windows-1250 (Latin-2) for Ex-Yu diacritics
    let decodedText: string;
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      decodedText = utf8Decoder.decode(buffer);
    } catch {
      try {
        const cp1250Decoder = new TextDecoder('windows-1250');
        decodedText = cp1250Decoder.decode(buffer);
      } catch {
        decodedText = new TextDecoder('utf-8').decode(buffer);
      }
    }

    c.header('Content-Type', 'text/vtt; charset=utf-8');
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Cache-Control', 'public, max-age=86400');
    return c.body(decodedText);
  } catch (err: any) {
    if (err instanceof ProxySecurityError) {
      return c.text('Upstream destination blocked by security policy', 403);
    }
    if (err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('timeout')) {
      return c.text('Subtitle upstream timed out', 504);
    }
    return c.text(`Subtitle fetch failed: ${err?.message || 'Upstream unavailable'}`, 502);
  } finally {
    clearTimeout(timeout);
  }
});
