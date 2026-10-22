import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Film,
  Tv,
  RefreshCw,
  Radio,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { MediaDetail, SubtitleTrack, Episode } from '../types/media';
import { searchSubtitles } from '../services/subtitles';
import { saveProgress, getUserSettings } from '../services/storage';
import { fetchSeasonEpisodes } from '../services/tmdb';
import { DirectVideoPlayer } from './DirectVideoPlayer';
import { fetchDirectStreams, DirectProviderResult } from '../services/directStreamClient';

interface StreamingPlayerProps {
  media: MediaDetail;
  initialSeason?: number;
  initialEpisode?: number;
  onEpisodeChange?: (season: number, episode: number) => void;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  isLightsDimmed?: boolean;
  onToggleLights?: () => void;
}

export const StreamingPlayer: React.FC<StreamingPlayerProps> = ({
  media,
  initialSeason = 1,
  initialEpisode = 1,
  onEpisodeChange,
  isTheaterMode = false,
  onToggleTheater,
  isLightsDimmed = false,
  onToggleLights
}) => {
  const settings = getUserSettings();
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const [currentSeason, setCurrentSeason] = useState(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);

  // Subtitles
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);

  // Direct HLS Streams
  const [directResults, setDirectResults] = useState<DirectProviderResult[]>([]);
  const [loadingDirect, setLoadingDirect] = useState<boolean>(true);
  const [directFailed, setDirectFailed] = useState<boolean>(false);

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

  // Load 100% Direct Native HLS Streams (no iframes)
  const loadDirectStreams = useCallback(async () => {
    setLoadingDirect(true);
    setDirectFailed(false);
    try {
      const results = await fetchDirectStreams({
        tmdbId: media.tmdbId || media.id,
        mediaType: media.mediaType,
        season: isMovie ? undefined : currentSeason,
        episode: isMovie ? undefined : currentEpisode,
        provider: settings.preferredServer
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
    }
  }, [media.tmdbId, media.id, media.mediaType, currentSeason, currentEpisode, isMovie, settings.preferredServer]);

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

  // Save progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveProgress({
        id: media.id,
        mediaType: media.mediaType,
        title: media.title,
        posterPath: media.posterPath,
        backdropPath: media.backdropPath,
        progressSeconds: 120,
        durationSeconds: (media.runtime || 120) * 60,
        seasonNumber: isMovie ? undefined : currentSeason,
        episodeNumber: isMovie ? undefined : currentEpisode,
        episodeName: currentEpisodeData?.name
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [media, currentSeason, currentEpisode, currentEpisodeData, isMovie]);

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

  return (
    <div
      ref={playerContainerRef}
      className="relative w-full rounded-2xl overflow-hidden bg-[#0a0a0d] border border-[#3A3A40] shadow-2xl transition-all duration-300"
    >
      {/* 100% Direct Native HLS Player Stage (Zero Iframes) */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {loadingDirect ? (
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
              Decoding native master .m3u8 playlist without iframe servers. Preparing 1080p video stream...
            </p>
          </div>
        ) : directResults.length > 0 ? (
          <DirectVideoPlayer
            title={media.title}
            isMovie={isMovie}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            providerResults={directResults}
            availableSubtitles={subtitles}
            onNextEpisode={handleNextEpisode}
            onPrevEpisode={handlePrevEpisode}
            hasNextEpisode={hasNextEpisode}
            hasPrevEpisode={hasPrevEpisode}
            storageKey={`${media.id}_${currentSeason}_${currentEpisode}`}
            onRefreshStreams={loadDirectStreams}
            isTheaterMode={isTheaterMode}
            onToggleTheater={onToggleTheater}
            isLightsDimmed={isLightsDimmed}
            onToggleLights={onToggleLights}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md bg-[#0a0a0d] w-full h-full">
            <AlertTriangle className="w-12 h-12 text-[#F5C400] mb-3" />
            <h3 className="text-sm font-extrabold text-white mb-1 uppercase tracking-wide">
              Direct HLS Stream Currently Busy
            </h3>
            <p className="text-xs text-[#A6A6AC] mb-4">
              Retry scanning sources to connect to an alternative HLS cluster:
            </p>
            <button
              onClick={loadDirectStreams}
              className="px-5 py-2.5 rounded-xl bg-[#F5C400] text-black font-black text-xs hover:bg-[#e0b400] transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Rescan HLS Servers</span>
            </button>
          </div>
        )}
      </div>

      {/* Pure Direct HLS Status Sub-bar */}
      <div className="px-4 py-2 bg-[#121215] border-t border-[#3A3A40]/60 flex items-center justify-between text-[11px] text-[#A6A6AC] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold text-white">Direct Native Player</span>
          <span className="text-[#3A3A40]">|</span>
          <span className="font-mono text-emerald-400 font-bold">100% HLS / MP4</span>
          <span className="text-[#3A3A40]">|</span>
          <span>Native HTML5 video (No iframe embeds, no ads)</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Keyboard: Space (Play/Pause) · ← / → (10s) · ↑ / ↓ (Volume) · F (Fullscreen)</span>
        </div>
      </div>
    </div>
  );
};
