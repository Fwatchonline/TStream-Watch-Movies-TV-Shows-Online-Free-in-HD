/**
 * Professional Google SEO, OpenGraph, Twitter/X cards, Dynamic Keywords,
 * Canonical & Query Parameter Policy, and JSON-LD Schema.org Generator for TStream.online
 */

import { createMediaSlug } from './slug.ts';
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

    if (isPlatformAlias) {
      return {
        canonicalUrl: `${PRIMARY_ORIGIN}${rawPath}`,
        noindex: true,
        reason: 'platform_alias',
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
      const epSuffix = options.episodeName && !/^episode\s+\d+$/i.test(options.episodeName.trim())
        ? ` "${options.episodeName.trim()}"`
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

  let description = '';
  if (isDistinctEpisode && options.episodeOverview && options.episodeOverview.trim()) {
    description = truncateAtWord(options.episodeOverview, 160);
  } else if (media?.overview && media.overview.trim()) {
    description = truncateAtWord(media.overview, 160);
  } else {
    if (isDistinctEpisode) {
      description = `Watch ${rawTitle} Season ${options.season} Episode ${options.episode} online in HD with subtitles on T Stream.`;
    } else {
      description = `Stream ${rawTitle}${yearStr} in Full HD 1080p and 4K on T Stream with multi-language subtitles and fast streaming servers.`;
    }
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

  // Schema.org JSON-LD (Strictly authentic data - NEVER fabricate ratings or review counts)
  const hasGenuineRating = Boolean(
    media?.voteAverage &&
      media.voteAverage > 0 &&
      media?.voteCount &&
      media.voteCount > 0
  );

  const schemaType = isMovie ? 'Movie' : isDistinctEpisode ? 'TVEpisode' : 'TVSeries';
  const datePublished = isDistinctEpisode && options.episodeAirDate
    ? options.episodeAirDate
    : year && !isNaN(Number(year))
    ? String(year)
    : undefined;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    'name': isDistinctEpisode && options.episodeName ? `${rawTitle} - ${options.episodeName}` : rawTitle,
    'description': description,
    'url': canonicalUrl,
    'image': image,
    ...(datePublished ? { 'datePublished': datePublished } : {}),
    ...(hasGenuineRating
      ? {
          'aggregateRating': {
            '@type': 'AggregateRating',
            'ratingValue': Number(media.voteAverage.toFixed(1)),
            'bestRating': '10',
            'worstRating': '1',
            'ratingCount': media.voteCount
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
    season?: number;
    episode?: number;
    episodeName?: string;
    episodeOverview?: string;
    episodeAirDate?: string;
    isWatching?: boolean;
  } = {}
) {
  if (!media) return;
  const metadata = buildMediaMetadata(media, options);

  updateSEO({
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    image: metadata.image,
    url: metadata.canonicalUrl,
    type: metadata.type,
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
