import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Flame,
  Star,
  Sparkles
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { ALL_GENRES } from '../services/catalogData';
import { fetchCatalog } from '../services/tmdb';
import { PLATFORMS_LIST } from '../services/platformData';

interface HomePageProps {
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem, season?: number, episode?: number) => void;
  onNavigate: (view: string, extraParams?: any) => void;
  onSurpriseMe: () => void;
  onSearch?: (query: string) => void;
  onOpenLegal?: (page: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onSelectMedia,
  onWatchMedia,
  onNavigate,
  onSurpriseMe,
  onSearch,
  onOpenLegal
}) => {
  const [top10Tab, setTop10Tab] = useState<'today' | 'week' | 'month'>('today');
  const [showAllGenres, setShowAllGenres] = useState(false);
  const trendingCarouselRef = useRef<HTMLDivElement>(null);

  // Spotlight active index
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // Real TMDB data states
  const [spotlightList, setSpotlightList] = useState<MediaItem[]>([]);
  const [trendingList, setTrendingList] = useState<MediaItem[]>([]);
  const [topRatedList, setTopRatedList] = useState<MediaItem[]>([]);
  const [popularMoviesList, setPopularMoviesList] = useState<MediaItem[]>([]);
  const [popularTvList, setPopularTvList] = useState<MediaItem[]>([]);
  const [upcomingList, setUpcomingList] = useState<MediaItem[]>([]);
  const [latestReleasesList, setLatestReleasesList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadTmdbData() {
      try {
        const [
          trendingRes,
          topMoviesRes,
          popMoviesRes,
          popTvRes,
          upcomingRes
        ] = await Promise.all([
          fetchCatalog('trending', 1),
          fetchCatalog('top-movies', 1),
          fetchCatalog('popular-movies', 1),
          fetchCatalog('popular-tv', 1),
          fetchCatalog('upcoming', 1)
        ]);

        if (!isMounted) return;

        const trending = trendingRes.results;
        const topMovies = topMoviesRes.results;
        const popMovies = popMoviesRes.results;
        const popTv = popTvRes.results;
        const upcoming = upcomingRes.results;

        setTrendingList(trending);
        setTopRatedList(topMovies);
        setPopularMoviesList(popMovies);
        setPopularTvList(popTv);
        setUpcomingList(upcoming);

        // Spotlight list: top trending items with high quality backdrops
        const spotlights = trending.filter(m => m.backdropPath && m.overview).slice(0, 5);
        setSpotlightList(spotlights.length > 0 ? spotlights : trending.slice(0, 5));

        // Latest releases: 12 trending/popular items
        setLatestReleasesList(trending.slice(0, 12));

        setLoading(false);
      } catch (err) {
        console.warn('Failed to load TMDB home data:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadTmdbData();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentHero = spotlightList[spotlightIndex] || trendingList[0];

  // Most Favorite: sorted by vote count
  const mostFavoriteList = [...topRatedList, ...popularMoviesList]
    .filter((v, i, a) => a.findIndex(t => (t.id || t.tmdbId) === (v.id || v.tmdbId)) === i)
    .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
    .slice(0, 5);

  // Latest Completed: popular TV shows
  const latestCompletedList = popularTvList.slice(0, 5);

  // Top 10 items based on tab
  const getTop10Items = (): MediaItem[] => {
    if (top10Tab === 'today') {
      return trendingList.slice(0, 10);
    } else if (top10Tab === 'week') {
      return popularMoviesList.slice(0, 10);
    } else {
      return topRatedList.slice(0, 10);
    }
  };

  // OTT Platforms with authentic brand logos
  const ottPlatforms = PLATFORMS_LIST;

  // Genre 3-columns list
  const genreColumns = [
    ALL_GENRES.slice(0, 6).map(g => g.name),
    ALL_GENRES.slice(6, 12).map(g => g.name),
    ALL_GENRES.slice(12, 18).map(g => g.name)
  ];

  const alphabet = ['All', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  return (
    <div className="min-h-screen bg-[#232326] text-[#F3F3F3] flex flex-col font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Main Full-Width Content Container */}
      <div className="flex-1 w-full max-w-[1520px] mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-7">
        {/* 2. Spotlight Hero Section with real TMDB data */}
        {currentHero && (
          <div className="relative w-full rounded-2xl overflow-hidden bg-[#29292D] border border-[#3A3A40] shadow-2xl group">
            <div className="relative h-[340px] sm:h-[400px] lg:h-[440px] w-full overflow-hidden select-none">
              {/* TMDB Backdrop Image */}
              <img
                src={currentHero.backdropPath || currentHero.posterPath}
                alt={currentHero.title}
                className="w-full h-full object-cover object-top filter brightness-65 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />

              {/* Dark Scrims */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#232326] via-[#232326]/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#232326] via-[#232326]/85 to-transparent w-full md:w-3/5" />

              {/* Left Content Area */}
              <div className="absolute inset-0 p-6 sm:p-10 lg:p-12 flex flex-col justify-center max-w-2xl">
                {/* Spotlight Tag */}
                <div className="text-xs font-bold text-[#F5C400] tracking-wider uppercase mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F5C400]" />
                  <span>#{spotlightIndex + 1} Spotlight</span>
                </div>

                {/* Real Title */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-2.5">
                  {currentHero.title}
                </h1>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A6A6AC] font-medium mb-3">
                  <span className="flex items-center gap-1 text-[#F5C400] font-bold">
                    ★ {currentHero.voteAverage?.toFixed(1) || '8.0'}
                  </span>
                  <span aria-hidden="true" className="text-[#555560]">·</span>
                  <span>{currentHero.mediaType === 'tv' ? 'TV Series' : 'Movie'}</span>
                  <span aria-hidden="true" className="text-[#555560]">·</span>
                  <span>{currentHero.runtime ? `${currentHero.runtime} min` : '120 min'}</span>
                  <span aria-hidden="true" className="text-[#555560]">·</span>
                  <span>{currentHero.releaseDate ? new Date(currentHero.releaseDate).getFullYear() : '2026'}</span>
                  <span className="px-1.5 py-0.2 rounded border border-[#F5C400] text-[#F5C400] text-[10px] font-bold tracking-wider ml-1">
                    HD
                  </span>
                </div>

                {/* Synopsis */}
                <p className="text-xs sm:text-sm text-[#A6A6AC] line-clamp-3 leading-relaxed mb-6 max-w-xl font-normal">
                  {currentHero.overview}
                </p>

                {/* Buttons: Watch Now & Detail */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onWatchMedia(currentHero)}
                    className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-extrabold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center">
                      <Play className="w-2.5 h-2.5 fill-[#F5C400] text-[#F5C400] ml-0.5" />
                    </div>
                    <span>Watch Now</span>
                  </button>

                  <button
                    onClick={() => onSelectMedia(currentHero)}
                    className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-[#303035] hover:bg-[#3A3A40] active:scale-95 text-[#F3F3F3] font-medium text-xs transition-all border border-[#3A3A40] cursor-pointer"
                  >
                    <span>Detail</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#A6A6AC]" />
                  </button>
                </div>
              </div>

              {/* Right side slide controls */}
              <div className="absolute right-5 bottom-8 flex flex-col gap-1.5">
                <button
                  onClick={() => setSpotlightIndex(prev => (prev === 0 ? spotlightList.length - 1 : prev - 1))}
                  className="w-7 h-7 rounded bg-[#29292D]/90 hover:bg-[#303035] border border-[#3A3A40] text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Previous Slide"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSpotlightIndex(prev => (prev === spotlightList.length - 1 ? 0 : prev + 1))}
                  className="w-7 h-7 rounded bg-[#29292D]/90 hover:bg-[#303035] border border-[#3A3A40] text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Next Slide"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Trending Poster Carousel (Real TMDB Trending Items - As on Reference Image 2) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#F5C400]" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Trending
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => trendingCarouselRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}
                className="w-7 h-7 rounded bg-[#29292D] hover:bg-[#303035] border border-[#3A3A40] text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => trendingCarouselRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}
                className="w-7 h-7 rounded bg-[#29292D] hover:bg-[#303035] border border-[#3A3A40] text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            ref={trendingCarouselRef}
            className="flex items-stretch gap-3 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-0.5"
          >
            {trendingList.slice(0, 10).map((item, idx) => {
              const rankStr = (idx + 1).toString().padStart(2, '0');
              return (
                <div
                  key={item.id || item.tmdbId}
                  onClick={() => onSelectMedia(item)}
                  className="shrink-0 flex items-stretch gap-2.5 bg-[#29292D] hover:bg-[#303035] p-2 rounded-xl border border-[#3A3A40] hover:border-[#F5C400] transition-all duration-200 cursor-pointer shadow-md group select-none"
                >
                  {/* Left Column: Vertical Title & Bold Ranking Number (As on Reference Image 2) */}
                  <div className="w-8 sm:w-9 flex flex-col justify-between items-center py-1 select-none shrink-0">
                    <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
                      <span
                        className="text-xs font-bold text-[#F3F3F3] group-hover:text-[#F5C400] transition-colors truncate tracking-tight [writing-mode:vertical-rl] rotate-180 max-h-[140px] leading-tight block text-center"
                        title={item.title}
                      >
                        {item.title}
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black italic tracking-tighter text-[#F5C400] tabular-nums leading-none mt-2">
                      {rankStr}
                    </div>
                  </div>

                  {/* Right Column: Poster with HD badge and Hover Play overlay */}
                  <div className="relative aspect-[2/3] w-[125px] sm:w-[138px] rounded-lg overflow-hidden bg-[#232326] shrink-0 border border-[#3A3A40]/60">
                    <img
                      src={item.posterPath}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />

                    {/* Top Right HD Badge */}
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] font-black tracking-wider text-[#F5C400] border border-[#F5C400]/40">
                      HD
                    </span>

                    {/* Bottom Metadata: Media Type and Rating */}
                    <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-center justify-between text-[10px] pointer-events-none">
                      <span className="text-[#A6A6AC] font-semibold text-[9px] uppercase tracking-wider">
                        {item.mediaType === 'tv' ? 'TV' : 'Movie'}
                      </span>
                      <span className="flex items-center gap-0.5 text-[#F5C400] font-bold text-[10px]">
                        ★ {item.voteAverage?.toFixed(1) || '8.0'}
                      </span>
                    </div>

                    {/* Hover Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                        <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Four Compact Ranking Columns (Real TMDB Data) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Top Rated */}
          <div className="bg-[#29292D] border border-[#3A3A40] rounded-xl p-3.5">
            <h3 className="text-xs font-bold text-white mb-3">Top Rated</h3>
            <div className="space-y-2.5">
              {topRatedList.slice(0, 5).map(item => (
                <div
                  key={item.id || item.tmdbId}
                  onClick={() => onSelectMedia(item)}
                  className="flex items-center gap-2.5 group cursor-pointer hover:bg-[#303035] p-1 rounded transition-colors"
                >
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-10 h-10 object-cover rounded bg-[#303035] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#A6A6AC] mt-0.5">
                      <span className="text-[#F5C400] font-bold">★ {item.voteAverage?.toFixed(1) || '8.5'}</span>
                      <span>·</span>
                      <span className="truncate">{item.mediaType === 'tv' ? 'Completed Series' : 'Movie'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most Popular */}
          <div className="bg-[#29292D] border border-[#3A3A40] rounded-xl p-3.5">
            <h3 className="text-xs font-bold text-white mb-3">Most Popular</h3>
            <div className="space-y-2.5">
              {popularMoviesList.slice(0, 5).map(item => (
                <div
                  key={item.id || item.tmdbId}
                  onClick={() => onSelectMedia(item)}
                  className="flex items-center gap-2.5 group cursor-pointer hover:bg-[#303035] p-1 rounded transition-colors"
                >
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-10 h-10 object-cover rounded bg-[#303035] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#A6A6AC] mt-0.5">
                      <span className="text-[#F5C400] font-bold">★ {item.voteAverage?.toFixed(1) || '8.0'}</span>
                      <span className="px-1 rounded text-[9px] font-bold text-black bg-[#F5C400]">
                        {Math.round(item.popularity || 100)}
                      </span>
                      <span>·</span>
                      <span className="truncate">Movie · 120 min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most Favorite */}
          <div className="bg-[#29292D] border border-[#3A3A40] rounded-xl p-3.5">
            <h3 className="text-xs font-bold text-white mb-3">Most Favorite</h3>
            <div className="space-y-2.5">
              {mostFavoriteList.map(item => (
                <div
                  key={item.id || item.tmdbId}
                  onClick={() => onSelectMedia(item)}
                  className="flex items-center gap-2.5 group cursor-pointer hover:bg-[#303035] p-1 rounded transition-colors"
                >
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-10 h-10 object-cover rounded bg-[#303035] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#A6A6AC] mt-0.5">
                      <span className="text-[#F5C400] font-bold">
                        ★ {item.voteAverage?.toFixed(1) || '8.0'}
                      </span>
                      <span>·</span>
                      <span className="truncate">{item.voteCount || 1000} votes</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Latest Completed */}
          <div className="bg-[#29292D] border border-[#3A3A40] rounded-xl p-3.5">
            <h3 className="text-xs font-bold text-white mb-3">Latest Completed</h3>
            <div className="space-y-2.5">
              {latestCompletedList.map(item => (
                <div
                  key={item.id || item.tmdbId}
                  onClick={() => onSelectMedia(item)}
                  className="flex items-center gap-2.5 group cursor-pointer hover:bg-[#303035] p-1 rounded transition-colors"
                >
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-10 h-10 object-cover rounded bg-[#303035] shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#A6A6AC] mt-0.5">
                      <span className="px-1 rounded text-[9px] font-bold text-black bg-[#F5C400]">
                        Series
                      </span>
                      <span>·</span>
                      <span className="truncate">Completed · 45 min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 5. OTT Platforms Row (With Official Brand Logos) */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
          {ottPlatforms.map(p => (
            <div
              key={p.name}
              onClick={() => onNavigate('platform', { platform: p.id })}
              className="group cursor-pointer flex flex-col items-center select-none"
            >
              <span className="text-[11px] font-medium text-[#A6A6AC] mb-1.5 group-hover:text-[#F5C400] transition-colors">
                {p.name}
              </span>
              <div
                className={`w-full aspect-[4/3] rounded-xl overflow-hidden ${p.cardBg} border border-[#3A3A40] group-hover:border-[#F5C400] group-hover:scale-105 transition-all duration-200 shadow-md flex items-center justify-center p-2 relative`}
              >
                {/* Subtle top glare/gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/5 pointer-events-none" />
                {p.renderLogo()}
              </div>
            </div>
          ))}
        </div>

        {/* 6. Latest Releases & Right Sidebar (Two-Column Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Latest Releases (6 columns x 2 rows = 12 items) */}
          <div className="lg:col-span-9 space-y-3">
            <h2 className="text-base font-bold text-white tracking-tight">
              Latest Releases
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {latestReleasesList.map(item => (
                <div
                  key={item.id || item.tmdbId}
                  onClick={() => onSelectMedia(item)}
                  className="group cursor-pointer flex flex-col rounded-lg overflow-hidden bg-[#303035] border border-[#3A3A40] hover:border-[#F5C400] transition-all select-none"
                >
                  <div className="relative aspect-[2/3] w-full bg-[#29292D] overflow-hidden">
                    <img
                      src={item.posterPath}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />

                    {/* Bottom metric badges */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 flex-wrap">
                      <span className="px-1 py-0.2 rounded bg-[#F5C400] text-black text-[9px] font-black">
                        ★ {item.voteAverage?.toFixed(1) || '8.0'}
                      </span>
                      <span className="px-1 py-0.2 rounded bg-black/80 text-white text-[9px] font-bold border border-white/20">
                        {item.mediaType === 'movie' ? 'Movie' : 'Series'}
                      </span>
                    </div>
                  </div>

                  {/* Card Info */}
                  <div className="p-2">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                      {item.title}
                    </h4>
                    <div className="text-[10px] text-[#A6A6AC] mt-1 truncate">
                      {item.mediaType === 'movie' ? `Movie · ${item.releaseDate ? new Date(item.releaseDate).getFullYear() : '2026'}` : 'Series · 45 min'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Genres + Top 10 Widget */}
          <div className="lg:col-span-3 space-y-5">
            {/* Genres Widget */}
            <div className="bg-[#29292D] border border-[#3A3A40] rounded-xl p-3.5">
              <h3 className="text-xs font-bold text-white mb-3">Genres</h3>

              <div className="grid grid-cols-3 gap-y-2 text-[11px]">
                {genreColumns.map((col, colIdx) => (
                  <div key={colIdx} className="space-y-1.5">
                    {col.map(gName => (
                      <button
                        key={gName}
                        onClick={() => {
                          const matched = ALL_GENRES.find(item => item.name === gName);
                          if (matched) onNavigate('movies', { genreId: matched.id });
                        }}
                        className={`block text-left w-full hover:underline transition-colors ${
                          gName === 'Thriller' ? 'text-[#F5C400] font-bold' : 'text-[#A6A6AC] hover:text-white'
                        }`}
                      >
                        {gName}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowAllGenres(!showAllGenres)}
                className="w-full mt-4 py-1.5 rounded bg-[#303035] hover:bg-[#3A3A40] text-xs font-semibold text-[#F3F3F3] text-center transition-colors cursor-pointer"
              >
                {showAllGenres ? 'Show less' : 'Show more'}
              </button>
            </div>

            {/* Top 10 Widget */}
            <div className="bg-[#29292D] border border-[#3A3A40] rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-white">Top 10</h3>
                <div className="flex items-center gap-1 bg-[#232326] p-0.5 rounded text-[10px]">
                  <button
                    onClick={() => setTop10Tab('today')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      top10Tab === 'today' ? 'bg-[#F5C400] text-black' : 'text-[#A6A6AC] hover:text-white'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setTop10Tab('week')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      top10Tab === 'week' ? 'bg-[#F5C400] text-black' : 'text-[#A6A6AC] hover:text-white'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setTop10Tab('month')}
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      top10Tab === 'month' ? 'bg-[#F5C400] text-black' : 'text-[#A6A6AC] hover:text-white'
                    }`}
                  >
                    Month
                  </button>
                </div>
              </div>

              {/* Numbered List 1 to 10 */}
              <div className="space-y-2">
                {getTop10Items().map((item, idx) => (
                  <div
                    key={item.id || item.tmdbId}
                    onClick={() => onSelectMedia(item)}
                    className="flex items-center gap-2.5 group cursor-pointer hover:bg-[#303035] p-1 rounded transition-colors"
                  >
                    <span className="w-4 text-center font-black text-xs text-[#F5C400] tabular-nums">
                      {idx + 1}
                    </span>
                    <img
                      src={item.posterPath}
                      alt={item.title}
                      className="w-8 h-8 rounded object-cover bg-[#303035] shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[9px] text-[#A6A6AC] mt-0.5">
                        <span className="px-1 py-0.2 rounded bg-[#303035] text-[#F3F3F3] font-medium">
                          ★ {item.voteAverage?.toFixed(1) || '8.0'}
                        </span>
                        <span className="px-1 py-0.2 rounded bg-[#303035] text-[#A6A6AC] font-medium">
                          {item.mediaType === 'tv' ? 'TV' : 'Movie'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7. Popular Movies (Real TMDB Data) */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white tracking-tight">
            Popular Movies
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {popularMoviesList.slice(0, 12).map(item => (
              <div
                key={item.id || item.tmdbId}
                onClick={() => onSelectMedia(item)}
                className="group cursor-pointer flex flex-col rounded-lg overflow-hidden bg-[#303035] border border-[#3A3A40] hover:border-[#F5C400] transition-all select-none"
              >
                <div className="relative aspect-[2/3] w-full bg-[#29292D] overflow-hidden">
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 flex-wrap">
                    <span className="px-1 py-0.2 rounded bg-[#F5C400] text-black text-[9px] font-black">
                      ★ {item.voteAverage?.toFixed(1) || '8.0'}
                    </span>
                    <span className="px-1 py-0.2 rounded bg-black/80 text-white text-[9px] font-bold border border-white/20">
                      Movie
                    </span>
                  </div>
                </div>
                <div className="p-2">
                  <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                    {item.title}
                  </h4>
                  <div className="text-[10px] text-[#A6A6AC] mt-1 truncate">
                    Movie · {item.releaseDate ? new Date(item.releaseDate).getFullYear() : '2026'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Popular TV Series (Real TMDB Data) */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white tracking-tight">
            Popular TV Series
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {popularTvList.slice(0, 12).map(item => (
              <div
                key={item.id || item.tmdbId}
                onClick={() => onSelectMedia(item)}
                className="group cursor-pointer flex flex-col rounded-lg overflow-hidden bg-[#303035] border border-[#3A3A40] hover:border-[#F5C400] transition-all select-none"
              >
                <div className="relative aspect-[2/3] w-full bg-[#29292D] overflow-hidden">
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 flex-wrap">
                    <span className="px-1 py-0.2 rounded bg-[#F5C400] text-black text-[9px] font-black">
                      ★ {item.voteAverage?.toFixed(1) || '8.0'}
                    </span>
                    <span className="px-1 py-0.2 rounded bg-black/80 text-white text-[9px] font-bold border border-white/20">
                      Series
                    </span>
                  </div>
                </div>
                <div className="p-2">
                  <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                    {item.title}
                  </h4>
                  <div className="text-[10px] text-[#A6A6AC] mt-1 truncate">
                    Completed Series · 45 min
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 9. Top Upcoming (Real TMDB Upcoming Movies) */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white tracking-tight">
            Top Upcoming
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {upcomingList.slice(0, 12).map(item => (
              <div
                key={item.id || item.tmdbId}
                onClick={() => onSelectMedia(item)}
                className="group cursor-pointer flex flex-col rounded-lg overflow-hidden bg-[#303035] border border-[#3A3A40] hover:border-[#F5C400] transition-all select-none"
              >
                <div className="relative aspect-[2/3] w-full bg-[#29292D] overflow-hidden">
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-2">
                  <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate transition-colors leading-tight">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-1 text-[10px] text-[#A6A6AC] mt-1 truncate">
                    <Calendar className="w-2.5 h-2.5 text-[#F5C400]" />
                    <span>{item.releaseDate ? new Date(item.releaseDate).getFullYear() : '2026'} · Movie</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 10. Footer with T Stream Branding */}
        <footer className="pt-8 pb-10 border-t border-[#3A3A40] space-y-6">
          {/* Logo & Discord Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 group focus:outline-none text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[#F5C400] flex items-center justify-center text-black font-black shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
                <svg className="w-3.5 h-3.5 fill-black ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                T <span className="text-[#F5C400]">Stream</span>
              </span>
            </button>
          </div>

          {/* A-Z List Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[#F5C400]">A-Z LIST</span>
              <span className="text-[#A6A6AC]">Browse movies and series alphabetically by name A to Z.</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {alphabet.map(letter => (
                <button
                  key={letter}
                  onClick={() => {
                    if (letter === 'All') onNavigate('movies');
                    else onNavigate('az', { letter });
                  }}
                  className="px-2 py-0.5 rounded bg-[#29292D] border border-[#3A3A40] hover:bg-[#F5C400] hover:text-black hover:border-[#F5C400] text-[10px] font-bold text-[#A6A6AC] transition-colors cursor-pointer"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          {/* Description Paragraph */}
          <p className="text-[11px] text-[#A6A6AC] leading-relaxed">
            T Stream is your ultimate destination for watching movies and web series online for free in HD quality. Stream the latest movie releases with subtitle support and multi-server playback. Our library includes action, romance, thriller, comedy, horror, drama movies, and popular web series. Watch movies online without registration or subscription fees. Updated daily with new releases. Enjoy seamless streaming on all devices - mobile, tablet, and desktop. Note: T Stream does not host any files itself, but fetches metadata from TMDB and provides direct stream playback.
          </p>

          {/* DMCA / Aggregator Notice */}
          <p className="text-[11px] text-[#A6A6AC] leading-relaxed">
            T Stream operates as a media aggregator and does not host any media files on our servers. All content is sourced from third-party streaming providers. For any copyright concerns or DMCA takedown requests, please contact the respective content providers directly.
          </p>

          {/* Bottom Love line */}
          <div className="text-[11px] text-[#A6A6AC]">
            Built with <span className="text-[#F5C400]">❤</span> for entertainment enthusiasts worldwide
          </div>
        </footer>
      </div>
    </div>
  );
};
