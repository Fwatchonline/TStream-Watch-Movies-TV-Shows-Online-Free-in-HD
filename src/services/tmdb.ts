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
import { getPlatformById } from './platformData';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const DEFAULT_TMDB_API_KEY = '844dba0bfd8f3a4f3799f6130ef9e335';

export function getTmdbApiKey(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('tstream_tmdb_api_key');
    if (custom && custom.trim()) return custom.trim();
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TMDB_API_KEY) {
    return import.meta.env.VITE_TMDB_API_KEY;
  }
  return DEFAULT_TMDB_API_KEY;
}

export function setTmdbApiKey(key: string) {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('tstream_tmdb_api_key', key.trim());
    } else {
      localStorage.removeItem('tstream_tmdb_api_key');
    }
  }
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
    items = items.filter(item => item.genres.some(g => g.id === Number(options.genreId)));
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
    const plat = getPlatformById(options.platform);
    const platKey = (plat ? plat.name : options.platform).toLowerCase();
    const platMatches = items.filter(item =>
      item.title.toLowerCase().includes(platKey) ||
      item.overview.toLowerCase().includes(platKey) ||
      (item.keywords && item.keywords.some(k => k.name.toLowerCase().includes(platKey)))
    );
    if (platMatches.length > 0) {
      items = platMatches;
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

/**
 * Live TMDB Catalog Fetcher with guaranteed page pagination
 */
export async function fetchCatalog(
  category: 'trending' | 'movies' | 'tv' | 'popular-movies' | 'top-movies' | 'popular-tv' | 'top-tv' | 'airing-today' | 'upcoming' | 'search' | 'platform' | 'az',
  page = 1,
  extraFilters: Partial<FilterOptions> = {}
): Promise<PaginatedResponse<MediaItem>> {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const apiKey = getTmdbApiKey();

  try {
    // 1. Platform / Studio Specific Search (e.g. Netflix, Apple TV+, HBO Max, Disney+, etc.)
    const platformId = extraFilters.platform || (category === 'platform' ? 'netflix' : undefined);
    if (platformId) {
      const platform = getPlatformById(platformId);
      if (platform) {
        const sortBy = extraFilters.sortBy || 'popularity.desc';
        const targetType = extraFilters.mediaType || 'all';

        // Additional filter parameters
        let genreQuery = extraFilters.genreId ? `&with_genres=${extraFilters.genreId}` : '';
        let minRatingQuery = extraFilters.minRating ? `&vote_average.gte=${extraFilters.minRating}` : '';
        let yearQueryMovie = extraFilters.year ? `&primary_release_year=${extraFilters.year}` : '';
        let yearQueryTv = extraFilters.year ? `&first_air_date_year=${extraFilters.year}` : '';

        // If only Movies requested for this platform
        if (targetType === 'movie') {
          const providerParam = platform.id === 'paramount'
            ? `with_companies=4|4330&with_watch_providers=${platform.watchProviderId}&watch_region=US`
            : `with_watch_providers=${platform.watchProviderId}&watch_region=US`;

          const movUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&${providerParam}&sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQuery}${minRatingQuery}${yearQueryMovie}`;
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
        }

        // If only TV Series requested for this platform
        if (targetType === 'tv') {
          const tvUrl = `${TMDB_BASE_URL}/discover/tv?api_key=${apiKey}&with_networks=${platform.networkId}&sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQuery}${minRatingQuery}${yearQueryTv}`;
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
        }

        // Default 'all': Fetch BOTH movies and TV series produced by this studio/platform in parallel!
        const providerParam = platform.id === 'paramount'
          ? `with_companies=4|4330&with_watch_providers=${platform.watchProviderId}&watch_region=US`
          : `with_watch_providers=${platform.watchProviderId}&watch_region=US`;

        const tvUrl = `${TMDB_BASE_URL}/discover/tv?api_key=${apiKey}&with_networks=${platform.networkId}&sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQuery}${minRatingQuery}${yearQueryTv}`;
        const movUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&${providerParam}&sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQuery}${minRatingQuery}${yearQueryMovie}`;

        const [tvRes, movRes] = await Promise.all([
          fetch(tvUrl).catch(() => null),
          fetch(movUrl).catch(() => null)
        ]);

        const [tvData, movData] = await Promise.all([
          tvRes && tvRes.ok ? tvRes.json() : { results: [], total_pages: 1, total_results: 0 },
          movRes && movRes.ok ? movRes.json() : { results: [], total_pages: 1, total_results: 0 }
        ]);

        const tvItems: MediaItem[] = (tvData.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem({ ...r, media_type: 'tv' }, 'tv'));

        const movieItems: MediaItem[] = (movData.results || [])
          .filter((r: any) => r.poster_path || r.backdrop_path)
          .map((r: any) => normalizeTMDBItem({ ...r, media_type: 'movie' }, 'movies'));

        // Interleave / sort both lists according to active sort option
        const combined = [...tvItems, ...movieItems];
        if (sortBy === 'vote_average.desc') {
          combined.sort((a, b) => b.voteAverage - a.voteAverage);
        } else if (sortBy === 'primary_release_date.desc') {
          combined.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
        } else if (sortBy === 'title.asc') {
          combined.sort((a, b) => a.title.localeCompare(b.title));
        } else {
          // popularity.desc
          combined.sort((a, b) => b.popularity - a.popularity);
        }

        return {
          page: safePage,
          totalPages: Math.min(Math.max(tvData.total_pages || 1, movData.total_pages || 1), 500),
          totalResults: (tvData.total_results || 0) + (movData.total_results || 0),
          results: combined
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
            fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&sort_by=popularity.desc&page=${p}&include_adult=false`)
              .then(r => r.ok ? r.json() : { results: [] })
              .catch(() => ({ results: [] }))
          );
        }
      }
      if (targetType === 'all' || targetType === 'tv') {
        for (let p = 1; p <= 4; p++) {
          discPromises.push(
            fetch(`${TMDB_BASE_URL}/discover/tv?api_key=${apiKey}&sort_by=popularity.desc&page=${p}&include_adult=false`)
              .then(r => r.ok ? r.json() : { results: [] })
              .catch(() => ({ results: [] }))
          );
        }
      }

      const searchPromises = searchQueries.slice(0, 14).map(q =>
        fetch(`${TMDB_BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(q)}&page=1&include_adult=false`)
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
      const url = `${TMDB_BASE_URL}/search/${searchType}?api_key=${apiKey}&query=${q}&page=${safePage}&include_adult=false`;
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

    // 4. Discovery / Filter Mode (Movies, TV Shows, Trending, Genres, Ratings, Years)
    let targetType: 'all' | 'movie' | 'tv' = extraFilters.mediaType || 'all';
    if (!extraFilters.mediaType || extraFilters.mediaType === 'all') {
      if (category === 'movies' || category === 'popular-movies' || category === 'top-movies' || category === 'upcoming') {
        targetType = 'movie';
      } else if (category === 'tv' || category === 'popular-tv' || category === 'top-tv' || category === 'airing-today') {
        targetType = 'tv';
      }
    }

    const defaultSort = (category === 'top-movies' || category === 'top-tv') ? 'vote_average.desc' : 'popularity.desc';
    const sortBy = extraFilters.sortBy || defaultSort;
    const genreQuery = extraFilters.genreId ? `&with_genres=${extraFilters.genreId}` : '';
    const minRatingQuery = extraFilters.minRating
      ? `&vote_average.gte=${extraFilters.minRating}&vote_count.gte=30`
      : (sortBy === 'vote_average.desc' ? '&vote_count.gte=80' : '');
    const yearQueryMovie = extraFilters.year ? `&primary_release_year=${extraFilters.year}` : '';
    const yearQueryTv = extraFilters.year ? `&first_air_date_year=${extraFilters.year}` : '';

    if (targetType === 'movie') {
      const movUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQuery}${minRatingQuery}${yearQueryMovie}`;
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
      const tvUrl = `${TMDB_BASE_URL}/discover/tv?api_key=${apiKey}&sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQuery}${minRatingQuery}${yearQueryTv}`;
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
      const movUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQuery}${minRatingQuery}${yearQueryMovie}`;
      const tvUrl = `${TMDB_BASE_URL}/discover/tv?api_key=${apiKey}&sort_by=${sortBy}&page=${safePage}&include_adult=false${genreQuery}${minRatingQuery}${yearQueryTv}`;

      const [movRes, tvRes] = await Promise.all([
        fetch(movUrl).catch(() => null),
        fetch(tvUrl).catch(() => null)
      ]);

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
  } catch (err) {
    console.warn('Real TMDB API fetch failed, falling back to local dataset:', err);
  }

  // Graceful fallback
  return queryLocalCatalog({
    ...extraFilters,
    page: safePage,
    mediaType: extraFilters.mediaType || (category.includes('tv') ? 'tv' : category.includes('movie') ? 'movie' : 'all')
  });
}

/**
 * Fetch media detail by ID and type with full TMDB live data
 */
export async function getMediaDetail(id: number, type: MediaType): Promise<MediaDetail | null> {
  const apiKey = getTmdbApiKey();

  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/${type}/${id}?api_key=${apiKey}&append_to_response=videos,credits,recommendations,similar,external_ids,keywords`
    );
    if (res.ok) {
      const data = await res.json();

      // If movie has belongs_to_collection, fetch collection parts from TMDB
      // If movie has belongs_to_collection, fetch full collection parts from TMDB
      if (type === 'movie') {
        if (data.belongs_to_collection && data.belongs_to_collection.id) {
          try {
            const colRes = await fetch(`${TMDB_BASE_URL}/collection/${data.belongs_to_collection.id}?api_key=${apiKey}`);
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
          // Automatic franchise search by title if belongs_to_collection is absent (e.g. Pirates, Fast and Furious, Avatar, etc.)
          try {
            const cleanTitle = (data.title || '').split(/[:–—\-]/)[0].trim();
            if (cleanTitle.length >= 3) {
              const sRes = await fetch(`${TMDB_BASE_URL}/search/collection?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}`);
              if (sRes.ok) {
                const sData = await sRes.json();
                const matchedCol = sData.results?.[0];
                if (matchedCol && matchedCol.id) {
                  const colRes = await fetch(`${TMDB_BASE_URL}/collection/${matchedCol.id}?api_key=${apiKey}`);
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

  // Fallback to local detailed items
  if (type === 'movie') {
    const foundMovie = DETAILED_MOVIES.find(m => m.id === id || m.tmdbId === id);
    if (foundMovie) return foundMovie;
    const basic = EXPANDED_CATALOG.find(m => (m.id === id || m.tmdbId === id) && m.mediaType === 'movie');
    if (basic) return createDefaultMovieDetail(basic);
  } else {
    const foundTV = DETAILED_TV_SHOWS.find(t => t.id === id || t.tmdbId === id);
    if (foundTV) return foundTV;
    const basic = EXPANDED_CATALOG.find(t => (t.id === id || t.tmdbId === id) && t.mediaType === 'tv');
    if (basic) return createDefaultTVDetail(basic);
  }

  return DETAILED_MOVIES[0];
}

/**
 * Get Collection details live from TMDB API with local fallback
 */
export async function getCollectionDetail(collectionId: number): Promise<CollectionSummary | null> {
  const apiKey = getTmdbApiKey();

  try {
    const res = await fetch(`${TMDB_BASE_URL}/collection/${collectionId}?api_key=${apiKey}`);
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

  const collections: Record<number, CollectionSummary> = {
    531241: SPIDERMAN_COLLECTION,
    86311: AVENGERS_COLLECTION,
    1241: HARRY_POTTER_COLLECTION,
    295: PIRATES_COLLECTION
  };

  return collections[collectionId] || SPIDERMAN_COLLECTION;
}

/**
 * Fetch movies by keyword / tag from TMDB API
 */
export async function fetchByTag(tagName: string, page = 1): Promise<PaginatedResponse<MediaItem>> {
  const apiKey = getTmdbApiKey();
  const safePage = Math.max(1, Math.floor(Number(page) || 1));

  try {
    // 1. Search for keyword ID
    const kwRes = await fetch(`${TMDB_BASE_URL}/search/keyword?api_key=${apiKey}&query=${encodeURIComponent(tagName)}&page=1`);
    if (kwRes.ok) {
      const kwData = await kwRes.json();
      const firstKw = kwData.results?.[0];
      if (firstKw && firstKw.id) {
        // 2. Discover movies with this keyword
        const disRes = await fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&with_keywords=${firstKw.id}&page=${safePage}&sort_by=popularity.desc`);
        if (disRes.ok) {
          const disData = await disRes.json();
          const results: MediaItem[] = (disData.results || []).map((r: any) => normalizeTMDBItem(r, 'movies'));
          return {
            page: disData.page || safePage,
            totalPages: Math.min(disData.total_pages || 1, 500),
            totalResults: disData.total_results || results.length,
            results
          };
        }
      }
    }
  } catch (err) {
    console.warn('TMDB discover by keyword failed, using fallback:', err);
  }

  // Fallback to local catalog
  return queryLocalCatalog({
    query: tagName,
    page: safePage
  });
}

/**
 * Fetch detailed episodes for a specific TV show season from TMDB API
 */
export async function fetchSeasonEpisodes(tvId: number, seasonNumber: number): Promise<Episode[]> {
  const apiKey = getTmdbApiKey();
  try {
    const res = await fetch(`${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.episodes) && data.episodes.length > 0) {
        return data.episodes.map((ep: any) => ({
          id: ep.id,
          episodeNumber: ep.episode_number,
          seasonNumber: ep.season_number ?? seasonNumber,
          name: ep.name || `Episode ${ep.episode_number}`,
          overview: ep.overview || 'No synopsis available for this episode.',
          stillPath: ep.still_path
            ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
            : null,
          airDate: ep.air_date || '',
          voteAverage: ep.vote_average ? Number(ep.vote_average.toFixed(1)) : 8.0,
          runtime: ep.runtime || undefined
        }));
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch season ${seasonNumber} episodes for tv ${tvId}:`, err);
  }

  // Check local detailed TV fallback
  const foundTV = DETAILED_TV_SHOWS.find(t => t.id === tvId || t.tmdbId === tvId);
  const foundSeason = foundTV?.seasons?.find(s => s.seasonNumber === seasonNumber);
  if (foundSeason?.episodes && foundSeason.episodes.length > 0) {
    return foundSeason.episodes;
  }

  // Fallback: generate clean episode list matching episodeCount
  const count = foundSeason?.episodeCount || 8;
  return Array.from({ length: count }, (_, i) => ({
    id: Number(`${tvId}${seasonNumber}${i + 1}`),
    episodeNumber: i + 1,
    seasonNumber,
    name: `Episode ${i + 1}`,
    overview: `Episode ${i + 1} of Season ${seasonNumber}.`,
    stillPath: null,
    airDate: '',
    voteAverage: 8.0,
    runtime: 45
  }));
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
  const apiKey = getTmdbApiKey();
  const randomPage = Math.floor(Math.random() * 20) + 1; // page 1-20
  const randomSorts = [
    'popularity.desc',
    'vote_average.desc',
    'revenue.desc',
    'vote_count.desc'
  ];
  const sort = randomSorts[Math.floor(Math.random() * randomSorts.length)];
  const genreParam = genreId ? `&with_genres=${genreId}` : '';

  try {
    let pool: MediaItem[] = [];

    if (mediaType === 'movie') {
      const url = `${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&sort_by=${sort}&page=${randomPage}&vote_count.gte=150&vote_average.gte=5.5&include_adult=false${genreParam}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        pool = (data.results || []).map((r: any) => normalizeTMDBItem(r, 'movies'));
      }
    } else if (mediaType === 'tv') {
      const url = `${TMDB_BASE_URL}/discover/tv?api_key=${apiKey}&sort_by=${sort}&page=${randomPage}&vote_count.gte=80&vote_average.gte=5.5&include_adult=false${genreParam}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        pool = (data.results || []).map((r: any) => normalizeTMDBItem(r, 'tv'));
      }
    } else {
      // Parallel discover for both movies & TV shows
      const [resM, resT] = await Promise.all([
        fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&sort_by=${sort}&page=${randomPage}&vote_count.gte=120&vote_average.gte=5.5&include_adult=false${genreParam}`).then(r => r.ok ? r.json() : null),
        fetch(`${TMDB_BASE_URL}/discover/tv?api_key=${apiKey}&sort_by=${sort}&page=${randomPage}&vote_count.gte=80&vote_average.gte=5.5&include_adult=false${genreParam}`).then(r => r.ok ? r.json() : null)
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

  // Fallback to shuffled EXPANDED_CATALOG
  const shuffled = [...EXPANDED_CATALOG];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

