/**
 * Vite Server-Side HTML SEO Plugin & Pre-rendering Engine for TStream.online
 *
 * Pre-renders meta tags, dynamic keywords, canonical URLs, OpenGraph,
 * Twitter cards, and Schema.org JSON-LD structured data, plus semantic HTML body
 * in the initial HTML response.
 *
 * Guarantees web crawlers (Googlebot, Bingbot, etc.) receive complete SEO
 * and crawlable semantic content without executing client-side JavaScript.
 */

import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { parseMediaSlug } from '../src/utils/slug.ts';
import {
  buildMediaMetadata,
  DEFAULT_TITLE,
  DEFAULT_DESC,
  DEFAULT_KEYWORDS,
  DEFAULT_IMAGE,
  PRIMARY_ORIGIN,
  getImageMimeType,
  truncateAtWord,
  normalizeKeywords
} from '../src/utils/seo.ts';
import {
  DETAILED_MOVIES,
  DETAILED_TV_SHOWS,
  EXPANDED_CATALOG,
  POPULAR_TAGS,
  SPIDERMAN_COLLECTION,
  AVENGERS_COLLECTION,
  HARRY_POTTER_COLLECTION,
  PIRATES_COLLECTION
} from '../src/services/catalogData.ts';

const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY || '844dba0bfd8f3a4f3799f6130ef9e335';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export type SeoRouteType =
  | 'home'
  | 'movie'
  | 'tv'
  | 'watch_movie'
  | 'watch_tv'
  | 'movies'
  | 'tv-shows'
  | 'trending'
  | 'top-rated'
  | 'collections'
  | 'new-episodes'
  | 'people'
  | 'person'
  | 'tags'
  | 'tag_detail'
  | 'platform'
  | 'az'
  | 'random'
  | 'noindex';

export interface ParsedSeoRoute {
  type: SeoRouteType;
  isMatched: boolean;
  mediaType?: 'movie' | 'tv';
  id?: number;
  slug?: string;
  isWatchRoute?: boolean;
  season?: number;
  episode?: number;
  tag?: string;
  platform?: string;
  letter?: string;
  personId?: number;
}

/**
 * Parses URL pathname to identify all TStream routes.
 */
export function parseSeoRoute(pathname: string): ParsedSeoRoute | null {
  if (!pathname) return null;
  const clean = pathname.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'index.html') {
    return { type: 'home', isMatched: true };
  }

  const parts = clean.split('/');

  // 1. /watch/movie/:slug
  if (parts[0] === 'watch' && parts[1] === 'movie' && parts[2]) {
    const parsed = parseMediaSlug(parts[2]);
    if (parsed && !isNaN(parsed.id)) {
      return {
        type: 'watch_movie',
        isMatched: true,
        mediaType: 'movie',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: true
      };
    }
  }

  // 2. /watch/tv/:slug or /watch/tv/:slug/:season/:episode
  if (parts[0] === 'watch' && parts[1] === 'tv' && parts[2]) {
    const parsed = parseMediaSlug(parts[2]);
    if (parsed && !isNaN(parsed.id)) {
      const season = parts[3] ? parseInt(parts[3], 10) : undefined;
      const episode = parts[4] ? parseInt(parts[4], 10) : undefined;
      return {
        type: 'watch_tv',
        isMatched: true,
        mediaType: 'tv',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: true,
        season: typeof season === 'number' && !isNaN(season) ? season : undefined,
        episode: typeof episode === 'number' && !isNaN(episode) ? episode : undefined
      };
    }
  }

  // 3. /movie/:slug
  if (parts[0] === 'movie' && parts[1]) {
    const parsed = parseMediaSlug(parts[1]);
    if (parsed && !isNaN(parsed.id)) {
      return {
        type: 'movie',
        isMatched: true,
        mediaType: 'movie',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: false
      };
    }
  }

  // 4. /tv/:slug
  if (parts[0] === 'tv' && parts[1]) {
    const parsed = parseMediaSlug(parts[1]);
    if (parsed && !isNaN(parsed.id)) {
      return {
        type: 'tv',
        isMatched: true,
        mediaType: 'tv',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: false
      };
    }
  }

  // 5. Landing pages
  if (parts[0] === 'movies') return { type: 'movies', isMatched: true };
  if (parts[0] === 'tv-shows') return { type: 'tv-shows', isMatched: true };
  if (parts[0] === 'trending') return { type: 'trending', isMatched: true };
  if (parts[0] === 'top-rated') return { type: 'top-rated', isMatched: true };
  if (parts[0] === 'collections') return { type: 'collections', isMatched: true };
  if (parts[0] === 'new-episodes') return { type: 'new-episodes', isMatched: true };
  if (parts[0] === 'people') return { type: 'people', isMatched: true };
  if (parts[0] === 'random') return { type: 'random', isMatched: true };

  // 6. /person/:id
  if (parts[0] === 'person' && parts[1]) {
    const pid = parseInt(parts[1], 10);
    if (!isNaN(pid)) {
      return { type: 'person', isMatched: true, personId: pid };
    }
  }

  // 7. /tags and /tags/:tag
  if (parts[0] === 'tags' || parts[0] === 'tag') {
    if (parts[1]) {
      const tag = decodeURIComponent(parts[1]).toLowerCase().replace(/^#/, '');
      return { type: 'tag_detail', isMatched: true, tag };
    }
    return { type: 'tags', isMatched: true };
  }

  // 8. /platform/:platform
  if (parts[0] === 'platform' && parts[1]) {
    return { type: 'platform', isMatched: true, platform: parts[1].toLowerCase() };
  }

  // 9. /az/:letter
  if (parts[0] === 'az' && parts[1]) {
    return { type: 'az', isMatched: true, letter: parts[1].toUpperCase() };
  }

  // 10. Private / search pages (noindex)
  if (['search', 'library', 'admin', 'settings', 'player-settings'].includes(parts[0])) {
    return { type: 'noindex', isMatched: true };
  }

  return null;
}

/**
 * Escapes HTML characters for safe attribute and title insertion.
 */
function escapeHtml(str: any): string {
  if (str == null) return '';
  const text = typeof str === 'string' ? str : typeof str === 'object' && str.name ? String(str.name) : String(str);
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Replaces or inserts a <meta> tag by name or property.
 */
function setMetaTag(html: string, attrName: 'name' | 'property', attrVal: string, content: string): string {
  const escapedContent = escapeHtml(content);
  const regex = new RegExp(`<meta\\s+[^>]*${attrName}=["']${attrVal}["'][^>]*>`, 'i');
  const newTag = `<meta ${attrName}="${attrVal}" content="${escapedContent}" />`;
  if (regex.test(html)) {
    return html.replace(regex, newTag);
  }
  return html.replace('</head>', `    ${newTag}\n  </head>`);
}

/**
 * Removes a <meta> tag completely from HTML.
 */
export function removeMetaTag(html: string, attrName: 'name' | 'property', attrVal: string): string {
  const regex = new RegExp(`<meta\\s+[^>]*${attrName}=["']${attrVal}["'][^>]*>\\s*`, 'gi');
  return html.replace(regex, '');
}

/**
 * Sets <title>...</title> in HTML.
 */
function setTitle(html: string, title: string): string {
  const regex = /<title>[\s\S]*?<\/title>/i;
  const newTag = `<title>${escapeHtml(title)}</title>`;
  if (regex.test(html)) {
    return html.replace(regex, newTag);
  }
  return html.replace('</head>', `    ${newTag}\n  </head>`);
}

/**
 * Sets <link rel="canonical" ... /> in HTML.
 */
function setCanonical(html: string, canonicalUrl: string): string {
  const regex = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;
  const newTag = `<link rel="canonical" id="tstream-canonical" href="${escapeHtml(canonicalUrl)}" />`;
  if (regex.test(html)) {
    return html.replace(regex, newTag);
  }
  return html.replace('</head>', `    ${newTag}\n  </head>`);
}

/**
 * Sets <script type="application/ld+json" id="json-ld-schema"> in HTML.
 */
function setJsonLd(html: string, schema: Record<string, any>): string {
  const jsonString = JSON.stringify(schema, null, 2);
  const regex = /<script\s+[^>]*id=["']json-ld-schema["'][^>]*>[\s\S]*?<\/script>/i;
  const newTag = `<script type="application/ld+json" id="json-ld-schema">\n${jsonString}\n    </script>`;
  if (regex.test(html)) {
    return html.replace(regex, newTag);
  }
  return html.replace('</head>', `    ${newTag}\n  </head>`);
}

/**
 * Injects semantic HTML into <div id="root"></div> for crawlers.
 */
function setRootContent(html: string, bodyContent: string): string {
  const regex = /<div\s+id=["']root["'][^>]*>[\s\S]*?<\/div>/i;
  const replacement = `<div id="root">\n${bodyContent}\n    </div>`;
  if (regex.test(html)) {
    return html.replace(regex, replacement);
  }
  return html;
}

/**
 * Cache for server-side TMDB lookups.
 */
const serverMediaCache = new Map<string, { data: any; expiry: number }>();

/**
 * Fetches media details: checks local catalog data first, then attempts live TMDB.
 * Never fabricates genres or fake ratings.
 */
export async function fetchServerMedia(
  mediaType: 'movie' | 'tv',
  id: number,
  fallbackSlug?: string
): Promise<any> {
  const cacheKey = `${mediaType}:${id}`;
  const now = Date.now();
  const cached = serverMediaCache.get(cacheKey);
  if (cached && cached.expiry > now) {
    return cached.data;
  }

  // 1. Check local catalog first (guarantees zero-network instant authentic data)
  if (mediaType === 'movie') {
    const localMovie = DETAILED_MOVIES.find(m => m.id === id);
    if (localMovie) {
      const data = {
        id: localMovie.id,
        mediaType: 'movie',
        title: localMovie.title,
        name: localMovie.title,
        overview: localMovie.overview || '',
        releaseDate: localMovie.releaseDate || '',
        voteAverage: localMovie.voteAverage || 0,
        voteCount: localMovie.voteCount || 0,
        backdropPath: localMovie.backdropPath || '',
        posterPath: localMovie.posterPath || '',
        genres: (localMovie.genres || []).map((g: any) => (typeof g === 'string' ? g : g?.name || ''))
      };
      serverMediaCache.set(cacheKey, { data, expiry: now + 3600000 });
      return data;
    }

    // Check collections parts
    const collections = [SPIDERMAN_COLLECTION, AVENGERS_COLLECTION, HARRY_POTTER_COLLECTION, PIRATES_COLLECTION];
    for (const c of collections) {
      const part = c.parts.find(p => p.id === id || (p as any).tmdbId === id);
      if (part) {
        const data = {
          id: part.id,
          mediaType: 'movie',
          title: part.title,
          name: part.title,
          overview: part.overview || '',
          releaseDate: part.releaseDate || '',
          voteAverage: part.voteAverage || 0,
          voteCount: part.voteCount || 0,
          backdropPath: part.backdropPath || '',
          posterPath: part.posterPath || '',
          genres: (part.genres || []).map((g: any) => (typeof g === 'string' ? g : g?.name || ''))
        };
        serverMediaCache.set(cacheKey, { data, expiry: now + 3600000 });
        return data;
      }
    }
  } else {
    const localShow = DETAILED_TV_SHOWS.find(s => s.id === id);
    if (localShow) {
      const data = {
        id: localShow.id,
        mediaType: 'tv',
        title: (localShow as any).name || localShow.title || '',
        name: (localShow as any).name || localShow.title || '',
        overview: localShow.overview || '',
        releaseDate: (localShow as any).firstAirDate || localShow.releaseDate || '',
        firstAirDate: (localShow as any).firstAirDate || localShow.releaseDate || '',
        voteAverage: localShow.voteAverage || 0,
        voteCount: localShow.voteCount || 0,
        backdropPath: localShow.backdropPath || '',
        posterPath: localShow.posterPath || '',
        genres: (localShow.genres || []).map((g: any) => (typeof g === 'string' ? g : g?.name || ''))
      };
      serverMediaCache.set(cacheKey, { data, expiry: now + 3600000 });
      return data;
    }
  }

  // Also check EXPANDED_CATALOG
  const catalogItem = EXPANDED_CATALOG.find(i => i.id === id);
  if (catalogItem) {
    const title = catalogItem.title || (catalogItem as any).name || '';
    const data = {
      id: catalogItem.id,
      mediaType: catalogItem.mediaType,
      title,
      name: title,
      overview: catalogItem.overview || '',
      releaseDate: catalogItem.releaseDate || '',
      voteAverage: catalogItem.voteAverage || 0,
      voteCount: catalogItem.voteCount || 0,
      backdropPath: catalogItem.backdropPath || '',
      posterPath: catalogItem.posterPath || '',
      genres: []
    };
    serverMediaCache.set(cacheKey, { data, expiry: now + 3600000 });
    return data;
  }

  // 2. Attempt live TMDB fetch with short timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${TMDB_BASE_URL}/${mediaType}/${id}?api_key=${TMDB_API_KEY}&append_to_response=genres`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const rawTitle = json.title || json.name || '';
      const data = {
        id: json.id,
        mediaType,
        title: rawTitle,
        name: rawTitle,
        overview: json.overview || '',
        releaseDate: json.release_date || json.first_air_date || '',
        firstAirDate: json.first_air_date || '',
        voteAverage: json.vote_average || 0,
        voteCount: json.vote_count || 0,
        backdropPath: json.backdrop_path ? `https://image.tmdb.org/t/p/w1280${json.backdrop_path}` : '',
        posterPath: json.poster_path ? `https://image.tmdb.org/t/p/w500${json.poster_path}` : '',
        genres: (json.genres || []).map((g: any) => g.name || '').filter(Boolean)
      };
      serverMediaCache.set(cacheKey, { data, expiry: now + 60 * 60 * 1000 });
      return data;
    }
  } catch {
    // TMDB request failed or timed out
  }

  // 3. Clean fallback from slug — OMIT fabricated genres entirely
  const titleFromSlug = (fallbackSlug || `media-${id}`)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return {
    id,
    mediaType,
    title: titleFromSlug,
    name: titleFromSlug,
    overview: '',
    releaseDate: '',
    genres: [] // Never invent genres
  };
}

/**
 * Transforms an HTML document string by applying full server-side SEO tags
 * and semantic crawlable content in the body.
 */
export async function renderSeoHtml(html: string, urlPath: string, preloadedMedia?: any): Promise<string> {
  const route = parseSeoRoute(urlPath);
  let result = html;

  // 1. Private / Search pages: output noindex, nofollow
  if (route?.type === 'noindex') {
    result = setMetaTag(result, 'name', 'robots', 'noindex, nofollow');
    const cleanUrl = `${PRIMARY_ORIGIN}/${urlPath.split('?')[0].replace(/^\/+|\/+$/g, '')}`;
    result = setCanonical(result, cleanUrl);
    return result;
  }

  // 2. Media Detail & Watch Pages
  if (route && (route.type === 'movie' || route.type === 'tv' || route.type === 'watch_movie' || route.type === 'watch_tv')) {
    const media = preloadedMedia || (await fetchServerMedia(route.mediaType || 'movie', route.id || 0, route.slug));
    const meta = buildMediaMetadata(media, {
      season: route.season,
      episode: route.episode,
      isWatching: route.isWatchRoute
    });

    result = setTitle(result, meta.title);
    result = setMetaTag(result, 'name', 'title', meta.title);
    result = setMetaTag(result, 'name', 'description', meta.description);
    result = setMetaTag(result, 'name', 'keywords', meta.keywords);
    result = setCanonical(result, meta.canonicalUrl);
    result = setMetaTag(result, 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

    // OpenGraph
    result = setMetaTag(result, 'property', 'og:title', meta.title);
    result = setMetaTag(result, 'property', 'og:description', meta.description);
    result = setMetaTag(result, 'property', 'og:image', meta.image);
    result = setMetaTag(result, 'property', 'og:image:secure_url', meta.image);
    result = setMetaTag(result, 'property', 'og:image:type', meta.mimeType);
    result = setMetaTag(result, 'property', 'og:image:alt', meta.rawTitle);
    result = setMetaTag(result, 'property', 'og:url', meta.canonicalUrl);
    result = setMetaTag(result, 'property', 'og:type', meta.type);
    result = setMetaTag(result, 'property', 'og:site_name', 'T Stream');

    if (meta.isDefaultOgImage) {
      result = setMetaTag(result, 'property', 'og:image:width', '1200');
      result = setMetaTag(result, 'property', 'og:image:height', '630');
    } else {
      result = removeMetaTag(result, 'property', 'og:image:width');
      result = removeMetaTag(result, 'property', 'og:image:height');
    }

    // Twitter
    result = setMetaTag(result, 'name', 'twitter:card', 'summary_large_image');
    result = setMetaTag(result, 'name', 'twitter:title', meta.title);
    result = setMetaTag(result, 'name', 'twitter:description', meta.description);
    result = setMetaTag(result, 'name', 'twitter:image', meta.image);
    result = setMetaTag(result, 'name', 'twitter:image:alt', meta.rawTitle);
    result = setMetaTag(result, 'name', 'twitter:url', meta.canonicalUrl);

    // Schema.org JSON-LD
    result = setJsonLd(result, meta.schema);

    // Inject rich semantic HTML into <div id="root">
    const isMovie = route.mediaType === 'movie';
    const year = media.releaseDate ? new Date(media.releaseDate).getFullYear() : '';
    const yearDisplay = year ? ` (${year})` : '';
    const genresList = (media.genres || []).map((g: any) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean);

    const semanticHtml = `
      <main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8" id="seo-prerender">
        <nav aria-label="Breadcrumb" class="text-xs text-zinc-400 mb-4 max-w-5xl mx-auto">
          <a href="/" class="hover:underline">Home</a> &gt;
          <a href="${isMovie ? '/movies' : '/tv-shows'}" class="hover:underline">${isMovie ? 'Movies' : 'TV Shows'}</a> &gt;
          <span class="text-white">${escapeHtml(media.title)}</span>
        </nav>
        <article class="max-w-5xl mx-auto">
          <header class="mb-4">
            <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-2">${escapeHtml(media.title)}${yearDisplay}</h1>
            <div class="flex flex-wrap gap-2 text-xs font-semibold text-amber-400">
              ${genresList.map((g: string) => `<span>${escapeHtml(g)}</span>`).join(' · ')}
              ${media.voteAverage > 0 ? `<span>★ ${media.voteAverage.toFixed(1)}/10</span>` : ''}
            </div>
          </header>
          ${media.overview ? `<section class="mb-6"><h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-1">Synopsis</h2><p class="text-sm sm:text-base text-zinc-300 leading-relaxed">${escapeHtml(media.overview)}</p></section>` : ''}
          <div class="mt-6 pt-4 border-t border-white/10 flex flex-wrap gap-4 text-xs text-zinc-400">
            <a href="/" class="hover:text-white">← Back to T Stream Home</a>
            <a href="/movies" class="hover:text-white">Browse Movies</a>
            <a href="/tv-shows" class="hover:text-white">Browse TV Shows</a>
          </div>
        </article>
      </main>
    `.trim();

    result = setRootContent(result, semanticHtml);
    return result;
  }

  // 3. Public Hub & Landing Pages
  let pageTitle = DEFAULT_TITLE;
  let pageDesc = DEFAULT_DESC;
  let pageCanonical = `${PRIMARY_ORIGIN}/`;
  let h1Heading = 'Watch Movies & TV Shows Online Free';
  let breadcrumbTitle = 'Home';

  if (route?.type === 'movies') {
    pageTitle = 'Popular & Latest Movies Free HD — T Stream';
    pageDesc = 'Browse and watch thousands of blockbuster movies online in HD 1080p and 4K on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/movies`;
    h1Heading = 'Popular & Latest Movies Online in HD';
    breadcrumbTitle = 'Movies';
  } else if (route?.type === 'tv-shows') {
    pageTitle = 'TV Shows & Full Episodes Free — T Stream';
    pageDesc = 'Stream full seasons and episodes of your favorite TV series and dramas on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/tv-shows`;
    h1Heading = 'Watch TV Shows & Full Series Free';
    breadcrumbTitle = 'TV Shows';
  } else if (route?.type === 'trending') {
    pageTitle = 'Trending Movies & TV Shows Today — T Stream';
    pageDesc = 'Discover the hottest and most popular movies and series streaming right now on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/trending`;
    h1Heading = 'Trending Movies & Shows Today';
    breadcrumbTitle = 'Trending';
  } else if (route?.type === 'top-rated') {
    pageTitle = 'Top Rated Movies & Shows of All Time — T Stream';
    pageDesc = 'Explore the highest critically-acclaimed films and television series on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/top-rated`;
    h1Heading = 'Top Rated Movies & Series of All Time';
    breadcrumbTitle = 'Top Rated';
  } else if (route?.type === 'collections') {
    pageTitle = 'Movie Franchises & Sagas — T Stream';
    pageDesc = 'Explore complete cinematic universes and movie franchises on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/collections`;
    h1Heading = 'Movie Franchises & Sagas';
    breadcrumbTitle = 'Collections';
  } else if (route?.type === 'new-episodes') {
    pageTitle = 'New TV Episodes & Releases Today — Free HD Stream — T Stream';
    pageDesc = 'Track the latest TV episodes airing today and this week with notifications on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/new-episodes`;
    h1Heading = 'New TV Episodes Airing Today';
    breadcrumbTitle = 'New Episodes';
  } else if (route?.type === 'people') {
    pageTitle = 'Actors & Film Directors Directory — T Stream';
    pageDesc = 'Explore popular film and TV cast members, directors, and filmographies on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/people`;
    h1Heading = 'Actors & Film Directors Directory';
    breadcrumbTitle = 'People';
  } else if (route?.type === 'random') {
    pageTitle = 'Random Movie & TV Show Picker — Reshuffle 20 Titles — T Stream';
    pageDesc = 'Spin the wheel and pick from 20 random movies and TV series to watch online in HD on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/random`;
    h1Heading = 'Random Movie & TV Show Picker';
    breadcrumbTitle = 'Random';
  } else if (route?.type === 'tags') {
    pageTitle = 'Explore Movies & TV Series by Tag & Theme — T Stream';
    pageDesc = 'Browse movies and TV series by genre tropes, story moods, themes, and aesthetic tags on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/tags`;
    h1Heading = 'Explore Movies & Shows by Story Tag';
    breadcrumbTitle = 'Tags';
  } else if (route?.type === 'tag_detail' && route.tag) {
    const cleanTag = route.tag.toLowerCase();
    pageTitle = `Movies & TV Shows Tagged #${cleanTag} — Watch Online Free — T Stream`;
    pageDesc = `Discover top rated and popular movies and TV series tagged with #${cleanTag}. Stream free in 4K and 1080p HD with subtitles on T Stream.`;
    pageCanonical = `${PRIMARY_ORIGIN}/tags/${encodeURIComponent(cleanTag)}`;
    h1Heading = `Movies & Shows Tagged #${cleanTag}`;
    breadcrumbTitle = `#${cleanTag}`;
  } else if (route?.type === 'platform' && route.platform) {
    const name = route.platform.toUpperCase();
    pageTitle = `${name} Hub — Movies & TV Series — T Stream`;
    pageDesc = `Stream movies and television series from ${name} on T Stream.`;
    pageCanonical = `${PRIMARY_ORIGIN}/platform/${route.platform}`;
    h1Heading = `${name} Hub — Streaming Catalog`;
    breadcrumbTitle = `${name}`;
  } else if (route?.type === 'az' && route.letter) {
    pageTitle = `Titles Starting With ${route.letter} — A-Z Directory — T Stream`;
    pageDesc = `Browse movies and TV shows alphabetically starting with letter ${route.letter} on T Stream.`;
    pageCanonical = `${PRIMARY_ORIGIN}/az/${route.letter}`;
    h1Heading = `Movies & Shows Starting With "${route.letter}"`;
    breadcrumbTitle = `Letter ${route.letter}`;
  }

  result = setTitle(result, pageTitle);
  result = setMetaTag(result, 'name', 'title', pageTitle);
  result = setMetaTag(result, 'name', 'description', pageDesc);
  result = setMetaTag(result, 'name', 'keywords', DEFAULT_KEYWORDS);
  result = setCanonical(result, pageCanonical);
  result = setMetaTag(result, 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

  result = setMetaTag(result, 'property', 'og:title', pageTitle);
  result = setMetaTag(result, 'property', 'og:description', pageDesc);
  result = setMetaTag(result, 'property', 'og:image', DEFAULT_IMAGE);
  result = setMetaTag(result, 'property', 'og:image:secure_url', DEFAULT_IMAGE);
  result = setMetaTag(result, 'property', 'og:image:type', 'image/png');
  result = setMetaTag(result, 'property', 'og:image:alt', pageTitle);
  result = setMetaTag(result, 'property', 'og:url', pageCanonical);
  result = setMetaTag(result, 'property', 'og:type', 'website');
  result = setMetaTag(result, 'property', 'og:site_name', 'T Stream');
  result = setMetaTag(result, 'property', 'og:image:width', '1200');
  result = setMetaTag(result, 'property', 'og:image:height', '630');

  result = setMetaTag(result, 'name', 'twitter:card', 'summary_large_image');
  result = setMetaTag(result, 'name', 'twitter:title', pageTitle);
  result = setMetaTag(result, 'name', 'twitter:description', pageDesc);
  result = setMetaTag(result, 'name', 'twitter:image', DEFAULT_IMAGE);
  result = setMetaTag(result, 'name', 'twitter:image:alt', pageTitle);
  result = setMetaTag(result, 'name', 'twitter:url', pageCanonical);

  // Schema.org
  const landingSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': pageTitle,
    'description': pageDesc,
    'url': pageCanonical,
    'isPartOf': {
      '@type': 'WebSite',
      'name': 'T Stream',
      'url': `${PRIMARY_ORIGIN}/`
    }
  };
  result = setJsonLd(result, landingSchema);

  // Semantic HTML for crawlers
  const landingHtml = `
    <main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8" id="seo-prerender">
      <nav aria-label="Breadcrumb" class="text-xs text-zinc-400 mb-4 max-w-5xl mx-auto">
        <a href="/" class="hover:underline">Home</a> &gt;
        <span class="text-white">${escapeHtml(breadcrumbTitle)}</span>
      </nav>
      <header class="max-w-5xl mx-auto mb-6">
        <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-2">${escapeHtml(h1Heading)}</h1>
        <p class="text-sm sm:text-base text-zinc-300 max-w-2xl">${escapeHtml(pageDesc)}</p>
      </header>
      <section class="max-w-5xl mx-auto pt-6 border-t border-white/10 flex flex-wrap gap-4 text-xs text-zinc-400">
        <a href="/" class="hover:text-white">Home</a>
        <a href="/movies" class="hover:text-white">Movies</a>
        <a href="/tv-shows" class="hover:text-white">TV Shows</a>
        <a href="/trending" class="hover:text-white">Trending</a>
        <a href="/top-rated" class="hover:text-white">Top Rated</a>
        <a href="/collections" class="hover:text-white">Franchises</a>
        <a href="/tags" class="hover:text-white">Tags</a>
      </section>
    </main>
  `.trim();

  result = setRootContent(result, landingHtml);
  return result;
}

function findIndexHtml(root?: string): string | null {
  const candidates = [
    root ? path.resolve(root, 'index.html') : null,
    path.resolve(process.cwd(), 'index.html'),
    path.resolve('.', 'index.html')
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findDistHtml(root?: string): string | null {
  const candidates = [
    root ? path.resolve(root, 'dist/index.html') : null,
    path.resolve(process.cwd(), 'dist/index.html'),
    path.resolve('dist', 'index.html')
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Vite plugin for server-side SEO rendering.
 */
export function seoHtmlPlugin(): Plugin {
  return {
    name: 'seo-html-plugin',
    async transformIndexHtml(html: string, ctx: any) {
      const reqUrl = ctx?.originalUrl || ctx?.url || ctx?.path || '/';
      return await renderSeoHtml(html, reqUrl);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (req.method === 'GET' && req.headers.accept?.includes('text/html') && parseSeoRoute(url)) {
          try {
            const indexHtmlPath = findIndexHtml(server?.config?.root);
            if (indexHtmlPath) {
              let template = fs.readFileSync(indexHtmlPath, 'utf8');
              template = await server.transformIndexHtml(url, template);
              const transformed = await renderSeoHtml(template, url);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.statusCode = 200;
              res.end(transformed);
              return;
            }
          } catch (e) {
            console.error('Error in seoHtmlPlugin dev middleware:', e);
          }
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (req.method === 'GET' && req.headers.accept?.includes('text/html') && parseSeoRoute(url)) {
          try {
            const distHtmlPath = findDistHtml(server?.config?.root);
            if (distHtmlPath) {
              const template = fs.readFileSync(distHtmlPath, 'utf8');
              const transformed = await renderSeoHtml(template, url);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.statusCode = 200;
              res.end(transformed);
              return;
            }
          } catch (e) {
            console.error('Error in seoHtmlPlugin preview middleware:', e);
          }
        }
        next();
      });
    }
  };
}
