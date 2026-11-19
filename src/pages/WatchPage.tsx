import React, { useState, useEffect, useRef } from 'react';
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
import { MediaDetail, MediaItem, MediaType, TVDetail, AnimeDetail, Episode } from '../types/media';
import { getMediaDetail, fetchSeasonEpisodes } from '../services/tmdb';
import { getAnimeDetailById } from '../services/animeCatalog';
import { isInWatchlist, toggleWatchlist } from '../services/storage';
import { StreamingPlayer, PlayerMode, WebServer } from '../components/StreamingPlayer';
import { QualityBadge } from '../components/QualityBadge';
import { PlayerLoadingSpinner } from '../components/PlayerLoadingSpinner';
import { ShareModal } from '../components/ShareModal';
import { ReportIssueModal } from '../components/ReportIssueModal';
import {
  EmbedServerConfig,
  DefaultServerPreferences,
  subscribeToEmbedServers,
  subscribeToDirectStreamEnabled,
  subscribeToDefaultServerPreferences,
  getDirectStreamEnabled,
  getDefaultServerPreferences,
  pickEffectiveDefaultServer,
  resolveEmbedUrl,
  DEFAULT_SERVERS
} from '../services/embedServers';
import { getUserPlayerSettings } from '../services/playerSettings';
import { getQualityPillClasses } from '../services/directStreamClient';
import { createMediaSlug } from '../utils/slug';
import { updateMediaSEO, updateSEO } from '../utils/seo';

interface WatchPageProps {
  mediaId: number;
  mediaType: MediaType;
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

  // Player & Server states from user settings & admin toggle
  const userSettings = getUserPlayerSettings();
  const [directStreamEnabled, setDirectStreamEnabled] = useState<boolean>(() => getDirectStreamEnabled());
  const [defaultServerPrefs, setDefaultServerPrefs] = useState<DefaultServerPreferences>(() =>
    getDefaultServerPreferences()
  );
  const [servers, setServers] = useState<EmbedServerConfig[]>(DEFAULT_SERVERS);
  const initialDefaultSrv = pickEffectiveDefaultServer(
    mediaType,
    DEFAULT_SERVERS,
    getDirectStreamEnabled(),
    getDefaultServerPreferences()
  );
  const [playerMode, setPlayerMode] = useState<PlayerMode>(() =>
    initialDefaultSrv.type === 'direct' && getDirectStreamEnabled() ? 'direct' : 'web'
  );
  const [activeWebServer, setActiveWebServer] = useState<WebServer>(() =>
    initialDefaultSrv.type === 'embed' ? (initialDefaultSrv.id as WebServer) : 'fmov'
  );
  const [selectedServerId, setSelectedServerId] = useState<string>(() => initialDefaultSrv.id);
  const [customEmbedUrl, setCustomEmbedUrl] = useState<string | undefined>(undefined);
  const [liveDirectQualityBadge, setLiveDirectQualityBadge] = useState<string | null>(null);

  // Cinema UI Controls
  const [isTheaterMode, setIsTheaterMode] = useState(userSettings.defaultTheaterMode || false);
  const [isLightsDimmed, setIsLightsDimmed] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Report a problem modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Subscribe to real-time configured embed servers, Direct Stream toggle, & Movie/TV default server preferences
  useEffect(() => {
    const unsubServers = subscribeToEmbedServers((data) => {
      setServers(data.length > 0 ? data : DEFAULT_SERVERS);
    });
    const unsubDirect = subscribeToDirectStreamEnabled((enabled) => {
      setDirectStreamEnabled(enabled);
    });
    const unsubPrefs = subscribeToDefaultServerPreferences((prefs) => {
      setDefaultServerPrefs(prefs);
    });
    return () => {
      unsubServers();
      unsubDirect();
      unsubPrefs();
    };
  }, []);

  // TV Episodes cache
  const [episodesMap, setEpisodesMap] = useState<Record<number, Episode[]>>({});
  const [, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    setLiveDirectQualityBadge(null);
  }, [season, episode]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setLiveDirectQualityBadge(null);
      window.scrollTo({ top: 0, behavior: 'instant' as any });
      const data = mediaType === 'anime'
        ? await getAnimeDetailById(mediaId)
        : await getMediaDetail(mediaId, mediaType);
      if (isMounted) {
        setDetail(data);
        if (data) {
          const isEpisodic = data.mediaType === 'tv' || (data.mediaType === 'anime' && data.mediaFormat !== 'MOVIE');
          const initSeasonObj = isEpisodic
            ? (data as TVDetail | AnimeDetail).seasons?.find(s => s.seasonNumber === currentSeason) || (data as TVDetail | AnimeDetail).seasons?.[0]
            : undefined;
          const initSeasonEps = initSeasonObj?.episodes || [];
          const initEp = initSeasonEps.find(e => e.episodeNumber === currentEpisode);
          updateMediaSEO(data, {
            seriesId: data.anilistId || data.id,
            episodeId: initEp?.id,
            season: currentSeason,
            episode: currentEpisode,
            seasonEpisodeCount: initSeasonObj?.episodeCount,
            numberOfSeasons: (data as TVDetail).numberOfSeasons,
            seasonOverview: initSeasonObj?.overview,
            episodeName: initEp?.name,
            episodeOverview: initEp?.overview,
            episodeAirDate: initEp?.airDate,
            episodeVoteAverage: initEp?.voteAverage,
            episodeVoteCount: (initEp as any)?.voteCount,
            isVerifiedEpisode: Boolean(initEp && Number.isInteger(initEp.id) && initEp.id > 0),
            isWatching: true
          });
          setInWatchlist(isInWatchlist(data.anilistId || data.id));
          const slug = createMediaSlug(data.title || (data as any).name, data.anilistId || data.id);
          if (data.mediaType === 'movie') {
            const expectedUrl = `/watch/movie/${slug}`;
            if (window.location.pathname !== expectedUrl) {
              window.history.replaceState({}, '', expectedUrl);
            }
          } else if (data.mediaType === 'anime') {
            const expectedUrl = data.mediaFormat === 'MOVIE' ? `/watch/anime/${slug}` : `/watch/anime/${slug}/${episode}`;
            if (!window.location.pathname.includes(slug)) {
              window.history.replaceState({}, '', expectedUrl);
            }
          } else {
            const expectedUrl = `/watch/tv/${slug}/${season}/${episode}`;
            if (!window.location.pathname.includes(slug)) {
              window.history.replaceState({}, '', expectedUrl);
            }
          }

          // Initial player mode & server sync based on Admin's Movie/TV default settings
          const embedTargetId = data.mediaType === 'anime' ? (data.tmdbId || 0) : data.id;
          const chosenDefault = pickEffectiveDefaultServer(
            data.mediaType,
            servers,
            directStreamEnabled,
            defaultServerPrefs
          );
          if ((chosenDefault.type === 'embed' || !directStreamEnabled) && (data.mediaType !== 'anime' || embedTargetId > 0)) {
            const isSingleFeature = data.mediaType === 'movie' || data.mediaFormat === 'MOVIE';
            const template = isSingleFeature ? chosenDefault.movieUrlTemplate : chosenDefault.tvUrlTemplate;
            const url = template && embedTargetId > 0
              ? resolveEmbedUrl(template, {
                  id: embedTargetId,
                  season: currentSeason,
                  episode: currentEpisode
                })
              : '';
            setSelectedServerId(chosenDefault.id);
            setCustomEmbedUrl(url || undefined);
            setPlayerMode('web');
            setActiveWebServer(chosenDefault.id as WebServer);
          } else {
            setSelectedServerId(chosenDefault.id);
            setCustomEmbedUrl(undefined);
            setPlayerMode('direct');
          }
        } else {
          updateSEO({
            title: '404 — Title Not Found',
            description: 'The requested movie, anime, or episode could not be found on T Stream.',
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
    if (detail && (detail.mediaType === 'tv' || (detail.mediaType === 'anime' && detail.mediaFormat !== 'MOVIE'))) {
      const seasonObj = (detail as TVDetail | AnimeDetail).seasons?.find(s => s.seasonNumber === currentSeason);
      const seasonEps = episodesMap[currentSeason] || seasonObj?.episodes || [];
      const activeEp = seasonEps.find(e => e.episodeNumber === currentEpisode);
      updateMediaSEO(detail, {
        seriesId: detail.anilistId || detail.id,
        episodeId: activeEp?.id,
        season: currentSeason,
        episode: currentEpisode,
        seasonEpisodeCount: seasonObj?.episodeCount,
        numberOfSeasons: (detail as TVDetail).numberOfSeasons,
        seasonOverview: seasonObj?.overview,
        episodeName: activeEp?.name,
        episodeOverview: activeEp?.overview,
        episodeAirDate: activeEp?.airDate,
        episodeVoteAverage: activeEp?.voteAverage,
        episodeVoteCount: (activeEp as any)?.voteCount,
        isVerifiedEpisode: Boolean(activeEp && Number.isInteger(activeEp.id) && activeEp.id > 0),
        isWatching: true
      });
    }
  }, [currentSeason, currentEpisode, detail, episodesMap]);

  // Load TV or Anime episodes for the season if series
  useEffect(() => {
    if (!detail || detail.mediaType === 'movie' || detail.mediaFormat === 'MOVIE') return;
    let isMounted = true;
    const tv = detail as TVDetail | AnimeDetail;
    const currentSeasonObj = tv.seasons?.find(s => s.seasonNumber === currentSeason);

    if (currentSeasonObj?.episodes && currentSeasonObj.episodes.length > 0) {
      setEpisodesMap(prev => (prev[currentSeason]?.length ? prev : { ...prev, [currentSeason]: currentSeasonObj.episodes! }));
      return;
    }

    if (detail.mediaType === 'anime') return;
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

  const prevDirectEnabledRef = useRef<boolean>(directStreamEnabled);
  const prevDefaultServerForTypeRef = useRef<string>(
    mediaType === 'movie' ? defaultServerPrefs.movieServerId : defaultServerPrefs.tvServerId
  );

  // Synchronize WatchPage mode & embed URL whenever Admin toggles Direct Stream, changes Movie/TV default server, or user changes season/episode
  useEffect(() => {
    const justEnabledDirect = !prevDirectEnabledRef.current && directStreamEnabled;
    prevDirectEnabledRef.current = directStreamEnabled;

    const currentPrefServerId =
      mediaType === 'movie' ? defaultServerPrefs.movieServerId : defaultServerPrefs.tvServerId;
    const prefChangedByAdmin = prevDefaultServerForTypeRef.current !== currentPrefServerId;
    prevDefaultServerForTypeRef.current = currentPrefServerId;

    const embedPool = servers.filter((s) => s.type === 'embed' && s.enabled);
    const fallbackEmbeds = DEFAULT_SERVERS.filter((s) => s.type === 'embed');
    const pool = embedPool.length > 0 ? embedPool : fallbackEmbeds;

    if (!directStreamEnabled || justEnabledDirect || prefChangedByAdmin) {
      const effectiveDefault = pickEffectiveDefaultServer(
        mediaType,
        servers,
        directStreamEnabled,
        defaultServerPrefs
      );

      if (!directStreamEnabled) {
        const chosen = pool.find((s) => s.id === selectedServerId) || effectiveDefault;
        if (chosen) {
          const template = mediaType === 'movie' ? chosen.movieUrlTemplate : chosen.tvUrlTemplate;
          const url = template
            ? resolveEmbedUrl(template, {
                id: detail?.id || mediaId,
                season: currentSeason,
                episode: currentEpisode
              })
            : '';
          const resolvedUrl = url || undefined;
          if (chosen.id !== selectedServerId) setSelectedServerId(chosen.id);
          if (resolvedUrl !== customEmbedUrl) setCustomEmbedUrl(resolvedUrl);
          if (chosen.id !== activeWebServer) setActiveWebServer(chosen.id as WebServer);
          if (playerMode !== 'web') setPlayerMode('web');
        }
        return;
      }

      if (effectiveDefault.type === 'embed') {
        const template = mediaType === 'movie' ? effectiveDefault.movieUrlTemplate : effectiveDefault.tvUrlTemplate;
        const url = template
          ? resolveEmbedUrl(template, {
              id: detail?.id || mediaId,
              season: currentSeason,
              episode: currentEpisode
            })
          : '';
        const resolvedUrl = url || undefined;
        if (effectiveDefault.id !== selectedServerId) setSelectedServerId(effectiveDefault.id);
        if (resolvedUrl !== customEmbedUrl) setCustomEmbedUrl(resolvedUrl);
        if (effectiveDefault.id !== activeWebServer) setActiveWebServer(effectiveDefault.id as WebServer);
        if (playerMode !== 'web') setPlayerMode('web');
      } else {
        if (effectiveDefault.id !== selectedServerId) setSelectedServerId(effectiveDefault.id);
        if (customEmbedUrl !== undefined) setCustomEmbedUrl(undefined);
        if (playerMode !== 'direct') setPlayerMode('direct');
      }
      return;
    }

    // Direct Stream is ON and user switched to an embed server: keep embed URL synced across episode/season changes
    const selectedEmbed = pool.find((s) => s.id === selectedServerId);
    if (selectedEmbed && playerMode === 'web') {
      const template = mediaType === 'movie' ? selectedEmbed.movieUrlTemplate : selectedEmbed.tvUrlTemplate;
      const url = template
        ? resolveEmbedUrl(template, {
            id: detail?.id || mediaId,
            season: currentSeason,
            episode: currentEpisode
          })
        : '';
      const resolvedUrl = url || undefined;
      if (resolvedUrl !== customEmbedUrl) setCustomEmbedUrl(resolvedUrl);
    }
  }, [
    directStreamEnabled,
    defaultServerPrefs.movieServerId,
    defaultServerPrefs.tvServerId,
    servers,
    selectedServerId,
    playerMode,
    activeWebServer,
    customEmbedUrl,
    mediaType,
    mediaId,
    detail?.id,
    currentSeason,
    currentEpisode
  ]);

  const handleEpisodeChange = (s: number, e: number) => {
    setCurrentSeason(s);
    setCurrentEpisode(e);
    if (detail) {
      const slug = createMediaSlug(detail.title || (detail as any).name, detail.anilistId || detail.id);
      if (detail.mediaType === 'anime') {
        window.history.replaceState({}, '', `/watch/anime/${slug}/${e}`);
      } else {
        window.history.replaceState({}, '', `/watch/tv/${slug}/${s}/${e}`);
      }
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

  const isMovie = detail.mediaType === 'movie' || detail.mediaFormat === 'MOVIE';
  const isAnime = detail.mediaType === 'anime';
  const seriesDetail = !isMovie ? (detail as TVDetail | AnimeDetail) : null;
  const currentSeasonData = seriesDetail?.seasons?.find(s => s.seasonNumber === currentSeason) || seriesDetail?.seasons?.[0];
  const currentSeasonEpisodes = episodesMap[currentSeason] || currentSeasonData?.episodes || [];
  const activeEpisodeObj = currentSeasonEpisodes.find(e => e.episodeNumber === currentEpisode);
  const verifiedEpisodeCount =
    currentSeasonEpisodes.length > 0
      ? currentSeasonEpisodes.length
      : currentSeasonData?.episodeCount && currentSeasonData.episodeCount > 0
      ? currentSeasonData.episodeCount
      : detail.numberOfEpisodes || 0;

  const releaseYear = detail.releaseDate ? String(new Date(detail.releaseDate).getFullYear() || detail.releaseDate.slice(0, 4)) : '';
  const runtimeFormatted = detail.runtime
    ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m`
    : 'Feature Film';

  const genresDisplay = detail.genres && detail.genres.length > 0
    ? detail.genres.slice(0, 3).map(g => g.name).join(' · ')
    : (isAnime ? 'Anime' : 'Cinema');

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
            {isAnime ? 'Anime Details' : isMovie ? 'Movie Details' : 'Series Details'}
          </button>
          <span className="text-[#55555c]">/</span>
          <button
            onClick={() => onBackToDetails(detail)}
            className="hover:text-white transition-colors cursor-pointer"
          >
            {isAnime ? 'Anime' : isMovie ? 'Movies' : 'TV Shows'}
          </button>
          <span className="text-[#55555c]">/</span>
          <span className="text-slate-300 font-semibold truncate max-w-xs sm:max-w-md">
            {detail.title}
          </span>
        </div>

        {/* 2. Media Information Header (Directly above the player) */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-14 sm:w-16 h-20 sm:h-24 rounded-xl overflow-hidden bg-[#16161a] border border-[#3A3A40] shadow-lg shrink-0">
            {detail.posterPath ? (
              <img
                src={detail.posterPath}
                alt={detail.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#232326] text-slate-500">
                <Film className="w-6 h-6" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight truncate">
              {detail.title}
              {!isMovie && (
                <span className="text-[#F5C400] font-bold text-lg sm:text-xl ml-2 tabular-nums">
                  {isAnime ? `(Episode ${currentEpisode})` : `(Season ${currentSeason} — Episode ${currentEpisode})`}
                </span>
              )}
            </h1>

            {!isMovie && (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-white">
                  {activeEpisodeObj?.name && !/^Episode\s+\d+$/i.test(activeEpisodeObj.name)
                    ? `Episode Name: ${activeEpisodeObj.name}`
                    : `Episode ${currentEpisode}`}
                </p>
                {(activeEpisodeObj?.overview || activeEpisodeObj?.airDate || (activeEpisodeObj?.voteAverage && activeEpisodeObj.voteAverage > 0)) && (
                  <p className="text-xs text-[#A6A6AC] line-clamp-2">
                    {[
                      activeEpisodeObj?.airDate ? `Aired ${activeEpisodeObj.airDate}` : null,
                      activeEpisodeObj?.voteAverage && activeEpisodeObj.voteAverage > 0 ? `★ ${activeEpisodeObj.voteAverage.toFixed(1)}` : null,
                      activeEpisodeObj?.overview || null
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}

            {/* Metadata Line: Year · Runtime · Genres */}
            <div className="flex items-center gap-2 text-xs text-[#A6A6AC] mt-1.5 flex-wrap font-medium tabular-nums">
              {releaseYear && (
                <>
                  <span>{releaseYear}</span>
                  <span className="text-[#55555c]">·</span>
                </>
              )}
              <span>
                {isMovie
                  ? runtimeFormatted
                  : verifiedEpisodeCount > 0
                  ? `${verifiedEpisodeCount} Episodes`
                  : 'Ongoing Series'}
              </span>
              <span className="text-[#55555c]">·</span>
              <span className="text-slate-300">{genresDisplay}</span>
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              {detail.voteAverage > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1f1f25] border border-[#3A3A40] text-xs font-bold text-[#F5C400]">
                  <Star className="w-3.5 h-3.5 fill-[#F5C400] text-[#F5C400]" />
                  <span className="text-white font-extrabold tabular-nums">{detail.voteAverage.toFixed(1)}</span>
                </div>
              )}

              <QualityBadge item={detail} variant="full" />

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
            directStreamEnabled={directStreamEnabled}
            defaultDirectProvider={
              isMovie
                ? defaultServerPrefs.movieDirectProvider
                : defaultServerPrefs.tvDirectProvider
            }
            playerMode={directStreamEnabled ? playerMode : 'web'}
            onPlayerModeChange={(m) => {
              if (!directStreamEnabled) {
                setPlayerMode('web');
                return;
              }
              setPlayerMode(m);
              if (m === 'direct') {
                setSelectedServerId('server_1_direct');
                setCustomEmbedUrl(undefined);
              }
            }}
            webServer={activeWebServer}
            onWebServerChange={(s) => setActiveWebServer(s)}
            customEmbedUrl={customEmbedUrl}
            onStreamQualityDetected={setLiveDirectQualityBadge}
          />
        </div>

        {/* 4. Compact Modern Server Selection Bar (Directly below player) */}
        <div className="mt-3.5 px-4 py-3 rounded-xl bg-[#16161a] border border-[#303036] shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#A6A6AC] mr-1">
              CHOOSE A SERVER
            </span>

            {/* Show Direct Stream (when enabled in Admin Panel) together with all active Embed Servers */}
            {(() => {
              const directList = directStreamEnabled
                ? (servers.filter((s) => s.type === 'direct').length > 0
                    ? servers.filter((s) => s.type === 'direct')
                    : [DEFAULT_SERVERS[0]])
                : [];
              const enabledEmbeds = servers.filter((s) => s.type === 'embed' && s.enabled);
              const embedList = enabledEmbeds.length > 0
                ? enabledEmbeds
                : DEFAULT_SERVERS.filter((s) => s.type === 'embed');
              return [...directList, ...embedList];
            })().map((srv) => {
              const isActive = selectedServerId === srv.id;
              const resolutionLabel =
                srv.type === 'direct' && liveDirectQualityBadge
                  ? liveDirectQualityBadge
                  : srv.badge || '1080p';
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => handleSelectServerConfig(srv)}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#23232a] text-white border border-[#F5C400] ring-1 ring-[#F5C400]/40 shadow-sm'
                      : 'bg-[#1b1b20] text-[#A6A6AC] hover:text-white border border-[#303036] hover:bg-[#232328]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive ? 'shadow-[0_0_8px_rgba(245,196,0,0.8)]' : ''
                    }`}
                    style={{ backgroundColor: srv.dotColor || '#F5C400' }}
                  />
                  <span>{srv.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md border text-[10px] font-black tracking-wide shrink-0 ${getQualityPillClasses(resolutionLabel)}`}
                  >
                    {resolutionLabel}
                  </span>
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

        {/* TV / Anime Episode & Season Navigation */}
        {!isMovie && seriesDetail && (currentSeasonEpisodes.length > 0 || verifiedEpisodeCount > 0) && (
          <div className="mt-4 p-4 rounded-xl bg-[#16161a] border border-[#303036]">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-[#F5C400]" />
                <span className="text-xs font-extrabold uppercase text-white tracking-wider">
                  {isAnime ? 'Select Episode:' : 'Select Season & Episode:'}
                </span>
              </div>
              {!isAnime && seriesDetail.seasons && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {seriesDetail.seasons.filter(s => s.seasonNumber > 0).map(s => (
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
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 max-h-52 overflow-y-auto no-scrollbar pt-1">
              {(currentSeasonEpisodes.length > 0
                ? currentSeasonEpisodes
                : Array.from({ length: verifiedEpisodeCount }, (_, i) => ({
                    id: i + 1,
                    episodeNumber: i + 1,
                    seasonNumber: currentSeason,
                    name: `Episode ${i + 1}`,
                    overview: '',
                    stillPath: null,
                    airDate: '',
                    voteAverage: 0
                  }))
              ).map(epItem => (
                <button
                  key={epItem.episodeNumber}
                  onClick={() => handleEpisodeChange(currentSeason, epItem.episodeNumber)}
                  title={epItem.name}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-bold text-left truncate transition-all cursor-pointer tabular-nums ${
                    epItem.episodeNumber === currentEpisode
                      ? 'bg-[#F5C400] text-black font-black ring-1 ring-[#F5C400]'
                      : 'bg-[#232328] hover:bg-[#2e2e36] text-slate-300'
                  }`}
                >
                  E{epItem.episodeNumber}
                  {epItem.name && !/^Episode\s+\d+$/i.test(epItem.name) ? ` · ${epItem.name}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. Media Details & Recommendations */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Synopsis & Action Buttons (lg:col-span-6) */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            {detail.overview ? (
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                {detail.overview}
              </p>
            ) : (
              <p className="text-sm text-[#8E8E93]">No synopsis available for this title.</p>
            )}

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
          servers.find((s) => s.id === selectedServerId)?.name || 'Aether · Direct Stream'
        }
      />
    </div>
  );
};
