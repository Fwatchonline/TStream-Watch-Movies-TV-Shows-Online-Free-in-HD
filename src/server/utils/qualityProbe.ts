import { StreamResult } from '../types';
import { USER_AGENT } from './helpers';
import { safeFetchStream } from './safeProxyFetch';

export function qualityRankScore(q?: string): number {
    const s = String(q || '').toLowerCase();
    if (!s) return 0;
    if (s.includes('2160') || s.includes('4k')) return 2160;
    if (s.includes('1440')) return 1440;
    if (s.includes('1080')) return 1080;
    if (s.includes('720')) return 720;
    if (s.includes('480')) return 480;
    if (s.includes('360')) return 360;
    return 100;
}

export function normalizeConcreteQuality(q?: string): string | null {
    const s = String(q || '').trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    // Skip vague/placeholder labels so we probe the actual master manifest when possible
    if (lower.includes('auto') || lower === 'hls' || lower === 'hd') {
        return null;
    }
    if (lower.includes('2160') || lower === '4k') return '4K';
    if (lower.includes('1440')) return '1440p';
    if (lower.includes('1080')) return '1080p';
    if (lower.includes('720')) return '720p';
    if (lower.includes('480')) return '480p';
    if (lower.includes('360')) return '360p';
    return null;
}

export function parseM3u8ResolutionLabel(manifestText: string): string | null {
    if (!manifestText || !manifestText.includes('#EXTM3U')) return null;

    let bestScore = 0;
    const resMatches = manifestText.matchAll(/RESOLUTION=(\d+)x(\d+)/gi);
    for (const m of resMatches) {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        let score = 0;
        if (w >= 3800 || h >= 2160) score = 2160;
        else if (w >= 2500 || h >= 1440) score = 1440;
        else if (w >= 1800 || h >= 1000) score = 1080;
        else if (w >= 1200 || h >= 680) score = 720;
        else if (w >= 800 || h >= 450) score = 480;
        else if (h > 0) score = h;
        if (score > bestScore) bestScore = score;
    }

    if (bestScore >= 2160) return '4K';
    if (bestScore >= 1440) return '1440p';
    if (bestScore >= 1000) return '1080p';
    if (bestScore >= 680) return '720p';
    if (bestScore >= 450) return '480p';
    if (bestScore > 0) return `${bestScore}p`;

    // Fallback: inspect NAME="1080p" / BANDWIDTH in EXT-X-STREAM-INF if RESOLUTION is omitted
    const nameMatches = manifestText.matchAll(/NAME=["']?(\d{3,4}p|4K|2160p|1080p|720p|480p|360p)["']?/gi);
    for (const m of nameMatches) {
        const q = m[1].toUpperCase() === '4K' ? 2160 : parseInt(m[1], 10) || 0;
        if (q > bestScore) bestScore = q;
    }
    if (bestScore >= 2160) return '4K';
    if (bestScore >= 1440) return '1440p';
    if (bestScore >= 1080) return '1080p';
    if (bestScore >= 720) return '720p';
    if (bestScore >= 480) return '480p';
    if (bestScore > 0) return `${bestScore}p`;

    return null;
}

function unwrapSourceRequest(sourceUrl: string): { targetUrl: string; headers: Record<string, string> } | null {
    try {
        const headers: Record<string, string> = {
            'User-Agent': USER_AGENT,
            Accept: '*/*',
            'Accept-Encoding': 'identity'
        };
        if (sourceUrl.startsWith('/api/proxy?')) {
            const parsed = new URL(sourceUrl, 'http://localhost');
            const targetUrl = parsed.searchParams.get('url');
            if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) return null;
            const ref = parsed.searchParams.get('referer');
            const orig = parsed.searchParams.get('origin');
            if (ref) headers.Referer = ref;
            if (orig) headers.Origin = orig;
            return { targetUrl, headers };
        }
        if (/^https?:\/\//i.test(sourceUrl)) {
            return { targetUrl: sourceUrl, headers };
        }
        return null;
    } catch {
        return null;
    }
}

export async function probeHlsManifestQuality(sourceUrl: string, timeoutMs = 1100): Promise<string | null> {
    const reqInfo = unwrapSourceRequest(sourceUrl);
    if (!reqInfo) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await safeFetchStream(reqInfo.targetUrl, reqInfo.headers, controller.signal, 'GET');
        const upstream = res.response;
        const status = upstream.statusCode || 502;
        if (status < 200 || status >= 300) {
            upstream.destroy();
            return null;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        const MAX_PROBE_BYTES = 32 * 1024;
        for await (const chunk of upstream) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buf.length;
            chunks.push(buf);
            if (bytes >= MAX_PROBE_BYTES) {
                upstream.destroy();
                break;
            }
        }
        const text = Buffer.concat(chunks).toString('utf8');
        return parseM3u8ResolutionLabel(text);
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export type StreamSourceItem = NonNullable<StreamResult['sources']>[number];

export async function enrichSourcesWithRealQuality(
    sources: StreamSourceItem[],
    options: { maxProbe?: number; timeoutMs?: number; probeFn?: (url: string, timeoutMs: number) => Promise<string | null> } = {}
): Promise<StreamSourceItem[]> {
    if (!Array.isArray(sources) || sources.length === 0) return [];
    const maxProbe = options.maxProbe ?? 2;
    const timeoutMs = options.timeoutMs ?? 1100;
    const probeFn = options.probeFn || probeHlsManifestQuality;

    const cloned = sources.map((s) => ({ ...s }));
    const indicesToProbe: number[] = [];

    for (let i = 0; i < cloned.length && indicesToProbe.length < maxProbe; i++) {
        const s = cloned[i];
        const concrete = normalizeConcreteQuality(s.quality);
        if (concrete) {
            s.quality = concrete;
            continue;
        }
        if (s.type === 'hls' || String(s.url).toLowerCase().includes('.m3u8') || String(s.url).toLowerCase().includes('playlist')) {
            indicesToProbe.push(i);
        } else if (!s.quality) {
            s.quality = s.type === 'mp4' ? '1080p' : 'HD';
        }
    }

    if (indicesToProbe.length > 0) {
        const probedResults = await Promise.all(
            indicesToProbe.map(async (idx) => {
                const detected = await probeFn(cloned[idx].url, timeoutMs).catch(() => null);
                return { idx, detected };
            })
        );

        let sharedDetected: string | null = null;
        for (const { idx, detected } of probedResults) {
            if (detected) {
                cloned[idx].quality = detected;
                if (!sharedDetected) sharedDetected = detected;
            }
        }

        // Normalize remaining unprobed sources cleanly
        for (const s of cloned) {
            const concrete = normalizeConcreteQuality(s.quality);
            if (concrete) {
                s.quality = concrete;
            } else if (!s.quality || s.quality.toLowerCase().includes('auto')) {
                s.quality = sharedDetected || '1080p';
            }
        }
    }

    return cloned;
}
