import {
  MediaItem,
  MediaDetail,
  MovieDetail,
  TVDetail,
  CollectionSummary,
  PaginatedResponse,
  FilterOptions,
  MediaType,
  Episode,
  Season
} from '../types/media';
import {
  EXPANDED_CATALOG,
  DETAILED_MOVIES,
  DETAILED_TV_SHOWS,
  SPIDERMAN_COLLECTION,
  AVENGERS_COLLECTION,
  HARRY_POTTER_COLLECTION,
  PIRATES_COLLECTION,
  ALL_GENRES
} from './catalogData';
import { getPlatformConfigById, getConfiguredWatchRegion, normalizeWatchRegion } from './platformConfig';
import {
  buildPlatformDiscoverPlan,
  computeBalancedTopRatedPlan,
  mergeBalancedTopRatedSlices,
  sortNormalizedMedia,
  CATALOG_PAGE_SIZE
} from './platformDiscovery';
import { getUserSettings } from './storage';
import { slugToTag, tagToSlug } from '../utils/tags';
import { getGenreById, itemMatchesGenre } from '../utils/genres';

export const TMDB_BASE_URL =
  typeof window !== 'undefined' ? '/api/tmdb' : 'https://api.themoviedb.org/3';
export const DEFAULT_TMDB_API_KEY = '';

function canUseClientTmdbProxy(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Deprecated: TMDB API keys are never exposed in browser bundles.
 * Live requests from the browser transparently go through /api/tmdb on the server.
 */
export function getTmdbApiKey(): string {
  return DEFAULT_TMDB_API_KEY;
}

export function setTmdbApiKey(_key: string) {
  // No-op: TMDB keys are managed server-side only via TMDB_API_KEY
}

const PAGE_SIZE = 12;

export function normalizeTMDBItem(raw: any, category?: string): MediaItem {
  const isMovie = raw.media_type
    ? raw.media_type === 'movie'
    : category && category.includes('tv')
    ? false
    : raw.first_air_date
    ? false
    : true;
  const type: MediaType = isMovie ? 'movie' : 'tv';

  const genres = (raw.genre_ids || raw.genres || []).map((g: any) => {
    if (typeof g === 'object' && g.id && g.name) return g;
    const gid = typeof g === 'number' ? g : parseInt(g, 10);
    return ALL_GENRES.find(item => item.id === gid) || { id: gid || 0, name: 'Cinema' };
  });

  return {
    id: raw.id,
    tmdbId: raw.id,
    imdbId: raw.imdb_id || raw.external_ids?.imdb_id,
    title: raw.title || raw.name || 'Untitled',
    overview: raw.overview || 'No overview available.',
    posterPath: raw.poster_path
      ? `https://image.tmdb.org/t/p/w500${raw.poster_path}`
      : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80',
    backdropPath: raw.backdrop_path
      ? `https://image.tmdb.org/t/p/original${raw.backdrop_path}`
      : raw.poster_path
      ? `https://image.tmdb.org/t/p/original${raw.poster_path}`
      : 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=1280&auto=format&fit=crop&q=80',
    releaseDate: raw.release_date || raw.first_air_date || '2026',
    voteAverage: Number((raw.vote_average || 0).toFixed(1)),
    voteCount: raw.vote_count || 0,
    popularity: raw.popularity || 0,
    genres,
    mediaType: type,
    certification: raw.adult ? 'R' : 'PG-13'
  };
}

/**
 * Normalizes and filters local catalogue as robust fallback
 */
export function queryLocalCatalog(options: FilterOptions = {}): PaginatedResponse<MediaItem> {
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  let items = [...EXPANDED_CATALOG];

  if (options.mediaType && options.mediaType !== 'all') {
    items = items.filter(item => item.mediaType === options.mediaType);
  }

  if (options.genreId) {
    const genreMeta = getGenreById(Number(options.genreId));
    items = genreMeta
      ? items.filter(item => itemMatchesGenre(item, genreMeta))
      : items.filter(item => item.genres.some(g => g.id === Number(options.genreId)));
  }

  if (options.year) {
    items = items.filter(item => {
      const year = new Date(item.releaseDate).getFullYear();
      return year === Number(options.year);
    });
  }

  if (options.minRating) {
    items = items.filter(item => item.voteAverage >= Number(options.minRating));
  }

  if (options.query && options.query.trim()) {
    const q = options.query.trim().toLowerCase();
    items = items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.overview.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.some(k => k.name.toLowerCase().includes(q)))
    );
  }

  if (options.platform) {
    const plat = getPlatformConfigById(options.platform);
    if (!plat || plat.verifiedCatalogIds.length === 0) {
      items = [];
    } else {
      const allowedIds = new Set(plat.verifiedCatalogIds);
      items = items.filter(item => allowedIds.has(Number(item.id || item.tmdbId)));
    }
  }

  if (options.letter && options.letter !== 'All') {
    const l = options.letter.toUpperCase().trim();
    if (l === '0-9') {
      items = items.filter(item => {
        const clean = item.title.replace(/^[^a-zA-Z0-9]+/, '').trim();
        return /^[0-9]/.test(clean);
      });
    } else {
      items = items.filter(item => {
        const clean = item.title.replace(/^[^a-zA-Z0-9]+/, '').trim();
        return clean.toUpperCase().startsWith(l);
      });
    }
  }

  const sortBy = options.sortBy || 'popularity.desc';
  items.sort((a, b) => {
    switch (sortBy) {
      case 'popularity.desc':
        return b.popularity - a.popularity;
      case 'vote_average.desc':
        return b.voteAverage - a.voteAverage;
      case 'primary_release_date.desc':
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      case 'title.asc':
        return a.title.localeCompare(b.title);
      default:
        return b.popularity - a.popularity;
    }
  });

  const totalResults = items.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const validPage = Math.min(page, totalPages);
  const startIndex = (validPage - 1) * PAGE_SIZE;
  const paginatedResults = items.slice(startIndex, startIndex + PAGE_SIZE);

  return {
    page: validPage,
    totalPages,
    totalResults,
    results: paginatedResults
  };
}

export async function fetchCatalog(
  category: 'trending' | 'movies' | 'tv' | 'popular-movies' | 'top-movies' | 'popular-tv' | 'top-tv' | 'top-rated' | 'airing-today' | 'upcoming' | 'search' | 'platform' | 'az',
  page = 1,
  extraFilters: Partial<FilterOptions> = {},
  requestOpts: { throwOnError?: boolean; fetchImpl?: typeof fetch } = {}
): Promise<PaginatedResponse<MediaItem>> {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const fetchFn = requestOpts.fetchImpl || fetch;
  const resolveRegion = () => {
    if (extraFilters.watchRegion) return normalizeWatchRegion(extraFilters.watchRegion);
    if (typeof window !== 'undefined') {
      return normalizeWatchRegion(getUserSettings()?.preferredWatchRegion);
    }
    return getConfiguredWatchRegion();
  };

  if (!canUseClientTmdbProxy() && !requestOpts.fetchImpl) {
    return queryLocalCatalog({
      ...extraFilters,
      page: safePage,
      sortBy: extraFilters.sortBy || (category === 'top-rated' ? 'vote_average.desc' : undefined),
      mediaType:
        extraFilters.mediaType ||
        (category.includes('tv') ? 'tv' : category.includes('movie') ? 'movie' : 'all')
    });
  }

  try {
    // 1. Unified Watch-Provider Platform Discovery (matching server SSR/prerender criteria 1:1)
    const platformId = extraFilters.platform || (category === 'platform' ? 'netflix' : undefined);
    if (platformId) {
      const platform = getPlatformConfigById(platformId);
      if (platform) {
        const sortBy = extraFilters.sortBy || 'popularity.desc';
        const targetType = extraFilters.mediaType || 'all';
        const watchRegion = resolveRegion();
        const plan = buildPlatformDiscoverPlan(platform, {
          page: safePage,
          mediaType: targetType,
          sortBy,
          watchRegion,
          genreId: extraFilters.genreId,
          year: extraFilters.year,
          minRating: extraFilters.minRating
        });

        const movPromise = plan.moviePathAndQuery
          ? fetchFn(`${TMDB_BASE_URL}${plan.moviePathAndQuery}`)
          : Promise.resolve(null);
        const tvPromise = plan.tvPathAndQuery
          ? fetchFn(`${TMDB_BASE_URL}${plan.tvPathAndQuery}`)
          : Promise.resolve(null);

        const [movRes, tvRes] = await Promise.all([movPromise, tvPromise]);

        const movTransientErr = movRes && (movRes.status === 429 || movRes.status >= 500);
        const tvTransientErr = tvRes && (tvRes.status === 429 || tvRes.status >= 500);
        const hasOk = Boolean((movRes && movRes.ok) || (tvRes && tvRes.ok));

        if (requestOpts.throwOnError && (movTransientErr || tvTransientErr || movRes?.status === 503 || tvRes?.status === 503)) {
          const err: any = new Error(`TMDB platform request failed (${movTransientErr ? movRes?.status : tvRes?.status || 503})`);
          err.status = movTransientErr ? movRes?.status : (tvRes?.status || 503);
          throw err;
        }

        if (!hasOk) {
          // When server explicitly returned 503 (TMDB key not configured) vs HTTP 200 empty:
          // fall back ONLY if unconfigured local catalog has verified originals; do not fabricate on empty 200.
          if ((movRes && movRes.ok === false && !movTransientErr) && (tvRes && tvRes.ok === false && !tvTransientErr)) {
            return { page: safePage, totalPages: 1, totalResults: 0, results: [] };
          }
          return queryLocalCatalog({ ...extraFilters, platform: platform.id, mediaType: targetType, page: safePage });
        }

        const [movData, tvData] = await Promise.all([
          movRes && movRes.ok ? movRes.json() : { results: [], total_pages: 1, total_results: 0 },
          tvRes && tvRes.ok ? tvRes.json() : { results: [], total_pages: 1, total_results: 0 }
        ]);

        const movieItems: MediaItem[] = (movData.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem({ ...r, media_type: 'movie' }, 'movies'));
        const tvItems: MediaItem[] = (tvData.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem({ ...r, media_type: 'tv' }, 'tv'));

        const merged = new Map<string, MediaItem>();
        for (const item of [...tvItems, ...movieItems]) {
          merged.set(`${item.mediaType}:${item.id}`, item);
        }
        const combined = sortNormalizedMedia(Array.from(merged.values()), sortBy);

        return {
          page: safePage,
          totalPages: Math.min(Math.max(tvData.total_pages || 1, movData.total_pages || 1), 500),
          totalResults: (tvData.total_results || 0) + (movData.total_results || 0),
          results: combined.slice(0, CATALOG_PAGE_SIZE)
        };
      }
    }

    // 2. Alphabetical A-Z Search (e.g. Letter A, B, M, or 0-9)
    const letter = extraFilters.letter || (category === 'az' ? 'A' : undefined);
    if (letter && letter !== 'All') {
      const targetLetter = letter.toUpperCase().trim();
      const targetType = extraFilters.mediaType || 'all';
      const sortBy = extraFilters.sortBy || 'popularity.desc';
      const isNumberMode = targetLetter === '0-9';

      let searchQueries: string[] = [];
      if (isNumberMode) {
        searchQueries = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      } else {
        const phonemes = ['a', 'e', 'i', 'o', 'u', 'y', 'h', 'l', 'r', 's', 't', 'b', 'c', 'd', 'k', 'm', 'n', 'p', 'w'];
        searchQueries = [targetLetter, ...phonemes.map(v => `${targetLetter}${v}`)];
        if (targetLetter === 'M') {
          searchQueries.unshift('Masterplan');
        }
      }

      const discPromises: Promise<any>[] = [];
      if (targetType === 'all' || targetType === 'movie') {
        for (let p = 1; p <= 4; p++) {
          discPromises.push(
            fetch(`${TMDB_BASE_URL}/discover/movie?sort_by=popularity.desc&page=${p}&include_adult=false`)
              .then(r => r.ok ? r.json() : { results: [] })
              .catch(() => ({ results: [] }))
          );
        }
      }
      if (targetType === 'all' || targetType === 'tv') {
        for (let p = 1; p <= 4; p++) {
          discPromises.push(
            fetch(`${TMDB_BASE_URL}/discover/tv?sort_by=popularity.desc&page=${p}&include_adult=false`)
              .then(r => r.ok ? r.json() : { results: [] })
              .catch(() => ({ results: [] }))
          );
        }
      }

      const searchPromises = searchQueries.slice(0, 14).map(q =>
        fetch(`${TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(q)}&page=1&include_adult=false`)
          .then(r => r.ok ? r.json() : { results: [] })
          .catch(() => ({ results: [] }))
      );

      const [discData, searchData] = await Promise.all([
        Promise.all(discPromises),
        Promise.all(searchPromises)
      ]);

      const rawItems = [
        ...discData.flatMap(d => d.results || []),
        ...searchData.flatMap(s => s.results || [])
      ];

      const seen = new Set<string>();
      let matchedItems: MediaItem[] = [];

      // 1. Guaranteed include all verified local movies & series that start with target letter (e.g. Masterplan, Matrix, etc.)
      const localMatches = queryLocalCatalog({
        letter: targetLetter,
        mediaType: targetType,
        genreId: extraFilters.genreId,
        year: extraFilters.year,
        minRating: extraFilters.minRating
      });
      for (const loc of (localMatches.results || [])) {
        const key = `${loc.mediaType}-${loc.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          matchedItems.push(loc);
        }
      }

      for (const r of rawItems) {
        if (!r.poster_path && !r.backdrop_path) continue;
        const rawTitle = (r.title || r.name || '').trim();
        if (!rawTitle) continue;

        const cleanTitle = rawTitle.replace(/^[^a-zA-Z0-9]+/, '').trim();
        if (!cleanTitle) continue;

        let startsWithTarget = false;
        if (isNumberMode) {
          startsWithTarget = /^[0-9]/.test(cleanTitle);
        } else {
          startsWithTarget = cleanTitle.toUpperCase().startsWith(targetLetter);
        }

        if (startsWithTarget) {
          const item = normalizeTMDBItem(r);
          if (targetType !== 'all' && item.mediaType !== targetType) continue;
          if (extraFilters.genreId && !item.genres.some(g => g.id === extraFilters.genreId)) continue;
          if (extraFilters.year) {
            const y = new Date(item.releaseDate).getFullYear();
            if (y !== extraFilters.year) continue;
          }
          if (extraFilters.minRating && item.voteAverage < extraFilters.minRating) continue;

          const key = `${item.mediaType}-${item.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            matchedItems.push(item);
          }
        }
      }

      if (sortBy === 'vote_average.desc') {
        matchedItems.sort((a, b) => b.voteAverage - a.voteAverage);
      } else if (sortBy === 'primary_release_date.desc') {
        matchedItems.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
      } else if (sortBy === 'title.asc') {
        matchedItems.sort((a, b) => a.title.localeCompare(b.title));
      } else {
        matchedItems.sort((a, b) => b.popularity - a.popularity);
      }

      const PAGE_SIZE_AZ = 18;
      const totalResults = matchedItems.length;
      const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE_AZ));
      const validPage = Math.min(safePage, totalPages);
      const startIndex = (validPage - 1) * PAGE_SIZE_AZ;
      const paginatedResults = matchedItems.slice(startIndex, startIndex + PAGE_SIZE_AZ);

      return {
        page: validPage,
        totalPages,
        totalResults,
        results: paginatedResults
      };
    }

    // 3. Search query mode
    if (extraFilters.query && extraFilters.query.trim()) {
      const q = encodeURIComponent(extraFilters.query.trim());
      const searchType = extraFilters.mediaType === 'movie' ? 'movie' : extraFilters.mediaType === 'tv' ? 'tv' : 'multi';
      const url = `${TMDB_BASE_URL}/search/${searchType}?query=${q}&page=${safePage}&include_adult=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        let results: MediaItem[] = (data.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem(r, category));

        // Filter in-memory if additional filters active on search
        if (extraFilters.genreId) {
          results = results.filter((i: MediaItem) => i.genres.some(g => g.id === extraFilters.genreId));
        }
        if (extraFilters.year) {
          results = results.filter((i: MediaItem) => new Date(i.releaseDate).getFullYear() === extraFilters.year);
        }
        if (extraFilters.minRating) {
          results = results.filter((i: MediaItem) => i.voteAverage >= extraFilters.minRating!);
        }
        return {
          page: data.page || safePage,
          totalPages: Math.min(data.total_pages || 1, 500),
          totalResults: data.total_results || results.length,
          results
        };
      }
    }

    // 4. Discovery / Filter Mode (Movies, TV Shows, Trending, Top Rated Balanced, Genres, Ratings, Years)
    let targetType: 'all' | 'movie' | 'tv' = extraFilters.mediaType || 'all';
    if (!extraFilters.mediaType || extraFilters.mediaType === 'all') {
      if (category === 'movies' || category === 'popular-movies' || category === 'top-movies' || category === 'upcoming') {
        targetType = 'movie';
      } else if (category === 'tv' || category === 'popular-tv' || category === 'top-tv' || category === 'airing-today') {
        targetType = 'tv';
      }
    }

    const isDefaultTopRatedMixed =
      category === 'top-rated' &&
      targetType === 'all' &&
      !extraFilters.genreId &&
      !extraFilters.year &&
      !extraFilters.minRating &&
      !extraFilters.country &&
      (!extraFilters.sortBy || extraFilters.sortBy === 'vote_average.desc');

    if (isDefaultTopRatedMixed) {
      const plan = computeBalancedTopRatedPlan(safePage, CATALOG_PAGE_SIZE / 2);
      const [movPagesData, tvPagesData] = await Promise.all([
        Promise.all(
          plan.tmdbPages.map(p =>
            fetchFn(`${TMDB_BASE_URL}/movie/top_rated?page=${p}`)
              .then(r => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        ),
        Promise.all(
          plan.tmdbPages.map(p =>
            fetchFn(`${TMDB_BASE_URL}/tv/top_rated?page=${p}`)
              .then(r => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        )
      ]);

      const validMov = movPagesData.filter(Boolean);
      const validTv = tvPagesData.filter(Boolean);
      if (validMov.length > 0 || validTv.length > 0) {
        const movPool = validMov
          .flatMap((d: any) => d.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem({ ...r, media_type: 'movie' }, 'movies'));
        const tvPool = validTv
          .flatMap((d: any) => d.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem({ ...r, media_type: 'tv' }, 'tv'));

        const movieSlice = movPool.slice(plan.sliceStartInBuffer, plan.sliceEndInBuffer);
        const tvSlice = tvPool.slice(plan.sliceStartInBuffer, plan.sliceEndInBuffer);
        const results = mergeBalancedTopRatedSlices(movieSlice, tvSlice, CATALOG_PAGE_SIZE);

        const maxMovTotal = validMov[0]?.total_results || movPool.length;
        const maxTvTotal = validTv[0]?.total_results || tvPool.length;
        const maxPairsAvailable = Math.min(Math.floor(maxMovTotal / plan.perTypeCount), Math.floor(maxTvTotal / plan.perTypeCount));
        const totalPages = Math.max(1, Math.min(Math.max(maxPairsAvailable, validMov.length || validTv.length ? 1 : 0), 500));

        return {
          page: safePage,
          totalPages,
          totalResults: maxMovTotal + maxTvTotal,
          results
        };
      }
    }

    const defaultSort = (category === 'top-movies' || category === 'top-tv' || category === 'top-rated') ? 'vote_average.desc' : 'popularity.desc';
    const sortBy = extraFilters.sortBy || defaultSort;
    const genreMeta = extraFilters.genreId ? getGenreById(Number(extraFilters.genreId)) : undefined;
    const movieGenreId = genreMeta ? genreMeta.tmdbMovieGenreId : extraFilters.genreId;
    const tvGenreId = genreMeta ? genreMeta.tmdbTvGenreId : extraFilters.genreId;
    const genreQueryMovie = movieGenreId ? `&with_genres=${movieGenreId}` : '';
    const genreQueryTv = tvGenreId ? `&with_genres=${tvGenreId}` : '';
    const minRatingQuery = extraFilters.minRating
      ? `&vote_average.gte=${extraFilters.minRating}&vote_count.gte=30`
      : (sortBy === 'vote_average.desc' ? '&vote_count.gte=80' : '');
    const yearQueryMovie = extraFilters.year ? `&primary_release_year=${extraFilters.year}` : '';
    const yearQueryTv = extraFilters.year ? `&first_air_date_year=${extraFilters.year}` : '';
    const countryQuery = extraFilters.country ? `&with_origin_country=${extraFilters.country}` : '';

    if (targetType === 'movie') {
      if (extraFilters.genreId && !movieGenreId) {
        return { page: safePage, totalPages: 1, totalResults: 0, results: [] };
      }
      const movUrl = `${TMDB_BASE_URL}/discover/movie?sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQueryMovie}${minRatingQuery}${yearQueryMovie}${countryQuery}`;
      const res = await fetch(movUrl);
      if (res.ok) {
        const data = await res.json();
        const results = (data.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem(r, 'movies'));
        return {
          page: data.page || safePage,
          totalPages: Math.min(data.total_pages || 1, 500),
          totalResults: data.total_results || results.length,
          results
        };
      }
    } else if (targetType === 'tv') {
      if (extraFilters.genreId && !tvGenreId) {
        return { page: safePage, totalPages: 1, totalResults: 0, results: [] };
      }
      const tvUrl = `${TMDB_BASE_URL}/discover/tv?sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQueryTv}${minRatingQuery}${yearQueryTv}${countryQuery}`;
      const res = await fetch(tvUrl);
      if (res.ok) {
        const data = await res.json();
        const results = (data.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem(r, 'tv'));
        return {
          page: data.page || safePage,
          totalPages: Math.min(data.total_pages || 1, 500),
          totalResults: data.total_results || results.length,
          results
        };
      }
    } else {
      // 'all' Content: Fetch discover movie & discover tv in parallel
      const movPromise = extraFilters.genreId && !movieGenreId
        ? Promise.resolve(null)
        : fetch(`${TMDB_BASE_URL}/discover/movie?sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQueryMovie}${minRatingQuery}${yearQueryMovie}${countryQuery}`).catch(() => null);
      const tvPromise = extraFilters.genreId && !tvGenreId
        ? Promise.resolve(null)
        : fetch(`${TMDB_BASE_URL}/discover/tv?sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQueryTv}${minRatingQuery}${yearQueryTv}${countryQuery}`).catch(() => null);

      const [movRes, tvRes] = await Promise.all([movPromise, tvPromise]);

      if ((movRes && movRes.ok) || (tvRes && tvRes.ok)) {
        const [movData, tvData] = await Promise.all([
          movRes && movRes.ok ? movRes.json() : { results: [], total_pages: 1, total_results: 0 },
          tvRes && tvRes.ok ? tvRes.json() : { results: [], total_pages: 1, total_results: 0 }
        ]);

        const movItems = (movData.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem({ ...r, media_type: 'movie' }, 'movies'));
        const tvItems = (tvData.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem({ ...r, media_type: 'tv' }, 'tv'));

        const combined = [...movItems, ...tvItems];
        if (sortBy === 'vote_average.desc') {
          combined.sort((a, b) => b.voteAverage - a.voteAverage);
        } else if (sortBy === 'primary_release_date.desc') {
          combined.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
        } else if (sortBy === 'title.asc') {
          combined.sort((a, b) => a.title.localeCompare(b.title));
        } else {
          combined.sort((a, b) => b.popularity - a.popularity);
        }

        return {
          page: safePage,
          totalPages: Math.min(Math.max(movData.total_pages || 1, tvData.total_pages || 1), 500),
          totalResults: (movData.total_results || 0) + (tvData.total_results || 0),
          results: combined
        };
      }
    }
  } catch (err) {
    if (requestOpts.throwOnError) {
      throw err;
    }
    console.warn('Real TMDB API fetch failed, falling back to local dataset:', err);
  }

  // Graceful fallback
  return queryLocalCatalog({
    ...extraFilters,
    page: safePage,
    sortBy: extraFilters.sortBy || (category === 'top-rated' ? 'vote_average.desc' : undefined),
    mediaType: extraFilters.mediaType || (category.includes('tv') ? 'tv' : category.includes('movie') ? 'movie' : 'all')
  });
}

/**
 * Fetch media detail by ID and type with full TMDB live data
 */
export async function getMediaDetail(id: number, type: MediaType): Promise<MediaDetail | null> {
  if (canUseClientTmdbProxy()) {
    try {
      const res = await fetch(
        `${TMDB_BASE_URL}/${type}/${id}?append_to_response=videos,credits,recommendations,similar,external_ids,keywords`
      );
      if (res.status === 404) {
        // Check strictly if this ID exists in local curated catalog before returning null
        if (type === 'movie') {
          const foundMovie = DETAILED_MOVIES.find(m => m.id === id || m.tmdbId === id);
          if (foundMovie) return foundMovie;
        } else {
          const foundTV = DETAILED_TV_SHOWS.find(t => t.id === id || t.tmdbId === id);
          if (foundTV) return foundTV;
        }
        return null;
      }
      if (res.ok) {
        const data = await res.json();

        // If movie has belongs_to_collection, fetch full collection parts from TMDB
        if (type === 'movie') {
          if (data.belongs_to_collection && data.belongs_to_collection.id) {
            try {
              const colRes = await fetch(`${TMDB_BASE_URL}/collection/${data.belongs_to_collection.id}`);
              if (colRes.ok) {
                const colData = await colRes.json();
                data.belongs_to_collection.name = colData.name || data.belongs_to_collection.name;
                data.belongs_to_collection.overview = colData.overview || data.belongs_to_collection.overview;
                data.belongs_to_collection.poster_path = colData.poster_path || data.belongs_to_collection.poster_path;
                data.belongs_to_collection.backdrop_path = colData.backdrop_path || data.belongs_to_collection.backdrop_path;
                data.belongs_to_collection.parts = (colData.parts || []).map((p: any) => normalizeTMDBItem(p, 'movies'));
              }
            } catch {
              // ignore collection fetch failure
            }
          } else {
            // Automatic franchise search by title if belongs_to_collection is absent
            try {
              const cleanTitle = (data.title || '').split(/[:–—\-]/)[0].trim();
              if (cleanTitle.length >= 3) {
                const sRes = await fetch(`${TMDB_BASE_URL}/search/collection?query=${encodeURIComponent(cleanTitle)}`);
                if (sRes.ok) {
                  const sData = await sRes.json();
                  const matchedCol = sData.results?.[0];
                  if (matchedCol && matchedCol.id) {
                    const colRes = await fetch(`${TMDB_BASE_URL}/collection/${matchedCol.id}`);
                    if (colRes.ok) {
                      const colData = await colRes.json();
                      data.belongs_to_collection = {
                        id: colData.id,
                        name: colData.name,
                        overview: colData.overview,
                        poster_path: colData.poster_path,
                        backdrop_path: colData.backdrop_path,
                        parts: (colData.parts || []).map((p: any) => normalizeTMDBItem(p, 'movies'))
                      };
                    }
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }

        if (type === 'tv') {
          const tvDetail = normalizeTMDBDetail(data, type) as TVDetail;
          const primarySeason = tvDetail.seasons?.find(s => s.seasonNumber === 1) || tvDetail.seasons?.[0];
          if (primarySeason) {
            try {
              const episodes = await fetchSeasonEpisodes(tvDetail.id, primarySeason.seasonNumber);
              primarySeason.episodes = episodes;
            } catch {
              // ignore
            }
          }
          return tvDetail;
        }

        return normalizeTMDBDetail(data, type);
      }
    } catch (err) {
      console.warn('TMDB API detail fetch failed, checking local catalog:', err);
    }
  }

  // Fallback to local curated items when offline or unmatched
  if (type === 'movie') {
    const foundMovie = DETAILED_MOVIES.find(m => m.id === id || m.tmdbId === id);
    if (foundMovie) return foundMovie;
    const basic = EXPANDED_CATALOG.find(m => (m.id === id || m.tmdbId === id) && m.mediaType === 'movie');
    if (basic) return createDefaultMovieDetail(basic);
  } else {
    const foundTV = DETAILED_TV_SHOWS.find(t => t.id === id || t.tmdbId === id);
    if (foundTV) return foundTV;
    const basic = EXPANDED_CATALOG.find(t => (t.id === id || t.tmdbId === id) && mTypeMatches(t, 'tv'));
    if (basic) return createDefaultTVDetail(basic);
  }

  // Genuine 404: do NOT substitute another movie/show
  return null;
}

function mTypeMatches(item: MediaItem, type: MediaType): boolean {
  return item.mediaType === type;
}

/**
 * Get Collection details live from TMDB API with local fallback
 */
export async function getCollectionDetail(collectionId: number): Promise<CollectionSummary | null> {
  if (canUseClientTmdbProxy()) {
    try {
      const res = await fetch(`${TMDB_BASE_URL}/collection/${collectionId}`);
      if (res.ok) {
        const raw = await res.json();
        return {
          id: raw.id,
          name: raw.name,
          overview: raw.overview,
          posterPath: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : null,
          backdropPath: raw.backdrop_path ? `https://image.tmdb.org/t/p/original${raw.backdrop_path}` : null,
          parts: (raw.parts || []).map((p: any) => normalizeTMDBItem(p, 'movies'))
        };
      }
    } catch (err) {
      console.warn('TMDB collection fetch failed:', err);
    }
  }

  const collections: Record<number, CollectionSummary> = {
    531241: SPIDERMAN_COLLECTION,
    86311: AVENGERS_COLLECTION,
    1241: HARRY_POTTER_COLLECTION,
    295: PIRATES_COLLECTION
  };

  return collections[collectionId] || null;
}

/**
 * Fetch movies & TV series by keyword / tag from TMDB API with clean local catalog fallback
 */
export async function fetchByTag(
  tagName: string,
  page = 1,
  fetchImpl: typeof fetch = fetch
): Promise<PaginatedResponse<MediaItem>> {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const tagPhrase = slugToTag(tagName) || tagName.replace(/^#/, '').trim().toLowerCase();
  const targetSlug = tagToSlug(tagName);

  if ((canUseClientTmdbProxy() || fetchImpl !== fetch) && tagPhrase) {
    try {
      const kwRes = await fetchImpl(`${TMDB_BASE_URL}/search/keyword?query=${encodeURIComponent(tagPhrase)}&page=1`);
      if (kwRes.ok) {
        const kwData = await kwRes.json();
        const keywords = Array.isArray(kwData?.results) ? kwData.results : [];
        const firstKw =
          keywords.find((k: any) => {
            const kName = String(k.name || '').toLowerCase().trim();
            return kName === tagPhrase || (targetSlug && tagToSlug(kName) === targetSlug);
          }) || keywords[0];
        if (firstKw && firstKw.id) {
          const [disMovRes, disTvRes] = await Promise.all([
            fetchImpl(`${TMDB_BASE_URL}/discover/movie?with_keywords=${firstKw.id}&page=${safePage}&sort_by=popularity.desc`).catch(() => null),
            fetchImpl(`${TMDB_BASE_URL}/discover/tv?with_keywords=${firstKw.id}&page=${safePage}&sort_by=popularity.desc`).catch(() => null)
          ]);

          const [disMovData, disTvData] = await Promise.all([
            disMovRes && disMovRes.ok ? disMovRes.json() : { results: [], total_pages: 1, total_results: 0 },
            disTvRes && disTvRes.ok ? disTvRes.json() : { results: [], total_pages: 1, total_results: 0 }
          ]);

          const movResults: MediaItem[] = (disMovData.results || []).map((r: any) => normalizeTMDBItem(r, 'movies'));
          const tvResults: MediaItem[] = (disTvData.results || []).map((r: any) => normalizeTMDBItem(r, 'tv'));
          const combined = [...movResults, ...tvResults].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

          if (combined.length > 0) {
            return {
              page: safePage,
              totalPages: Math.min(Math.max(disMovData.total_pages || 1, disTvData.total_pages || 1), 500),
              totalResults: (disMovData.total_results || 0) + (disTvData.total_results || 0),
              results: combined
            };
          }
        }
      }
    } catch (err) {
      console.warn('TMDB discover by keyword failed, using fallback:', err);
    }
  }

  return queryLocalCatalog({
    query: tagPhrase,
    page: safePage
  });
}

/**
 * Strict season episode fetcher that distinguishes genuine 404/empty from transient HTTP/network failures.
 */
export async function fetchSeasonEpisodesStrict(
  tvId: number,
  seasonNumber: number,
  fetchImpl: typeof fetch = fetch
): Promise<Episode[]> {
  if (canUseClientTmdbProxy() || fetchImpl !== fetch) {
    const res = await fetchImpl(`${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}`);
    if (res.status === 404) {
      const foundTV = DETAILED_TV_SHOWS.find(t => t.id === tvId || t.tmdbId === tvId);
      const foundSeason = foundTV?.seasons?.find(s => s.seasonNumber === seasonNumber);
      return foundSeason?.episodes || [];
    }
    if (!res.ok) {
      const err: any = new Error(`Failed loading season ${seasonNumber} episodes (HTTP ${res.status})`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (Array.isArray(data.episodes)) {
      return data.episodes.map((ep: any) => ({
        id: ep.id,
        episodeNumber: ep.episode_number,
        seasonNumber: ep.season_number ?? seasonNumber,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || '',
        stillPath: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
        airDate: ep.air_date || '',
        voteAverage: typeof ep.vote_average === 'number' && ep.vote_average > 0 ? Number(ep.vote_average.toFixed(1)) : 0,
        runtime: ep.runtime || undefined
      }));
    }
    return [];
  }

  const foundTV = DETAILED_TV_SHOWS.find(t => t.id === tvId || t.tmdbId === tvId);
  const foundSeason = foundTV?.seasons?.find(s => s.seasonNumber === seasonNumber);
  if (foundSeason?.episodes && foundSeason.episodes.length > 0) {
    return foundSeason.episodes;
  }
  return [];
}

/**
 * Fetch detailed episodes for a specific TV show season from TMDB API
 */
export async function fetchSeasonEpisodes(tvId: number, seasonNumber: number): Promise<Episode[]> {
  try {
    return await fetchSeasonEpisodesStrict(tvId, seasonNumber);
  } catch (err) {
    console.warn(`Failed to fetch season ${seasonNumber} episodes for tv ${tvId}:`, err);
    const foundTV = DETAILED_TV_SHOWS.find(t => t.id === tvId || t.tmdbId === tvId);
    const foundSeason = foundTV?.seasons?.find(s => s.seasonNumber === seasonNumber);
    if (foundSeason?.episodes && foundSeason.episodes.length > 0) {
      return foundSeason.episodes;
    }
    return [];
  }
}

function normalizeTMDBDetail(raw: any, type: MediaType): MediaDetail {
  const isMovie = type === 'movie';
  const base: MediaItem = {
    id: raw.id,
    tmdbId: raw.id,
    imdbId: raw.external_ids?.imdb_id || raw.imdb_id,
    title: isMovie ? raw.title : raw.name,
    overview: raw.overview || 'No overview available.',
    posterPath: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : '',
    backdropPath: raw.backdrop_path ? `https://image.tmdb.org/t/p/original${raw.backdrop_path}` : '',
    releaseDate: isMovie ? raw.release_date : raw.first_air_date,
    voteAverage: Number((raw.vote_average || 0).toFixed(1)),
    voteCount: raw.vote_count || 0,
    popularity: raw.popularity || 0,
    genres: raw.genres || [],
    mediaType: type,
    certification: raw.adult ? 'R' : 'PG-13',
    runtime: isMovie ? raw.runtime : undefined,
    numberOfSeasons: !isMovie ? raw.number_of_seasons : undefined,
    numberOfEpisodes: !isMovie ? raw.number_of_episodes : undefined,
    tagline: raw.tagline || '',
    keywords: (raw.keywords?.keywords || raw.keywords?.results || []).map((k: any) => ({
      id: k.id,
      name: k.name
    }))
  };

  const cast = (raw.credits?.cast || []).slice(0, 14).map((c: any, index: number) => ({
    id: c.id,
    name: c.name,
    character: c.character || 'Cast',
    profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    order: index
  }));

  const videos = (raw.videos?.results || []).map((v: any) => ({
    id: v.id,
    key: v.key,
    name: v.name,
    site: v.site,
    type: v.type,
    official: v.official || false
  }));

  const similar = (raw.similar?.results || []).slice(0, 7).map((s: any) => normalizeTMDBItem(s, type));
  const recommendations = (raw.recommendations?.results || []).slice(0, 7).map((s: any) => normalizeTMDBItem(s, type));

  // Format budget & revenue
  const formatMoney = (amount?: number) => {
    if (!amount || amount === 0) return undefined;
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
    return `$${amount.toLocaleString()}`;
  };

  const director = raw.credits?.crew?.find((c: any) => c.job === 'Director')?.name;
  const writer = raw.credits?.crew?.find((c: any) => c.job === 'Writer' || c.job === 'Screenplay')?.name;

  if (isMovie) {
    return {
      ...base,
      mediaType: 'movie',
      status: raw.status || 'Released',
      budget: raw.budget,
      revenue: raw.revenue,
      budgetFormatted: formatMoney(raw.budget),
      revenueFormatted: formatMoney(raw.revenue),
      director,
      writer,
      productionCompanies: (raw.production_companies || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        logoPath: p.logo_path ? `https://image.tmdb.org/t/p/w200${p.logo_path}` : null,
        originCountry: p.origin_country || ''
      })),
      productionCountries: (raw.production_countries || []).map((c: any) => c.name),
      spokenLanguages: (raw.spoken_languages || []).map((l: any) => l.english_name || l.name),
      belongsToCollection: raw.belongs_to_collection ? {
        id: raw.belongs_to_collection.id,
        name: raw.belongs_to_collection.name,
        posterPath: raw.belongs_to_collection.poster_path ? `https://image.tmdb.org/t/p/w500${raw.belongs_to_collection.poster_path}` : null,
        backdropPath: raw.belongs_to_collection.backdrop_path ? `https://image.tmdb.org/t/p/original${raw.belongs_to_collection.backdrop_path}` : null,
        parts: raw.belongs_to_collection.parts || []
      } : null,
      videos,
      cast,
      similar: similar.length > 0 ? similar : recommendations,
      recommendations: recommendations.length > 0 ? recommendations : similar
    } as MovieDetail;
  } else {
    return {
      ...base,
      mediaType: 'tv',
      status: raw.status || 'Returning Series',
      director,
      writer,
      productionCompanies: (raw.production_companies || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        logoPath: p.logo_path ? `https://image.tmdb.org/t/p/w200${p.logo_path}` : null,
        originCountry: p.origin_country || ''
      })),
      productionCountries: (raw.production_countries || []).map((c: any) => c.name),
      seasons: (() => {
        const rawSeasonList = Array.isArray(raw.seasons) ? raw.seasons : [];
        const maxSeasonFromList = rawSeasonList.reduce((max: number, s: any) => Math.max(max, Number(s.season_number) || 0), 0);
        const totalSeasonsCount = Math.max(
          Number(raw.number_of_seasons) || 1,
          maxSeasonFromList,
          rawSeasonList.filter((s: any) => s.season_number > 0).length,
          1
        );

        const resultSeasons = [];
        for (let sNum = 1; sNum <= totalSeasonsCount; sNum++) {
          const found = rawSeasonList.find((s: any) => s.season_number === sNum);
          if (found) {
            resultSeasons.push({
              id: found.id || ((raw.id || 1000) * 100 + sNum),
              seasonNumber: sNum,
              name: found.name || `Season ${sNum}`,
              overview: found.overview || '',
              posterPath: found.poster_path
                ? `https://image.tmdb.org/t/p/w500${found.poster_path}`
                : (raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : null),
              airDate: found.air_date || '',
              episodeCount: found.episode_count || 10,
              episodes: Array.isArray(found.episodes) ? found.episodes : undefined
            });
          } else {
            resultSeasons.push({
              id: (raw.id || 1000) * 100 + sNum,
              seasonNumber: sNum,
              name: `Season ${sNum}`,
              overview: `Season ${sNum} of ${raw.name || raw.title || 'the series'}.`,
              posterPath: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : null,
              airDate: '',
              episodeCount: 10,
              episodes: undefined
            });
          }
        }
        return resultSeasons;
      })(),
      videos,
      cast,
      similar: similar.length > 0 ? similar : recommendations,
      recommendations: recommendations.length > 0 ? recommendations : similar
    } as TVDetail;
  }
}

function createDefaultMovieDetail(item: MediaItem): MovieDetail {
  return {
    ...item,
    mediaType: 'movie',
    status: 'Released',
    productionCompanies: [
      { id: 1, name: 'Hollywood Studios', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America'],
    spokenLanguages: ['English'],
    belongsToCollection: null,
    videos: [
      { id: 'def_v', key: 'JfVOs4VSpmA', name: 'Official Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 101, name: 'Lead Actor', character: 'Protagonist', profilePath: null, order: 0 },
      { id: 102, name: 'Supporting Star', character: 'Companion', profilePath: null, order: 1 }
    ],
    similar: EXPANDED_CATALOG.filter(m => m.id !== item.id && m.mediaType === 'movie').slice(0, 4),
    recommendations: EXPANDED_CATALOG.filter(m => m.id !== item.id).slice(0, 4)
  };
}

function createDefaultTVDetail(item: MediaItem): TVDetail {
  const totalSeasons = Math.max(1, item.numberOfSeasons || 3);
  const seasons = Array.from({ length: totalSeasons }, (_, i) => {
    const sNum = i + 1;
    return {
      id: (item.id || 1000) * 100 + sNum,
      seasonNumber: sNum,
      name: `Season ${sNum}`,
      overview: `Season ${sNum} of ${item.title}.`,
      posterPath: item.posterPath,
      airDate: item.releaseDate,
      episodeCount: Math.round((item.numberOfEpisodes || 24) / totalSeasons) || 8,
      episodes: [
        {
          id: (item.id || 1000) * 1000 + sNum * 10 + 1,
          episodeNumber: 1,
          seasonNumber: sNum,
          name: `Episode 1`,
          overview: `Opening episode of Season ${sNum}.`,
          stillPath: item.backdropPath,
          airDate: item.releaseDate,
          voteAverage: item.voteAverage,
          runtime: 50
        },
        {
          id: (item.id || 1000) * 1000 + sNum * 10 + 2,
          episodeNumber: 2,
          seasonNumber: sNum,
          name: `Episode 2`,
          overview: `The next chapter unfolds.`,
          stillPath: item.backdropPath,
          airDate: item.releaseDate,
          voteAverage: item.voteAverage,
          runtime: 50
        }
      ]
    };
  });

  return {
    ...item,
    mediaType: 'tv',
    status: 'Ended',
    productionCompanies: [
      { id: 2, name: 'Network Productions', logoPath: null, originCountry: 'US' }
    ],
    productionCountries: ['United States of America'],
    spokenLanguages: ['English'],
    seasons,
    videos: [
      { id: 'def_tv_v', key: 'HhesaQXLuRY', name: 'Series Trailer', site: 'YouTube', type: 'Trailer', official: true }
    ],
    cast: [
      { id: 201, name: 'Lead Actor', character: 'Main Role', profilePath: null, order: 0 }
    ],
    similar: EXPANDED_CATALOG.filter(t => t.id !== item.id && t.mediaType === 'tv').slice(0, 4),
    recommendations: EXPANDED_CATALOG.filter(t => t.id !== item.id).slice(0, 4)
  };
}

/**
 * Fetches a randomized set of 20 high-quality movies/shows from TMDB
 * with Fisher-Yates shuffle and variable pages for true randomness
 */
export async function fetchRandomMedia(
  count: number = 20,
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  genreId?: number
): Promise<MediaItem[]> {
  const randomPage = Math.floor(Math.random() * 20) + 1; // page 1-20
  const randomSorts = [
    'popularity.desc',
    'vote_average.desc',
    'revenue.desc',
    'vote_count.desc'
  ];
  const sort = randomSorts[Math.floor(Math.random() * randomSorts.length)];
  const genreParam = genreId ? `&with_genres=${genreId}` : '';

  if (canUseClientTmdbProxy()) {
    try {
      let pool: MediaItem[] = [];

      if (mediaType === 'movie') {
        const url = `${TMDB_BASE_URL}/discover/movie?sort_by=${sort}&page=${randomPage}&vote_count.gte=150&vote_average.gte=5.5&include_adult=false${genreParam}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          pool = (data.results || []).map((r: any) => normalizeTMDBItem(r, 'movies'));
        }
      } else if (mediaType === 'tv') {
        const url = `${TMDB_BASE_URL}/discover/tv?sort_by=${sort}&page=${randomPage}&vote_count.gte=80&vote_average.gte=5.5&include_adult=false${genreParam}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          pool = (data.results || []).map((r: any) => normalizeTMDBItem(r, 'tv'));
        }
      } else {
        // Parallel discover for both movies & TV shows
        const [resM, resT] = await Promise.all([
          fetch(`${TMDB_BASE_URL}/discover/movie?sort_by=${sort}&page=${randomPage}&vote_count.gte=120&vote_average.gte=5.5&include_adult=false${genreParam}`).then(r => r.ok ? r.json() : null),
          fetch(`${TMDB_BASE_URL}/discover/tv?sort_by=${sort}&page=${randomPage}&vote_count.gte=80&vote_average.gte=5.5&include_adult=false${genreParam}`).then(r => r.ok ? r.json() : null)
        ]);

        const movies = (resM?.results || []).map((r: any) => normalizeTMDBItem(r, 'movies'));
        const tvs = (resT?.results || []).map((r: any) => normalizeTMDBItem(r, 'tv'));
        pool = [...movies, ...tvs];
      }

      // Filter valid items with poster and title
      const valid = pool.filter(item => item.posterPath && item.title && !item.posterPath.includes('null'));

      if (valid.length > 0) {
        // Fisher-Yates shuffle
        for (let i = valid.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [valid[i], valid[j]] = [valid[j], valid[i]];
        }
        return valid.slice(0, count);
      }
    } catch (err) {
      console.warn('fetchRandomMedia failed, using catalog fallback:', err);
    }
  }

  // Fallback to shuffled EXPANDED_CATALOG
  const shuffled = [...EXPANDED_CATALOG];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// ============================================================================
// PEOPLE & DIRECTORS API (Actors, Actresses & Renowned Directors)
// ============================================================================
export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday?: string;
  deathday?: string;
  placeOfBirth?: string;
  profilePath: string | null;
  knownForDepartment: string;
  popularity: number;
  combinedCredits: {
    cast: MediaItem[];
    crew: Array<MediaItem & { job: string }>;
  };
}

export interface PersonSummary {
  id: number;
  name: string;
  profilePath: string | null;
  knownForDepartment: string;
  popularity: number;
  knownFor: string[];
}

const FALLBACK_POPULAR_PEOPLE: PersonSummary[] = [
  {
    id: 1136406,
    name: 'Tom Holland',
    profilePath: 'https://image.tmdb.org/t/p/w500/bBRqqoK5p3aHqFXn6kLgQ2pBv6V.jpg',
    knownForDepartment: 'Acting',
    popularity: 98.4,
    knownFor: ['Spider-Man: Brand New Day', 'Spider-Man: No Way Home', 'Uncharted']
  },
  {
    id: 505710,
    name: 'Zendaya',
    profilePath: 'https://image.tmdb.org/t/p/w500/r2GQgZ4m3U1Q3z5v8Y7X4pZ3Q5a.jpg',
    knownForDepartment: 'Acting',
    popularity: 96.2,
    knownFor: ['Dune: Part Two', 'Euphoria', 'Challengers']
  },
  {
    id: 525,
    name: 'Christopher Nolan',
    profilePath: 'https://image.tmdb.org/t/p/w500/xuAIuYSmsUzKlUMBFGVZaWsY3Z5.jpg',
    knownForDepartment: 'Directing',
    popularity: 95.8,
    knownFor: ['Oppenheimer', 'Interstellar', 'Inception', 'The Dark Knight']
  },
  {
    id: 2037,
    name: 'Cillian Murphy',
    profilePath: 'https://image.tmdb.org/t/p/w500/llk2SmSp101BtZNV7sq51ZtFfVO.jpg',
    knownForDepartment: 'Acting',
    popularity: 94.7,
    knownFor: ['Oppenheimer', 'Peaky Blinders', 'Inception', '28 Days Later']
  },
  {
    id: 138,
    name: 'Quentin Tarantino',
    profilePath: 'https://image.tmdb.org/t/p/w500/9shFNfTls8N1q6eG356K80Wp1f5.jpg',
    knownForDepartment: 'Directing',
    popularity: 93.9,
    knownFor: ['Pulp Fiction', 'Inglourious Basterds', 'Django Unchained', 'Kill Bill']
  },
  {
    id: 137427,
    name: 'Denis Villeneuve',
    profilePath: 'https://image.tmdb.org/t/p/w500/zp4u12f1E5G3a2W1Y8X4pZ3Q5a.jpg',
    knownForDepartment: 'Directing',
    popularity: 92.5,
    knownFor: ['Dune: Part Two', 'Blade Runner 2049', 'Arrival', 'Sicario']
  },
  {
    id: 6193,
    name: 'Leonardo DiCaprio',
    profilePath: 'https://image.tmdb.org/t/p/w500/wo2hxAz6fGh25P0qBPu8VoOI2te.jpg',
    knownForDepartment: 'Acting',
    popularity: 91.8,
    knownFor: ['Inception', 'Titanic', 'The Wolf of Wall Street', 'The Revenant']
  },
  {
    id: 234352,
    name: 'Margot Robbie',
    profilePath: 'https://image.tmdb.org/t/p/w500/euDPyqLnuwaWMHajcU3oZ9uZezR.jpg',
    knownForDepartment: 'Acting',
    popularity: 91.1,
    knownFor: ['Barbie', 'The Wolf of Wall Street', 'Babylon', 'Suicide Squad']
  },
  {
    id: 2710,
    name: 'James Cameron',
    profilePath: 'https://image.tmdb.org/t/p/w500/9naovEsGvKn5qvZFFM5L9qZf1Wp.jpg',
    knownForDepartment: 'Directing',
    popularity: 90.4,
    knownFor: ['Avatar: The Way of Water', 'Titanic', 'Terminator 2', 'Aliens']
  },
  {
    id: 1032,
    name: 'Martin Scorsese',
    profilePath: 'https://image.tmdb.org/t/p/w500/99hFNfTls8N1q6eG356K80Wp1f5.jpg',
    knownForDepartment: 'Directing',
    popularity: 89.6,
    knownFor: ['Killers of the Flower Moon', 'Goodfellas', 'Taxi Driver', 'The Departed']
  },
  {
    id: 3223,
    name: 'Robert Downey Jr.',
    profilePath: 'https://image.tmdb.org/t/p/w500/im9SAqJPZKEbVZGmjXuLI4O7RvM.jpg',
    knownForDepartment: 'Acting',
    popularity: 89.2,
    knownFor: ['Iron Man', 'Avengers: Endgame', 'Oppenheimer', 'Sherlock Holmes']
  },
  {
    id: 30614,
    name: 'Ryan Gosling',
    profilePath: 'https://image.tmdb.org/t/p/w500/lyUyVARQKhGxaxy0FbPJCQRpiaW.jpg',
    knownForDepartment: 'Acting',
    popularity: 88.5,
    knownFor: ['Barbie', 'La La Land', 'Drive', 'Blade Runner 2049', 'The Fall Guy']
  }
];

/**
 * Fetch detailed person profile with combined filmography credits
 */
export async function fetchPersonDetail(personId: number): Promise<PersonDetail | null> {
  if (canUseClientTmdbProxy()) {
    try {
      const res = await fetch(`${TMDB_BASE_URL}/person/${personId}?append_to_response=combined_credits`);
      if (res.status === 404) {
        return null;
      }
      if (res.ok) {
        const raw = await res.json();
        const credits = raw.combined_credits || {};

        const castItems: MediaItem[] = (credits.cast || [])
          .filter((c: any) => c.poster_path || c.backdrop_path)
          .map((c: any) => normalizeTMDBItem(c, c.media_type === 'tv' ? 'tv' : 'movies'))
          .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

        const crewItems: Array<MediaItem & { job: string }> = (credits.crew || [])
          .filter((c: any) => (c.poster_path || c.backdrop_path) && (c.job === 'Director' || c.department === 'Directing' || c.job === 'Writer'))
          .map((c: any) => ({
            ...normalizeTMDBItem(c, c.media_type === 'tv' ? 'tv' : 'movies'),
            job: c.job || 'Director'
          }))
          .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

        return {
          id: raw.id,
          name: raw.name,
          biography: raw.biography || `${raw.name} is a renowned figure in cinema recognized across global film and television.`,
          birthday: raw.birthday,
          deathday: raw.deathday,
          placeOfBirth: raw.place_of_birth,
          profilePath: raw.profile_path ? `https://image.tmdb.org/t/p/h632${raw.profile_path}` : null,
          knownForDepartment: raw.known_for_department || 'Acting',
          popularity: raw.popularity || 0,
          combinedCredits: {
            cast: castItems,
            crew: crewItems
          }
        };
      }
    } catch (err) {
      console.warn('TMDB person detail fetch failed:', err);
    }
  }

  const matched = FALLBACK_POPULAR_PEOPLE.find(p => p.id === personId);
  if (!matched) {
    return null;
  }

  return {
    id: personId,
    name: matched.name,
    biography: `${matched.name} has made prominent contributions to award-winning feature films and television series streaming in high definition on T Stream.`,
    profilePath: matched.profilePath,
    knownForDepartment: matched.knownForDepartment,
    popularity: matched.popularity,
    combinedCredits: {
      cast: EXPANDED_CATALOG.slice(0, 8),
      crew: EXPANDED_CATALOG.slice(0, 4).map(item => ({ ...item, job: 'Director' }))
    }
  };
}

/**
 * Fetch popular people (actors, actresses, and directors)
 */
export async function fetchPopularPeople(
  page = 1,
  department: 'all' | 'Acting' | 'Directing' = 'all'
): Promise<PaginatedResponse<PersonSummary>> {
  const safePage = Math.max(1, Math.min(page, 50));

  if (canUseClientTmdbProxy()) {
    try {
      const res = await fetch(`${TMDB_BASE_URL}/person/popular?page=${safePage}`);
      if (res.ok) {
        const data = await res.json();
        let results: PersonSummary[] = (data.results || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          profilePath: p.profile_path ? `https://image.tmdb.org/t/p/h632${p.profile_path}` : null,
          knownForDepartment: p.known_for_department || 'Acting',
          popularity: p.popularity || 0,
          knownFor: (p.known_for || []).map((k: any) => k.title || k.name || '')
        }));

        if (department !== 'all') {
          results = results.filter(p => p.knownForDepartment.toLowerCase() === department.toLowerCase());
        }

        return {
          page: data.page || safePage,
          totalPages: Math.min(data.total_pages || 1, 50),
          totalResults: data.total_results || results.length,
          results
        };
      }
    } catch (err) {
      console.warn('TMDB popular people fetch failed:', err);
    }
  }

  let filteredFallback = [...FALLBACK_POPULAR_PEOPLE];
  if (department !== 'all') {
    filteredFallback = filteredFallback.filter(p => p.knownForDepartment.toLowerCase() === department.toLowerCase());
  }

  return {
    page: 1,
    totalPages: 1,
    totalResults: filteredFallback.length,
    results: filteredFallback
  };
}

/**
 * Search people by name (actors, actresses, directors)
 */
export async function searchPeople(
  queryStr: string,
  page = 1
): Promise<PaginatedResponse<PersonSummary>> {
  const safePage = Math.max(1, Math.min(page, 20));

  if (!queryStr.trim()) {
    return fetchPopularPeople(page, 'all');
  }

  if (canUseClientTmdbProxy()) {
    try {
      const res = await fetch(`${TMDB_BASE_URL}/search/person?query=${encodeURIComponent(queryStr)}&page=${safePage}`);
      if (res.ok) {
        const data = await res.json();
        const results: PersonSummary[] = (data.results || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          profilePath: p.profile_path ? `https://image.tmdb.org/t/p/h632${p.profile_path}` : null,
          knownForDepartment: p.known_for_department || 'Acting',
          popularity: p.popularity || 0,
          knownFor: (p.known_for || []).map((k: any) => k.title || k.name || '')
        }));

        return {
          page: data.page || safePage,
          totalPages: Math.min(data.total_pages || 1, 20),
          totalResults: data.total_results || results.length,
          results
        };
      }
    } catch (err) {
      console.warn('TMDB search people failed:', err);
    }
  }

  const q = queryStr.toLowerCase();
  const matched = FALLBACK_POPULAR_PEOPLE.filter(p => p.name.toLowerCase().includes(q));
  return {
    page: 1,
    totalPages: 1,
    totalResults: matched.length,
    results: matched
  };
}


