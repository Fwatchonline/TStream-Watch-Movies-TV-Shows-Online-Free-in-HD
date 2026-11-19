import { MediaItem } from '../types/media';

export type QualityTag = '4K' | '1440p' | '1080p' | '720p' | '480p' | '360p' | 'Unknown';

export interface QualityInfo {
  tag: QualityTag;
  label: string;
  fullLabel: string;
  resolution: string;
  badgeClass: string;
  is4K: boolean;
  is1080p: boolean;
  is720p: boolean;
  isCam: boolean;
  verified: boolean;
}

const verifiedQualityCache = new Map<string, QualityInfo>();

function unknownQualityInfo(): QualityInfo {
  return {
    tag: 'Unknown',
    label: 'Auto',
    fullLabel: 'Auto / Unverified',
    resolution: 'Pending stream check',
    badgeClass: 'border-white/20 text-zinc-300 bg-black/50',
    is4K: false,
    is1080p: false,
    is720p: false,
    isCam: false,
    verified: false
  };
}

export function buildVerifiedQualityInfo(width: number, height: number): QualityInfo {
  if (width <= 0 && height <= 0) {
    return unknownQualityInfo();
  }

  const resStr = width > 0 && height > 0 ? `${width} × ${height}` : `${height}p`;

  if (height >= 2000 || width >= 3600) {
    return {
      tag: '4K',
      label: '4K UHD',
      fullLabel: '4K Ultra HD (2160p)',
      resolution: resStr,
      badgeClass: 'border-[#F5C400]/70 text-[#F5C400] bg-[#F5C400]/10 font-black',
      is4K: true,
      is1080p: false,
      is720p: false,
      isCam: false,
      verified: true
    };
  }

  if (height >= 1400 || width >= 2500) {
    return {
      tag: '1440p',
      label: '1440p QHD',
      fullLabel: '1440p Quad HD',
      resolution: resStr,
      badgeClass: 'border-cyan-400/60 text-cyan-300 bg-cyan-950/50 font-bold',
      is4K: false,
      is1080p: false,
      is720p: false,
      isCam: false,
      verified: true
    };
  }

  if (height >= 900 || width >= 1600) {
    return {
      tag: '1080p',
      label: '1080p',
      fullLabel: '1080p Full HD',
      resolution: resStr,
      badgeClass: 'border-sky-400/50 text-sky-300 bg-sky-950/40 font-bold',
      is4K: false,
      is1080p: true,
      is720p: false,
      isCam: false,
      verified: true
    };
  }

  if (height >= 600 || width >= 1000) {
    return {
      tag: '720p',
      label: '720p',
      fullLabel: '720p HD',
      resolution: resStr,
      badgeClass: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/40 font-semibold',
      is4K: false,
      is1080p: false,
      is720p: true,
      isCam: false,
      verified: true
    };
  }

  if (height >= 420) {
    return {
      tag: '480p',
      label: '480p',
      fullLabel: '480p SD',
      resolution: resStr,
      badgeClass: 'border-amber-400/50 text-amber-300 bg-amber-950/40 font-semibold',
      is4K: false,
      is1080p: false,
      is720p: false,
      isCam: false,
      verified: true
    };
  }

  return {
    tag: '360p',
    label: `${height || 360}p`,
    fullLabel: `${height || 360}p SD`,
    resolution: resStr,
    badgeClass: 'border-zinc-500/50 text-zinc-300 bg-zinc-900/60 font-semibold',
    is4K: false,
    is1080p: false,
    is720p: false,
    isCam: false,
    verified: true
  };
}

export function parseQualityFromLabel(label?: string | null): QualityInfo | null {
  const s = String(label || '').trim().toLowerCase();
  if (!s || s === 'auto' || s === 'hls' || s === 'unknown') return null;
  if (s.includes('4k') || s.includes('2160')) return buildVerifiedQualityInfo(3840, 2160);
  if (s.includes('1440')) return buildVerifiedQualityInfo(2560, 1440);
  if (s.includes('1080')) return buildVerifiedQualityInfo(1920, 1080);
  if (s.includes('720')) return buildVerifiedQualityInfo(1280, 720);
  if (s.includes('480')) return buildVerifiedQualityInfo(854, 480);
  if (s.includes('360')) return buildVerifiedQualityInfo(640, 360);
  return null;
}

export function cacheVerifiedStreamQuality(cacheKey: string, quality: QualityInfo): void {
  if (!cacheKey || !quality.verified) return;
  if (verifiedQualityCache.size > 300) {
    const oldest = verifiedQualityCache.keys().next().value;
    if (oldest) verifiedQualityCache.delete(oldest);
  }
  verifiedQualityCache.set(cacheKey, quality);
}

export function getCachedVerifiedStreamQuality(cacheKey?: string): QualityInfo | null {
  if (!cacheKey) return null;
  return verifiedQualityCache.get(cacheKey) || null;
}

/**
 * Honest media quality lookup:
 * NEVER fabricates 4K, 1080p, 720p, or CAM from release date, popularity, or vote counts.
 * Returns verified stream resolution when previously measured for the item/key, otherwise Unknown.
 */
export function getMediaQuality(
  item?: Partial<MediaItem> | null,
  verifiedLabelOrCacheKey?: string
): QualityInfo {
  if (verifiedLabelOrCacheKey) {
    const parsed = parseQualityFromLabel(verifiedLabelOrCacheKey);
    if (parsed) return parsed;
    const cached = getCachedVerifiedStreamQuality(verifiedLabelOrCacheKey);
    if (cached) return cached;
  }

  if (item && (item.id || item.tmdbId || item.anilistId)) {
    const type = item.mediaType || 'movie';
    const pid = item.mediaType === 'anime' ? (item.anilistId || item.id) : (item.tmdbId || item.id);
    const cached = getCachedVerifiedStreamQuality(`${type}_${pid}`);
    if (cached) return cached;
  }

  return unknownQualityInfo();
}

/**
 * Live-detect genuine stream resolution from video element videoWidth/videoHeight or HLS level dimensions.
 */
export function detectStreamQualityFromDimensions(
  width: number,
  height: number,
  fallbackItemOrKey?: Partial<MediaItem> | string | null
): QualityInfo {
  if (width <= 0 && height <= 0) {
    if (typeof fallbackItemOrKey === 'string') {
      return getMediaQuality(null, fallbackItemOrKey);
    }
    return getMediaQuality(fallbackItemOrKey);
  }

  const info = buildVerifiedQualityInfo(width, height);
  if (typeof fallbackItemOrKey === 'string') {
    cacheVerifiedStreamQuality(fallbackItemOrKey, info);
  } else if (fallbackItemOrKey && (fallbackItemOrKey.id || fallbackItemOrKey.tmdbId || fallbackItemOrKey.anilistId)) {
    const type = fallbackItemOrKey.mediaType || 'movie';
    const pid =
      fallbackItemOrKey.mediaType === 'anime'
        ? (fallbackItemOrKey.anilistId || fallbackItemOrKey.id)
        : (fallbackItemOrKey.tmdbId || fallbackItemOrKey.id);
    cacheVerifiedStreamQuality(`${type}_${pid}`, info);
  }

  return info;
}
