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
import { fetchDirectStreams, DirectProviderResult } from '../services/directStreamClient';
import { useAuth } from '../context/AuthContext';

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
}

const HLS_CLUSTERS = [
  { id: 'vidrock', name: 'Core (Default)', desc: 'Primary AES-GCM 1080p HLS Loaded First', badge: 'Default' },
  { id: 'boxmovie', name: 'BoxMovie (CDN MP4)', desc: 'Direct 1080p / 720p / 480p MP4 CDN', badge: 'MP4' },
  { id: 'meowtv', name: 'Apex (Multi-Audio)', desc: 'Multi-lingual HLS Stream', badge: 'Multi HLS' },
  { id: 'vidapi', name: 'Vector (Adaptive HLS)', desc: 'Direct HLS Multi-bitrate 1080p/720p', badge: 'HLS' },
  { id: 'eclipse', name: 'Eclipse (1080p MP4)', desc: 'Direct 1080p MP4 Stream', badge: 'MP4' },
  { id: 'vidrift', name: 'Orion (1080p HLS)', desc: 'Direct 1080p Embed HLS Extraction', badge: 'HLS' },
  { id: 'vidlink', name: 'Pulse (1080p HLS/MP4)', desc: 'Multi-Quality Stream', badge: 'Adaptive' },
  { id: 'lmscript', name: 'Valence (Movies)', desc: '1080p MP4 / HLS High Speed', badge: 'Movies' },
  { id: 'all', name: 'Sweep All Servers', desc: 'Load Core First + Background Failover', badge: 'All' }
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
  customEmbedUrl
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

  // Subtitles
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);

  // Direct HLS Streams (Default server: Core / vidrock loaded first, others in background)
  const [directResults, setDirectResults] = useState<DirectProviderResult[]>([]);
  const [loadingDirect, setLoadingDirect] = useState<boolean>(true);
  const [directFailed, setDirectFailed] = useState<boolean>(false);
  const [activeCluster, setActiveCluster] = useState<string>(() => {
    if (defaultDirectProvider) return defaultDirectProvider;
    const pref = settings.preferredServer;
    if (!pref || pref === 'vidapi' || pref === 'all') return 'vidrock';
    return pref;
  });
  useEffect(() => {
    if (defaultDirectProvider) {
      setActiveCluster(defaultDirectProvider);
    }
  }, [defaultDirectProvider, media.id, media.mediaType]);
  const [isScanningAlternative, setIsScanningAlternative] = useState<boolean>(false);

  // TV Episodes cache & retryable loader
  const [episodesMap, setEpisodesMap] = useState<Record<number, Episode[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodeLoadError, setEpisodeLoadError] = useState<string | null>(null);
  const [episodeRetryTick, setEpisodeRetryTick] = useState(0);
  const seasonCoordinatorRef = useRef<KeyedFetchCoordinator<Episode[]> | null>(null);
  if (!seasonCoordinatorRef.current) {
    seasonCoordinatorRef.current = new KeyedFetchCoordinator<Episode[]>();
  }

  const isMovie = media.mediaType === 'movie';
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
  }, [media.id, media.tmdbId]);

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
    if (isMovie) return;
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
  }, [media.id, media.tmdbId, currentSeason, isMovie, currentSeasonData, episodeRetryTick]);

  const rawEpisodes = episodesMap[currentSeason] || currentSeasonData?.episodes;
  const episodesList: Episode[] =
    rawEpisodes && rawEpisodes.length > 0
      ? rawEpisodes
      : Array.from({ length: currentSeasonData?.episodeCount || 8 }, (_, i) => ({
          id: Number(`${media.id}${currentSeason}${i + 1}`),
          episodeNumber: i + 1,
          seasonNumber: currentSeason,
          name: `Episode ${i + 1}`,
          overview: '',
          stillPath: null,
          airDate: '',
          voteAverage: 0,
          runtime: undefined
        }));

  const currentEpisodeData = episodesList.find((e: any) => e.episodeNumber === currentEpisode);

  const [streamReloadTick, setStreamReloadTick] = useState<number>(0);

  // Progressive 2-Phase Direct Stream Loader:
  // 1) Load default Core ('vidrock') FIRST for immediate playback
  // 2) Then load all remaining servers in the background behind Core
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
    const tmdbIdValue = media.tmdbId || media.id;
    const primaryCluster = activeCluster === 'all' ? (defaultDirectProvider || 'vidrock') : activeCluster;

    async function runProgressiveFetch() {
      setLoadingDirect(true);
      setDirectFailed(false);
      setIsScanningAlternative(true);

      try {
        // Step 1: Immediately fetch primary server (Core by default) in single mode
        const primaryResults = await fetchDirectStreams({
          tmdbId: tmdbIdValue,
          mediaType: media.mediaType,
          season: isMovie ? undefined : currentSeason,
          episode: isMovie ? undefined : currentEpisode,
          provider: primaryCluster,
          single: true
        });
        if (!isMounted) return;

        if (primaryResults && primaryResults.length > 0) {
          // Core succeeded -> show player & begin playback immediately!
          setDirectResults(primaryResults);
          setLoadingDirect(false);

          // Step 2: Load remaining servers in the background and append after Core
          fetchDirectStreams({
            tmdbId: tmdbIdValue,
            mediaType: media.mediaType,
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
          mediaType: media.mediaType,
          season: isMovie ? undefined : currentSeason,
          episode: isMovie ? undefined : currentEpisode,
          exclude: [primaryCluster]
        });
        if (!isMounted) return;

        setDirectResults(remainingResults || []);
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
  }, [directStreamEnabled, defaultDirectProvider, playerMode, media.tmdbId, media.id, media.mediaType, currentSeason, currentEpisode, isMovie, activeCluster, streamReloadTick]);

  // Load subtitles
  useEffect(() => {
    let isMounted = true;
    async function loadSubs() {
      const results = await searchSubtitles({
        mediaType: media.mediaType,
        tmdbId: media.tmdbId || media.id,
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
    isMovie
  ]);

  // Load saved resume position for registered user
  useEffect(() => {
    let isMounted = true;
    if (!user) {
      setSavedResumeSeconds(undefined);
      return;
    }
    getContinueWatchingItem(media.mediaType, media.tmdbId || media.id).then(rec => {
      if (isMounted && rec) {
        if (isMovie) {
          if (rec.progressSeconds > 10) setSavedResumeSeconds(rec.progressSeconds);
        } else {
          if (rec.seasonNumber === currentSeason && rec.episodeNumber === currentEpisode && rec.progressSeconds > 10) {
            setSavedResumeSeconds(rec.progressSeconds);
          }
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user, media.id, media.tmdbId, media.mediaType, currentSeason, currentEpisode, isMovie, getContinueWatchingItem]);

  const handleProgressUpdate = useCallback((progressSeconds: number, durationSeconds: number) => {
    // Continue watching is strictly for registered users
    if (!user) return;
    saveContinueWatching({
      tmdbId: media.tmdbId || media.id,
      mediaType: media.mediaType,
      title: media.title,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      progressSeconds: Math.floor(progressSeconds),
      durationSeconds: Math.floor(durationSeconds),
      seasonNumber: isMovie ? undefined : currentSeason,
      episodeNumber: isMovie ? undefined : currentEpisode,
      episodeName: currentEpisodeData?.name
    });
  }, [user, saveContinueWatching, media.tmdbId, media.id, media.mediaType, media.title, media.posterPath, media.backdropPath, isMovie, currentSeason, currentEpisode, currentEpisodeData?.name]);

  const maxEpisode = currentSeasonData?.episodeCount || episodesList.length || 10;
  const hasNextEpisode = !isMovie && currentEpisode < maxEpisode;
  const hasPrevEpisode = !isMovie && currentEpisode > 1;

  const handleNextEpisode = useCallback(() => {
    if (hasNextEpisode) {
      const next = currentEpisode + 1;
      setCurrentEpisode(next);
      onEpisodeChange && onEpisodeChange(currentSeason, next);
    }
  }, [hasNextEpisode, currentEpisode, currentSeason, onEpisodeChange]);

  const handlePrevEpisode = useCallback(() => {
    if (hasPrevEpisode) {
      const prev = currentEpisode - 1;
      setCurrentEpisode(prev);
      onEpisodeChange && onEpisodeChange(currentSeason, prev);
    }
  }, [hasPrevEpisode, currentEpisode, currentSeason, onEpisodeChange]);

  // Generate Web Embed URL (strictly only fmov.my, movietvapi.stream, vidsrc.sh, or custom embed url)
  const tmdbId = media.tmdbId || media.id;
  const getWebEmbedUrl = (server: WebServer): string => {
    if (customEmbedUrl) {
      return customEmbedUrl;
    }
    if (server === 'fmov' || server.includes('fmov')) {
      return isMovie
        ? `https://fmov.my/embed/movie/${tmdbId}?color=F5C400`
        : `https://fmov.my/embed/series/${tmdbId}/${currentSeason}/${currentEpisode}?color=F5C400`;
    }
    if (server === 'movietvapi' || server.includes('movietv')) {
      return isMovie
        ? `https://movietvapi.stream/embed/movie/${tmdbId}`
        : `https://movietvapi.stream/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
    }
    // Default vidsrc.sh
    return isMovie
      ? `https://vidsrc.sh/embed/movie/${tmdbId}`
      : `https://vidsrc.sh/embed/tv/${tmdbId}/${currentSeason}/${currentEpisode}`;
  };

  return (
    <div className="relative w-full">
      {/* Cinematic Ambient Atmosphere Glow (YouTube / Apple TV Ambient Mode) */}
      {ambientGlow && !isLightsDimmed && (
        <div
          className="absolute -inset-3 sm:-inset-6 rounded-3xl opacity-25 sm:opacity-40 blur-2xl sm:blur-3xl pointer-events-none transition-opacity duration-700 z-0 overflow-hidden"
          aria-hidden="true"
        >
          <img
            src={media.backdropPath || media.posterPath}
            alt=""
            className="w-full h-full object-cover filter brightness-75 contrast-125 scale-110"
          />
        </div>
      )}

      <div
        ref={playerContainerRef}
        className="relative z-10 w-full rounded-2xl overflow-hidden bg-[#0a0a0d] border border-[#3A3A40] shadow-2xl transition-all duration-300 ring-1 ring-white/5"
      >
        {/* =========================================================================
            PLAYER STAGE: DIRECT NATIVE HLS OR WEB EMBED (16:9 CINEMATIC)
           ========================================================================= */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {playerMode === 'web' ? (
            /* Web Embed Player View with strictly 3 requested providers */
            <div className="w-full h-full flex flex-col bg-black relative">
              {/* Top Bar for Web Server Selection */}
              <div className="h-10.5 bg-[#141418] border-b border-[#303036] px-3 sm:px-4 flex items-center justify-between gap-2 z-10 shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <span className="text-[10px] uppercase font-bold text-[#A6A6AC] mr-1 hidden sm:inline">Web Provider:</span>
                  <button
                    type="button"
                    onClick={() => setWebServer('fmov')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      webServer === 'fmov'
                        ? 'bg-[#F5C400] text-black shadow-sm font-black'
                        : 'bg-[#212126] text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${webServer === 'fmov' ? 'bg-black' : 'bg-emerald-400 shadow-[0_0_6px_#34d399]'}`} />
                    <span>Server 1 · FMOV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWebServer('movietvapi')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      webServer === 'movietvapi'
                        ? 'bg-[#F5C400] text-black shadow-sm font-black'
                        : 'bg-[#212126] text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${webServer === 'movietvapi' ? 'bg-black' : 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'}`} />
                    <span>Server 2 · MovieTV API</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWebServer('vidsrc')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      webServer === 'vidsrc'
                        ? 'bg-[#F5C400] text-black shadow-sm font-black'
                        : 'bg-[#212126] text-slate-300 hover:text-white border border-white/5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${webServer === 'vidsrc' ? 'bg-black' : 'bg-purple-400 shadow-[0_0_6px_#c084fc]'}`} />
                    <span>Server 3 · VidSrc</span>
                  </button>

                  {/* Reload embed button */}
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
                      className="px-3 py-1 rounded-lg bg-[#25252b] hover:bg-[#303038] text-[#F5C400] text-[11px] font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#F5C400]/40 shadow-sm"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Switch to Direct Player</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Iframe Embed with Reload Key */}
              <div className="flex-1 w-full h-full relative">
                <iframe
                  key={`${webServer}-${tmdbId}-${currentSeason}-${currentEpisode}-${iframeReloadKey}`}
                  src={getWebEmbedUrl(webServer)}
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                />
              </div>
            </div>
          ) : loadingDirect ? (
            /* Connecting direct stream rotating circular Tstream.online brand spinner */
            <PlayerLoadingSpinner
              subtitle="Fast multi-server HLS playback, multilingual subtitles, and zero ads."
            />
          ) : directResults.length > 0 ? (
            /* Native 100% Direct HTML5 Player */
            <DirectVideoPlayer
              title={media.title}
              isMovie={isMovie}
              genres={Array.isArray(media.genres) ? media.genres.map((g: any) => typeof g === 'string' ? g : g.name) : []}
              releaseYear={media.releaseDate ? new Date(media.releaseDate).getFullYear() : (media as any).firstAirDate ? new Date((media as any).firstAirDate).getFullYear() : 2026}
              currentSeason={currentSeason}
              currentEpisode={currentEpisode}
              totalSeasons={tvDetail?.seasons?.length || (media as any).numberOfSeasons || 1}
              seasonsList={tvDetail?.seasons}
              episodesList={episodesList}
              onSelectEpisode={(s, e) => {
                setCurrentSeason(s);
                setCurrentEpisode(e);
                if (onEpisodeChange) onEpisodeChange(s, e);
              }}
              providerResults={directResults}
              availableSubtitles={subtitles}
              onNextEpisode={handleNextEpisode}
              onPrevEpisode={handlePrevEpisode}
              hasNextEpisode={hasNextEpisode}
              hasPrevEpisode={hasPrevEpisode}
              storageKey={`${media.id}_${currentSeason}_${currentEpisode}`}
              initialResumeSeek={savedResumeSeconds}
              onProgressUpdate={handleProgressUpdate}
              onRefreshStreams={() => loadDirectStreams()}
              isTheaterMode={isTheaterMode}
              onToggleTheater={onToggleTheater}
              isLightsDimmed={isLightsDimmed}
              onToggleLights={onToggleLights}
              backdropPath={media.backdropPath || media.posterPath}
            />
          ) : (
            /* Direct HLS Stream Busy State with One-Click Fallback */
            <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center max-w-xl bg-gradient-to-b from-[#121215] to-[#0a0a0d] w-full h-full relative overflow-y-auto no-scrollbar">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-3 text-[#F5C400]">
                <AlertTriangle className="w-6 h-6 text-[#F5C400]" />
              </div>

              <h3 className="text-base sm:text-lg font-black text-white mb-1 uppercase tracking-wider">
                Direct HLS Stream Currently Busy
              </h3>
              <p className="text-xs text-[#A6A6AC] mb-5 max-w-md leading-relaxed">
                No working stream responded on the selected server. Select an alternative direct server cluster below or rescan all servers:
              </p>

              {/* Alternative HLS Clusters */}
              <div className="w-full text-left mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Alternative HLS Clusters (Direct Native Playback):
                </span>
              </div>

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
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold uppercase">
                        {cluster.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Rescan Button */}
              <button
                onClick={() => loadDirectStreams('all')}
                disabled={isScanningAlternative}
                className="px-5 py-2.5 rounded-xl bg-[#2b2b32] hover:bg-[#383842] text-white border border-[#3A3A40] font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningAlternative ? 'animate-spin text-[#F5C400]' : ''}`} />
                <span>{isScanningAlternative ? 'Scanning Clusters...' : 'Sweep All HLS Servers'}</span>
              </button>
            </div>
          )}
        </div>

        {/* =========================================================================
            PLAYER SUB-BAR: MODE & AMBIENT CONTROLS
           ========================================================================= */}
        <div className="px-4 py-2.5 bg-[#121215] border-t border-[#3A3A40]/60 flex items-center justify-between text-[11px] text-[#A6A6AC] flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
            <span className="font-bold text-white">
              {playerMode === 'direct'
                ? `Direct Native Player (${HLS_CLUSTERS.find(c => c.id === activeCluster)?.name || 'Core (Default)'})`
                : `Embed Player · ${webServer.replace(/^server_\d+_/, '').toUpperCase()}`}
            </span>
            <span className="text-[#3A3A40]">|</span>
            <span className="font-mono text-emerald-400 font-bold">
              {playerMode === 'direct'
                ? `${(HLS_CLUSTERS.find(c => c.id === activeCluster)?.name.split(' ')[0] || 'Core')} First + Background Failover`
                : 'Embed Mode Active'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isMovie && episodeLoadError && (
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

            {/* Ambient Backlight Toggle */}
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
