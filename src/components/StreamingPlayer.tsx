import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Radio,
  AlertTriangle,
  Play,
  Globe,
  Zap,
  Server,
  Layers,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { Episode, MediaDetail, SubtitleTrack } from '../types/media';
import { searchSubtitles } from '../services/subtitles';
import { getUserSettings } from '../services/storage';
import { fetchSeasonEpisodesStrict } from '../services/tmdb';
import { KeyedFetchCoordinator } from '../utils/retryState';
import { DirectVideoPlayer } from './DirectVideoPlayer';
import { PlayerLoadingSpinner } from './PlayerLoadingSpinner';
import { EpisodeNavTarget, resolveAdjacentEpisodes } from '../utils/episodeNavigation';
import { EpisodeSkipTimings, fetchEpisodeSkipTimings } from '../services/introSkip';
import { fetchDirectStreams, DirectProviderResult, formatQualityBadge } from '../services/directStreamClient';
import { useAuth } from '../context/AuthContext';
import { resolveSafeResumeSeconds } from '../services/watchHistory';

export type PlayerMode = 'direct' | 'web';
export type WebServer = string;

interface StreamingPlayerProps {
  media: MediaDetail;
  initialSeason?: number;
  initialEpisode?: number;
  onEpisodeChange?: (season: number, episode: number) => void;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  isLightsDimmed?: boolean;
  onToggleLights?: () => void;
  // External server control from WatchPage
  directStreamEnabled?: boolean;
  defaultDirectProvider?: string;
  playerMode?: PlayerMode;
  onPlayerModeChange?: (mode: PlayerMode) => void;
  webServer?: WebServer;
  onWebServerChange?: (server: WebServer) => void;
  customEmbedUrl?: string;
  onStreamQualityDetected?: (badge: string) => void;
}

const HLS_CLUSTERS = [
  { id: 'cinejoy', name: 'Aether (Default)', desc: 'Fastest Movie & Series HLS Stream', badge: '4K / 1080p' },
  { id: 'cinesrc', name: 'Vortex', desc: 'High-Speed Primary Mirror HLS', badge: '4K / 1080p' },
  { id: 'vidrock', name: 'Krypton', desc: 'Encrypted Adaptive HLS Stream', badge: '1080p' },
  { id: 'vidup', name: 'Cobalt', desc: 'Ultra-Sharp Multi-Source Stream', badge: '4K / 1440p' },
  { id: 'hexa', name: 'Helios', desc: 'Multi-Node Fast Mirror Stream', badge: '1440p / 720p' },
  { id: 'boxmovie', name: 'Vertex', desc: 'Direct Multi-Resolution CDN MP4', badge: '1080p / 720p' },
  { id: 'meowtv', name: 'Flux', desc: 'Multi-Lingual Audio HLS Stream', badge: '1080p' },
  { id: 'vidapi', name: 'Sigma', desc: 'Adaptive Multi-Bitrate HLS', badge: '1080p' },
  { id: 'eclipse', name: 'Spectra', desc: 'Direct High-Speed MP4 Mirror', badge: '1080p' },
  { id: 'vidrift', name: 'Nimbus', desc: 'Direct Embed HLS Extractor', badge: '1080p' },
  { id: 'vidlink', name: 'Quantum', desc: 'Multi-Quality Adaptive Stream', badge: '1080p' },
  { id: 'lmscript', name: 'Onyx', desc: 'Dedicated Feature Film Stream', badge: '1080p' },
  { id: 'all', name: 'Sweep All Servers', desc: 'Load Aether First + Background Failover', badge: 'Auto' }
];

export const StreamingPlayer: React.FC<StreamingPlayerProps> = ({
  media,
  initialSeason = 1,
  initialEpisode = 1,
  onEpisodeChange,
  isTheaterMode = false,
  onToggleTheater,
  isLightsDimmed = false,
  onToggleLights,
  directStreamEnabled = true,
  defaultDirectProvider,
  playerMode: externalPlayerMode,
  onPlayerModeChange,
  webServer: externalWebServer,
  onWebServerChange,
  customEmbedUrl,
  onStreamQualityDetected
}) => {
  const { user, saveContinueWatching, getContinueWatchingItem } = useAuth();
  const settings = getUserSettings();
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Internal state if not controlled externally
  const [internalMode, setInternalMode] = useState<PlayerMode>(directStreamEnabled ? 'direct' : 'web');
  const [internalWebServer, setInternalWebServer] = useState<WebServer>('fmov');

  const rawPlayerMode = externalPlayerMode !== undefined ? externalPlayerMode : internalMode;
  const playerMode: PlayerMode = !directStreamEnabled ? 'web' : rawPlayerMode;
  const webServer = externalWebServer !== undefined ? externalWebServer : internalWebServer;

  const setPlayerMode = (mode: PlayerMode) => {
    const resolved = !directStreamEnabled ? 'web' : mode;
    if (onPlayerModeChange) onPlayerModeChange(resolved);
    setInternalMode(resolved);
  };

  const setWebServer = (server: WebServer) => {
    if (onWebServerChange) onWebServerChange(server);
    setInternalWebServer(server);
  };

  const [currentSeason, setCurrentSeason] = useState(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [savedResumeSeconds, setSavedResumeSeconds] = useState<number | undefined>(undefined);
  const [ambientGlow, setAmbientGlow] = useState<boolean>(true);
  const [iframeReloadKey, setIframeReloadKey] = useState<number>(0);

  // Subtitles & Verified Skip Timings (AniSkip / Firestore)
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [skipTimings, setSkipTimings] = useState<EpisodeSkipTimings | null>(null);

  // Direct HLS Streams (Default server: Aether / cinejoy loaded first, others in background)
  const [directResults, setDirectResults] = useState<DirectProviderResult[]>([]);
  const [loadingDirect, setLoadingDirect] = useState<boolean>(true);
  const [directFailed, setDirectFailed] = useState<boolean>(false);
  const [activeCluster, setActiveCluster] = useState<string>(() => {
    if (defaultDirectProvider) return defaultDirectProvider;
    const pref = settings.preferredServer;
    if (!pref || pref === 'vidapi' || pref === 'all') return 'cinejoy';
    return pref;
  });
  useEffect(() => {
    if (defaultDirectProvider) {
      setActiveCluster(defaultDirectProvider);
    }
  }, [defaultDirectProvider, media.id, media.mediaType]);
  const [isScanningAlternative, setIsScanningAlternative] = useState<boolean>(false);

  // TV / Anime Episodes cache & retryable loader
  const [episodesMap, setEpisodesMap] = useState<Record<number, Episode[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodeLoadError, setEpisodeLoadError] = useState<string | null>(null);
  const [episodeRetryTick, setEpisodeRetryTick] = useState(0);
  const seasonCoordinatorRef = useRef<KeyedFetchCoordinator<Episode[]> | null>(null);
  if (!seasonCoordinatorRef.current) {
    seasonCoordinatorRef.current = new KeyedFetchCoordinator<Episode[]>();
  }

  const isMovie = media.mediaType === 'movie' || media.mediaFormat === 'MOVIE' || media.mediaFormat === 'ANIME_MOVIE';
  const isAnime = media.mediaType === 'anime';
  const tvDetail = !isMovie ? (media as any) : null;
  const currentSeasonData =
    tvDetail?.seasons?.find((s: any) => s.seasonNumber === currentSeason) ||
    tvDetail?.seasons?.[0];

  // Sync state if initial props change
  useEffect(() => {
    setCurrentSeason(initialSeason);
    setCurrentEpisode(initialEpisode);
  }, [initialSeason, initialEpisode]);

  // Reset coordinator cleanly across media ID transitions or unmount
  useEffect(() => {
    const coord = new KeyedFetchCoordinator<Episode[]>();
    seasonCoordinatorRef.current = coord;
    setEpisodesMap({});
    setEpisodeLoadError(null);
    return () => {
      coord.destroy();
    };
  }, [media.id, media.tmdbId, media.anilistId]);

  const handleRetrySeasonEpisodes = useCallback(() => {
    const coord = seasonCoordinatorRef.current;
    if (!coord || isMovie) return;
    const key = `${media.tmdbId || media.id}_${currentSeason}`;
    coord.clearError(key);
    setEpisodeLoadError(null);
    setEpisodeRetryTick(t => t + 1);
  }, [isMovie, media.id, media.tmdbId, currentSeason]);

  // Load TV episodes for current season with retry safety and stale-response protection
  useEffect(() => {
    if (isMovie || isAnime) return;
    const coord = seasonCoordinatorRef.current;
    if (!coord) return;

    let isMounted = true;
    const tmdbIdValue = media.tmdbId || media.id;
    const cacheKey = `${tmdbIdValue}_${currentSeason}`;
    coord.setActiveKey(cacheKey);

    if (currentSeasonData?.episodes && currentSeasonData.episodes.length > 0) {
      coord.seed(cacheKey, currentSeasonData.episodes);
      setEpisodesMap(prev =>
        prev[currentSeason]?.length ? prev : { ...prev, [currentSeason]: currentSeasonData.episodes! }
      );
      setEpisodeLoadError(null);
      return;
    }

    if (coord.hasLoaded(cacheKey)) {
      const cached = coord.getCached(cacheKey) || [];
      setEpisodesMap(prev => (prev[currentSeason] ? prev : { ...prev, [currentSeason]: cached }));
      setEpisodeLoadError(null);
      return;
    }

    async function loadSeason() {
      setLoadingEpisodes(true);
      setEpisodeLoadError(null);
      const outcome = await coord!.load(cacheKey, () => fetchSeasonEpisodesStrict(tmdbIdValue, currentSeason));
      if (!isMounted || outcome.aborted) return;

      if (outcome.ok && outcome.data) {
        setEpisodesMap(prev => ({ ...prev, [currentSeason]: outcome.data! }));
        if (!outcome.stale) {
          setEpisodeLoadError(null);
        }
      } else if (!outcome.stale) {
        setEpisodeLoadError(outcome.error || `Failed to load Season ${currentSeason} episodes.`);
      }
      if (!outcome.stale) {
        setLoadingEpisodes(false);
      }
    }

    loadSeason();
    return () => {
      isMounted = false;
    };
  }, [media.id, media.tmdbId, currentSeason, isMovie, isAnime, currentSeasonData, episodeRetryTick]);

  // Genuine episode list only — never fabricate assumed 8 or 10 episode placeholders
  const rawEpisodes = episodesMap[currentSeason] || currentSeasonData?.episodes;
  const episodesList: Episode[] = Array.isArray(rawEpisodes) ? rawEpisodes : [];

  const currentEpisodeData = episodesList.find((e: any) => e.episodeNumber === currentEpisode);

  const [streamReloadTick, setStreamReloadTick] = useState<number>(0);

  // Progressive 2-Phase Direct Stream Loader:
  // 1) Load fastest default Aether ('cinejoy') FIRST for immediate playback
  // 2) Then load all remaining servers in the background behind Aether
  const loadDirectStreams = useCallback((targetCluster?: string) => {
    if (targetCluster && targetCluster !== activeCluster) {
      setActiveCluster(targetCluster);
    } else {
      setStreamReloadTick(t => t + 1);
    }
  }, [activeCluster]);

  useEffect(() => {
    if (!directStreamEnabled || playerMode !== 'direct') {
      setDirectResults([]);
      setLoadingDirect(false);
      setDirectFailed(false);
      setIsScanningAlternative(false);
      return;
    }

    let isMounted = true;
    const tmdbIdValue = media.tmdbId || (!isAnime ? media.id : 0);
    const primaryCluster = activeCluster === 'all' ? (defaultDirectProvider || 'cinejoy') : activeCluster;

    async function runProgressiveFetch() {
      setLoadingDirect(true);
      setDirectFailed(false);
      setIsScanningAlternative(true);

      try {
        // Step 1: Immediately fetch primary server (Aether by default) in single mode
        const primaryResults = await fetchDirectStreams({
          tmdbId: tmdbIdValue,
          mediaType: isAnime ? 'anime' : isMovie ? 'movie' : 'tv',
          anilistId: isAnime ? (media.anilistId || media.id) : undefined,
          malId: media.malId,
          title: media.title,
          season: isMovie ? undefined : currentSeason,
          episode: isMovie ? undefined : currentEpisode,
          provider: primaryCluster,
          single: true
        });
        if (!isMounted) return;

        if (primaryResults && primaryResults.length > 0) {
          setDirectResults(primaryResults);
          const firstSt = primaryResults[0]?.streams?.[0];
          if (firstSt && onStreamQualityDetected) {
            onStreamQualityDetected(formatQualityBadge(firstSt.quality, firstSt.type));
          }
          setLoadingDirect(false);

          // Step 2: Load remaining servers in the background and append after primary
          fetchDirectStreams({
            tmdbId: tmdbIdValue,
            mediaType: isAnime ? 'anime' : isMovie ? 'movie' : 'tv',
            anilistId: isAnime ? (media.anilistId || media.id) : undefined,
            malId: media.malId,
            title: media.title,
            season: isMovie ? undefined : currentSeason,
            episode: isMovie ? undefined : currentEpisode,
            exclude: [primaryCluster]
          })
            .then((remainingResults) => {
              if (!isMounted) return;
              if (remainingResults && remainingResults.length > 0) {
                setDirectResults((prev) => {
                  const base = prev.length > 0 ? prev : primaryResults;
                  const seen = new Set(base.map((p) => p.provider));
                  const extras = remainingResults.filter((r) => !seen.has(r.provider));
                  return extras.length > 0 ? [...base, ...extras] : base;
                });
              }
            })
            .catch(() => {})
            .finally(() => {
              if (isMounted) setIsScanningAlternative(false);
            });
          return;
        }

        // Primary server returned no streams -> fall back to remaining servers now
        const remainingResults = await fetchDirectStreams({
          tmdbId: tmdbIdValue,
          mediaType: isAnime ? 'anime' : isMovie ? 'movie' : 'tv',
          anilistId: isAnime ? (media.anilistId || media.id) : undefined,
          malId: media.malId,
          title: media.title,
          season: isMovie ? undefined : currentSeason,
          episode: isMovie ? undefined : currentEpisode,
          exclude: [primaryCluster]
        });
        if (!isMounted) return;

        setDirectResults(remainingResults || []);
        const fallbackSt = remainingResults?.[0]?.streams?.[0];
        if (fallbackSt && onStreamQualityDetected) {
          onStreamQualityDetected(formatQualityBadge(fallbackSt.quality, fallbackSt.type));
        }
        if (!remainingResults || remainingResults.length === 0) {
          setDirectFailed(true);
        }
        setLoadingDirect(false);
        setIsScanningAlternative(false);
      } catch (err) {
        console.warn('Direct stream resolution failed:', err);
        if (isMounted) {
          setDirectFailed(true);
          setLoadingDirect(false);
          setIsScanningAlternative(false);
        }
      }
    }

    runProgressiveFetch();
    return () => {
      isMounted = false;
    };
  }, [
    directStreamEnabled,
    defaultDirectProvider,
    playerMode,
    media.tmdbId,
    media.anilistId,
    media.malId,
    media.id,
    media.mediaType,
    media.title,
    currentSeason,
    currentEpisode,
    isMovie,
    isAnime,
    activeCluster,
    streamReloadTick
  ]);

  // Load subtitles
  useEffect(() => {
    let isMounted = true;
    const subTmdbId = media.tmdbId || (!isAnime ? media.id : 0);
    if (!subTmdbId && !media.imdbId) {
      setSubtitles([]);
      return;
    }
    async function loadSubs() {
      const results = await searchSubtitles({
        mediaType: isAnime ? 'tv' : media.mediaType,
        tmdbId: subTmdbId,
        imdbId: media.imdbId || (media as any).external_ids?.imdb_id,
        season: isMovie ? undefined : currentSeason,
        episode: isMovie ? undefined : currentEpisode
      });
      if (isMounted) {
        setSubtitles(results);
      }
    }
    loadSubs();
    return () => {
      isMounted = false;
    };
  }, [
    media.id,
    media.tmdbId,
    media.imdbId,
    media.mediaType,
    currentSeason,
    currentEpisode,
    isMovie,
    isAnime
  ]);

  // Load verified skip timings (AniSkip + Firestore introTimings)
  useEffect(() => {
    if (isMovie) {
      setSkipTimings(null);
      return;
    }
    let active = true;
    setSkipTimings(null);
    fetchEpisodeSkipTimings({
      mediaType: media.mediaType,
      providerId: isAnime ? (media.anilistId || media.id) : (media.tmdbId || media.id),
      tmdbId: media.tmdbId || (!isAnime ? media.id : undefined),
      anilistId: media.anilistId,
      malId: media.malId,
      season: currentSeason,
      episode: currentEpisode,
      episodeLengthSeconds: currentEpisodeData?.runtime ? currentEpisodeData.runtime * 60 : undefined
    }).then((timings) => {
      if (active) setSkipTimings(timings);
    });
    return () => {
      active = false;
    };
  }, [
    isMovie,
    isAnime,
    media.mediaType,
    media.id,
    media.tmdbId,
    media.anilistId,
    media.malId,
    currentSeason,
    currentEpisode,
    currentEpisodeData?.runtime
  ]);

  // Load saved resume position for both guests and registered users
  useEffect(() => {
    let isMounted = true;
    const primaryId = isAnime ? (media.anilistId || media.id) : (media.tmdbId || media.id);
    const seasonNum = isMovie ? undefined : currentSeason;
    const epNum = isMovie ? undefined : currentEpisode;
    getContinueWatchingItem(media.mediaType, primaryId, seasonNum, epNum).then(rec => {
      if (!isMounted) return;
      if (!rec) {
        setSavedResumeSeconds(undefined);
        return;
      }
      if (isMovie) {
        const pos = resolveSafeResumeSeconds(rec);
        setSavedResumeSeconds(pos > 0 ? pos : undefined);
      } else if (rec.seasonNumber === currentSeason && rec.episodeNumber === currentEpisode) {
        const pos = resolveSafeResumeSeconds(rec);
        setSavedResumeSeconds(pos > 0 ? pos : undefined);
      } else {
        setSavedResumeSeconds(undefined);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user, media.id, media.tmdbId, media.anilistId, media.mediaType, currentSeason, currentEpisode, isMovie, isAnime, getContinueWatchingItem]);

  const handleProgressUpdate = useCallback((progressSeconds: number, durationSeconds: number, forceSync?: boolean) => {
    const genreNames = Array.isArray(media.genres)
      ? media.genres.map((g: any) => (typeof g === 'string' ? g : g?.name)).filter(Boolean)
      : [];
    const primaryId = isAnime ? (media.anilistId || media.id) : (media.tmdbId || media.id);
    void saveContinueWatching({
      tmdbId: primaryId,
      mediaType: media.mediaType,
      anilistId: media.anilistId,
      malId: media.malId,
      mediaFormat: media.mediaFormat,
      title: media.title,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      progressSeconds: Math.floor(progressSeconds),
      durationSeconds: Math.floor(durationSeconds),
      seasonNumber: isMovie ? undefined : currentSeason,
      episodeNumber: isMovie ? undefined : currentEpisode,
      episodeName: currentEpisodeData?.name,
      genres: genreNames,
      serverId: activeCluster,
      forceSync
    });
  }, [saveContinueWatching, media.tmdbId, media.anilistId, media.malId, media.mediaFormat, media.id, media.mediaType, media.title, media.posterPath, media.backdropPath, media.genres, isMovie, isAnime, currentSeason, currentEpisode, currentEpisodeData?.name, activeCluster]);

  // Cross-season / cross-episode navigator driven strictly by verified episode data
  const adjacent = resolveAdjacentEpisodes({
    isMovie,
    currentSeason,
    currentEpisode,
    seasonsList: tvDetail?.seasons,
    loadedSeasonsMap: episodesMap
  });

  const navigateToEpisodeTarget = useCallback(
    (target: EpisodeNavTarget | null) => {
      if (!target) return;
      setCurrentSeason(target.season);
      setCurrentEpisode(target.episode);
      onEpisodeChange?.(target.season, target.episode);
    },
    [onEpisodeChange]
  );

  const handleNextEpisode = useCallback(() => {
    navigateToEpisodeTarget(adjacent.next);
  }, [adjacent.next, navigateToEpisodeTarget]);

  const handlePrevEpisode = useCallback(() => {
    navigateToEpisodeTarget(adjacent.prev);
  }, [adjacent.prev, navigateToEpisodeTarget]);

  // Generate Web Embed URL (strictly only fmov.my, movietvapi.stream, vidsrc.sh, or custom embed url)
  const embedTargetId = media.tmdbId || (!isAnime ? media.id : 0);
  const getWebEmbedUrl = (server: WebServer): string => {
    if (customEmbedUrl) {
      return customEmbedUrl;
    }
    if (server === 'fmov' || server.includes('fmov')) {
      return isMovie
        ? `https://fmov.my/embed/movie/${embedTargetId}?color=F5C400`
        : `https://fmov.my/embed/series/${embedTargetId}/${currentSeason}/${currentEpisode}?color=F5C400`;
    }
    if (server === 'movietvapi' || server.includes('movietv')) {
      return isMovie
        ? `https://movietvapi.stream/embed/movie/${embedTargetId}`
        : `https://movietvapi.stream/embed/tv/${embedTargetId}/${currentSeason}/${currentEpisode}`;
    }
    return isMovie
      ? `https://vidsrc.sh/embed/movie/${embedTargetId}`
      : `https://vidsrc.sh/embed/tv/${embedTargetId}/${currentSeason}/${currentEpisode}`;
  };

  // Preserve DirectVideoPlayer mounted across episode switches to keep active DOM fullscreen alive!
  const showDirectPlayerStage =
    playerMode === 'direct' && (directResults.length > 0 || (loadingDirect && !directFailed));
  const showDirectBusyFallback =
    playerMode === 'direct' && !loadingDirect && directResults.length === 0;

  return (
    <div className="relative w-full">
      {/* Cinematic Ambient Atmosphere Glow */}
      {ambientGlow && !isLightsDimmed && (
        <div
          className="absolute -inset-3 sm:-inset-6 rounded-3xl opacity-25 sm:opacity-40 blur-2xl sm:blur-3xl pointer-events-none transition-opacity duration-700 z-0 overflow-hidden"
          aria-hidden="true"
        >
          <img
            src={media.backdropPath || media.posterPath}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover filter brightness-75 contrast-125 scale-110"
          />
        </div>
      )}

      <div
        ref={playerContainerRef}
        className="relative z-10 w-full rounded-xl sm:rounded-2xl overflow-hidden bg-[#0a0a0d] border border-[#3A3A40] shadow-2xl transition-all duration-300 ring-1 ring-white/5"
      >
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {playerMode === 'web' ? (
            /* Third-Party Web Embed Player View */
            <div className="w-full h-full flex flex-col bg-black relative">
              <div className="h-10.5 bg-[#141418] border-b border-[#303036] px-2.5 sm:px-4 flex items-center justify-between gap-2 z-10 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <span className="text-[10px] uppercase font-bold text-[#A6A6AC] mr-1 hidden sm:inline">Third-Party Embed:</span>
                  <button
                    type="button"
                    onClick={() => setWebServer('fmov')}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      webServer === 'fmov' || webServer.includes('fmov')
                        ? 'bg-[#F5C400] text-black shadow-sm font-black'
                        : 'bg-[#212126] text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${webServer === 'fmov' || webServer.includes('fmov') ? 'bg-black' : 'bg-emerald-400'}`} />
                    <span>Solstice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWebServer('movietvapi')}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      webServer === 'movietvapi' || webServer.includes('movietv')
                        ? 'bg-[#F5C400] text-black shadow-sm font-black'
                        : 'bg-[#212126] text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${webServer === 'movietvapi' || webServer.includes('movietv') ? 'bg-black' : 'bg-cyan-400'}`} />
                    <span>Mirage</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWebServer('vidsrc')}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      webServer === 'vidsrc' || webServer.includes('vidsrc')
                        ? 'bg-[#F5C400] text-black shadow-sm font-black'
                        : 'bg-[#212126] text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${webServer === 'vidsrc' || webServer.includes('vidsrc') ? 'bg-black' : 'bg-purple-400'}`} />
                    <span>Vesper</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIframeReloadKey(k => k + 1)}
                    className="p-1.5 rounded-lg bg-[#212126] hover:bg-[#2b2b32] text-slate-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                    title="Reload embed player"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onToggleTheater && (
                    <button
                      type="button"
                      onClick={onToggleTheater}
                      className="hidden md:flex p-1.5 rounded-lg bg-[#212126] hover:bg-[#2b2b32] text-slate-300 hover:text-white border border-white/5 transition-colors cursor-pointer"
                      title={isTheaterMode ? 'Exit theater mode' : 'Theater mode'}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {directStreamEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlayerMode('direct');
                        loadDirectStreams();
                      }}
                      className="px-2.5 sm:px-3 py-1 rounded-lg bg-[#25252b] hover:bg-[#303038] text-[#F5C400] text-[11px] font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#F5C400]/40 shadow-sm whitespace-nowrap"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span className="sm:hidden">Direct</span>
                      <span className="hidden sm:inline">Switch to First-Party Ad-Free Player</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 w-full h-full relative">
                {embedTargetId ? (
                  <iframe
                    key={`${webServer}-${embedTargetId}-${currentSeason}-${currentEpisode}-${iframeReloadKey}`}
                    src={getWebEmbedUrl(webServer)}
                    className="w-full h-full border-0"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-zinc-400">
                    <AlertTriangle className="w-8 h-8 text-[#F5C400] mb-2" />
                    <p className="text-sm font-bold text-white">External Embed Requires a Mapped TMDB ID</p>
                    <p className="text-xs mt-1">Switch back to the Direct Native Player or choose an alternative server.</p>
                  </div>
                )}
              </div>
            </div>
          ) : showDirectPlayerStage ? (
            /* Native First-Party HTML5 Player — stays mounted across episode switches to preserve DOM fullscreen! */
            <DirectVideoPlayer
              title={media.title}
              episodeTitle={currentEpisodeData?.name}
              isMovie={isMovie}
              isAnime={isAnime}
              genres={Array.isArray(media.genres) ? media.genres.map((g: any) => typeof g === 'string' ? g : g.name) : []}
              releaseYear={media.releaseDate ? new Date(media.releaseDate).getFullYear() : (media as any).firstAirDate ? new Date((media as any).firstAirDate).getFullYear() : undefined}
              currentSeason={currentSeason}
              currentEpisode={currentEpisode}
              totalSeasons={tvDetail?.seasons?.length || (media as any).numberOfSeasons || 1}
              seasonsList={tvDetail?.seasons}
              episodesList={episodesList}
              onSelectEpisode={(s, e) => {
                setCurrentSeason(s);
                setCurrentEpisode(e);
                onEpisodeChange?.(s, e);
              }}
              providerResults={directResults}
              isFetchingStreams={loadingDirect}
              availableSubtitles={subtitles}
              skipTimings={skipTimings}
              nextEpisodeTarget={adjacent.next}
              onNextEpisode={handleNextEpisode}
              onPrevEpisode={handlePrevEpisode}
              hasNextEpisode={adjacent.hasNext}
              hasPrevEpisode={adjacent.hasPrev}
              storageKey={`${media.mediaType}_${media.anilistId || media.tmdbId || media.id}_${currentSeason}_${currentEpisode}`}
              initialResumeSeek={savedResumeSeconds}
              onProgressUpdate={handleProgressUpdate}
              onRefreshStreams={() => loadDirectStreams()}
              isTheaterMode={isTheaterMode}
              onToggleTheater={onToggleTheater}
              isLightsDimmed={isLightsDimmed}
              onToggleLights={onToggleLights}
              backdropPath={media.backdropPath || media.posterPath}
              onResolvedQualityChange={onStreamQualityDetected}
            />
          ) : (
            /* Direct HLS Stream Busy State */
            <div className="flex flex-col items-center justify-start sm:justify-center p-3.5 sm:p-8 text-center max-w-xl bg-gradient-to-b from-[#121215] to-[#0a0a0d] w-full h-full relative overflow-y-auto no-scrollbar">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-2 sm:mb-3 text-[#F5C400] shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-[#F5C400]" />
              </div>

              <h3 className="text-xs sm:text-lg font-black text-white mb-1 uppercase tracking-wider">
                Direct Stream Unavailable Right Now
              </h3>
              <p className="text-[11px] sm:text-xs text-[#A6A6AC] mb-3 sm:mb-5 max-w-md leading-relaxed">
                No working stream responded on the selected server. Select another server cluster below or sweep all available providers:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mb-4">
                {HLS_CLUSTERS.map((cluster) => {
                  const isActive = activeCluster === cluster.id;
                  return (
                    <button
                      key={cluster.id}
                      type="button"
                      disabled={isScanningAlternative}
                      onClick={() => loadDirectStreams(cluster.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#25252d] border-[#F5C400] text-white shadow-md'
                          : 'bg-[#15151a] border-[#2e2e34] hover:bg-[#202026] text-slate-200 hover:border-slate-500'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-[#F5C400]" />
                          <span className="text-xs font-bold text-white">{cluster.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{cluster.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => loadDirectStreams('all')}
                disabled={isScanningAlternative}
                className="px-5 py-2.5 rounded-xl bg-[#2b2b32] hover:bg-[#383842] text-white border border-[#3A3A40] font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningAlternative ? 'animate-spin text-[#F5C400]' : ''}`} />
                <span>{isScanningAlternative ? 'Scanning Servers...' : 'Sweep All Direct Servers'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Sub-bar: Transparent distinction between First-Party Player vs Third-Party Embed */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#121215] border-t border-[#3A3A40]/60 flex items-center justify-between text-[11px] text-[#A6A6AC] flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${playerMode === 'direct' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="font-bold text-white truncate">
              {playerMode === 'direct'
                ? (() => {
                    const activeObj = HLS_CLUSTERS.find(c => c.id === activeCluster) || HLS_CLUSTERS[0];
                    return `First-Party Direct Player (${activeObj.name})`;
                  })()
                : `Third-Party Embed Server · ${
                    webServer.includes('fmov')
                      ? 'Solstice'
                      : webServer.includes('movietv')
                      ? 'Mirage'
                      : webServer.includes('vidsrc')
                      ? 'Vesper'
                      : webServer.replace(/^server_\d+_/, '')
                  }`}
            </span>
            <span className="hidden sm:inline text-[#3A3A40]">|</span>
            <span className={`hidden sm:inline font-mono font-bold ${playerMode === 'direct' ? 'text-emerald-400' : 'text-amber-300'}`}>
              {playerMode === 'direct'
                ? 'Ad-Free Interface · Auto-Failover Enabled'
                : 'External Embed (May display third-party ads)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isMovie && !isAnime && episodeLoadError && (
              <button
                type="button"
                onClick={handleRetrySeasonEpisodes}
                disabled={loadingEpisodes}
                className="px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                title={episodeLoadError}
              >
                <RefreshCw className={`w-3 h-3 ${loadingEpisodes ? 'animate-spin' : ''}`} />
                <span>{loadingEpisodes ? 'Retrying Episodes...' : 'Retry Episodes'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setAmbientGlow(prev => !prev)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border ${
                ambientGlow
                  ? 'bg-amber-500/15 border-[#F5C400]/40 text-[#F5C400]'
                  : 'bg-transparent border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Toggle cinematic ambient atmospheric glow"
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden xs:inline">Ambient Glow</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
