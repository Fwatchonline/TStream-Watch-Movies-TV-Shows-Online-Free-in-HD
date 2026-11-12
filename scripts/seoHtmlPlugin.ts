/**
 * Server-Side & Build-Time HTML SEO Engine for TStream.online
 *
 * Pre-renders meta tags, dynamic keywords, canonical URLs, OpenGraph,
 * Twitter cards, Schema.org JSON-LD structured data, and semantic HTML body
 * in the initial HTML response for crawlers and users alike.
 *
 * Enforces genuine HTTP status codes:
 * - 200 OK for valid routes
 * - 404 Not Found for nonexistent movies, series, episodes, tags, people, platforms, or unknown routes
 * - 503 Service Unavailable for temporary upstream TMDB failures without usable cache
 */

import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { parseMediaSlug, createMediaSlug } from '../src/utils/slug.ts';
import {
  buildMediaMetadata,
  resolveRouteSeoPolicy,
  DEFAULT_TITLE,
  DEFAULT_DESC,
  DEFAULT_KEYWORDS,
  DEFAULT_IMAGE,
  PRIMARY_ORIGIN,
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

import {
  PLATFORM_CONFIGS,
  PLATFORM_ALIASES,
  getPlatformConfigById,
  getConfiguredWatchRegion,
  normalizeWatchRegion,
  type PlatformMeta
} from '../src/services/platformConfig.ts';
import {
  buildPlatformDiscoverPlan,
  computeBalancedTopRatedPlan,
  mergeBalancedTopRatedSlices,
  sortNormalizedMedia
} from '../src/services/platformDiscovery.ts';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const PAGE_SIZE = 12;

export function getServerTmdbApiKey(): string {
  return (process.env.TMDB_API_KEY || '').trim();
}

export const SUPPORTED_PLATFORM_META: Record<string, { name: string; description: string }> = Object.fromEntries([
  ...PLATFORM_CONFIGS.map(p => [p.id, { name: p.name, description: p.description }]),
  ...Object.entries(PLATFORM_ALIASES).map(([alias, target]) => {
    const cfg = getPlatformConfigById(target);
    return [alias, { name: cfg?.name || target.toUpperCase(), description: cfg?.description || '' }];
  })
]);

const KNOWN_POPULAR_PEOPLE: Record<number, { name: string; knownForDepartment: string; bio: string }> = {
  1136406: { name: 'Tom Holland', knownForDepartment: 'Acting', bio: 'Tom Holland is an English actor widely known for starring as Spider-Man in the Marvel Cinematic Universe.' },
  505710: { name: 'Zendaya', knownForDepartment: 'Acting', bio: 'Zendaya is an American actress and singer celebrated for Euphoria, Dune, and Spider-Man.' },
  525: { name: 'Christopher Nolan', knownForDepartment: 'Directing', bio: 'Christopher Nolan is a British-American filmmaker known for Oppenheimer, Interstellar, Inception, and The Dark Knight.' },
  2037: { name: 'Cillian Murphy', knownForDepartment: 'Acting', bio: 'Cillian Murphy is an Irish actor known for Oppenheimer, Peaky Blinders, and Inception.' },
  138: { name: 'Quentin Tarantino', knownForDepartment: 'Directing', bio: 'Quentin Tarantino is an American filmmaker known for Pulp Fiction, Inglourious Basterds, and Django Unchained.' },
  137427: { name: 'Denis Villeneuve', knownForDepartment: 'Directing', bio: 'Denis Villeneuve is a Canadian filmmaker known for Dune, Blade Runner 2049, Arrival, and Sicario.' },
  6193: { name: 'Leonardo DiCaprio', knownForDepartment: 'Acting', bio: 'Leonardo DiCaprio is an American actor and producer known for Inception, Titanic, and The Wolf of Wall Street.' },
  234352: { name: 'Margot Robbie', knownForDepartment: 'Acting', bio: 'Margot Robbie is an Australian actress and producer known for Barbie and The Wolf of Wall Street.' },
  2710: { name: 'James Cameron', knownForDepartment: 'Directing', bio: 'James Cameron is a Canadian filmmaker known for Avatar, Titanic, and Terminator 2.' },
  1032: { name: 'Martin Scorsese', knownForDepartment: 'Directing', bio: 'Martin Scorsese is an American filmmaker known for Goodfellas, Taxi Driver, and The Departed.' },
  3223: { name: 'Robert Downey Jr.', knownForDepartment: 'Acting', bio: 'Robert Downey Jr. is an American actor known for Iron Man, Avengers: Endgame, and Oppenheimer.' },
  30614: { name: 'Ryan Gosling', knownForDepartment: 'Acting', bio: 'Ryan Gosling is a Canadian actor known for Blade Runner 2049, La La Land, and Drive.' },
  1083010: { name: 'Destin Daniel Cretton', knownForDepartment: 'Directing', bio: 'Destin Daniel Cretton is an American filmmaker known for Shang-Chi and Short Term 12.' }
};

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
  | 'noindex'
  | 'notfound';

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
  isPlatformAlias?: boolean;
  letter?: string;
  personId?: number;
}

export interface RenderSeoOptions {
  preloadedMedia?: any;
  fetchImpl?: typeof fetch;
  tmdbApiKey?: string;
}

/**
 * Returns a deduplicated array of all catalog media items (movies and shows).
 */
export function getAllCatalogMedia(): any[] {
  const map = new Map<string, any>();

  for (const m of DETAILED_MOVIES) {
    if (m && m.id) map.set(`movie:${m.id}`, { ...m, mediaType: 'movie' });
  }

  for (const s of DETAILED_TV_SHOWS) {
    if (s && s.id) map.set(`tv:${s.id}`, { ...s, mediaType: 'tv' });
  }

  const collections = [SPIDERMAN_COLLECTION, AVENGERS_COLLECTION, HARRY_POTTER_COLLECTION, PIRATES_COLLECTION];
  for (const c of collections) {
    for (const part of c.parts) {
      const id = part.id || (part as any).tmdbId;
      if (id && !map.has(`movie:${id}`)) {
        map.set(`movie:${id}`, { ...part, mediaType: 'movie' });
      }
    }
  }

  for (const item of EXPANDED_CATALOG) {
    if (item && item.id) {
      const mType = item.mediaType === 'tv' ? 'tv' : 'movie';
      if (!map.has(`${mType}:${item.id}`)) {
        map.set(`${mType}:${item.id}`, { ...item, mediaType: mType });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Finds all genuine catalog items matching a given tag or theme.
 */
export function getMatchingCatalogForTag(rawTag: string): any[] {
  if (!rawTag) return [];
  const tag = rawTag.toLowerCase().trim().replace(/^#/, '');
  if (!tag) return [];
  const allMedia = getAllCatalogMedia();

  return allMedia.filter(item => {
    if (Array.isArray(item.keywords)) {
      for (const kw of item.keywords) {
        const kwName = (typeof kw === 'string' ? kw : kw?.name || '').toLowerCase();
        if (kwName && (kwName === tag || kwName.includes(tag) || tag.includes(kwName))) {
          return true;
        }
      }
    }

    const title = (item.title || item.name || '').toLowerCase();
    const overview = (item.overview || '').toLowerCase();
    if (title.includes(tag) || overview.includes(tag)) {
      return true;
    }

    if (Array.isArray(item.genres)) {
      for (const g of item.genres) {
        const gName = (typeof g === 'string' ? g : g?.name || '').toLowerCase();
        if (
          gName === tag ||
          (tag === 'magic' && gName === 'fantasy') ||
          (tag === 'superhero' && gName === 'action')
        ) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Finds all catalog items starting with a specific letter or digit bucket.
 */
export function getMatchingCatalogForLetter(letter: string): any[] {
  if (!letter) return [];
  const l = letter.toUpperCase().trim();
  const allMedia = getAllCatalogMedia();

  if (l === '0-9') {
    return allMedia.filter(item => /^[0-9]/.test((item.title || item.name || '').trim()));
  }

  return allMedia.filter(item => {
    const title = (item.title || item.name || '').trim().toUpperCase();
    return title.startsWith(l);
  });
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
  if (parts[0] === 'watch' && parts[1] === 'movie') {
    if (parts.length !== 3 || !parts[2]) {
      return { type: 'notfound', isMatched: false };
    }
    const parsed = parseMediaSlug(parts[2]);
    if (parsed && Number.isInteger(parsed.id) && parsed.id > 0) {
      return {
        type: 'watch_movie',
        isMatched: true,
        mediaType: 'movie',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: true
      };
    }
    return { type: 'notfound', isMatched: false };
  }

  // 2. /watch/tv/:slug or /watch/tv/:slug/:season/:episode
  if (parts[0] === 'watch' && parts[1] === 'tv') {
    if ((parts.length !== 3 && parts.length !== 5) || !parts[2]) {
      return { type: 'notfound', isMatched: false };
    }
    const parsed = parseMediaSlug(parts[2]);
    if (!parsed || !Number.isInteger(parsed.id) || parsed.id <= 0) {
      return { type: 'notfound', isMatched: false };
    }
    if (parts.length === 5) {
      if (!/^\d+$/.test(parts[3]) || !/^\d+$/.test(parts[4])) {
        return { type: 'notfound', isMatched: false };
      }
      const season = parseInt(parts[3], 10);
      const episode = parseInt(parts[4], 10);
      return {
        type: 'watch_tv',
        isMatched: true,
        mediaType: 'tv',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: true,
        season,
        episode
      };
    }
    return {
      type: 'watch_tv',
      isMatched: true,
      mediaType: 'tv',
      id: parsed.id,
      slug: parsed.slug,
      isWatchRoute: true
    };
  }

  // 3. /movie/:slug
  if (parts[0] === 'movie') {
    if (parts.length !== 2 || !parts[1]) {
      return { type: 'notfound', isMatched: false };
    }
    const parsed = parseMediaSlug(parts[1]);
    if (parsed && Number.isInteger(parsed.id) && parsed.id > 0) {
      return {
        type: 'movie',
        isMatched: true,
        mediaType: 'movie',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: false
      };
    }
    return { type: 'notfound', isMatched: false };
  }

  // 4. /tv/:slug
  if (parts[0] === 'tv') {
    if (parts.length !== 2 || !parts[1]) {
      return { type: 'notfound', isMatched: false };
    }
    const parsed = parseMediaSlug(parts[1]);
    if (parsed && Number.isInteger(parsed.id) && parsed.id > 0) {
      return {
        type: 'tv',
        isMatched: true,
        mediaType: 'tv',
        id: parsed.id,
        slug: parsed.slug,
        isWatchRoute: false
      };
    }
    return { type: 'notfound', isMatched: false };
  }

  // 5. Landing pages
  if (parts.length === 1) {
    if (parts[0] === 'movies') return { type: 'movies', isMatched: true };
    if (parts[0] === 'tv-shows') return { type: 'tv-shows', isMatched: true };
    if (parts[0] === 'trending') return { type: 'trending', isMatched: true };
    if (parts[0] === 'top-rated') return { type: 'top-rated', isMatched: true };
    if (parts[0] === 'collections') return { type: 'collections', isMatched: true };
    if (parts[0] === 'new-episodes') return { type: 'new-episodes', isMatched: true };
    if (parts[0] === 'people') return { type: 'people', isMatched: true };
    if (parts[0] === 'random') return { type: 'random', isMatched: true };
  }

  // 6. /person/:id
  if (parts[0] === 'person' && parts.length === 2 && parts[1]) {
    if (/^\d+$/.test(parts[1])) {
      const pid = parseInt(parts[1], 10);
      if (pid > 0) {
        return { type: 'person', isMatched: true, personId: pid };
      }
    }
    return { type: 'notfound', isMatched: false };
  }

  // 7. /tags and /tags/:tag
  if (parts[0] === 'tags' || parts[0] === 'tag') {
    if (parts.length === 1) {
      return { type: 'tags', isMatched: true };
    }
    if (parts.length === 2 && parts[1]) {
      try {
        const tag = decodeURIComponent(parts[1]).toLowerCase().replace(/^#/, '').trim();
        if (!tag || tag.length > 60 || /[<>]/.test(tag)) {
          return { type: 'notfound', isMatched: false };
        }
        return { type: 'tag_detail', isMatched: true, tag };
      } catch {
        return { type: 'notfound', isMatched: false };
      }
    }
    return { type: 'notfound', isMatched: false };
  }

  // 8. /platform/:platform
  if (parts[0] === 'platform' && parts.length === 2 && parts[1]) {
    const rawPlat = parts[1].toLowerCase();
    const cfg = getPlatformConfigById(rawPlat);
    if (cfg && (cfg.id === rawPlat || PLATFORM_ALIASES[rawPlat])) {
      return {
        type: 'platform',
        isMatched: true,
        platform: cfg.id,
        isPlatformAlias: Boolean(PLATFORM_ALIASES[rawPlat])
      };
    }
    return { type: 'notfound', isMatched: false };
  }

  // 9. /az/:letter
  if (parts[0] === 'az' && parts.length === 2 && parts[1]) {
    const upper = parts[1].toUpperCase();
    if (/^[A-Z]$/.test(upper) || upper === '0-9') {
      return { type: 'az', isMatched: true, letter: upper };
    }
    return { type: 'notfound', isMatched: false };
  }

  // 10. Private / search pages (noindex)
  if (['search', 'library', 'admin', 'settings', 'player-settings'].includes(parts[0])) {
    return { type: 'noindex', isMatched: true };
  }

  return { type: 'notfound', isMatched: false };
}

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

function setMetaTag(html: string, attrName: 'name' | 'property', attrVal: string, content: string): string {
  const escapedContent = escapeHtml(content);
  const regex = new RegExp(`<meta\\s+[^>]*${attrName}=["']${attrVal}["'][^>]*>`, 'i');
  const newTag = `<meta ${attrName}="${attrVal}" content="${escapedContent}" />`;
  if (regex.test(html)) {
    return html.replace(regex, newTag);
  }
  return html.replace('</head>', `    ${newTag}\n  </head>`);
}

export function removeMetaTag(html: string, attrName: 'name' | 'property', attrVal: string): string {
  const regex = new RegExp(`<meta\\s+[^>]*${attrName}=["']${attrVal}["'][^>]*>\\s*`, 'gi');
  return html.replace(regex, '');
}

function setTitle(html: string, title: string): string {
  const regex = /<title>[\s\S]*?<\/title>/i;
  const newTag = `<title>${escapeHtml(title)}</title>`;
  if (regex.test(html)) {
    return html.replace(regex, newTag);
  }
  return html.replace('</head>', `    ${newTag}\n  </head>`);
}

function setCanonical(html: string, canonicalUrl: string): string {
  // Remove any duplicate canonical link tags before inserting single canonical
  let cleaned = html.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi, '');
  const newTag = `<link rel="canonical" id="tstream-canonical" href="${escapeHtml(canonicalUrl)}" />`;
  if (/<\/head>/i.test(cleaned)) {
    return cleaned.replace(/<\/head>/i, `    ${newTag}\n  </head>`);
  }
  return `${newTag}\n${cleaned}`;
}

function setJsonLd(html: string, schema: Record<string, any>): string {
  const jsonString = JSON.stringify(schema, null, 2);
  const regex = /<script\s+[^>]*id=["']json-ld-schema["'][^>]*>[\s\S]*?<\/script>/i;
  const newTag = `<script type="application/ld+json" id="json-ld-schema">\n${jsonString}\n    </script>`;
  if (regex.test(html)) {
    return html.replace(regex, newTag);
  }
  return html.replace('</head>', `    ${newTag}\n  </head>`);
}

function setRootContent(html: string, bodyContent: string): string {
  const openRegex = /<div\s+id=["']root["'][^>]*>/i;
  const openMatch = openRegex.exec(html);
  if (!openMatch) return html;

  const replacement = `<div id="root">\n${bodyContent}\n    </div>`;
  const startIdx = openMatch.index;
  const contentStart = startIdx + openMatch[0].length;

  const divTagRegex = /<\/?div\b[^>]*>/gi;
  divTagRegex.lastIndex = contentStart;
  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = divTagRegex.exec(html)) !== null) {
    const tag = match[0].toLowerCase();
    if (tag.startsWith('</div')) {
      depth -= 1;
      if (depth === 0) {
        const endIdx = match.index + match[0].length;
        return `${html.slice(0, startIdx)}${replacement}${html.slice(endIdx)}`;
      }
    } else if (!tag.endsWith('/>')) {
      depth += 1;
    }
  }

  return html;
}

function make503Error(msg: string) {
  const err: any = new Error(msg);
  err.status = 503;
  return err;
}

interface CacheRecord<T> {
  data: T;
  freshUntil: number;
  staleUntil: number;
}

export class LruTtlCache<T> {
  private map = new Map<string, CacheRecord<T>>();
  private maxEntries: number;
  private freshTtlMs: number;
  private staleTtlMs: number;

  constructor(maxEntries = 400, freshTtlMs = 5 * 60 * 1000, staleTtlMs = 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.freshTtlMs = freshTtlMs;
    this.staleTtlMs = staleTtlMs;
  }

  getFresh(key: string, now = Date.now()): T | undefined {
    const rec = this.map.get(key);
    if (!rec) return undefined;
    if (rec.freshUntil > now) {
      // Promote for LRU
      this.map.delete(key);
      this.map.set(key, rec);
      return rec.data;
    }
    if (rec.staleUntil <= now) {
      this.map.delete(key);
    }
    return undefined;
  }

  getStale(key: string, now = Date.now()): T | undefined {
    const rec = this.map.get(key);
    if (!rec) return undefined;
    if (rec.staleUntil > now) {
      return rec.data;
    }
    this.map.delete(key);
    return undefined;
  }

  set(key: string, data: T, now = Date.now()): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, {
      data,
      freshUntil: now + this.freshTtlMs,
      staleUntil: now + this.staleTtlMs
    });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      } else {
        break;
      }
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const serverMediaCache = new LruTtlCache<any>(400, 15 * 60 * 1000, 6 * 60 * 60 * 1000);
const serverEpisodeCache = new LruTtlCache<any>(400, 15 * 60 * 1000, 6 * 60 * 60 * 1000);
const serverTagCache = new LruTtlCache<{ valid: boolean; items: any[] }>(250, 10 * 60 * 1000, 2 * 60 * 60 * 1000);
const serverPersonCache = new LruTtlCache<any>(250, 15 * 60 * 1000, 6 * 60 * 60 * 1000);
const serverCatalogCache = new LruTtlCache<{ items: any[]; totalPages: number }>(250, 5 * 60 * 1000, 60 * 60 * 1000);
const serverPlatformCache = new LruTtlCache<{ items: any[]; totalPages: number }>(250, 5 * 60 * 1000, 60 * 60 * 1000);
const inFlightLookups = new Map<string, Promise<any>>();

export function clearSeoPluginCaches(): void {
  serverMediaCache.clear();
  serverEpisodeCache.clear();
  serverTagCache.clear();
  serverPersonCache.clear();
  serverCatalogCache.clear();
  serverPlatformCache.clear();
  inFlightLookups.clear();
}

function coalesceLookup<T>(key: string, enabled: boolean, work: () => Promise<T>): Promise<T> {
  if (!enabled) return work();
  const existing = inFlightLookups.get(key);
  if (existing) return existing as Promise<T>;
  const promise = work().finally(() => {
    inFlightLookups.delete(key);
  });
  inFlightLookups.set(key, promise);
  return promise;
}

/**
 * Fetches media details: checks local catalog data first (with strict id + mediaType matching),
 * then queries live TMDB when configured.
 * Throws 503 error if TMDB returns 429/5xx/network timeout and no stale cache exists. Returns null if 404.
 */
export async function fetchServerMedia(
  mediaType: 'movie' | 'tv',
  id: number,
  _fallbackSlug?: string,
  fetchImpl: typeof fetch = fetch,
  tmdbApiKey: string = getServerTmdbApiKey()
): Promise<any | null> {
  if (!id || id <= 0) return null;

  const useCache = fetchImpl === fetch;
  const cacheKey = `${mediaType}:${id}`;
  if (useCache) {
    const fresh = serverMediaCache.getFresh(cacheKey);
    if (fresh) return fresh;
  }

  // 1. Check local catalog first (strictly matching id AND mediaType)
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
      if (useCache) serverMediaCache.set(cacheKey, data);
      return data;
    }

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
        if (useCache) serverMediaCache.set(cacheKey, data);
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
        genres: (localShow.genres || []).map((g: any) => (typeof g === 'string' ? g : g?.name || '')),
        numberOfSeasons: localShow.numberOfSeasons || (localShow.seasons ? localShow.seasons.length : undefined),
        seasons: localShow.seasons || []
      };
      if (useCache) serverMediaCache.set(cacheKey, data);
      return data;
    }
  }

  const catalogItem = EXPANDED_CATALOG.find(i => i.id === id && i.mediaType === mediaType);
  if (catalogItem) {
    const title = catalogItem.title || (catalogItem as any).name || '';
    const data = {
      id: catalogItem.id,
      mediaType,
      title,
      name: title,
      overview: catalogItem.overview || '',
      releaseDate: catalogItem.releaseDate || '',
      firstAirDate: mediaType === 'tv' ? catalogItem.releaseDate || '' : undefined,
      voteAverage: catalogItem.voteAverage || 0,
      voteCount: catalogItem.voteCount || 0,
      backdropPath: catalogItem.backdropPath || '',
      posterPath: catalogItem.posterPath || '',
      genres: (catalogItem.genres || []).map((g: any) => (typeof g === 'string' ? g : g?.name || '')),
      numberOfSeasons: (catalogItem as any).numberOfSeasons
    };
    if (useCache) serverMediaCache.set(cacheKey, data);
    return data;
  }

  // 2. Attempt live TMDB fetch if key is configured or custom fetchImpl is injected for tests
  const effectiveKey = tmdbApiKey || (fetchImpl !== fetch ? 'test-key' : '');
  if (!effectiveKey) {
    return null;
  }

  return coalesceLookup(`media:${cacheKey}`, useCache, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetchImpl(`${TMDB_BASE_URL}/${mediaType}/${id}?api_key=${effectiveKey}`, {
        signal: controller.signal
      });

      if (res.status === 404) {
        return null;
      }

      if (res.status === 429 || res.status >= 500) {
        if (useCache) {
          const stale = serverMediaCache.getStale(cacheKey);
          if (stale) return stale;
        }
        throw make503Error(`TMDB upstream returned HTTP ${res.status}`);
      }

      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      const rawTitle = json.title || json.name || '';
      if (!rawTitle) return null;

      const data = {
        id: json.id || id,
        mediaType,
        title: rawTitle,
        name: rawTitle,
        overview: json.overview || '',
        releaseDate: json.release_date || json.first_air_date || '',
        firstAirDate: json.first_air_date || '',
        voteAverage: Number(json.vote_average || 0),
        voteCount: Number(json.vote_count || 0),
        backdropPath: json.backdrop_path ? `https://image.tmdb.org/t/p/w1280${json.backdrop_path}` : '',
        posterPath: json.poster_path ? `https://image.tmdb.org/t/p/w500${json.poster_path}` : '',
        genres: (json.genres || []).map((g: any) => g.name || '').filter(Boolean),
        numberOfSeasons: json.number_of_seasons,
        seasons: Array.isArray(json.seasons)
          ? json.seasons.map((s: any) => ({
              seasonNumber: s.season_number,
              episodeCount: s.episode_count,
              name: s.name,
              airDate: s.air_date
            }))
          : []
      };
      if (useCache) serverMediaCache.set(cacheKey, data);
      return data;
    } catch (err: any) {
      if (useCache) {
        const stale = serverMediaCache.getStale(cacheKey);
        if (stale) return stale;
      }
      if (err?.status === 503) throw err;
      throw make503Error(err?.name === 'AbortError' ? 'TMDB connection timed out' : 'TMDB upstream unavailable');
    } finally {
      clearTimeout(timeout);
    }
  });
}

/**
 * Validates and fetches metadata for a specific TV episode.
 * Returns null if the season or episode does not exist (triggering HTTP 404).
 * Throws 503 on upstream timeout/429/5xx without usable local season data.
 */
export async function fetchServerEpisode(
  show: any,
  season: number,
  episode: number,
  fetchImpl: typeof fetch = fetch,
  tmdbApiKey: string = getServerTmdbApiKey()
): Promise<{ name: string; overview?: string; airDate?: string } | null> {
  if (!show || !Number.isInteger(season) || !Number.isInteger(episode) || season < 1 || episode < 1) {
    return null;
  }

  if (show.numberOfSeasons && season > show.numberOfSeasons) {
    return null;
  }

  const seasonObj = Array.isArray(show.seasons)
    ? show.seasons.find((s: any) => s.seasonNumber === season)
    : undefined;

  if (seasonObj?.episodes && Array.isArray(seasonObj.episodes)) {
    const exactEp = seasonObj.episodes.find((e: any) => e.episodeNumber === episode);
    if (exactEp) {
      return {
        name: exactEp.name || `Episode ${episode}`,
        overview: exactEp.overview || show.overview || '',
        airDate: exactEp.airDate || seasonObj.airDate || ''
      };
    }
  }

  if (seasonObj?.episodeCount && episode > seasonObj.episodeCount) {
    return null;
  }

  const useCache = fetchImpl === fetch;
  const cacheKey = `${show.id}:${season}:${episode}`;
  if (useCache) {
    const fresh = serverEpisodeCache.getFresh(cacheKey);
    if (fresh) return fresh;
  }

  const effectiveKey = tmdbApiKey || (fetchImpl !== fetch ? 'test-key' : '');
  if (effectiveKey) {
    return coalesceLookup(`episode:${cacheKey}`, useCache, async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetchImpl(
          `${TMDB_BASE_URL}/tv/${show.id}/season/${season}/episode/${episode}?api_key=${effectiveKey}`,
          { signal: controller.signal }
        );
        if (res.status === 404) {
          return null;
        }
        if (res.status === 429 || res.status >= 500) {
          if (useCache) {
            const stale = serverEpisodeCache.getStale(cacheKey);
            if (stale) return stale;
          }
          if (seasonObj && episode <= (seasonObj.episodeCount || 1)) {
            return {
              name: `Episode ${episode}`,
              overview: show.overview || '',
              airDate: seasonObj.airDate || ''
            };
          }
          throw make503Error(`TMDB episode lookup returned HTTP ${res.status}`);
        }
        if (res.ok) {
          const epJson = await res.json();
          const data = {
            name: epJson.name || `Episode ${episode}`,
            overview: epJson.overview || show.overview || '',
            airDate: epJson.air_date || ''
          };
          if (useCache) serverEpisodeCache.set(cacheKey, data);
          return data;
        }
      } catch (err: any) {
        if (useCache) {
          const stale = serverEpisodeCache.getStale(cacheKey);
          if (stale) return stale;
        }
        if (seasonObj && episode <= (seasonObj.episodeCount || 1)) {
          return {
            name: `Episode ${episode}`,
            overview: show.overview || '',
            airDate: seasonObj.airDate || ''
          };
        }
        if (err?.status === 503) throw err;
        throw make503Error('TMDB episode lookup failed');
      } finally {
        clearTimeout(timeout);
      }
      return null;
    });
  }

  // Offline local validation when TMDB key is not configured
  if (seasonObj && episode <= (seasonObj.episodeCount || 1)) {
    return {
      name: `Episode ${episode}`,
      overview: show.overview || '',
      airDate: seasonObj.airDate || ''
    };
  }

  if (!seasonObj && show.numberOfSeasons && season <= show.numberOfSeasons && episode <= 25) {
    return {
      name: `Episode ${episode}`,
      overview: show.overview || ''
    };
  }

  return null;
}

/**
 * Validates a tag and gathers matching items from local catalog and TMDB keywords.
 */
export async function fetchServerTagMedia(
  rawTag: string,
  fetchImpl: typeof fetch = fetch,
  tmdbApiKey: string = getServerTmdbApiKey()
): Promise<{ valid: boolean; items: any[] }> {
  const cleanTag = (rawTag || '').toLowerCase().trim().replace(/^#/, '');
  if (!cleanTag || cleanTag.length > 60) {
    return { valid: false, items: [] };
  }

  const useCache = fetchImpl === fetch;
  if (useCache) {
    const fresh = serverTagCache.getFresh(cleanTag);
    if (fresh) return fresh;
  }

  const localMatches = getMatchingCatalogForTag(cleanTag);
  const isKnownPopularTag = POPULAR_TAGS.some(t => t.name.toLowerCase() === cleanTag);

  const effectiveKey = tmdbApiKey || (fetchImpl !== fetch ? 'test-key' : '');
  if (!effectiveKey) {
    const result = {
      valid: isKnownPopularTag || localMatches.length > 0,
      items: localMatches
    };
    if (useCache) serverTagCache.set(cleanTag, result);
    return result;
  }

  return coalesceLookup(`tag:${cleanTag}`, useCache, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const kwRes = await fetchImpl(
        `${TMDB_BASE_URL}/search/keyword?api_key=${effectiveKey}&query=${encodeURIComponent(cleanTag)}&page=1`,
        { signal: controller.signal }
      );

      if (kwRes.status === 429 || kwRes.status >= 500) {
        if (useCache) {
          const stale = serverTagCache.getStale(cleanTag);
          if (stale) return stale;
        }
        if (localMatches.length > 0 || isKnownPopularTag) {
          return { valid: true, items: localMatches };
        }
        throw make503Error(`TMDB keyword lookup failed with HTTP ${kwRes.status}`);
      }

      if (kwRes.ok) {
        const kwData = await kwRes.json();
        const keywords = Array.isArray(kwData?.results) ? kwData.results : [];
        const exactKw =
          keywords.find((k: any) => String(k.name || '').toLowerCase() === cleanTag) ||
          keywords[0];

        if (exactKw && exactKw.id) {
          const [movRes, tvRes] = await Promise.all([
            fetchImpl(
              `${TMDB_BASE_URL}/discover/movie?api_key=${effectiveKey}&with_keywords=${exactKw.id}&sort_by=popularity.desc&page=1`,
              { signal: controller.signal }
            ).catch(() => null),
            fetchImpl(
              `${TMDB_BASE_URL}/discover/tv?api_key=${effectiveKey}&with_keywords=${exactKw.id}&sort_by=popularity.desc&page=1`,
              { signal: controller.signal }
            ).catch(() => null)
          ]);

          const mergedMap = new Map<string, any>();
          for (const item of localMatches) {
            mergedMap.set(`${item.mediaType || 'movie'}:${item.id}`, item);
          }

          if (movRes && movRes.ok) {
            const movJson = await movRes.json();
            for (const r of movJson.results || []) {
              if (!r.id || (!r.title && !r.name)) continue;
              mergedMap.set(`movie:${r.id}`, {
                id: r.id,
                mediaType: 'movie',
                title: r.title || r.name,
                releaseDate: r.release_date || '',
                voteAverage: r.vote_average || 0,
                posterPath: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : ''
              });
            }
          }

          if (tvRes && tvRes.ok) {
            const tvJson = await tvRes.json();
            for (const r of tvJson.results || []) {
              if (!r.id || (!r.name && !r.title)) continue;
              mergedMap.set(`tv:${r.id}`, {
                id: r.id,
                mediaType: 'tv',
                title: r.name || r.title,
                name: r.name || r.title,
                releaseDate: r.first_air_date || '',
                voteAverage: r.vote_average || 0,
                posterPath: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : ''
              });
            }
          }

          const result = { valid: true, items: Array.from(mergedMap.values()) };
          if (useCache) serverTagCache.set(cleanTag, result);
          return result;
        }
      }

      const fallback = {
        valid: isKnownPopularTag || localMatches.length > 0,
        items: localMatches
      };
      if (useCache) serverTagCache.set(cleanTag, fallback);
      return fallback;
    } catch (err: any) {
      if (useCache) {
        const stale = serverTagCache.getStale(cleanTag);
        if (stale) return stale;
      }
      if (localMatches.length > 0 || isKnownPopularTag) {
        return { valid: true, items: localMatches };
      }
      if (err?.status === 503) throw err;
      throw make503Error('TMDB tag discovery unavailable');
    } finally {
      clearTimeout(timeout);
    }
  });
}

function normalizeServerTmdbListItem(r: any, forcedType?: 'movie' | 'tv') {
  const mType: 'movie' | 'tv' = forcedType || (r.media_type === 'tv' || (!r.title && r.first_air_date) ? 'tv' : 'movie');
  const title = r.title || r.name || '';
  return {
    id: r.id,
    mediaType: mType,
    title,
    name: title,
    releaseDate: r.release_date || r.first_air_date || '',
    firstAirDate: mType === 'tv' ? r.first_air_date || '' : undefined,
    voteAverage: Number(r.vote_average || 0),
    voteCount: Number(r.vote_count || 0),
    popularity: Number(r.popularity || 0),
    posterPath: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : ''
  };
}

/**
 * Fetches genuine platform-specific movies & series availability using the exact same
 * shared watch-provider criteria and region scoping as browser discovery.
 * Never fabricates unrelated movies/series when platform data is empty or unavailable.
 */
export async function fetchServerPlatformMedia(
  platConfig: PlatformMeta,
  page = 1,
  fetchImpl: typeof fetch = fetch,
  tmdbApiKey: string = getServerTmdbApiKey(),
  watchRegion?: string
): Promise<{ items: any[]; totalPages: number; watchRegion: string; source: 'live' | 'offline' }> {
  const effectiveRegion = normalizeWatchRegion(watchRegion || platConfig.watchRegion || getConfiguredWatchRegion());
  const verifiedSet = new Set(platConfig.verifiedCatalogIds || []);
  const localVerified = getAllCatalogMedia().filter(item => verifiedSet.has(item.id));
  const useCache = fetchImpl === fetch;
  const plan = buildPlatformDiscoverPlan(platConfig, {
    page,
    mediaType: 'all',
    sortBy: 'popularity.desc',
    watchRegion: effectiveRegion
  });
  const cacheKey = plan.cacheKey;

  if (useCache) {
    const fresh = serverPlatformCache.getFresh(cacheKey);
    if (fresh) return fresh;
  }

  const effectiveKey = tmdbApiKey || (fetchImpl !== fetch ? 'test-key' : '');
  if (!effectiveKey) {
    const totalPages = Math.max(1, Math.ceil(localVerified.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const result = {
      items: start >= localVerified.length ? [] : localVerified.slice(start, start + PAGE_SIZE),
      totalPages,
      watchRegion: effectiveRegion,
      source: 'offline' as const
    };
    if (useCache) serverPlatformCache.set(cacheKey, result);
    return result;
  }

  return coalesceLookup(cacheKey, useCache, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const authedPlan = buildPlatformDiscoverPlan(platConfig, {
        page,
        mediaType: 'all',
        sortBy: 'popularity.desc',
        watchRegion: effectiveRegion,
        apiKeyQuery: effectiveKey
      });
      const [tvRes, movRes] = await Promise.all([
        authedPlan.tvPathAndQuery
          ? fetchImpl(`${TMDB_BASE_URL}${authedPlan.tvPathAndQuery}`, { signal: controller.signal })
          : Promise.resolve(null),
        authedPlan.moviePathAndQuery
          ? fetchImpl(`${TMDB_BASE_URL}${authedPlan.moviePathAndQuery}`, { signal: controller.signal })
          : Promise.resolve(null)
      ]);

      const tvTransientFail = Boolean(tvRes && (tvRes.status === 429 || tvRes.status >= 500));
      const movTransientFail = Boolean(movRes && (movRes.status === 429 || movRes.status >= 500));

      if ((!tvRes || tvTransientFail) && (!movRes || movTransientFail)) {
        if (useCache) {
          const stale = serverPlatformCache.getStale(cacheKey);
          if (stale) return stale;
        }
        throw make503Error(`TMDB platform discovery returned HTTP ${tvRes?.status || 503}/${movRes?.status || 503}`);
      }

      const merged = new Map<string, any>();
      let maxTotalPages = 1;

      if (tvRes && tvRes.ok) {
        const tvJson = await tvRes.json();
        maxTotalPages = Math.max(maxTotalPages, Math.min(Number(tvJson.total_pages || 1), 500));
        for (const r of tvJson.results || []) {
          if (r?.id && (r.name || r.title)) {
            merged.set(`tv:${r.id}`, normalizeServerTmdbListItem(r, 'tv'));
          }
        }
      }

      if (movRes && movRes.ok) {
        const movJson = await movRes.json();
        maxTotalPages = Math.max(maxTotalPages, Math.min(Number(movJson.total_pages || 1), 500));
        for (const r of movJson.results || []) {
          if (r?.id && (r.title || r.name)) {
            merged.set(`movie:${r.id}`, normalizeServerTmdbListItem(r, 'movie'));
          }
        }
      }

      // Note: Do NOT fabricate content on empty HTTP 200 live watch-provider response!
      const items = sortNormalizedMedia(Array.from(merged.values()), 'popularity.desc').slice(0, PAGE_SIZE);

      const result = {
        items,
        totalPages: items.length === 0 && page === 1 ? 1 : maxTotalPages,
        watchRegion: effectiveRegion,
        source: 'live' as const
      };
      if (useCache) serverPlatformCache.set(cacheKey, result);
      return result;
    } catch (err: any) {
      if (useCache) {
        const stale = serverPlatformCache.getStale(cacheKey);
        if (stale) return stale;
      }
      if (err?.status === 503) throw err;
      throw make503Error('TMDB platform discovery unavailable');
    } finally {
      clearTimeout(timeout);
    }
  });
}

/**
 * Genuine server-side catalog pagination for /movies, /tv-shows, /trending, /top-rated.
 */
export async function fetchServerCatalogPage(
  routeType: 'movies' | 'tv-shows' | 'trending' | 'top-rated',
  page = 1,
  fetchImpl: typeof fetch = fetch,
  tmdbApiKey: string = getServerTmdbApiKey()
): Promise<{ items: any[]; totalPages: number }> {
  const getOfflinePool = () => {
    const all = getAllCatalogMedia();
    if (routeType === 'movies') return all.filter(i => i.mediaType === 'movie');
    if (routeType === 'tv-shows') return all.filter(i => i.mediaType === 'tv');
    if (routeType === 'top-rated') {
      return [...all].sort((a, b) => {
        const diffAvg = (b.voteAverage || 0) - (a.voteAverage || 0);
        if (diffAvg !== 0) return diffAvg;
        const diffCount = (b.voteCount || 0) - (a.voteCount || 0);
        if (diffCount !== 0) return diffCount;
        return (a.id || 0) - (b.id || 0);
      });
    }
    return all;
  };

  const offlinePool = getOfflinePool();
  const useCache = fetchImpl === fetch;
  const cacheKey = `catalog:${routeType}:${page}`;

  if (useCache) {
    const fresh = serverCatalogCache.getFresh(cacheKey);
    if (fresh) return fresh;
  }

  const effectiveKey = tmdbApiKey || (fetchImpl !== fetch ? 'test-key' : '');
  if (!effectiveKey) {
    const totalPages = Math.max(1, Math.ceil(offlinePool.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const result = {
      items: start >= offlinePool.length ? [] : offlinePool.slice(start, start + PAGE_SIZE),
      totalPages
    };
    if (useCache) serverCatalogCache.set(cacheKey, result);
    return result;
  }

  if (routeType === 'top-rated') {
    return coalesceLookup(cacheKey, useCache, async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const plan = computeBalancedTopRatedPlan(page, PAGE_SIZE / 2);
        const [movResList, tvResList] = await Promise.all([
          Promise.all(
            plan.tmdbPages.map(p =>
              fetchImpl(`${TMDB_BASE_URL}/movie/top_rated?api_key=${effectiveKey}&page=${p}`, { signal: controller.signal })
            )
          ),
          Promise.all(
            plan.tmdbPages.map(p =>
              fetchImpl(`${TMDB_BASE_URL}/tv/top_rated?api_key=${effectiveKey}&page=${p}`, { signal: controller.signal })
            )
          )
        ]);

        const anyMovTransient = movResList.some(r => r.status === 429 || r.status >= 500);
        const anyTvTransient = tvResList.some(r => r.status === 429 || r.status >= 500);
        const allMovFailed = movResList.every(r => !r.ok);
        const allTvFailed = tvResList.every(r => !r.ok);

        if ((allMovFailed && anyMovTransient) && (allTvFailed && anyTvTransient)) {
          if (useCache) {
            const stale = serverCatalogCache.getStale(cacheKey);
            if (stale) return stale;
          }
          const totalPagesOffline = Math.max(1, Math.ceil(offlinePool.length / PAGE_SIZE));
          const startOffline = (page - 1) * PAGE_SIZE;
          if (page <= totalPagesOffline && offlinePool.length > 0) {
            return { items: offlinePool.slice(startOffline, startOffline + PAGE_SIZE), totalPages: totalPagesOffline };
          }
          throw make503Error('TMDB top-rated endpoints temporarily unavailable');
        }

        const movJsons = await Promise.all(movResList.map(r => (r.ok ? r.json() : { results: [], total_results: 0 })));
        const tvJsons = await Promise.all(tvResList.map(r => (r.ok ? r.json() : { results: [], total_results: 0 })));

        const movPool = movJsons
          .flatMap((j: any) => j.results || [])
          .filter((r: any) => r?.id && (r.title || r.name))
          .map((r: any) => normalizeServerTmdbListItem(r, 'movie'));
        const tvPool = tvJsons
          .flatMap((j: any) => j.results || [])
          .filter((r: any) => r?.id && (r.name || r.title))
          .map((r: any) => normalizeServerTmdbListItem(r, 'tv'));

        const movieSlice = movPool.slice(plan.sliceStartInBuffer, plan.sliceEndInBuffer);
        const tvSlice = tvPool.slice(plan.sliceStartInBuffer, plan.sliceEndInBuffer);
        const items = mergeBalancedTopRatedSlices(movieSlice, tvSlice, PAGE_SIZE);

        const maxMovTotal = Number(movJsons[0]?.total_results || movPool.length || 0);
        const maxTvTotal = Number(tvJsons[0]?.total_results || tvPool.length || 0);
        const maxPairs = Math.min(Math.floor(maxMovTotal / plan.perTypeCount), Math.floor(maxTvTotal / plan.perTypeCount));
        const totalPages = Math.max(1, Math.min(Math.max(maxPairs, items.length > 0 ? page : 1), 500));

        const result = { items, totalPages };
        if (useCache) serverCatalogCache.set(cacheKey, result);
        return result;
      } catch (err: any) {
        if (useCache) {
          const stale = serverCatalogCache.getStale(cacheKey);
          if (stale) return stale;
        }
        if (err?.status === 503) throw err;
        throw make503Error('TMDB top-rated discovery unavailable');
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  return coalesceLookup(cacheKey, useCache, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    let tmdbUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${effectiveKey}&sort_by=popularity.desc&page=${page}`;
    let forcedType: 'movie' | 'tv' | undefined = 'movie';
    if (routeType === 'tv-shows') {
      tmdbUrl = `${TMDB_BASE_URL}/discover/tv?api_key=${effectiveKey}&sort_by=popularity.desc&page=${page}`;
      forcedType = 'tv';
    } else if (routeType === 'trending') {
      tmdbUrl = `${TMDB_BASE_URL}/trending/all/week?api_key=${effectiveKey}&page=${page}`;
      forcedType = undefined;
    }

    try {
      const res = await fetchImpl(tmdbUrl, { signal: controller.signal });
      if (res.status === 429 || res.status >= 500) {
        if (useCache) {
          const stale = serverCatalogCache.getStale(cacheKey);
          if (stale) return stale;
        }
        const totalPages = Math.max(1, Math.ceil(offlinePool.length / PAGE_SIZE));
        const start = (page - 1) * PAGE_SIZE;
        if (page <= totalPages && offlinePool.length > 0) {
          return { items: offlinePool.slice(start, start + PAGE_SIZE), totalPages };
        }
        throw make503Error(`TMDB catalog lookup returned HTTP ${res.status}`);
      }

      if (!res.ok) {
        const totalPages = Math.max(1, Math.ceil(offlinePool.length / PAGE_SIZE));
        const start = (page - 1) * PAGE_SIZE;
        return {
          items: start >= offlinePool.length ? [] : offlinePool.slice(start, start + PAGE_SIZE),
          totalPages
        };
      }

      const json = await res.json();
      const rawResults = Array.isArray(json.results) ? json.results : [];
      const items = rawResults
        .filter((r: any) => r?.id && (r.title || r.name))
        .slice(0, PAGE_SIZE)
        .map((r: any) => normalizeServerTmdbListItem(r, forcedType));

      const totalPages = Math.max(1, Math.min(Number(json.total_pages || 1), 500));
      const result = { items, totalPages };
      if (useCache) serverCatalogCache.set(cacheKey, result);
      return result;
    } catch (err: any) {
      if (useCache) {
        const stale = serverCatalogCache.getStale(cacheKey);
        if (stale) return stale;
      }
      if (err?.status === 503) throw err;
      throw make503Error('TMDB catalog discovery unavailable');
    } finally {
      clearTimeout(timeout);
    }
  });
}

/**
 * Validates and fetches a person profile (/person/:id).
 */
export async function fetchServerPerson(
  personId: number,
  fetchImpl: typeof fetch = fetch,
  tmdbApiKey: string = getServerTmdbApiKey()
): Promise<{ id: number; name: string; knownForDepartment: string; bio: string; profilePath?: string } | null> {
  if (!personId || personId <= 0) return null;

  const useCache = fetchImpl === fetch;
  const cacheKey = `person:${personId}`;
  if (useCache) {
    const fresh = serverPersonCache.getFresh(cacheKey);
    if (fresh) return fresh;
  }

  const effectiveKey = tmdbApiKey || (fetchImpl !== fetch ? 'test-key' : '');
  if (effectiveKey) {
    return coalesceLookup(cacheKey, useCache, async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetchImpl(`${TMDB_BASE_URL}/person/${personId}?api_key=${effectiveKey}`, {
          signal: controller.signal
        });
        if (res.status === 404) return null;
        if (res.status === 429 || res.status >= 500) {
          if (useCache) {
            const stale = serverPersonCache.getStale(cacheKey);
            if (stale) return stale;
          }
          const known = KNOWN_POPULAR_PEOPLE[personId];
          if (known) return { id: personId, ...known };
          throw make503Error(`TMDB person lookup returned HTTP ${res.status}`);
        }
        if (res.ok) {
          const json = await res.json();
          if (!json?.name) return null;
          const data = {
            id: json.id || personId,
            name: json.name,
            knownForDepartment: json.known_for_department || 'Acting',
            bio: json.biography || `${json.name} filmography and credits on T Stream.`,
            profilePath: json.profile_path ? `https://image.tmdb.org/t/p/h632${json.profile_path}` : undefined
          };
          if (useCache) serverPersonCache.set(cacheKey, data);
          return data;
        }
      } catch (err: any) {
        if (useCache) {
          const stale = serverPersonCache.getStale(cacheKey);
          if (stale) return stale;
        }
        const known = KNOWN_POPULAR_PEOPLE[personId];
        if (known) return { id: personId, ...known };
        if (err?.status === 503) throw err;
        throw make503Error('TMDB person lookup failed');
      } finally {
        clearTimeout(timeout);
      }
      return null;
    });
  }

  const known = KNOWN_POPULAR_PEOPLE[personId];
  return known ? { id: personId, ...known } : null;
}

/**
 * Generates custom 404 HTML document.
 */
export function render404Html(template: string): string {
  let result = template;
  const pageTitle = '404 — Page Not Found — T Stream';
  const pageDesc = 'The movie, series, tag, or page you are looking for could not be found on T Stream.';

  result = setTitle(result, pageTitle);
  result = setMetaTag(result, 'name', 'title', pageTitle);
  result = setMetaTag(result, 'name', 'description', pageDesc);
  result = setMetaTag(result, 'name', 'robots', 'noindex, nofollow');
  result = setCanonical(result, `${PRIMARY_ORIGIN}/404`);

  const notFoundHtml = `
    <main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8 flex items-center justify-center" id="seo-prerender">
      <div class="text-center max-w-lg mx-auto py-12">
        <div class="text-7xl font-black text-[#F5C400] mb-3">404</div>
        <h1 class="text-3xl font-extrabold text-white mb-3">Page Not Found</h1>
        <p class="text-zinc-400 mb-8 text-sm sm:text-base leading-relaxed">The movie, television series, episode, tag, or page you were looking for could not be found or may have been removed.</p>
        <div class="flex flex-wrap justify-center gap-3 text-sm font-semibold">
          <a href="/" class="px-5 py-2.5 bg-[#F5C400] text-black rounded-lg hover:bg-amber-400 transition-colors">T Stream Home</a>
          <a href="/movies" class="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Browse Movies</a>
          <a href="/tv-shows" class="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Browse TV Shows</a>
          <a href="/trending" class="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Trending</a>
        </div>
      </div>
    </main>
  `.trim();

  result = setRootContent(result, notFoundHtml);
  return result;
}

/**
 * Generates custom 503 temporary service unavailable HTML document.
 */
export function render503Html(template: string): string {
  let result = template;
  const pageTitle = '503 — Service Temporarily Unavailable — T Stream';
  const pageDesc = 'Metadata service is temporarily busy. Please retry shortly.';

  result = setTitle(result, pageTitle);
  result = setMetaTag(result, 'name', 'title', pageTitle);
  result = setMetaTag(result, 'name', 'description', pageDesc);
  result = setMetaTag(result, 'name', 'robots', 'noindex, nofollow');
  result = setCanonical(result, `${PRIMARY_ORIGIN}/`);

  const unavailableHtml = `
    <main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8 flex items-center justify-center" id="seo-prerender">
      <div class="text-center max-w-lg mx-auto py-12">
        <div class="text-7xl font-black text-[#F5C400] mb-3">503</div>
        <h1 class="text-3xl font-extrabold text-white mb-3">Service Temporarily Unavailable</h1>
        <p class="text-zinc-400 mb-8 text-sm sm:text-base leading-relaxed">Our metadata provider is temporarily rate-limited or unreachable. Please try refreshing in a few moments.</p>
        <div class="flex flex-wrap justify-center gap-3 text-sm font-semibold">
          <a href="/" class="px-5 py-2.5 bg-[#F5C400] text-black rounded-lg hover:bg-amber-400 transition-colors">Return Home</a>
        </div>
      </div>
    </main>
  `.trim();

  result = setRootContent(result, unavailableHtml);
  return result;
}

function renderMediaCardsGrid(items: any[], heading = 'Featured Titles', emptyMessage?: string): string {
  if (!items || items.length === 0) {
    if (!emptyMessage) return '';
    return `
      <section class="max-w-5xl mx-auto my-6 bg-zinc-900/60 rounded-xl p-6 border border-white/10">
        <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-2">${escapeHtml(heading)}</h2>
        <p class="text-sm text-zinc-300">${escapeHtml(emptyMessage)}</p>
      </section>
    `;
  }
  return `
    <section class="max-w-5xl mx-auto my-6">
      <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">${escapeHtml(heading)}</h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        ${items.slice(0, PAGE_SIZE).map(item => {
          const itemTitle = item.title || item.name || '';
          const itemSlug = createMediaSlug(itemTitle, item.id);
          const itemType = item.mediaType === 'tv' ? 'tv' : 'movie';
          const yearStr = String(item.releaseDate || item.firstAirDate || '').substring(0, 4);
          return `
            <div class="bg-zinc-900/60 rounded-lg p-2 border border-white/10 flex flex-col">
              <a href="/${itemType}/${itemSlug}" class="block hover:opacity-90">
                ${item.posterPath ? `<img src="${escapeHtml(item.posterPath)}" alt="${escapeHtml(itemTitle)}" class="w-full rounded aspect-[2/3] object-cover mb-2" loading="lazy" />` : ''}
                <h3 class="text-xs font-semibold text-white truncate">${escapeHtml(itemTitle)}</h3>
                <div class="text-[11px] text-zinc-400 flex items-center justify-between mt-1">
                  <span>${escapeHtml(yearStr)}</span>
                  ${item.voteAverage > 0 ? `<span>★ ${Number(item.voteAverage).toFixed(1)}</span>` : ''}
                </div>
              </a>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderPaginationNav(basePath: string, currentPage: number, totalPages: number): string {
  if (totalPages <= 1 || currentPage > totalPages) return '';
  const prevHref = currentPage <= 2 ? basePath : `${basePath}?page=${currentPage - 1}`;
  const nextHref = `${basePath}?page=${currentPage + 1}`;
  return `
    <nav aria-label="Pagination" class="max-w-5xl mx-auto my-4 flex items-center gap-4 text-xs text-zinc-300">
      ${currentPage > 1 ? `<a href="${escapeHtml(prevHref)}" class="px-3 py-1.5 rounded bg-zinc-900 border border-white/10 hover:text-white">← Previous Page</a>` : ''}
      <span>Page ${currentPage} of ${totalPages}</span>
      ${currentPage < totalPages ? `<a href="${escapeHtml(nextHref)}" class="px-3 py-1.5 rounded bg-zinc-900 border border-white/10 hover:text-white">Next Page →</a>` : ''}
    </nav>
  `;
}

/**
 * Transforms an HTML document string and returns SEO HTML, HTTP status code, and canonical metadata.
 */
export async function renderSeoResult(
  html: string,
  urlPath: string,
  preloadedMediaOrOptions?: any | RenderSeoOptions
): Promise<{ html: string; status: number; canonicalUrl: string; isNoindex: boolean }> {
  const options: RenderSeoOptions =
    preloadedMediaOrOptions &&
    (preloadedMediaOrOptions.fetchImpl !== undefined ||
      preloadedMediaOrOptions.preloadedMedia !== undefined ||
      preloadedMediaOrOptions.tmdbApiKey !== undefined)
      ? preloadedMediaOrOptions
      : { preloadedMedia: preloadedMediaOrOptions };

  const fetchImpl = options.fetchImpl || fetch;
  const tmdbApiKey = options.tmdbApiKey ?? getServerTmdbApiKey();
  const route = parseSeoRoute(urlPath);
  const policy = resolveRouteSeoPolicy(urlPath);
  let result = html;

  // Unknown route -> Genuine 404
  if (!route || route.type === 'notfound') {
    return {
      html: render404Html(result),
      status: 404,
      canonicalUrl: `${PRIMARY_ORIGIN}/404`,
      isNoindex: true
    };
  }

  // 1. Private / Search pages: output noindex, nofollow
  if (route.type === 'noindex') {
    const cleanUrl = policy.canonicalUrl;
    result = setTitle(result, urlPath.startsWith('/search') ? 'Search Movies & TV Shows — T Stream' : DEFAULT_TITLE);
    result = setMetaTag(result, 'name', 'title', urlPath.startsWith('/search') ? 'Search Movies & TV Shows — T Stream' : DEFAULT_TITLE);
    result = setMetaTag(result, 'name', 'robots', 'noindex, nofollow');
    result = setCanonical(result, cleanUrl);
    return {
      html: result,
      status: 200,
      canonicalUrl: cleanUrl,
      isNoindex: true
    };
  }

  // 2. Media Detail & Watch Pages
  if (route.type === 'movie' || route.type === 'tv' || route.type === 'watch_movie' || route.type === 'watch_tv') {
    let media = options.preloadedMedia;
    if (!media) {
      try {
        media = await fetchServerMedia(route.mediaType || 'movie', route.id || 0, route.slug, fetchImpl, tmdbApiKey);
      } catch (err: any) {
        if (err?.status === 503) {
          return {
            html: render503Html(result),
            status: 503,
            canonicalUrl: `${PRIMARY_ORIGIN}/`,
            isNoindex: true
          };
        }
      }
    }

    if (!media) {
      return {
        html: render404Html(result),
        status: 404,
        canonicalUrl: `${PRIMARY_ORIGIN}/404`,
        isNoindex: true
      };
    }

    // Validate TV season & episode when watching a specific TV episode
    let episodeData: { name: string; overview?: string; airDate?: string } | null = null;
    if (route.type === 'watch_tv' && route.season !== undefined && route.episode !== undefined) {
      try {
        episodeData = await fetchServerEpisode(media, route.season, route.episode, fetchImpl, tmdbApiKey);
      } catch (err: any) {
        if (err?.status === 503) {
          return {
            html: render503Html(result),
            status: 503,
            canonicalUrl: `${PRIMARY_ORIGIN}/`,
            isNoindex: true
          };
        }
      }
      if (!episodeData) {
        return {
          html: render404Html(result),
          status: 404,
          canonicalUrl: `${PRIMARY_ORIGIN}/404`,
          isNoindex: true
        };
      }
    }

    const meta = buildMediaMetadata(media, {
      season: route.season,
      episode: route.episode,
      episodeName: episodeData?.name,
      episodeOverview: episodeData?.overview,
      episodeAirDate: episodeData?.airDate,
      isWatching: route.isWatchRoute
    });

    result = setTitle(result, meta.title);
    result = setMetaTag(result, 'name', 'title', meta.title);
    result = setMetaTag(result, 'name', 'description', meta.description);
    result = setMetaTag(result, 'name', 'keywords', meta.keywords);
    result = setCanonical(result, meta.canonicalUrl);
    result = setMetaTag(result, 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

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

    result = setMetaTag(result, 'name', 'twitter:card', 'summary_large_image');
    result = setMetaTag(result, 'name', 'twitter:title', meta.title);
    result = setMetaTag(result, 'name', 'twitter:description', meta.description);
    result = setMetaTag(result, 'name', 'twitter:image', meta.image);
    result = setMetaTag(result, 'name', 'twitter:image:alt', meta.rawTitle);
    result = setMetaTag(result, 'name', 'twitter:url', meta.canonicalUrl);

    result = setJsonLd(result, meta.schema);

    const isMovie = route.mediaType === 'movie';
    const rawYear = media.releaseDate || media.firstAirDate ? new Date(media.releaseDate || media.firstAirDate).getFullYear() : NaN;
    const yearDisplay = !isNaN(rawYear) ? ` (${rawYear})` : '';
    const genresList = (media.genres || []).map((g: any) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean);
    const mediaSlug = createMediaSlug(media.title || media.name, media.id);

    let semanticHtml = '';
    if (route.type === 'watch_movie') {
      semanticHtml = `
        <main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8" id="seo-prerender">
          <nav aria-label="Breadcrumb" class="text-xs text-zinc-400 mb-4 max-w-5xl mx-auto">
            <a href="/" class="hover:underline">Home</a> &gt;
            <a href="/movies" class="hover:underline">Movies</a> &gt;
            <a href="/movie/${mediaSlug}" class="hover:underline">${escapeHtml(media.title)}</a> &gt;
            <span class="text-white">Watch Movie</span>
          </nav>
          <article class="max-w-5xl mx-auto">
            <header class="mb-4">
              <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-2">Watch ${escapeHtml(media.title)}${yearDisplay} Full Movie Online Free</h1>
              <div class="flex flex-wrap gap-2 text-xs font-semibold text-amber-400">
                ${genresList.map((g: string) => `<span>${escapeHtml(g)}</span>`).join(' · ')}
                ${media.voteAverage > 0 ? `<span>★ ${Number(media.voteAverage).toFixed(1)}/10</span>` : ''}
              </div>
            </header>
            ${media.overview ? `<section class="mb-6"><h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-1">About the Movie</h2><p class="text-sm sm:text-base text-zinc-300 leading-relaxed">${escapeHtml(media.overview)}</p></section>` : ''}
            <div class="mt-6 pt-4 border-t border-white/10 flex flex-wrap gap-4 text-xs text-zinc-400">
              <a href="/movie/${mediaSlug}" class="text-amber-400 font-semibold hover:underline">← View Movie Details, Reviews &amp; Cast</a>
              <a href="/movies" class="hover:text-white">Browse All Movies</a>
            </div>
          </article>
        </main>
      `.trim();
    } else if (route.type === 'watch_tv') {
      const sNum = route.season || 1;
      const eNum = route.episode || 1;
      const epTitle = episodeData?.name && !/^episode\s+\d+$/i.test(episodeData.name) ? ` — ${episodeData.name}` : '';
      const epOverview = episodeData?.overview || media.overview || '';
      semanticHtml = `
        <main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8" id="seo-prerender">
          <nav aria-label="Breadcrumb" class="text-xs text-zinc-400 mb-4 max-w-5xl mx-auto">
            <a href="/" class="hover:underline">Home</a> &gt;
            <a href="/tv-shows" class="hover:underline">TV Shows</a> &gt;
            <a href="/tv/${mediaSlug}" class="hover:underline">${escapeHtml(media.title)}</a> &gt;
            <span class="text-white">Season ${sNum} Episode ${eNum}</span>
          </nav>
          <article class="max-w-5xl mx-auto">
            <header class="mb-4">
              <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-2">Watch ${escapeHtml(media.title)} Season ${sNum} Episode ${eNum}${escapeHtml(epTitle)} Free HD</h1>
              <div class="flex flex-wrap gap-2 text-xs font-semibold text-amber-400">
                ${genresList.map((g: string) => `<span>${escapeHtml(g)}</span>`).join(' · ')}
                ${media.voteAverage > 0 ? `<span>★ ${Number(media.voteAverage).toFixed(1)}/10</span>` : ''}
              </div>
            </header>
            ${epOverview ? `<section class="mb-6"><h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-1">Episode Synopsis</h2><p class="text-sm sm:text-base text-zinc-300 leading-relaxed">${escapeHtml(epOverview)}</p></section>` : ''}
            <div class="mt-6 pt-4 border-t border-white/10 flex flex-wrap gap-4 text-xs text-zinc-400">
              <a href="/tv/${mediaSlug}" class="text-amber-400 font-semibold hover:underline">← View ${escapeHtml(media.title)} Series Page</a>
              <a href="/tv-shows" class="hover:text-white">Browse All TV Shows</a>
            </div>
          </article>
        </main>
      `.trim();
    } else {
      const watchHref = isMovie ? `/watch/movie/${mediaSlug}` : `/watch/tv/${mediaSlug}/1/1`;
      semanticHtml = `
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
                ${media.voteAverage > 0 ? `<span>★ ${Number(media.voteAverage).toFixed(1)}/10</span>` : ''}
              </div>
            </header>
            ${media.overview ? `<section class="mb-6"><h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-1">Synopsis</h2><p class="text-sm sm:text-base text-zinc-300 leading-relaxed">${escapeHtml(media.overview)}</p></section>` : ''}
            <div class="mt-6 pt-4 border-t border-white/10 flex flex-wrap gap-4 text-xs text-zinc-400">
              <a href="${watchHref}" class="text-amber-400 font-semibold hover:underline">${isMovie ? '▶ Watch Movie Online Free' : '▶ Watch Season 1 Episode 1'}</a>
              <a href="/" class="hover:text-white">← Back to T Stream Home</a>
              <a href="/movies" class="hover:text-white">Browse Movies</a>
              <a href="/tv-shows" class="hover:text-white">Browse TV Shows</a>
            </div>
          </article>
        </main>
      `.trim();
    }

    result = setRootContent(result, semanticHtml);
    return {
      html: result,
      status: 200,
      canonicalUrl: meta.canonicalUrl,
      isNoindex: false
    };
  }

  // 3. Person Route (/person/:id)
  if (route.type === 'person' && route.personId) {
    let person: any = null;
    try {
      person = await fetchServerPerson(route.personId, fetchImpl, tmdbApiKey);
    } catch (err: any) {
      if (err?.status === 503) {
        return {
          html: render503Html(result),
          status: 503,
          canonicalUrl: `${PRIMARY_ORIGIN}/`,
          isNoindex: true
        };
      }
    }
    if (!person) {
      return {
        html: render404Html(result),
        status: 404,
        canonicalUrl: `${PRIMARY_ORIGIN}/404`,
        isNoindex: true
      };
    }

    const personTitle = `${person.name} — Movies & TV Shows Filmography — T Stream`;
    const personDesc = truncateSummary(person.bio, 160);
    const personCanonical = `${PRIMARY_ORIGIN}/person/${person.id}`;
    const personImage = person.profilePath || DEFAULT_IMAGE;

    result = setTitle(result, personTitle);
    result = setMetaTag(result, 'name', 'title', personTitle);
    result = setMetaTag(result, 'name', 'description', personDesc);
    result = setMetaTag(result, 'name', 'keywords', normalizeKeywords([person.name, person.knownForDepartment, 'filmography', 'movies', 'T Stream']));
    result = setCanonical(result, personCanonical);
    result = setMetaTag(result, 'name', 'robots', 'index, follow, max-image-preview:large');
    result = setMetaTag(result, 'property', 'og:title', personTitle);
    result = setMetaTag(result, 'property', 'og:description', personDesc);
    result = setMetaTag(result, 'property', 'og:image', personImage);
    result = setMetaTag(result, 'property', 'og:url', personCanonical);
    result = setMetaTag(result, 'name', 'twitter:title', personTitle);
    result = setMetaTag(result, 'name', 'twitter:description', personDesc);
    result = setMetaTag(result, 'name', 'twitter:image', personImage);
    result = setJsonLd(result, {
      '@context': 'https://schema.org',
      '@type': 'Person',
      'name': person.name,
      'description': personDesc,
      'url': personCanonical,
      'image': personImage
    });
    result = setRootContent(
      result,
      `<main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8" id="seo-prerender">
        <nav aria-label="Breadcrumb" class="text-xs text-zinc-400 mb-4 max-w-5xl mx-auto">
          <a href="/" class="hover:underline">Home</a> &gt; <a href="/people" class="hover:underline">People</a> &gt; <span class="text-white">${escapeHtml(person.name)}</span>
        </nav>
        <article class="max-w-5xl mx-auto">
          <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-2">${escapeHtml(person.name)}</h1>
          <p class="text-sm sm:text-base text-zinc-300 leading-relaxed">${escapeHtml(person.bio)}</p>
        </article>
      </main>`
    );
    return {
      html: result,
      status: 200,
      canonicalUrl: personCanonical,
      isNoindex: false
    };
  }

  // 4. Tag Detail Route (/tags/:tag)
  if (route.type === 'tag_detail' && route.tag) {
    const cleanTag = route.tag.toLowerCase();
    let tagLookup: { valid: boolean; items: any[] } = { valid: false, items: [] };
    try {
      tagLookup = await fetchServerTagMedia(cleanTag, fetchImpl, tmdbApiKey);
    } catch (err: any) {
      if (err?.status === 503) {
        return {
          html: render503Html(result),
          status: 503,
          canonicalUrl: `${PRIMARY_ORIGIN}/`,
          isNoindex: true
        };
      }
    }

    if (!tagLookup.valid) {
      return {
        html: render404Html(result),
        status: 404,
        canonicalUrl: `${PRIMARY_ORIGIN}/404`,
        isNoindex: true
      };
    }

    const allMatchingItems = tagLookup.items;
    const requestedPage = policy.page || 1;
    const totalPages = Math.max(1, Math.ceil(allMatchingItems.length / PAGE_SIZE));
    const isOutOfRange = requestedPage > totalPages || Boolean(policy.isInvalidPage);
    const startIdx = (requestedPage - 1) * PAGE_SIZE;
    const pagedItems = isOutOfRange ? [] : allMatchingItems.slice(startIdx, startIdx + PAGE_SIZE);
    const isEmptyTag = allMatchingItems.length === 0;
    const isNoindex = isEmptyTag || isOutOfRange || policy.noindex;
    const baseTagCanonical = `${PRIMARY_ORIGIN}/tags/${encodeURIComponent(cleanTag)}`;
    const pageCanonical = isNoindex ? baseTagCanonical : policy.canonicalUrl;
    const pageSuffix = !isNoindex && requestedPage > 1 ? ` — Page ${requestedPage}` : '';

    const pageTitle = isEmptyTag
      ? `Movies Tagged #${cleanTag} — T Stream`
      : `Movies & TV Shows Tagged #${cleanTag} — Watch Online Free${pageSuffix} — T Stream`;
    const pageDesc = isEmptyTag
      ? `Browse titles tagged #${cleanTag} on T Stream.`
      : `Discover top rated and popular movies and TV series tagged with #${cleanTag}. Stream free in 4K and 1080p HD with subtitles on T Stream.`;
    const h1Heading = `Movies & Shows Tagged #${cleanTag}`;

    result = setTitle(result, pageTitle);
    result = setMetaTag(result, 'name', 'title', pageTitle);
    result = setMetaTag(result, 'name', 'description', pageDesc);
    result = setMetaTag(result, 'name', 'keywords', normalizeKeywords([cleanTag, `${cleanTag} movies`, `${cleanTag} series`, 'T Stream', DEFAULT_KEYWORDS]));
    result = setCanonical(result, pageCanonical);
    result = setMetaTag(
      result,
      'name',
      'robots',
      isNoindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );
    result = setMetaTag(result, 'property', 'og:title', pageTitle);
    result = setMetaTag(result, 'property', 'og:description', pageDesc);
    result = setMetaTag(result, 'property', 'og:image', DEFAULT_IMAGE);
    result = setMetaTag(result, 'property', 'og:url', pageCanonical);
    result = setMetaTag(result, 'property', 'og:type', 'website');
    result = setMetaTag(result, 'name', 'twitter:title', pageTitle);
    result = setMetaTag(result, 'name', 'twitter:description', pageDesc);
    result = setMetaTag(result, 'name', 'twitter:image', DEFAULT_IMAGE);
    result = setMetaTag(result, 'name', 'twitter:url', pageCanonical);
    result = setJsonLd(result, {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': pageTitle,
      'description': pageDesc,
      'url': pageCanonical
    });

    const tagBody = `
      <main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8" id="seo-prerender">
        <nav aria-label="Breadcrumb" class="text-xs text-zinc-400 mb-4 max-w-5xl mx-auto">
          <a href="/" class="hover:underline">Home</a> &gt;
          <a href="/tags" class="hover:underline">Tags</a> &gt;
          <span class="text-white">#${escapeHtml(cleanTag)}</span>
        </nav>
        <header class="max-w-5xl mx-auto mb-6">
          <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-2">${escapeHtml(h1Heading)}</h1>
          <p class="text-sm sm:text-base text-zinc-300 max-w-2xl">${escapeHtml(pageDesc)}</p>
        </header>
        ${renderMediaCardsGrid(
          pagedItems,
          `Titles Tagged #${cleanTag}`,
          isOutOfRange
            ? `Page ${requestedPage} exceeds the available catalog range for #${cleanTag}.`
            : `No titles currently indexed for tag #${cleanTag}.`
        )}
        ${renderPaginationNav(`/tags/${encodeURIComponent(cleanTag)}`, requestedPage, totalPages)}
        <section class="max-w-5xl mx-auto pt-6 border-t border-white/10 flex flex-wrap gap-4 text-xs text-zinc-400">
          <a href="/tags" class="hover:text-white">All Tags</a>
          <a href="/movies" class="hover:text-white">Movies</a>
          <a href="/tv-shows" class="hover:text-white">TV Shows</a>
        </section>
      </main>
    `.trim();

    result = setRootContent(result, tagBody);
    return {
      html: result,
      status: 200,
      canonicalUrl: pageCanonical,
      isNoindex
    };
  }

  // 5. Public Hub, Homepage, Collections, Platform, A-Z & Utility Landing Pages
  let pageTitle = DEFAULT_TITLE;
  let pageDesc = DEFAULT_DESC;
  let pageCanonical = policy.canonicalUrl;
  let h1Heading = 'Watch Movies & TV Shows Online Free';
  let breadcrumbTitle = 'Home';
  let isNoindex = policy.noindex;
  let matchingItems: any[] = [];
  let extraSectionsHtml = '';
  let emptyStateMessage = '';
  let paginationBasePath = '';
  let currentPage = policy.page || 1;
  let totalPages = 1;

  const pageSuffix = !policy.isInvalidPage && currentPage > 1 && !policy.noindex ? ` — Page ${currentPage}` : '';

  if (route.type === 'home') {
    pageCanonical = `${PRIMARY_ORIGIN}/`;
    matchingItems = [...DETAILED_MOVIES.slice(0, 6), ...DETAILED_TV_SHOWS.slice(0, 6)];
  } else if (
    route.type === 'movies' ||
    route.type === 'tv-shows' ||
    route.type === 'trending' ||
    route.type === 'top-rated'
  ) {
    paginationBasePath = `/${route.type}`;
    let catalogRes: { items: any[]; totalPages: number } = { items: [], totalPages: 1 };
    try {
      catalogRes = await fetchServerCatalogPage(route.type, currentPage, fetchImpl, tmdbApiKey);
    } catch (err: any) {
      if (err?.status === 503) {
        return {
          html: render503Html(result),
          status: 503,
          canonicalUrl: `${PRIMARY_ORIGIN}/`,
          isNoindex: true
        };
      }
    }

    matchingItems = catalogRes.items;
    totalPages = catalogRes.totalPages;
    const isOutOfRange = Boolean(policy.isInvalidPage) || currentPage > totalPages || matchingItems.length === 0;
    if (isOutOfRange) {
      isNoindex = true;
      pageCanonical = `${PRIMARY_ORIGIN}/${route.type}`;
      emptyStateMessage = `No titles found for ${route.type} page ${currentPage}. Browse page 1 for the complete catalog.`;
    }

    const activeSuffix = !isNoindex && currentPage > 1 ? ` — Page ${currentPage}` : '';
    if (route.type === 'movies') {
      pageTitle = `Popular & Latest Movies Free HD${activeSuffix} — T Stream`;
      pageDesc = 'Browse and watch thousands of blockbuster movies online in HD 1080p and 4K on T Stream.';
      h1Heading = 'Popular & Latest Movies Online in HD';
      breadcrumbTitle = 'Movies';
    } else if (route.type === 'tv-shows') {
      pageTitle = `TV Shows & Full Episodes Free${activeSuffix} — T Stream`;
      pageDesc = 'Stream full seasons and episodes of your favorite TV series and dramas on T Stream.';
      h1Heading = 'Watch TV Shows & Full Series Free';
      breadcrumbTitle = 'TV Shows';
    } else if (route.type === 'trending') {
      pageTitle = `Trending Movies & TV Shows Today${activeSuffix} — T Stream`;
      pageDesc = 'Discover the hottest and most popular movies and series streaming right now on T Stream.';
      h1Heading = 'Trending Movies & Shows Today';
      breadcrumbTitle = 'Trending';
    } else {
      pageTitle = `Top Rated Movies & Shows of All Time${activeSuffix} — T Stream`;
      pageDesc = 'Explore the highest critically-acclaimed films and television series on T Stream.';
      h1Heading = 'Top Rated Movies & Series of All Time';
      breadcrumbTitle = 'Top Rated';
    }
  } else if (route.type === 'collections') {
    pageTitle = 'Movie Franchises & Sagas — T Stream';
    pageDesc = 'Explore complete cinematic universes and movie franchises on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/collections`;
    h1Heading = 'Movie Franchises & Sagas';
    breadcrumbTitle = 'Collections';
    const cols = [SPIDERMAN_COLLECTION, AVENGERS_COLLECTION, HARRY_POTTER_COLLECTION, PIRATES_COLLECTION];
    extraSectionsHtml = `
      <section class="max-w-5xl mx-auto my-6 space-y-6">
        ${cols.map(c => `
          <div class="bg-zinc-900/60 rounded-xl p-4 border border-white/10">
            <h2 class="text-lg font-bold text-white mb-1">${escapeHtml(c.name)}</h2>
            <p class="text-xs text-zinc-400 mb-3">${escapeHtml(c.overview || '')}</p>
            <div class="flex flex-wrap gap-3 text-xs">
              ${c.parts.map(p => `<a href="/movie/${createMediaSlug(p.title, p.id)}" class="text-amber-400 hover:underline">${escapeHtml(p.title)}</a>`).join('')}
            </div>
          </div>
        `).join('')}
      </section>
    `;
  } else if (route.type === 'new-episodes') {
    pageTitle = 'New TV Episodes & Releases Today — Free HD Stream — T Stream';
    pageDesc = 'Track the latest TV episodes airing today and this week with notifications on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/new-episodes`;
    h1Heading = 'New TV Episodes Airing Today';
    breadcrumbTitle = 'New Episodes';
    isNoindex = true;
  } else if (route.type === 'people') {
    pageTitle = 'Actors & Film Directors Directory — T Stream';
    pageDesc = 'Explore popular film and TV cast members, directors, and filmographies on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/people`;
    h1Heading = 'Actors & Film Directors Directory';
    breadcrumbTitle = 'People';
    isNoindex = true;
  } else if (route.type === 'random') {
    pageTitle = 'Random Movie & TV Show Picker — Reshuffle 20 Titles — T Stream';
    pageDesc = 'Spin the wheel and pick from 20 random movies and TV series to watch online in HD on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/random`;
    h1Heading = 'Random Movie & TV Show Picker';
    breadcrumbTitle = 'Random';
    isNoindex = true;
  } else if (route.type === 'tags') {
    pageTitle = 'Explore Movies & TV Series by Tag & Theme — T Stream';
    pageDesc = 'Browse movies and TV series by genre tropes, story moods, themes, and aesthetic tags on T Stream.';
    pageCanonical = `${PRIMARY_ORIGIN}/tags`;
    h1Heading = 'Explore Movies & Shows by Story Tag';
    breadcrumbTitle = 'Tags';
    extraSectionsHtml = `
      <section class="max-w-5xl mx-auto my-6">
        <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">Popular Story Tags</h2>
        <div class="flex flex-wrap gap-2">
          ${POPULAR_TAGS.map(t => `<a href="/tags/${encodeURIComponent(t.name)}" class="px-3 py-1 rounded bg-zinc-900 border border-white/10 text-xs text-amber-400 hover:underline">#${escapeHtml(t.name)}</a>`).join('')}
        </div>
      </section>
    `;
  } else if (route.type === 'platform' && route.platform) {
    const platConfig = getPlatformConfigById(route.platform);
    if (!platConfig) {
      return {
        html: render404Html(result),
        status: 404,
        canonicalUrl: `${PRIMARY_ORIGIN}/404`,
        isNoindex: true
      };
    }

    paginationBasePath = `/platform/${platConfig.id}`;
    const reqUrlObj = new URL(urlPath.startsWith('/') ? `https://tstream.online${urlPath}` : urlPath);
    const requestedRegion = reqUrlObj.searchParams.get('watchRegion') || reqUrlObj.searchParams.get('region') || undefined;
    const effectiveRegion = normalizeWatchRegion(requestedRegion || platConfig.watchRegion || getConfiguredWatchRegion());

    let platRes: { items: any[]; totalPages: number; watchRegion: string; source: 'live' | 'offline' } = {
      items: [],
      totalPages: 1,
      watchRegion: effectiveRegion,
      source: 'offline'
    };
    try {
      platRes = await fetchServerPlatformMedia(platConfig, currentPage, fetchImpl, tmdbApiKey, effectiveRegion);
    } catch (err: any) {
      if (err?.status === 503) {
        return {
          html: render503Html(result),
          status: 503,
          canonicalUrl: `${PRIMARY_ORIGIN}/`,
          isNoindex: true
        };
      }
    }

    matchingItems = platRes.items;
    totalPages = platRes.totalPages;
    const isEmptyOrOutOfRange = matchingItems.length === 0 || currentPage > totalPages || Boolean(policy.isInvalidPage);
    isNoindex = isNoindex || isEmptyOrOutOfRange || Boolean(route.isPlatformAlias);
    if (isEmptyOrOutOfRange || route.isPlatformAlias) {
      pageCanonical = `${PRIMARY_ORIGIN}/platform/${platConfig.id}`;
    }

    const scopeNote = platRes.source === 'live'
      ? `Showing ${platConfig.name} watch-provider availability in region ${platRes.watchRegion}.`
      : `Showing verified ${platConfig.name} original reference titles (offline metadata mode; region filter ${platRes.watchRegion} activates with live TMDB availability).`;

    pageTitle = `${platConfig.name} Hub — Movies & TV Series${pageSuffix} — T Stream`;
    pageDesc = `${platConfig.description} ${scopeNote}`;
    h1Heading = `${platConfig.name} Hub — Streaming Catalog (${platRes.watchRegion})`;
    breadcrumbTitle = platConfig.name;
    if (matchingItems.length === 0) {
      emptyStateMessage = `No verified ${platConfig.name} titles are currently available for watch region ${platRes.watchRegion}. Browse Movies or TV Shows for instant playback.`;
    }
  } else if (route.type === 'az' && route.letter) {
    matchingItems = getMatchingCatalogForLetter(route.letter);
    pageTitle = `Titles Starting With ${route.letter} — A-Z Directory — T Stream`;
    pageDesc = `Browse movies and TV shows alphabetically starting with letter ${route.letter} on T Stream.`;
    pageCanonical = `${PRIMARY_ORIGIN}/az/${route.letter}`;
    h1Heading = `Movies & Shows Starting With "${route.letter}"`;
    breadcrumbTitle = `Letter ${route.letter}`;
    isNoindex = isNoindex || matchingItems.length === 0;
    if (matchingItems.length === 0) {
      emptyStateMessage = `No curated titles currently indexed under "${route.letter}".`;
    }
  }

  result = setTitle(result, pageTitle);
  result = setMetaTag(result, 'name', 'title', pageTitle);
  result = setMetaTag(result, 'name', 'description', pageDesc);
  result = setMetaTag(result, 'name', 'keywords', DEFAULT_KEYWORDS);
  result = setCanonical(result, pageCanonical);
  result = setMetaTag(
    result,
    'name',
    'robots',
    isNoindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  );

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

  const landingSchema = {
    '@context': 'https://schema.org',
    '@type': route.type === 'home' ? 'WebSite' : 'CollectionPage',
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

  const mediaGridHtml = renderMediaCardsGrid(matchingItems, 'Featured Titles', emptyStateMessage);
  const paginationNavHtml = paginationBasePath ? renderPaginationNav(paginationBasePath, currentPage, totalPages) : '';

  const landingHtml = `
    <main class="min-h-screen bg-[#232326] text-[#F3F3F3] p-4 sm:p-8" id="seo-prerender">
      ${route.type !== 'home' ? `
      <nav aria-label="Breadcrumb" class="text-xs text-zinc-400 mb-4 max-w-5xl mx-auto">
        <a href="/" class="hover:underline">Home</a> &gt;
        <span class="text-white">${escapeHtml(breadcrumbTitle)}</span>
      </nav>
      ` : ''}
      <header class="max-w-5xl mx-auto mb-6">
        <h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-2">${escapeHtml(h1Heading)}</h1>
        <p class="text-sm sm:text-base text-zinc-300 max-w-2xl">${escapeHtml(pageDesc)}</p>
      </header>
      ${extraSectionsHtml}
      ${mediaGridHtml}
      ${paginationNavHtml}
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
  return {
    html: result,
    status: 200,
    canonicalUrl: pageCanonical,
    isNoindex
  };
}

function truncateSummary(text: string, max = 160): string {
  if (!text) return DEFAULT_DESC;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 3);
  const idx = slice.lastIndexOf(' ');
  return (idx > 40 ? slice.slice(0, idx) : slice).trim() + '...';
}

export async function renderSeoHtml(
  html: string,
  urlPath: string,
  preloadedMediaOrOptions?: any | RenderSeoOptions
): Promise<string> {
  const res = await renderSeoResult(html, urlPath, preloadedMediaOrOptions);
  return res.html;
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
 * Vite plugin for server-side SEO rendering in dev and preview.
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
        const clean = url.split('?')[0];
        if (
          req.method === 'GET' &&
          !clean.startsWith('/api/') &&
          !clean.startsWith('/@') &&
          !clean.startsWith('/src/') &&
          !clean.startsWith('/node_modules/') &&
          !/\.[a-zA-Z0-9]{1,8}$/.test(clean) &&
          (req.headers.accept?.includes('text/html') || !req.headers.accept)
        ) {
          try {
            const indexHtmlPath = findIndexHtml(server?.config?.root);
            if (indexHtmlPath) {
              let template = fs.readFileSync(indexHtmlPath, 'utf8');
              template = await server.transformIndexHtml(url, template);
              const seoRes = await renderSeoResult(template, url);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.statusCode = seoRes.status;
              res.end(seoRes.html);
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
        const clean = url.split('?')[0];
        if (
          req.method === 'GET' &&
          !clean.startsWith('/api/') &&
          !/\.[a-zA-Z0-9]{1,8}$/.test(clean)
        ) {
          try {
            const distHtmlPath = findDistHtml(server?.config?.root);
            if (distHtmlPath) {
              const template = fs.readFileSync(distHtmlPath, 'utf8');
              const seoRes = await renderSeoResult(template, url);
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.statusCode = seoRes.status;
              res.end(seoRes.html);
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
