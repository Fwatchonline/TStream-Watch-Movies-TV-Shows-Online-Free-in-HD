export type MediaType = 'movie' | 'tv' | 'anime';

export type AnimeFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC';

export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logoPath: string | null;
  originCountry: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

export interface VideoItem {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface Keyword {
  id: number;
  name: string;
}

export interface Episode {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate: string;
  voteAverage: number;
  runtime?: number;
}

export interface Season {
  id: number;
  seasonNumber: number;
  name: string;
  overview?: string;
  posterPath?: string | null;
  airDate?: string;
  episodeCount: number;
  episodes?: Episode[];
}

export interface CollectionSummary {
  id: number;
  name: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview?: string;
  parts: MediaItem[];
}

export interface DiscoveredCollection extends CollectionSummary {
  filmCountBadge: string;
  autoDiscovered?: boolean;
  discoveredAt?: string;
  sourceMovieTitle?: string;
}

export interface MediaItem {
  id: number;
  tmdbId: number;
  anilistId?: number;
  malId?: number;
  imdbId?: string;
  title: string;
  romajiTitle?: string;
  nativeTitle?: string;
  englishTitle?: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genres: Genre[];
  mediaType: MediaType;
  mediaFormat?: AnimeFormat | string;
  animeTags?: string[];
  studios?: string[];
  certification?: string;
  isAdult?: boolean;
  runtime?: number; // in minutes for movies / episode duration
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  tagline?: string;
  keywords?: Keyword[];
  director?: string;
  writer?: string;
  matchPercentage?: number;
  topTen?: boolean;
  viewsCount?: number;
  platformIds?: string[];
}

export interface MovieDetail extends MediaItem {
  mediaType: 'movie';
  budget?: number;
  revenue?: number;
  budgetFormatted?: string;
  revenueFormatted?: string;
  status: string;
  productionCompanies: ProductionCompany[];
  productionCountries: string[];
  spokenLanguages: string[];
  belongsToCollection?: CollectionSummary | null;
  videos: VideoItem[];
  cast: CastMember[];
  similar: MediaItem[];
  recommendations: MediaItem[];
}

export interface TVDetail extends MediaItem {
  mediaType: 'tv';
  status: string;
  productionCompanies: ProductionCompany[];
  productionCountries: string[];
  spokenLanguages: string[];
  seasons: Season[];
  videos: VideoItem[];
  cast: CastMember[];
  similar: MediaItem[];
  recommendations: MediaItem[];
}

export interface AnimeEpisode {
  id: string;
  episodeNumber: number;
  title: string;
  overview?: string;
  airDate?: string;
  thumbnail?: string;
  durationMinutes?: number;
  isFiller?: boolean;
}

export interface AnimeRelation {
  relationType: string;
  media: AnimeMedia;
}

export interface AnimeCharacter {
  id: number;
  name: string;
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND' | string;
  image: string | null;
  voiceActor?: {
    id: number;
    name: string;
    language: string;
    image: string | null;
  };
}

export interface AnimeMedia {
  anilistId: number;
  malId?: number;
  tmdbId?: number;
  mediaType: 'anime';
  format: AnimeFormat | string;
  status: string;
  title: string;
  englishTitle?: string;
  romajiTitle?: string;
  nativeTitle?: string;
  synonyms?: string[];
  description: string;
  coverImage: string;
  bannerImage: string;
  episodesCount?: number;
  durationMinutes?: number;
  season?: string;
  seasonYear?: number;
  startDate?: string;
  endDate?: string;
  averageScore?: number; // 0-100
  voteAverage: number; // 0-10 normalized
  popularity: number;
  genres: string[];
  tags: Array<{ name: string; rank?: number; isMediaSpoiler?: boolean }>;
  studios: Array<{ id: number; name: string; isAnimationStudio?: boolean }>;
  trailer?: { id: string; site: string; thumbnail?: string } | null;
  nextAiringEpisode?: {
    airingAt: number;
    timeUntilAiring: number;
    episode: number;
  } | null;
  isAdult?: boolean;
  episodes: AnimeEpisode[];
  characters: AnimeCharacter[];
  relations: AnimeRelation[];
  recommendations: AnimeMedia[];
}

export interface AnimeDetail extends MediaItem {
  mediaType: 'anime';
  status: string;
  productionCompanies?: ProductionCompany[];
  productionCountries?: string[];
  spokenLanguages?: string[];
  seasons?: Season[];
  episodes?: AnimeEpisode[];
  characters?: AnimeCharacter[];
  relations?: AnimeRelation[];
  videos?: VideoItem[];
  cast?: CastMember[];
  similar: MediaItem[];
  recommendations: MediaItem[];
  anilistData?: AnimeMedia;
}

export type MediaDetail = MovieDetail | TVDetail | AnimeDetail;

export interface SubtitleTrack {
  id: string;
  language: string;
  languageCode: string; // ISO 639-1 (e.g. sr, hr, bs, en)
  label: string;
  format: 'srt' | 'vtt';
  url: string;
  source?: 'vdrk_v1' | 'vdrk_v2' | 'opensubtitles_v3' | 'custom' | string;
}

export interface ContinueWatchingItem {
  id: number;
  mediaKey?: string;
  seriesKey?: string;
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  mediaType: MediaType;
  mediaFormat?: string;
  title: string;
  posterPath: string;
  backdropPath: string;
  progressSeconds: number;
  durationSeconds: number;
  percentage: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  completed?: boolean;
  lastWatched: string;
}

export interface WatchlistItem {
  id: number;
  mediaKey?: string;
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  mediaType: MediaType;
  mediaFormat?: string;
  title: string;
  posterPath: string;
  backdropPath: string;
  releaseDate: string;
  voteAverage: number;
  genres?: string[];
  addedAt: string;
}

export interface HistoryItem {
  id: number;
  mediaKey?: string;
  seriesKey?: string;
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  mediaType: MediaType;
  mediaFormat?: string;
  title: string;
  posterPath: string;
  backdropPath?: string;
  watchedAt: string;
  updatedAt?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  progressSeconds?: number;
  durationSeconds?: number;
  percentage?: number;
  completed?: boolean;
  completedAt?: string;
  device?: string;
  serverId?: string;
  audioLang?: string;
  genres?: string[];
}

export interface WatchHistoryRecord {
  userId?: string;
  mediaKey: string;
  seriesKey: string;
  mediaType: MediaType;
  tmdbId?: string;
  anilistId?: number;
  malId?: number;
  mediaFormat?: string;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  progressSeconds: number;
  durationSeconds: number;
  percentage: number;
  completed: boolean;
  completedAt?: string;
  lastWatchedAt: string;
  updatedAt: string;
  device?: string;
  serverId?: string;
  audioLang?: string;
  genres?: string[];
}

export interface CompletedMediaRecord {
  userId?: string;
  mediaKey: string;
  mediaType: MediaType;
  tmdbId?: string;
  anilistId?: number;
  malId?: number;
  title: string;
  posterPath?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  completedAt: string;
  updatedAt: string;
}

export interface FilterOptions {
  query?: string;
  genreId?: number;
  mediaType?: MediaType | 'all';
  sortBy?: 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc' | 'title.asc';
  minRating?: number;
  year?: number;
  tagId?: number;
  platform?: string;
  watchRegion?: string;
  letter?: string;
  country?: string;
  language?: string;
  page?: number;
}

export interface PaginatedResponse<T> {
  page: number;
  results: T[];
  totalPages: number;
  totalResults: number;
}

export interface StreamServer {
  id: string;
  name: string;
  badge?: string;
  quality?: string;
  category?: 'vyla' | 'featured' | 'backup';
  description?: string;
  buildUrl: (params: { mediaType: MediaType; tmdbId: number; imdbId?: string; season?: number; episode?: number }) => string;
}
