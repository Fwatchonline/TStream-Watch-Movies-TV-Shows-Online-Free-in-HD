import { Hono } from 'hono';

export const subtitleProxyRoute = new Hono();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

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

  // Safety check on protocol
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return c.text('Invalid url protocol', 400);
  }

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/vtt,text/plain,*/*'
  };

  if (targetUrl.includes('vdrk.site')) {
    headers['Referer'] = 'https://sub.vdrk.site/';
    headers['Origin'] = 'https://sub.vdrk.site';
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers,
      signal: c.req.raw.signal
    });

    if (!upstreamRes.ok) {
      return c.text(`Upstream returned ${upstreamRes.status}`, upstreamRes.status as any);
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Multi-encoding detector: Try UTF-8 first, fallback to Windows-1250 (Latin-2) for Ex-Yu diacritics
    let decodedText: string;
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      decodedText = utf8Decoder.decode(buffer);
    } catch {
      // UTF-8 had invalid bytes; decode using windows-1250 which covers Serbian/Croatian/Bosnian č, ć, ž, š, đ
      try {
        const cp1250Decoder = new TextDecoder('windows-1250');
        decodedText = cp1250Decoder.decode(buffer);
      } catch {
        // Fallback to non-fatal utf-8
        decodedText = new TextDecoder('utf-8').decode(buffer);
      }
    }

    // Ensure WEBVTT format or return raw text
    c.header('Content-Type', 'text/vtt; charset=utf-8');
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Cache-Control', 'public, max-age=86400');
    return c.body(decodedText);
  } catch (err: any) {
    return c.text(`Subtitle fetch failed: ${err.message}`, 502);
  }
});
