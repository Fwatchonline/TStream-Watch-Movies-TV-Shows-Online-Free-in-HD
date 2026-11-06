/**
 * Professional Google SEO, OpenGraph, Twitter/X cards, Dynamic Keywords,
 * and JSON-LD Schema.org Generator for TStream.online
 */

import { createMediaSlug } from './slug.ts';

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

export const PRIMARY_ORIGIN = 'https://tstream.online';
export const DEFAULT_TITLE = 'T Stream — Watch Movies & TV Shows Online Free in HD';
export const DEFAULT_DESC =
  'Stream thousands of trending movies and TV series in 4K UHD and 1080p Full HD on T Stream. Fast multi-server playback, multilingual subtitles, and zero ads.';
export const DEFAULT_IMAGE = 'https://tstream.online/og-image.png';
export const DEFAULT_KEYWORDS =
  't stream, watch movies online, watch series online, free streaming, hd movies, 4k streaming, english subtitles, croatian subtitles, cinema stream';

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
 * Adheres strictly to TStream production specification:
 * - Movie: Title, Title (Year), Title movie, Title (Year) watch online, watch Title online, TMDB genres, Genre movies, T Stream (max 15)
 * - TV show / episode: Title, Title (Year), Title TV series, Title (Year) watch online, watch Title online, TMDB genres, Genre TV series, T Stream, season/episode phrases
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

  // 1. Original / displayed title
  keywords.push(rawTitle);

  // 2. Title with year
  if (year && !isNaN(Number(year))) {
    keywords.push(`${rawTitle} (${year})`);
  }

  // 3. Title + content type
  if (isMovie) {
    keywords.push(`${rawTitle} movie`);
  } else {
    keywords.push(`${rawTitle} TV series`);
  }

  // 4. "watch online" phrases
  if (year && !isNaN(Number(year))) {
    keywords.push(`${rawTitle} (${year}) watch online`);
  }
  keywords.push(`watch ${rawTitle} online`);

  // 5. TMDB genres
  for (const g of rawGenres) {
    keywords.push(g);
  }

  // 6. Genre + content type combinations
  for (const g of rawGenres) {
    if (isMovie) {
      keywords.push(`${g} movie`);
    } else {
      keywords.push(`${g} TV series`);
    }
  }

  // 7. Brand
  keywords.push('T Stream');

  // 8. TV episode specific keywords
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
 * Clean & normalize canonical URLs according to Google Search Central guidelines:
 * - Always HTTPS
 * - Canonical domain https://tstream.online
 * - Strip tracking & non-essential query parameters (?genreId, ?ref, ?utm_*, ?fbclid, etc.)
 * - Normalize trailing slashes (strip trailing slash unless root '/')
 */
export function buildCanonicalUrl(pathOrUrl?: string): string {
  try {
    let cleanPath = '/';
    if (pathOrUrl) {
      if (pathOrUrl.startsWith('http')) {
        const parsed = new URL(pathOrUrl);
        cleanPath = parsed.pathname;
      } else {
        cleanPath = pathOrUrl.split('?')[0].split('#')[0];
      }
    } else if (typeof window !== 'undefined') {
      cleanPath = window.location.pathname;
    }

    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    return `${PRIMARY_ORIGIN}${cleanPath}`;
  } catch {
    return PRIMARY_ORIGIN;
  }
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
  options: { season?: number; episode?: number; episodeName?: string; isWatching?: boolean } = {}
): MediaMetadataResult {
  const isMovie = media?.mediaType === 'movie';
  const rawTitle = (media?.title || media?.name || 'Untitled').trim();
  const year = media?.releaseDate
    ? new Date(media.releaseDate).getFullYear()
    : media?.firstAirDate
    ? new Date(media.firstAirDate).getFullYear()
    : '';
  const yearStr = year && !isNaN(Number(year)) ? ` (${year})` : '';

  // Exact Title Formats:
  // - Movie detail: "The Amazing Spider-Man 2 (2014) — Watch Free HD Movie — T Stream"
  // - Movie watch:  "Watch The Amazing Spider-Man 2 (2014) Full Movie Free Online in HD — T Stream"
  // - TV detail:     "Breaking Bad (2008) — Watch Free HD TV Show — T Stream"
  // - TV episode:    "Watch Breaking Bad Season 1 Episode 1 Free HD — T Stream"
  let title = '';
  if (options.isWatching) {
    if (isMovie) {
      title = `Watch ${rawTitle}${yearStr} Full Movie Free Online in HD — T Stream`;
    } else {
      title = `Watch ${rawTitle} Season ${options.season || 1} Episode ${options.episode || 1} Free HD — T Stream`;
    }
  } else {
    if (isMovie) {
      title = `${rawTitle}${yearStr} — Watch Free HD Movie — T Stream`;
    } else {
      title = `${rawTitle}${yearStr} — Watch Free HD TV Show — T Stream`;
    }
  }

  // Description: word-aware truncation or fallback
  let description = '';
  if (media?.overview && media.overview.trim()) {
    description = truncateAtWord(media.overview, 160);
  } else {
    if (options.isWatching && !isMovie && options.season && options.episode) {
      description = `Watch ${rawTitle} Season ${options.season} Episode ${options.episode} online in HD with subtitles on T Stream.`;
    } else {
      description = `Stream ${rawTitle}${yearStr} in Full HD 1080p and 4K on T Stream with multi-language subtitles and fast streaming servers.`;
    }
  }

  // Keywords
  const keywords = generateMediaKeywords(media, options);

  // Canonical URL (Always points to /watch/ path)
  const slug = createMediaSlug(rawTitle, media?.id || media?.tmdbId || 0);
  const canonicalUrl = isMovie
    ? `${PRIMARY_ORIGIN}/watch/movie/${slug}`
    : options.season && options.episode
    ? `${PRIMARY_ORIGIN}/watch/tv/${slug}/${options.season}/${options.episode}`
    : `${PRIMARY_ORIGIN}/watch/tv/${slug}`;

  // Image & MIME
  const rawImage = media?.backdropPath || media?.posterPath || DEFAULT_IMAGE;
  const image = rawImage.startsWith('http') ? rawImage : `${PRIMARY_ORIGIN}${rawImage}`;
  const isDefaultOgImage = image === DEFAULT_IMAGE || image.endsWith('/og-image.png');
  const mimeType = getImageMimeType(image);

  // Schema.org JSON-LD
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    'name': rawTitle,
    'description': description,
    'url': canonicalUrl,
    'image': image,
    ...(year && !isNaN(Number(year)) ? { 'datePublished': String(year) } : {}),
    ...(media?.voteAverage && media.voteAverage > 0
      ? {
          'aggregateRating': {
            '@type': 'AggregateRating',
            'ratingValue': Number(media.voteAverage.toFixed(1)),
            'bestRating': '10',
            'worstRating': '1',
            'ratingCount': media.voteCount || 100
          }
        }
      : {}),
    ...(media?.genres && Array.isArray(media.genres)
      ? {
          'genre': media.genres.map((g: any) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean)
        }
      : {})
  };

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
  const canonicalUrl = config.url ? buildCanonicalUrl(config.url) : buildCanonicalUrl();
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
  if (config.noindex) {
    updateMetaTag('name', 'robots', 'noindex, nofollow');
  } else {
    updateMetaTag(
      'name',
      'robots',
      'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );
  }

  // 5. Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
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

  // Handle OG image dimensions: Keep 1200x630 ONLY on default home banner; REMOVE for unknown TMDB dimensions
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
  options: { season?: number; episode?: number; episodeName?: string; isWatching?: boolean } = {}
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
  let tag = document.querySelector(`meta[${attrName}="${attrVal}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrVal);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}
