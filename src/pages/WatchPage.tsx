import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Star,
  Film,
  Tv,
  Bookmark,
  Share2,
  Play,
  Check,
  AlertTriangle,
  X,
  Send,
  Sparkles,
  Maximize2,
  Moon,
  Volume2,
  BellRing
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MediaDetail, MediaItem, TVDetail, Episode } from '../types/media';
import { getMediaDetail, fetchSeasonEpisodes } from '../services/tmdb';
import { isInWatchlist, toggleWatchlist } from '../services/storage';
import { StreamingPlayer, PlayerMode, WebServer } from '../components/StreamingPlayer';
import { RatingViewsBar } from '../components/RatingViewsBar';
import { QualityBadge } from '../components/QualityBadge';
import { PlayerLoadingSpinner } from '../components/PlayerLoadingSpinner';
import { ShareModal } from '../components/ShareModal';
import { ReportIssueModal } from '../components/ReportIssueModal';
import { EmbedServerConfig, subscribeToEmbedServers, resolveEmbedUrl, DEFAULT_SERVERS } from '../services/embedServers';
import { getUserPlayerSettings } from '../services/playerSettings';
import { createMediaSlug } from '../utils/slug';
import { updateMediaSEO, updateSEO } from '../utils/seo';

interface WatchPageProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  onBackToDetails: (media?: MediaItem) => void;
  onSelectMedia: (item: MediaItem) => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({
  mediaId,
  mediaType,
  season = 1,
  episode = 1,
  onBackToDetails,
  onSelectMedia
}) => {
  const { user, toggleFollowShow, isFollowingShow } = useAuth();
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [currentSeason, setCurrentSeason] = useState(season);
  const [currentEpisode, setCurrentEpisode] = useState(episode);
  const [loading, setLoading] = useState(true);

  // Player & Server states from user settings
  const userSettings = getUserPlayerSettings();
  const [playerMode, setPlayerMode] = useState<PlayerMode>(() => {
    return userSettings.defaultServerId === 'server_1_direct' ? 'direct' : 'web';
  });
  const [activeWebServer, setActiveWebServer] = useState<WebServer>(() => {
    return (userSettings.defaultServerId as WebServer) || 'fmov';
  });
  const [servers, setServers] = useState<EmbedServerConfig[]>(DEFAULT_SERVERS);
  const [selectedServerId, setSelectedServerId] = useState<string>(userSettings.defaultServerId || 'server_1_direct');
  const [customEmbedUrl, setCustomEmbedUrl] = useState<string | undefined>(undefined);

  // Cinema UI Controls
  const [isTheaterMode, setIsTheaterMode] = useState(userSettings.defaultTheaterMode || false);
  const [isLightsDimmed, setIsLightsDimmed] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Report a problem modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Subscribe to real-time configured embed servers (Admin managed)
  useEffect(() => {
    const unsub = subscribeToEmbedServers((data) => {
      const enabledOnly = data.filter((s) => s.enabled);
      setServers(enabledOnly.length > 0 ? enabledOnly : DEFAULT_SERVERS);
    });
    return () => unsub();
  }, []);

  // TV Episodes cache
  const [episodesMap, setEpisodesMap] = useState<Record<number, Episode[]>>({});
  const [, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);
  }, [season, episode]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      window.scrollTo({ top: 0, behavior: 'instant' as any });
      const data = await getMediaDetail(mediaId, mediaType);
      if (isMounted) {
        setDetail(data);
        if (data) {
          const initSeasonEps =
            data.mediaType === 'tv'
              ? (data as TVDetail).seasons?.find(s => s.seasonNumber === currentSeason)?.episodes || []
              : [];
          const initEp = initSeasonEps.find(e => e.episodeNumber === currentEpisode);
          updateMediaSEO(data, {
            season: currentSeason,
            episode: currentEpisode,
            episodeName: initEp?.name,
            episodeOverview: initEp?.overview,
            episodeAirDate: initEp?.airDate,
            episodeVoteAverage: initEp?.voteAverage,
            episodeVoteCount: (initEp as any)?.voteCount,
            isVerifiedEpisode: Boolean(initEp),
            isWatching: true
          });
          setInWatchlist(isInWatchlist(data.id));
          const slug = createMediaSlug(data.title || (data as any).name, data.id);
          if (data.mediaType === 'movie') {
            const expectedUrl = `/watch/movie/${slug}`;
            if (window.location.pathname !== expectedUrl) {
              window.history.replaceState({}, '', expectedUrl);
            }
          } else {
            const expectedUrl = `/watch/tv/${slug}/${season}/${episode}`;
            if (!window.location.pathname.includes(slug)) {
              window.history.replaceState({}, '', expectedUrl);
            }
          }

          // Check if default server is an embed server
          if (userSettings.defaultServerId && userSettings.defaultServerId !== 'server_1_direct') {
            const srv = DEFAULT_SERVERS.find(s => s.id === userSettings.defaultServerId);
            if (srv && srv.type === 'embed') {
              const template = data.mediaType === 'movie' ? srv.movieUrlTemplate : srv.tvUrlTemplate;
              const url = template
                ? resolveEmbedUrl(template, {
                    id: data.id,
                    season: currentSeason,
                    episode: currentEpisode
                  })
                : '';
              setCustomEmbedUrl(url || undefined);
              setPlayerMode('web');
              setActiveWebServer(srv.id as WebServer);
            }
          }
        } else {
          updateSEO({
            title: '404 — Title Not Found',
            description: 'The requested movie or episode could not be found on T Stream.',
            noindex: true,
            url: '/404'
          });
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [mediaId, mediaType]);

  // Update SEO when TV season/episode changes or episodes load
  useEffect(() => {
    if (detail && detail.mediaType === 'tv') {
      const seasonEps = episodesMap[currentSeason] || (detail as TVDetail).seasons?.find(s => s.seasonNumber === currentSeason)?.episodes || [];
      const activeEp = seasonEps.find(e => e.episodeNumber === currentEpisode);
      updateMediaSEO(detail, {
        season: currentSeason,
        episode: currentEpisode,
        episodeName: activeEp?.name,
        episodeOverview: activeEp?.overview,
        episodeAirDate: activeEp?.airDate,
        episodeVoteAverage: activeEp?.voteAverage,
        episodeVoteCount: (activeEp as any)?.voteCount,
        isVerifiedEpisode: Boolean(activeEp),
        isWatching: true
      });
    }
  }, [currentSeason, currentEpisode, detail, episodesMap]);

  // Load TV episodes for the season if series
  useEffect(() => {
    if (!detail || detail.mediaType === 'movie') return;
    let isMounted = true;
    const tv = detail as TVDetail;
    const currentSeasonObj = tv.seasons?.find(s => s.seasonNumber === currentSeason);

    if (currentSeasonObj?.episodes && currentSeasonObj.episodes.length > 0) {
      setEpisodesMap(prev => (prev[currentSeason]?.length ? prev : { ...prev, [currentSeason]: currentSeasonObj.episodes! }));
      return;
    }

    if (episodesMap[currentSeason]) return;

    setLoadingEpisodes(true);
    fetchSeasonEpisodes(detail.id, currentSeason)
      .then(eps => {
        if (isMounted) {
          setEpisodesMap(prev => ({ ...prev, [currentSeason]: eps }));
        }
      })
      .finally(() => {
        if (isMounted) setLoadingEpisodes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [detail, currentSeason]);

  const handleEpisodeChange = (s: number, e: number) => {
    setCurrentSeason(s);
    setCurrentEpisode(e);
    if (detail) {
      const slug = createMediaSlug(detail.title || (detail as any).name, detail.id);
      window.history.replaceState({}, '', `/watch/tv/${slug}/${s}/${e}`);
    }
  };

  const handleToggleWatchlist = () => {
    if (!detail) return;
    const added = toggleWatchlist({
      id: detail.id,
      mediaType: detail.mediaType,
      title: detail.title,
      posterPath: detail.posterPath,
      backdropPath: detail.backdropPath,
      releaseDate: detail.releaseDate,
      voteAverage: detail.voteAverage
    });
    setInWatchlist(added);
    showToast(added ? 'Saved to Your Watchlist' : 'Removed from Watchlist');
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  const handleFollowToggle = async () => {
    if (!detail) return;
    const nowFollowing = await toggleFollowShow({
      id: detail.id,
      mediaType: 'tv',
      title: detail.title,
      posterPath: detail.posterPath,
      backdropPath: detail.backdropPath,
      voteAverage: detail.voteAverage
    });
    showToast(nowFollowing ? 'Following series for new episode alerts' : 'Unfollowed series');
  };

  const isFollowing = detail ? isFollowingShow(detail.id) : false;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectServerConfig = (srv: EmbedServerConfig) => {
    setSelectedServerId(srv.id);
    if (srv.type === 'direct') {
      setPlayerMode('direct');
      setCustomEmbedUrl(undefined);
      showToast(`Connected to ${srv.name}`);
    } else {
      const template = detail?.mediaType === 'movie' ? srv.movieUrlTemplate : srv.tvUrlTemplate;
      const url = template
        ? resolveEmbedUrl(template, {
            id: detail?.id || mediaId,
            season: currentSeason,
            episode: currentEpisode
          })
        : '';
      setCustomEmbedUrl(url || undefined);
      setPlayerMode('web');
      setActiveWebServer(srv.id);
      showToast(`Connected to ${srv.name}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#121215]">
        <PlayerLoadingSpinner
          title="Initializing Cinema Stream"
          subtitle="Loading high definition streams, audio tracks, and multilingual subtitles..."
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#121215] px-4 py-16">
        <div className="text-center max-w-lg mx-auto">
          <div className="text-7xl font-black text-[#F5C400] mb-3">404</div>
          <h1 className="text-3xl font-extrabold text-white mb-3">Title Not Found</h1>
          <p className="text-sm text-[#A6A6AC] mb-8 leading-relaxed">
            The movie or television episode you requested could not be found.
          </p>
          <button
            onClick={() => onBackToDetails()}
            className="px-6 py-2.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Browse Catalog
          </button>
        </div>
      </div>
    );
  }

  const isMovie = detail.mediaType === 'movie';
  const tvDetail = !isMovie ? (detail as TVDetail) : null;
  const currentSeasonData = tvDetail?.seasons?.find(s => s.seasonNumber === currentSeason) || tvDetail?.seasons?.[0];

  const releaseYear = detail.releaseDate ? new Date(detail.releaseDate).getFullYear() : '2026';
  const runtimeFormatted = detail.runtime
    ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m`
    : '2h 15m';

  const genresDisplay = detail.genres && detail.genres.length > 0
    ? detail.genres.slice(0, 3).map(g => g.name).join(' · ')
    : 'Action · Adventure · Sci-Fi';

  // Recommendations: prioritize high-rating items with backdrops (3 landscape cards)
  const recommendations = (detail.recommendations && detail.recommendations.length > 0)
    ? detail.recommendations.slice(0, 3)
    : [];

  return (
    <div className="relative min-h-screen bg-[#121215] text-[#F3F3F3] pb-24 transition-colors duration-500 font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Lights Off Dimming Overlay */}
      {isLightsDimmed && (
        <div
          onClick={() => setIsLightsDimmed(false)}
          className="fixed inset-0 z-20 bg-black/85 backdrop-blur-xs transition-opacity duration-500 cursor-pointer"
          title="Click anywhere to turn lights back on"
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#232326] border border-[#F5C400]/40 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200">
          <Check className="w-4 h-4 text-[#F5C400]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          MAIN WATCH CONTAINER (Matching uploaded Spider-Man Watch Page mockup)
         ========================================================================= */}
      <div
        className={`mx-auto transition-all duration-300 pt-5 sm:pt-7 ${
          isTheaterMode
            ? 'w-full max-w-[1920px] px-3 sm:px-6'
            : 'max-w-[1440px] px-3 sm:px-6 lg:px-8'
        }`}
      >
        {/* 1. Breadcrumbs Navigation */}
        <div className="flex items-center gap-2 text-xs text-[#A6A6AC] font-medium mb-4">
          <button
            onClick={() => onBackToDetails(detail)}
            className="hover:text-white transition-colors cursor-pointer"
          >
            {isMovie ? 'Movie Details' : 'Series Details'}
          </button>
          <span className="text-[#55555c]">/</span>
          <button
            onClick={() => onBackToDetails(detail)}
            className="hover:text-white transition-colors cursor-pointer"
          >
            {isMovie ? 'Movies' : 'TV Shows'}
          </button>
          <span className="text-[#55555c]">/</span>
          <span className="text-slate-300 font-semibold truncate max-w-xs sm:max-w-md">
            {detail.title}
          </span>
        </div>

        {/* 2. Movie Information Header (Directly above the player) */}
        <div className="flex items-start gap-4 mb-5">
          {/* Movie Poster Thumbnail */}
          <div className="w-14 sm:w-16 h-20 sm:h-24 rounded-xl overflow-hidden bg-[#16161a] border border-[#3A3A40] shadow-lg shrink-0">
            {detail.posterPath ? (
              <img
                src={detail.posterPath}
                alt={detail.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#232326] text-slate-500">
                <Film className="w-6 h-6" />
              </div>
            )}
          </div>

          {/* Title & Metadata Line & Badges */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight truncate">
              {detail.title}
              {!isMovie && (
                <span className="text-[#F5C400] font-bold text-lg sm:text-xl ml-2">
                  (Season {currentSeason}, Ep. {currentEpisode})
                </span>
              )}
            </h1>

            {/* Metadata Line: Year · Runtime · Genres */}
            <div className="flex items-center gap-2 text-xs text-[#A6A6AC] mt-1.5 flex-wrap font-medium">
              <span>{releaseYear}</span>
              <span className="text-[#55555c]">·</span>
              <span>{isMovie ? runtimeFormatted : `${currentSeasonData?.episodeCount || 8} Episodes`}</span>
              <span className="text-[#55555c]">·</span>
              <span className="text-slate-300">{genresDisplay}</span>
            </div>

            {/* Badges: Star Rating, HD, CC */}
            <div className="flex items-center gap-2 mt-2.5">
              {/* Star Rating Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1f1f25] border border-[#3A3A40] text-xs font-bold text-[#F5C400]">
                <Star className="w-3.5 h-3.5 fill-[#F5C400] text-[#F5C400]" />
                <span className="text-white font-extrabold">{detail.voteAverage.toFixed(1)}</span>
              </div>

              {/* Real Quality Badge */}
              <QualityBadge item={detail} variant="full" />

              {/* Closed Captions Badge */}
              <div className="px-2 py-0.5 rounded-md bg-[#1f1f25] border border-[#3A3A40] text-[11px] font-extrabold text-white uppercase tracking-wider">
                CC
              </div>
            </div>
          </div>
        </div>

        {/* 3. Premium Video Player (The Main Attraction) */}
        <div className="relative z-30">
          <StreamingPlayer
            media={detail}
            initialSeason={currentSeason}
            initialEpisode={currentEpisode}
            onEpisodeChange={handleEpisodeChange}
            isTheaterMode={isTheaterMode}
            onToggleTheater={() => setIsTheaterMode(prev => !prev)}
            isLightsDimmed={isLightsDimmed}
            onToggleLights={() => setIsLightsDimmed(prev => !prev)}
            playerMode={playerMode}
            onPlayerModeChange={(m) => setPlayerMode(m)}
            webServer={activeWebServer}
            onWebServerChange={(s) => setActiveWebServer(s)}
            customEmbedUrl={customEmbedUrl}
          />
        </div>

        {/* 4. Compact Modern Server Selection Bar (Directly below player) */}
        <div className="mt-3.5 px-4 py-3 rounded-xl bg-[#16161a] border border-[#303036] shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#A6A6AC] mr-1">
              CHOOSE A SERVER
            </span>

            {/* Dynamic Server Pills */}
            {servers.map((srv) => {
              const isActive = selectedServerId === srv.id;
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => handleSelectServerConfig(srv)}
                  className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#23232a] text-white border border-[#F5C400] ring-1 ring-[#F5C400]/40 shadow-sm'
                      : 'bg-[#1b1b20] text-[#A6A6AC] hover:text-white border border-[#303036] hover:bg-[#232328]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'shadow-[0_0_8px_rgba(245,196,0,0.8)]' : ''
                    }`}
                    style={{ backgroundColor: srv.dotColor || '#F5C400' }}
                  />
                  <span>{srv.name}</span>
                </button>
              );
            })}
          </div>

          {/* Discreet Report a problem button */}
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-[#F5C400] hover:text-[#ffdc40] transition-colors cursor-pointer ml-auto"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#F5C400]" />
            <span>Report a problem</span>
          </button>
        </div>

        {/* Rating & Real Views Bar (Matching Slika 2) */}
        <div className="mt-4 pt-3.5 pb-2.5 px-4 rounded-xl bg-[#16161a]/60 border border-[#26262c] flex items-center justify-between">
          <RatingViewsBar
            mediaId={detail.id}
            mediaType={detail.mediaType}
            mediaTitle={detail.title}
            onOpenReport={() => setReportModalOpen(true)}
          />
        </div>

        {/* TV Series Episode & Season Navigation (if TV Series) */}
        {!isMovie && tvDetail && tvDetail.seasons && (
          <div className="mt-4 p-4 rounded-xl bg-[#16161a] border border-[#303036]">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-[#F5C400]" />
                <span className="text-xs font-extrabold uppercase text-white tracking-wider">
                  Select Season &amp; Episode:
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {tvDetail.seasons.filter(s => s.seasonNumber > 0).map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrentSeason(s.seasonNumber);
                      setCurrentEpisode(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      s.seasonNumber === currentSeason
                        ? 'bg-[#F5C400] text-black font-black'
                        : 'bg-[#232328] text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    S{s.seasonNumber}
                  </button>
                ))}
              </div>
            </div>

            {/* Episode Pills */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5 max-h-44 overflow-y-auto no-scrollbar pt-1">
              {Array.from({ length: currentSeasonData?.episodeCount || 8 }, (_, i) => i + 1).map(epNum => (
                <button
                  key={epNum}
                  onClick={() => setCurrentEpisode(epNum)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer ${
                    epNum === currentEpisode
                      ? 'bg-[#F5C400] text-black font-black ring-1 ring-[#F5C400]'
                      : 'bg-[#232328] hover:bg-[#2e2e36] text-slate-300'
                  }`}
                >
                  Ep. {epNum}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. Movie Details & Recommendations (Clean 2-Column Layout matching mockup) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Synopsis & Action Buttons (lg:col-span-6) */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {detail.overview || 'Peter Parker faces a new and dangerous threat in New York, forcing him to confront his past while protecting the people he loves most.'}
            </p>

            {/* Action buttons: + My List, Share */}
            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={handleToggleWatchlist}
                className="h-10 px-6 rounded-full border border-[#3A3A40] bg-[#1e1e24] hover:bg-[#282830] text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-[#F5C400]/60"
              >
                {inWatchlist ? (
                  <>
                    <Check className="w-4 h-4 text-[#F5C400]" />
                    <span>In My List</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4 text-slate-300" />
                    <span>My List</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="h-10 px-6 rounded-full border border-[#3A3A40] bg-[#1e1e24] hover:bg-[#282830] text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-[#F5C400]/60"
              >
                <Share2 className="w-4 h-4 text-slate-300" />
                <span>Share</span>
              </button>

              {/* Follow Series Toggle for TV Shows */}
              {!isMovie && (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  className={`h-10 px-5 rounded-full border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isFollowing
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 hover:bg-amber-500/30'
                      : 'border-[#3A3A40] bg-[#1e1e24] hover:bg-[#282830] text-slate-300 hover:text-white hover:border-[#F5C400]/60'
                  }`}
                  title={isFollowing ? 'Following series (click to unfollow)' : 'Follow series for new episode alerts'}
                >
                  <BellRing className={`w-4 h-4 ${isFollowing ? 'text-amber-400 fill-amber-400/20' : 'text-slate-400'}`} />
                  <span>{isFollowing ? 'Following Series' : 'Follow Series'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: YOU MAY ALSO LIKE (lg:col-span-6) */}
          <div className="lg:col-span-6">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3.5">
              YOU MAY ALSO LIKE
            </h3>

            {/* 3 Horizontal Landscape Cards matching mockup */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {recommendations.length > 0 ? (
                recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => onSelectMedia(rec)}
                    className="group cursor-pointer flex flex-col"
                  >
                    {/* Landscape 16:9 Image Thumbnail */}
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-[#1e1e24] border border-[#3A3A40]/80 relative shadow-md group-hover:border-[#F5C400]/60 transition-colors">
                      <img
                        src={rec.backdropPath || rec.posterPath}
                        alt={rec.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors truncate mt-2 leading-tight">
                      {rec.title}
                    </h4>

                    {/* Year & Duration */}
                    <p className="text-[11px] text-[#A6A6AC] mt-0.5">
                      {rec.releaseDate ? new Date(rec.releaseDate).getFullYear() : '2021'} · {rec.runtime ? `${Math.floor(rec.runtime / 60)}h ${rec.runtime % 60}m` : 'HD'}
                    </p>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-xs text-slate-500 py-4 text-center">
                  Loading recommended movies...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NOTE: CAST SECTION HAS BEEN COMPLETELY REMOVED PER USER REQUIREMENT */}
      </div>

      {/* Universal Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={detail.title}
        overview={detail.overview}
      />

      {/* Report a Problem Modal connected to live Firestore */}
      <ReportIssueModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        mediaId={detail.id}
        mediaType={detail.mediaType}
        mediaTitle={detail.title}
        currentServer={
          servers.find((s) => s.id === selectedServerId)?.name || 'TStream Server (Direktan Stream)'
        }
      />
    </div>
  );
};
