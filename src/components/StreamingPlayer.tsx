import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Radio,
  AlertTriangle,
  Play,
  Globe,
  Zap,
  Server,
  Layers
} from 'lucide-react';
import { MediaDetail, SubtitleTrack, Episode } from '../types/media';
import { searchSubtitles } from '../services/subtitles';
import { getUserSettings } from '../services/storage';
import { fetchSeasonEpisodes } from '../services/tmdb';
import { DirectVideoPlayer } from './DirectVideoPlayer';
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
  playerMode?: PlayerMode;
  onPlayerModeChange?: (mode: PlayerMode) => void;
  webServer?: WebServer;
  onWebServerChange?: (server: WebServer) => void;
  customEmbedUrl?: string;
}

const HLS_CLUSTERS = [
  { id: 'vidapi', name: 'Apollo Master', desc: 'Direct HLS Master (High Speed)', badge: 'Fastest' },
  { id: 'showbox', name: 'Zeus 4K (Showbox)', desc: 'Poseidon / Febbox 4K Cluster', badge: 'Ultra HD' },
  { id: 'vidlink', name: 'Hermes Velocity', desc: 'Nebula Fast Direct MP4/HLS', badge: 'Stable' },
  { id: 'vidrock', name: 'Titan DeepCore', desc: 'Titan Decrypted HLS', badge: 'Backup' },
  { id: 'all', name: 'Rescan All Clusters', desc: 'Simultaneous Multi-Cluster Sweep', badge: 'Auto' }
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
  const [internalMode, setInternalMode] = useState<PlayerMode>('direct');
  const [internalWebServer, setInternalWebServer] = useState<WebServer>('fmov');

  const playerMode = externalPlayerMode !== undefined ? externalPlayerMode : internalMode;
  const webServer = externalWebServer !== undefined ? externalWebServer : internalWebServer;

  const setPlayerMode = (mode: PlayerMode) => {
    if (onPlayerModeChange) onPlayerModeChange(mode);
    setInternalMode(mode);
  };

  const setWebServer = (server: WebServer) => {
    if (onWebServerChange) onWebServerChange(server);
    setInternalWebServer(server);
  };

  const [currentSeason, setCurrentSeason] = useState(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [savedResumeSeconds, setSavedResumeSeconds] = useState<number | undefined>(undefined);

  // Subtitles
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);

  // Direct HLS Streams
  const [directResults, setDirectResults] = useState<DirectProviderResult[]>([]);
  const [loadingDirect, setLoadingDirect] = useState<boolean>(true);
  const [directFailed, setDirectFailed] = useState<boolean>(false);
  const [activeCluster, setActiveCluster] = useState<string>(settings.preferredServer || 'all');
  const [isScanningAlternative, setIsScanningAlternative] = useState<boolean>(false);

  // TV Episodes cache
  const [episodesMap, setEpisodesMap] = useState<Record<number, Episode[]>>({});
  const [, setLoadingEpisodes] = useState(false);

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

  // Load TV episodes for current season
  useEffect(() => {
    if (isMovie) return;
    let isMounted = true;
    async function loadSeason() {
      if (episodesMap[currentSeason] && episodesMap[currentSeason].length > 0) return;
      if (currentSeasonData?.episodes && currentSeasonData.episodes.length > 0) {
        setEpisodesMap(prev => ({ ...prev, [currentSeason]: currentSeasonData.episodes! }));
        return;
      }
      setLoadingEpisodes(true);
      try {
        const eps = await fetchSeasonEpisodes(media.tmdbId || media.id, currentSeason);
        if (isMounted) {
          setEpisodesMap(prev => ({ ...prev, [currentSeason]: eps }));
        }
      } catch (err) {
        console.warn('Failed to load season episodes:', err);
      } finally {
        if (isMounted) setLoadingEpisodes(false);
      }
    }
    loadSeason();
    return () => {
      isMounted = false;
    };
  }, [media.id, media.tmdbId, currentSeason, isMovie, currentSeasonData]);

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
          voteAverage: 8.0,
          runtime: 45
        }));

  const currentEpisodeData = episodesList.find((e: any) => e.episodeNumber === currentEpisode);

  // Load Direct Native HLS Streams with target cluster support
  const loadDirectStreams = useCallback(async (targetCluster?: string) => {
    setLoadingDirect(true);
    setDirectFailed(false);
    setIsScanningAlternative(true);
    const cluster = targetCluster || activeCluster;
    if (targetCluster) setActiveCluster(targetCluster);

    try {
      const results = await fetchDirectStreams({
        tmdbId: media.tmdbId || media.id,
        mediaType: media.mediaType,
        season: isMovie ? undefined : currentSeason,
        episode: isMovie ? undefined : currentEpisode,
        provider: cluster === 'all' ? undefined : cluster
      });
      setDirectResults(results || []);
      if (!results || results.length === 0) {
        setDirectFailed(true);
      }
    } catch (err) {
      console.warn('Direct stream resolution failed:', err);
      setDirectFailed(true);
    } finally {
      setLoadingDirect(false);
      setIsScanningAlternative(false);
    }
  }, [media.tmdbId, media.id, media.mediaType, currentSeason, currentEpisode, isMovie, activeCluster]);

  useEffect(() => {
    loadDirectStreams();
  }, [loadDirectStreams]);

  // Load subtitles
  useEffect(() => {
    let isMounted = true;
    async function loadSubs() {
      const results = await searchSubtitles({
        mediaType: media.mediaType,
        tmdbId: media.tmdbId,
        imdbId: media.imdbId,
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

  const handleProgressUpdate = (progressSeconds: number, durationSeconds: number) => {
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
  };

  const maxEpisode = currentSeasonData?.episodeCount || episodesList.length || 10;
  const hasNextEpisode = !isMovie && currentEpisode < maxEpisode;
  const hasPrevEpisode = !isMovie && currentEpisode > 1;

  const handleNextEpisode = () => {
    if (hasNextEpisode) {
      const next = currentEpisode + 1;
      setCurrentEpisode(next);
      onEpisodeChange && onEpisodeChange(currentSeason, next);
    }
  };

  const handlePrevEpisode = () => {
    if (hasPrevEpisode) {
      const prev = currentEpisode - 1;
      setCurrentEpisode(prev);
      onEpisodeChange && onEpisodeChange(currentSeason, prev);
    }
  };

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
    <div
      ref={playerContainerRef}
      className="relative w-full rounded-2xl overflow-hidden bg-[#0a0a0d] border border-[#3A3A40] shadow-2xl transition-all duration-300"
    >
      {/* =========================================================================
          PLAYER STAGE: DIRECT NATIVE HLS OR WEB EMBED (16:9 CINEMATIC)
         ========================================================================= */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {playerMode === 'web' ? (
          /* Web Embed Player View with strictly 3 requested providers */
          <div className="w-full h-full flex flex-col bg-black relative">
            {/* Top Bar for Web Server Selection */}
            <div className="h-10 bg-[#16161a] border-b border-[#303036] px-3 sm:px-4 flex items-center justify-between gap-2 z-10 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                <span className="text-[10px] uppercase font-bold text-[#A6A6AC] mr-1 hidden sm:inline">Web Provider:</span>
                <button
                  type="button"
                  onClick={() => setWebServer('fmov')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    webServer === 'fmov'
                      ? 'bg-[#F5C400] text-black shadow-sm'
                      : 'bg-[#232328] text-slate-300 hover:text-white border border-white/5'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${webServer === 'fmov' ? 'bg-black' : 'bg-emerald-400'}`} />
                  <span>Server 1 · FMOV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWebServer('movietvapi')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    webServer === 'movietvapi'
                      ? 'bg-[#F5C400] text-black shadow-sm'
                      : 'bg-[#232328] text-slate-300 hover:text-white border border-white/5'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${webServer === 'movietvapi' ? 'bg-black' : 'bg-cyan-400'}`} />
                  <span>Server 2 · MovieTV API</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWebServer('vidsrc')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    webServer === 'vidsrc'
                      ? 'bg-[#F5C400] text-black shadow-sm'
                      : 'bg-[#232328] text-slate-300 hover:text-white border border-white/5'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${webServer === 'vidsrc' ? 'bg-black' : 'bg-purple-400'}`} />
                  <span>Server 3 · VidSrc</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPlayerMode('direct');
                  loadDirectStreams();
                }}
                className="px-3 py-1 rounded-lg bg-[#25252b] hover:bg-[#303038] text-[#F5C400] text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#F5C400]/30 shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Switch to Direct Player</span>
              </button>
            </div>

            {/* Iframe Embed */}
            <div className="flex-1 w-full h-full relative">
              <iframe
                key={`${webServer}-${tmdbId}-${currentSeason}-${currentEpisode}`}
                src={getWebEmbedUrl(webServer)}
                className="w-full h-full border-0"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              />
            </div>
          </div>
        ) : loadingDirect ? (
          /* Connecting direct stream loading spinner */
          <div className="flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0d] w-full h-full">
            <div className="relative mb-4">
              <div className="w-14 h-14 border-3 border-[#3A3A40] border-t-[#F5C400] rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#F5C400] animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F5C400] animate-pulse" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Connecting to Direct HLS Stream
              </h3>
            </div>
            <p className="text-xs text-[#A6A6AC] max-w-md">
              Scanning high-bandwidth HLS master clusters (Apollo, Zeus, Hermes). Decoding 1080p video feed...
            </p>
          </div>
        ) : directResults.length > 0 ? (
          /* Native 100% Direct HTML5 Player */
          <DirectVideoPlayer
            title={media.title}
            isMovie={isMovie}
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
              The primary direct cluster is congested. Select an alternative HLS cluster below, or switch instantly to the Web Stream player:
            </p>

            {/* Quick Action: Instant Web Stream Player (FMOV, MovieTV API, VidSrc) */}
            <div className="w-full mb-5 p-3 sm:p-4 rounded-xl bg-[#1a1a20] border border-[#F5C400]/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-black text-white">Instant Web Player (Zero Delay)</span>
                </div>
                <p className="text-[11px] text-[#A6A6AC] mt-0.5">
                  FMOV / MovieTV API / VidSrc embeds are 100% active and available right now.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPlayerMode('web')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/25 shrink-0 active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Play Now (Web Stream)</span>
              </button>
            </div>

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
          PLAYER SUB-BAR: MODE & SERVER INDICATOR
         ========================================================================= */}
      <div className="px-4 py-2.5 bg-[#121215] border-t border-[#3A3A40]/60 flex items-center justify-between text-[11px] text-[#A6A6AC] flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-white">
            {playerMode === 'direct' ? 'Direct Native Player' : `Web Stream · ${webServer.toUpperCase()}`}
          </span>
          <span className="text-[#3A3A40]">|</span>
          <span className="font-mono text-emerald-400 font-bold">
            {playerMode === 'direct' ? '100% Native HLS' : 'Verified Multi-Source'}
          </span>
          <span className="text-[#3A3A40]">|</span>
          <span className="hidden sm:inline">
            {playerMode === 'direct' ? 'Direct master .m3u8 stream' : 'FMOV · MovieTV API · VidSrc'}
          </span>
        </div>

        {/* Mode Switcher Pill */}
        <div className="flex items-center gap-1.5 p-0.5 bg-[#1e1e24] rounded-lg border border-[#33333a]">
          <button
            type="button"
            onClick={() => {
              setPlayerMode('direct');
              loadDirectStreams();
            }}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              playerMode === 'direct'
                ? 'bg-[#F5C400] text-black shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Direct HLS</span>
          </button>
          <button
            type="button"
            onClick={() => setPlayerMode('web')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              playerMode === 'web'
                ? 'bg-[#F5C400] text-black shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Web Stream</span>
          </button>
        </div>
      </div>
    </div>
  );
};
