import { webcrypto } from 'node:crypto';

export interface DirectStream {
  quality: string;
  type: 'hls' | 'mp4' | 'dash';
  url: string;
  originalUrl?: string;
  server: string;
  headers?: Record<string, string>;
  subtitles?: Array<{ label: string; url: string; language?: string; type?: string }>;
}

export interface DirectStreamResult {
  provider: string;
  providerName: string;
  streams: DirectStream[];
  subtitles: Array<{ label: string; url: string; language?: string; type?: string }>;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export function sanitizeServerLabel(label: string): string {
  if (!label) return 'Spectra (1080p)';
  let s = label;
  s = s.replace(/api\.fmov\.my/gi, 'Spectra');
  s = s.replace(/fmov/gi, 'Solstice');
  s = s.replace(/showbox/gi, 'Solstice 4K');
  s = s.replace(/febbox/gi, 'Quantum');
  s = s.replace(/vidapi/gi, 'Sigma');
  s = s.replace(/vaplayer/gi, 'Sigma Core');
  s = s.replace(/vidlink/gi, 'Quantum');
  s = s.replace(/castletv/gi, 'Nimbus');
  s = s.replace(/4khdhub/gi, 'Cobalt 4K');
  s = s.replace(/streamflix/gi, 'Vortex');
  s = s.replace(/netmirror/gi, 'Mirage');
  s = s.replace(/dahmermovies/gi, 'Vertex');
  s = s.replace(/onetouchtv/gi, 'Helios');
  s = s.replace(/\[\s*\]/g, '').replace(/\s+/g, ' ').trim();
  return s;
}

// -------------------------------------------------------------
// 1. VidLink Direct Resolver
// -------------------------------------------------------------
export async function resolveVidLink(id: number | string, s?: number | null, e?: number | null): Promise<DirectStreamResult | null> {
  try {
    const isTv = s != null && e != null;
    const encRes = await fetch(`https://enc-dec.app/api/enc-vidlink?text=${id}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(7000)
    });
    const encData = await encRes.json();
    if (encData?.status !== 200 || !encData?.result) return null;

    const base = 'https://vidlink.pro';
    const targetUrl = isTv
      ? `${base}/api/b/tv/${encData.result}/${s}/${e || 1}`
      : `${base}/api/b/movie/${encData.result}`;

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Origin': base,
        'Referer': `${base}/`
      },
      signal: AbortSignal.timeout(9000)
    });

    const data = await res.json();
    const stream = data?.stream;
    if (!stream) return null;

    const streams: DirectStream[] = [];
    const subtitles: Array<{ label: string; url: string; language?: string; type?: string }> = [];

    // Subtitles
    if (Array.isArray(data.subtitles)) {
      for (const sub of data.subtitles) {
        if (sub?.url) {
          subtitles.push({
            label: sub.language || sub.label || 'Unknown',
            language: sub.language || 'en',
            url: sub.url,
            type: sub.type || 'srt'
          });
        }
      }
    }

    // Qualities (1080p, 720p, 480p, 360p MP4)
    if (stream.qualities && typeof stream.qualities === 'object') {
      const order = ['1080', '720', '480', '360'];
      for (const q of order) {
        const item = stream.qualities[q];
        if (item?.url) {
          streams.push({
            quality: `${q}p`,
            type: 'mp4',
            url: item.url,
            originalUrl: item.url,
            server: `Quantum · ${q}p`,
            headers: { 'User-Agent': USER_AGENT }
          });
        }
      }
    }

    // HLS playlist if present
    if (stream.playlist) {
      streams.unshift({
        quality: '1080p',
        type: 'hls',
        url: stream.playlist,
        originalUrl: stream.playlist,
        server: 'Quantum · HLS',
        headers: { 'User-Agent': USER_AGENT }
      });
    }

    if (!streams.length) return null;

    return {
      provider: 'vidlink',
      providerName: 'Quantum',
      streams,
      subtitles
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// 2. VidAPI Direct Resolver
// -------------------------------------------------------------
export async function resolveVidAPI(id: number | string, s?: number | null, e?: number | null): Promise<DirectStreamResult | null> {
  try {
    const isTv = s != null && e != null;
    const type = isTv ? 'tv' : 'movie';
    const apiUrl = `https://streamdata.vaplayer.ru/api.php?tmdb=${id}&type=${type}${isTv ? `&season=${s}&episode=${e}` : ''}`;

    const res = await fetch(apiUrl, {
      headers: {
        'Accept': '*/*',
        'Origin': 'https://nextgencloudfabric.com',
        'Referer': 'https://nextgencloudfabric.com/',
        'User-Agent': USER_AGENT
      },
      signal: AbortSignal.timeout(9000)
    });

    const data = await res.json();
    const rawUrls = data?.data?.stream_urls || [];
    if (!Array.isArray(rawUrls) || !rawUrls.length) return null;

    const subtitles: Array<{ label: string; url: string; language?: string; type?: string }> = [];
    const subs = data.subtitles || data.captions || data.data?.subtitles || [];
    if (Array.isArray(subs)) {
      for (const sub of subs) {
        const url = sub.url || sub.file || sub.src;
        if (url) {
          subtitles.push({
            label: sub.display || sub.label || sub.language || 'Unknown',
            language: sub.language || 'en',
            url,
            type: 'vtt'
          });
        }
      }
    }

    const streams: DirectStream[] = rawUrls.map((rawUrl: string, idx: number) => {
      const isM3u8 = rawUrl.includes('.m3u8');
      return {
        quality: idx === 0 ? 'Auto (1080p HLS)' : `Mirror ${idx + 1}`,
        type: isM3u8 ? 'hls' : 'mp4',
        url: rawUrl,
        originalUrl: rawUrl,
        server: idx === 0 ? 'Sigma · Primary' : `Sigma · Stream ${idx + 1}`,
        headers: {
          'Origin': 'https://nextgencloudfabric.com',
          'Referer': 'https://nextgencloudfabric.com/',
          'User-Agent': USER_AGENT
        }
      };
    });

    return {
      provider: 'vidapi',
      providerName: 'Sigma',
      streams,
      subtitles
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// 3. VidRock Direct Resolver (AES-GCM Decryption)
// -------------------------------------------------------------
const GCM_HEX_KEY = '7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f';
let vidrockCryptoKey: any = null;

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base64UrlToBytes(value: string) {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding === 2) base64 += '==';
  else if (padding === 3) base64 += '=';
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

async function decryptVidrockUrl(value: string): Promise<string | null> {
  try {
    const data = base64UrlToBytes(value);
    if (data.length < 28) return null;
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    if (!vidrockCryptoKey) {
      vidrockCryptoKey = await webcrypto.subtle.importKey(
        'raw',
        hexToBytes(GCM_HEX_KEY),
        'AES-GCM',
        false,
        ['decrypt']
      );
    }
    const decrypted = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, vidrockCryptoKey, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function resolveVidRock(id: number | string, s?: number | null, e?: number | null): Promise<DirectStreamResult | null> {
  try {
    const isTv = s != null && e != null;
    const path = isTv ? `tv/${id}/${s}/${e || 1}` : `movie/${id}`;
    const baseUrl = 'https://vidrock.net/';

    const res = await fetch(`${baseUrl}api/${path}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': baseUrl,
        'Origin': baseUrl
      },
      signal: AbortSignal.timeout(9000)
    });

    const data = await res.json();
    if (!data || typeof data !== 'object') return null;

    const streams: DirectStream[] = [];
    const proxyPrefix = 'https://proxy.vidrock.store/';

    for (const [providerName, info] of Object.entries(data) as any) {
      if (!info?.url) continue;
      const decrypted = await decryptVidrockUrl(info.url);
      if (!decrypted) continue;

      let cleanUrl = decrypted;
      if (cleanUrl.startsWith(proxyPrefix)) {
        cleanUrl = decodeURIComponent(cleanUrl.slice(proxyPrefix.length).replace(/^\/+/, ''));
      }

      const isXpass = cleanUrl.includes('xpass.top');
      streams.push({
        quality: `${providerName} (${info.type || 'HLS'})`,
        type: cleanUrl.includes('.m3u8') ? 'hls' : 'mp4',
        url: cleanUrl,
        originalUrl: cleanUrl,
        server: `Krypton · ${providerName}`,
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': isXpass ? 'https://play.xpass.top/' : baseUrl,
          'Origin': isXpass ? 'https://play.xpass.top' : baseUrl
        }
      });
    }

    if (!streams.length) return null;

    return {
      provider: 'vidrock',
      providerName: 'Krypton',
      streams,
      subtitles: []
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// 4. Showbox Quantum 4K Resolver (https://api.fmov.my showbox/febbox)
// -------------------------------------------------------------
export async function resolveShowbox(
  id: number | string,
  s?: number | null,
  e?: number | null
): Promise<DirectStreamResult | null> {
  try {
    const isTv = s != null && e != null;
    const baseUrl = 'https://api.fmov.my';
    const type = isTv ? 'series' : 'movie';
    const seasonQuery = isTv ? `?season=${s}&episode=${e || 1}` : '';
    const provUrl = `${baseUrl}/api/streams/showbox/${type}/${id}${seasonQuery}`;

    const res = await fetch(provUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rawStreams = Array.isArray(data?.streams) ? data.streams : [];
    if (!rawStreams.length) return null;

    const streams: DirectStream[] = [];
    const subtitles: Array<{ label: string; url: string; language?: string; type?: string }> = [];

    for (let i = 0; i < rawStreams.length; i++) {
      const st = rawStreams[i];
      if (!st?.url) continue;
      const isHls = (st.url.includes('.m3u8') || (st.quality && st.quality.toLowerCase().includes('hls')) || (st.name && st.name.toLowerCase().includes('hls')));
      const rawTitle = (st.title || st.name || '').toLowerCase();

      let qualityLabel = '1080p Full HD';
      const rawQ = (st.quality || '').toLowerCase();
      if (rawQ === 'org' || rawQ.includes('2160') || rawTitle.includes('2160p') || rawTitle.includes('4k')) {
        qualityLabel = '2160p 4K HDR';
      } else if (rawQ.includes('1080')) {
        qualityLabel = '1080p Full HD';
      } else if (rawQ.includes('720')) {
        qualityLabel = '720p HD';
      } else if (isHls) {
        qualityLabel = 'Adaptive HLS';
      }

      const clusterNum = i + 1;
      streams.push({
        quality: qualityLabel,
        type: isHls ? 'hls' : 'mp4',
        url: st.url,
        originalUrl: st.url,
        server: `Solstice · Node ${clusterNum}`,
        headers: st.headers || { 'User-Agent': USER_AGENT }
      });
    }

    if (!streams.length) return null;

    return {
      provider: 'showbox',
      providerName: 'Solstice',
      streams,
      subtitles
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// In-Memory Stream Resolution Cache (avoids 429 rate-limiting)
// -------------------------------------------------------------
const STREAM_CACHE = new Map<string, { timestamp: number; data: DirectStreamResult[] }>();
const CACHE_TTL_MS = 6 * 60 * 1000; // 6 minutes

export function clearStreamResolutionCache() {
  STREAM_CACHE.clear();
}

// -------------------------------------------------------------
// 5. FMov Multi-Source Direct Resolver (https://api.fmov.my)
// -------------------------------------------------------------
export async function resolveFmovMy(
  id: number | string,
  s?: number | null,
  e?: number | null
): Promise<DirectStreamResult | null> {
  try {
    const isTv = s != null && e != null;
    const baseUrl = 'https://api.fmov.my';
    const type = isTv ? 'series' : 'movie';
    const seasonQuery = isTv ? `?season=${s}&episode=${e || 1}` : '';

    // Query showbox + general endpoint only (avoids api.fmov.my 30 req/min rate limit)
    const fetchPromises = [
      (async () => {
        try {
          const provUrl = `${baseUrl}/api/streams/showbox/${type}/${id}${seasonQuery}`;
          const res = await fetch(provUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
          });
          if (!res.ok) return null;
          const data = await res.json();
          if (Array.isArray(data?.streams)) {
            return data.streams.map((st: any) => ({
              ...st,
              subProvider: 'showbox',
              sourceProvider: 'Showbox 4K'
            }));
          }
          return [];
        } catch {
          return null;
        }
      })(),
      (async () => {
        try {
          const generalUrl = `${baseUrl}/api/streams/${type}/${id}${seasonQuery}`;
          const res = await fetch(generalUrl, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
          });
          if (!res.ok) return null;
          const data = await res.json();
          return Array.isArray(data?.streams) ? data.streams : [];
        } catch {
          return null;
        }
      })()
    ];

    const settled = await Promise.allSettled(fetchPromises);
    const rawStreams: any[] = [];
    const seenUrls = new Set<string>();

    for (const item of settled) {
      if (item.status === 'fulfilled' && Array.isArray(item.value)) {
        for (const st of item.value) {
          if (st?.url && !seenUrls.has(st.url)) {
            seenUrls.add(st.url);
            rawStreams.push(st);
          }
        }
      }
    }

    if (!rawStreams.length) return null;

    const streams: DirectStream[] = [];
    const subtitles: Array<{ label: string; url: string; language?: string; type?: string }> = [];

    for (const st of rawStreams) {
      if (!st?.url) continue;

      // Skip castle source completely
      if (
        st.subProvider === 'castletv' ||
        st.url.toLowerCase().includes('castle') ||
        (st.provider && st.provider.toLowerCase().includes('castle')) ||
        (st.sourceProvider && st.sourceProvider.toLowerCase().includes('castle'))
      ) {
        continue;
      }

      const isHls = (st.url.includes('.m3u8') || (st.quality && st.quality.toLowerCase().includes('hls')) || (st.name && st.name.toLowerCase().includes('hls')));

      // Format provider label cleanly (especially Showbox)
      let providerLabel = st.sourceProvider || st.provider || 'Spectra';
      const pLower = providerLabel.toLowerCase();
      if (st.subProvider === 'showbox' || pLower.includes('febbox') || pLower.includes('showbox')) {
        providerLabel = 'Solstice';
      } else if (pLower === 'vaplayer') {
        providerLabel = 'Sigma';
      } else if (pLower === 'vidlink') {
        providerLabel = 'Quantum';
      } else if (pLower === 'streamflix') {
        providerLabel = 'Vortex';
      } else if (pLower === '4khdhub') {
        providerLabel = 'Cobalt';
      } else if (pLower === 'netmirror') {
        providerLabel = 'Mirage';
      }

      const rawTitle = (st.title || st.name || `${providerLabel} Stream`).replace(/[\r\n]+/g, ' · ').trim();
      const cleanTitle = sanitizeServerLabel(rawTitle);

      // Format display quality accurately
      const rawQ = (st.quality || '').trim().toLowerCase();
      let displayQuality = '1080p';
      if (rawQ === 'org' || rawQ.includes('2160') || cleanTitle.includes('2160p') || cleanTitle.includes('4k') || cleanTitle.includes('4K')) {
        displayQuality = '4K';
      } else if (rawQ.includes('1080')) {
        displayQuality = '1080p';
      } else if (rawQ.includes('720')) {
        displayQuality = '720p';
      } else if (rawQ.includes('480')) {
        displayQuality = '480p';
      } else if (isHls) {
        displayQuality = '1080p';
      }

      const clusterNum = rawStreams.indexOf(st) + 1;
      streams.push({
        quality: displayQuality,
        type: isHls ? 'hls' : 'mp4',
        url: st.url,
        originalUrl: st.url,
        server: `${providerLabel} · Node ${clusterNum}`,
        headers: st.headers || { 'User-Agent': USER_AGENT }
      });

      if (Array.isArray(st.subtitles)) {
        for (const sub of st.subtitles) {
          if (sub?.url && !subtitles.some(s => s.url === sub.url)) {
            subtitles.push({
              label: sub.label || sub.lang || 'Unknown',
              language: sub.lang || 'en',
              url: sub.url,
              type: sub.type || 'srt'
            });
          }
        }
      }
    }

    if (!streams.length) return null;

    // Prioritize 4K & top resolution streams at the top
    streams.sort((a, b) => {
      const aIs4k = (a.quality.includes('4K') || a.quality.includes('2160')) ? 1 : 0;
      const bIs4k = (b.quality.includes('4K') || b.quality.includes('2160')) ? 1 : 0;
      if (aIs4k !== bIs4k) return bIs4k - aIs4k;

      const aIs1080 = a.quality.includes('1080') ? 1 : 0;
      const bIs1080 = b.quality.includes('1080') ? 1 : 0;
      if (aIs1080 !== bIs1080) return bIs1080 - aIs1080;

      return 0;
    });

    return {
      provider: 'fmov',
      providerName: 'Spectra',
      streams,
      subtitles
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Combined Resolver: attempts all providers in order of speed
// -------------------------------------------------------------
export async function resolveAllDirectStreams(
  id: number | string,
  s?: number | null,
  e?: number | null,
  preferredProvider?: string
): Promise<DirectStreamResult[]> {
  const cacheKey = `${id}_${s || 0}_${e || 0}_${preferredProvider || 'all'}`;
  const cached = STREAM_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const tasks: Array<Promise<DirectStreamResult | null>> = [];

  // Query verified direct streams in priority order
  if (preferredProvider === 'showbox') {
    tasks.push(resolveShowbox(id, s, e), resolveVidAPI(id, s, e), resolveFmovMy(id, s, e), resolveVidLink(id, s, e), resolveVidRock(id, s, e));
  } else if (preferredProvider === 'vidapi' || preferredProvider === 'apollo') {
    tasks.push(resolveVidAPI(id, s, e), resolveShowbox(id, s, e), resolveFmovMy(id, s, e), resolveVidLink(id, s, e), resolveVidRock(id, s, e));
  } else if (preferredProvider === 'fmov') {
    tasks.push(resolveFmovMy(id, s, e), resolveShowbox(id, s, e), resolveVidAPI(id, s, e), resolveVidLink(id, s, e), resolveVidRock(id, s, e));
  } else if (preferredProvider === 'vidrock' || preferredProvider === 'titan') {
    tasks.push(resolveVidRock(id, s, e), resolveVidAPI(id, s, e), resolveShowbox(id, s, e), resolveFmovMy(id, s, e), resolveVidLink(id, s, e));
  } else if (preferredProvider === 'vidlink' || preferredProvider === 'hermes') {
    tasks.push(resolveVidLink(id, s, e), resolveVidAPI(id, s, e), resolveShowbox(id, s, e), resolveFmovMy(id, s, e), resolveVidRock(id, s, e));
  } else {
    // Fast balanced order: VidAPI (high-bandwidth direct HLS) + Showbox 4K + Fmov + VidLink + VidRock
    tasks.push(resolveVidAPI(id, s, e), resolveShowbox(id, s, e), resolveFmovMy(id, s, e), resolveVidLink(id, s, e), resolveVidRock(id, s, e));
  }

  const settled = await Promise.allSettled(tasks);
  const results: DirectStreamResult[] = [];

  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value && item.value.streams.length > 0) {
      results.push(item.value);
    }
  }

  if (results.length > 0) {
    STREAM_CACHE.set(cacheKey, { timestamp: Date.now(), data: results });
  }

  return results;
}
