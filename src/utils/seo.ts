/**
 * Professional Google SEO, OpenGraph, Twitter/X cards, Dynamic Keywords,
 * Canonical & Query Parameter Policy, and JSON-LD Schema.org Generator for TStream.online
 */

import { createMediaSlug } from './slug.ts';
import { tagToSlug } from './tags.ts';
import { slugToGenre } from './genres.ts';
import { PLATFORM_ALIASES } from '../services/platformConfig.ts';

export interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string[] | string;
  image?: string;
  url?: string;
  type?: 'website' | 'video.movie' | 'video.tv_show';
  noindex?: boolean;
  schema?: Record<string, any>;
}

export interface QueryCanonicalPolicy {
  canonicalUrl: string;
  noindex: boolean;
  reason?: string;
  page?: number;
  isInvalidPage?: boolean;
}

export const PRIMARY_ORIGIN = 'https://tstream.online';
export const DEFAULT_TITLE = 'T Stream — Watch Movies & TV Shows Online Free in HD';
export const DEFAULT_DESC =
  'Stream thousands of trending movies and TV series in 4K UHD and 1080p Full HD on T Stream. Fast multi-server playback, multilingual subtitles, and zero ads.';
export const DEFAULT_IMAGE = 'https://tstream.online/og-image.png';
export const DEFAULT_KEYWORDS =
  't stream, watch movies online, watch series online, free streaming, hd movies, 4k streaming, english subtitles, croatian subtitles, cinema stream';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'yclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
  'source',
  'session',
  'sid',
  '_ga',
  '_gl'
]);

const FILTER_PARAMS = new Set([
  'sortby',
  'year',
  'minrating',
  'country',
  'genreid',
  'genre',
  'filter',
  'mediatype',
  'platform',
  'letter',
  'tag',
  'watchregion',
  'region'
]);

const PAGINATED_INDEXABLE_PREFIXES = [
  '/movies',
  '/tv-shows',
  '/trending',
  '/top-rated',
  '/tags/',
  '/genre/',
  '/platform/'
];

/**
 * Normalizes, trims, and deduplicates keywords.
 * Limits the final list to at most 15 relevant unique items.
 */
export function normalizeKeywords(keywords: string[] | string | undefined): string {
  if (!keywords) return '';
  const list = Array.isArray(keywords)
    ? keywords
    : keywords.split(',').map(k => k.trim());

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of list) {
    const clean = item.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      normalized.push(clean);
    }
    if (normalized.length >= 15) break;
  }

  return normalized.join(', ');
}

/**
 * Generates dynamic, highly-relevant keywords from real TMDB media data.
 */
export function generateMediaKeywords(
  media: any,
  options: { season?: number; episode?: number; episodeName?: string; isWatching?: boolean } = {}
): string {
  if (!media) return DEFAULT_KEYWORDS;
  const isMovie = media.mediaType === 'movie';
  const rawTitle = (media.title || media.name || '').trim();
  if (!rawTitle) return DEFAULT_KEYWORDS;

  const year = media.releaseDate
    ? new Date(media.releaseDate).getFullYear()
    : media.firstAirDate
    ? new Date(media.firstAirDate).getFullYear()
    : '';

  const rawGenres: string[] = (media.genres || [])
    .map((g: any) => (typeof g === 'string' ? g : g?.name || ''))
    .filter((g: string) => Boolean(g && g.trim()));

  const keywords: string[] = [];

  keywords.push(rawTitle);

  if (year && !isNaN(Number(year))) {
    keywords.push(`${rawTitle} (${year})`);
  }

  if (isMovie) {
    keywords.push(`${rawTitle} movie`);
  } else {
    keywords.push(`${rawTitle} TV series`);
  }

  if (year && !isNaN(Number(year))) {
    keywords.push(`${rawTitle} (${year}) watch online`);
  }
  keywords.push(`watch ${rawTitle} online`);

  for (const g of rawGenres) {
    keywords.push(g);
  }

  for (const g of rawGenres) {
    if (isMovie) {
      keywords.push(`${g} movie`);
    } else {
      keywords.push(`${g} TV series`);
    }
  }

  keywords.push('T Stream');

  if (!isMovie && options.season) {
    keywords.push(`${rawTitle} season ${options.season}`);
    if (options.episode) {
      keywords.push(`${rawTitle} season ${options.season} episode ${options.episode}`);
      if (options.episodeName && !/^episode\s+\d+$/i.test(options.episodeName.trim())) {
        keywords.push(`${rawTitle} ${options.episodeName.trim()}`);
      }
    }
  }

  return normalizeKeywords(keywords);
}

/**
 * Word-aware truncation to approximately maxLength characters (~160).
 * Never chops words in half; safely adds ellipsis.
 */
export function truncateAtWord(text: string, maxLength: number = 160): string {
  if (!text) return '';
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) return trimmed;
  const target = Math.max(maxLength - 3, 20);
  const sub = trimmed.slice(0, target);
  const lastSpace = sub.lastIndexOf(' ');
  if (lastSpace > 30) {
    return sub.slice(0, lastSpace).trim() + '...';
  }
  return sub.trim() + '...';
}

/**
 * Determines image MIME type from URL extension.
 */
export function getImageMimeType(url: string): string {
  if (!url) return 'image/jpeg';
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

/**
 * Explicit Canonical & Query Parameter Policy:
 * - Always HTTPS, non-WWW: https://tstream.online
 * - Strips tracking/session query parameters (?utm_*, ?fbclid, ?ref, ?session)
 * - Strips trailing slashes (except root '/')
 * - Normalizes platform alias routes (e.g., /platform/hbo -> /platform/max) with noindex
 * - Strips ?page=1 cleanly
 * - Preserves ?page=N (when N > 1) strictly on indexable paginated routes with no other params
 * - Marks search, filter combinations, invalid pagination, and unknown query params as noindex
 */
export function resolveRouteSeoPolicy(pathOrUrl?: string): QueryCanonicalPolicy {
  try {
    let rawPath = '/';
    let rawSearch = '';

    if (pathOrUrl) {
      if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
        const parsed = new URL(pathOrUrl);
        rawPath = parsed.pathname;
        rawSearch = parsed.search;
      } else {
        const noHash = pathOrUrl.split('#')[0];
        const qIndex = noHash.indexOf('?');
        if (qIndex !== -1) {
          rawPath = noHash.slice(0, qIndex);
          rawSearch = noHash.slice(qIndex);
        } else {
          rawPath = noHash;
        }
      }
    } else if (typeof window !== 'undefined') {
      rawPath = window.location.pathname;
      rawSearch = window.location.search;
    }

    if (!rawPath.startsWith('/')) rawPath = '/' + rawPath;
    if (rawPath.length > 1 && rawPath.endsWith('/')) {
      rawPath = rawPath.slice(0, -1);
    }

    // Platform alias handling (/platform/hbo -> /platform/max)
    let isPlatformAlias = false;
    if (rawPath.startsWith('/platform/')) {
      const platSeg = rawPath.slice('/platform/'.length).split('/')[0].toLowerCase();
      if (platSeg && PLATFORM_ALIASES[platSeg]) {
        rawPath = `/platform/${PLATFORM_ALIASES[platSeg]}`;
        isPlatformAlias = true;
      }
    }

    // Canonicalize legacy /tag/* and non-kebab /tags/* paths (e.g. /tags/time%20travel -> /tags/time-travel)
    let isLegacyTagAlias = false;
    if (rawPath.startsWith('/tag/') || rawPath.startsWith('/tags/')) {
      const isSingularPrefix = rawPath.startsWith('/tag/');
      const prefix = isSingularPrefix ? '/tag/' : '/tags/';
      const rest = rawPath.slice(prefix.length);
      if (rest && !rest.includes('/')) {
        const canonicalSlug = tagToSlug(rest);
        if (canonicalSlug) {
          const targetPath = `/tags/${canonicalSlug}`;
          if (isSingularPrefix || rawPath !== targetPath) {
            isLegacyTagAlias = true;
          }
          rawPath = targetPath;
        }
      }
    }

    // Canonicalize genre slug aliases (e.g. /genre/sci-fi -> /genre/science-fiction)
    let isGenreAlias = false;
    if (rawPath.startsWith('/genre/')) {
      const rest = rawPath.slice('/genre/'.length);
      if (rest && !rest.includes('/')) {
        const genre = slugToGenre(rest);
        if (genre) {
          const targetPath = `/genre/${genre.slug}`;
          if (rawPath !== targetPath) {
            isGenreAlias = true;
          }
          rawPath = targetPath;
        }
      }
    }

    // Watch movie canonical points to /movie/:slug
    if (rawPath.startsWith('/watch/movie/')) {
      const rest = rawPath.slice('/watch/movie/'.length);
      if (rest && !rest.includes('/')) {
        rawPath = `/movie/${rest}`;
      }
    }

    const params = new URLSearchParams(rawSearch);
    // Strip tracking/session parameters
    for (const key of Array.from(params.keys())) {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
        params.delete(key);
      }
    }

    // Search pages: always noindex
    if (rawPath === '/search' || params.has('q')) {
      return {
        canonicalUrl: `${PRIMARY_ORIGIN}/search`,
        noindex: true,
        reason: 'search_page',
        page: 1
      };
    }

    if (isPlatformAlias || isLegacyTagAlias || isGenreAlias) {
      return {
        canonicalUrl: `${PRIMARY_ORIGIN}${rawPath}`,
        noindex: true,
        reason: isPlatformAlias
          ? 'platform_alias'
          : isLegacyTagAlias
          ? 'tag_alias'
          : 'genre_alias',
        page: 1
      };
    }

    // Detect filter and unknown query parameters
    let hasFilterParams = false;
    let hasUnknownParams = false;
    for (const key of Array.from(params.keys())) {
      const lower = key.toLowerCase();
      if (lower === 'page') continue;
      if (FILTER_PARAMS.has(lower)) {
        hasFilterParams = true;
      } else {
        hasUnknownParams = true;
      }
    }

    // Strict integer page validation
    const hasPageParam = params.has('page');
    const pageRaw = params.get('page');
    const isStrictInt = Boolean(pageRaw && /^\d+$/.test(pageRaw.trim()));
    const parsedPage = isStrictInt ? parseInt(pageRaw!.trim(), 10) : 1;
    const isInvalidPage = hasPageParam && (!isStrictInt || parsedPage < 1 || parsedPage > 500);

    if (hasFilterParams || hasUnknownParams) {
      return {
        canonicalUrl: `${PRIMARY_ORIGIN}${rawPath}`,
        noindex: true,
        reason: hasFilterParams ? 'filtered_catalog_view' : 'unknown_query_param',
        page: isInvalidPage ? 1 : parsedPage,
        isInvalidPage
      };
    }

    if (isInvalidPage) {
      return {
        canonicalUrl: `${PRIMARY_ORIGIN}${rawPath}`,
        noindex: true,
        reason: 'invalid_page',
        page: 1,
        isInvalidPage: true
      };
    }

    const isPaginatedIndexable = PAGINATED_INDEXABLE_PREFIXES.some(
      p => rawPath === p || (p.endsWith('/') && rawPath.startsWith(p))
    );

    if (parsedPage > 1) {
      if (isPaginatedIndexable) {
        return {
          canonicalUrl: `${PRIMARY_ORIGIN}${rawPath}?page=${parsedPage}`,
          noindex: false,
          page: parsedPage
        };
      }
      return {
        canonicalUrl: `${PRIMARY_ORIGIN}${rawPath}`,
        noindex: true,
        reason: 'unsupported_pagination',
        page: parsedPage,
        isInvalidPage: true
      };
    }

    return {
      canonicalUrl: `${PRIMARY_ORIGIN}${rawPath}`,
      noindex: false,
      page: 1
    };
  } catch {
    return {
      canonicalUrl: `${PRIMARY_ORIGIN}/`,
      noindex: false,
      page: 1
    };
  }
}

/**
 * Clean & normalize canonical URLs according to Google Search Central guidelines.
 */
export function buildCanonicalUrl(pathOrUrl?: string): string {
  return resolveRouteSeoPolicy(pathOrUrl).canonicalUrl;
}

export interface MediaMetadataResult {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  image: string;
  mimeType: string;
  isDefaultOgImage: boolean;
  type: 'video.movie' | 'video.tv_show';
  schema: Record<string, any>;
  rawTitle: string;
}

export interface EpisodeSeoValidationOptions {
  seriesId?: number;
  episodeId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  seasonEpisodeCount?: number;
  numberOfSeasons?: number;
  episodeName?: string;
  episodeOverview?: string;
  seriesOverview?: string;
  seasonOverview?: string;
  isVerifiedEpisode?: boolean;
}

/**
 * Checks whether an episode title is a genuine title rather than a generic placeholder.
 */
export function isGenuineEpisodeName(name?: string): boolean {
  const trimmed = (name || '').trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (/^(?:episode|ep\.?)\s*\d+$/i.test(trimmed)) return false;
  if (/^season\s*\d+\s*(?:episode|ep\.?)\s*\d+$/i.test(trimmed)) return false;
  if (/^(?:tba|tbd|untitled|n\/a)$/i.test(trimmed)) return false;
  return true;
}

/**
 * Determines whether a TV episode watch route has genuine, verified episode metadata
 * worthy of search indexing (never copies show/season overview or fabricated/generic titles).
 */
export function isEpisodeSeoIndexable(options: EpisodeSeoValidationOptions): boolean {
  if (options.isVerifiedEpisode !== true) return false;

  if (options.seriesId !== undefined && (!Number.isInteger(options.seriesId) || options.seriesId <= 0)) {
    return false;
  }
  if (options.episodeId !== undefined && (!Number.isInteger(options.episodeId) || options.episodeId <= 0)) {
    return false;
  }

  if (options.seasonNumber !== undefined) {
    if (!Number.isInteger(options.seasonNumber) || options.seasonNumber < 1) return false;
    if (
      options.numberOfSeasons !== undefined &&
      options.numberOfSeasons > 0 &&
      options.seasonNumber > options.numberOfSeasons
    ) {
      return false;
    }
  }

  if (options.episodeNumber !== undefined) {
    if (!Number.isInteger(options.episodeNumber) || options.episodeNumber < 1) return false;
    if (
      options.seasonEpisodeCount !== undefined &&
      options.seasonEpisodeCount > 0 &&
      options.episodeNumber > options.seasonEpisodeCount
    ) {
      return false;
    }
  }

  if (!isGenuineEpisodeName(options.episodeName)) return false;

  const epOverview = (options.episodeOverview || '').trim();
  const showOverview = (options.seriesOverview || '').trim();
  const seasonOverview = (options.seasonOverview || '').trim();
  if (!epOverview || epOverview.length < 15) return false;
  if (showOverview && epOverview.toLowerCase() === showOverview.toLowerCase()) return false;
  if (seasonOverview && epOverview.toLowerCase() === seasonOverview.toLowerCase()) return false;
  return true;
}

/**
 * Validates a structured local or fetched episode record against its parent TV show and season.
 */
export function validateVerifiedEpisodeRecord(params: {
  show: any;
  season: any;
  episode: any;
}): boolean {
  const { show, season, episode } = params || {};
  if (!show || !season || !episode) return false;

  const showId = Number(show.id || show.tmdbId);
  const seasonNum = Number(season.seasonNumber);
  const epNum = Number(episode.episodeNumber);
  const epId = Number(episode.id);

  if (!Number.isInteger(showId) || showId <= 0) return false;
  if (!Number.isInteger(seasonNum) || seasonNum < 1) return false;
  if (!Number.isInteger(epNum) || epNum < 1) return false;
  if (!Number.isInteger(epId) || epId <= 0) return false;

  if (episode.showId !== undefined && Number(episode.showId) !== showId) return false;
  if (episode.seasonNumber !== undefined && Number(episode.seasonNumber) !== seasonNum) return false;

  return isEpisodeSeoIndexable({
    seriesId: showId,
    episodeId: epId,
    seasonNumber: seasonNum,
    episodeNumber: epNum,
    seasonEpisodeCount: Number(season.episodeCount || 0) || undefined,
    numberOfSeasons: Number(show.numberOfSeasons || 0) || undefined,
    episodeName: episode.name,
    episodeOverview: episode.overview,
    seriesOverview: show.overview,
    seasonOverview: season.overview,
    isVerifiedEpisode: true
  });
}

/**
 * Pure generator for Media SEO metadata shared between client & server.
 * Guarantees 100% identical titles, descriptions, keywords, canonical URLs, and structured data.
 */
export function buildMediaMetadata(
  media: any,
  options: {
    season?: number;
    episode?: number;
    episodeName?: string;
    episodeOverview?: string;
    episodeAirDate?: string;
    episodeVoteAverage?: number;
    episodeVoteCount?: number;
    isWatching?: boolean;
  } = {}
): MediaMetadataResult {
  const isMovie = media?.mediaType === 'movie';
  const rawTitle = (media?.title || media?.name || 'Untitled').trim();
  const year = media?.releaseDate
    ? new Date(media.releaseDate).getFullYear()
    : media?.firstAirDate
    ? new Date(media.firstAirDate).getFullYear()
    : '';
  const yearStr = year && !isNaN(Number(year)) ? ` (${year})` : '';

  const isDistinctEpisode = !isMovie && Boolean(options.isWatching && options.season && options.episode);

  let title = '';
  if (options.isWatching) {
    if (isMovie) {
      title = `Watch ${rawTitle}${yearStr} Full Movie Free Online in HD — T Stream`;
    } else {
      const epSuffix = isGenuineEpisodeName(options.episodeName)
        ? ` "${options.episodeName!.trim()}"`
        : '';
      title = `Watch ${rawTitle} Season ${options.season || 1} Episode ${options.episode || 1}${epSuffix} Free HD — T Stream`;
    }
  } else {
    if (isMovie) {
      title = `${rawTitle}${yearStr} — Watch Free HD Movie — T Stream`;
    } else {
      title = `${rawTitle}${yearStr} — Watch Free HD TV Show — T Stream`;
    }
  }

  const trimmedEpOverview = (options.episodeOverview || '').trim();
  const trimmedShowOverview = (media?.overview || '').trim();
  const hasUniqueEpisodeOverview = Boolean(
    trimmedEpOverview &&
      (!trimmedShowOverview || trimmedEpOverview.toLowerCase() !== trimmedShowOverview.toLowerCase())
  );

  let description = '';
  if (isDistinctEpisode) {
    if (hasUniqueEpisodeOverview) {
      description = truncateAtWord(trimmedEpOverview, 160);
    } else {
      description = `Watch ${rawTitle} Season ${options.season} Episode ${options.episode} online in HD with subtitles on T Stream.`;
    }
  } else if (trimmedShowOverview) {
    description = truncateAtWord(trimmedShowOverview, 160);
  } else {
    description = `Stream ${rawTitle}${yearStr} in Full HD 1080p and 4K on T Stream with multi-language subtitles and fast streaming servers.`;
  }

  const keywords = generateMediaKeywords(media, options);

  // Canonical URL Strategy:
  // - Movie detail & Movie watch: https://tstream.online/movie/{slug}
  // - TV series detail: https://tstream.online/tv/{slug}
  // - TV episode playback: https://tstream.online/watch/tv/{slug}/{season}/{episode}
  const slug = createMediaSlug(rawTitle, media?.id || media?.tmdbId || 0);
  const canonicalUrl = isMovie
    ? `${PRIMARY_ORIGIN}/movie/${slug}`
    : isDistinctEpisode
    ? `${PRIMARY_ORIGIN}/watch/tv/${slug}/${options.season}/${options.episode}`
    : `${PRIMARY_ORIGIN}/tv/${slug}`;

  const rawImage = media?.backdropPath || media?.posterPath || DEFAULT_IMAGE;
  const image = rawImage.startsWith('http') ? rawImage : `${PRIMARY_ORIGIN}${rawImage}`;
  const isDefaultOgImage = image === DEFAULT_IMAGE || image.endsWith('/og-image.png');
  const mimeType = getImageMimeType(image);

  // Schema.org JSON-LD (Strictly authentic data - NEVER inherit series ratings onto TVEpisode!)
  const effectiveVoteAverage = isDistinctEpisode ? Number(options.episodeVoteAverage || 0) : Number(media?.voteAverage || 0);
  const effectiveVoteCount = isDistinctEpisode ? Number(options.episodeVoteCount || 0) : Number(media?.voteCount || 0);
  const hasGenuineRating = Boolean(
    effectiveVoteAverage > 0 && effectiveVoteCount > 0
  );

  const schemaType = isMovie ? 'Movie' : isDistinctEpisode ? 'TVEpisode' : 'TVSeries';
  const datePublished = isDistinctEpisode
    ? options.episodeAirDate || undefined
    : year && !isNaN(Number(year))
    ? String(year)
    : undefined;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    'name': isDistinctEpisode && isGenuineEpisodeName(options.episodeName) ? `${rawTitle} - ${options.episodeName!.trim()}` : rawTitle,
    'description': description,
    'url': canonicalUrl,
    'image': image,
    ...(datePublished ? { 'datePublished': datePublished } : {}),
    ...(hasGenuineRating
      ? {
          'aggregateRating': {
            '@type': 'AggregateRating',
            'ratingValue': Number(effectiveVoteAverage.toFixed(1)),
            'bestRating': '10',
            'worstRating': '1',
            'ratingCount': effectiveVoteCount
          }
        }
      : {}),
    ...(media?.genres && Array.isArray(media.genres) && media.genres.length > 0
      ? {
          'genre': media.genres
            .map((g: any) => (typeof g === 'string' ? g : g?.name || ''))
            .filter((g: string) => Boolean(g && g.trim()))
        }
      : {})
  };

  if (isDistinctEpisode) {
    schema['episodeNumber'] = options.episode;
    schema['partOfSeason'] = {
      '@type': 'TVSeason',
      'seasonNumber': options.season
    };
    schema['partOfSeries'] = {
      '@type': 'TVSeries',
      'name': rawTitle,
      'url': `${PRIMARY_ORIGIN}/tv/${slug}`
    };
  }

  return {
    title,
    description,
    keywords,
    canonicalUrl,
    image,
    mimeType,
    isDefaultOgImage,
    type: isMovie ? 'video.movie' : 'video.tv_show',
    schema,
    rawTitle
  };
}

export function updateSEO(config: SEOConfig = {}) {
  if (typeof document === 'undefined') return;

  const rawTitle = config.title;
  let title = DEFAULT_TITLE;
  if (rawTitle) {
    title = rawTitle.endsWith('— T Stream') || rawTitle.endsWith('- T Stream')
      ? rawTitle
      : `${rawTitle} — T Stream`;
  }

  const description = truncateAtWord(config.description || DEFAULT_DESC, 160);
  const keywords = normalizeKeywords(config.keywords) || DEFAULT_KEYWORDS;
  const image = config.image
    ? config.image.startsWith('http')
      ? config.image
      : `${PRIMARY_ORIGIN}${config.image}`
    : DEFAULT_IMAGE;

  const policy = config.url ? resolveRouteSeoPolicy(config.url) : resolveRouteSeoPolicy();
  const canonicalUrl = policy.canonicalUrl;
  const effectiveNoindex = Boolean(config.noindex || policy.noindex);
  const isDefaultOgImage = image === DEFAULT_IMAGE || image.endsWith('/og-image.png') || image === '/og-image.png';
  const mimeType = getImageMimeType(image);

  // 1. Page Title & Meta Title (Identical)
  document.title = title;
  updateMetaTag('name', 'title', title);

  // 2. Meta description
  updateMetaTag('name', 'description', description);

  // 3. Meta keywords (Dynamic per page)
  updateMetaTag('name', 'keywords', keywords);

  // 4. Robots Tag (Explicit index or noindex)
  if (effectiveNoindex) {
    updateMetaTag('name', 'robots', 'noindex, nofollow');
  } else {
    updateMetaTag(
      'name',
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );
  }

  // 5. Canonical Link (single authoritative declaration)
  const existingCanonicals = document.querySelectorAll('link[rel="canonical"]');
  if (existingCanonicals.length > 1) {
    existingCanonicals.forEach((el, idx) => {
      if (idx > 0) el.remove();
    });
  }
  let canonicalEl = existingCanonicals[0] as HTMLLinkElement | undefined;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    canonicalEl.id = 'tstream-canonical';
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  // 6. OpenGraph Tags
  updateMetaTag('property', 'og:title', title);
  updateMetaTag('property', 'og:description', description);
  updateMetaTag('property', 'og:image', image);
  updateMetaTag('property', 'og:image:secure_url', image);
  updateMetaTag('property', 'og:image:type', mimeType);
  updateMetaTag('property', 'og:image:alt', title);
  updateMetaTag('property', 'og:url', canonicalUrl);
  updateMetaTag('property', 'og:type', config.type || 'website');
  updateMetaTag('property', 'og:site_name', 'T Stream');

  if (isDefaultOgImage) {
    updateMetaTag('property', 'og:image:width', '1200');
    updateMetaTag('property', 'og:image:height', '630');
  } else {
    const widthEl = document.querySelector('meta[property="og:image:width"]');
    if (widthEl) widthEl.remove();
    const heightEl = document.querySelector('meta[property="og:image:height"]');
    if (heightEl) heightEl.remove();
  }

  // 7. Twitter / X Cards
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', title);
  updateMetaTag('name', 'twitter:description', description);
  updateMetaTag('name', 'twitter:image', image);
  updateMetaTag('name', 'twitter:image:alt', title);
  updateMetaTag('name', 'twitter:url', canonicalUrl);

  // 8. Schema.org Structured Data (JSON-LD)
  let scriptEl = document.getElementById('json-ld-schema') as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'json-ld-schema';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }

  const defaultSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://tstream.online/#website',
        'url': 'https://tstream.online/',
        'name': 'T Stream',
        'description': DEFAULT_DESC,
        'potentialAction': {
          '@type': 'SearchAction',
          'target': 'https://tstream.online/search?q={search_term_string}',
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'WebApplication',
        '@id': 'https://tstream.online/#webapp',
        'name': 'T Stream Web App',
        'url': 'https://tstream.online/',
        'applicationCategory': 'EntertainmentApplication',
        'operatingSystem': 'All',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'USD'
        }
      }
    ]
  };

  scriptEl.textContent = JSON.stringify(config.schema || defaultSchema);

  // 9. Google Analytics (GA4 G-ZD66WMB19X) SPA Page View Tracking
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    try {
      (window as any).gtag('event', 'page_view', {
        page_title: title,
        page_location: canonicalUrl,
        page_path: window.location.pathname + window.location.search
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Standardize Media SEO across client-side navigation
 */
export function updateMediaSEO(
  media: any,
  options: {
    seriesId?: number;
    episodeId?: number;
    season?: number;
    episode?: number;
    seasonEpisodeCount?: number;
    numberOfSeasons?: number;
    seasonOverview?: string;
    episodeName?: string;
    episodeOverview?: string;
    episodeAirDate?: string;
    episodeVoteAverage?: number;
    episodeVoteCount?: number;
    isVerifiedEpisode?: boolean;
    noindex?: boolean;
    isWatching?: boolean;
  } = {}
) {
  if (!media) return;
  const metadata = buildMediaMetadata(media, options);
  const isDistinctEpisode = media?.mediaType !== 'movie' && Boolean(options.isWatching && options.season && options.episode);
  const effectiveNoindex =
    options.noindex !== undefined
      ? options.noindex
      : isDistinctEpisode && (options.episodeOverview !== undefined || options.isVerifiedEpisode !== undefined)
      ? !isEpisodeSeoIndexable({
          seriesId: options.seriesId ?? media.id,
          episodeId: options.episodeId,
          seasonNumber: options.season,
          episodeNumber: options.episode,
          seasonEpisodeCount: options.seasonEpisodeCount,
          numberOfSeasons: options.numberOfSeasons ?? media.numberOfSeasons,
          episodeName: options.episodeName,
          episodeOverview: options.episodeOverview,
          seriesOverview: media.overview,
          seasonOverview: options.seasonOverview,
          isVerifiedEpisode: options.isVerifiedEpisode
        })
      : false;

  updateSEO({
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    image: metadata.image,
    url: metadata.canonicalUrl,
    type: metadata.type,
    noindex: effectiveNoindex,
    schema: metadata.schema
  });
}

function updateMetaTag(attrName: 'name' | 'property', attrVal: string, content: string) {
  let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
