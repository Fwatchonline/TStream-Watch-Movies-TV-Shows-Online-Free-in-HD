import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Flame,
  Star,
  Sparkles,
  Film,
  Tv,
  Radio,
  Layers,
  Zap,
  Compass
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { fetchCatalog } from '../services/tmdb';
import { fetchNewEpisodes, NewEpisodeItem } from '../services/newEpisodes';
import { getDiscoveredCollections, DiscoveredCollection } from '../services/collectionStore';
import { ContinueWatchingSection } from '../components/ContinueWatchingSection';
import { MediaCard } from '../components/MediaCard';
import { HomeCarousel } from '../components/home/HomeCarousel';
import { TopTenSection } from '../components/home/TopTenSection';
import { EpisodeCard } from '../components/home/EpisodeCard';
import { LandscapeMediaCard } from '../components/home/LandscapeMediaCard';
import { CollectionCard } from '../components/home/CollectionCard';
import { PlatformSection } from '../components/home/PlatformSection';
import { GenreCard, POPULAR_GENRES } from '../components/home/GenreCard';
import { genreToSlug } from '../utils/genres';
import { PageLoadingIndicator } from '../components/PageLoadingIndicator';

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
  // Spotlight active index
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // Real TMDB content states
  const [spotlightList, setSpotlightList] = useState<MediaItem[]>([]);
  const [trendingList, setTrendingList] = useState<MediaItem[]>([]);
  const [popularMoviesList, setPopularMoviesList] = useState<MediaItem[]>([]);
  const [popularTvList, setPopularTvList] = useState<MediaItem[]>([]);
  const [airingTodayList, setAiringTodayList] = useState<MediaItem[]>([]);
  const [topRatedMoviesList, setTopRatedMoviesList] = useState<MediaItem[]>([]);
  const [topRatedTvList, setTopRatedTvList] = useState<MediaItem[]>([]);
  const [upcomingList, setUpcomingList] = useState<MediaItem[]>([]);
  const [newEpisodes, setNewEpisodes] = useState<NewEpisodeItem[]>([]);
  const [collectionsList, setCollectionsList] = useState<DiscoveredCollection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      try {
        const [
          trendingRes,
          popMoviesRes,
          popTvRes,
          airingTodayRes,
          topMoviesRes,
          topTvRes,
          upcomingRes,
          episodesData
        ] = await Promise.all([
          fetchCatalog('trending', 1),
          fetchCatalog('popular-movies', 1),
          fetchCatalog('popular-tv', 1),
          fetchCatalog('airing-today', 1),
          fetchCatalog('top-movies', 1),
          fetchCatalog('top-tv', 1),
          fetchCatalog('upcoming', 1),
          fetchNewEpisodes()
        ]);

        if (!isMounted) return;

        const trending = trendingRes.results || [];
        const popMovies = popMoviesRes.results || [];
        const popTv = popTvRes.results || [];
        const airingToday = airingTodayRes.results || [];
        const topMovies = topMoviesRes.results || [];
        const topTv = topTvRes.results || [];
        const upcoming = upcomingRes.results || [];

        setTrendingList(trending);
        setPopularMoviesList(popMovies);
        setPopularTvList(popTv);
        setAiringTodayList(airingToday);
        setTopRatedMoviesList(topMovies);
        setTopRatedTvList(topTv);
        setUpcomingList(upcoming);
        setNewEpisodes(episodesData || []);

        // Spotlight list: top trending items with high quality backdrops & synopsis
        const spotlights = trending.filter(m => m.backdropPath && m.overview).slice(0, 5);
        setSpotlightList(spotlights.length > 0 ? spotlights : trending.slice(0, 5));

        // Load curated & discovered collections for the layered franchise section
        const cols = getDiscoveredCollections();
        // Select prominent franchises with 3+ films
        const filteredCols = cols.filter(c => (c.parts && c.parts.length >= 2) || c.backdropPath);
        setCollectionsList(filteredCols.length > 0 ? filteredCols : cols);

        setLoading(false);
      } catch (err) {
        console.warn('Failed to load home page content:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadHomeData();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentHero = spotlightList[spotlightIndex] || trendingList[0];

  // Distribute new episodes into Today/Yesterday and This Week
  const latestEpisodes = useMemo(() => {
    const todayAndYesterday = newEpisodes.filter(e => e.releasePeriod === 'today' || e.releasePeriod === 'yesterday');
    return todayAndYesterday.length > 0 ? todayAndYesterday : newEpisodes.slice(0, 12);
  }, [newEpisodes]);

  const thisWeekEpisodes = useMemo(() => {
    const week = newEpisodes.filter(e => e.releasePeriod === 'this_week' || e.releasePeriod === 'recent');
    return week.length > 0 ? week : newEpisodes.slice(12, 24);
  }, [newEpisodes]);

  // Recommended For You: high-rating, critically acclaimed movies and TV series
  const recommendedList = useMemo(() => {
    const combined = [...topRatedMoviesList.slice(0, 8), ...topRatedTvList.slice(0, 8)];
    // Interleave
    const result: MediaItem[] = [];
    const len = Math.max(topRatedMoviesList.length, topRatedTvList.length);
    for (let i = 0; i < len; i++) {
      if (topRatedMoviesList[i]) result.push(topRatedMoviesList[i]);
      if (topRatedTvList[i]) result.push(topRatedTvList[i]);
    }
    return result.slice(0, 14);
  }, [topRatedMoviesList, topRatedTvList]);

  const alphabet = ['All', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  if (loading && !currentHero) {
    return (
      <div className="min-h-[70vh] bg-[#232326] flex items-center justify-center">
        <PageLoadingIndicator label="Loading curated releases and carousels..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#232326] text-[#F3F3F3] flex flex-col font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Main Full-Width Content Container */}
      <div className="flex-1 w-full max-w-[1520px] mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-9">

        {/* 1. Featured Content Hero Spotlight Banner */}
        {currentHero && (
          <div className="relative w-full rounded-2xl overflow-hidden bg-[#29292D] border border-[#3A3A40] shadow-2xl group">
            <div className="relative h-[360px] sm:h-[400px] lg:h-[440px] w-full overflow-hidden select-none">
              {/* TMDB Backdrop Artwork */}
              <img
                src={currentHero.backdropPath || currentHero.posterPath}
                alt={currentHero.title}
                className="w-full h-full object-cover object-top filter brightness-65 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />

              {/* Dark Ambient Scrims */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#232326] via-[#232326]/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#232326] via-[#232326]/85 to-transparent w-full md:w-3/5" />

              {/* Left Content Area */}
              <div className="absolute inset-0 p-4 sm:p-10 lg:p-12 flex flex-col justify-center max-w-2xl">
                {/* Spotlight Tag */}
                <div className="text-xs font-bold text-[#F5C400] tracking-wider uppercase mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F5C400]" />
                  <span>#{spotlightIndex + 1} Spotlight</span>
                </div>

                {/* Real Title */}
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-2 line-clamp-2">
                  {currentHero.title}
                </h1>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A6A6AC] font-medium mb-2.5">
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
                <p className="text-xs sm:text-sm text-[#A6A6AC] line-clamp-2 sm:line-clamp-3 leading-relaxed mb-5 max-w-xl font-normal">
                  {currentHero.overview}
                </p>

                {/* Buttons: Watch Now & Detail */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <button
                    onClick={() => onWatchMedia(currentHero)}
                    className="inline-flex items-center gap-2 h-9 sm:h-10 px-5 sm:px-6 rounded-full bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-extrabold text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <div className="w-4 h-4 rounded-full bg-black flex items-center justify-center">
                      <Play className="w-2.5 h-2.5 fill-[#F5C400] text-[#F5C400] ml-0.5" />
                    </div>
                    <span>Watch Now</span>
                  </button>

                  <button
                    onClick={() => onSelectMedia(currentHero)}
                    className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-[#303035] hover:bg-[#3A3A40] active:scale-95 text-[#F3F3F3] font-medium text-xs transition-all border border-[#3A3A40] cursor-pointer"
                  >
                    <span>Detail</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#A6A6AC]" />
                  </button>
                </div>
              </div>

              {/* Right Slide Controls */}
              <div className="absolute right-3 bottom-4 sm:right-5 sm:bottom-8 flex flex-col gap-1.5">
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

        {/* Continue Watching for Registered Users */}
        <ContinueWatchingSection
          onWatchMedia={onWatchMedia}
          onSelectMedia={onSelectMedia}
          variant="home"
        />

        {/* 2. Section A: Top 10 Today Row with Bold Ranking Numbers */}
        <TopTenSection
          items={trendingList}
          onSelectMedia={onSelectMedia}
          onWatchMedia={onWatchMedia}
        />

        {/* 3. Section D: Current & Upcoming TV Shows (Landscape 16:9 Cards) */}
        {airingTodayList.length > 0 && (
          <HomeCarousel
            title="Current & Upcoming TV Shows"
            icon={Radio}
            badge="On Air"
            subtitle="Broadcasting live and scheduled to premiere"
            viewAllLink={{
              label: 'View Schedule',
              onClick: () => onNavigate('new-episodes')
            }}
          >
            {airingTodayList.map(item => (
              <LandscapeMediaCard
                key={item.id || item.tmdbId}
                item={item}
                badge="Broadcasting"
                onSelectMedia={onSelectMedia}
                onWatchMedia={onWatchMedia}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 4. Section G: Recommended For You (Landscape 16:9 Cards) */}
        {recommendedList.length > 0 && (
          <HomeCarousel
            title="Recommended For You"
            icon={Sparkles}
            subtitle="Top-rated films & television masterpieces"
            viewAllLink={{
              label: 'Explore Catalog',
              onClick: () => onNavigate('movies')
            }}
          >
            {recommendedList.map(item => (
              <LandscapeMediaCard
                key={item.id || item.tmdbId}
                item={item}
                onSelectMedia={onSelectMedia}
                onWatchMedia={onWatchMedia}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 5. Section E: Latest Episodes (Released Today & Yesterday) */}
        {latestEpisodes.length > 0 && (
          <HomeCarousel
            title="Latest Released Episodes"
            icon={Zap}
            badge="New Drops"
            subtitle="Recently aired episodes ready for immediate playback"
            viewAllLink={{
              label: 'All Releases',
              onClick: () => onNavigate('new-episodes')
            }}
          >
            {latestEpisodes.map(ep => (
              <EpisodeCard
                key={ep.id}
                episode={ep}
                onSelectMedia={onSelectMedia}
                onWatchMedia={onWatchMedia}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 6. Section F: New Episodes This Week */}
        {thisWeekEpisodes.length > 0 && (
          <HomeCarousel
            title="New Episodes This Week"
            icon={Calendar}
            subtitle="Episodes broadcasted in the current cycle"
            viewAllLink={{
              label: 'Full Schedule',
              onClick: () => onNavigate('new-episodes')
            }}
          >
            {thisWeekEpisodes.map(ep => (
              <EpisodeCard
                key={ep.id}
                episode={ep}
                onSelectMedia={onSelectMedia}
                onWatchMedia={onWatchMedia}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 7. Section B: Trending Movies (2:3 Portrait Posters) */}
        {popularMoviesList.length > 0 && (
          <HomeCarousel
            title="Trending Movies"
            icon={Film}
            subtitle="Blockbusters and fan favorites"
            viewAllLink={{
              label: 'All Movies',
              onClick: () => onNavigate('movies')
            }}
          >
            {popularMoviesList.map(item => (
              <div key={item.id || item.tmdbId} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 8. Section C: Popular TV Shows (2:3 Portrait Posters) */}
        {popularTvList.length > 0 && (
          <HomeCarousel
            title="Popular TV Shows"
            icon={Tv}
            subtitle="Binge-worthy series & ongoing seasons"
            viewAllLink={{
              label: 'All TV Shows',
              onClick: () => onNavigate('tv-shows')
            }}
          >
            {popularTvList.map(item => (
              <div key={item.id || item.tmdbId} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 9. Section H: Trending This Week */}
        {trendingList.length > 0 && (
          <HomeCarousel
            title="Trending This Week"
            icon={Flame}
            subtitle="The hottest movies and series online"
            viewAllLink={{
              label: 'Trending Hub',
              onClick: () => onNavigate('trending')
            }}
          >
            {trendingList.slice(10, 24).map(item => (
              <div key={item.id || item.tmdbId} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 10. Section I: Streaming Platform Collections */}
        <PlatformSection
          onSelectMedia={onSelectMedia}
          onWatchMedia={onWatchMedia}
          onNavigate={onNavigate}
        />

        {/* 11. Section J: Movie Collections & Franchises (Layered / Overlapping Posters) */}
        {collectionsList.length > 0 && (
          <HomeCarousel
            title="Movie Collections & Franchises"
            icon={Layers}
            badge="Sagas"
            subtitle="Complete cinematic universes and multi-movie franchises"
            viewAllLink={{
              label: 'All Franchises',
              onClick: () => onNavigate('collections')
            }}
          >
            {collectionsList.map(col => (
              <CollectionCard
                key={col.id}
                collection={col}
                onClick={(selected) => onNavigate('collections', { collectionId: selected.id })}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 12. Section K: Top Rated Movies */}
        {topRatedMoviesList.length > 0 && (
          <HomeCarousel
            title="Top Rated Movies"
            icon={Star}
            subtitle="Highest rated cinema masterpieces of all time"
            viewAllLink={{
              label: 'Explore Top Rated',
              onClick: () => onNavigate('top-rated')
            }}
          >
            {topRatedMoviesList.map(item => (
              <div key={item.id || item.tmdbId} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 13. Section L: Top Rated TV Shows */}
        {topRatedTvList.length > 0 && (
          <HomeCarousel
            title="Top Rated TV Shows"
            icon={Tv}
            subtitle="Critically acclaimed series and historic television"
            viewAllLink={{
              label: 'Explore Top Rated',
              onClick: () => onNavigate('top-rated')
            }}
          >
            {topRatedTvList.map(item => (
              <div key={item.id || item.tmdbId} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 14. Section M: Popular Genres (Landscape Cards) */}
        <HomeCarousel
          title="Popular Genres"
          icon={Compass}
          subtitle="Explore cinema and TV by category & style"
        >
          {POPULAR_GENRES.map(genre => (
            <GenreCard
              key={genre.id}
              genre={genre}
              onClick={(genreId) => onNavigate('genre', { genreId, genreSlug: genreToSlug(genreId) })}
            />
          ))}
        </HomeCarousel>

        {/* 15. Section N: Top Upcoming Releases */}
        {upcomingList.length > 0 && (
          <HomeCarousel
            title="Top Upcoming Releases"
            icon={Calendar}
            subtitle="Anticipated blockbusters coming soon to cinema and streaming"
          >
            {upcomingList.map(item => (
              <div key={item.id || item.tmdbId} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 16. Footer with T Stream Branding & A-Z Directory */}
        <footer className="pt-8 pb-10 border-t border-[#3A3A40] space-y-6">
          {/* Logo */}
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
              <span className="font-bold text-[#F5C400]">A-Z DIRECTORY</span>
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
