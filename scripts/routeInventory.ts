/**
 * Single Authoritative Route Inventory for TStream.online
 * Shared cleanly across prerender.ts, generate-sitemaps.ts, and verify-production.ts
 * so reported routes, disk HTML files, sitemap URLs, and verification targets never drift.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DETAILED_MOVIES,
  DETAILED_TV_SHOWS,
  EXPANDED_CATALOG,
  POPULAR_TAGS
} from '../src/services/catalogData.ts';
import { getDiscoveredCollections } from '../src/services/collectionStore.ts';
import { PLATFORM_CONFIGS, type PlatformMeta } from '../src/services/platformConfig.ts';
import { GENRE_LANDINGS, type GenreLandingMeta } from '../src/utils/genres.ts';
import { createMediaSlug } from '../src/utils/slug.ts';
import { tagToSlug, slugToTag } from '../src/utils/tags.ts';
import { validateVerifiedEpisodeRecord, PRIMARY_ORIGIN } from '../src/utils/seo.ts';
import {
  getAllCatalogMedia,
  getMatchingCatalogForTag,
  getMatchingCatalogForLetter,
  fetchServerPlatformMedia,
  fetchServerGenreMedia,
  getServerTmdbApiKey
} from './seoHtmlPlugin.ts';
import {
  discoverTmdbCatalog,
  isValidMediaCandidate,
  type TmdbDiscoveryOptions,
  type TmdbDiscoveryStats
} from './tmdbDiscovery.ts';

export interface MovieInventoryEntry {
  id: number;
  title: string;
  slug: string;
  detailPath: string;
  watchPath: string;
  canonicalUrl: string;
  media: any;
  source?: 'curated' | 'tmdb';
}

export interface TvInventoryEntry {
  id: number;
  title: string;
  slug: string;
  detailPath: string;
  canonicalUrl: string;
  media: any;
  source?: 'curated' | 'tmdb';
}

export interface EpisodeInventoryEntry {
  showId: number;
  showTitle: string;
  showSlug: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  urlPath: string;
  outputFileRel: string;
  canonicalUrl: string;
  show: any;
  source?: 'curated' | 'tmdb';
}

export interface TagInventoryEntry {
  tagName: string;
  tagSlug: string;
  tagQuery: string;
  urlPath: string;
  outputFileRel: string;
  canonicalUrl: string;
  matchCount: number;
}

export interface GenreInventoryEntry {
  genre: GenreLandingMeta;
  urlPath: string;
  outputFileRel: string;
  canonicalUrl: string;
  indexable: boolean;
  matchCount: number;
}

export interface PlatformInventoryEntry {
  platform: PlatformMeta;
  urlPath: string;
  outputFileRel: string;
  canonicalUrl: string;
  indexable: boolean;
}

export interface AzInventoryEntry {
  letter: string;
  urlPath: string;
  outputFileRel: string;
  canonicalUrl: string;
}

export interface AuthoritativeInventoryResult {
  movies: MovieInventoryEntry[];
  tvShows: TvInventoryEntry[];
  episodes: EpisodeInventoryEntry[];
  tags: TagInventoryEntry[];
  genres: GenreInventoryEntry[];
  platforms: PlatformInventoryEntry[];
  az: AzInventoryEntry[];
  hubs: ReturnType<typeof getHubInventory>;
  discoveryStats: TmdbDiscoveryStats;
}

function isValidInventoryMovie(id: number, m: any): boolean {
  if (!Number.isInteger(id) || id <= 0) return false;
  const rawTitle = (m?.title || '').trim();
  if (!rawTitle) return false;
  const lower = rawTitle.toLowerCase();
  if (lower === 'undefined' || lower === 'null' || lower === 'nan' || lower === 'untitled') {
    return false;
  }
  // Preserve legitimate unrelated ID 28, strictly reject bogus Homecoming mapping != 315635
  if (lower.includes('homecoming') && id !== 315635) {
    if (lower.includes('spider-man') || id === 28) {
      return false;
    }
  }
  return true;
}

function buildMovieEntry(m: any, source: 'curated' | 'tmdb' = 'curated'): MovieInventoryEntry {
  const slug = createMediaSlug(m.title, m.id);
  return {
    id: m.id,
    title: m.title,
    slug,
    detailPath: `/movie/${slug}`,
    watchPath: `/watch/movie/${slug}`,
    canonicalUrl: `${PRIMARY_ORIGIN}/movie/${slug}`,
    media: m,
    source
  };
}

function buildTvEntry(s: any, source: 'curated' | 'tmdb' = 'curated'): TvInventoryEntry {
  const title = (s.name || s.title || '').trim();
  const slug = createMediaSlug(title, s.id);
  return {
    id: s.id,
    title,
    slug,
    detailPath: `/tv/${slug}`,
    canonicalUrl: `${PRIMARY_ORIGIN}/tv/${slug}`,
    media: { ...s, mediaType: 'tv', title, name: title },
    source
  };
}

export function getMovieInventory(): MovieInventoryEntry[] {
  const movieMap = new Map<number, any>();

  for (const m of DETAILED_MOVIES) {
    if (m?.id && m.title) {
      movieMap.set(m.id, { ...m, mediaType: 'movie' });
    }
  }

  const collections = getDiscoveredCollections();
  for (const col of collections) {
    for (const part of col.parts || []) {
      const id = Number(part.id || (part as any).tmdbId);
      if (id && part.title && !movieMap.has(id)) {
        movieMap.set(id, { ...part, id, mediaType: 'movie' });
      }
    }
  }

  for (const item of getAllCatalogMedia()) {
    const id = Number(item.id);
    if (item.mediaType !== 'tv' && id && item.title && !movieMap.has(id)) {
      movieMap.set(id, { ...item, id, mediaType: 'movie' });
    }
  }

  // Ensure verified Spider-Man: Homecoming record (315635) exists cleanly if ever omitted
  if (!movieMap.has(315635)) {
    const fallbackHomecoming = EXPANDED_CATALOG.find(i => i.id === 315635);
    movieMap.set(
      315635,
      fallbackHomecoming
        ? { ...fallbackHomecoming, mediaType: 'movie' }
        : {
            id: 315635,
            mediaType: 'movie',
            title: 'Spider-Man: Homecoming',
            releaseDate: '2017-07-05',
            overview:
              'Following the events of Captain America: Civil War, Peter Parker tries to balance his life as an ordinary high school student in Queens with fighting crime as Spider-Man.'
          }
    );
  }

  for (const [id, m] of Array.from(movieMap.entries())) {
    if (!isValidInventoryMovie(id, m)) {
      movieMap.delete(id);
    }
  }

  return Array.from(movieMap.values()).map(m => buildMovieEntry(m, 'curated'));
}

export function getTvInventory(): TvInventoryEntry[] {
  const tvMap = new Map<number, any>();

  for (const s of DETAILED_TV_SHOWS) {
    const title = ((s as any).name || s.title || '').trim();
    if (Number.isInteger(s.id) && s.id > 0 && title) {
      tvMap.set(s.id, { ...s, mediaType: 'tv', title, name: title });
    }
  }

  for (const item of getAllCatalogMedia()) {
    if (item.mediaType === 'tv' && Number.isInteger(item.id) && item.id > 0 && !tvMap.has(item.id)) {
      const title = (item.title || (item as any).name || '').trim();
      if (title) {
        tvMap.set(item.id, { ...item, mediaType: 'tv', title, name: title });
      }
    }
  }

  return Array.from(tvMap.values()).map(s => buildTvEntry(s, 'curated'));
}

/**
 * Returns curated verified, content-rich TV episodes eligible for search engine indexing.
 */
export function getVerifiedEpisodeInventory(): EpisodeInventoryEntry[] {
  const tvShows = getTvInventory();
  const entries: EpisodeInventoryEntry[] = [];
  const seen = new Set<string>();

  for (const showEntry of tvShows) {
    const show = showEntry.media;
    if (!Array.isArray(show.seasons)) continue;

    for (const season of show.seasons) {
      if (!season || !Number.isInteger(season.seasonNumber) || season.seasonNumber < 1) continue;
      if (!Array.isArray(season.episodes)) continue;

      for (const ep of season.episodes) {
        if (!ep || !Number.isInteger(ep.episodeNumber) || ep.episodeNumber < 1) continue;
        const indexable = validateVerifiedEpisodeRecord({
          show,
          season,
          episode: ep
        });
        if (!indexable) continue;

        const urlPath = `/watch/tv/${showEntry.slug}/${season.seasonNumber}/${ep.episodeNumber}`;
        if (seen.has(urlPath)) continue;
        seen.add(urlPath);

        entries.push({
          showId: showEntry.id,
          showTitle: showEntry.title,
          showSlug: showEntry.slug,
          seasonNumber: season.seasonNumber,
          episodeNumber: ep.episodeNumber,
          episodeName: (ep.name || '').trim(),
          urlPath,
          outputFileRel: `watch/tv/${showEntry.slug}/${season.seasonNumber}/${ep.episodeNumber}/index.html`,
          canonicalUrl: `${PRIMARY_ORIGIN}${urlPath}`,
          show,
          source: 'curated'
        });
      }
    }
  }

  return entries;
}

export function getTagInventory(): TagInventoryEntry[] {
  const entries: TagInventoryEntry[] = [];
  const seenSlugs = new Set<string>();

  for (const tag of POPULAR_TAGS) {
    if (!tag?.name) continue;
    const tagSlug = tagToSlug(tag.name);
    const tagQuery = slugToTag(tagSlug);
    if (!tagSlug || !tagQuery || seenSlugs.has(tagSlug)) continue;

    const matches = getMatchingCatalogForTag(tagQuery);
    if (matches.length === 0) continue;

    seenSlugs.add(tagSlug);
    const urlPath = `/tags/${tagSlug}`;
    entries.push({
      tagName: tag.name,
      tagSlug,
      tagQuery,
      urlPath,
      outputFileRel: `tags/${tagSlug}/index.html`,
      canonicalUrl: `${PRIMARY_ORIGIN}${urlPath}`,
      matchCount: matches.length
    });
  }

  return entries;
}

export async function getGenreInventory(
  fetchImpl: typeof fetch = fetch,
  tmdbApiKey: string = getServerTmdbApiKey()
): Promise<GenreInventoryEntry[]> {
  const entries: GenreInventoryEntry[] = [];
  const seen = new Set<string>();

  for (const genre of GENRE_LANDINGS) {
    if (seen.has(genre.slug)) continue;
    seen.add(genre.slug);

    const data = await fetchServerGenreMedia(genre, 1, fetchImpl, tmdbApiKey).catch(() => ({
      items: [],
      totalPages: 1,
      source: 'offline' as const
    }));

    const urlPath = `/genre/${genre.slug}`;
    entries.push({
      genre,
      urlPath,
      outputFileRel: `genre/${genre.slug}/index.html`,
      canonicalUrl: `${PRIMARY_ORIGIN}${urlPath}`,
      indexable: data.items.length > 0,
      matchCount: data.items.length
    });
  }

  return entries;
}

export async function getPlatformInventory(
  fetchImpl: typeof fetch = fetch,
  tmdbApiKey: string = getServerTmdbApiKey()
): Promise<PlatformInventoryEntry[]> {
  const entries: PlatformInventoryEntry[] = [];
  for (const plat of PLATFORM_CONFIGS) {
    const data = await fetchServerPlatformMedia(plat, 1, fetchImpl, tmdbApiKey).catch(() => ({
      items: [],
      totalPages: 1,
      watchRegion: plat.watchRegion || 'US',
      source: 'offline' as const
    }));
    const urlPath = `/platform/${plat.id}`;
    entries.push({
      platform: plat,
      urlPath,
      outputFileRel: `platform/${plat.id}/index.html`,
      canonicalUrl: `${PRIMARY_ORIGIN}${urlPath}`,
      indexable: data.items.length > 0
    });
  }
  return entries;
}

export function getAzInventory(): AzInventoryEntry[] {
  const alphabet = ['0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  const entries: AzInventoryEntry[] = [];
  for (const letter of alphabet) {
    if (getMatchingCatalogForLetter(letter).length > 0) {
      const urlPath = `/az/${letter}`;
      entries.push({
        letter,
        urlPath,
        outputFileRel: `az/${letter}/index.html`,
        canonicalUrl: `${PRIMARY_ORIGIN}${urlPath}`
      });
    }
  }
  return entries;
}

export function getHubInventory(): Array<{
  url: string;
  file: string;
  can: string;
  noindex: boolean;
}> {
  return [
    { url: '/movies', file: 'movies/index.html', can: `${PRIMARY_ORIGIN}/movies`, noindex: false },
    { url: '/tv-shows', file: 'tv-shows/index.html', can: `${PRIMARY_ORIGIN}/tv-shows`, noindex: false },
    { url: '/trending', file: 'trending/index.html', can: `${PRIMARY_ORIGIN}/trending`, noindex: false },
    { url: '/top-rated', file: 'top-rated/index.html', can: `${PRIMARY_ORIGIN}/top-rated`, noindex: false },
    { url: '/collections', file: 'collections/index.html', can: `${PRIMARY_ORIGIN}/collections`, noindex: false },
    { url: '/new-episodes', file: 'new-episodes/index.html', can: `${PRIMARY_ORIGIN}/new-episodes`, noindex: true },
    { url: '/people', file: 'people/index.html', can: `${PRIMARY_ORIGIN}/people`, noindex: true },
    { url: '/random', file: 'random/index.html', can: `${PRIMARY_ORIGIN}/random`, noindex: true },
    { url: '/tags', file: 'tags/index.html', can: `${PRIMARY_ORIGIN}/tags`, noindex: false }
  ];
}

/**
 * Single authoritative async inventory resolver shared across:
 * - `generate-sitemaps.ts` (full curated + paginated TMDB movies, TV shows, verified episodes, main hubs)
 * - `prerender.ts` & `verify-production.ts`
 */
export async function getAuthoritativeRouteInventory(
  options: TmdbDiscoveryOptions = {}
): Promise<AuthoritativeInventoryResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const tmdbApiKey = options.tmdbApiKey !== undefined
    ? options.tmdbApiKey
    : getServerTmdbApiKey();

  const curatedMovies = getMovieInventory();
  const curatedTv = getTvInventory();
  const curatedEpisodes = getVerifiedEpisodeInventory();

  const [genres, platforms, discovery] = await Promise.all([
    getGenreInventory(fetchImpl, tmdbApiKey),
    getPlatformInventory(fetchImpl, tmdbApiKey),
    discoverTmdbCatalog({
      ...options,
      fetchImpl,
      tmdbApiKey,
      seedTvShowIds: [
        ...(options.seedTvShowIds || []),
        ...curatedTv.map(t => t.id)
      ]
    })
  ]);

  // Merge movies strictly by unique TMDB movie ID (never mixing TV IDs)
  const movieMap = new Map<number, MovieInventoryEntry>();
  for (const m of curatedMovies) {
    movieMap.set(m.id, m);
  }
  for (const liveMovie of discovery.movies) {
    if (!movieMap.has(liveMovie.id) && isValidMediaCandidate(liveMovie, 'movie') && isValidInventoryMovie(liveMovie.id, liveMovie)) {
      movieMap.set(liveMovie.id, buildMovieEntry(liveMovie, 'tmdb'));
    }
  }

  // Merge TV shows strictly by unique TMDB TV ID
  const tvMap = new Map<number, TvInventoryEntry>();
  for (const s of curatedTv) {
    tvMap.set(s.id, s);
  }
  for (const liveTv of discovery.tvShows) {
    if (!tvMap.has(liveTv.id) && isValidMediaCandidate(liveTv, 'tv')) {
      tvMap.set(liveTv.id, buildTvEntry(liveTv, 'tmdb'));
    }
  }

  // Merge verified episodes strictly by canonical watch path
  const episodeMap = new Map<string, EpisodeInventoryEntry>();
  for (const ep of curatedEpisodes) {
    episodeMap.set(ep.urlPath, ep);
  }
  for (const liveEp of discovery.episodes) {
    const urlPath = `/watch/tv/${liveEp.showSlug}/${liveEp.seasonNumber}/${liveEp.episodeNumber}`;
    if (!episodeMap.has(urlPath)) {
      episodeMap.set(urlPath, {
        showId: liveEp.showId,
        showTitle: liveEp.showTitle,
        showSlug: liveEp.showSlug,
        seasonNumber: liveEp.seasonNumber,
        episodeNumber: liveEp.episodeNumber,
        episodeName: liveEp.episodeName,
        urlPath,
        outputFileRel: `watch/tv/${liveEp.showSlug}/${liveEp.seasonNumber}/${liveEp.episodeNumber}/index.html`,
        canonicalUrl: `${PRIMARY_ORIGIN}${urlPath}`,
        show: liveEp.show,
        source: 'tmdb'
      });
    }
  }

  return {
    movies: Array.from(movieMap.values()),
    tvShows: Array.from(tvMap.values()),
    episodes: Array.from(episodeMap.values()),
    tags: getTagInventory(),
    genres,
    platforms,
    az: getAzInventory(),
    hubs: getHubInventory(),
    discoveryStats: discovery.stats
  };
}

export const BUILD_INVENTORY_SNAPSHOT_TTL_MS = 15 * 60 * 1000;

export interface BuildInventorySnapshotPayload {
  version: 1;
  cwd: string;
  createdAtMs: number;
  liveEnabled: boolean;
  inventory: AuthoritativeInventoryResult;
}

export function getBuildInventorySnapshotPath(cwd: string = process.cwd()): string {
  const custom = (process.env.TSTREAM_BUILD_INVENTORY_CACHE || '').trim();
  if (custom) {
    return path.resolve(custom);
  }
  const hash = crypto.createHash('sha1').update(path.resolve(cwd)).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), `tstream-build-inventory-${hash}.json`);
}

export function writeBuildInventorySnapshot(
  inventory: AuthoritativeInventoryResult,
  snapshotPath: string = getBuildInventorySnapshotPath(),
  cwd: string = process.cwd()
): void {
  const dir = path.dirname(snapshotPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const payload: BuildInventorySnapshotPayload = {
    version: 1,
    cwd: path.resolve(cwd),
    createdAtMs: Date.now(),
    liveEnabled: Boolean(inventory.discoveryStats?.liveEnabled),
    inventory
  };
  const serialized = JSON.stringify(payload);
  const tmpFile = `${snapshotPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, serialized, 'utf8');
  fs.renameSync(tmpFile, snapshotPath);
}

export function readFreshBuildInventorySnapshot(
  snapshotPath: string = getBuildInventorySnapshotPath(),
  maxAgeMs: number = BUILD_INVENTORY_SNAPSHOT_TTL_MS,
  expectedLiveEnabled?: boolean
): AuthoritativeInventoryResult | null {
  try {
    if (!fs.existsSync(snapshotPath)) return null;
    const raw = fs.readFileSync(snapshotPath, 'utf8');
    const parsed = JSON.parse(raw) as BuildInventorySnapshotPayload;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.inventory ||
      !Array.isArray(parsed.inventory.movies) ||
      !Array.isArray(parsed.inventory.tvShows) ||
      !Array.isArray(parsed.inventory.episodes)
    ) {
      return null;
    }
    const age = Date.now() - Number(parsed.createdAtMs || 0);
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) {
      return null;
    }
    if (expectedLiveEnabled !== undefined && parsed.liveEnabled !== expectedLiveEnabled) {
      return null;
    }
    return parsed.inventory;
  } catch {
    return null;
  }
}
