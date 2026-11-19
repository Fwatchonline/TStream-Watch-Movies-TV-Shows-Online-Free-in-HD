import { Hono } from 'hono';
import { getTmdbApiKey } from '../utils/helpers';
import type { AnimeMedia, AnimeEpisode, AnimeCharacter, AnimeRelation } from '../../types/media';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const MAX_LIST_CACHE = 250;
const MAX_DETAIL_CACHE = 300;
const MAX_JIKAN_CACHE = 250;
const MAX_TMDB_MAP_CACHE = 500;

const LIST_TTL_MS = 15 * 60 * 1000;
const DETAIL_TTL_MS = 30 * 60 * 1000;
const JIKAN_TTL_MS = 6 * 60 * 60 * 1000;
const TMDB_MAP_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8000;

export const ANIME_GENRE_LIST = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller'
] as const;

export const ANIME_THEME_TAGS = [
  'Isekai',
  'Shounen',
  'Seinen',
  'Time Travel',
  'Cyberpunk',
  'Revenge',
  'School',
  'Survival',
  'Martial Arts',
  'Historical',
  'Military',
  'Space'
] as const;

export interface AniListMappingRecord {
  anilistId: number;
  malId?: number;
  tmdbId: number | null;
  matchedTitle?: string;
  mediaKind: 'movie' | 'tv';
  resolvedAt: string;
}

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const listCache = new Map<string, CacheEntry<any>>();
const detailCache = new Map<number, CacheEntry<AnimeMedia>>();
const jikanCache = new Map<number, CacheEntry<AnimeEpisode[]>>();
const tmdbMapCache = new Map<number, CacheEntry<AniListMappingRecord>>();
const inFlightQueries = new Map<string, Promise<any>>();

function setBounded<K, V>(map: Map<K, V>, key: K, val: V, maxSize: number): void {
  if (map.has(key)) map.delete(key);
  map.set(key, val);
  while (map.size > maxSize) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
    else break;
  }
}

export function clearAniListCache(): void {
  listCache.clear();
  detailCache.clear();
  jikanCache.clear();
  tmdbMapCache.clear();
  inFlightQueries.clear();
}

export function getAniListCacheStats() {
  const mappings: AniListMappingRecord[] = [];
  for (const [, entry] of tmdbMapCache.entries()) {
    if (entry.expiresAt > Date.now()) {
      mappings.push(entry.value);
    }
  }
  return {
    listEntries: listCache.size,
    detailEntries: detailCache.size,
    jikanEntries: jikanCache.size,
    mappingEntries: tmdbMapCache.size,
    recentMappings: mappings.slice(-25).reverse()
  };
}

export function getCachedTmdbMappingForAnime(anilistId: number): AniListMappingRecord | null {
  const hit = tmdbMapCache.get(anilistId);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  return null;
}

export function getCurrentAnimeSeason(date = new Date()): {
  season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  year: number;
} {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  if (month >= 1 && month <= 3) return { season: 'WINTER', year };
  if (month >= 4 && month <= 6) return { season: 'SPRING', year };
  if (month >= 7 && month <= 9) return { season: 'SUMMER', year };
  return { season: 'FALL', year };
}

function stripHtml(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatFuzzyDate(d?: { year?: number | null; month?: number | null; day?: number | null } | null): string | undefined {
  if (!d || !d.year) return undefined;
  const y = String(d.year).padStart(4, '0');
  if (!d.month) return y;
  const m = String(d.month).padStart(2, '0');
  if (!d.day) return `${y}-${m}`;
  const day = String(d.day).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function cleanStreamingEpisodeTitle(rawTitle: string, epNum: number): string {
  const trimmed = (rawTitle || '').trim();
  if (!trimmed) return `Episode ${epNum}`;
  const stripped = trimmed
    .replace(/^Episode\s+\d+\s*[-:–—]\s*/i, '')
    .replace(/^Ep\.?\s*\d+\s*[-:–—]\s*/i, '')
    .trim();
  return stripped || trimmed;
}

export function normalizeAniListMedia(raw: any): AnimeMedia {
  const anilistId = Number(raw?.id || 0);
  const malId = typeof raw?.idMal === 'number' && raw.idMal > 0 ? raw.idMal : undefined;
  const englishTitle = raw?.title?.english?.trim() || undefined;
  const romajiTitle = raw?.title?.romaji?.trim() || undefined;
  const nativeTitle = raw?.title?.native?.trim() || undefined;
  const primaryTitle = englishTitle || romajiTitle || nativeTitle || 'Untitled Anime';

  const synonyms = Array.isArray(raw?.synonyms)
    ? Array.from(
        new Set(
          raw.synonyms
            .map((s: any) => String(s || '').trim())
            .filter((s: string) => s && s !== primaryTitle && s !== romajiTitle && s !== englishTitle)
        )
      ).slice(0, 8) as string[]
    : [];

  const avgScore = typeof raw?.averageScore === 'number' && raw.averageScore > 0 ? raw.averageScore : undefined;
  const voteAverage = avgScore ? Number((avgScore / 10).toFixed(1)) : 0;

  const genres = Array.isArray(raw?.genres)
    ? raw.genres.map((g: any) => String(g).trim()).filter(Boolean)
    : [];

  const tags = Array.isArray(raw?.tags)
    ? raw.tags
        .filter((t: any) => t?.name && !t.isGeneralSpoiler)
        .map((t: any) => ({
          name: String(t.name).trim(),
          rank: typeof t.rank === 'number' ? t.rank : undefined,
          isMediaSpoiler: Boolean(t.isMediaSpoiler)
        }))
        .slice(0, 18)
    : [];

  const studios = Array.isArray(raw?.studios?.nodes)
    ? raw.studios.nodes
        .filter((s: any) => s?.name)
        .map((s: any) => ({
          id: Number(s.id || 0),
          name: String(s.name).trim(),
          isAnimationStudio: Boolean(s.isAnimationStudio)
        }))
    : [];

  const streamingEpsRaw = Array.isArray(raw?.streamingEpisodes) ? raw.streamingEpisodes : [];
  const episodes: AnimeEpisode[] = streamingEpsRaw.map((ep: any, idx: number) => {
    const rawTitle = String(ep?.title || '');
    const epMatch = rawTitle.match(/^Episode\s+(\d+)/i) || rawTitle.match(/^Ep\.?\s*(\d+)/i);
    const epNum = epMatch ? parseInt(epMatch[1], 10) : idx + 1;
    return {
      id: `al-${anilistId}-ep-${epNum}`,
      episodeNumber: epNum,
      title: cleanStreamingEpisodeTitle(rawTitle, epNum),
      thumbnail: typeof ep?.thumbnail === 'string' && ep.thumbnail.startsWith('http') ? ep.thumbnail : undefined,
      durationMinutes: typeof raw?.duration === 'number' && raw.duration > 0 ? raw.duration : undefined
    };
  });
  episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

  const characters: AnimeCharacter[] = Array.isArray(raw?.characters?.edges)
    ? raw.characters.edges
        .filter((edge: any) => edge?.node?.name?.full)
        .map((edge: any) => {
          const va = Array.isArray(edge.voiceActors) ? edge.voiceActors[0] : undefined;
          return {
            id: Number(edge.node.id || 0),
            name: String(edge.node.name.full).trim(),
            role: String(edge.role || 'SUPPORTING'),
            image: edge.node.image?.large || edge.node.image?.medium || null,
            voiceActor: va?.name?.full
              ? {
                  id: Number(va.id || 0),
                  name: String(va.name.full).trim(),
                  language: String(va.languageV2 || 'Japanese'),
                  image: va.image?.medium || va.image?.large || null
                }
              : undefined
          };
        })
    : [];

  const relations: AnimeRelation[] = Array.isArray(raw?.relations?.edges)
    ? raw.relations.edges
        .filter((edge: any) => edge?.node?.type === 'ANIME' && !edge?.node?.isAdult)
        .map((edge: any) => ({
          relationType: String(edge.relationType || 'OTHER'),
          media: normalizeAniListMedia(edge.node)
        }))
        .slice(0, 12)
    : [];

  const recommendations: AnimeMedia[] = Array.isArray(raw?.recommendations?.nodes)
    ? raw.recommendations.nodes
        .map((n: any) => n?.mediaRecommendation)
        .filter((m: any) => m && m.id && m.type === 'ANIME' && !m.isAdult)
        .map((m: any) => normalizeAniListMedia(m))
        .slice(0, 14)
    : [];

  const cachedMap = getCachedTmdbMappingForAnime(anilistId);

  return {
    anilistId,
    malId,
    tmdbId: cachedMap?.tmdbId ?? undefined,
    mediaType: 'anime',
    format: String(raw?.format || 'TV'),
    status: String(raw?.status || 'UNKNOWN'),
    title: primaryTitle,
    englishTitle,
    romajiTitle,
    nativeTitle,
    synonyms,
    description: stripHtml(raw?.description) || '',
    coverImage: raw?.coverImage?.extraLarge || raw?.coverImage?.large || raw?.coverImage?.medium || '',
    bannerImage: raw?.bannerImage || raw?.coverImage?.extraLarge || raw?.coverImage?.large || '',
    episodesCount: typeof raw?.episodes === 'number' && raw.episodes > 0 ? raw.episodes : undefined,
    durationMinutes: typeof raw?.duration === 'number' && raw.duration > 0 ? raw.duration : undefined,
    season: raw?.season || undefined,
    seasonYear: typeof raw?.seasonYear === 'number' ? raw.seasonYear : raw?.startDate?.year || undefined,
    startDate: formatFuzzyDate(raw?.startDate),
    endDate: formatFuzzyDate(raw?.endDate),
    averageScore: avgScore,
    voteAverage,
    popularity: Number(raw?.popularity || 0),
    genres,
    tags,
    studios,
    trailer:
      raw?.trailer?.id && raw?.trailer?.site
        ? {
            id: String(raw.trailer.id),
            site: String(raw.trailer.site),
            thumbnail: raw.trailer.thumbnail || undefined
          }
        : null,
    nextAiringEpisode: raw?.nextAiringEpisode
      ? {
          airingAt: Number(raw.nextAiringEpisode.airingAt),
          timeUntilAiring: Number(raw.nextAiringEpisode.timeUntilAiring),
          episode: Number(raw.nextAiringEpisode.episode)
        }
      : null,
    isAdult: Boolean(raw?.isAdult),
    episodes,
    characters,
    relations,
    recommendations
  };
}

const ANILIST_MEDIA_SUMMARY_FIELDS = `
  id
  idMal
  type
  format
  status
  isAdult
  episodes
  duration
  season
  seasonYear
  averageScore
  popularity
  title {
    romaji
    english
    native
  }
  description(asHtml: false)
  startDate { year month day }
  endDate { year month day }
  coverImage { extraLarge large medium }
  bannerImage
  genres
  tags { name rank isMediaSpoiler isGeneralSpoiler }
  studios(isMain: true) {
    nodes { id name isAnimationStudio }
  }
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

const PAGE_LIST_QUERY = `
query (
  $page: Int,
  $perPage: Int,
  $sort: [MediaSort],
  $search: String,
  $genre_in: [String],
  $tag_in: [String],
  $season: MediaSeason,
  $seasonYear: Int,
  $format: MediaFormat,
  $status: MediaStatus,
  $countryOfOrigin: CountryCode,
  $averageScore_greater: Int
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      perPage
      currentPage
      lastPage
      hasNextPage
    }
    media(
      type: ANIME,
      isAdult: false,
      sort: $sort,
      search: $search,
      genre_in: $genre_in,
      tag_in: $tag_in,
      season: $season,
      seasonYear: $seasonYear,
      format: $format,
      status: $status,
      countryOfOrigin: $countryOfOrigin,
      averageScore_greater: $averageScore_greater
    ) {
      ${ANILIST_MEDIA_SUMMARY_FIELDS}
    }
  }
}
`;

const AIRING_SCHEDULE_QUERY = `
query ($page: Int, $perPage: Int, $airingAt_greater: Int, $airingAt_lesser: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    airingSchedules(
      airingAt_greater: $airingAt_greater,
      airingAt_lesser: $airingAt_lesser,
      sort: TIME
    ) {
      id
      airingAt
      timeUntilAiring
      episode
      media {
        ${ANILIST_MEDIA_SUMMARY_FIELDS}
      }
    }
  }
}
`;

const MEDIA_DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME, isAdult: false) {
    ${ANILIST_MEDIA_SUMMARY_FIELDS}
    synonyms
    trailer { id site thumbnail }
    streamingEpisodes { title thumbnail url site }
    characters(sort: [ROLE, RELEVANCE, ID], perPage: 16) {
      edges {
        role
        node {
          id
          name { full }
          image { large medium }
        }
        voiceActors(language: JAPANESE, sort: RELEVANCE) {
          id
          name { full }
          languageV2
          image { medium }
        }
      }
    }
    relations {
      edges {
        relationType
        node {
          ${ANILIST_MEDIA_SUMMARY_FIELDS}
        }
      }
    }
    recommendations(sort: RATING_DESC, perPage: 12) {
      nodes {
        mediaRecommendation {
          ${ANILIST_MEDIA_SUMMARY_FIELDS}
        }
      }
    }
  }
}
`;

async function executeAniListGraphQL(
  query: string,
  variables: Record<string, any>,
  fetchFn: typeof fetch = fetch,
  attempt = 0
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetchFn(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal
    });

    if (res.status === 429 && attempt < 2) {
      const retryAfterSec = parseInt(res.headers.get('Retry-After') || '1', 10);
      const waitMs = Math.min(2500, Math.max(400, (Number.isFinite(retryAfterSec) ? retryAfterSec : 1) * 1000));
      await new Promise((r) => setTimeout(r, waitMs));
      return executeAniListGraphQL(query, variables, fetchFn, attempt + 1);
    }

    if (!res.ok) {
      const err: any = new Error(`AniList API HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    if (json?.errors && !json?.data) {
      throw new Error(json.errors[0]?.message || 'AniList GraphQL error');
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJikanEpisodes(malId: number, fetchFn: typeof fetch = fetch): Promise<AnimeEpisode[]> {
  if (!Number.isInteger(malId) || malId <= 0) return [];
  const cached = jikanCache.get(malId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetchFn(`${JIKAN_BASE_URL}/anime/${malId}/episodes?page=1`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list: AnimeEpisode[] = Array.isArray(data?.data)
      ? data.data
          .filter((ep: any) => Number(ep?.mal_id) > 0)
          .map((ep: any) => ({
            id: `mal-${malId}-ep-${ep.mal_id}`,
            episodeNumber: Number(ep.mal_id),
            title: String(ep.title || ep.title_romanji || `Episode ${ep.mal_id}`).trim(),
            airDate: typeof ep.aired === 'string' && ep.aired ? ep.aired.slice(0, 10) : undefined,
            isFiller: Boolean(ep.filler)
          }))
      : [];
    setBounded(jikanCache, malId, { expiresAt: Date.now() + JIKAN_TTL_MS, value: list }, MAX_JIKAN_CACHE);
    return list;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveTmdbIdForAnime(
  params: {
    anilistId: number;
    malId?: number;
    title: string;
    englishTitle?: string;
    romajiTitle?: string;
    year?: number;
    format?: string;
  },
  options: { fetchFn?: typeof fetch; tmdbApiKey?: string } = {}
): Promise<AniListMappingRecord> {
  const existing = getCachedTmdbMappingForAnime(params.anilistId);
  if (existing) return existing;

  const isMovie = String(params.format || '').toUpperCase() === 'MOVIE';
  const mediaKind: 'movie' | 'tv' = isMovie ? 'movie' : 'tv';
  const apiKey = options.tmdbApiKey ?? getTmdbApiKey();
  const fetchFn = options.fetchFn || fetch;

  if (!apiKey) {
    return {
      anilistId: params.anilistId,
      malId: params.malId,
      tmdbId: null,
      mediaKind,
      resolvedAt: new Date().toISOString()
    };
  }

  const candidateQueries = Array.from(
    new Set([params.englishTitle, params.title, params.romajiTitle].map((t) => String(t || '').trim()).filter(Boolean))
  );

  let matchedTmdbId: number | null = null;
  let matchedTitle: string | undefined;

  for (const queryTitle of candidateQueries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const searchUrl = `${TMDB_BASE_URL}/search/${mediaKind}?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(queryTitle)}&include_adult=false`;
      const res = await fetchFn(searchUrl, { signal: controller.signal });
      if (!res.ok) continue;
      const data = await res.json();
      const candidates = Array.isArray(data?.results) ? data.results : [];
      const qLower = queryTitle.toLowerCase();

      const scored = candidates
        .map((c: any) => {
          const titleStr = String(c.title || c.name || '').trim();
          const origStr = String(c.original_title || c.original_name || '').trim();
          const releaseStr = String(c.release_date || c.first_air_date || '');
          const cYear = releaseStr ? parseInt(releaseStr.slice(0, 4), 10) : NaN;
          const genres: number[] = Array.isArray(c.genre_ids) ? c.genre_ids : [];
          const hasAnimationGenre = genres.includes(16);

          let score = 0;
          if (titleStr.toLowerCase() === qLower || origStr.toLowerCase() === qLower) score += 60;
          else if (titleStr.toLowerCase().includes(qLower) || qLower.includes(titleStr.toLowerCase())) score += 30;
          if (hasAnimationGenre) score += 25;
          if (params.year && Number.isFinite(cYear)) {
            const diff = Math.abs(cYear - params.year);
            if (diff === 0) score += 20;
            else if (diff === 1) score += 10;
            else if (diff > 3) score -= 20;
          }
          if (Array.isArray(c.origin_country) && c.origin_country.includes('JP')) score += 10;
          return { c, score, titleStr };
        })
        .sort((a: any, b: any) => b.score - a.score);

      const best = scored[0];
      if (best && best.score >= 55 && Number.isInteger(best.c?.id)) {
        matchedTmdbId = Number(best.c.id);
        matchedTitle = best.titleStr;
        break;
      }
    } catch {
      // continue trying next candidate title
    } finally {
      clearTimeout(timer);
    }
  }

  const record: AniListMappingRecord = {
    anilistId: params.anilistId,
    malId: params.malId,
    tmdbId: matchedTmdbId,
    matchedTitle,
    mediaKind,
    resolvedAt: new Date().toISOString()
  };

  setBounded(tmdbMapCache, params.anilistId, { expiresAt: Date.now() + TMDB_MAP_TTL_MS, value: record }, MAX_TMDB_MAP_CACHE);
  return record;
}

export interface AniListRouteOptions {
  fetchFn?: typeof fetch;
  tmdbApiKey?: string;
}

export function createAniListRoute(options: AniListRouteOptions = {}): Hono {
  const route = new Hono();
  const fetchFn = options.fetchFn || fetch;

  async function runCachedListQuery(cacheKey: string, variables: Record<string, any>) {
    const cached = listCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const existingPromise = inFlightQueries.get(cacheKey);
    if (existingPromise) return existingPromise;

    const req = (async () => {
      const data = await executeAniListGraphQL(PAGE_LIST_QUERY, variables, fetchFn);
      const pageInfo = data?.Page?.pageInfo || {};
      const media = Array.isArray(data?.Page?.media)
        ? data.Page.media.filter((m: any) => !m?.isAdult).map(normalizeAniListMedia)
        : [];
      const payload = {
        page: Number(pageInfo.currentPage || variables.page || 1),
        perPage: Number(pageInfo.perPage || variables.perPage || 20),
        totalPages: Math.max(1, Number(pageInfo.lastPage || 1)),
        totalResults: Number(pageInfo.total || media.length),
        hasNextPage: Boolean(pageInfo.hasNextPage),
        results: media
      };
      setBounded(listCache, cacheKey, { expiresAt: Date.now() + LIST_TTL_MS, value: payload }, MAX_LIST_CACHE);
      return payload;
    })();

    inFlightQueries.set(cacheKey, req);
    try {
      return await req;
    } finally {
      inFlightQueries.delete(cacheKey);
    }
  }

  function parsePagination(c: any) {
    const page = Math.max(1, Math.min(500, parseInt(c.req.query('page') || '1', 10) || 1));
    const perPage = Math.max(1, Math.min(30, parseInt(c.req.query('perPage') || '20', 10) || 20));
    return { page, perPage };
  }

  route.get('/trending', async (c) => {
    try {
      const { page, perPage } = parsePagination(c);
      const data = await runCachedListQuery(`trending:${page}:${perPage}`, {
        page,
        perPage,
        sort: ['TRENDING_DESC', 'POPULARITY_DESC']
      });
      return c.json(data);
    } catch (err: any) {
      return c.json({ error: err?.message || 'AniList trending unavailable', results: [], page: 1, totalPages: 1, totalResults: 0 }, 502);
    }
  });

  route.get('/popular', async (c) => {
    try {
      const { page, perPage } = parsePagination(c);
      const data = await runCachedListQuery(`popular:${page}:${perPage}`, {
        page,
        perPage,
        sort: ['POPULARITY_DESC']
      });
      return c.json(data);
    } catch (err: any) {
      return c.json({ error: err?.message || 'AniList popular unavailable', results: [], page: 1, totalPages: 1, totalResults: 0 }, 502);
    }
  });

  route.get('/top-rated', async (c) => {
    try {
      const { page, perPage } = parsePagination(c);
      const data = await runCachedListQuery(`top-rated:${page}:${perPage}`, {
        page,
        perPage,
        sort: ['SCORE_DESC', 'POPULARITY_DESC']
      });
      return c.json(data);
    } catch (err: any) {
      return c.json({ error: err?.message || 'AniList top-rated unavailable', results: [], page: 1, totalPages: 1, totalResults: 0 }, 502);
    }
  });

  route.get('/seasonal', async (c) => {
    try {
      const { page, perPage } = parsePagination(c);
      const current = getCurrentAnimeSeason();
      const rawSeason = (c.req.query('season') || '').toUpperCase();
      const season = ['WINTER', 'SPRING', 'SUMMER', 'FALL'].includes(rawSeason) ? rawSeason : current.season;
      const year = parseInt(c.req.query('year') || '', 10) || current.year;
      const data = await runCachedListQuery(`seasonal:${season}:${year}:${page}:${perPage}`, {
        page,
        perPage,
        season,
        seasonYear: year,
        sort: ['POPULARITY_DESC']
      });
      return c.json({ ...data, season, seasonYear: year });
    } catch (err: any) {
      return c.json({ error: err?.message || 'AniList seasonal unavailable', results: [], page: 1, totalPages: 1, totalResults: 0 }, 502);
    }
  });

  route.get('/upcoming', async (c) => {
    try {
      const { page, perPage } = parsePagination(c);
      const data = await runCachedListQuery(`upcoming:${page}:${perPage}`, {
        page,
        perPage,
        status: 'NOT_YET_RELEASED',
        sort: ['POPULARITY_DESC']
      });
      return c.json(data);
    } catch (err: any) {
      return c.json({ error: err?.message || 'AniList upcoming unavailable', results: [], page: 1, totalPages: 1, totalResults: 0 }, 502);
    }
  });

  route.get('/movies', async (c) => {
    try {
      const { page, perPage } = parsePagination(c);
      const data = await runCachedListQuery(`movies:${page}:${perPage}`, {
        page,
        perPage,
        format: 'MOVIE',
        sort: ['POPULARITY_DESC']
      });
      return c.json(data);
    } catch (err: any) {
      return c.json({ error: err?.message || 'AniList movies unavailable', results: [], page: 1, totalPages: 1, totalResults: 0 }, 502);
    }
  });

  route.get('/genres', (c) => {
    return c.json({
      genres: [...ANIME_GENRE_LIST],
      tags: [...ANIME_THEME_TAGS]
    });
  });

  route.get('/schedule', async (c) => {
    try {
      const { page, perPage } = parsePagination(c);
      const nowSec = Math.floor(Date.now() / 1000);
      const endSec = nowSec + 7 * 24 * 60 * 60;
      const cacheKey = `schedule:${page}:${perPage}`;
      const cached = listCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return c.json(cached.value);
      }

      const data = await executeAniListGraphQL(
        AIRING_SCHEDULE_QUERY,
        {
          page,
          perPage,
          airingAt_greater: nowSec - 12 * 3600,
          airingAt_lesser: endSec
        },
        fetchFn
      );
      const pageInfo = data?.Page?.pageInfo || {};
      const items = Array.isArray(data?.Page?.airingSchedules)
        ? data.Page.airingSchedules
            .filter((row: any) => row?.media && !row.media.isAdult)
            .map((row: any) => ({
              airingAt: Number(row.airingAt),
              timeUntilAiring: Number(row.timeUntilAiring),
              episode: Number(row.episode),
              media: normalizeAniListMedia(row.media)
            }))
        : [];
      const payload = {
        page: Number(pageInfo.currentPage || page),
        totalPages: Math.max(1, Number(pageInfo.lastPage || 1)),
        results: items
      };
      setBounded(listCache, cacheKey, { expiresAt: Date.now() + 10 * 60 * 1000, value: payload }, MAX_LIST_CACHE);
      return c.json(payload);
    } catch (err: any) {
      return c.json({ error: err?.message || 'AniList schedule unavailable', results: [] }, 502);
    }
  });

  route.get('/search', async (c) => {
    try {
      const { page, perPage } = parsePagination(c);
      const q = (c.req.query('q') || c.req.query('query') || '').trim() || undefined;
      const genre = (c.req.query('genre') || '').trim() || undefined;
      const tag = (c.req.query('tag') || '').trim() || undefined;
      const seasonRaw = (c.req.query('season') || '').toUpperCase();
      const season = ['WINTER', 'SPRING', 'SUMMER', 'FALL'].includes(seasonRaw) ? seasonRaw : undefined;
      const year = parseInt(c.req.query('year') || '', 10) || undefined;
      const formatRaw = (c.req.query('format') || '').toUpperCase();
      const format = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'].includes(formatRaw)
        ? formatRaw
        : undefined;
      const statusRaw = (c.req.query('status') || '').toUpperCase();
      const status = ['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'].includes(statusRaw)
        ? statusRaw
        : undefined;
      const countryRaw = (c.req.query('country') || '').toUpperCase();
      const countryOfOrigin = ['JP', 'KR', 'CN', 'TW'].includes(countryRaw) ? countryRaw : undefined;
      const minScoreFloat = parseFloat(c.req.query('minScore') || '');
      const averageScore_greater =
        Number.isFinite(minScoreFloat) && minScoreFloat > 0
          ? Math.min(99, Math.max(1, Math.round(minScoreFloat <= 10 ? minScoreFloat * 10 : minScoreFloat) - 1))
          : undefined;

      const sortMap: Record<string, string[]> = {
        popularity: ['POPULARITY_DESC'],
        trending: ['TRENDING_DESC', 'POPULARITY_DESC'],
        score: ['SCORE_DESC', 'POPULARITY_DESC'],
        newest: ['START_DATE_DESC', 'POPULARITY_DESC'],
        title: ['TITLE_ENGLISH', 'TITLE_ROMAJI']
      };
      const sortKey = (c.req.query('sort') || (q ? 'search' : 'popularity')).toLowerCase();
      const sort = q && sortKey === 'search' ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : sortMap[sortKey] || ['POPULARITY_DESC'];

      const cacheKey = `search:${JSON.stringify({
        page,
        perPage,
        q,
        genre,
        tag,
        season,
        year,
        format,
        status,
        countryOfOrigin,
        averageScore_greater,
        sort
      })}`;

      const data = await runCachedListQuery(cacheKey, {
        page,
        perPage,
        search: q,
        genre_in: genre ? [genre] : undefined,
        tag_in: tag ? [tag] : undefined,
        season,
        seasonYear: year,
        format,
        status,
        countryOfOrigin,
        averageScore_greater,
        sort
      });
      return c.json(data);
    } catch (err: any) {
      return c.json({ error: err?.message || 'AniList search unavailable', results: [], page: 1, totalPages: 1, totalResults: 0 }, 502);
    }
  });

  route.get('/media/:id', async (c) => {
    const idParam = c.req.param('id');
    const anilistId = parseInt(idParam, 10);
    if (!/^\d+$/.test(idParam) || !Number.isInteger(anilistId) || anilistId <= 0) {
      return c.json({ error: 'Invalid AniList media ID' }, 400);
    }

    const resolveTmdb = c.req.query('resolveTmdb') !== '0';

    try {
      let anime: AnimeMedia | null = null;
      const cached = detailCache.get(anilistId);
      if (cached && cached.expiresAt > Date.now()) {
        anime = cached.value;
      } else {
        const data = await executeAniListGraphQL(MEDIA_DETAIL_QUERY, { id: anilistId }, fetchFn);
        if (!data?.Media || data.Media.isAdult) {
          return c.json({ error: 'Anime not found' }, 404);
        }
        anime = normalizeAniListMedia(data.Media);

        // Enrich episodes cleanly with Jikan if MAL ID exists and episodes lack detailed titles/air dates
        if (anime.malId && anime.format !== 'MOVIE') {
          const jikanEps = await fetchJikanEpisodes(anime.malId, fetchFn);
          if (jikanEps.length > 0) {
            const byNum = new Map<number, AnimeEpisode>();
            for (const jEp of jikanEps) {
              byNum.set(jEp.episodeNumber, {
                ...jEp,
                durationMinutes: anime.durationMinutes
              });
            }
            for (const alEp of anime.episodes) {
              const existing = byNum.get(alEp.episodeNumber);
              if (existing) {
                byNum.set(alEp.episodeNumber, {
                  ...existing,
                  thumbnail: alEp.thumbnail || existing.thumbnail,
                  title:
                    existing.title && !/^Episode\s+\d+$/i.test(existing.title)
                      ? existing.title
                      : alEp.title
                });
              } else {
                byNum.set(alEp.episodeNumber, alEp);
              }
            }
            anime = {
              ...anime,
              episodes: Array.from(byNum.values()).sort((a, b) => a.episodeNumber - b.episodeNumber)
            };
          }
        }

        setBounded(detailCache, anilistId, { expiresAt: Date.now() + DETAIL_TTL_MS, value: anime }, MAX_DETAIL_CACHE);
      }

      if (resolveTmdb && !anime.tmdbId) {
        const mapping = await resolveTmdbIdForAnime(
          {
            anilistId: anime.anilistId,
            malId: anime.malId,
            title: anime.title,
            englishTitle: anime.englishTitle,
            romajiTitle: anime.romajiTitle,
            year: anime.seasonYear,
            format: anime.format
          },
          { fetchFn, tmdbApiKey: options.tmdbApiKey }
        );
        if (mapping.tmdbId) {
          anime = { ...anime, tmdbId: mapping.tmdbId };
          setBounded(detailCache, anilistId, { expiresAt: Date.now() + DETAIL_TTL_MS, value: anime }, MAX_DETAIL_CACHE);
        }
      }

      return c.json(anime);
    } catch (err: any) {
      if (err?.status === 404) {
        return c.json({ error: 'Anime not found' }, 404);
      }
      return c.json({ error: err?.message || 'Failed to fetch AniList media' }, 502);
    }
  });

  route.get('/resolve-tmdb/:id', async (c) => {
    const idParam = c.req.param('id');
    const anilistId = parseInt(idParam, 10);
    if (!/^\d+$/.test(idParam) || !Number.isInteger(anilistId) || anilistId <= 0) {
      return c.json({ error: 'Invalid AniList media ID' }, 400);
    }
    const existing = getCachedTmdbMappingForAnime(anilistId);
    if (existing) {
      return c.json(existing);
    }
    try {
      const data = await executeAniListGraphQL(MEDIA_DETAIL_QUERY, { id: anilistId }, fetchFn);
      if (!data?.Media) return c.json({ error: 'Anime not found' }, 404);
      const anime = normalizeAniListMedia(data.Media);
      const mapping = await resolveTmdbIdForAnime(
        {
          anilistId: anime.anilistId,
          malId: anime.malId,
          title: anime.title,
          englishTitle: anime.englishTitle,
          romajiTitle: anime.romajiTitle,
          year: anime.seasonYear,
          format: anime.format
        },
        { fetchFn, tmdbApiKey: options.tmdbApiKey }
      );
      return c.json(mapping);
    } catch (err: any) {
      return c.json({ error: err?.message || 'Unable to resolve TMDB mapping' }, 502);
    }
  });

  route.get('/cache/stats', (c) => {
    return c.json({
      success: true,
      ...getAniListCacheStats()
    });
  });

  route.post('/cache/clear', (c) => {
    clearAniListCache();
    return c.json({ success: true, cleared: true });
  });

  return route;
}

export const aniListRoute = createAniListRoute();
