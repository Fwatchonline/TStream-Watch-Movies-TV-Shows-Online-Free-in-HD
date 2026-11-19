import type { AnimeMedia } from '../types/media';

export interface AniListPageResult {
  page: number;
  perPage: number;
  totalPages: number;
  totalResults: number;
  hasNextPage: boolean;
  results: AnimeMedia[];
  season?: string;
  seasonYear?: number;
  error?: string;
}

export interface AniListScheduleItem {
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
  media: AnimeMedia;
}

export interface AnimeSearchFilters {
  query?: string;
  genre?: string;
  tag?: string;
  year?: number;
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  format?: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';
  status?: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
  country?: 'JP' | 'KR' | 'CN' | 'TW';
  minScore?: number;
  sort?: 'popularity' | 'trending' | 'score' | 'newest' | 'title' | 'search';
  page?: number;
  perPage?: number;
}

const CLIENT_LIST_CACHE_TTL = 5 * 60 * 1000;
const CLIENT_DETAIL_CACHE_TTL = 15 * 60 * 1000;
const MAX_CLIENT_CACHE = 120;

const listCache = new Map<string, { expiresAt: number; data: any }>();
const detailCache = new Map<number, { expiresAt: number; data: AnimeMedia }>();
const inFlight = new Map<string, Promise<any>>();

function setBoundedCache<K, V>(map: Map<K, V>, key: K, val: V): void {
  if (map.has(key)) map.delete(key);
  map.set(key, val);
  while (map.size > MAX_CLIENT_CACHE) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
    else break;
  }
}

export function clearClientAniListCache(): void {
  listCache.clear();
  detailCache.clear();
  inFlight.clear();
}

async function fetchCachedEndpoint<T>(url: string, ttlMs: number, fallback: T): Promise<T> {
  if (typeof window === 'undefined') return fallback;

  const hit = listCache.get(url);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data as T;
  }

  const pending = inFlight.get(url);
  if (pending) return pending as Promise<T>;

  const req = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return fallback;
      }
      const data = await res.json();
      setBoundedCache(listCache, url, { expiresAt: Date.now() + ttlMs, data });
      return data as T;
    } catch {
      return fallback;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, req);
  return req;
}

const EMPTY_PAGE: AniListPageResult = {
  page: 1,
  perPage: 20,
  totalPages: 1,
  totalResults: 0,
  hasNextPage: false,
  results: []
};

export async function fetchTrendingAnime(page = 1, perPage = 20): Promise<AniListPageResult> {
  return fetchCachedEndpoint<AniListPageResult>(
    `/api/anilist/trending?page=${page}&perPage=${perPage}`,
    CLIENT_LIST_CACHE_TTL,
    { ...EMPTY_PAGE, page, perPage }
  );
}

export async function fetchPopularAnime(page = 1, perPage = 20): Promise<AniListPageResult> {
  return fetchCachedEndpoint<AniListPageResult>(
    `/api/anilist/popular?page=${page}&perPage=${perPage}`,
    CLIENT_LIST_CACHE_TTL,
    { ...EMPTY_PAGE, page, perPage }
  );
}

export async function fetchTopRatedAnime(page = 1, perPage = 20): Promise<AniListPageResult> {
  return fetchCachedEndpoint<AniListPageResult>(
    `/api/anilist/top-rated?page=${page}&perPage=${perPage}`,
    CLIENT_LIST_CACHE_TTL,
    { ...EMPTY_PAGE, page, perPage }
  );
}

export async function fetchSeasonalAnime(
  page = 1,
  perPage = 20,
  season?: string,
  year?: number
): Promise<AniListPageResult> {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (season) params.set('season', season);
  if (year) params.set('year', String(year));
  return fetchCachedEndpoint<AniListPageResult>(
    `/api/anilist/seasonal?${params.toString()}`,
    CLIENT_LIST_CACHE_TTL,
    { ...EMPTY_PAGE, page, perPage }
  );
}

export async function fetchUpcomingAnime(page = 1, perPage = 20): Promise<AniListPageResult> {
  return fetchCachedEndpoint<AniListPageResult>(
    `/api/anilist/upcoming?page=${page}&perPage=${perPage}`,
    CLIENT_LIST_CACHE_TTL,
    { ...EMPTY_PAGE, page, perPage }
  );
}

export async function fetchAnimeMovies(page = 1, perPage = 20): Promise<AniListPageResult> {
  return fetchCachedEndpoint<AniListPageResult>(
    `/api/anilist/movies?page=${page}&perPage=${perPage}`,
    CLIENT_LIST_CACHE_TTL,
    { ...EMPTY_PAGE, page, perPage }
  );
}

export async function fetchAnimeSchedule(page = 1, perPage = 20): Promise<{
  page: number;
  totalPages: number;
  results: AniListScheduleItem[];
}> {
  return fetchCachedEndpoint(
    `/api/anilist/schedule?page=${page}&perPage=${perPage}`,
    CLIENT_LIST_CACHE_TTL,
    { page: 1, totalPages: 1, results: [] }
  );
}

export async function fetchAnimeGenres(): Promise<{ genres: string[]; tags: string[] }> {
  return fetchCachedEndpoint(
    `/api/anilist/genres`,
    CLIENT_DETAIL_CACHE_TTL,
    { genres: [], tags: [] }
  );
}

export async function searchAnimeCatalog(filters: AnimeSearchFilters = {}): Promise<AniListPageResult> {
  const params = new URLSearchParams();
  params.set('page', String(filters.page || 1));
  params.set('perPage', String(filters.perPage || 20));
  if (filters.query && filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.genre) params.set('genre', filters.genre);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.year) params.set('year', String(filters.year));
  if (filters.season) params.set('season', filters.season);
  if (filters.format) params.set('format', filters.format);
  if (filters.status) params.set('status', filters.status);
  if (filters.country) params.set('country', filters.country);
  if (filters.minScore) params.set('minScore', String(filters.minScore));
  if (filters.sort) params.set('sort', filters.sort);

  return fetchCachedEndpoint<AniListPageResult>(
    `/api/anilist/search?${params.toString()}`,
    CLIENT_LIST_CACHE_TTL,
    { ...EMPTY_PAGE, page: filters.page || 1, perPage: filters.perPage || 20 }
  );
}

export async function fetchAnimeDetail(anilistId: number): Promise<AnimeMedia | null> {
  if (typeof window === 'undefined' || !Number.isInteger(anilistId) || anilistId <= 0) return null;

  const hit = detailCache.get(anilistId);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data;
  }

  const key = `detail:${anilistId}`;
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<AnimeMedia | null>;

  const req = (async () => {
    try {
      const res = await fetch(`/api/anilist/media/${anilistId}`);
      if (!res.ok) return null;
      const data = (await res.json()) as AnimeMedia;
      if (data && data.anilistId) {
        setBoundedCache(detailCache, anilistId, { expiresAt: Date.now() + CLIENT_DETAIL_CACHE_TTL, data });
        return data;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, req);
  return req;
}

export async function fetchAniListCacheStats(): Promise<{
  listEntries: number;
  detailEntries: number;
  jikanEntries: number;
  mappingEntries: number;
  recentMappings: Array<{
    anilistId: number;
    malId?: number;
    tmdbId: number | null;
    matchedTitle?: string;
    mediaKind: 'movie' | 'tv';
    resolvedAt: string;
  }>;
} | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/anilist/cache/stats');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
