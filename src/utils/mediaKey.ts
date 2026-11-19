import { MediaType } from '../types/media';

export interface MediaKeyInput {
  mediaType: MediaType;
  tmdbId?: string | number;
  anilistId?: string | number;
  id?: string | number;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface ParsedMediaKey {
  mediaType: MediaType;
  primaryId: string;
  seasonNumber?: number;
  episodeNumber?: number;
  isEpisodeLevel: boolean;
  seriesKey: string;
}

function sanitizeIdPart(raw: string | number | undefined): string {
  const clean = String(raw ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return clean || '0';
}

/**
 * Resolve primary provider-isolated identifier for key generation.
 * Never conflates AniList IDs with TMDB IDs.
 */
export function resolvePrimaryId(input: MediaKeyInput): string {
  if (input.mediaType === 'anime') {
    if (input.anilistId !== undefined && input.anilistId !== null && Number(input.anilistId) > 0) {
      return sanitizeIdPart(input.anilistId);
    }
    if (input.id !== undefined && input.id !== null && Number(input.id) > 0) {
      return sanitizeIdPart(input.id);
    }
    return sanitizeIdPart(input.tmdbId);
  }
  if (input.tmdbId !== undefined && input.tmdbId !== null && String(input.tmdbId).trim() !== '') {
    return sanitizeIdPart(input.tmdbId);
  }
  return sanitizeIdPart(input.id);
}

/**
 * Deterministic series/movie-level key (e.g. movie_550, tv_1396, anime_16498).
 * Valid against firestore.rules `isValidId` regex `^[a-zA-Z0-9_-]+$`.
 */
export function buildSeriesKey(input: MediaKeyInput): string {
  const pid = resolvePrimaryId(input);
  return `${input.mediaType}_${pid}`;
}

/**
 * Deterministic episode/item-level key for Watch History:
 * - Movie: movie_550
 * - TV episode: tv_1396_s1_e1
 * - Anime episode: anime_16498_ep_1
 * - Series without episode info: tv_1396 / anime_16498
 */
export function buildMediaKey(input: MediaKeyInput): string {
  const pid = resolvePrimaryId(input);

  if (input.mediaType === 'tv') {
    if (
      typeof input.seasonNumber === 'number' &&
      Number.isFinite(input.seasonNumber) &&
      input.seasonNumber >= 0 &&
      typeof input.episodeNumber === 'number' &&
      Number.isFinite(input.episodeNumber) &&
      input.episodeNumber >= 1
    ) {
      return `tv_${pid}_s${Math.floor(input.seasonNumber)}_e${Math.floor(input.episodeNumber)}`;
    }
    return `tv_${pid}`;
  }

  if (input.mediaType === 'anime') {
    if (
      typeof input.episodeNumber === 'number' &&
      Number.isFinite(input.episodeNumber) &&
      input.episodeNumber >= 1
    ) {
      return `anime_${pid}_ep_${Math.floor(input.episodeNumber)}`;
    }
    return `anime_${pid}`;
  }

  return `movie_${pid}`;
}

/**
 * Parse a deterministic mediaKey back to structured coordinates.
 */
export function parseMediaKey(mediaKey: string): ParsedMediaKey | null {
  const raw = String(mediaKey || '').trim();
  const tvEpMatch = raw.match(/^tv_([a-zA-Z0-9_-]+)_s(\d+)_e(\d+)$/);
  if (tvEpMatch) {
    return {
      mediaType: 'tv',
      primaryId: tvEpMatch[1],
      seasonNumber: parseInt(tvEpMatch[2], 10),
      episodeNumber: parseInt(tvEpMatch[3], 10),
      isEpisodeLevel: true,
      seriesKey: `tv_${tvEpMatch[1]}`
    };
  }

  const animeEpMatch = raw.match(/^anime_([a-zA-Z0-9_-]+)_ep_(\d+)$/);
  if (animeEpMatch) {
    return {
      mediaType: 'anime',
      primaryId: animeEpMatch[1],
      episodeNumber: parseInt(animeEpMatch[2], 10),
      isEpisodeLevel: true,
      seriesKey: `anime_${animeEpMatch[1]}`
    };
  }

  const baseMatch = raw.match(/^(movie|tv|anime)_([a-zA-Z0-9_-]+)$/);
  if (baseMatch) {
    return {
      mediaType: baseMatch[1] as MediaType,
      primaryId: baseMatch[2],
      isEpisodeLevel: false,
      seriesKey: `${baseMatch[1]}_${baseMatch[2]}`
    };
  }

  return null;
}

export function isCompletionReached(progressSeconds: number, durationSeconds: number, explicitCompleted?: boolean): boolean {
  if (explicitCompleted) return true;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
  const pct = (Math.max(0, progressSeconds) / durationSeconds) * 100;
  return pct >= 90;
}
