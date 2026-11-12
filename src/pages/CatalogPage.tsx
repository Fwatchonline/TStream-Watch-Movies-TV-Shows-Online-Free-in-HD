import React, { useState, useEffect, useCallback } from 'react';
import { Film, Tv, Flame, Search as SearchIcon, Clapperboard, Sparkles, Star } from 'lucide-react';
import { MediaItem, FilterOptions, PaginatedResponse, MediaType } from '../types/media';
import { fetchCatalog } from '../services/tmdb';
import { MediaCard } from '../components/MediaCard';
import { FilterBar } from '../components/FilterBar';
import { Pagination } from '../components/Pagination';
import { PLATFORMS_LIST, getPlatformById } from '../services/platformData';
import { updateSEO } from '../utils/seo';

interface CatalogPageProps {
  category: 'movies' | 'tv-shows' | 'trending' | 'search' | 'platform' | 'az' | 'top-rated';
  initialQuery?: string;
  initialPlatform?: string;
  initialLetter?: string;
  initialGenreId?: number;
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem) => void;
  onSelectPlatform?: (platformId: string) => void;
}

const ALPHABET = ['All', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

export const CatalogPage: React.FC<CatalogPageProps> = ({
  category,
  initialQuery = '',
  initialPlatform,
  initialLetter,
  initialGenreId,
  onSelectMedia,
  onWatchMedia,
  onSelectPlatform
}) => {
  // Helper to parse query parameters from window.location.search
  const getInitialParams = (): FilterOptions => {
    const params = new URLSearchParams(window.location.search);
    const parsedPage = parseInt(params.get('page') || '1', 10);
    const parsedGenre = params.get('genreId') ? parseInt(params.get('genreId')!, 10) : initialGenreId;
    const parsedYear = params.get('year') ? parseInt(params.get('year')!, 10) : undefined;
    const parsedMinRating = params.get('minRating') ? parseFloat(params.get('minRating')!) : undefined;
    const defaultSort = category === 'top-rated' ? 'vote_average.desc' : 'popularity.desc';
    const parsedSort = params.get('sortBy') as FilterOptions['sortBy'] || defaultSort;
    const parsedQuery = params.get('q') || initialQuery || '';
    const parsedPlatform = params.get('platform') || initialPlatform || (category === 'platform' ? 'netflix' : undefined);
    const parsedLetter = params.get('letter') || initialLetter || (category === 'az' ? 'A' : undefined);
    const parsedCountry = params.get('country') || undefined;

    let mediaType: MediaType | 'all' = 'all';
    if (params.get('mediaType')) {
      mediaType = params.get('mediaType') as any;
    } else if (category === 'movies') {
      mediaType = 'movie';
    } else if (category === 'tv-shows') {
      mediaType = 'tv';
    }

    return {
      page: isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage,
      genreId: parsedGenre,
      year: parsedYear,
      minRating: parsedMinRating,
      sortBy: parsedSort,
      query: parsedQuery,
      platform: parsedPlatform,
      letter: parsedLetter,
      country: parsedCountry,
      mediaType
    };
  };

  const [filters, setFilters] = useState<FilterOptions>(getInitialParams);
  const [data, setData] = useState<PaginatedResponse<MediaItem>>({
    page: 1,
    totalPages: 1,
    totalResults: 0,
    results: []
  });
  const [loading, setLoading] = useState(true);

  // Sync state to URL without reloading the page
  const updateUrl = useCallback((newFilters: FilterOptions) => {
    const params = new URLSearchParams();
    if (newFilters.page && newFilters.page > 1) {
      params.set('page', newFilters.page.toString());
    }
    if (newFilters.query && newFilters.query.trim()) {
      params.set('q', newFilters.query.trim());
    }
    if (newFilters.genreId) {
      params.set('genreId', newFilters.genreId.toString());
    }
    if (newFilters.year) {
      params.set('year', newFilters.year.toString());
    }
    if (newFilters.minRating) {
      params.set('minRating', newFilters.minRating.toString());
    }
    if (newFilters.sortBy && newFilters.sortBy !== 'popularity.desc') {
      params.set('sortBy', newFilters.sortBy);
    }
    if (newFilters.mediaType && newFilters.mediaType !== 'all') {
      params.set('mediaType', newFilters.mediaType);
    }
    if (newFilters.platform) {
      params.set('platform', newFilters.platform);
    }
    if (newFilters.letter && newFilters.letter !== 'All') {
      params.set('letter', newFilters.letter);
    }
    if (newFilters.country) {
      params.set('country', newFilters.country);
    }

    const queryStr = params.toString();
    const newUrl = queryStr ? `${window.location.pathname}?${queryStr}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
    return newUrl;
  }, []);

  // Sync initialGenreId prop if passed
  useEffect(() => {
    if (initialGenreId !== undefined) {
      setFilters(prev => ({ ...prev, genreId: initialGenreId, page: 1 }));
    }
  }, [initialGenreId]);

  // Fetch items based on active filters and page
  const loadData = useCallback(async () => {
    setLoading(true);
    const targetType: MediaType | 'all' = filters.mediaType || (category === 'movies' ? 'movie' : category === 'tv-shows' ? 'tv' : 'all');

    const catParam = (category === 'platform' || filters.platform)
      ? 'platform'
      : (category === 'az' || (filters.letter && filters.letter !== 'All'))
      ? 'az'
      : category === 'top-rated'
      ? 'top-movies'
      : targetType === 'tv'
      ? 'popular-tv'
      : targetType === 'movie'
      ? 'popular-movies'
      : category === 'trending'
      ? 'trending'
      : 'movies';

    const result = await fetchCatalog(catParam, filters.page || 1, {
      ...filters,
      mediaType: targetType
    });

    setData(result);
    setLoading(false);
  }, [category, filters]);

  useEffect(() => {
    loadData();
    const updatedPath = updateUrl(filters);
    const pageSuffix = filters.page && filters.page > 1 ? ` — Page ${filters.page}` : '';
    if (category === 'search') {
      updateSEO({
        title: filters.query ? `Search: "${filters.query}"` : 'Search Movies & TV Shows',
        noindex: true,
        url: '/search'
      });
    } else if (category === 'movies') {
      updateSEO({
        title: `Popular & Latest Movies Free HD${pageSuffix}`,
        description: 'Browse and watch thousands of blockbuster movies online in HD 1080p and 4K on T Stream.',
        url: updatedPath
      });
    } else if (category === 'tv-shows') {
      updateSEO({
        title: `TV Shows & Full Episodes Free${pageSuffix}`,
        description: 'Stream full seasons and episodes of your favorite TV series and dramas on T Stream.',
        url: updatedPath
      });
    } else if (category === 'trending') {
      updateSEO({
        title: `Trending Movies & TV Shows Today${pageSuffix}`,
        description: 'Discover the hottest and most popular movies and series streaming right now on T Stream.',
        url: updatedPath
      });
    } else if (category === 'top-rated') {
      updateSEO({
        title: `Top Rated Movies & Shows of All Time${pageSuffix}`,
        description: 'Explore the highest critically-acclaimed films and television series on T Stream.',
        url: updatedPath
      });
    }
  }, [loadData, updateUrl, filters, category]);

  // Handle page transitions (Preserves all existing query params and filters!)
  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle filter changes (Resets to page 1)
  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const handleSwitchPlatform = (platformId: string) => {
    const updated: FilterOptions = {
      ...filters,
      platform: platformId,
      page: 1
    };
    setFilters(updated);
    if (onSelectPlatform) onSelectPlatform(platformId);
  };

  const handleSwitchLetter = (letter: string) => {
    const updated: FilterOptions = {
      ...filters,
      letter: letter === 'All' ? undefined : letter,
      page: 1
    };
    setFilters(updated);
  };

  const currentPlatform = (category === 'platform' || filters.platform)
    ? getPlatformById(filters.platform || 'netflix')
    : undefined;

  const isAzMode = category === 'az' || Boolean(filters.letter && filters.letter !== 'All');

  const getPageTitle = () => {
    if (category === 'platform' || currentPlatform) {
      return {
        title: currentPlatform ? `${currentPlatform.name} Productions` : 'Studio Catalog',
        icon: Clapperboard,
        subtitle: currentPlatform
          ? `Movies and series produced and distributed by ${currentPlatform.name}`
          : 'Official studio productions and original releases'
      };
    }

    if (isAzMode) {
      return {
        title: filters.letter && filters.letter !== 'All'
          ? `Titles starting with "${filters.letter}"`
          : 'A-Z Catalog Index',
        icon: Film,
        subtitle: filters.letter && filters.letter !== 'All'
          ? `Showing movies and series whose names begin with letter ${filters.letter}`
          : 'Browse all films and television series alphabetically'
      };
    }

    switch (category) {
      case 'movies':
        return { title: 'Explore Movies', icon: Film, subtitle: 'High definition films, blockbusters, and classics' };
      case 'tv-shows':
        return { title: 'Explore TV Series', icon: Tv, subtitle: 'Complete seasons, episodes, and trending shows' };
      case 'trending':
        return { title: 'Trending This Week', icon: Flame, subtitle: 'Top trending movies and series across the globe' };
      case 'top-rated':
        return { title: 'Top Rated Movies & Series', icon: Star, subtitle: 'Highest rated cinema masterpieces and television shows according to viewers' };
      case 'search':
        return { title: filters.query ? `Results for "${filters.query}"` : 'Catalogue Search', icon: SearchIcon, subtitle: 'Filter by genres, release year, and ratings' };
      default:
        return { title: 'Discover Catalog', icon: Film, subtitle: 'Browse titles' };
    }
  };

  const pageInfo = getPageTitle();
  const Icon = pageInfo.icon;

  return (
    <div className="max-w-[1520px] mx-auto px-3 sm:px-5 lg:px-6 py-6 pb-20">
      {/* Platform Hero Banner if in platform mode */}
      {currentPlatform ? (
        <div className="mb-6 rounded-2xl bg-[#29292D] border border-[#3A3A40] p-4 sm:p-6 shadow-xl relative overflow-hidden">
          <div
            className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
            style={{ backgroundColor: currentPlatform.color }}
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Studio Logo Box */}
              <div
                className={`w-20 h-16 sm:w-24 sm:h-20 rounded-xl ${currentPlatform.cardBg} border border-[#3A3A40] flex items-center justify-center p-2 shadow-lg shadow-black/40 shrink-0`}
                style={{ borderColor: `${currentPlatform.color}60` }}
              >
                {currentPlatform.renderLogo('md')}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${currentPlatform.color}20`,
                      color: currentPlatform.color === '#151516' ? '#FFFFFF' : currentPlatform.color
                    }}
                  >
                    Official Studio
                  </span>
                  <span className="text-xs text-[#A6A6AC] font-medium hidden sm:inline">
                    {currentPlatform.tagline}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {currentPlatform.name} Movies & Series
                </h1>
                <p className="text-xs sm:text-sm text-[#A6A6AC] mt-1 max-w-2xl">
                  {currentPlatform.description}
                </p>
              </div>
            </div>

            {/* Quick Stats Pill */}
            <div className="flex items-center gap-2 self-start md:self-center bg-[#232326] px-3.5 py-2 rounded-xl border border-[#3A3A40] text-xs">
              <Sparkles className="w-4 h-4 text-[#F5C400]" />
              <span className="text-[#A6A6AC]">Available Titles:</span>
              <span className="text-white font-bold">{data.totalResults}</span>
            </div>
          </div>

          {/* Quick Platform Switcher Row */}
          <div className="mt-5 pt-4 border-t border-[#3A3A40]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#A6A6AC] mb-2.5 flex items-center justify-between">
              <span>Switch Streaming Studio:</span>
              <span className="text-[10px] text-[#888890]">Click to view productions</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {PLATFORMS_LIST.map(p => {
                const isActive = (filters.platform || 'netflix').toLowerCase() === p.id.toLowerCase();
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSwitchPlatform(p.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-[#303035] border-[#F5C400] text-white shadow-md shadow-amber-500/10 ring-1 ring-[#F5C400]'
                        : 'bg-[#232326] border-[#3A3A40] text-[#A6A6AC] hover:text-white hover:border-[#F5C400]/60'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Regular Category / A-Z Header */
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-[#F5C400] mb-1">
              <Icon className="w-4 h-4" />
              <span>{isAzMode ? 'Alphabetical A-Z Directory' : 'Catalog Explorer'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {pageInfo.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#A6A6AC] mt-1">
              {pageInfo.subtitle}
            </p>
          </div>

          {isAzMode && filters.letter && (
            <div className="flex items-center gap-3 bg-[#29292D] border border-[#3A3A40] px-4 py-2.5 rounded-xl shadow-md self-start md:self-center">
              <span className="w-8 h-8 rounded-lg bg-[#F5C400] text-black font-black flex items-center justify-center text-base shadow-sm">
                {filters.letter}
              </span>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#A6A6AC] tracking-wider block">Active Letter</span>
                <span className="text-xs font-semibold text-white">{data.totalResults} matching titles</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* A-Z Alphabet Navigation Strip */}
      <div className="mb-5 bg-[#29292D] border border-[#3A3A40] rounded-xl p-3 sm:p-4 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#F5C400] uppercase tracking-wider">A-Z Quick Directory</span>
            <span className="text-[11px] text-[#A6A6AC] hidden sm:inline">• Click any letter to list titles starting with that letter</span>
          </div>
          {filters.letter && filters.letter !== 'All' && (
            <button
              onClick={() => handleSwitchLetter('All')}
              className="text-[11px] text-[#A6A6AC] hover:text-[#F5C400] font-semibold transition-colors cursor-pointer"
            >
              Clear Letter
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {ALPHABET.map(l => {
            const active = (filters.letter || (!isAzMode ? 'All' : 'A')).toUpperCase() === l.toUpperCase();
            return (
              <button
                key={l}
                onClick={() => handleSwitchLetter(l)}
                className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                  active
                    ? 'bg-[#F5C400] text-black border-[#F5C400] shadow-md shadow-amber-500/20 font-black ring-1 ring-[#F5C400] scale-105'
                    : 'bg-[#232326] border-[#3A3A40] text-[#A6A6AC] hover:text-white hover:border-[#F5C400]/60'
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Sorting Controls */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        totalResults={data.totalResults}
      />

      {/* Media Results Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-8 h-8 border-3 border-[#F5C400] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-[#A6A6AC]">Loading titles starting with {filters.letter || 'catalog'}...</p>
        </div>
      ) : data.results.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 text-center bg-[#29292D] rounded-2xl border border-[#3A3A40] my-8 shadow-xl">
          <Film className="w-12 h-12 text-[#A6A6AC] mb-3" />
          <h3 className="text-base font-bold text-white">
            {filters.letter ? `No titles found starting with "${filters.letter}"` : 'No titles matched your query'}
          </h3>
          <p className="text-xs text-[#A6A6AC] max-w-sm mt-1 mb-4 leading-relaxed">
            Try adjusting your media type (Movies / TV Series), release year, or select another letter from the A-Z list.
          </p>
          <button
            onClick={() => handleFilterChange({ mediaType: 'all', platform: filters.platform, letter: undefined, page: 1, query: '' })}
            className="px-4 py-2 rounded-lg bg-[#F5C400] text-black text-xs font-bold hover:bg-[#e0b400] transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {data.results.map(item => (
              <MediaCard
                key={`${item.mediaType}-${item.id || item.tmdbId}`}
                item={item}
                onSelect={onSelectMedia}
                onWatch={onWatchMedia}
              />
            ))}
          </div>

          {/* Critical Pagination Bar */}
          <Pagination
            currentPage={data.page}
            totalPages={data.totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};
