import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { resolveAllDirectStreams } from '../services/directStreamEngine.ts';
import { safeFetchStream, ProxySecurityError } from './utils/safeProxyFetch.ts';

function rewriteM3u8(manifest: string, baseUrl: string, ref?: string, orig?: string): string {
  const base = new URL(baseUrl);
  const lines = manifest.split('\n');
  const rewritten = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) {
      if (trimmed.includes('URI=')) {
        return trimmed.replace(/URI=["']([^"']+)["']/g, (_match, uri) => {
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

function safeHeaderUrl(raw: string | null, originOnly = false): string {
  if (!raw || raw.length > 2048) return '';
  try {
    const value = new URL(raw);
    if (!['http:', 'https:'].includes(value.protocol) || value.username || value.password) {
      return '';
    }
    return originOnly ? value.origin : value.href;
  } catch {
    return '';
  }
}

export async function handleLegacyStreamRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname !== '/api/stream-resolve' && pathname !== '/api/stream-proxy') {
    return false;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, *');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
    res.statusCode = 204;
    res.end();
    return true;
  }

  // 1. /api/stream-resolve
  if (pathname === '/api/stream-resolve') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end(JSON.stringify({ success: false, error: 'Method not allowed', results: [] }));
      return true;
    }

    try {
      const parsed = new URL(url, 'http://localhost:3000');
      const tmdbId = (parsed.searchParams.get('tmdbId') || '').trim();
      const seasonStr = parsed.searchParams.get('season');
      const episodeStr = parsed.searchParams.get('episode');
      const provider = parsed.searchParams.get('provider') || undefined;

      if (!tmdbId || !/^\d+$/.test(tmdbId) || Number(tmdbId) <= 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Invalid or missing numeric tmdbId parameter', results: [] }));
        return true;
      }

      let season: number | undefined;
      let episode: number | undefined;

      if (seasonStr !== null) {
        if (!/^\d+$/.test(seasonStr) || parseInt(seasonStr, 10) < 1) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Invalid season parameter', results: [] }));
          return true;
        }
        season = parseInt(seasonStr, 10);
      }

      if (episodeStr !== null) {
        if (!/^\d+$/.test(episodeStr) || parseInt(episodeStr, 10) < 1) {
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: 'Invalid episode parameter', results: [] }));
          return true;
        }
        episode = parseInt(episodeStr, 10);
      }

      const TIMEOUT_MS = 15000;
      const rawResults = await Promise.race([
        resolveAllDirectStreams(tmdbId, season, episode, provider),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            const err: any = new Error('Stream resolution timed out');
            err.statusCode = 504;
            reject(err);
          }, TIMEOUT_MS)
        )
      ]);

      const results = rawResults.map(r => ({
        ...r,
        streams: r.streams.map(s => {
          let playUrl = s.url;
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

      res.statusCode = 200;
      res.end(JSON.stringify({ success: true, results }));
    } catch (err: any) {
      res.statusCode = err?.statusCode === 504 ? 504 : 503;
      res.end(
        JSON.stringify({
          success: false,
          error: err?.message || 'Upstream stream resolver error',
          results: []
        })
      );
    }
    return true;
  }

  // 2. /api/stream-proxy — SSRF protected legacy stream proxy
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return true;
  }

  let controller: AbortController | undefined;

  try {
    const parsed = new URL(url, 'http://localhost:3000');
    const targetUrl = parsed.searchParams.get('url');

    if (!targetUrl) {
      res.statusCode = 400;
      res.end('Missing url parameter');
      return true;
    }

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

    const method: 'GET' | 'HEAD' = req.method === 'HEAD' ? 'HEAD' : 'GET';
    const result = await safeFetchStream(targetUrl, upstreamHeaders, controller.signal, method);

    const upstream = result.response;
    const status = upstream.statusCode || 502;
    const contentType = String(upstream.headers['content-type'] || '').toLowerCase();

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
      return true;
    }

    if (status < 200 || status >= 300) {
      for (const h of ['content-type', 'content-length', 'cache-control']) {
        const value = upstream.headers[h];
        if (value) res.setHeader(h, value);
      }
      await pipeline(upstream, res);
      return true;
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
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > MAX_MANIFEST_SIZE) {
          upstream.destroy();
          throw new Error('HLS manifest exceeds maximum size');
        }
        chunks.push(buffer);
      }

      const text = Buffer.concat(chunks).toString('utf8');
      if (text.includes('#EXTM3U')) {
        const rewritten = rewriteM3u8(text, result.finalUrl, ref, orig);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(rewritten);
        return true;
      }

      res.setHeader('Content-Type', 'video/mp2t');
      res.end(text);
      return true;
    }

    const passHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
    for (const h of passHeaders) {
      const value = upstream.headers[h];
      if (value) res.setHeader(h, value);
    }

    if (/\.ts(?:$|[?#])/i.test(result.finalUrl) || result.finalUrl.includes('/convert/')) {
      res.setHeader('Content-Type', 'video/mp2t');
    } else if (/\.mp4(?:$|[?#])/i.test(result.finalUrl)) {
      res.setHeader('Content-Type', 'video/mp4');
    }

    await pipeline(upstream, res);
  } catch (err: any) {
    if (res.headersSent) {
      res.destroy(err);
      return true;
    }

    if (err instanceof ProxySecurityError) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Upstream destination blocked by security policy' }));
      return true;
    }

    console.error('[TStream legacy proxy]', err.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Stream temporarily unavailable or offline' }));
  }

  return true;
}
