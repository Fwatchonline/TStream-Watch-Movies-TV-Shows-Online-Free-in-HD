/**
 * Server-Side AniList GraphQL Discovery, Caching & Offline Verified Catalog
 * Shared cleanly across seoHtmlPlugin.ts, routeInventory.ts, and generate-sitemaps.ts.
 *
 * Strictly zero secrets (AniList GraphQL API is public and unauthenticated),
 * bounded concurrency/retries/timeouts, and strict AniList ID isolation (never mixed with TMDB IDs).
 */

import { ANIME_GENRE_LIST, normalizeAniListMedia } from '../src/server/api/anilist.ts';
import { createMediaSlug } from '../src/utils/slug.ts';
import { tagToSlug } from '../src/utils/tags.ts';
import { PRIMARY_ORIGIN } from '../src/utils/seo.ts';
import type { AnimeMedia } from '../src/types/media';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const DEFAULT_TIMEOUT_MS = 6500;

export interface CuratedAnimeSeed {
  anilistId: number;
  malId: number;
  format: 'TV' | 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL';
  status: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED';
  title: string;
  englishTitle: string;
  romajiTitle: string;
  description: string;
  episodesCount?: number;
  durationMinutes: number;
  seasonYear: number;
  startDate: string;
  averageScore: number;
  popularity: number;
  genres: string[];
  studios: string[];
  sampleEpisode?: {
    episodeNumber: number;
    title: string;
    overview: string;
    airDate?: string;
  };
}

const CURATED_ANIME_SEEDS: CuratedAnimeSeed[] = [
  {
    anilistId: 16498,
    malId: 16498,
    format: 'TV',
    status: 'FINISHED',
    title: 'Attack on Titan',
    englishTitle: 'Attack on Titan',
    romajiTitle: 'Shingeki no Kyojin',
    description:
      'Centuries ago, mankind was slaughtered to near extinction by monstrous humanoid creatures called Titans, forcing humans to hide in fear behind enormous concentric walls.',
    episodesCount: 25,
    durationMinutes: 24,
    seasonYear: 2013,
    startDate: '2013-04-07',
    averageScore: 84,
    popularity: 850000,
    genres: ['Action', 'Drama', 'Fantasy', 'Mystery'],
    studios: ['Wit Studio'],
    sampleEpisode: {
      episodeNumber: 1,
      title: 'To You, in 2000 Years: The Fall of Shiganshina, Part 1',
      overview:
        'After a century of peace behind massive concentric walls, humanity faces a sudden breach when a Colossal Titan shatters the outer gate of Shiganshina.',
      airDate: '2013-04-07'
    }
  },
  {
    anilistId: 113415,
    malId: 40748,
    format: 'TV',
    status: 'FINISHED',
    title: 'JUJUTSU KAISEN',
    englishTitle: 'JUJUTSU KAISEN',
    romajiTitle: 'Jujutsu Kaisen',
    description:
      'A boy swallows a cursed talisman—the finger of a demon—and becomes cursed himself. He enters a shaman school to locate the demon other body parts and exorcise himself.',
    episodesCount: 24,
    durationMinutes: 24,
    seasonYear: 2020,
    startDate: '2020-10-03',
    averageScore: 85,
    popularity: 790000,
    genres: ['Action', 'Drama', 'Supernatural'],
    studios: ['MAPPA']
  },
  {
    anilistId: 101922,
    malId: 38000,
    format: 'TV',
    status: 'FINISHED',
    title: 'Demon Slayer: Kimetsu no Yaiba',
    englishTitle: 'Demon Slayer: Kimetsu no Yaiba',
    romajiTitle: 'Kimetsu no Yaiba',
    description:
      'After his family is viciously murdered and his sister Nezuko is turned into a demon, Tanjiro Kamado embarks on a perilous journey to become a demon slayer.',
    episodesCount: 26,
    durationMinutes: 24,
    seasonYear: 2019,
    startDate: '2019-04-06',
    averageScore: 83,
    popularity: 820000,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy', 'Supernatural'],
    studios: ['ufotable']
  },
  {
    anilistId: 154587,
    malId: 52991,
    format: 'TV',
    status: 'FINISHED',
    title: "Frieren: Beyond Journey's End",
    englishTitle: "Frieren: Beyond Journey's End",
    romajiTitle: 'Sousou no Frieren',
    description:
      'After a ten-year quest to defeat the Demon King alongside the hero party, the elven mage Frieren embarks on a new journey to understand humanity and mortality.',
    episodesCount: 28,
    durationMinutes: 24,
    seasonYear: 2023,
    startDate: '2023-09-29',
    averageScore: 91,
    popularity: 560000,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    studios: ['Madhouse']
  },
  {
    anilistId: 5114,
    malId: 5114,
    format: 'TV',
    status: 'FINISHED',
    title: 'Fullmetal Alchemist: Brotherhood',
    englishTitle: 'Fullmetal Alchemist: Brotherhood',
    romajiTitle: 'Hagane no Renkinjutsushi: FULLMETAL ALCHEMIST',
    description:
      'Two brothers search for the Philosopher Stone after an attempt to revive their deceased mother goes awry and leaves them in damaged physical forms.',
    episodesCount: 64,
    durationMinutes: 24,
    seasonYear: 2009,
    startDate: '2009-04-05',
    averageScore: 90,
    popularity: 730000,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    studios: ['Bones']
  },
  {
    anilistId: 1535,
    malId: 1535,
    format: 'TV',
    status: 'FINISHED',
    title: 'Death Note',
    englishTitle: 'Death Note',
    romajiTitle: 'DEATH NOTE',
    description:
      'High school prodigy Light Yagami discovers a supernatural notebook that grants him the power to kill anyone whose name he writes inside it.',
    episodesCount: 37,
    durationMinutes: 23,
    seasonYear: 2006,
    startDate: '2006-10-04',
    averageScore: 84,
    popularity: 810000,
    genres: ['Mystery', 'Psychological', 'Supernatural', 'Thriller'],
    studios: ['Madhouse']
  },
  {
    anilistId: 9253,
    malId: 9253,
    format: 'TV',
    status: 'FINISHED',
    title: 'Steins;Gate',
    englishTitle: 'Steins;Gate',
    romajiTitle: 'Steins;Gate',
    description:
      'Self-proclaimed mad scientist Rintaro Okabe and his lab members accidentally invent a microwave device capable of sending text messages into the past.',
    episodesCount: 24,
    durationMinutes: 24,
    seasonYear: 2011,
    startDate: '2011-04-06',
    averageScore: 89,
    popularity: 620000,
    genres: ['Drama', 'Psychological', 'Sci-Fi', 'Thriller'],
    studios: ['White Fox']
  },
  {
    anilistId: 11061,
    malId: 11061,
    format: 'TV',
    status: 'FINISHED',
    title: 'Hunter x Hunter (2011)',
    englishTitle: 'Hunter x Hunter (2011)',
    romajiTitle: 'HUNTER×HUNTER (2011)',
    description:
      'Young Gon Freecss sets out to pass the rigorous Hunter Examination and become a licensed Hunter in hopes of finding his long-lost father.',
    episodesCount: 148,
    durationMinutes: 23,
    seasonYear: 2011,
    startDate: '2011-10-02',
    averageScore: 89,
    popularity: 690000,
    genres: ['Action', 'Adventure', 'Fantasy'],
    studios: ['Madhouse']
  },
  {
    anilistId: 21,
    malId: 21,
    format: 'TV',
    status: 'RELEASING',
    title: 'ONE PIECE',
    englishTitle: 'ONE PIECE',
    romajiTitle: 'ONE PIECE',
    description:
      'Monkey D. Luffy sets sail across the Grand Line with his Straw Hat Pirates crew in search of the legendary treasure known as the One Piece.',
    durationMinutes: 24,
    seasonYear: 1999,
    startDate: '1999-10-20',
    averageScore: 88,
    popularity: 640000,
    genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy'],
    studios: ['Toei Animation']
  },
  {
    anilistId: 140960,
    malId: 50265,
    format: 'TV',
    status: 'FINISHED',
    title: 'SPY x FAMILY',
    englishTitle: 'SPY x FAMILY',
    romajiTitle: 'SPY×FAMILY',
    description:
      'Master spy Twilight must build a fake family to execute an undercover mission, unaware that his adopted daughter is a telepath and his new wife is an assassin.',
    episodesCount: 12,
    durationMinutes: 24,
    seasonYear: 2022,
    startDate: '2022-04-09',
    averageScore: 84,
    popularity: 590000,
    genres: ['Action', 'Comedy', 'Slice of Life'],
    studios: ['Wit Studio', 'CloverWorks']
  },
  {
    anilistId: 1,
    malId: 1,
    format: 'TV',
    status: 'FINISHED',
    title: 'Cowboy Bebop',
    englishTitle: 'Cowboy Bebop',
    romajiTitle: 'Cowboy Bebop',
    description:
      'In the year 2071, ragtag bounty hunters Spike Spiegel and Jet Black roam the solar system aboard the spaceship Bebop chasing dangerous fugitives.',
    episodesCount: 26,
    durationMinutes: 24,
    seasonYear: 1998,
    startDate: '1998-04-03',
    averageScore: 86,
    popularity: 490000,
    genres: ['Action', 'Adventure', 'Drama', 'Sci-Fi'],
    studios: ['Sunrise']
  },
  {
    anilistId: 20583,
    malId: 20583,
    format: 'TV',
    status: 'FINISHED',
    title: 'HAIKYU!!',
    englishTitle: 'HAIKYU!!',
    romajiTitle: 'Haikyu!!',
    description:
      'Inspired by the legendary Little Giant, Shoyo Hinata joins Karasuno High School volleyball team and teams up with rival setter Tobio Kageyama.',
    episodesCount: 25,
    durationMinutes: 24,
    seasonYear: 2014,
    startDate: '2014-04-06',
    averageScore: 83,
    popularity: 520000,
    genres: ['Comedy', 'Drama', 'Sports'],
    studios: ['Production I.G']
  },
  {
    anilistId: 199,
    malId: 199,
    format: 'MOVIE',
    status: 'FINISHED',
    title: 'Spirited Away',
    englishTitle: 'Spirited Away',
    romajiTitle: 'Sen to Chihiro no Kamikakushi',
    description:
      'During her family move to the suburbs, sullen ten-year-old Chihiro wanders into a mysterious spirit realm where she must work to free her transformed parents.',
    episodesCount: 1,
    durationMinutes: 125,
    seasonYear: 2001,
    startDate: '2001-07-20',
    averageScore: 86,
    popularity: 470000,
    genres: ['Adventure', 'Drama', 'Supernatural'],
    studios: ['Studio Ghibli']
  },
  {
    anilistId: 21519,
    malId: 32281,
    format: 'MOVIE',
    status: 'FINISHED',
    title: 'Your Name.',
    englishTitle: 'Your Name.',
    romajiTitle: 'Kimi no Na wa.',
    description:
      'Two teenagers living miles apart in rural Itomori and bustling Tokyo discover they are mysteriously swapping bodies across time.',
    episodesCount: 1,
    durationMinutes: 106,
    seasonYear: 2016,
    startDate: '2016-08-26',
    averageScore: 85,
    popularity: 580000,
    genres: ['Drama', 'Romance', 'Supernatural'],
    studios: ['CoMix Wave Films']
  }
];

function curatedSeedToAnimeMedia(seed: CuratedAnimeSeed): AnimeMedia {
  return {
    anilistId: seed.anilistId,
    malId: seed.malId,
    mediaType: 'anime',
    format: seed.format,
    status: seed.status,
    title: seed.title,
    englishTitle: seed.englishTitle,
    romajiTitle: seed.romajiTitle,
    description: seed.description,
    coverImage: '',
    bannerImage: '',
    episodesCount: seed.episodesCount,
    durationMinutes: seed.durationMinutes,
    seasonYear: seed.seasonYear,
    startDate: seed.startDate,
    averageScore: seed.averageScore,
    voteAverage: Number((seed.averageScore / 10).toFixed(1)),
    popularity: seed.popularity,
    genres: seed.genres,
    tags: [],
    studios: seed.studios.map((name, idx) => ({ id: idx + 1, name, isAnimationStudio: true })),
    isAdult: false,
    characters: [],
    relations: [],
    recommendations: [],
    episodes: seed.sampleEpisode
      ? [
          {
            id: `al-${seed.anilistId}-ep-${seed.sampleEpisode.episodeNumber}`,
            episodeNumber: seed.sampleEpisode.episodeNumber,
            title: seed.sampleEpisode.title,
            overview: seed.sampleEpisode.overview,
            airDate: seed.sampleEpisode.airDate,
            durationMinutes: seed.durationMinutes
          }
        ]
      : []
  };
}

export const CURATED_ANIME_CATALOG: AnimeMedia[] = CURATED_ANIME_SEEDS.map(curatedSeedToAnimeMedia);

export function getAnimeHubRoutes(animeItems: AnimeMedia[] = CURATED_ANIME_CATALOG): Array<{
  url: string;
  file: string;
  can: string;
  noindex: boolean;
}> {
  const hasUpcoming = animeItems.some(
    (a) => String(a.status || '').toUpperCase() === 'NOT_YET_RELEASED'
  );
  const hubs = [
    { url: '/anime', file: 'anime/index.html', can: `${PRIMARY_ORIGIN}/anime`, noindex: false },
    { url: '/anime/trending', file: 'anime/trending/index.html', can: `${PRIMARY_ORIGIN}/anime/trending`, noindex: false },
    { url: '/anime/popular', file: 'anime/popular/index.html', can: `${PRIMARY_ORIGIN}/anime/popular`, noindex: false },
    { url: '/anime/seasonal', file: 'anime/seasonal/index.html', can: `${PRIMARY_ORIGIN}/anime/seasonal`, noindex: false },
    { url: '/anime/upcoming', file: 'anime/upcoming/index.html', can: `${PRIMARY_ORIGIN}/anime/upcoming`, noindex: !hasUpcoming },
    { url: '/anime/movies', file: 'anime/movies/index.html', can: `${PRIMARY_ORIGIN}/anime/movies`, noindex: false },
    { url: '/anime/genres', file: 'anime/genres/index.html', can: `${PRIMARY_ORIGIN}/anime/genres`, noindex: false }
  ];

  for (const g of ANIME_GENRE_LIST) {
    const slug = tagToSlug(g);
    if (!slug) continue;
    const gLower = g.toLowerCase();
    const hasMatches = animeItems.some(
      (a) => Array.isArray(a.genres) && a.genres.some((ag) => String(ag).toLowerCase() === gLower)
    );
    hubs.push({
      url: `/anime/genres/${slug}`,
      file: `anime/genres/${slug}/index.html`,
      can: `${PRIMARY_ORIGIN}/anime/genres/${slug}`,
      noindex: !hasMatches
    });
  }

  return hubs;
}

const ANILIST_DISCOVERY_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $format: MediaFormat, $genre_in: [String], $status: MediaStatus) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      currentPage
      lastPage
      hasNextPage
    }
    media(type: ANIME, isAdult: false, sort: $sort, format: $format, genre_in: $genre_in, status: $status) {
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
      title { romaji english native }
      description(asHtml: false)
      startDate { year month day }
      endDate { year month day }
      coverImage { extraLarge large medium }
      bannerImage
      genres
      studios(isMain: true) { nodes { id name isAnimationStudio } }
    }
  }
}
`;

const ANILIST_DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME, isAdult: false) {
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
    synonyms
    title { romaji english native }
    description(asHtml: false)
    startDate { year month day }
    endDate { year month day }
    coverImage { extraLarge large medium }
    bannerImage
    genres
    tags { name rank isMediaSpoiler isGeneralSpoiler }
    studios(isMain: true) { nodes { id name isAnimationStudio } }
    streamingEpisodes { title thumbnail url site }
  }
}
`;

async function queryAniList(
  query: string,
  variables: Record<string, any>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = 1
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(ANILIST_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });
      if (res.status === 404) {
        return null;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        const err: any = new Error(`AniList HTTP ${res.status}`);
        err.status = res.status === 429 || res.status >= 500 ? 503 : res.status;
        throw err;
      }
      const json = await res.json();
      if (json?.errors && !json?.data) {
        const msg = String(json.errors[0]?.message || 'AniList GraphQL error');
        const err: any = new Error(msg);
        err.status = /not found/i.test(msg) ? 404 : 503;
        throw err;
      }
      return json?.data ?? null;
    } catch (err: any) {
      lastErr = err;
      if (err?.status === 404) return null;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const finalErr: any = lastErr || new Error('AniList upstream unavailable');
  if (!finalErr.status || finalErr.status >= 500 || finalErr.status === 429 || finalErr.name === 'AbortError') {
    finalErr.status = 503;
  }
  throw finalErr;
}

const serverAnimeDetailCache = new Map<number, { expiresAt: number; staleUntil: number; value: AnimeMedia }>();
const serverAnimeListCache = new Map<string, { expiresAt: number; staleUntil: number; value: { items: AnimeMedia[]; totalPages: number } }>();

export function clearAnimeSeoCaches(): void {
  serverAnimeDetailCache.clear();
  serverAnimeListCache.clear();
}

export async function fetchServerAnimeDetail(
  anilistId: number,
  fetchImpl: typeof fetch = fetch
): Promise<AnimeMedia | null> {
  if (!Number.isInteger(anilistId) || anilistId <= 0) return null;
  const useCache = fetchImpl === fetch;
  const now = Date.now();

  if (useCache) {
    const hit = serverAnimeDetailCache.get(anilistId);
    if (hit && hit.expiresAt > now) return hit.value;
  }

  // In live/offline fallback mode (default global fetch), if AniList fails, allow curated match
  const curatedMatch = CURATED_ANIME_CATALOG.find((a) => a.anilistId === anilistId) || null;

  try {
    const data = await queryAniList(ANILIST_DETAIL_QUERY, { id: anilistId }, fetchImpl, 5000, 1);
    if (!data || !data.Media || data.Media.isAdult) {
      return null;
    }
    const normalized = normalizeAniListMedia(data.Media);
    // Preserve richer sample episode overview when curated match has verified episode copy
    if (curatedMatch?.episodes?.length && normalized.episodes) {
      for (const curEp of curatedMatch.episodes) {
        const idx = normalized.episodes.findIndex((e) => e.episodeNumber === curEp.episodeNumber);
        if (idx >= 0 && !normalized.episodes[idx].overview && curEp.overview) {
          normalized.episodes[idx] = { ...normalized.episodes[idx], overview: curEp.overview };
        }
      }
    }
    if (useCache) {
      serverAnimeDetailCache.set(anilistId, {
        expiresAt: now + 15 * 60 * 1000,
        staleUntil: now + 6 * 60 * 60 * 1000,
        value: normalized
      });
    }
    return normalized;
  } catch (err: any) {
    if (useCache) {
      const stale = serverAnimeDetailCache.get(anilistId);
      if (stale && stale.staleUntil > now) return stale.value;
      if (curatedMatch) return curatedMatch;
    }
    if (err?.status === 404) return null;
    const outErr: any = new Error(err?.message || 'AniList service unavailable');
    outErr.status = 503;
    throw outErr;
  }
}

export async function fetchServerAnimeSectionList(
  section: string,
  page = 1,
  genreName?: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ items: AnimeMedia[]; totalPages: number }> {
  const useCache = fetchImpl === fetch;
  const cacheKey = `${section}:${page}:${genreName || ''}`;
  const now = Date.now();
  if (useCache) {
    const hit = serverAnimeListCache.get(cacheKey);
    if (hit && hit.expiresAt > now) return hit.value;
  }

  const variables: Record<string, any> = { page, perPage: 16, sort: ['TRENDING_DESC', 'POPULARITY_DESC'] };
  if (section === 'popular') variables.sort = ['POPULARITY_DESC'];
  else if (section === 'seasonal') variables.sort = ['TRENDING_DESC', 'POPULARITY_DESC'];
  else if (section === 'upcoming') {
    variables.sort = ['POPULARITY_DESC'];
    variables.status = 'NOT_YET_RELEASED';
  } else if (section === 'movies') {
    variables.format = 'MOVIE';
    variables.sort = ['POPULARITY_DESC'];
  } else if (section === 'genres' && genreName) {
    variables.genre_in = [genreName];
    variables.sort = ['POPULARITY_DESC'];
  }

  try {
    const data = await queryAniList(ANILIST_DISCOVERY_QUERY, variables, fetchImpl, 5000, 1);
    const mediaList: AnimeMedia[] = Array.isArray(data?.Page?.media)
      ? data.Page.media.filter((m: any) => m && !m.isAdult && m.id).map(normalizeAniListMedia)
      : [];
    const totalPages = Math.max(1, Math.min(200, Number(data?.Page?.pageInfo?.lastPage || 1)));
    const payload = { items: mediaList, totalPages };
    if (useCache && mediaList.length > 0) {
      serverAnimeListCache.set(cacheKey, {
        expiresAt: now + 5 * 60 * 1000,
        staleUntil: now + 60 * 60 * 1000,
        value: payload
      });
    }
    return payload;
  } catch (err: any) {
    if (useCache) {
      const stale = serverAnimeListCache.get(cacheKey);
      if (stale && stale.staleUntil > now) return stale.value;
    }
    // Safe offline curated fallback for section hubs
    let pool = CURATED_ANIME_CATALOG;
    if (section === 'movies') pool = pool.filter((a) => a.format === 'MOVIE');
    else if (section === 'genres' && genreName) {
      const gLower = genreName.toLowerCase();
      pool = pool.filter((a) => a.genres.some((g) => g.toLowerCase() === gLower));
    }
    if (!useCache) {
      // Custom mock fetch in tests should surface 503 if failing
      const outErr: any = new Error(err?.message || 'AniList section unavailable');
      outErr.status = 503;
      throw outErr;
    }
    return { items: page === 1 ? pool.slice(0, 12) : [], totalPages: 1 };
  }
}

export interface AnimeDiscoveryResult {
  items: AnimeMedia[];
  attemptedRequests: number;
  successfulRequests: number;
  failedFeeds: string[];
  hadPartialOutage: boolean;
  hadTotalLiveOutage: boolean;
  errors: string[];
}

export async function discoverAnimeCatalog(
  options: { fetchImpl?: typeof fetch; maxPagesPerFeed?: number; requestTimeoutMs?: number } = {}
): Promise<AnimeDiscoveryResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.requestTimeoutMs ?? 5500;
  const perPage = 25;
  const pages = Math.max(1, Math.min(2, options.maxPagesPerFeed ?? 1));

  const feeds: Array<{ name: string; vars: Record<string, any> }> = [
    { name: 'anilist_trending', vars: { sort: ['TRENDING_DESC', 'POPULARITY_DESC'], perPage } },
    { name: 'anilist_popular', vars: { sort: ['POPULARITY_DESC'], perPage } },
    { name: 'anilist_movies', vars: { format: 'MOVIE', sort: ['POPULARITY_DESC'], perPage } },
    { name: 'anilist_upcoming', vars: { status: 'NOT_YET_RELEASED', sort: ['POPULARITY_DESC'], perPage } }
  ];

  const seen = new Map<number, AnimeMedia>();
  for (const curated of CURATED_ANIME_CATALOG) {
    seen.set(curated.anilistId, curated);
  }

  let attemptedRequests = 0;
  let successfulRequests = 0;
  const failedFeeds: string[] = [];
  const errors: string[] = [];

  for (const feed of feeds) {
    let feedOk = false;
    for (let p = 1; p <= pages; p++) {
      attemptedRequests++;
      try {
        const data = await queryAniList(ANILIST_DISCOVERY_QUERY, { ...feed.vars, page: p }, fetchImpl, timeoutMs, 1);
        const list = Array.isArray(data?.Page?.media) ? data.Page.media : [];
        successfulRequests++;
        feedOk = true;
        for (const raw of list) {
          if (!raw?.id || raw?.isAdult) continue;
          const norm = normalizeAniListMedia(raw);
          if (norm.anilistId > 0 && norm.title && !seen.has(norm.anilistId)) {
            seen.set(norm.anilistId, norm);
          }
        }
      } catch (err: any) {
        errors.push(`${feed.name}:p${p}:${err?.message || 'failed'}`);
      }
    }
    if (!feedOk) {
      failedFeeds.push(feed.name);
    }
  }

  return {
    items: Array.from(seen.values()),
    attemptedRequests,
    successfulRequests,
    failedFeeds,
    hadPartialOutage: failedFeeds.length > 0 && successfulRequests > 0,
    hadTotalLiveOutage: attemptedRequests > 0 && successfulRequests === 0,
    errors
  };
}

export function buildAnimeRouteInfo(anime: AnimeMedia): {
  id: number;
  title: string;
  slug: string;
  format: string;
  detailPath: string;
  canonicalUrl: string;
} {
  const title = (anime.title || anime.englishTitle || anime.romajiTitle || 'Untitled Anime').trim();
  const slug = createMediaSlug(title, anime.anilistId);
  const isMovie = String(anime.format || '').toUpperCase() === 'MOVIE';
  const detailPath = isMovie ? `/anime-movie/${slug}` : `/anime/${slug}`;
  return {
    id: anime.anilistId,
    title,
    slug,
    format: anime.format || 'TV',
    detailPath,
    canonicalUrl: `${PRIMARY_ORIGIN}${detailPath}`
  };
}

export function resolveAnimeGenreSlugMeta(slugParam: string): {
  name: string;
  slug: string;
  isAlias: boolean;
} | null {
  if (!slugParam) return null;
  const clean = tagToSlug(decodeURIComponent(slugParam));
  if (!clean) return null;
  const matched = ANIME_GENRE_LIST.find((g) => tagToSlug(g) === clean);
  if (!matched) return null;
  const canonicalSlug = tagToSlug(matched);
  return {
    name: matched,
    slug: canonicalSlug,
    isAlias: slugParam !== canonicalSlug
  };
}
