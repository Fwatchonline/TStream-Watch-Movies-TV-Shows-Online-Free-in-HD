import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Compass,
  Award
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { fetchCatalog } from '../services/tmdb';
import { fetchNewEpisodes, NewEpisodeItem } from '../services/newEpisodes';
import { getDiscoveredCollections, DiscoveredCollection } from '../services/collectionStore';
import {
  fetchTrendingAnime,
  fetchPopularAnime,
  fetchSeasonalAnime,
  fetchAnimeMovies
} from '../services/anilist';
import { animeMediaToMediaItem } from '../services/animeCatalog';
import {
  listFeaturedContent,
  getHiddenTitleKeys,
  buildFeaturedItemId,
  type FeaturedContentEntry
} from '../services/featuredContent';
import {
  rankPersonalizedRecommendations,
  getRecommendationProfile
} from '../services/recommendationEngine';
import {
  getGuestWatchHistory,
  getGuestCompletedMedia,
  getWatchlist
} from '../services/storage';
import { buildSeriesKey } from '../utils/mediaKey';
import { useAuth } from '../context/AuthContext';
import { ContinueWatchingSection } from '../components/ContinueWatchingSection';
import { MediaCard } from '../components/MediaCard';
import { QualityBadge } from '../components/QualityBadge';
import { HomeCarousel } from '../components/home/HomeCarousel';
import { TopTenSection } from '../components/home/TopTenSection';
import { EpisodeCard } from '../components/home/EpisodeCard';
import { LandscapeMediaCard } from '../components/home/LandscapeMediaCard';
import { CollectionCard } from '../components/home/CollectionCard';
import { PlatformSection } from '../components/home/PlatformSection';
import { GenreCard, POPULAR_GENRES } from '../components/home/GenreCard';
import { genreToSlug } from '../utils/genres';
import { PageLoadingIndicator } from '../components/PageLoadingIndicator';
import { resolveSafeImageSrc } from '../utils/imageUrl';

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
  onNavigate
}) => {
  const { user, watchHistory, completedMedia, watchlist } = useAuth();

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

  // Non-blocking AniList Anime states
  const [trendingAnimeList, setTrendingAnimeList] = useState<MediaItem[]>([]);
  const [popularAnimeList, setPopularAnimeList] = useState<MediaItem[]>([]);
  const [seasonalAnimeList, setSeasonalAnimeList] = useState<MediaItem[]>([]);
  const [animeMoviesList, setAnimeMoviesList] = useState<MediaItem[]>([]);
  const [animeLoaded, setAnimeLoaded] = useState(false);

  // Admin Featured & Hidden content controls
  const [featuredEntries, setFeaturedEntries] = useState<FeaturedContentEntry[]>([]);
  const [hiddenKeySet, setHiddenKeySet] = useState<Set<string>>(() => new Set(getHiddenTitleKeys()));
  const [loading, setLoading] = useState(true);

  const animeTriggerRef = useRef<HTMLDivElement>(null);

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
          episodesData,
          adminFeatured
        ] = await Promise.all([
          fetchCatalog('trending', 1),
          fetchCatalog('popular-movies', 1),
          fetchCatalog('popular-tv', 1),
          fetchCatalog('airing-today', 1),
          fetchCatalog('top-movies', 1),
          fetchCatalog('top-tv', 1),
          fetchCatalog('upcoming', 1),
          fetchNewEpisodes(),
          listFeaturedContent().catch(() => [])
        ]);

        if (!isMounted) return;

        setTrendingList(trendingRes.results || []);
        setPopularMoviesList(popMoviesRes.results || []);
        setPopularTvList(popTvRes.results || []);
        setAiringTodayList(airingTodayRes.results || []);
        setTopRatedMoviesList(topMoviesRes.results || []);
        setTopRatedTvList(topTvRes.results || []);
        setUpcomingList(upcomingRes.results || []);
        setNewEpisodes(episodesData || []);
        setFeaturedEntries(adminFeatured || []);
        setHiddenKeySet(new Set(getHiddenTitleKeys()));

        // Load curated & discovered collections for the layered franchise section
        const cols = getDiscoveredCollections();
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

  // Lazy non-blocking AniList fetch when sentinel enters viewport (or short idle fallback)
  useEffect(() => {
    if (animeLoaded) return;
    let cancelled = false;
    let started = false;

    const loadAnimeShelves = async () => {
      if (started || cancelled) return;
      started = true;
      try {
        const [trendingAn, popularAn, seasonalAn, moviesAn] = await Promise.allSettled([
          fetchTrendingAnime(1, 16),
          fetchPopularAnime(1, 16),
          fetchSeasonalAnime(1, 16),
          fetchAnimeMovies(1, 14)
        ]);

        if (cancelled) return;

        if (trendingAn.status === 'fulfilled' && trendingAn.value.results?.length) {
          setTrendingAnimeList(trendingAn.value.results.map(animeMediaToMediaItem));
        }
        if (popularAn.status === 'fulfilled' && popularAn.value.results?.length) {
          setPopularAnimeList(popularAn.value.results.map(animeMediaToMediaItem));
        }
        if (seasonalAn.status === 'fulfilled' && seasonalAn.value.results?.length) {
          setSeasonalAnimeList(seasonalAn.value.results.map(animeMediaToMediaItem));
        }
        if (moviesAn.status === 'fulfilled' && moviesAn.value.results?.length) {
          setAnimeMoviesList(moviesAn.value.results.map(animeMediaToMediaItem));
        }
      } catch {
        // Non-blocking: movie and TV carousels stay intact if AniList is unavailable
      } finally {
        if (!cancelled) setAnimeLoaded(true);
      }
    };

    const node = animeTriggerRef.current;
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && node) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            loadAnimeShelves();
            observer?.disconnect();
          }
        },
        { rootMargin: '500px 0px' }
      );
      observer.observe(node);
    }

    // Secondary idle fallback so SSR / fast scrolling still populates anime smoothly
    const timer = setTimeout(() => {
      loadAnimeShelves();
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [animeLoaded]);

  const filterVisible = useMemo(() => {
    return (items: MediaItem[]): MediaItem[] => {
      if (hiddenKeySet.size === 0) return items;
      return items.filter((item) => {
        const key = buildFeaturedItemId(
          item.mediaType,
          item.mediaType === 'anime' ? item.anilistId || item.id : item.tmdbId || item.id
        );
        const seriesKey = buildSeriesKey({
          mediaType: item.mediaType,
          tmdbId: item.mediaType !== 'anime' ? item.tmdbId || item.id : undefined,
          anilistId: item.mediaType === 'anime' ? item.anilistId || item.id : undefined,
          id: item.id
        });
        return !hiddenKeySet.has(key) && !hiddenKeySet.has(seriesKey);
      });
    };
  }, [hiddenKeySet]);

  const visibleTrending = useMemo(() => filterVisible(trendingList), [filterVisible, trendingList]);
  const visiblePopMovies = useMemo(() => filterVisible(popularMoviesList), [filterVisible, popularMoviesList]);
  const visiblePopTv = useMemo(() => filterVisible(popularTvList), [filterVisible, popularTvList]);
  const visibleAiringToday = useMemo(() => filterVisible(airingTodayList), [filterVisible, airingTodayList]);
  const visibleTopMovies = useMemo(() => filterVisible(topRatedMoviesList), [filterVisible, topRatedMoviesList]);
  const visibleTopTv = useMemo(() => filterVisible(topRatedTvList), [filterVisible, topRatedTvList]);
  const visibleUpcoming = useMemo(() => filterVisible(upcomingList), [filterVisible, upcomingList]);
  const visibleTrendingAnime = useMemo(() => filterVisible(trendingAnimeList), [filterVisible, trendingAnimeList]);
  const visiblePopularAnime = useMemo(() => filterVisible(popularAnimeList), [filterVisible, popularAnimeList]);
  const visibleSeasonalAnime = useMemo(() => filterVisible(seasonalAnimeList), [filterVisible, seasonalAnimeList]);
  const visibleAnimeMovies = useMemo(() => filterVisible(animeMoviesList), [filterVisible, animeMoviesList]);

  // Compute Spotlight prioritizing enabled Admin Featured items matched in loaded pools
  useEffect(() => {
    const allPools = [
      ...visibleTrending,
      ...visiblePopMovies,
      ...visiblePopTv,
      ...visibleTrendingAnime
    ];
    const poolMap = new Map<string, MediaItem>();
    for (const item of allPools) {
      const k = buildFeaturedItemId(
        item.mediaType,
        item.mediaType === 'anime' ? item.anilistId || item.id : item.tmdbId || item.id
      );
      if (!poolMap.has(k)) poolMap.set(k, item);
    }

    const adminPinned: MediaItem[] = [];
    const seenIds = new Set<string>();
    for (const entry of featuredEntries) {
      if (!entry.enabled) continue;
      const match = poolMap.get(entry.id) || poolMap.get(entry.mediaKey);
      if (match && !seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        adminPinned.push(match);
      }
    }

    const fallbackSpotlights = visibleTrending.filter(
      (m) =>
        m.backdropPath &&
        m.overview &&
        !seenIds.has(buildFeaturedItemId(m.mediaType, m.tmdbId || m.id))
    );

    const merged = [...adminPinned, ...fallbackSpotlights].slice(0, 5);
    setSpotlightList(merged.length > 0 ? merged : visibleTrending.slice(0, 5));
    setSpotlightIndex((prev) => (merged.length > 0 && prev >= merged.length ? 0 : prev));
  }, [featuredEntries, visibleTrending, visiblePopMovies, visiblePopTv, visibleTrendingAnime]);

  const currentHero = spotlightList[spotlightIndex] || visibleTrending[0];

  // Distribute new episodes into Today/Yesterday and This Week
  const latestEpisodes = useMemo(() => {
    const todayAndYesterday = newEpisodes.filter(e => e.releasePeriod === 'today' || e.releasePeriod === 'yesterday');
    return todayAndYesterday.length > 0 ? todayAndYesterday : newEpisodes.slice(0, 12);
  }, [newEpisodes]);

  const thisWeekEpisodes = useMemo(() => {
    const week = newEpisodes.filter(e => e.releasePeriod === 'this_week' || e.releasePeriod === 'recent');
    return week.length > 0 ? week : newEpisodes.slice(12, 24);
  }, [newEpisodes]);

  // Personalized Recommended For You driven by watch history, watchlist & recommendation profile
  const effectiveHistory = useMemo(
    () => (watchHistory && watchHistory.length > 0 ? watchHistory : getGuestWatchHistory()),
    [watchHistory]
  );
  const effectiveCompleted = useMemo(
    () => (completedMedia && completedMedia.length > 0 ? completedMedia : getGuestCompletedMedia()),
    [completedMedia]
  );
  const effectiveWatchlist = useMemo(
    () =>
      (watchlist && watchlist.length > 0 ? watchlist : getWatchlist()).map((w) => ({
        ...w,
        userId: (w as any).userId || user?.uid || 'guest',
        tmdbId: String(w.tmdbId || (w as any).id || '')
      })),
    [watchlist, user?.uid]
  );

  const hasPersonalSignals =
    effectiveHistory.length > 0 || effectiveWatchlist.length > 0 || effectiveCompleted.length > 0;

  const personalizedRecs = useMemo(() => {
    const candidates = [
      ...visibleTopMovies,
      ...visibleTopTv,
      ...visiblePopMovies,
      ...visiblePopTv,
      ...visibleTrendingAnime,
      ...visiblePopularAnime
    ];
    if (candidates.length === 0) return [];

    const recProfile = getRecommendationProfile(user?.uid);
    return rankPersonalizedRecommendations({
      candidates,
      history: effectiveHistory,
      completedMedia: effectiveCompleted,
      watchlist: effectiveWatchlist,
      profile: recProfile,
      limit: 16
    });
  }, [
    visibleTopMovies,
    visibleTopTv,
    visiblePopMovies,
    visiblePopTv,
    visibleTrendingAnime,
    visiblePopularAnime,
    user?.uid,
    effectiveHistory,
    effectiveCompleted,
    effectiveWatchlist
  ]);

  const recommendedList = useMemo(
    () => personalizedRecs.map((scored) => scored.item),
    [personalizedRecs]
  );

  const recommendedSubtitle = hasPersonalSignals
    ? 'Personalized from your watch history, watchlist & genre preferences'
    : 'Critically acclaimed films, series & anime picks';

  const hiddenGemsList = useMemo(() => {
    const recKeys = new Set(
      recommendedList.map((i) => `${i.mediaType}_${i.anilistId || i.tmdbId || i.id}`)
    );
    const trendingKeys = new Set(
      visibleTrending.slice(0, 10).map((i) => `${i.mediaType}_${i.tmdbId || i.id}`)
    );
    return [...visibleTopMovies, ...visibleTopTv, ...visibleSeasonalAnime]
      .filter((item) => {
        const k = `${item.mediaType}_${item.anilistId || item.tmdbId || item.id}`;
        return !recKeys.has(k) && !trendingKeys.has(k) && item.voteAverage >= 7.5;
      })
      .slice(0, 14);
  }, [recommendedList, visibleTrending, visibleTopMovies, visibleTopTv, visibleSeasonalAnime]);

  const alphabet = ['All', '0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  if (loading && !currentHero) {
    return (
      <div className="min-h-[70vh] bg-[#232326] flex items-center justify-center">
        <PageLoadingIndicator label="Loading curated releases and carousels..." />
      </div>
    );
  }

  const heroYear = currentHero?.releaseDate ? new Date(currentHero.releaseDate).getFullYear() : null;

  return (
    <div className="min-h-screen bg-[#232326] text-[#F3F3F3] flex flex-col font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Main Full-Width Content Container */}
      <div className="flex-1 w-full max-w-[1520px] mx-auto px-3 sm:px-5 lg:px-6 py-4 space-y-9">

        {/* 1. Featured Content Hero Spotlight Banner */}
        {currentHero && (
          <div className="relative w-full rounded-2xl overflow-hidden bg-[#29292D] border border-[#3A3A40] shadow-2xl group">
            <div className="relative h-[360px] sm:h-[400px] lg:h-[440px] w-full overflow-hidden select-none">
              {/* Backdrop Artwork */}
              <img
                src={resolveSafeImageSrc(currentHero.backdropPath || currentHero.posterPath)}
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

                {/* Clean Metadata Strip (No Fabricated Values) */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#A6A6AC] font-medium mb-2.5 tabular-nums">
                  {currentHero.voteAverage > 0 && (
                    <>
                      <span className="flex items-center gap-1 text-[#F5C400] font-bold">
                        ★ {currentHero.voteAverage.toFixed(1)}
                      </span>
                      <span aria-hidden="true" className="text-[#555560]">·</span>
                    </>
                  )}
                  <span>
                    {currentHero.mediaType === 'anime'
                      ? 'Anime'
                      : currentHero.mediaType === 'tv'
                      ? 'TV Series'
                      : 'Movie'}
                  </span>
                  {currentHero.runtime && currentHero.runtime > 0 ? (
                    <>
                      <span aria-hidden="true" className="text-[#555560]">·</span>
                      <span>{currentHero.runtime} min</span>
                    </>
                  ) : null}
                  {heroYear && !isNaN(heroYear) ? (
                    <>
                      <span aria-hidden="true" className="text-[#555560]">·</span>
                      <span>{heroYear}</span>
                    </>
                  ) : null}
                  <QualityBadge item={currentHero} variant="pill" />
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
              {spotlightList.length > 1 && (
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
              )}
            </div>
          </div>
        )}

        {/* 2. Continue Watching for Registered Users & Guests */}
        <ContinueWatchingSection
          onWatchMedia={onWatchMedia}
          onSelectMedia={onSelectMedia}
          variant="home"
        />

        {/* 3. Recommended For You (Personalized Multi-Signal Engine) */}
        {recommendedList.length > 0 && (
          <HomeCarousel
            title="Recommended For You"
            icon={Sparkles}
            badge={hasPersonalSignals ? 'Personalized' : undefined}
            subtitle={recommendedSubtitle}
            viewAllLink={{
              label: 'Explore Catalog',
              onClick: () => onNavigate('movies')
            }}
          >
            {recommendedList.map(item => (
              <LandscapeMediaCard
                key={`rec_${item.mediaType}_${item.anilistId || item.tmdbId || item.id}`}
                item={item}
                onSelectMedia={onSelectMedia}
                onWatchMedia={onWatchMedia}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 4. Top 10 Today Row with Bold Ranking Numbers */}
        {visibleTrending.length > 0 && (
          <TopTenSection
            items={visibleTrending}
            onSelectMedia={onSelectMedia}
            onWatchMedia={onWatchMedia}
          />
        )}

        {/* 5. Current & Upcoming TV Shows (Landscape 16:9 Cards) */}
        {visibleAiringToday.length > 0 && (
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
            {visibleAiringToday.map(item => (
              <LandscapeMediaCard
                key={`airing_${item.mediaType}_${item.id || item.tmdbId}`}
                item={item}
                badge="Broadcasting"
                onSelectMedia={onSelectMedia}
                onWatchMedia={onWatchMedia}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 6. Latest Released Episodes */}
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
                key={`ep_${ep.id}`}
                episode={ep}
                onSelectMedia={onSelectMedia}
                onWatchMedia={onWatchMedia}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 7. New Episodes This Week */}
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
                key={`wk_${ep.id}`}
                episode={ep}
                onSelectMedia={onSelectMedia}
                onWatchMedia={onWatchMedia}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 8. Trending Movies */}
        {visiblePopMovies.length > 0 && (
          <HomeCarousel
            title="Trending & Popular Movies"
            icon={Film}
            subtitle="Blockbusters and fan favorites"
            viewAllLink={{
              label: 'All Movies',
              onClick: () => onNavigate('movies')
            }}
          >
            {visiblePopMovies.map(item => (
              <div key={`mov_${item.id || item.tmdbId}`} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 9. Popular TV Shows */}
        {visiblePopTv.length > 0 && (
          <HomeCarousel
            title="Popular TV Shows"
            icon={Tv}
            subtitle="Binge-worthy series & ongoing seasons"
            viewAllLink={{
              label: 'All TV Shows',
              onClick: () => onNavigate('tv-shows')
            }}
          >
            {visiblePopTv.map(item => (
              <div key={`tv_${item.id || item.tmdbId}`} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* Lazy-load Intersection Sentinel for Non-Blocking Anime Shelves */}
        <div ref={animeTriggerRef} className="w-full h-px" aria-hidden="true" />

        {/* 10. Trending Anime (AniList) */}
        {visibleTrendingAnime.length > 0 && (
          <HomeCarousel
            title="Trending Anime"
            icon={Sparkles}
            badge="AniList"
            subtitle="Most popular simulcasts and seasonal anime streaming now"
            viewAllLink={{
              label: 'Anime Hub',
              onClick: () => onNavigate('anime', { section: 'trending' })
            }}
          >
            {visibleTrendingAnime.map(item => (
              <div key={`an_trend_${item.anilistId || item.id}`} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 11. Popular This Season Anime */}
        {(visibleSeasonalAnime.length > 0 || visiblePopularAnime.length > 0) && (
          <HomeCarousel
            title={visibleSeasonalAnime.length > 0 ? 'Anime This Season' : 'Popular Anime'}
            icon={Flame}
            subtitle="Currently airing cour highlights and fan-favorite series"
            viewAllLink={{
              label: 'Seasonal Schedule',
              onClick: () => onNavigate('anime', { section: visibleSeasonalAnime.length > 0 ? 'seasonal' : 'popular' })
            }}
          >
            {(visibleSeasonalAnime.length > 0 ? visibleSeasonalAnime : visiblePopularAnime).map(item => (
              <div key={`an_seas_${item.anilistId || item.id}`} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 12. Anime Movies */}
        {visibleAnimeMovies.length > 0 && (
          <HomeCarousel
            title="Anime Films"
            icon={Film}
            subtitle="Acclaimed theatrical animation and standalone features"
            viewAllLink={{
              label: 'All Anime Movies',
              onClick: () => onNavigate('anime', { section: 'movies' })
            }}
          >
            {visibleAnimeMovies.map(item => (
              <div key={`an_mov_${item.anilistId || item.id}`} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 13. Streaming Platform Collections */}
        <PlatformSection
          onSelectMedia={onSelectMedia}
          onWatchMedia={onWatchMedia}
          onNavigate={onNavigate}
        />

        {/* 14. Movie Collections & Franchises */}
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
                key={`col_${col.id}`}
                collection={col}
                onClick={(selected) => onNavigate('collections', { collectionId: selected.id })}
              />
            ))}
          </HomeCarousel>
        )}

        {/* 15. Top Rated & Hidden Gems */}
        {hiddenGemsList.length > 0 && (
          <HomeCarousel
            title="Top Rated & Hidden Gems"
            icon={Award}
            subtitle="Highest rated cinema, television & animation masterpieces"
            viewAllLink={{
              label: 'Explore Top Rated',
              onClick: () => onNavigate('top-rated')
            }}
          >
            {hiddenGemsList.map(item => (
              <div key={`gem_${item.mediaType}_${item.anilistId || item.tmdbId || item.id}`} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
                <MediaCard
                  item={item}
                  onSelect={onSelectMedia}
                  onWatch={onWatchMedia}
                />
              </div>
            ))}
          </HomeCarousel>
        )}

        {/* 16. Popular Genres */}
        <HomeCarousel
          title="Popular Genres"
          icon={Compass}
          subtitle="Explore cinema, TV & anime by category"
        >
          {POPULAR_GENRES.map(genre => (
            <GenreCard
              key={genre.id}
              genre={genre}
              onClick={(genreId) => onNavigate('genre', { genreId, genreSlug: genreToSlug(genreId) })}
            />
          ))}
        </HomeCarousel>

        {/* 17. Top Upcoming Releases */}
        {visibleUpcoming.length > 0 && (
          <HomeCarousel
            title="Top Upcoming Releases"
            icon={Calendar}
            subtitle="Anticipated releases coming soon to cinema and streaming"
          >
            {visibleUpcoming.map(item => (
              <div key={`up_${item.id || item.tmdbId}`} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
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
