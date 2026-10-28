/**
 * Professional Google SEO, OpenGraph, Twitter/X cards, and JSON-LD Schema.org Generator
 * for TStream.online
 */

import { createMediaSlug } from './slug';

export interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'video.movie' | 'video.tv_show';
  noindex?: boolean;
  schema?: Record<string, any>;
}

const PRIMARY_ORIGIN = 'https://tstream.online';
const DEFAULT_TITLE = 'T Stream — Watch Movies & TV Shows Online Free in HD';
const DEFAULT_DESC = 'Stream thousands of trending movies and TV series in 4K UHD and 1080p Full HD on T Stream. Fast multi-server playback, multilingual subtitles, and zero ads.';
const DEFAULT_IMAGE = 'https://tstream.online/og-image.png';

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

    // Ensure leading slash
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;

    // Remove trailing slash if longer than 1 character
    if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    return `${PRIMARY_ORIGIN}${cleanPath}`;
  } catch {
    return PRIMARY_ORIGIN;
  }
}

export function updateSEO(config: SEOConfig = {}) {
  if (typeof document === 'undefined') return;

  const title = config.title ? `${config.title} — T Stream` : DEFAULT_TITLE;
  const description = config.description || DEFAULT_DESC;
  const image = config.image ? (config.image.startsWith('http') ? config.image : `${PRIMARY_ORIGIN}${config.image}`) : DEFAULT_IMAGE;
  const canonicalUrl = config.url ? buildCanonicalUrl(config.url) : buildCanonicalUrl();

  // 1. Page Title
  document.title = title;

  // 2. Meta description
  updateMetaTag('name', 'description', description);

  // 3. Robots Tag (Explicit index or noindex)
  if (config.noindex) {
    updateMetaTag('name', 'robots', 'noindex, nofollow');
  } else {
    updateMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  }

  // 4. Canonical Link (Essential for Google Search Console duplicate prevention)
  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  // 5. OpenGraph Tags (Facebook, LinkedIn, Discord, Slack)
  updateMetaTag('property', 'og:title', title);
  updateMetaTag('property', 'og:description', description);
  updateMetaTag('property', 'og:image', image);
  updateMetaTag('property', 'og:image:secure_url', image);
  updateMetaTag('property', 'og:url', canonicalUrl);
  updateMetaTag('property', 'og:type', config.type || 'website');
  updateMetaTag('property', 'og:site_name', 'T Stream');

  // 6. Twitter / X Cards
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', title);
  updateMetaTag('name', 'twitter:description', description);
  updateMetaTag('name', 'twitter:image', image);
  updateMetaTag('name', 'twitter:url', canonicalUrl);

  // 7. Schema.org Structured Data (JSON-LD)
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
}

/**
 * Standardize Media SEO and eliminate duplicate canonical conflict across
 * /movie/:slug and /watch/movie/:slug
 */
export function updateMediaSEO(media: any, options: { season?: number; episode?: number; isWatching?: boolean } = {}) {
  if (!media) return;
  const isMovie = media.mediaType === 'movie';
  const rawTitle = media.title || media.name || 'Untitled';
  const year = media.releaseDate
    ? new Date(media.releaseDate).getFullYear()
    : media.firstAirDate
    ? new Date(media.firstAirDate).getFullYear()
    : '';
  const yearStr = year ? ` (${year})` : '';

  let pageTitle = '';
  if (options.isWatching) {
    if (isMovie) {
      pageTitle = `Watch ${rawTitle}${yearStr} Full Movie Free Online in HD`;
    } else {
      pageTitle = `Watch ${rawTitle} Season ${options.season || 1} Episode ${options.episode || 1} Free HD`;
    }
  } else {
    pageTitle = `${rawTitle}${yearStr} — Watch Free HD ${isMovie ? 'Movie' : 'TV Show'}`;
  }

  const desc = media.overview
    ? media.overview.length > 155
      ? media.overview.substring(0, 152) + '...'
      : media.overview
    : `Stream ${rawTitle}${yearStr} in Full HD 1080p and 4K on T Stream with multi-language subtitles and fast streaming servers.`;

  const image = media.backdropPath || media.posterPath || DEFAULT_IMAGE;

  // Single authoritative canonical URL to resolve "Duplicate without user-selected canonical"
  const slug = createMediaSlug(rawTitle, media.id || media.tmdbId);
  const canonicalUrl = isMovie
    ? `${PRIMARY_ORIGIN}/watch/movie/${slug}`
    : options.season && options.episode
    ? `${PRIMARY_ORIGIN}/watch/tv/${slug}/${options.season}/${options.episode}`
    : `${PRIMARY_ORIGIN}/watch/tv/${slug}`;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    'name': rawTitle,
    'description': desc,
    'url': canonicalUrl,
    'image': image,
    ...(year ? { 'datePublished': String(year) } : {}),
    ...(media.voteAverage && media.voteAverage > 0
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
    ...(media.genres && Array.isArray(media.genres)
      ? {
          'genre': media.genres.map((g: any) => (typeof g === 'string' ? g : g.name))
        }
      : {})
  };

  updateSEO({
    title: pageTitle,
    description: desc,
    image,
    url: canonicalUrl,
    type: isMovie ? 'video.movie' : 'video.tv_show',
    schema
  });
}

function updateMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}
