/**
 * Unified Platform Discovery & Top-Rated Balanced Pagination Logic
 *
 * Shared between browser (`src/services/tmdb.ts`) and SSR/prerender (`scripts/seoHtmlPlugin.ts`)
 * so Googlebot and real visitors receive identical query criteria, region scoping,
 * sorting, and pagination math.
 */

import {
  PlatformMeta,
  DEFAULT_WATCH_REGION,
  normalizeWatchRegion
} from './platformConfig.ts';

export const CATALOG_PAGE_SIZE = 12;
export const TMDB_PAGE_SIZE = 20;

export interface PlatformDiscoverQueryOptions {
  page?: number;
  mediaType?: 'all' | 'movie' | 'tv';
  sortBy?: string;
  watchRegion?: string;
  genreId?: number;
  year?: number;
  minRating?: number;
  language?: string;
  apiKeyQuery?: string; // server sets `api_key=...`; browser proxy omits it
}

export interface PlatformQueryPlan {
  platformId: string;
  watchRegion: string;
  cacheKey: string;
  moviePathAndQuery: string | null;
  tvPathAndQuery: string | null;
}

export function getPlatformCacheKey(
  platformId: string,
  watchRegion: string,
  mediaType: 'all' | 'movie' | 'tv',
  sortBy: string,
  page: number,
  filters: { genreId?: number; year?: number; minRating?: number; language?: string } = {}
): string {
  const normRegion = normalizeWatchRegion(watchRegion);
  return `platform:${platformId}:${normRegion}:${mediaType}:${sortBy}:g=${filters.genreId || ''}:y=${filters.year || ''}:r=${filters.minRating || ''}:l=${filters.language || ''}:p=${page}`;
}

/**
 * Builds IDENTICAL TMDB Watch-Provider discover queries for browser and server.
 * Uses `with_watch_providers` + `watch_region` rather than mixing production studio
 * filters (`with_companies`) so availability strictly reflects streaming service
 * availability in the selected `watch_region`.
 */
export function buildPlatformDiscoverPlan(
  platform: PlatformMeta,
  options: PlatformDiscoverQueryOptions = {}
): PlatformQueryPlan {
  const safePage = Math.max(1, Math.floor(Number(options.page) || 1));
  const mediaType = options.mediaType || 'all';
  const sortBy = options.sortBy || 'popularity.desc';
  const watchRegion = normalizeWatchRegion(options.watchRegion || platform.watchRegion || DEFAULT_WATCH_REGION);

  const makeParams = (type: 'movie' | 'tv') => {
    const params = new URLSearchParams();
    if (options.apiKeyQuery) {
      params.set('api_key', options.apiKeyQuery);
    }
    params.set('with_watch_providers', platform.watchProviderId);
    params.set('watch_region', watchRegion);
    params.set('sort_by', sortBy);
    params.set('page', String(safePage));
    params.set('include_adult', 'false');
    if (options.genreId) {
      params.set('with_genres', String(options.genreId));
    }
    if (options.minRating) {
      params.set('vote_average.gte', String(options.minRating));
    }
    if (options.year) {
      params.set(type === 'movie' ? 'primary_release_year' : 'first_air_date_year', String(options.year));
    }
    if (options.language && /^[a-z]{2}$/i.test(options.language.trim())) {
      params.set('with_original_language', options.language.trim().toLowerCase());
    }
    return params.toString();
  };

  return {
    platformId: platform.id,
    watchRegion,
    cacheKey: getPlatformCacheKey(platform.id, watchRegion, mediaType, sortBy, safePage, {
      genreId: options.genreId,
      year: options.year,
      minRating: options.minRating,
      language: options.language
    }),
    moviePathAndQuery:
      mediaType === 'tv' ? null : `/discover/movie?${makeParams('movie')}`,
    tvPathAndQuery:
      mediaType === 'movie' ? null : `/discover/tv?${makeParams('tv')}`
  };
}

export function sortNormalizedMedia<T extends { popularity?: number; voteAverage?: number; voteCount?: number; releaseDate?: string; title?: string; mediaType?: string; id?: number }>(
  items: T[],
  sortBy: string = 'popularity.desc'
): T[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'vote_average.desc': {
        const diffAvg = (b.voteAverage || 0) - (a.voteAverage || 0);
        if (diffAvg !== 0) return diffAvg;
        const diffCount = (b.voteCount || 0) - (a.voteCount || 0);
        if (diffCount !== 0) return diffCount;
        return (a.id || 0) - (b.id || 0);
      }
      case 'primary_release_date.desc': {
        const ta = new Date(a.releaseDate || 0).getTime() || 0;
        const tb = new Date(b.releaseDate || 0).getTime() || 0;
        if (tb !== ta) return tb - ta;
        return (b.popularity || 0) - (a.popularity || 0);
      }
      case 'title.asc':
        return String(a.title || '').localeCompare(String(b.title || ''));
      case 'popularity.desc':
      default: {
        const diffPop = (b.popularity || 0) - (a.popularity || 0);
        if (diffPop !== 0) return diffPop;
        return (a.id || 0) - (b.id || 0);
      }
    }
  });
}

/**
 * Deterministic Zero-Skip Balanced Top-Rated Window Plan:
 *
 * Each TStream page displays `CATALOG_PAGE_SIZE = 12` items composed of:
 *   - 6 movies from TMDB `/movie/top_rated` (global slice `[(page-1)*6, page*6)`)
 *   - 6 TV series from TMDB `/tv/top_rated` (global slice `[(page-1)*6, page*6)`)
 *
 * Because TMDB `/top_rated` returns 20 items per page, we map the global 0-based
 * offset `[globalStart, globalEnd)` to the exact 1-2 consecutive TMDB page(s) and
 * exact slice indices inside those concatenated pages. Zero records are skipped
 * across TMDB page boundaries (e.g. indices 18..23 bridge TMDB page 1 + page 2),
 * and adjacent TStream pages are 100% disjoint and deterministic.
 */
export interface BalancedWindowPlan {
  perTypeCount: number;
  globalStart: number;
  globalEnd: number;
  tmdbPages: number[];
  sliceStartInBuffer: number;
  sliceEndInBuffer: number;
}

export function computeBalancedTopRatedPlan(
  page: number,
  perTypeCount: number = CATALOG_PAGE_SIZE / 2
): BalancedWindowPlan {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const globalStart = (safePage - 1) * perTypeCount;
  const globalEnd = globalStart + perTypeCount;
  const startTmdbPage = Math.floor(globalStart / TMDB_PAGE_SIZE) + 1;
  const endTmdbPage = Math.floor((globalEnd - 1) / TMDB_PAGE_SIZE) + 1;
  const tmdbPages: number[] = [];
  for (let p = startTmdbPage; p <= endTmdbPage; p++) {
    tmdbPages.push(p);
  }
  const bufferBaseOffset = (startTmdbPage - 1) * TMDB_PAGE_SIZE;
  return {
    perTypeCount,
    globalStart,
    globalEnd,
    tmdbPages,
    sliceStartInBuffer: globalStart - bufferBaseOffset,
    sliceEndInBuffer: globalEnd - bufferBaseOffset
  };
}

/**
 * Merges equal slices of top-rated movies and TV shows deterministically
 * (interleaved by genuine `voteAverage` desc -> `voteCount` desc -> `mediaType` -> `id`)
 * while never fabricating missing ratings/votes and never duplicating entries.
 */
export function mergeBalancedTopRatedSlices<T extends { id: number; mediaType: string; voteAverage?: number; voteCount?: number }>(
  movieSlice: T[],
  tvSlice: T[],
  limit: number = CATALOG_PAGE_SIZE
): T[] {
  const deduped = new Map<string, T>();
  const combined: T[] = [];

  for (const item of [...movieSlice, ...tvSlice]) {
    if (!item || !item.id) continue;
    const key = `${item.mediaType}:${item.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
      combined.push(item);
    }
  }

  combined.sort((a, b) => {
    const avgDiff = (b.voteAverage || 0) - (a.voteAverage || 0);
    if (avgDiff !== 0) return avgDiff;
    const countDiff = (b.voteCount || 0) - (a.voteCount || 0);
    if (countDiff !== 0) return countDiff;
    if (a.mediaType !== b.mediaType) {
      return a.mediaType === 'movie' ? -1 : 1;
    }
    return a.id - b.id;
  });

  return combined.slice(0, limit);
}
