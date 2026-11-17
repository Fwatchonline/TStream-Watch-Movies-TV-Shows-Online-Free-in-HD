import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  Languages,
  Cloud,
  Upload,
  Sliders,
  Clock,
  ArrowLeft,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  RefreshCw,
  Repeat,
  Tv,
  Film,
  Sparkles,
  HelpCircle,
  X,
  Search
} from 'lucide-react';
import { ResolvedStream, DirectProviderResult, cleanServerDisplay, formatQualityBadge, stripQualityFromName, getQualityPillClasses } from '../services/directStreamClient';
import { SubtitleTrack, Episode } from '../types/media';
import { PlayerLoadingSpinner } from './PlayerLoadingSpinner';
import { getUserPlayerSettings, UserPlayerSettings } from '../services/playerSettings';
import { LanguageFlag } from './LanguageFlag';
import { detectStreamQualityFromDimensions, getMediaQuality, QualityInfo } from '../services/quality';
import { QualityBadge } from './QualityBadge';

interface DirectVideoPlayerProps {
  title: string;
  isMovie: boolean;
  genres?: string[];
  releaseYear?: string | number;
  currentSeason?: number;
  currentEpisode?: number;
  totalSeasons?: number;
  seasonsList?: any[];
  episodesList?: Episode[];
  onSelectEpisode?: (season: number, episode: number) => void;
  providerResults: DirectProviderResult[];
  availableSubtitles?: SubtitleTrack[];
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPrevEpisode?: boolean;
  storageKey?: string;
  initialResumeSeek?: number;
  onProgressUpdate?: (currentTime: number, duration: number) => void;
  onRefreshStreams?: () => void;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  isLightsDimmed?: boolean;
  onToggleLights?: () => void;
  backdropPath?: string;
  onResolvedQualityChange?: (qualityLabel: string) => void;
}

type ModalView =
  | 'none'
  | 'servers'
  | 'audio'
  | 'subtitles'
  | 'subtitle-style'
  | 'subtitle-delay'
  | 'settings'
  | 'quality'
  | 'speed'
  | 'aspect-ratio'
  | 'volume-boost';

interface ParsedCue {
  start: number;
  end: number;
  text: string;
}

interface HudFeedback {
  id: number;
  type: string;
  text: string;
}

// Custom 15-second skip SVG icons matching image_12a0d412.png
const RotateCcw15Icon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <text x="12" y="15.5" fontSize="7" fontWeight="900" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif">15</text>
  </svg>
);

const RotateCw15Icon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <text x="12" y="15.5" fontSize="7" fontWeight="900" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="sans-serif">15</text>
  </svg>
);

const LANGUAGE_FLAGS: Record<string, string> = {
  sr: '🇷🇸',
  hr: '🇭🇷',
  bs: '🇧🇦',
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  ru: '🇷🇺',
  tr: '🇹🇷',
  sl: '🇸🇮',
  mk: '🇲🇰',
  sq: '🇦🇱',
  ar: '🇸🇦',
  hi: '🇮🇳',
  id: '🇮🇩',
  ms: '🇲🇾',
  nl: '🇳🇱',
  pl: '🇵🇱',
  cs: '🇨🇿',
  hu: '🇭🇺',
  ro: '🇷🇴',
  bg: '🇧🇬',
  el: '🇬🇷',
  sv: '🇸🇪',
  no: '🇳🇴',
  da: '🇩🇰',
  fi: '🇫🇮',
  he: '🇮🇱',
  ko: '🇰🇷',
  zh: '🇨🇳',
  ja: '🇯🇵',
  vi: '🇻🇳',
  th: '🇹🇭'
};

export const DirectVideoPlayer: React.FC<DirectVideoPlayerProps> = ({
  title,
  isMovie,
  genres = [],
  releaseYear = 2026,
  currentSeason = 1,
  currentEpisode = 1,
  totalSeasons = 1,
  seasonsList,
  episodesList = [],
  onSelectEpisode,
  providerResults,
  availableSubtitles = [],
  onNextEpisode,
  onPrevEpisode,
  hasNextEpisode,
  hasPrevEpisode,
  storageKey,
  initialResumeSeek,
  onProgressUpdate,
  onRefreshStreams,
  isTheaterMode,
  onToggleTheater,
  isLightsDimmed,
  onToggleLights,
  backdropPath,
  onResolvedQualityChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const isDraggingScrubberRef = useRef<boolean>(false);
  const failoverSeekRef = useRef<number>(0);

  // Web Audio Context & Gain Node for Volume Boost
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Flatten all streams (memoized so activeStream keeps stable reference across renders)
  const allStreams = useMemo(() => {
    const list: Array<ResolvedStream & { providerName: string; providerKey: string }> = [];
    for (const pr of providerResults) {
      if (pr.provider?.toLowerCase().includes('castle') || pr.providerName?.toLowerCase().includes('castle')) {
        continue;
      }
      for (const st of pr.streams) {
        if (
          st.server?.toLowerCase().includes('castle') ||
          st.url?.toLowerCase().includes('castle') ||
          (st as any).providerKey?.toLowerCase().includes('castle')
        ) {
          continue;
        }
        list.push({
          ...st,
          server: cleanServerDisplay(st.server),
          providerName: cleanServerDisplay(pr.providerName),
          providerKey: pr.provider
        });
      }
    }
    return list;
  }, [providerResults]);

  // Active Stream Selection
  const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
  const activeStream = allStreams[selectedStreamIndex] || allStreams[0];

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isTouchMode, setIsTouchMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  // Scrubber Hover
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);

  // Active Popover / Modal Menu
  const [activeModal, setActiveModal] = useState<ModalView>('none');

  // Media adjustments
  const [aspectRatio, setAspectRatio] = useState<'fit' | 'fill' | '16:9' | '4:3'>('fit');
  const [brightness, setBrightness] = useState<number>(100);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [isPiP, setIsPiP] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [volumeBoost, setVolumeBoost] = useState<number>(100);
  const [isLoop, setIsLoop] = useState<boolean>(false);
  const [autoplayNext, setAutoplayNext] = useState<boolean>(true);

  // Quality
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto');
  const [streamQuality, setStreamQuality] = useState<QualityInfo>(() =>
    getMediaQuality({
      title,
      mediaType: isMovie ? 'movie' : 'tv',
      releaseDate: releaseYear ? `${releaseYear}-01-01` : undefined
    })
  );
  const [availableQualities, setAvailableQualities] = useState<string[]>(['Auto', '1080p', '720p', '480p']);
  const [streamResolution, setStreamResolution] = useState<{ width: number; height: number } | null>(null);
  const [detectedStreamQualities, setDetectedStreamQualities] = useState<Record<string, string>>({});

  const reportResolvedResolution = useCallback(
    (streamUrl: string, width: number, height: number) => {
      let label = `${height}p`;
      if (width >= 3800 || height >= 2160) label = '4K';
      else if (width >= 2500 || height >= 1440) label = '1440p';
      else if (width >= 1800 || height >= 1000) label = '1080p';
      else if (width >= 1200 || height >= 680) label = '720p';
      else if (width >= 800 || height >= 450) label = '480p';

      setDetectedStreamQualities((prev) =>
        prev[streamUrl] === label ? prev : { ...prev, [streamUrl]: label }
      );
      onResolvedQualityChange?.(label);
    },
    [onResolvedQualityChange]
  );

  // Audio tracks
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; name: string }>>([
    { id: 0, name: 'Original Audio' }
  ]);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<number>(0);

  // Subtitles
  const [activeSubTrackUrl, setActiveSubTrackUrl] = useState<string | null>(null);
  const [uploadedSubs, setUploadedSubs] = useState<SubtitleTrack[]>([]);
  const [cues, setCues] = useState<ParsedCue[]>([]);
  const [customSubtitleText, setCustomSubtitleText] = useState<string>('');
  const [subSearchQuery, setSubSearchQuery] = useState<string>('');

  // Subtitle custom styles (image_659a6ea3.png)
  const [subFontSize, setSubFontSize] = useState<number>(100); // 50% - 200%
  const [subTextColor, setSubTextColor] = useState<string>('#FFFFFF'); // White, Yellow, Cyan, Green
  const [subBgColor, setSubBgColor] = useState<string>('#000000'); // Black, White, Outline/None
  const [subBgOpacity, setSubBgOpacity] = useState<number>(60); // 0% - 100%

  // Subtitle delay in seconds (image_d377490c.png)
  const [subDelay, setSubDelay] = useState<number>(0.0); // -10.0s to +10.0s

  // HUD toast feedback
  const [hudFeedback, setHudFeedback] = useState<HudFeedback | null>(null);

  // Resume key
  const resumeKey = storageKey ? `stream_progress_${storageKey}` : null;

  // Player preferences
  const [playerSettings, setPlayerSettings] = useState<UserPlayerSettings>(() => getUserPlayerSettings());

  useEffect(() => {
    const handleSettingsChanged = () => {
      const updated = getUserPlayerSettings();
      setPlayerSettings(updated);
    };
    window.addEventListener('tstream_player_settings_changed', handleSettingsChanged);
    return () => window.removeEventListener('tstream_player_settings_changed', handleSettingsChanged);
  }, []);

  // Format seconds to H:MM:SS or M:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Trigger HUD Notification
  const triggerHud = useCallback((type: string, text: string) => {
    const id = Date.now();
    setHudFeedback({ id, type, text });
    setTimeout(() => {
      setHudFeedback(curr => (curr?.id === id ? null : curr));
    }, 1200);
  }, []);

  // Automatic Failover Handler
  const triggerFailover = useCallback(() => {
    const v = videoRef.current;
    if (v && v.currentTime > 2) {
      failoverSeekRef.current = v.currentTime;
    }
    if (allStreams.length > 1) {
      setSelectedStreamIndex(prev => {
        const nextIdx = (prev + 1) % allStreams.length;
        const nextServer = allStreams[nextIdx];
        triggerHud('server', `Auto-failover: ${nextServer.providerName || nextServer.server}`);
        return nextIdx;
      });
    } else {
      setLoadError(`Stream interrupted on ${stripQualityFromName(cleanServerDisplay(activeStream?.server || 'Aether'))}. Please select another source.`);
      setIsLoading(false);
    }
  }, [allStreams, activeStream, triggerHud]);

  // Web Audio Volume Boost
  const applyVolumeBoost = (boostPercent: number) => {
    setVolumeBoost(boostPercent);
    const v = videoRef.current;
    if (!v) return;

    if (!audioCtxRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaElementSource(v);
          const gain = ctx.createGain();
          source.connect(gain);
          gain.connect(ctx.destination);
          audioCtxRef.current = ctx;
          gainNodeRef.current = gain;
        }
      } catch (err) {
        console.warn('Volume boost Web Audio init note:', err);
      }
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = boostPercent / 100;
    }
    triggerHud('volume', `Volume Boost: ${boostPercent}%`);
  };

  // 1. Initialize or switch stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeStream) return;

    setIsLoading(true);
    setLoadError(null);

    // Destroy existing Hls instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = activeStream.playUrl || activeStream.url;
    const isHls = activeStream.type === 'hls' || streamUrl.includes('.m3u8');

    let initialSeek = video.currentTime > 0 ? video.currentTime : 0;
    if (failoverSeekRef.current > 0) {
      initialSeek = failoverSeekRef.current;
      failoverSeekRef.current = 0;
    } else if (playerSettings.autoResumePlayback) {
      if (initialSeek === 0 && initialResumeSeek && initialResumeSeek > 10) {
        initialSeek = initialResumeSeek;
      } else if (initialSeek === 0 && resumeKey) {
        try {
          const saved = localStorage.getItem(resumeKey);
          if (saved) {
            const parsed = parseFloat(saved);
            if (parsed > 10) initialSeek = parsed;
          }
        } catch {}
      }
    }

    const triggerAutoPlay = () => {
      const v = videoRef.current;
      if (!v) return;

      if (playbackSpeed !== 1) {
        try {
          v.playbackRate = playbackSpeed;
        } catch {}
      }

      if (initialSeek > 0 && Math.abs(v.currentTime - initialSeek) > 2) {
        try {
          v.currentTime = initialSeek;
        } catch {}
      }

      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch(err => {
            console.warn('Autoplay waiting for user gesture or muted:', err);
            v.muted = true;
            setIsMuted(true);
            v.play()
              .then(() => {
                setIsPlaying(true);
                setIsLoading(false);
              })
              .catch(() => {
                setIsPlaying(false);
                setIsLoading(false);
              });
          });
      }
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (hls.levels && hls.levels.length > 0) {
          const heights = Array.from(new Set(hls.levels.map(l => l.height).filter(h => h > 0))).sort((a, b) => b - a);
          if (heights.length > 0) {
            setAvailableQualities(['Auto', ...heights.map(h => (h >= 2160 ? '4K (2160p)' : `${h}p`))]);
            const top = hls.levels.reduce((prev, curr) => (curr.height > prev.height ? curr : prev), hls.levels[0]);
            if (top && top.height > 0) {
              setStreamResolution({ width: top.width || 0, height: top.height });
              setStreamQuality(detectStreamQualityFromDimensions(top.width || 0, top.height, {
                title,
                mediaType: isMovie ? 'movie' : 'tv',
                releaseDate: releaseYear ? `${releaseYear}-01-01` : undefined
              }));
              reportResolvedResolution(streamUrl, top.width || 0, top.height);
            }
          }
        }
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          const detected = hls.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || t.lang || `Audio Track ${idx + 1}`
          }));
          setAudioTracks([{ id: -1, name: 'Original Audio' }, ...detected]);
        }
        triggerAutoPlay();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (hls.levels && hls.levels[data.level]) {
          const lvl = hls.levels[data.level];
          if (lvl.height > 0) {
            setStreamResolution({ width: lvl.width || 0, height: lvl.height });
            setStreamQuality(detectStreamQualityFromDimensions(lvl.width || 0, lvl.height, {
              title,
              mediaType: isMovie ? 'movie' : 'tv',
              releaseDate: releaseYear ? `${releaseYear}-01-01` : undefined
            }));
            reportResolvedResolution(streamUrl, lvl.width || 0, lvl.height);
          }
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (video.paused && isLoading) {
          triggerAutoPlay();
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network error, recovering...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media error, recovering...');
              hls.recoverMediaError();
              break;
            default:
              console.warn(`Fatal HLS stream error on ${activeStream?.server || 'current'}, initiating auto-failover...`);
              hls.destroy();
              triggerFailover();
              break;
          }
        }
      });
    } else {
      video.src = streamUrl;
      const onMetadataLoaded = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setStreamResolution({ width: video.videoWidth, height: video.videoHeight });
          setStreamQuality(detectStreamQualityFromDimensions(video.videoWidth, video.videoHeight, {
            title,
            mediaType: isMovie ? 'movie' : 'tv',
            releaseDate: releaseYear ? `${releaseYear}-01-01` : undefined
          }));
          reportResolvedResolution(streamUrl, video.videoWidth, video.videoHeight);
        }
        triggerAutoPlay();
      };
      video.addEventListener('loadedmetadata', onMetadataLoaded, { once: true });
    }

    const onVideoResize = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setStreamResolution({ width: video.videoWidth, height: video.videoHeight });
        setStreamQuality(detectStreamQualityFromDimensions(video.videoWidth, video.videoHeight, {
          title,
          mediaType: isMovie ? 'movie' : 'tv',
          releaseDate: releaseYear ? `${releaseYear}-01-01` : undefined
        }));
        reportResolvedResolution(streamUrl, video.videoWidth, video.videoHeight);
      }
    };
    video.addEventListener('resize', onVideoResize);

    return () => {
      video.removeEventListener('resize', onVideoResize);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedStreamIndex, activeStream?.url, resumeKey]);

  // 2. Playback tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let lastReportTime = 0;
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (resumeKey && video.currentTime > 5) {
        localStorage.setItem(resumeKey, video.currentTime.toString());
      }
      if (video.buffered.length > 0) {
        setBufferedTime(video.buffered.end(video.buffered.length - 1));
      }
      const now = Date.now();
      if (now - lastReportTime > 6000 && onProgressUpdate && video.currentTime > 3) {
        lastReportTime = now;
        onProgressUpdate(video.currentTime, video.duration || 0);
      }
    };

    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (onProgressUpdate && video.currentTime > 3) {
        onProgressUpdate(video.currentTime, video.duration || 0);
      }
    };
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onEnded = () => {
      setIsPlaying(false);
      if (autoplayNext && hasNextEpisode && onNextEpisode) {
        onNextEpisode();
      }
    };
    const onError = () => {
      console.warn(`Native video playback error on ${activeStream?.server || 'current'}, initiating auto-failover...`);
      triggerFailover();
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [activeStream, resumeKey, autoplayNext, hasNextEpisode, onNextEpisode, onProgressUpdate, triggerFailover]);

  // Auto-hide controls after inactivity (mouse & touch safe)
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && activeModal === 'none') {
        setShowControls(false);
      }
    }, 3500);
  }, [isPlaying, activeModal]);

  const handleTouchActivity = useCallback(() => {
    lastTouchTimeRef.current = Date.now();
    setIsTouchMode(true);
    handleMouseMove();
  }, [handleMouseMove]);

  useEffect(() => {
    if (isPlaying && activeModal === 'none') {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    } else if (!isPlaying) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(true);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, activeModal]);

  // Play / Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      triggerHud('play', 'Playing');
      handleMouseMove();
    } else {
      video.pause();
      setShowControls(true);
      triggerHud('pause', 'Paused');
    }
  };

  // Skip 15s forward / backward
  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const target = Math.max(0, Math.min(duration, video.currentTime + seconds));
    video.currentTime = target;
    setCurrentTime(target);
    triggerHud('seek', `${seconds > 0 ? '+15s' : '-15s'}`);
  };

  // Mute / Unmute
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    video.muted = nextMuted;
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      video.volume = 0.5;
    }
    triggerHud('volume', nextMuted ? 'Muted' : `Volume ${Math.round(volume * 100)}%`);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const video = videoRef.current;
    if (video) {
      video.volume = val;
      video.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  // Fullscreen (with iOS Safari webkitEnterFullscreen fallback)
  const toggleFullscreen = () => {
    const container = containerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void }) | null;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitDisplayingFullscreen?: boolean; webkitExitFullscreen?: () => void }) | null;
    if (!container) return;

    const fsDoc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
    const activeFs = document.fullscreenElement || fsDoc.webkitFullscreenElement;

    if (!activeFs) {
      if (container.requestFullscreen) {
        container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
          if (video?.webkitEnterFullscreen) {
            try {
              video.webkitEnterFullscreen();
            } catch {}
          }
        });
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else if (video?.webkitEnterFullscreen) {
        try {
          video.webkitEnterFullscreen();
        } catch {}
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      } else if (fsDoc.webkitExitFullscreen) {
        fsDoc.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const fsDoc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement || fsDoc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // PiP toggle
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.warn('PiP failed:', err);
    }
  };

  // Quality change
  const handleQualityChange = (q: string) => {
    setSelectedQuality(q);
    if (hlsRef.current) {
      if (q === 'Auto') {
        hlsRef.current.currentLevel = -1;
      } else {
        const heightTarget = q.includes('2160') ? 2160 : parseInt(q, 10);
        if (!isNaN(heightTarget) && hlsRef.current.levels) {
          const matchedLevel = hlsRef.current.levels.findIndex(l => l.height === heightTarget);
          if (matchedLevel !== -1) {
            hlsRef.current.currentLevel = matchedLevel;
            const lvl = hlsRef.current.levels[matchedLevel];
            if (lvl.height > 0) {
              setStreamResolution({ width: lvl.width || 0, height: lvl.height });
              setStreamQuality(detectStreamQualityFromDimensions(lvl.width || 0, lvl.height, {
                title,
                mediaType: isMovie ? 'movie' : 'tv',
                releaseDate: releaseYear ? `${releaseYear}-01-01` : undefined
              }));
            }
          }
        }
      }
    }
    triggerHud('quality', `Quality: ${q}`);
  };

  // Speed change
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    triggerHud('speed', `${speed}x Speed`);
  };

  // Aspect ratio change
  const handleAspectRatioCycle = () => {
    const ratios: Array<'fit' | 'fill' | '16:9' | '4:3'> = ['fit', 'fill', '16:9', '4:3'];
    const next = ratios[(ratios.indexOf(aspectRatio) + 1) % ratios.length];
    setAspectRatio(next);
    triggerHud('media', `Aspect Ratio: ${next.toUpperCase()}`);
  };

  // Scrubber drag / click
  const handleSeekFromEvent = (clientX: number) => {
    const video = videoRef.current;
    const scrubber = scrubberRef.current;
    if (!video || !duration || !scrubber) return;
    const rect = scrubber.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = pos * duration;
    video.currentTime = target;
    setCurrentTime(target);
  };

  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingScrubberRef.current = true;
    handleSeekFromEvent(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingScrubberRef.current) {
        handleSeekFromEvent(moveEvent.clientX);
      }
    };

    const onMouseUp = () => {
      isDraggingScrubberRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos);
    setHoverTime(pos * duration);
  };

  const handleScrubberTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches.length) return;
    e.stopPropagation();
    isDraggingScrubberRef.current = true;
    handleTouchActivity();
    const clientX = e.touches[0].clientX;
    handleSeekFromEvent(clientX);
    if (duration && scrubberRef.current) {
      const rect = scrubberRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setHoverPosition(pos);
      setHoverTime(pos * duration);
    }
  };

  const handleScrubberTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingScrubberRef.current || !e.touches.length) return;
    e.stopPropagation();
    const clientX = e.touches[0].clientX;
    handleSeekFromEvent(clientX);
    if (duration && scrubberRef.current) {
      const rect = scrubberRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setHoverPosition(pos);
      setHoverTime(pos * duration);
    }
  };

  const handleScrubberTouchEnd = () => {
    isDraggingScrubberRef.current = false;
    setHoverPosition(null);
  };

  // Double click / tap on surface
  const lastClickRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeModal !== 'none') {
      setActiveModal('none');
      return;
    }

    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const timeDiff = now - lastClickRef.current.time;
    const isRecentTouch = now - lastTouchTimeRef.current < 1000;

    if (timeDiff < 280) {
      if (relativeX < 0.35) {
        handleSkip(-15);
      } else if (relativeX > 0.65) {
        handleSkip(15);
      } else {
        if (isRecentTouch) {
          togglePlay();
        } else {
          toggleFullscreen();
        }
      }
      lastClickRef.current = { time: 0, x: 0 };
    } else {
      lastClickRef.current = { time: now, x: e.clientX };
      if (isRecentTouch) {
        if (!showControls) {
          handleMouseMove();
        } else if (isPlaying) {
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          setShowControls(false);
        } else {
          togglePlay();
        }
      } else {
        togglePlay();
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          handleSkip(15);
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          handleSkip(-15);
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(v => {
            const next = Math.min(1, Math.round((v + 0.1) * 10) / 10);
            video.volume = next;
            triggerHud('volume', `Volume ${Math.round(next * 100)}%`);
            return next;
          });
          setIsMuted(false);
          video.muted = false;
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(v => {
            const next = Math.max(0, Math.round((v - 0.1) * 10) / 10);
            video.volume = next;
            triggerHud('volume', `Volume ${Math.round(next * 100)}%`);
            return next;
          });
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'c':
          e.preventDefault();
          setActiveModal(curr => (curr === 'subtitles' ? 'none' : 'subtitles'));
          break;
        case 's':
          e.preventDefault();
          setActiveModal(curr => (curr === 'settings' ? 'none' : 'settings'));
          break;
        case 'escape':
          if (activeModal !== 'none') {
            setActiveModal('none');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, volume, duration]);

  // Combine subtitles from API + stream + user uploads (memoized to keep reference stable)
  const combinedSubtitles: SubtitleTrack[] = useMemo(() => {
    const list: SubtitleTrack[] = [...uploadedSubs];
    const seenUrls = new Set<string>();

    for (const s of uploadedSubs) {
      seenUrls.add(s.url);
    }

    for (const pr of providerResults) {
      if (Array.isArray(pr.subtitles)) {
        for (const sub of pr.subtitles) {
          if (sub?.url && !seenUrls.has(sub.url)) {
            seenUrls.add(sub.url);
            list.push({
              id: sub.url,
              label: sub.label || sub.language || 'Subtitles',
              language: sub.language || 'en',
              languageCode: sub.language || 'en',
              url: sub.url,
              format: 'vtt'
            });
          }
        }
      }
    }

    for (const sub of availableSubtitles) {
      if (sub?.url && !seenUrls.has(sub.url)) {
        seenUrls.add(sub.url);
        list.push(sub);
      }
    }

    return list;
  }, [uploadedSubs, providerResults, availableSubtitles]);

  const filteredSubtitles = useMemo(() => {
    if (!subSearchQuery.trim()) return combinedSubtitles;
    const q = subSearchQuery.toLowerCase().trim();
    return combinedSubtitles.filter(
      s =>
        (s.label && s.label.toLowerCase().includes(q)) ||
        (s.language && s.language.toLowerCase().includes(q)) ||
        (s.languageCode && s.languageCode.toLowerCase().includes(q)) ||
        (s.source && s.source.toLowerCase().includes(q))
    );
  }, [combinedSubtitles, subSearchQuery]);

  const [expandedLanguages, setExpandedLanguages] = useState<Record<string, boolean>>({});

  // Group subtitles cleanly by language for dropdown accordions
  const languageGroups = useMemo(() => {
    const map = new Map<string, { language: string; languageCode: string; flag: string; tracks: SubtitleTrack[] }>();

    for (const track of filteredSubtitles) {
      const code = (track.languageCode || 'other').toLowerCase();
      let langName = track.language || 'Other';
      if (code === 'sr') langName = 'Serbian';
      else if (code === 'hr') langName = 'Croatian';
      else if (code === 'bs') langName = 'Bosnian';
      else if (code === 'en') langName = 'English';

      const flag = LANGUAGE_FLAGS[code] || '🌐';

      if (!map.has(code)) {
        map.set(code, {
          language: langName,
          languageCode: code,
          flag,
          tracks: []
        });
      }
      map.get(code)!.tracks.push(track);
    }

    return Array.from(map.values());
  }, [filteredSubtitles]);

  // Auto-expand language containing the active subtitle track
  useEffect(() => {
    if (activeSubTrackUrl) {
      const activeTrack = combinedSubtitles.find(s => s.url === activeSubTrackUrl);
      const langKey = activeTrack?.languageCode?.toLowerCase();
      if (langKey) {
        setExpandedLanguages(prev => (prev[langKey] ? prev : { ...prev, [langKey]: true }));
      }
    }
  }, [activeSubTrackUrl, combinedSubtitles]);

  // Auto-select subtitle based on user settings (default: Ex-Yu / BHS or English)
  const autoSelectDoneRef = useRef<boolean>(false);
  const previousStorageKeyRef = useRef<string | undefined>(storageKey);

  useEffect(() => {
    if (previousStorageKeyRef.current !== storageKey) {
      previousStorageKeyRef.current = storageKey;
      autoSelectDoneRef.current = false;
      setActiveSubTrackUrl(null);
      setCues([]);
      setCustomSubtitleText('');
    }
  }, [storageKey]);

  useEffect(() => {
    if (!combinedSubtitles.length) return;
    if (autoSelectDoneRef.current && activeSubTrackUrl) return;
    if (!playerSettings.autoLoadSubtitles || playerSettings.defaultSubtitleLang === 'off') {
      return;
    }

    const pref = (playerSettings.defaultSubtitleLang || 'exyu').toLowerCase();
    let bestTrack: SubtitleTrack | undefined;

    if (pref === 'exyu' || pref === 'bhs') {
      bestTrack = combinedSubtitles.find(s => {
        const c = (s.languageCode || '').toLowerCase();
        const l = (s.label || '').toLowerCase();
        const lang = (s.language || '').toLowerCase();
        return (
          c === 'sr' || c === 'hr' || c === 'bs' || c === 'bhs' ||
          l.includes('serbian') || l.includes('croatian') || l.includes('bosnian') ||
          lang.includes('serbian') || lang.includes('croatian') || lang.includes('bosnian')
        );
      });
    } else {
      bestTrack = combinedSubtitles.find(s => {
        const c = (s.languageCode || '').toLowerCase();
        const l = (s.label || '').toLowerCase();
        const lang = (s.language || '').toLowerCase();
        return c === pref || l.includes(pref) || lang.includes(pref);
      });
    }

    // Fallback to English or first available if preferred language not found
    if (!bestTrack) {
      bestTrack = combinedSubtitles.find(s => {
        const c = (s.languageCode || '').toLowerCase();
        const l = (s.label || '').toLowerCase();
        return c === 'en' || l.includes('english');
      }) || combinedSubtitles[0];
    }

    if (bestTrack?.url) {
      setActiveSubTrackUrl(bestTrack.url);
      autoSelectDoneRef.current = true;
    }
  }, [combinedSubtitles, activeSubTrackUrl, playerSettings.autoLoadSubtitles, playerSettings.defaultSubtitleLang]);

  // Synchronize style settings from playerSettings
  useEffect(() => {
    if (playerSettings.subtitleSize) {
      const sizeMap: Record<string, number> = {
        small: 85,
        medium: 100,
        large: 125,
        xlarge: 155
      };
      if (sizeMap[playerSettings.subtitleSize]) {
        setSubFontSize(sizeMap[playerSettings.subtitleSize]);
      }
    }
    if (playerSettings.subtitleColor) {
      setSubTextColor(playerSettings.subtitleColor);
    }
    if (playerSettings.subtitleBackground) {
      if (playerSettings.subtitleBackground === 'box') {
        setSubBgColor('#000000');
        setSubBgOpacity(65);
      } else {
        setSubBgColor('transparent');
        setSubBgOpacity(0);
      }
    }
  }, [playerSettings.subtitleSize, playerSettings.subtitleColor, playerSettings.subtitleBackground]);

  // Parse custom VTT or SRT subtitle tracks with robust multi-tier fallback
  useEffect(() => {
    if (!activeSubTrackUrl) {
      setCustomSubtitleText('');
      setCues([]);
      return;
    }

    // Check if it's an uploaded file with cues already parsed
    const uploaded = uploadedSubs.find(s => s.url === activeSubTrackUrl);
    if (uploaded && (uploaded as any).parsedCues) {
      setCues((uploaded as any).parsedCues);
      return;
    }

    let isMounted = true;
    async function fetchSub() {
      try {
        let text = '';

        // 1. Primary: Dedicated subtitle-proxy (with UTF-8 and Windows-1250 transcoding)
        try {
          const proxyUrl = `/api/subtitle-proxy?url=${encodeURIComponent(activeSubTrackUrl!)}`;
          const res = await fetch(proxyUrl);
          if (res.ok) {
            text = await res.text();
          }
        } catch (e) {
          console.warn('Subtitle proxy failed, trying fallback proxy:', e);
        }

        // 2. Secondary fallback: Generic proxy
        if (!text) {
          try {
            const fallbackProxyUrl = `/api/proxy?url=${encodeURIComponent(activeSubTrackUrl!)}`;
            const res = await fetch(fallbackProxyUrl);
            if (res.ok) {
              text = await res.text();
            }
          } catch (e) {
            console.warn('Generic proxy failed, trying direct fetch:', e);
          }
        }

        // 3. Tertiary fallback: Direct browser fetch
        if (!text) {
          try {
            const res = await fetch(activeSubTrackUrl!);
            if (res.ok) {
              text = await res.text();
            }
          } catch (e) {
            console.warn('Direct fetch failed:', e);
          }
        }

        if (text && isMounted) {
          parseSubtitlesText(text);
        }
      } catch (err) {
        console.warn('Failed to load subtitle:', err);
      }
    }

    fetchSub();
    return () => {
      isMounted = false;
    };
  }, [activeSubTrackUrl, uploadedSubs]);

  const parseSubtitlesText = (raw: string) => {
    const list: ParsedCue[] = [];
    const clean = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = clean.split('\n');
    const timeRegex = /(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})/;

    const parseTimestamp = (h?: string, m?: string, s?: string, ms?: string) => {
      const hours = parseInt(h || '0', 10);
      const mins = parseInt(m || '0', 10);
      const secs = parseInt(s || '0', 10);
      const millis = parseInt(ms || '0', 10);
      return hours * 3600 + mins * 60 + secs + millis / 1000;
    };

    let currentCue: { start: number; end: number; textLines: string[] } | null = null;
    const commitCue = () => {
      if (currentCue && currentCue.textLines.length) {
        const text = currentCue.textLines.join('\n').trim();
        if (text && currentCue.end > currentCue.start) {
          list.push({ start: currentCue.start, end: currentCue.end, text });
        }
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) continue;

      const match = line.match(timeRegex);
      if (match) {
        commitCue();
        const start = parseTimestamp(match[1], match[2], match[3], match[4]);
        const end = parseTimestamp(match[5], match[6], match[7], match[8]);
        currentCue = { start, end, textLines: [] };
      } else if (currentCue) {
        let isCueNumber = /^\d+$/.test(line);
        if (isCueNumber) {
          let j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          if (j < lines.length && lines[j].includes('-->')) {
            continue;
          }
        }
        const cleanLine = line.replace(/<[^>]+>/g, '').trim();
        if (cleanLine) {
          currentCue.textLines.push(cleanLine);
        }
      }
    }
    commitCue();
    setCues(list);
  };

  // Sync subtitle text with playback & delay (supports overlapping dialogue cues)
  useEffect(() => {
    if (!cues.length || !activeSubTrackUrl) {
      setCustomSubtitleText(prev => (prev === '' ? prev : ''));
      return;
    }
    const adjustedTime = currentTime - subDelay;
    const matchingCues = cues.filter(c => adjustedTime >= c.start && adjustedTime <= c.end);
    const nextText = matchingCues.map(c => c.text).join('\n');
    setCustomSubtitleText(prev => (prev === nextText ? prev : nextText));
  }, [currentTime, cues, subDelay, activeSubTrackUrl]);

  // Handle custom subtitle file upload (.vtt, .srt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const customUrl = `custom_${Date.now()}`;
        const newTrack: SubtitleTrack & { parsedCues?: ParsedCue[] } = {
          id: customUrl,
          label: file.name.replace(/\.[^/.]+$/, ''),
          language: 'custom',
          languageCode: 'custom',
          url: customUrl,
          format: 'vtt'
        };
        parseSubtitlesText(text);
        setUploadedSubs(prev => [newTrack, ...prev]);
        setActiveSubTrackUrl(customUrl);
        triggerHud('subtitle', `Uploaded: ${newTrack.label}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset subtitle styles
  const resetSubtitleStyle = () => {
    setSubFontSize(100);
    setSubTextColor('#FFFFFF');
    setSubBgColor('#000000');
    setSubBgOpacity(60);
    triggerHud('subtitle', 'Subtitle Style Reset');
  };

  // Handle download
  const handleDownload = () => {
    const downloadUrl = activeStream?.playUrl || activeStream?.url;
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerHud('download', 'Starting Download...');
    }
  };

  // Progress percentage
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const displayGenres = genres.length > 0 ? genres : ['Adventure', 'Action'];

  // Switch server helper
  const handleSelectServer = (idx: number) => {
    if (allStreams[idx]) {
      const v = videoRef.current;
      if (v && v.currentTime > 2) {
        failoverSeekRef.current = v.currentTime;
      }
      setSelectedStreamIndex(idx);
      triggerHud('server', `Server: ${allStreams[idx].providerName || allStreams[idx].server}`);
      setActiveModal('none');
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchActivity}
      className="relative w-full aspect-video bg-black select-none overflow-hidden group/player rounded-xl sm:rounded-2xl shadow-2xl font-sans touch-manipulation"
    >
      {/* Hidden File Input for Subtitle Upload (image_66a8b767.png) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vtt,.srt"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* HTML5 <video> Element */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        preload="auto"
        loop={isLoop}
        className={`w-full h-full cursor-pointer transition-all ${
          aspectRatio === 'fill'
            ? 'object-fill'
            : aspectRatio === '16:9'
            ? 'aspect-video object-cover'
            : aspectRatio === '4:3'
            ? 'aspect-[4/3] object-cover'
            : 'object-contain'
        }`}
        style={{
          filter: `brightness(${brightness}%)`,
          transform: isMirrored ? 'scaleX(-1)' : 'none'
        }}
      />

      {/* Surface Click Overlay for Double-Tap gestures & Play/Pause */}
      <div
        onClick={handleSurfaceClick}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label="Video Playback Surface"
      />

      {/* Subtitles Overlay with Live Customization */}
      {customSubtitleText && (
        <div
          className={`absolute inset-x-0 z-20 flex justify-center px-3 sm:px-8 pointer-events-none transition-all duration-200 ${
            showControls ? 'bottom-16 sm:bottom-28' : 'bottom-4 sm:bottom-12'
          }`}
        >
          <div
            className="text-center max-w-[94%] sm:max-w-[80%] whitespace-pre-line leading-snug font-semibold transition-all drop-shadow-lg select-none"
            style={{
              fontSize: `calc(clamp(0.85rem, 2.2vw, 1.65rem) * ${subFontSize / 100})`,
              color: subTextColor,
              backgroundColor:
                subBgColor === 'transparent' || subBgOpacity === 0
                  ? 'transparent'
                  : `${subBgColor}${Math.round((subBgOpacity / 100) * 255).toString(16).padStart(2, '0')}`,
              textShadow:
                subBgColor === 'transparent' || subBgOpacity === 0
                  ? '0 0 3px #000, 0 1px 2px #000, 0 2px 4px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000'
                  : '0 1px 3px rgba(0,0,0,0.9)',
              padding: subBgColor === 'transparent' || subBgOpacity === 0 ? '0.1rem 0.5rem' : '0.35rem 0.85rem',
              borderRadius: '0.5rem'
            }}
          >
            {customSubtitleText}
          </div>
        </div>
      )}

      {/* HUD Toast Badge */}
      {hudFeedback && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="px-5 py-2.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2.5 shadow-2xl">
            <Sparkles className="w-4 h-4 text-[#F5C400]" />
            <span>{hudFeedback.text}</span>
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs pointer-events-none">
          <PlayerLoadingSpinner subtitle="High speed multi-server streaming with zero buffering." />
        </div>
      )}

      {/* Error Overlay with Next Server Action */}
      {loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/90 backdrop-blur-md text-white">
          <AlertTriangle className="w-12 h-12 mb-3 text-[#F5C400] animate-bounce" />
          <h4 className="text-base font-bold text-white mb-1">Direct Stream Source Interrupted</h4>
          <p className="text-xs text-zinc-400 max-w-md mb-4">{loadError}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={triggerFailover}
              className="px-4 py-2 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Switch to Next Server</span>
            </button>
            <button
              onClick={() => setActiveModal('servers')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Choose Server
            </button>
          </div>
        </div>
      )}

      {/* Top Header Controls (Mobile Title + Cloud Servers Icon + Theater) */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-2.5 sm:p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300 flex items-center justify-between gap-2 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Compact Title & Episode Indicator on Mobile */}
        <div className="sm:hidden flex items-center gap-1.5 min-w-0 flex-1 pointer-events-none">
          <span className="text-xs font-bold text-white truncate drop-shadow-md">
            {title}
          </span>
          {!isMovie && (
            <span className="px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold text-[#F5C400] shrink-0">
              S{currentSeason}·E{currentEpisode}
            </span>
          )}
        </div>
        <div className="hidden sm:block" />

        {/* Top-Right Cloud Server Icon */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onToggleTheater && (
            <button
              onClick={onToggleTheater}
              className="hidden md:flex p-2 rounded-xl bg-black/40 hover:bg-black/70 text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer backdrop-blur-md"
              title="Theater mode"
            >
              <Maximize className="w-4 h-4" />
            </button>
          )}

          {/* Cloud Servers Popover Trigger */}
          <button
            onClick={() => setActiveModal(curr => (curr === 'servers' ? 'none' : 'servers'))}
            className={`min-w-[36px] min-h-[36px] p-2 rounded-xl transition-all cursor-pointer backdrop-blur-md flex items-center justify-center gap-1.5 ${
              activeModal === 'servers'
                ? 'bg-white text-black shadow-lg'
                : 'bg-black/45 hover:bg-black/70 text-zinc-200 hover:text-white border border-white/10'
            }`}
            title="Servers & Sources"
            aria-label="Servers"
          >
            <Cloud className={`w-4 h-4 ${activeModal === 'servers' ? 'fill-black text-black' : 'fill-zinc-300 text-zinc-300'}`} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          POPOVERS & MODALS (Responsive for mobile 360px+ & desktop)
         ========================================================================= */}

      {/* 1. SERVERS POPOVER */}
      {activeModal === 'servers' && (
        <div className="absolute top-12 sm:top-14 inset-x-2.5 sm:inset-x-auto sm:right-6 z-50 sm:w-80 max-h-[calc(100%-3.75rem)] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 sm:p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10 text-xs font-bold text-zinc-300">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-zinc-300 fill-zinc-300" />
              <span>SERVERS</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="sm:hidden p-1 text-zinc-400 hover:text-white cursor-pointer"
              aria-label="Close servers"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-40 sm:max-h-72 overflow-y-auto no-scrollbar">
            {allStreams.map((st, idx) => {
              const isActive = idx === selectedStreamIndex;
              const rawLabel = st.server && st.server !== st.providerName ? st.server : st.providerName || st.server;
              const displayName = stripQualityFromName(cleanServerDisplay(rawLabel));
              const streamKey = st.playUrl || st.url;
              const qBadge = detectedStreamQualities[streamKey] || formatQualityBadge(st.quality, st.type);
              return (
                <div
                  key={`${st.server}-${idx}`}
                  onClick={() => handleSelectServer(idx)}
                  className={`p-3 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#1c1c22] border border-white/10 shadow-md'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-white truncate">{displayName}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black tracking-wide shrink-0 ${getQualityPillClasses(qBadge)}`}>
                          {qBadge}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {st.type === 'hls' ? `Multi Audio · HLS (${qBadge})` : `Direct CDN · MP4 (${qBadge})`}
                      </div>
                    </div>
                    {isActive ? (
                      <Check className="w-4 h-4 text-white shrink-0" />
                    ) : (
                      <span className="text-zinc-500 font-bold text-sm shrink-0">—</span>
                    )}
                  </div>

                  {/* Active Source Card */}
                  {isActive && (
                    <div className="mt-2.5 flex items-center justify-between bg-[#121215] px-3 py-2 rounded-lg border border-white/5 text-xs">
                      <span className="font-semibold text-white">Source 1 · {qBadge}</span>
                      <span className="text-[10px] font-bold text-emerald-400">Ready</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 mt-3 border-t border-white/10 text-center text-[10px] text-zinc-400">
            Choose a server or playback quality
          </div>
        </div>
      )}

      {/* 2. AUDIO POPOVER */}
      {activeModal === 'audio' && (
        <div className="absolute bottom-12 sm:bottom-16 inset-x-2.5 sm:inset-x-auto sm:right-16 z-50 sm:w-72 max-h-[calc(100%-3.75rem)] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs font-bold text-zinc-300">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveModal('settings')}
                className="p-1 hover:text-white text-zinc-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Languages className="w-4 h-4 text-zinc-400" />
              <span>AUDIO</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="sm:hidden p-1 text-zinc-400 hover:text-white cursor-pointer"
              aria-label="Close audio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {audioTracks.map((track) => {
              const isSelected = track.id === selectedAudioTrackId;
              return (
                <button
                  key={track.id}
                  onClick={() => {
                    setSelectedAudioTrackId(track.id);
                    if (hlsRef.current && track.id >= 0) {
                      hlsRef.current.audioTrack = track.id;
                    }
                    triggerHud('audio', `Audio: ${track.name}`);
                    setActiveModal('none');
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#24242a] text-white' : 'hover:bg-white/5 text-zinc-300'
                  }`}
                >
                  <span>{track.name}</span>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. SUBTITLES POPOVER */}
      {activeModal === 'subtitles' && (
        <div className="absolute bottom-12 sm:bottom-16 inset-x-2.5 sm:inset-x-auto sm:right-12 z-50 sm:w-96 max-h-[calc(100%-3.5rem)] flex flex-col bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs font-bold text-zinc-300 shrink-0">
            <div className="flex items-center gap-2">
              <Subtitles className="w-4 h-4 text-zinc-400" />
              <span>SUBTITLES</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-medium">
                {combinedSubtitles.length} available
              </span>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="sm:hidden p-1 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Close subtitles"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Search Filter across all subtitle tracks */}
          {combinedSubtitles.length > 4 && (
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                placeholder="Search language, release, or source..."
                className="w-full bg-[#1c1c22] border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#F5C400]/60 transition-colors"
              />
              {subSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSubSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Upload Subtitle Item */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-xs text-white font-medium transition-colors cursor-pointer mb-1"
          >
            <span>Upload custom subtitle (.vtt / .srt)</span>
            <Upload className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Subtitle Track List */}
          <div className="space-y-1 flex-1 min-h-0 max-h-36 sm:max-h-72 overflow-y-auto no-scrollbar pr-0.5">
            {/* Off Option */}
            <button
              onClick={() => {
                setActiveSubTrackUrl(null);
                triggerHud('subtitle', 'Subtitles Off');
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeSubTrackUrl === null ? 'bg-[#24242a] text-white' : 'hover:bg-white/5 text-zinc-300'
              }`}
            >
              <span>Off</span>
              {activeSubTrackUrl === null && <Check className="w-4 h-4 text-white" />}
            </button>

            {/* Language Dropdown Accordions */}
            {languageGroups.map((group) => {
              const isExpanded = subSearchQuery.trim() ? true : !!expandedLanguages[group.languageCode];
              const hasActiveTrack = group.tracks.some((t) => t.url === activeSubTrackUrl);

              return (
                <div key={group.languageCode} className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 mb-1.5">
                  {/* Dropdown Header */}
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedLanguages((prev) => ({
                        ...prev,
                        [group.languageCode]: !isExpanded
                      }));
                    }}
                    className={`w-full flex items-center justify-between p-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      hasActiveTrack
                        ? 'bg-[#24242a] text-white'
                        : 'hover:bg-white/5 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <LanguageFlag code={group.languageCode} name={group.language} className="w-5 h-3.5 shadow-sm rounded-[2px]" />
                      <span className="truncate">{group.language}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-400 font-mono">
                        {group.tracks.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasActiveTrack && (
                        <span className="w-2 h-2 rounded-full bg-[#F5C400] ring-2 ring-[#F5C400]/30" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </button>

                  {/* Dropdown Sub-Items (Numbered tracks without provider branding) */}
                  {isExpanded && (
                    <div className="p-1 pl-3 space-y-1 bg-black/30 border-t border-white/5">
                      {group.tracks.map((track, idx) => {
                        const isSelected = activeSubTrackUrl === track.url;
                        const itemLabel = track.source === 'custom' || track.id?.startsWith('custom_')
                          ? (track.label || `Custom Subtitle ${idx + 1}`)
                          : `${group.language} ${idx + 1}`;

                        return (
                          <button
                            key={track.url}
                            type="button"
                            onClick={() => {
                              setActiveSubTrackUrl(track.url);
                              triggerHud('subtitle', `Subtitles: ${itemLabel}`);
                            }}
                            className={`w-full flex items-center justify-between py-2 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#F5C400]/15 text-[#F5C400] font-semibold border border-[#F5C400]/30'
                                : 'hover:bg-white/5 text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <LanguageFlag code={track.languageCode || group.languageCode} name={group.language} className="w-4 h-3 opacity-90 rounded-[2px]" />
                              <span className="truncate">{itemLabel}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#F5C400] shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {languageGroups.length === 0 && (
              <div className="py-6 text-center text-xs text-zinc-500">
                No matching subtitles found for "{subSearchQuery}"
              </div>
            )}
          </div>

          {/* Bottom Action Bar: Style & Delay (image_66a8b767.png) */}
          <div className="pt-2.5 mt-2 border-t border-white/10 grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveModal('subtitle-style')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <span>Style</span>
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <button
              onClick={() => setActiveModal('subtitle-delay')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <span>Delay</span>
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>
      )}

      {/* 4. SUBTITLE STYLE MENU */}
      {activeModal === 'subtitle-style' && (
        <div className="absolute bottom-12 sm:bottom-16 inset-x-2.5 sm:inset-x-auto sm:right-12 z-50 sm:w-80 max-h-[calc(100%-3.5rem)] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-white/10 text-xs font-bold text-white">
            <button
              onClick={() => setActiveModal('subtitles')}
              className="p-1 hover:text-white text-zinc-400 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Subtitles className="w-4 h-4 text-zinc-400" />
            <span>SUBTITLE STYLE</span>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Font Size Slider */}
            <div>
              <div className="flex justify-between text-zinc-300 font-medium mb-1.5">
                <span>Font Size</span>
                <span className="font-mono text-white">{subFontSize}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                step="5"
                value={subFontSize}
                onChange={(e) => setSubFontSize(parseInt(e.target.value, 10))}
                className="w-full accent-white bg-white/20 h-1.5 rounded-full cursor-pointer"
              />
            </div>

            {/* Text Color Swatches */}
            <div>
              <div className="text-zinc-300 font-medium mb-2">Text Color</div>
              <div className="flex items-center gap-3">
                {[
                  { name: 'White', hex: '#FFFFFF' },
                  { name: 'Yellow', hex: '#FFFF00' },
                  { name: 'Cyan', hex: '#00E5FF' },
                  { name: 'Green', hex: '#00FF88' }
                ].map((color) => {
                  const isSelected = subTextColor.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.hex}
                      onClick={() => setSubTextColor(color.hex)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        isSelected ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#121215]' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Background Style Swatches */}
            <div>
              <div className="text-zinc-300 font-medium mb-2">Background</div>
              <div className="flex items-center gap-3">
                {[
                  { name: 'Black', hex: '#000000', label: 'Black' },
                  { name: 'White', hex: '#FFFFFF', label: 'White' },
                  { name: 'Transparent', hex: 'transparent', label: 'None' }
                ].map((bg) => {
                  const isSelected = subBgColor === bg.hex;
                  return (
                    <button
                      key={bg.hex}
                      onClick={() => setSubBgColor(bg.hex)}
                      className={`w-7 h-7 rounded-lg border border-white/20 transition-transform cursor-pointer flex items-center justify-center ${
                        isSelected ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#121215]' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: bg.hex === 'transparent' ? 'transparent' : bg.hex }}
                      title={bg.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Background Opacity */}
            <div>
              <div className="flex justify-between text-zinc-300 font-medium mb-1.5">
                <span>Background Opacity</span>
                <span className="font-mono text-white">{subBgOpacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={subBgOpacity}
                onChange={(e) => setSubBgOpacity(parseInt(e.target.value, 10))}
                className="w-full accent-white bg-white/20 h-1.5 rounded-full cursor-pointer"
              />
            </div>

            {/* Reset Button */}
            <button
              onClick={resetSubtitleStyle}
              className="w-full py-2.5 mt-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Reset Style
            </button>
          </div>
        </div>
      )}

      {/* 5. SUBTITLE DELAY MENU */}
      {activeModal === 'subtitle-delay' && (
        <div className="absolute bottom-12 sm:bottom-16 inset-x-2.5 sm:inset-x-auto sm:right-12 z-50 sm:w-80 max-h-[calc(100%-3.5rem)] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 pb-2.5 mb-2 border-b border-white/10 text-xs font-bold text-white">
            <button
              onClick={() => setActiveModal('subtitles')}
              className="p-1 hover:text-white text-zinc-400 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Subtitles className="w-4 h-4 text-zinc-400" />
            <span>SUBTITLE DELAY</span>
          </div>

          <div className="py-4 text-center">
            <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {subDelay > 0 ? `+${subDelay.toFixed(1)}s` : `${subDelay.toFixed(1)}s`}
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {subDelay === 0
                ? 'Subtitles are synchronized'
                : subDelay > 0
                ? 'Subtitles show later (+delay)'
                : 'Subtitles show earlier (-delay)'}
            </div>

            <div className="mt-5 px-1">
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={subDelay}
                onChange={(e) => setSubDelay(parseFloat(e.target.value))}
                className="w-full accent-white bg-white/20 h-2 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono font-bold mt-2">
                <span>-10s</span>
                <span>0s</span>
                <span>+10s</span>
              </div>
            </div>

            <button
              onClick={() => setSubDelay(0)}
              className="w-full py-2.5 mt-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Reset Delay
            </button>
          </div>
        </div>
      )}

      {/* 6. PLAYER SETTINGS DRAWER */}
      {activeModal === 'settings' && (
        <div className="absolute bottom-12 sm:bottom-16 inset-x-2.5 sm:inset-x-auto sm:right-10 z-50 sm:w-84 max-h-[calc(100%-3.5rem)] sm:max-h-[80%] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />

          <div className="mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">PLAYER SETTINGS</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Customize your playback experience.</p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Category 1: SOURCE */}
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-1.5">
                SOURCE
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveModal('quality')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Quality</span>
                    <QualityBadge quality={streamQuality} variant="card" className="scale-90 origin-left" />
                  </div>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>{selectedQuality === 'Auto' ? `Auto (${streamQuality.label})` : selectedQuality}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                <button
                  onClick={() => setActiveModal('audio')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Audio</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span className="truncate max-w-[120px]">
                      {audioTracks.find(t => t.id === selectedAudioTrackId)?.name || 'Original Audio'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                <button
                  onClick={() => setActiveModal('subtitles')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Subtitles</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>{activeSubTrackUrl ? 'On' : 'Off'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Download</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>MP4</span>
                    <Download className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>
            </div>

            {/* Category 2: MEDIA */}
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-1.5">
                MEDIA
              </div>
              <div className="space-y-1">
                <button
                  onClick={handleAspectRatioCycle}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Aspect Ratio</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span className="capitalize">{aspectRatio}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                <div className="p-2 rounded-xl bg-white/5 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="font-semibold text-white">Brightness</span>
                    <span className="font-mono">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    step="5"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                    className="w-full accent-white bg-white/20 h-1.5 rounded-full cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => {
                    setIsMirrored(prev => !prev);
                    triggerHud('mirror', `Mirror: ${!isMirrored ? 'On' : 'Off'}`);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Mirror</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>{isMirrored ? 'On' : 'Off'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                <button
                  onClick={togglePiP}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Picture-in-Picture</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>{isPiP ? 'On' : 'Off'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>
            </div>

            {/* Category 3: PLAYBACK */}
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-1.5">
                PLAYBACK
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveModal('speed')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Playback Speed</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>{playbackSpeed}x</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                <button
                  onClick={() => setActiveModal('volume-boost')}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Volume Boost</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>{volumeBoost}%</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsLoop(prev => !prev);
                    triggerHud('loop', `Loop: ${!isLoop ? 'On' : 'Off'}`);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Loop</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>{isLoop ? 'On' : 'Off'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setAutoplayNext(prev => !prev);
                    triggerHud('autoplay', `Autoplay: ${!autoplayNext ? 'On' : 'Off'}`);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 text-zinc-200 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Autoplay</span>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>{autoplayNext ? 'On' : 'Off'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveModal('none')}
            className="w-full py-2.5 mt-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* 7. VIDEO QUALITY SUBMENU */}
      {activeModal === 'quality' && (
        <div className="absolute bottom-12 sm:bottom-16 inset-x-2.5 sm:inset-x-auto sm:right-10 z-50 sm:w-80 max-h-[calc(100%-3.5rem)] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />

          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-white/10 text-xs font-bold text-white">
            <button
              onClick={() => setActiveModal('settings')}
              className="p-1 hover:text-white text-zinc-400 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span>VIDEO QUALITY</span>
          </div>

          {/* Active Stream Quality Status Card */}
          <div className="p-3 mb-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Stream Quality</div>
              <div className="text-xs font-black text-white mt-0.5">
                {streamQuality.fullLabel}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                {streamResolution ? `${streamResolution.width} × ${streamResolution.height}` : streamQuality.resolution}
              </div>
            </div>
            <QualityBadge quality={streamQuality} variant="card" />
          </div>

          <div className="space-y-1">
            {availableQualities.map((q) => {
              const isSelected = selectedQuality === q;
              return (
                <button
                  key={q}
                  onClick={() => {
                    handleQualityChange(q);
                    setActiveModal('settings');
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#24242a] text-white' : 'hover:bg-white/5 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{q}</span>
                    {q === 'Auto' && (
                      <span className="text-[10px] text-zinc-400">
                        ({streamQuality.label})
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setActiveModal('none')}
            className="w-full py-2.5 mt-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* 8. PLAYBACK SPEED SUBMENU */}
      {activeModal === 'speed' && (
        <div className="absolute bottom-12 sm:bottom-16 inset-x-2.5 sm:inset-x-auto sm:right-10 z-50 sm:w-80 max-h-[calc(100%-3.5rem)] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />

          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-white/10 text-xs font-bold text-white">
            <button
              onClick={() => setActiveModal('settings')}
              className="p-1 hover:text-white text-zinc-400 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span>PLAYBACK SPEED</span>
          </div>

          <div className="space-y-1">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => {
              const isSelected = playbackSpeed === spd;
              return (
                <button
                  key={spd}
                  onClick={() => {
                    handleSpeedChange(spd);
                    setActiveModal('settings');
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#24242a] text-white' : 'hover:bg-white/5 text-zinc-300'
                  }`}
                >
                  <span>{spd === 1 ? 'Normal (1x)' : `${spd}x`}</span>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setActiveModal('none')}
            className="w-full py-2.5 mt-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* 9. VOLUME BOOST SUBMENU */}
      {activeModal === 'volume-boost' && (
        <div className="absolute bottom-12 sm:bottom-16 inset-x-2.5 sm:inset-x-auto sm:right-10 z-50 sm:w-80 max-h-[calc(100%-3.5rem)] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3.5 sm:p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />

          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-white/10 text-xs font-bold text-white">
            <button
              onClick={() => setActiveModal('settings')}
              className="p-1 hover:text-white text-zinc-400 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span>VOLUME BOOST</span>
          </div>

          <div className="space-y-1">
            {[100, 125, 150, 200].map((b) => {
              const isSelected = volumeBoost === b;
              return (
                <button
                  key={b}
                  onClick={() => {
                    applyVolumeBoost(b);
                    setActiveModal('settings');
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#24242a] text-white' : 'hover:bg-white/5 text-zinc-300'
                  }`}
                >
                  <span>{b === 100 ? '100% (Default)' : `${b}% Boost`}</span>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setActiveModal('none')}
            className="w-full py-2.5 mt-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* Center Play / Pause Button on the Player */}
      {!isLoading && !loadError && activeModal === 'none' && (!isPlaying || (isTouchMode && showControls)) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer ${
            !isPlaying
              ? 'bg-black/75 hover:bg-black/90 border-2 border-[#F5C400] text-white ring-4 ring-[#F5C400]/20'
              : 'bg-black/60 hover:bg-black/80 border border-white/25 text-white'
          }`}
          aria-label={isPlaying ? 'Pause Video' : 'Play Video'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 sm:w-9 sm:h-9 fill-white text-white" />
          ) : (
            <Play className="w-7 h-7 sm:w-10 sm:h-10 fill-[#F5C400] text-[#F5C400] ml-1" />
          )}
        </button>
      )}

      {/* =========================================================================
          BOTTOM CONTROLS BAR: Scrubber & Clean Control Buttons (Mobile Optimized)
         ========================================================================= */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 px-3 pb-2.5 pt-8 sm:p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 flex flex-col justify-end ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* "You're Watching" Metadata (shown on sm+ desktop/tablet; mobile shows compact title at top) */}
        <div className="hidden sm:flex flex-col gap-1 max-w-md pointer-events-none mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-3.5 bg-red-600 rounded-full shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              You're Watching
            </span>
          </div>

          <h2 className="text-xl font-black text-white truncate drop-shadow-md tracking-tight leading-tight">
            {title}
          </h2>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-semibold text-zinc-300">
              {isMovie ? 'Movie' : `S${currentSeason} · E${currentEpisode}`}
            </span>
            {displayGenres.slice(0, 2).map((genre, idx) => (
              <span key={idx} className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-semibold text-zinc-300">
                {genre}
              </span>
            ))}
            {releaseYear && (
              <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-semibold text-zinc-300">
                {releaseYear}
              </span>
            )}
          </div>
        </div>

        {/* Scrubber Bar with Mouse + Mobile Touch Drag Support */}
        <div className="w-full flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-3">
          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-300 sm:text-zinc-400 select-none shrink-0 w-9 sm:w-10 text-left">
            {formatTime(currentTime)}
          </span>

          <div
            ref={scrubberRef}
            onMouseDown={handleScrubberMouseDown}
            onMouseMove={handleScrubberMouseMove}
            onMouseLeave={() => setHoverPosition(null)}
            onTouchStart={handleScrubberTouchStart}
            onTouchMove={handleScrubberTouchMove}
            onTouchEnd={handleScrubberTouchEnd}
            onTouchCancel={handleScrubberTouchEnd}
            className="relative flex-1 py-3 -my-3 cursor-pointer flex items-center group/bar touch-none"
          >
            <div className="relative w-full h-1 sm:h-1 group-hover/bar:h-1.5 rounded-full bg-white/25 transition-all flex items-center">
              {/* Buffered Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all"
                style={{ width: `${duration ? (bufferedTime / duration) * 100 : 0}%` }}
              />

              {/* Current Progress Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-[#F5C400] sm:bg-white rounded-full flex items-center justify-end"
                style={{ width: `${progressPercent}%` }}
              >
                {/* Round Scrubber Thumb (Always visible on mobile touch, hover-revealed on desktop) */}
                <div className="w-3 h-3 bg-[#F5C400] sm:bg-white rounded-full shadow-lg -mr-1.5 scale-100 sm:scale-0 sm:group-hover/bar:scale-100 transition-transform" />
              </div>

              {/* Hover / Touch Seek Tooltip */}
              {hoverPosition !== null && (
                <div
                  className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-white text-[10px] font-mono font-bold rounded border border-white/20 pointer-events-none shadow-md"
                  style={{ left: `${hoverPosition * 100}%` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>
          </div>

          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-300 sm:text-zinc-400 select-none shrink-0 w-10 sm:w-12 text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Bottom Row Controls: Play/Pause, 15s Skip, Volume, Subtitles, Settings, Fullscreen */}
        <div className="w-full flex items-center justify-between gap-1">
          {/* Left Controls */}
          <div className="flex items-center gap-1 sm:gap-3.5">
            {/* Play / Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-lg text-white hover:text-zinc-200 active:bg-white/15 transition-all active:scale-90 cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5" />
              )}
            </button>

            {/* Skip Backward 15s */}
            <button
              type="button"
              onClick={() => handleSkip(-15)}
              className="min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-lg text-white hover:text-zinc-200 active:bg-white/15 transition-all active:scale-90 cursor-pointer"
              title="Skip backward 15s"
              aria-label="Rewind 15 seconds"
            >
              <RotateCcw15Icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Skip Forward 15s */}
            <button
              type="button"
              onClick={() => handleSkip(15)}
              className="min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-lg text-white hover:text-zinc-200 active:bg-white/15 transition-all active:scale-90 cursor-pointer"
              title="Skip forward 15s"
              aria-label="Fast forward 15 seconds"
            >
              <RotateCw15Icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Volume with Desktop Hover Reveal */}
            <div className="flex items-center group/vol gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-lg text-white hover:text-zinc-200 active:bg-white/15 transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label="Volume"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </button>

              <div className="hidden sm:flex w-0 group-hover/vol:w-20 overflow-hidden transition-all duration-200 items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 accent-white h-1 bg-white/30 rounded-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Controls: Subtitles [=], Settings [⚙️], Fullscreen [⤢] */}
          <div className="flex items-center gap-1 sm:gap-2.5">
            {/* Subtitles Button */}
            <button
              type="button"
              onClick={() => setActiveModal(curr => (curr === 'subtitles' ? 'none' : 'subtitles'))}
              className={`min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-lg transition-colors cursor-pointer active:bg-white/15 ${
                activeModal === 'subtitles' || activeSubTrackUrl ? 'text-white' : 'text-zinc-300 sm:text-zinc-400 hover:text-white'
              }`}
              title="Subtitles"
              aria-label="Subtitles"
            >
              <Subtitles className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Settings Button */}
            <button
              type="button"
              onClick={() => setActiveModal(curr => (curr === 'settings' ? 'none' : 'settings'))}
              className={`min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-lg transition-colors cursor-pointer active:bg-white/15 ${
                activeModal === 'settings' ? 'bg-white/20 text-white' : 'text-zinc-300 hover:text-white'
              }`}
              title="Player Settings"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="min-w-[36px] min-h-[36px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center text-zinc-300 hover:text-white active:bg-white/15 transition-colors cursor-pointer rounded-lg"
              title={isFullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
              aria-label="Fullscreen"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Maximize className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
