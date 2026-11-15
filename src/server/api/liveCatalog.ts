import { Hono } from 'hono';
import { getGenreById } from '../../utils/genres';
import { ALL_GENRES } from '../../services/catalogData';
import { buildImageProxyUrl } from '../../utils/imageUrl';

export const liveCatalogRoute = new Hono();

const CINEMETA_CATALOG_BASE = 'https://cinemeta-catalogs.strem.io/top/catalog';
const CINEMETA_META_BASE = 'https://v3-cinemeta.strem.io';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_FEED_CACHE = 150;
const MAX_DETAIL_CACHE = 250;
const MAX_ID_MAP = 4000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const feedCache = new Map<string, CacheEntry<any[]>>();
const detailCache = new Map<string, CacheEntry<any>>();
const inFlightFeeds = new Map<string, Promise<any[]>>();
const tmdbToImdbMap = new Map<string, { imdbId: string; title?: string }>();

function setBoundedMap<K, V>(map: Map<K, V>, key: K, val: V, maxSize: number) {
  if (map.has(key)) map.delete(key);
  map.set(key, val);
  while (map.size > maxSize) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
    else break;
  }
}

function stableNumericId(imdbId: string): number {
  const digits = imdbId.replace(/\D/g, '');
  const parsed = parseInt(digits, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return 90000000 + parsed;
  }
  let hash = 0;
  for (let i = 0; i < imdbId.length; i++) {
    hash = ((hash << 5) - hash + imdbId.charCodeAt(i)) | 0;
  }
  return 90000000 + Math.abs(hash || 1);
}

function normalizeImageForClient(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const upgraded = rawUrl.replace('/poster/small/', '/poster/medium/');
  try {
    const parsed = new URL(upgraded);
    if (
      parsed.hostname === 'images.metahub.space' ||
      parsed.hostname === 'live.metahub.space' ||
      parsed.hostname === 'episodes.metahub.space'
    ) {
      return buildImageProxyUrl(upgraded);
    }
    return upgraded;
  } catch {
    return upgraded;
  }
}

function mapGenreNamesToObjects(rawGenres?: string[]): Array<{ id: number; name: string }> {
  if (!Array.isArray(rawGenres)) return [];
  const result: Array<{ id: number; name: string }> = [];
  for (const name of rawGenres) {
    const clean = String(name || '').trim();
    if (!clean) continue;
    const normalized = clean.toLowerCase();
    const match = ALL_GENRES.find(g => {
      const gn = g.name.toLowerCase();
      return (
        gn === normalized ||
        (normalized === 'sci-fi' && gn === 'science fiction') ||
        (normalized === 'action & adventure' && gn === 'action & adventure') ||
        (normalized === 'sci-fi & fantasy' && gn === 'sci-fi & fantasy')
      );
    });
    if (match) {
      result.push(match);
    } else {
      result.push({ id: 0, name: clean });
    }
  }
  return result;
}

function parseReleaseYear(releaseInfo?: string): number {
  const m = String(releaseInfo || '').match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 2024;
}

function normalizeCinemetaItem(raw: any, mediaType: 'movie' | 'tv', rankIndex = 0) {
  const imdbId = typeof raw.id === 'string' && raw.id.startsWith('tt') ? raw.id : raw.imdb_id;
  const numericId =
    Number.isInteger(raw.moviedb_id) && raw.moviedb_id > 0
      ? Number(raw.moviedb_id)
      : imdbId
      ? stableNumericId(imdbId)
      : 90000001 + rankIndex;

  if (imdbId) {
    setBoundedMap(tmdbToImdbMap, `${mediaType}:${numericId}`, { imdbId, title: raw.name }, MAX_ID_MAP);
  }

  const year = parseReleaseYear(raw.releaseInfo || raw.year);
  const rating = parseFloat(String(raw.imdbRating || '0'));
  const voteAverage = Number.isFinite(rating) && rating > 0 ? Number(rating.toFixed(1)) : 0;

  const rawPoster =
    raw.poster ||
    (imdbId ? `https://images.metahub.space/poster/medium/${imdbId}/img` : '');
  const rawBackdrop =
    raw.background ||
    (imdbId ? `https://images.metahub.space/background/medium/${imdbId}/img` : rawPoster);

  return {
    id: numericId,
    tmdbId: numericId,
    imdbId: imdbId || undefined,
    title: String(raw.name || raw.title || 'Untitled').trim(),
    overview: String(raw.description || raw.overview || 'No overview available.').trim(),
    posterPath: normalizeImageForClient(rawPoster),
    backdropPath: normalizeImageForClient(rawBackdrop) || normalizeImageForClient(rawPoster),
    releaseDate: raw.released
      ? String(raw.released).slice(0, 10)
      : `${year}-01-01`,
    voteAverage,
    voteCount: voteAverage > 0 ? Math.max(120, Math.round(voteAverage * 350)) : 0,
    popularity: Number((1000 - rankIndex * 3 + voteAverage * 10).toFixed(1)),
    genres: mapGenreNamesToObjects(raw.genres),
    mediaType,
    certification: mediaType === 'tv' ? 'TV-14' : 'PG-13'
  };
}

function mapGenreIdToCinemetaName(genreId?: number): string | undefined {
  if (!genreId) return undefined;
  const meta = getGenreById(genreId);
  const name = meta?.name || ALL_GENRES.find(g => g.id === genreId)?.name;
  if (!name) return undefined;
  switch (name) {
    case 'Science Fiction':
    case 'Sci-Fi & Fantasy':
      return 'Sci-Fi';
    case 'Action & Adventure':
      return 'Action';
    default:
      return name;
  }
}

async function fetchCinemetaFeed(url: string): Promise<any[]> {
  const cached = feedCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let pending = inFlightFeeds.get(url);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
        if (!res.ok) return [];
        const data = (await res.json()) as any;
        const metas = Array.isArray(data?.metas) ? data.metas : [];
        if (metas.length > 0) {
          setBoundedMap(
            feedCache,
            url,
            { value: metas, expiresAt: Date.now() + CACHE_TTL_MS },
            MAX_FEED_CACHE
          );
        }
        return metas;
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
        inFlightFeeds.delete(url);
      }
    })();
    inFlightFeeds.set(url, pending);
  }

  return pending;
}

function buildFeedUrl(
  type: 'movie' | 'series',
  feed: 'top' | 'year' | 'imdbRating',
  skip: number,
  genreName?: string
): string {
  const extraParts: string[] = [];
  if (genreName) extraParts.push(`genre=${encodeURIComponent(genreName)}`);
  if (skip > 0) extraParts.push(`skip=${skip}`);
  const extra = extraParts.length > 0 ? `/${extraParts.join('&')}` : '';
  return `${CINEMETA_CATALOG_BASE}/${type}/${feed}${extra}.json`;
}

function sortItems(items: any[], sortBy: string): any[] {
  const copy = [...items];
  switch (sortBy) {
    case 'vote_average.desc':
      return copy.sort((a, b) => b.voteAverage - a.voteAverage || b.popularity - a.popularity);
    case 'primary_release_date.desc':
      return copy.sort((a, b) => {
        const da = Date.parse(a.releaseDate) || 0;
        const db = Date.parse(b.releaseDate) || 0;
        return db - da;
      });
    case 'title.asc':
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return copy.sort((a, b) => b.popularity - a.popularity);
  }
}

function resolveFeedKind(category: string, sortBy?: string): 'top' | 'year' | 'imdbRating' {
  if (sortBy === 'vote_average.desc' || category === 'top-movies' || category === 'top-tv' || category === 'top-rated') {
    return 'imdbRating';
  }
  if (sortBy === 'primary_release_date.desc' || category === 'upcoming' || category === 'airing-today' || category === 'trending') {
    return 'year';
  }
  return 'top';
}

liveCatalogRoute.get('/', async c => {
  const category = (c.req.query('category') || 'popular-movies').toLowerCase();
  const page = Math.max(1, Math.min(50, Math.floor(Number(c.req.query('page')) || 1)));
  const mediaTypeParam = (c.req.query('mediaType') || 'all').toLowerCase() as 'all' | 'movie' | 'tv';
  const genreIdRaw = Number(c.req.query('genreId'));
  const genreId = Number.isFinite(genreIdRaw) && genreIdRaw > 0 ? genreIdRaw : undefined;
  const yearRaw = Number(c.req.query('year'));
  const yearFilter = Number.isFinite(yearRaw) && yearRaw > 1900 ? yearRaw : undefined;
  const minRatingRaw = Number(c.req.query('minRating'));
  const minRating = Number.isFinite(minRatingRaw) && minRatingRaw > 0 ? minRatingRaw : undefined;
  const sortBy = c.req.query('sortBy') || 'popularity.desc';
  const query = (c.req.query('query') || '').trim();
  const letter = (c.req.query('letter') || '').trim().toUpperCase();

  let targetType: 'all' | 'movie' | 'tv' = mediaTypeParam;
  if (targetType === 'all') {
    if (category === 'movies' || category === 'popular-movies' || category === 'top-movies' || category === 'upcoming') {
      targetType = 'movie';
    } else if (category === 'tv' || category === 'popular-tv' || category === 'top-tv' || category === 'airing-today') {
      targetType = 'tv';
    }
  }

  const pageSize = category === 'top-rated' ? 12 : 20;

  // 1. Search query mode
  if (query) {
    const fetchMovie = targetType === 'all' || targetType === 'movie';
    const fetchTv = targetType === 'all' || targetType === 'tv';
    const [movMetas, tvMetas] = await Promise.all([
      fetchMovie ? fetchCinemetaFeed(`${CINEMETA_META_BASE}/catalog/movie/top/search=${encodeURIComponent(query)}.json`) : Promise.resolve([]),
      fetchTv ? fetchCinemetaFeed(`${CINEMETA_META_BASE}/catalog/series/top/search=${encodeURIComponent(query)}.json`) : Promise.resolve([])
    ]);

    let items = [
      ...movMetas.map((m, idx) => normalizeCinemetaItem(m, 'movie', idx)),
      ...tvMetas.map((t, idx) => normalizeCinemetaItem(t, 'tv', idx))
    ];

    if (genreId) {
      const gMeta = getGenreById(genreId);
      const gName = mapGenreIdToCinemetaName(genreId)?.toLowerCase();
      items = items.filter(it => {
        if (it.mediaType === 'tv' && gMeta && !gMeta.tmdbTvGenreId) return false;
        if (it.mediaType === 'movie' && gMeta && !gMeta.tmdbMovieGenreId) return false;
        return it.genres.some((g: any) => g.id === genreId || (gName && g.name.toLowerCase().includes(gName)));
      });
    }
    if (yearFilter) {
      items = items.filter(it => parseReleaseYear(it.releaseDate) === yearFilter);
    }
    if (minRating) {
      items = items.filter(it => it.voteAverage >= minRating);
    }

    items = sortItems(items, sortBy);
    const totalResults = items.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
    const validPage = Math.min(page, totalPages);
    const start = (validPage - 1) * pageSize;

    return c.json({
      page: validPage,
      totalPages,
      totalResults,
      results: items.slice(start, start + pageSize),
      source: 'live-cinemeta'
    });
  }

  // Genre resolution (strictly respecting Movie vs TV availability)
  const genreMeta = genreId ? getGenreById(genreId) : undefined;
  const cinemetaGenre = mapGenreIdToCinemetaName(genreId);
  const allowMoviesForGenre = !genreId || !genreMeta || Boolean(genreMeta.tmdbMovieGenreId);
  const allowTvForGenre = !genreId || !genreMeta || Boolean(genreMeta.tmdbTvGenreId);

  // 2. A-Z Directory mode
  if (letter && letter !== 'ALL') {
    const fetchMovie = (targetType === 'all' || targetType === 'movie') && allowMoviesForGenre;
    const fetchTv = (targetType === 'all' || targetType === 'tv') && allowTvForGenre;
    const isNum = letter === '0-9';

    const skips = [0, 50, 100, 150];
    const [movBatches, tvBatches] = await Promise.all([
      fetchMovie
        ? Promise.all([
            ...skips.map(s => fetchCinemetaFeed(buildFeedUrl('movie', 'top', s, cinemetaGenre))),
            fetchCinemetaFeed(buildFeedUrl('movie', 'imdbRating', 0, cinemetaGenre)),
            isNum ? Promise.resolve([]) : fetchCinemetaFeed(`${CINEMETA_META_BASE}/catalog/movie/top/search=${encodeURIComponent(letter)}.json`)
          ])
        : Promise.resolve([]),
      fetchTv
        ? Promise.all([
            ...skips.map(s => fetchCinemetaFeed(buildFeedUrl('series', 'top', s, cinemetaGenre))),
            fetchCinemetaFeed(buildFeedUrl('series', 'imdbRating', 0, cinemetaGenre)),
            isNum ? Promise.resolve([]) : fetchCinemetaFeed(`${CINEMETA_META_BASE}/catalog/series/top/search=${encodeURIComponent(letter)}.json`)
          ])
        : Promise.resolve([])
    ]);

    const seen = new Set<string>();
    const matched: any[] = [];
    const addMatches = (rawList: any[], mediaType: 'movie' | 'tv') => {
      rawList.forEach((raw, idx) => {
        const cleanTitle = String(raw.name || '').replace(/^[^a-zA-Z0-9]+/, '').trim();
        if (!cleanTitle) return;
        const ok = isNum ? /^[0-9]/.test(cleanTitle) : cleanTitle.toUpperCase().startsWith(letter);
        if (!ok) return;
        const item = normalizeCinemetaItem(raw, mediaType, idx);
        if (yearFilter && parseReleaseYear(item.releaseDate) !== yearFilter) return;
        if (minRating && item.voteAverage < minRating) return;
        const key = `${mediaType}:${item.imdbId || item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          matched.push(item);
        }
      });
    };

    movBatches.forEach(batch => addMatches(batch, 'movie'));
    tvBatches.forEach(batch => addMatches(batch, 'tv'));

    const sorted = sortItems(matched, sortBy);
    const totalResults = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / 18));
    const validPage = Math.min(page, totalPages);
    const start = (validPage - 1) * 18;

    return c.json({
      page: validPage,
      totalPages,
      totalResults,
      results: sorted.slice(start, start + 18),
      source: 'live-cinemeta'
    });
  }

  // 3. Discovery Mode (Movies / TV Series / Trending / Top Rated / Genre)
  const feedKind = resolveFeedKind(category, sortBy);
  const needExtraPool = Boolean(yearFilter || minRating);
  const perTypeOffset = targetType === 'all' ? (page - 1) * (pageSize / 2) : (page - 1) * pageSize;
  const skipBucket = Math.floor(perTypeOffset / 50) * 50;

  const fetchMovie = (targetType === 'all' || targetType === 'movie') && allowMoviesForGenre;
  const fetchTv = (targetType === 'all' || targetType === 'tv') && allowTvForGenre;

  const skipsToLoad = needExtraPool ? [0, 50, 100] : [skipBucket];

  const [movChunks, tvChunks] = await Promise.all([
    fetchMovie
      ? Promise.all(skipsToLoad.map(s => fetchCinemetaFeed(buildFeedUrl('movie', feedKind, s, cinemetaGenre))))
      : Promise.resolve([]),
    fetchTv
      ? Promise.all(skipsToLoad.map(s => fetchCinemetaFeed(buildFeedUrl('series', feedKind, s, cinemetaGenre))))
      : Promise.resolve([])
  ]);

  const dedupeRaw = (chunks: any[][]) => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const chunk of chunks) {
      for (const m of chunk) {
        const key = String(m.id || m.name);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(m);
        }
      }
    }
    return out;
  };

  let movItems = dedupeRaw(movChunks).map((m, idx) => normalizeCinemetaItem(m, 'movie', skipBucket + idx));
  let tvItems = dedupeRaw(tvChunks).map((t, idx) => normalizeCinemetaItem(t, 'tv', skipBucket + idx));

  if (yearFilter) {
    movItems = movItems.filter(it => parseReleaseYear(it.releaseDate) === yearFilter);
    tvItems = tvItems.filter(it => parseReleaseYear(it.releaseDate) === yearFilter);
  }
  if (minRating) {
    movItems = movItems.filter(it => it.voteAverage >= minRating);
    tvItems = tvItems.filter(it => it.voteAverage >= minRating);
  }

  let results: any[] = [];
  if (targetType === 'movie') {
    const startInBucket = needExtraPool ? (page - 1) * pageSize : perTypeOffset - skipBucket;
    const pool = sortBy !== 'popularity.desc' && sortBy !== 'vote_average.desc' ? sortItems(movItems, sortBy) : movItems;
    results = pool.slice(startInBucket, startInBucket + pageSize);
  } else if (targetType === 'tv') {
    const startInBucket = needExtraPool ? (page - 1) * pageSize : perTypeOffset - skipBucket;
    const pool = sortBy !== 'popularity.desc' && sortBy !== 'vote_average.desc' ? sortItems(tvItems, sortBy) : tvItems;
    results = pool.slice(startInBucket, startInBucket + pageSize);
  } else {
    const half = Math.floor(pageSize / 2);
    const startInBucket = needExtraPool ? (page - 1) * half : perTypeOffset - skipBucket;
    const movSlice = movItems.slice(startInBucket, startInBucket + half);
    const tvSlice = tvItems.slice(startInBucket, startInBucket + half);
    const maxLen = Math.max(movSlice.length, tvSlice.length);
    for (let i = 0; i < maxLen; i++) {
      if (movSlice[i]) results.push(movSlice[i]);
      if (tvSlice[i]) results.push(tvSlice[i]);
    }
    if (sortBy !== 'popularity.desc') {
      results = sortItems(results, sortBy);
    }
  }

  if (results.length === 0) {
    return c.json({
      page,
      totalPages: 1,
      totalResults: 0,
      results: [],
      source: 'live-cinemeta'
    });
  }

  // Cinemeta exposes up to several hundred ranked titles per catalog
  const estimatedTotalResults = needExtraPool
    ? movItems.length + tvItems.length
    : targetType === 'all'
    ? 600
    : 300;
  const estimatedTotalPages = Math.max(page, Math.ceil(estimatedTotalResults / pageSize));

  return c.json({
    page,
    totalPages: Math.min(20, estimatedTotalPages),
    totalResults: estimatedTotalResults,
    results,
    source: 'live-cinemeta'
  });
});

liveCatalogRoute.get('/detail', async c => {
  const typeParam = (c.req.query('type') || 'movie').toLowerCase() === 'tv' ? 'tv' : 'movie';
  const idRaw = Number(c.req.query('id'));
  const queryImdb = (c.req.query('imdbId') || '').trim();

  if (!Number.isFinite(idRaw) || idRaw <= 0) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  const cacheKey = `${typeParam}:${idRaw}:${queryImdb}`;
  const cached = detailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return c.json(cached.value);
  }

  let imdbId = queryImdb;
  if (!imdbId) {
    const mapped = tmdbToImdbMap.get(`${typeParam}:${idRaw}`);
    if (mapped?.imdbId) imdbId = mapped.imdbId;
  }

  if (!imdbId && idRaw >= 90000000) {
    const digits = String(idRaw - 90000000).padStart(7, '0');
    imdbId = `tt${digits}`;
  }

  // Fallback scan through cached feed items in case page loaded directly
  if (!imdbId) {
    for (const entry of feedCache.values()) {
      const hit = entry.value.find((m: any) => Number(m.moviedb_id) === idRaw && typeof m.id === 'string');
      if (hit) {
        imdbId = hit.id;
        break;
      }
    }
  }

  if (!imdbId) {
    return c.json({ error: 'Item not mapped to Cinemeta IMDb ID' }, 404);
  }

  const cinemetaType = typeParam === 'tv' ? 'series' : 'movie';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const res = await fetch(`${CINEMETA_META_BASE}/meta/${cinemetaType}/${encodeURIComponent(imdbId)}.json`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) {
      return c.json({ error: 'Cinemeta metadata unavailable' }, res.status as any);
    }

    const json = (await res.json()) as any;
    const m = json?.meta;
    if (!m || !m.name) {
      return c.json({ error: 'Metadata not found' }, 404);
    }

    const resolvedId = Number(m.moviedb_id) > 0 ? Number(m.moviedb_id) : idRaw;
    const year = parseReleaseYear(m.releaseInfo || m.year);
    const rating = parseFloat(String(m.imdbRating || '0'));
    const voteAverage = Number.isFinite(rating) && rating > 0 ? Number(rating.toFixed(1)) : 0;

    const posterPath = normalizeImageForClient(
      m.poster || `https://images.metahub.space/poster/medium/${imdbId}/img`
    );
    const backdropPath = normalizeImageForClient(
      m.background || `https://images.metahub.space/background/medium/${imdbId}/img`
    );

    const cast = (Array.isArray(m.cast) ? m.cast : []).slice(0, 12).map((actor: string, idx: number) => ({
      id: idx + 1,
      name: actor,
      character: 'Cast',
      profilePath: null,
      order: idx
    }));

    const videos = (Array.isArray(m.trailers) ? m.trailers : [])
      .filter((t: any) => t?.source)
      .slice(0, 4)
      .map((t: any, idx: number) => ({
        id: `cm_v_${idx}`,
        key: String(t.source),
        name: `${m.name} Trailer`,
        site: 'YouTube',
        type: t.type || 'Trailer',
        official: true
      }));

    const runtimeMatch = String(m.runtime || '').match(/\d+/);
    const runtimeMinutes = runtimeMatch ? parseInt(runtimeMatch[0], 10) : undefined;

    let seasons: any[] | undefined;
    let numberOfSeasons: number | undefined;
    let numberOfEpisodes: number | undefined;

    if (typeParam === 'tv') {
      const seasonMap = new Map<number, any[]>();
      const rawVideos = Array.isArray(m.videos) ? m.videos : [];
      for (const ep of rawVideos) {
        const sNum = Number(ep.season);
        const eNum = Number(ep.episode ?? ep.number);
        if (!Number.isFinite(sNum) || sNum <= 0 || !Number.isFinite(eNum) || eNum <= 0) continue;
        const list = seasonMap.get(sNum) || [];
        const epRating = parseFloat(String(ep.rating || '0'));
        list.push({
          id: resolvedId * 10000 + sNum * 100 + eNum,
          episodeNumber: eNum,
          seasonNumber: sNum,
          name: ep.name || ep.title || `Episode ${eNum}`,
          overview: ep.overview || ep.description || '',
          stillPath: ep.thumbnail ? normalizeImageForClient(ep.thumbnail) : backdropPath,
          airDate: ep.released ? String(ep.released).slice(0, 10) : '',
          voteAverage: Number.isFinite(epRating) && epRating > 0 ? Number(epRating.toFixed(1)) : 0,
          runtime: 45
        });
        seasonMap.set(sNum, list);
      }

      const sortedSeasonNums = Array.from(seasonMap.keys()).sort((a, b) => a - b);
      seasons = sortedSeasonNums.map(sNum => {
        const eps = (seasonMap.get(sNum) || []).sort((a, b) => a.episodeNumber - b.episodeNumber);
        return {
          id: resolvedId * 100 + sNum,
          seasonNumber: sNum,
          name: `Season ${sNum}`,
          overview: `Season ${sNum} of ${m.name}.`,
          posterPath,
          airDate: eps[0]?.airDate || `${year}-01-01`,
          episodeCount: eps.length,
          episodes: eps
        };
      });

      if (seasons.length === 0) {
        seasons = [
          {
            id: resolvedId * 100 + 1,
            seasonNumber: 1,
            name: 'Season 1',
            overview: `Season 1 of ${m.name}.`,
            posterPath,
            airDate: `${year}-01-01`,
            episodeCount: 1,
            episodes: [
              {
                id: resolvedId * 10000 + 101,
                episodeNumber: 1,
                seasonNumber: 1,
                name: 'Episode 1',
                overview: m.description || '',
                stillPath: backdropPath,
                airDate: `${year}-01-01`,
                voteAverage: 0,
                runtime: 45
              }
            ]
          }
        ];
      }

      numberOfSeasons = seasons.length;
      numberOfEpisodes = seasons.reduce((sum, s) => sum + (s.episodeCount || 0), 0);
    }

    const detail = {
      id: resolvedId,
      tmdbId: resolvedId,
      imdbId,
      title: String(m.name).trim(),
      overview: String(m.description || 'No overview available.').trim(),
      posterPath,
      backdropPath: backdropPath || posterPath,
      releaseDate: m.released ? String(m.released).slice(0, 10) : `${year}-01-01`,
      voteAverage,
      voteCount: voteAverage > 0 ? Math.max(150, Math.round(voteAverage * 400)) : 0,
      popularity: 120,
      genres: mapGenreNamesToObjects(m.genres),
      mediaType: typeParam,
      certification: typeParam === 'tv' ? 'TV-14' : 'PG-13',
      runtime: typeParam === 'movie' ? runtimeMinutes || 110 : undefined,
      numberOfSeasons,
      numberOfEpisodes,
      seasons,
      status: m.status || (typeParam === 'tv' ? 'Returning Series' : 'Released'),
      tagline: '',
      director: Array.isArray(m.director) ? m.director[0] : undefined,
      writer: Array.isArray(m.writer) ? m.writer[0] : undefined,
      productionCompanies: [],
      productionCountries: m.country ? [String(m.country)] : ['United States of America'],
      spokenLanguages: ['English'],
      belongsToCollection: null,
      videos,
      cast,
      keywords: [],
      similar: [],
      recommendations: []
    };

    setBoundedMap(
      detailCache,
      cacheKey,
      { value: detail, expiresAt: Date.now() + CACHE_TTL_MS },
      MAX_DETAIL_CACHE
    );
    return c.json(detail);
  } catch {
    return c.json({ error: 'Live metadata service temporarily unavailable' }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
