/**
 * Single Authoritative Route Inventory for TStream.online
 * Shared cleanly across prerender.ts, generate-sitemaps.ts, and verify-production.ts
 * so reported routes, disk HTML files, sitemap URLs, and verification targets never drift.
 */

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
import { PLATFORM_CONFIGS, type PlatformMeta } from '../src/services/platformConfig.ts';
import { GENRE_LANDINGS, type GenreLandingMeta } from '../src/utils/genres.ts';
import { createMediaSlug } from '../src/utils/slug.ts';
import { tagToSlug, slugToTag } from '../src/utils/tags.ts';
import { isEpisodeSeoIndexable, PRIMARY_ORIGIN } from '../src/utils/seo.ts';
import {
  getAllCatalogMedia,
  getMatchingCatalogForTag,
  getMatchingCatalogForLetter,
  fetchServerPlatformMedia,
  fetchServerGenreMedia,
  getServerTmdbApiKey
} from './seoHtmlPlugin.ts';

export interface MovieInventoryEntry {
  id: number;
  title: string;
  slug: string;
  detailPath: string;
  watchPath: string;
  canonicalUrl: string;
  media: any;
}

export interface TvInventoryEntry {
  id: number;
  title: string;
  slug: string;
  detailPath: string;
  canonicalUrl: string;
  media: any;
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

export function getMovieInventory(): MovieInventoryEntry[] {
  const movieMap = new Map<number, any>();

  for (const m of DETAILED_MOVIES) {
    if (m?.id && m.title) {
      movieMap.set(m.id, { ...m, mediaType: 'movie' });
    }
  }

  const collections = [SPIDERMAN_COLLECTION, AVENGERS_COLLECTION, HARRY_POTTER_COLLECTION, PIRATES_COLLECTION];
  for (const col of collections) {
    for (const part of col.parts) {
      const id = part.id || (part as any).tmdbId;
      if (id && part.title && !movieMap.has(id)) {
        movieMap.set(id, { ...part, id, mediaType: 'movie' });
      }
    }
  }

  for (const item of getAllCatalogMedia()) {
    if (item.mediaType !== 'tv' && item.id && item.title && !movieMap.has(item.id)) {
      movieMap.set(item.id, { ...item, mediaType: 'movie' });
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

  // Record-level validation (preserve legitimate unrelated ID 28, reject bogus Homecoming=28)
  for (const [id, m] of Array.from(movieMap.entries())) {
    const rawTitle = (m.title || '').trim();
    if (!Number.isInteger(id) || id <= 0 || !rawTitle) {
      movieMap.delete(id);
      continue;
    }
    if (rawTitle.toLowerCase().includes('homecoming') && id !== 315635) {
      movieMap.delete(id);
    }
  }

  return Array.from(movieMap.values()).map(m => {
    const slug = createMediaSlug(m.title, m.id);
    return {
      id: m.id,
      title: m.title,
      slug,
      detailPath: `/movie/${slug}`,
      watchPath: `/watch/movie/${slug}`,
      canonicalUrl: `${PRIMARY_ORIGIN}/movie/${slug}`,
      media: m
    };
  });
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

  return Array.from(tvMap.values()).map(s => {
    const title = s.name || s.title;
    const slug = createMediaSlug(title, s.id);
    return {
      id: s.id,
      title,
      slug,
      detailPath: `/tv/${slug}`,
      canonicalUrl: `${PRIMARY_ORIGIN}/tv/${slug}`,
      media: s
    };
  });
}

/**
 * Returns ONLY verified, content-rich TV episodes eligible for search engine indexing
 * and inclusion in `sitemap-episodes.xml`.
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
        const indexable = isEpisodeSeoIndexable({
          episodeName: ep.name,
          episodeOverview: ep.overview,
          seriesOverview: show.overview,
          isVerifiedEpisode: true
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
          show
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
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
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
