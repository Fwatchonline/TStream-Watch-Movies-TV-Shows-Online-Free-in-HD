/**
 * Vite Server-Side HTML SEO Plugin for TStream.online
 *
 * Pre-renders meta tags, dynamic keywords, canonical URLs, OpenGraph,
 * Twitter cards, and Schema.org JSON-LD structured data in the initial HTML response.
 * Guarantees web crawlers (Googlebot, Bing, Twitterbot, etc.) receive full SEO
 * without waiting for client-side JavaScript execution.
 */

import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { parseMediaSlug, slugifyTitle } from '../src/utils/slug.ts';
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

const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY || '844dba0bfd8f3a4f3799f6130ef9e335';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface ParsedSeoRoute {
  isMatched: boolean;
  mediaType: 'movie' | 'tv';
  id: number;
  slug: string;
  isWatchRoute: boolean;
  season?: number;
  episode?: number;
}

/**
 * Parses URL pathname to identify TStream media and watch routes.
 * Supports:
 * - /movie/:slug-:tmdbId
 * - /tv/:slug-:tmdbId
 * - /watch/movie/:slug-:tmdbId
 * - /watch/tv/:slug-:tmdbId
 * - /watch/tv/:slug-:tmdbId/:season/:episode
 */
export function parseSeoRoute(pathname: string): ParsedSeoRoute | null {
  if (!pathname) return null;
  const clean = pathname.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/');

  // 1. /watch/movie/:slug
  if (parts[0] === 'watch' && parts[1] === 'movie' && parts[2]) {
    const parsed = parseMediaSlug(parts[2]);
    if (parsed && !isNaN(parsed.id)) {
      return {
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
        isMatched: true,
        mediaType: 'tv',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: false
      };
    }
  }

  return null;
}

/**
 * Escapes HTML characters for safe attribute and title insertion.
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
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
 * Cache for server-side TMDB lookups to keep responses near-instantaneous.
 */
const serverMediaCache = new Map<string, { data: any; expiry: number }>();

/**
 * Fetches media details from TMDB with a timeout and memory caching.
 * Falls back to local curated data if TMDB is offline or fails.
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

  // 1. Attempt live TMDB fetch
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
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
        genres: (json.genres || []).map((g: any) => g.name || '')
      };
      serverMediaCache.set(cacheKey, { data, expiry: now + 60 * 60 * 1000 }); // 1h cache
      return data;
    }
  } catch {
    // TMDB fetch timed out or offline, fall back to catalog data
  }

  // 2. Fallback: readable title from slug
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
    genres: ['Action', 'Drama']
  };
}

/**
 * Transforms an HTML document string by applying full server-side SEO tags.
 */
export async function renderSeoHtml(html: string, urlPath: string, preloadedMedia?: any): Promise<string> {
  const route = parseSeoRoute(urlPath);

  // If not a media route, apply homepage or general catalog SEO
  if (!route) {
    let clean = urlPath.split('?')[0].split('#')[0];
    if (!clean.startsWith('/')) clean = '/' + clean;

    if (clean === '/' || clean === '/index.html') {
      let result = html;
      result = setTitle(result, DEFAULT_TITLE);
      result = setMetaTag(result, 'name', 'title', DEFAULT_TITLE);
      result = setMetaTag(result, 'name', 'description', DEFAULT_DESC);
      result = setMetaTag(result, 'name', 'keywords', DEFAULT_KEYWORDS);
      result = setCanonical(result, `${PRIMARY_ORIGIN}/`);
      result = setMetaTag(result, 'property', 'og:title', DEFAULT_TITLE);
      result = setMetaTag(result, 'property', 'og:description', DEFAULT_DESC);
      result = setMetaTag(result, 'property', 'og:image', DEFAULT_IMAGE);
      result = setMetaTag(result, 'property', 'og:image:secure_url', DEFAULT_IMAGE);
      result = setMetaTag(result, 'property', 'og:image:type', 'image/png');
      result = setMetaTag(result, 'property', 'og:image:alt', DEFAULT_TITLE);
      result = setMetaTag(result, 'property', 'og:url', `${PRIMARY_ORIGIN}/`);
      result = setMetaTag(result, 'property', 'og:image:width', '1200');
      result = setMetaTag(result, 'property', 'og:image:height', '630');
      result = setMetaTag(result, 'name', 'twitter:title', DEFAULT_TITLE);
      result = setMetaTag(result, 'name', 'twitter:description', DEFAULT_DESC);
      result = setMetaTag(result, 'name', 'twitter:image', DEFAULT_IMAGE);
      result = setMetaTag(result, 'name', 'twitter:url', `${PRIMARY_ORIGIN}/`);
      return result;
    }
    return html;
  }

  // 1. Resolve media data
  const media = preloadedMedia || (await fetchServerMedia(route.mediaType, route.id, route.slug));

  // 2. Generate synchronized media metadata
  const meta = buildMediaMetadata(media, {
    season: route.season,
    episode: route.episode,
    isWatching: route.isWatchRoute
  });

  // 3. Inject tags into HTML
  let result = html;

  // Title tags (must be identical)
  result = setTitle(result, meta.title);
  result = setMetaTag(result, 'name', 'title', meta.title);

  // Description
  result = setMetaTag(result, 'name', 'description', meta.description);

  // Dynamic Keywords
  result = setMetaTag(result, 'name', 'keywords', meta.keywords);

  // Canonical URL
  result = setCanonical(result, meta.canonicalUrl);

  // OpenGraph tags
  result = setMetaTag(result, 'property', 'og:title', meta.title);
  result = setMetaTag(result, 'property', 'og:description', meta.description);
  result = setMetaTag(result, 'property', 'og:image', meta.image);
  result = setMetaTag(result, 'property', 'og:image:secure_url', meta.image);
  result = setMetaTag(result, 'property', 'og:image:type', meta.mimeType);
  result = setMetaTag(result, 'property', 'og:image:alt', meta.rawTitle);
  result = setMetaTag(result, 'property', 'og:url', meta.canonicalUrl);
  result = setMetaTag(result, 'property', 'og:type', meta.type);
  result = setMetaTag(result, 'property', 'og:site_name', 'T Stream');

  // OpenGraph image dimensions:
  // If not default og-image, REMOVE og:image:width and og:image:height completely!
  if (meta.isDefaultOgImage) {
    result = setMetaTag(result, 'property', 'og:image:width', '1200');
    result = setMetaTag(result, 'property', 'og:image:height', '630');
  } else {
    result = removeMetaTag(result, 'property', 'og:image:width');
    result = removeMetaTag(result, 'property', 'og:image:height');
  }

  // Twitter tags
  result = setMetaTag(result, 'name', 'twitter:card', 'summary_large_image');
  result = setMetaTag(result, 'name', 'twitter:title', meta.title);
  result = setMetaTag(result, 'name', 'twitter:description', meta.description);
  result = setMetaTag(result, 'name', 'twitter:image', meta.image);
  result = setMetaTag(result, 'name', 'twitter:image:alt', meta.rawTitle);
  result = setMetaTag(result, 'name', 'twitter:url', meta.canonicalUrl);

  // Schema.org JSON-LD
  result = setJsonLd(result, meta.schema);

  return result;
}

function findIndexHtml(root?: string): string | null {
  const candidates = [
    root ? path.resolve(root, 'index.html') : null,
    path.resolve(process.cwd(), 'index.html'),
    path.resolve('.', 'index.html')
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
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
    if (fs.existsSync(candidate)) {
      return candidate;
    }
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
      // Intercept direct HTML document requests in dev mode
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
      // Intercept direct HTML document requests in preview mode
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

