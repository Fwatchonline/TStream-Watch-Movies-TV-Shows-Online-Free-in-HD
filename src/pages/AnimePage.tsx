import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, Flame, TrendingUp, Calendar, Clock, Film, Star, Search, X, RotateCcw } from 'lucide-react';
import type { AnimeMedia } from '../types/media';
import {
  fetchAnimeGenres,
  fetchAnimeSchedule,
  type AniListPageResult,
  type AniListScheduleItem,
  type AnimeSearchFilters
} from '../services/anilist';
import { fetchAnimeCatalogSection, type AnimeSectionCategory } from '../services/animeCatalog';
import { AnimeCard } from '../components/anime/AnimeCard';
import { AnimeHero } from '../components/anime/AnimeHero';
import { AnimeScheduleSection } from '../components/anime/AnimeScheduleSection';
import { Pagination } from '../components/Pagination';
import { updateSEO } from '../utils/seo';

interface AnimePageProps {
  section?: AnimeSectionCategory;
  initialGenre?: string;
  onNavigateSection: (section: AnimeSectionCategory, genre?: string) => void;
  onSelectAnime: (anime: AnimeMedia) => void;
  onWatchAnime: (anime: AnimeMedia, episode?: number) => void;
}

const SECTION_TABS: Array<{ id: AnimeSectionCategory; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'discover', label: 'Discover', icon: Sparkles },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'popular', label: 'Popular', icon: TrendingUp },
  { id: 'seasonal', label: 'Seasonal', icon: Calendar },
  { id: 'upcoming', label: 'Upcoming', icon: Clock },
  { id: 'movies', label: 'Anime Movies', icon: Film },
  { id: 'top-rated', label: 'Top Rated', icon: Star }
];

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2016, 2014, 2011, 2009, 2006, 2000, 1995];

export const AnimePage: React.FC<AnimePageProps> = ({
  section = 'discover',
  initialGenre,
  onNavigateSection,
  onSelectAnime,
  onWatchAnime
}) => {
  const [genres, setGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [filters, setFilters] = useState<AnimeSearchFilters>(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    return {
      query: params?.get('q') || '',
      genre: initialGenre || params?.get('genre') || undefined,
      tag: params?.get('tag') || undefined,
      year: params?.get('year') ? Number(params.get('year')) : undefined,
      season: (params?.get('season') as any) || undefined,
      format: (params?.get('format') as any) || undefined,
      status: (params?.get('status') as any) || undefined,
      country: (params?.get('country') as any) || undefined,
      minScore: params?.get('minScore') ? Number(params.get('minScore')) : undefined,
      sort: (params?.get('sort') as any) || undefined,
      page: Math.max(1, Number(params?.get('page') || 1) || 1),
      perPage: 20
    };
  });

  const [catalog, setCatalog] = useState<AniListPageResult>({
    page: 1,
    perPage: 20,
    totalPages: 1,
    totalResults: 0,
    hasNextPage: false,
    results: []
  });
  const [popularRow, setPopularRow] = useState<AnimeMedia[]>([]);
  const [schedule, setSchedule] = useState<AniListScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      genre: initialGenre !== undefined ? initialGenre : prev.genre,
      page: 1
    }));
  }, [section, initialGenre]);

  useEffect(() => {
    fetchAnimeGenres().then((g) => {
      setGenres(g.genres);
      setTags(g.tags);
    });
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchAnimeCatalogSection(section, filters);
      setCatalog(res);
      if (section === 'discover' && (filters.page || 1) === 1 && !filters.query && !filters.genre && !filters.tag) {
        const [popRes, schedRes] = await Promise.all([
          fetchAnimeCatalogSection('popular', { page: 1, perPage: 12 }),
          fetchAnimeSchedule(1, 12)
        ]);
        setPopularRow(popRes.results || []);
        setSchedule(schedRes.results || []);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load anime catalog right now.');
    } finally {
      setLoading(false);
    }
  }, [section, filters]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const titleMap: Record<AnimeSectionCategory, string> = {
      discover: 'Watch Anime Online Free HD — Sub & Dub Streaming',
      trending: 'Trending Anime Series Today — Watch Online HD',
      popular: 'Most Popular Anime of All Time — Watch Online Free',
      seasonal: 'Seasonal Anime This Season — New Simulcasts',
      upcoming: 'Upcoming Anime Releases & Schedules',
      movies: 'Anime Movies Free HD — Watch Animated Films Online',
      'top-rated': 'Top Rated Anime Series & Films',
      genres: filters.genre ? `${filters.genre} Anime — Watch Free HD` : 'Browse Anime by Genre'
    };
    const pathMap: Record<AnimeSectionCategory, string> = {
      discover: '/anime',
      trending: '/anime/trending',
      popular: '/anime/popular',
      seasonal: '/anime/seasonal',
      upcoming: '/anime/upcoming',
      movies: '/anime/movies',
      'top-rated': '/anime',
      genres: filters.genre ? `/anime/genres/${filters.genre.toLowerCase().replace(/\s+/g, '-')}` : '/anime/genres'
    };
    const basePath = pathMap[section];
    const hasFilterQuery = Boolean(
      filters.query?.trim() ||
        filters.genre ||
        filters.tag ||
        filters.year ||
        filters.season ||
        filters.format ||
        filters.status ||
        filters.country ||
        filters.minScore
    );
    const currentPage = filters.page || 1;
    const pageSuffix = currentPage > 1 ? ` — Page ${currentPage}` : '';
    const seoUrl = !hasFilterQuery && currentPage > 1 ? `${basePath}?page=${currentPage}` : basePath;
    updateSEO({
      title: `${titleMap[section]}${pageSuffix}`,
      description: 'Stream anime series and anime movies in HD with verified AniList metadata, Japanese original audio, dubs, and subtitles on T Stream.',
      noindex: section === 'genres' ? Boolean(filters.query?.trim() || filters.tag || filters.year) : hasFilterQuery,
      url: seoUrl
    });
  }, [section, filters.genre, filters.page, filters.query, filters.tag, filters.year, filters.season, filters.format, filters.status, filters.country, filters.minScore]);

  const hasFilters = Boolean(
    filters.query?.trim() ||
      filters.genre ||
      filters.tag ||
      filters.year ||
      filters.season ||
      filters.format ||
      filters.status ||
      filters.country ||
      filters.minScore
  );

  const heroAnime =
    section === 'discover' && !hasFilters && (filters.page || 1) === 1 ? catalog.results[0] : undefined;

  return (
    <div className="max-w-[1520px] mx-auto px-3 sm:px-5 lg:px-6 py-6 pb-24 space-y-6">
      {/* Header & Section Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-[#F5C400] mb-1">
            AniList · First-Class Anime Catalog
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {filters.genre ? `${filters.genre} Anime` : section === 'movies' ? 'Anime Movies' : 'Explore Anime'}
          </h1>
          <p className="text-xs sm:text-sm text-[#A6A6AC] mt-1">
            Stream seasonal simulcasts, classic series, and anime films with real episode guides and skip timings.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {SECTION_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigateSection(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer border transition-colors ${
                  active
                    ? 'bg-[#F5C400] text-black border-[#F5C400]'
                    : 'bg-[#1b1b20] text-[#A6A6AC] hover:text-white border-[#34343c]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Featured Anime Hero on Discover */}
      {heroAnime && (
        <AnimeHero
          anime={heroAnime}
          onSelect={onSelectAnime}
          onWatch={(a) => onWatchAnime(a, 1)}
        />
      )}

      {/* Search & Combined Filter Strip */}
      <div className="bg-[#1b1b20] border border-[#34343c] rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.query || ''}
              onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value, page: 1 }))}
              placeholder="Search anime title..."
              className="w-full h-9 pl-9 pr-8 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white placeholder-[#6e6e78] focus:outline-none focus:border-[#F5C400]"
            />
            {filters.query && (
              <button
                type="button"
                onClick={() => setFilters((p) => ({ ...p, query: '', page: 1 }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            aria-label="Anime Genre"
            value={filters.genre || ''}
            onChange={(e) => setFilters((p) => ({ ...p, genre: e.target.value || undefined, page: 1 }))}
            className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
          >
            <option value="">All Genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            aria-label="Anime Tag"
            value={filters.tag || ''}
            onChange={(e) => setFilters((p) => ({ ...p, tag: e.target.value || undefined, page: 1 }))}
            className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
          >
            <option value="">All Themes / Tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            aria-label="Sort Order"
            value={filters.sort || 'popularity'}
            onChange={(e) => setFilters((p) => ({ ...p, sort: (e.target.value as any) || undefined, page: 1 }))}
            className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
          >
            <option value="popularity">Most Popular</option>
            <option value="trending">Trending Now</option>
            <option value="score">Highest Rated</option>
            <option value="newest">Newest Releases</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <select
            aria-label="Release Year"
            value={filters.year || ''}
            onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
            className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
          >
            <option value="">Any Year</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            aria-label="Season"
            value={filters.season || ''}
            onChange={(e) => setFilters((p) => ({ ...p, season: (e.target.value as any) || undefined, page: 1 }))}
            className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
          >
            <option value="">Any Season</option>
            <option value="WINTER">Winter</option>
            <option value="SPRING">Spring</option>
            <option value="SUMMER">Summer</option>
            <option value="FALL">Fall</option>
          </select>

          <select
            aria-label="Format"
            value={filters.format || ''}
            onChange={(e) => setFilters((p) => ({ ...p, format: (e.target.value as any) || undefined, page: 1 }))}
            className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
          >
            <option value="">All Formats</option>
            <option value="TV">TV Series</option>
            <option value="MOVIE">Movie</option>
            <option value="OVA">OVA</option>
            <option value="ONA">ONA</option>
            <option value="SPECIAL">Special</option>
            <option value="TV_SHORT">TV Short</option>
          </select>

          <select
            aria-label="Airing Status"
            value={filters.status || ''}
            onChange={(e) => setFilters((p) => ({ ...p, status: (e.target.value as any) || undefined, page: 1 }))}
            className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
          >
            <option value="">Any Status</option>
            <option value="RELEASING">Currently Airing</option>
            <option value="FINISHED">Finished Airing</option>
            <option value="NOT_YET_RELEASED">Upcoming</option>
          </select>

          <select
            aria-label="Country of Origin"
            value={filters.country || ''}
            onChange={(e) => setFilters((p) => ({ ...p, country: (e.target.value as any) || undefined, page: 1 }))}
            className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
          >
            <option value="">All Origins</option>
            <option value="JP">Japan</option>
            <option value="KR">South Korea</option>
            <option value="CN">China</option>
          </select>

          <div className="flex items-center gap-2">
            <select
              aria-label="Minimum Score"
              value={filters.minScore || ''}
              onChange={(e) => setFilters((p) => ({ ...p, minScore: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
              className="h-9 px-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer flex-1"
            >
              <option value="">Any Score</option>
              <option value="7.0">★ 7.0+</option>
              <option value="7.5">★ 7.5+</option>
              <option value="8.0">★ 8.0+</option>
              <option value="8.5">★ 8.5+</option>
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={() => setFilters({ page: 1, perPage: 20 })}
                title="Reset Anime Filters"
                className="h-9 px-2.5 rounded-lg bg-[#25252d] hover:bg-[#32323d] text-[#F5C400] border border-[#34343c] cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Anime Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-[#29292D] border border-[#3A3A40] animate-pulse" />
          ))}
        </div>
      ) : errorMsg ? (
        <div className="p-8 rounded-2xl bg-[#1b1b20] border border-[#34343c] text-center space-y-3">
          <p className="text-sm text-[#A6A6AC]">{errorMsg}</p>
          <button
            type="button"
            onClick={loadCatalog}
            className="px-4 py-2 rounded-lg bg-[#F5C400] text-black text-xs font-bold cursor-pointer"
          >
            Retry AniList
          </button>
        </div>
      ) : catalog.results.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[#1b1b20] border border-[#34343c] text-center space-y-3">
          <h3 className="text-base font-bold text-white">No anime titles matched your filters</h3>
          <p className="text-xs text-[#A6A6AC]">Try clearing one or more filters or switching categories.</p>
          <button
            type="button"
            onClick={() => setFilters({ page: 1, perPage: 20 })}
            className="px-4 py-2 rounded-lg bg-[#F5C400] text-black text-xs font-bold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {catalog.results.map((anime) => (
              <AnimeCard
                key={anime.anilistId}
                anime={anime}
                onSelect={onSelectAnime}
                onWatch={onWatchAnime}
              />
            ))}
          </div>

          <Pagination
            currentPage={catalog.page}
            totalPages={Math.min(catalog.totalPages, 200)}
            onPageChange={(page) => {
              setFilters((p) => ({ ...p, page }));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      {/* Discover-only Airing Schedule & Popular Spotlight */}
      {section === 'discover' && !hasFilters && schedule.length > 0 && (
        <AnimeScheduleSection
          items={schedule}
          onSelect={onSelectAnime}
          onWatch={onWatchAnime}
        />
      )}

      {section === 'discover' && !hasFilters && popularRow.length > 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              All-Time Popular Anime
            </h2>
            <button
              type="button"
              onClick={() => onNavigateSection('popular')}
              className="text-xs font-semibold text-[#F5C400] hover:underline cursor-pointer"
            >
              View All Popular
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {popularRow.slice(0, 12).map((anime) => (
              <AnimeCard
                key={`pop-${anime.anilistId}`}
                anime={anime}
                onSelect={onSelectAnime}
                onWatch={onWatchAnime}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
