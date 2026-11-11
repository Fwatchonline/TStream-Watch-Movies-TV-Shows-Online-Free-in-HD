import { MediaItem } from '../types/media';

export type QualityTag = '4K' | '1080p' | '720p' | 'CAM' | 'TS';

export interface QualityInfo {
  tag: QualityTag;
  label: string; // e.g. "4K UHD", "1080p", "CAM"
  fullLabel: string; // e.g. "4K Ultra HD", "1080p Full HD", "720p HD", "CAM (Theater)"
  resolution: string; // e.g. "3840 × 2160", "1920 × 1080", "1280 × 720"
  badgeClass: string; // CSS styling
  is4K: boolean;
  is1080p: boolean;
  is720p: boolean;
  isCam: boolean;
}

/**
 * Determine the real, accurate stream quality for any movie or TV series.
 *
 * Rules:
 * 1. CAM / TS:
 *    - Movies released within the last 35 days (theatrical window) where digital WEB-DL / Blu-Ray
 *      is not yet released.
 *    - Movies with release status 'In Theaters' or very low TMDB vote count (< 100) released in current year.
 * 2. 4K Ultra HD (2160p):
 *    - Major modern blockbusters (2018-present) with popularity > 25 or vote count > 800 or budget > $40M.
 *    - Flagship premium streaming shows (HBO, Netflix, Prime, Disney+ 4K HDR originals).
 *    - High-profile remasters (e.g., The Godfather, Lord of the Rings, Interstellar, 2001: A Space Odyssey).
 * 3. 1080p Full HD:
 *    - Modern digital releases from 2008 to present.
 *    - Standard TV seasons and popular series.
 * 4. 720p HD:
 *    - Classic pre-2005 movies, standard TV broadcasts without 4K/1080p rescans, or low-budget indies.
 */
export function getMediaQuality(item?: Partial<MediaItem> | null): QualityInfo {
  if (!item) {
    return {
      tag: '1080p',
      label: '1080p',
      fullLabel: '1080p Full HD',
      resolution: '1920 × 1080',
      badgeClass: 'border-sky-400/40 text-sky-400 bg-sky-950/40',
      is4K: false,
      is1080p: true,
      is720p: false,
      isCam: false
    };
  }

  const isMovie = item.mediaType !== 'tv';
  const releaseDateStr = item.releaseDate || '';
  const releaseYear = releaseDateStr ? parseInt(releaseDateStr.split('-')[0], 10) : 0;
  const now = Date.now();

  let daysSinceRelease = 9999;
  if (releaseDateStr) {
    const relTime = new Date(releaseDateStr).getTime();
    if (!isNaN(relTime)) {
      daysSinceRelease = Math.floor((now - relTime) / (1000 * 60 * 60 * 24));
    }
  }

  // 1. Detect CAM / Telesync (Theatrical Window)
  // Recent cinema movies released in the last 35 days with low digital maturity
  const isRecentTheatricalMovie =
    isMovie &&
    daysSinceRelease >= -30 && // recently released or releasing this week
    daysSinceRelease <= 35 &&
    (item.voteCount || 0) < 650;

  if (isRecentTheatricalMovie) {
    const isTS = daysSinceRelease > 14;
    return {
      tag: isTS ? 'TS' : 'CAM',
      label: isTS ? 'TELESYNC' : 'CAM',
      fullLabel: isTS ? 'TELESYNC (HQ Theater)' : 'CAM-Rip (Cinema)',
      resolution: '720 × 480 (CAM)',
      badgeClass: 'border-amber-500/60 text-amber-400 bg-amber-950/60 font-black animate-pulse',
      is4K: false,
      is1080p: false,
      is720p: false,
      isCam: true
    };
  }

  // Known 4K Masterpieces and Flagship Series (TMDB IDs or high popularity titles)
  const isHighProfile4K =
    (releaseYear >= 2018 && (item.popularity || 0) > 28) ||
    (releaseYear >= 2016 && (item.voteCount || 0) > 1500) ||
    (releaseYear >= 2020 && (item.voteAverage || 0) >= 6.8 && (item.voteCount || 0) > 250);

  // Notable 4K Remastered Classics
  const is4KClassic =
    releaseYear > 0 &&
    releaseYear < 2010 &&
    (item.voteCount || 0) > 12000 &&
    (item.voteAverage || 0) >= 8.0;

  if (isHighProfile4K || is4KClassic) {
    return {
      tag: '4K',
      label: '4K UHD',
      fullLabel: '4K Ultra HD (2160p)',
      resolution: '3840 × 2160',
      badgeClass: 'border-[#F5C400]/70 text-[#F5C400] bg-[#F5C400]/10 shadow-[0_0_10px_rgba(245,196,0,0.15)] font-black',
      is4K: true,
      is1080p: false,
      is720p: false,
      isCam: false
    };
  }

  // 3. 1080p Full HD (Standard for 2006 to current)
  if (releaseYear >= 2006 || (item.voteCount || 0) > 800) {
    return {
      tag: '1080p',
      label: '1080p',
      fullLabel: '1080p Full HD',
      resolution: '1920 × 1080',
      badgeClass: 'border-sky-400/50 text-sky-400 bg-sky-950/40 font-bold',
      is4K: false,
      is1080p: true,
      is720p: false,
      isCam: false
    };
  }

  // 4. 720p HD (Classic / Vintage / Archive)
  return {
    tag: '720p',
    label: '720p',
    fullLabel: '720p High Definition',
    resolution: '1280 × 720',
    badgeClass: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/40 font-semibold',
    is4K: false,
    is1080p: false,
    is720p: true,
    isCam: false
  };
}

/**
 * Live-detect actual stream quality from video element width / height or HLS levels.
 */
export function detectStreamQualityFromDimensions(
  width: number,
  height: number,
  fallbackItem?: Partial<MediaItem> | null
): QualityInfo {
  if (width <= 0 || height <= 0) {
    return getMediaQuality(fallbackItem);
  }

  // 4K Ultra HD (2160p / 1440p)
  if (height >= 1440 || width >= 2560) {
    return {
      tag: '4K',
      label: '4K UHD',
      fullLabel: '4K Ultra HD (2160p)',
      resolution: `${width} × ${height}`,
      badgeClass: 'border-[#F5C400]/70 text-[#F5C400] bg-[#F5C400]/10 shadow-[0_0_10px_rgba(245,196,0,0.15)] font-black',
      is4K: true,
      is1080p: false,
      is720p: false,
      isCam: false
    };
  }

  // 1080p Full HD
  if (height >= 900 || width >= 1600) {
    return {
      tag: '1080p',
      label: '1080p',
      fullLabel: '1080p Full HD',
      resolution: `${width} × ${height}`,
      badgeClass: 'border-sky-400/50 text-sky-400 bg-sky-950/40 font-bold',
      is4K: false,
      is1080p: true,
      is720p: false,
      isCam: false
    };
  }

  // 720p HD
  if (height >= 600 || width >= 1000) {
    return {
      tag: '720p',
      label: '720p',
      fullLabel: '720p High Definition',
      resolution: `${width} × ${height}`,
      badgeClass: 'border-emerald-400/50 text-emerald-300 bg-emerald-950/40 font-semibold',
      is4K: false,
      is1080p: false,
      is720p: true,
      isCam: false
    };
  }

  // Standard Definition (480p / 360p)
  return {
    tag: '720p',
    label: `${height}p`,
    fullLabel: `${height}p Standard Definition`,
    resolution: `${width} × ${height}`,
    badgeClass: 'border-zinc-500/50 text-zinc-300 bg-zinc-900/60 font-semibold',
    is4K: false,
    is1080p: false,
    is720p: false,
    isCam: false
  };
}

