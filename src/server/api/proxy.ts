import { Hono } from 'hono';
import { USER_AGENT } from '../utils/helpers';

export const proxyRoute = new Hono();

const EMBED_ORIGIN = 'https://nextgencloudfabric.com';

function rewriteM3u8(body: string, originalUrl: string, extraParams = ''): string {
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#')) {
            const uriMatch = line.match(/(URI=")([^"]+)(")/);
            if (uriMatch) {
                try {
                    const absoluteUrl = new URL(uriMatch[2], originalUrl).href;
                    const proxyUrl = `/api/proxy?url=${encodeURIComponent(absoluteUrl)}${extraParams}`;
                    lines[i] = line.replace(uriMatch[0], `${uriMatch[1]}${proxyUrl}${uriMatch[3]}`);
                } catch {
                    // Ignore malformed URL
                }
            }
        } else {
            try {
                const absoluteUrl = new URL(line, originalUrl).href;
                lines[i] = `/api/proxy?url=${encodeURIComponent(absoluteUrl)}${extraParams}`;
            } catch {
                // Ignore malformed URL
            }
        }
    }
    return lines.join('\n');
}

proxyRoute.options('*', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', '*');
    return c.body(null, 204);
});

proxyRoute.all('*', async (c) => {
    c.header('Access-Control-Allow-Origin', '*');

    const url = c.req.query('url');
    if (!url) return c.json({ error: 'Missing url' }, 400);

    const queryReferer = c.req.query('referer');
    const queryOrigin = c.req.query('origin');

    let referer = queryReferer || `${EMBED_ORIGIN}/`;
    let origin = queryOrigin || EMBED_ORIGIN;

    if (url.includes('videodownloader.site') || queryReferer?.includes('videodownloader.site')) {
        referer = 'https://videodownloader.site/';
        origin = 'https://videodownloader.site';
    }

    const headers: Record<string, string> = {
        'User-Agent': USER_AGENT
    };

    if (referer) headers['Referer'] = referer;
    if (origin) headers['Origin'] = origin;

    const rangeHeader = c.req.header('range');
    if (rangeHeader) {
        headers['Range'] = rangeHeader;
    }

    let extraParams = '';
    if (queryReferer) extraParams += `&referer=${encodeURIComponent(queryReferer)}`;
    if (queryOrigin) extraParams += `&origin=${encodeURIComponent(queryOrigin)}`;
    if (c.req.query('va')) extraParams += `&va=1`;

    try {
        const response = await fetch(url, { headers, signal: c.req.raw.signal });

        if (!response.ok && response.status !== 206) {
            c.header('Access-Control-Allow-Origin', '*');
            return c.text('Upstream error', response.status as any);
        }

        const ct = (response.headers.get('content-type') || '').toLowerCase();

        if (response.status === 206) {
            c.status(206);
            const contentRange = response.headers.get('content-range');
            if (contentRange) c.header('Content-Range', contentRange);
        }
        const acceptRanges = response.headers.get('accept-ranges');
        if (acceptRanges) c.header('Accept-Ranges', acceptRanges);

        const isM3u8Url = url.includes('.m3u8') || ct.includes('mpegurl') || ct.includes('x-mpegurl');

        if (isM3u8Url) {
            const text = await response.text();
            if (text.includes('#EXTM3U')) {
                c.header('Content-Type', 'application/vnd.apple.mpegurl');
                c.header('Access-Control-Allow-Origin', '*');
                c.header('Cache-Control', 'no-cache');
                return c.body(rewriteM3u8(text, url, extraParams));
            }
            c.header('Content-Type', 'video/mp2t');
            c.header('Access-Control-Allow-Origin', '*');
            c.header('Cache-Control', 'public, max-age=86400');
            return c.body(text);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength) c.header('Content-Length', contentLength);

        // Detect MPEG-TS segments or MP4 stream
        const isTs = url.includes('.ts') || url.includes('/content/') || url.includes('page-');
        const safeCt = isTs ? 'video/mp2t' : ((!ct || ct.includes('html')) ? 'video/mp4' : ct);

        c.header('Content-Type', safeCt);
        c.header('Access-Control-Allow-Origin', '*');
        c.header('Cache-Control', 'public, max-age=86400');

        return c.body(response.body as any);
    } catch (e: any) {
        c.header('Access-Control-Allow-Origin', '*');
        return c.text(e.message, 502);
    }
});
