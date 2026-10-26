/**
 * Advanced SEO, OpenGraph, Twitter/X cards, and JSON-LD Schema.org generator
 */

interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'video.movie' | 'video.tv_show';
  schema?: Record<string, any>;
}

const DEFAULT_TITLE = 'T Stream — Watch Movies & TV Shows Online Free in HD';
const DEFAULT_DESC = 'Watch high quality movies and TV shows online for free on T Stream. Stream 4K HDR & 1080p with multi-language subtitles, fast servers, and zero ads.';
const DEFAULT_IMAGE = '/og-image.png';

export function updateSEO(config: SEOConfig = {}) {
  if (typeof document === 'undefined') return;

  const title = config.title ? `${config.title} — T Stream` : DEFAULT_TITLE;
  const description = config.description || DEFAULT_DESC;
  const image = config.image || DEFAULT_IMAGE;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://tstream.online/';
  const canonicalUrl = config.url || currentUrl;

  // 1. Page Title
  document.title = title;

  // 2. Meta description
  updateMetaTag('name', 'description', description);

  // 3. OpenGraph Tags (Facebook, LinkedIn, Discord, etc.)
  updateMetaTag('property', 'og:title', title);
  updateMetaTag('property', 'og:description', description);
  updateMetaTag('property', 'og:image', image);
  updateMetaTag('property', 'og:url', canonicalUrl);
  updateMetaTag('property', 'og:type', config.type || 'website');
  updateMetaTag('property', 'og:site_name', 'T Stream');

  // 4. Twitter / X Cards
  updateMetaTag('name', 'twitter:card', 'summary_large_image');
  updateMetaTag('name', 'twitter:title', title);
  updateMetaTag('name', 'twitter:description', description);
  updateMetaTag('name', 'twitter:image', image);

  // 5. Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', canonicalUrl);

  // 6. JSON-LD Structured Data
  let scriptEl = document.getElementById('json-ld-schema') as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = 'json-ld-schema';
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }

  const defaultSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'T Stream',
    'url': 'https://tstream.online/',
    'description': DEFAULT_DESC,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': 'https://tstream.online/search?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  };

  scriptEl.textContent = JSON.stringify(config.schema || defaultSchema);
}

export function updateMediaSEO(media: any, options: { season?: number; episode?: number; isWatching?: boolean } = {}) {
  if (!media) return;
  const isMovie = media.mediaType === 'movie';
  const rawTitle = media.title || media.name || 'Untitled';
  const year = media.releaseDate ? new Date(media.releaseDate).getFullYear() : (media.firstAirDate ? new Date(media.firstAirDate).getFullYear() : '');
  const yearStr = year ? ` (${year})` : '';

  let pageTitle = '';
  if (options.isWatching) {
    if (isMovie) {
      pageTitle = `Watch ${rawTitle}${yearStr} Full Movie Free HD`;
    } else {
      pageTitle = `Watch ${rawTitle} S${options.season || 1} E${options.episode || 1} Free HD`;
    }
  } else {
    pageTitle = `${rawTitle}${yearStr} — Watch Free HD ${isMovie ? 'Movie' : 'TV Show'}`;
  }

  const desc = media.overview
    ? (media.overview.length > 155 ? media.overview.substring(0, 152) + '...' : media.overview)
    : `Stream ${rawTitle}${yearStr} in Full HD 1080p and 4K on T Stream with multi-language subtitles.`;

  const image = media.backdropPath || media.posterPath || '/og-image.png';

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': isMovie ? 'Movie' : 'TVSeries',
    'name': rawTitle,
    'description': desc,
    'image': image,
    ...(media.voteAverage ? {
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': media.voteAverage,
        'bestRating': '10',
        'worstRating': '1',
        'ratingCount': media.voteCount || 100
      }
    } : {}),
    ...(media.genres ? {
      'genre': media.genres.map((g: any) => g.name || g)
    } : {})
  };

  updateSEO({
    title: pageTitle,
    description: desc,
    image,
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

