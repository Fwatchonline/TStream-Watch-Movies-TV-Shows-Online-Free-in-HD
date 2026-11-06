export type MediaType = 'movie' | 'tv';

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
  overview: string;
  posterPath: string | null;
  airDate: string;
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
  imdbId?: string;
  title: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  releaseDate: string;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  genres: Genre[];
  mediaType: MediaType;
  certification?: string;
  runtime?: number; // in minutes for movies
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  tagline?: string;
  keywords?: Keyword[];
  director?: string;
  writer?: string;
  matchPercentage?: number;
  topTen?: boolean;
  viewsCount?: number;
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

export type MediaDetail = MovieDetail | TVDetail;

export interface SubtitleTrack {
  id: string;
  language: string;
  languageCode: string; // ISO 639-1 (e.g. sr, hr, bs, en)
  label: string;
  format: 'srt' | 'vtt';
  url: string;
  source?: 'vdrk_v1' | 'vdrk_v2' | 'opensubtitles_v3' | string;
}

export interface ContinueWatchingItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string;
  backdropPath: string;
  progressSeconds: number;
  durationSeconds: number;
  percentage: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  lastWatched: string;
}

export interface WatchlistItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string;
  backdropPath: string;
  releaseDate: string;
  voteAverage: number;
  addedAt: string;
}

export interface HistoryItem {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string;
  watchedAt: string;
  seasonNumber?: number;
  episodeNumber?: number;
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
  letter?: string;
  country?: string;
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
