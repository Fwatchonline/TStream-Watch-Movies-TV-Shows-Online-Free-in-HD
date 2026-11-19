import type { AnimeDetail, AnimeEpisode, AnimeMedia, Genre, MediaItem, Season } from '../types/media';
import {
  fetchAnimeDetail,
  fetchAnimeMovies,
  fetchAnimeSchedule,
  fetchPopularAnime,
  fetchSeasonalAnime,
  fetchTopRatedAnime,
  fetchTrendingAnime,
  fetchUpcomingAnime,
  searchAnimeCatalog,
  type AnimeSearchFilters,
  type AniListPageResult
} from './anilist';

function hashGenreId(name: string): number {
  let h = 5000;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 90000;
  }
  return Math.max(1000, h);
}

export function mapAnimeGenres(genres: string[]): Genre[] {
  return (genres || []).map((g) => ({
    id: hashGenreId(g),
    name: g
  }));
}

export function animeMediaToMediaItem(anime: AnimeMedia): MediaItem {
  return {
    id: anime.anilistId,
    tmdbId: typeof anime.tmdbId === 'number' && anime.tmdbId > 0 ? anime.tmdbId : 0,
    anilistId: anime.anilistId,
    malId: anime.malId,
    title: anime.title || anime.englishTitle || anime.romajiTitle || 'Untitled Anime',
    romajiTitle: anime.romajiTitle,
    nativeTitle: anime.nativeTitle,
    englishTitle: anime.englishTitle,
    overview: anime.description || '',
    posterPath: anime.coverImage || '',
    backdropPath: anime.bannerImage || anime.coverImage || '',
    releaseDate: anime.startDate || (anime.seasonYear ? `${anime.seasonYear}` : ''),
    voteAverage: anime.voteAverage || 0,
    voteCount: anime.averageScore ? Math.max(10, Math.round(anime.popularity / 25)) : 0,
    popularity: anime.popularity || 0,
    genres: mapAnimeGenres(anime.genres),
    mediaType: 'anime',
    mediaFormat: anime.format,
    animeTags: (anime.tags || []).map((t) => t.name),
    studios: (anime.studios || []).map((s) => s.name),
    isAdult: anime.isAdult,
    runtime: anime.durationMinutes,
    numberOfSeasons: anime.format === 'MOVIE' ? 1 : 1,
    numberOfEpisodes: anime.episodesCount
  };
}

export function buildAnimeSeasons(anime: AnimeMedia): Season[] {
  if (anime.format === 'MOVIE') return [];
  const episodeCount = Math.max(
    anime.episodesCount || 0,
    anime.episodes?.length || 0
  );
  if (episodeCount === 0 && (!anime.episodes || anime.episodes.length === 0)) {
    return [];
  }

  const mappedEpisodes = (anime.episodes || []).map((ep) => ({
    id: Number(String(ep.id).replace(/\D/g, '').slice(-8)) || ep.episodeNumber,
    episodeNumber: ep.episodeNumber,
    seasonNumber: 1,
    name: ep.title || `Episode ${ep.episodeNumber}`,
    overview: ep.overview || '',
    stillPath: ep.thumbnail || null,
    airDate: ep.airDate || '',
    voteAverage: 0,
    runtime: ep.durationMinutes || anime.durationMinutes
  }));

  return [
    {
      id: anime.anilistId * 100 + 1,
      seasonNumber: 1,
      name: anime.season && anime.seasonYear ? `${anime.season} ${anime.seasonYear}` : 'Episodes',
      episodeCount,
      airDate: anime.startDate || '',
      episodes: mappedEpisodes
    }
  ];
}

export function animeMediaToDetail(anime: AnimeMedia): AnimeDetail {
  const base = animeMediaToMediaItem(anime);
  const seasons = buildAnimeSeasons(anime);

  const videos =
    anime.trailer && anime.trailer.site.toLowerCase() === 'youtube' && anime.trailer.id
      ? [
          {
            id: `al-trailer-${anime.anilistId}`,
            key: anime.trailer.id,
            name: `${anime.title} Official Trailer`,
            site: 'YouTube',
            type: 'Trailer',
            official: true
          }
        ]
      : [];

  return {
    ...base,
    mediaType: 'anime',
    status: anime.status || 'UNKNOWN',
    seasons,
    episodes: anime.episodes || [],
    characters: anime.characters || [],
    relations: anime.relations || [],
    videos,
    cast: [],
    similar: (anime.relations || [])
      .filter((r) => r.media && !r.media.isAdult)
      .map((r) => animeMediaToMediaItem(r.media)),
    recommendations: (anime.recommendations || []).map(animeMediaToMediaItem),
    anilistData: anime
  };
}

export async function getAnimeDetailById(anilistId: number): Promise<AnimeDetail | null> {
  const anime = await fetchAnimeDetail(anilistId);
  if (!anime) return null;
  return animeMediaToDetail(anime);
}

export type AnimeSectionCategory =
  | 'discover'
  | 'trending'
  | 'popular'
  | 'seasonal'
  | 'upcoming'
  | 'movies'
  | 'top-rated'
  | 'genres';

export async function fetchAnimeCatalogSection(
  category: AnimeSectionCategory,
  filters: AnimeSearchFilters = {}
): Promise<AniListPageResult> {
  const page = filters.page || 1;
  const perPage = filters.perPage || 20;

  const hasCustomFilters = Boolean(
    filters.query?.trim() ||
      filters.genre ||
      filters.tag ||
      filters.year ||
      filters.season ||
      filters.format ||
      filters.status ||
      filters.country ||
      filters.minScore ||
      (filters.sort && filters.sort !== 'popularity' && filters.sort !== 'trending')
  );

  if (hasCustomFilters || category === 'genres') {
    return searchAnimeCatalog({
      ...filters,
      format: category === 'movies' && !filters.format ? 'MOVIE' : filters.format
    });
  }

  switch (category) {
    case 'trending':
      return fetchTrendingAnime(page, perPage);
    case 'popular':
      return fetchPopularAnime(page, perPage);
    case 'seasonal':
      return fetchSeasonalAnime(page, perPage);
    case 'upcoming':
      return fetchUpcomingAnime(page, perPage);
    case 'movies':
      return fetchAnimeMovies(page, perPage);
    case 'top-rated':
      return fetchTopRatedAnime(page, perPage);
    case 'discover':
    default:
      return fetchTrendingAnime(page, perPage);
  }
}

export function formatAnimeEpisodeRange(episodes: AnimeEpisode[], totalCount?: number): AnimeEpisode[] {
  const byNumber = new Map<number, AnimeEpisode>();
  for (const ep of episodes) {
    if (ep.episodeNumber > 0) {
      byNumber.set(ep.episodeNumber, ep);
    }
  }
  const targetMax = Math.max(
    totalCount || 0,
    episodes.reduce((max, e) => Math.max(max, e.episodeNumber), 0)
  );
  if (targetMax <= 0) {
    return Array.from(byNumber.values()).sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  const out: AnimeEpisode[] = [];
  const cap = Math.min(targetMax, 2500);
  for (let n = 1; n <= cap; n++) {
    const existing = byNumber.get(n);
    if (existing) {
      out.push(existing);
    } else {
      out.push({
        id: `ep-${n}`,
        episodeNumber: n,
        title: `Episode ${n}`
      });
    }
  }
  return out;
}

export { fetchAnimeSchedule };
