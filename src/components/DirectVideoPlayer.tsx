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
import { ResolvedStream, DirectProviderResult, cleanServerDisplay } from '../services/directStreamClient';
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
  backdropPath
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setLoadError(`Stream interrupted on ${cleanServerDisplay(activeStream?.server)}. Please select another source.`);
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

  // Auto-hide controls after inactivity
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && activeModal === 'none') {
        setShowControls(false);
      }
    }, 3500);
  }, [isPlaying, activeModal]);

  // Play / Pause toggle
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      triggerHud('play', 'Playing');
    } else {
      video.pause();
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

  // Fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
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

  // Double click on surface
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

    if (timeDiff < 280) {
      if (relativeX < 0.35) {
        handleSkip(-15);
      } else if (relativeX > 0.65) {
        handleSkip(15);
      } else {
        toggleFullscreen();
      }
      lastClickRef.current = { time: 0, x: 0 };
    } else {
      lastClickRef.current = { time: now, x: e.clientX };
      togglePlay();
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
      className="relative w-full aspect-video bg-black select-none overflow-hidden group/player rounded-2xl shadow-2xl font-sans"
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

      {/* Subtitles Overlay with Live Customization (image_659a6ea3.png, image_d377490c.png) */}
      {customSubtitleText && (
        <div
          className={`absolute inset-x-0 z-20 flex justify-center px-4 sm:px-8 pointer-events-none transition-all duration-200 ${
            showControls ? 'bottom-24 sm:bottom-28' : 'bottom-8 sm:bottom-12'
          }`}
        >
          <div
            className="text-center max-w-[92%] sm:max-w-[80%] whitespace-pre-line leading-snug font-semibold transition-all drop-shadow-lg select-none"
            style={{
              fontSize: `calc(clamp(1.05rem, 1.8vw, 1.65rem) * ${subFontSize / 100})`,
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

      {/* Top Header Controls (Cloud Servers Icon, Theater, Lights) - image_12a0d412.png */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300 flex items-center justify-between ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div />

        {/* Top-Right Cloud Server Icon (image_12a0d412.png top right) */}
        <div className="flex items-center gap-2">
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
            className={`p-2 rounded-xl transition-all cursor-pointer backdrop-blur-md flex items-center gap-1.5 ${
              activeModal === 'servers'
                ? 'bg-white text-black shadow-lg'
                : 'bg-black/40 hover:bg-black/70 text-zinc-200 hover:text-white border border-white/10'
            }`}
            title="Servers & Sources"
            aria-label="Servers"
          >
            <Cloud className={`w-4 h-4 ${activeModal === 'servers' ? 'fill-black text-black' : 'fill-zinc-300 text-zinc-300'}`} />
          </button>
        </div>
      </div>

      {/* =========================================================================
          POPOVERS & MODALS (Match image_480f9ced, image_de22053a, image_66a8b767, etc.)
         ========================================================================= */}

      {/* 1. SERVERS POPOVER (image_480f9ced.png) */}
      {activeModal === 'servers' && (
        <div className="absolute top-14 right-4 sm:right-6 z-50 w-72 sm:w-80 bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-white/10 text-xs font-bold text-zinc-300">
            <Cloud className="w-4 h-4 text-zinc-300 fill-zinc-300" />
            <span>SERVERS</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
            {allStreams.map((st, idx) => {
              const isActive = idx === selectedStreamIndex;
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
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">{st.providerName || st.server}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {st.type === 'hls' ? 'Multi Audio Support & HD' : 'Smooth Playback & Direct HD'}
                      </div>
                    </div>
                    {isActive ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-zinc-500 font-bold text-sm">—</span>
                    )}
                  </div>

                  {/* Active Source Card (image_480f9ced.png) */}
                  {isActive && (
                    <div className="mt-2.5 flex items-center justify-between bg-[#121215] px-3 py-2 rounded-lg border border-white/5 text-xs">
                      <span className="font-semibold text-white">Source 1</span>
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

      {/* 2. AUDIO POPOVER (image_de22053a.png) */}
      {activeModal === 'audio' && (
        <div className="absolute bottom-16 right-4 sm:right-16 z-50 w-64 sm:w-72 bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 pb-2.5 mb-2 border-b border-white/10 text-xs font-bold text-zinc-300">
            <Languages className="w-4 h-4 text-zinc-400" />
            <span>AUDIO</span>
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

      {/* 3. SUBTITLES POPOVER (image_66a8b767.png & image_674abbad.png) */}
      {activeModal === 'subtitles' && (
        <div className="absolute bottom-16 right-4 sm:right-12 z-50 w-80 sm:w-96 bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs font-bold text-zinc-300">
            <div className="flex items-center gap-2">
              <Subtitles className="w-4 h-4 text-zinc-400" />
              <span>SUBTITLES</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-medium">
              {combinedSubtitles.length} available
            </span>
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
          <div className="space-y-1 max-h-64 sm:max-h-72 overflow-y-auto no-scrollbar pr-0.5">
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

      {/* 4. SUBTITLE STYLE MENU (image_659a6ea3.png) */}
      {activeModal === 'subtitle-style' && (
        <div className="absolute bottom-16 right-4 sm:right-12 z-50 w-72 sm:w-80 bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 text-left animate-in fade-in zoom-in-95 duration-150">
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

      {/* 5. SUBTITLE DELAY MENU (image_d377490c.png) */}
      {activeModal === 'subtitle-delay' && (
        <div className="absolute bottom-16 right-4 sm:right-12 z-50 w-72 sm:w-80 bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 text-left animate-in fade-in zoom-in-95 duration-150">
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

      {/* 6. PLAYER SETTINGS DRAWER (image_2d037829.png) */}
      {activeModal === 'settings' && (
        <div className="absolute bottom-16 right-4 sm:right-10 z-50 w-72 sm:w-84 max-h-[80%] overflow-y-auto no-scrollbar bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 text-left animate-in fade-in zoom-in-95 duration-150">
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

      {/* 7. VIDEO QUALITY SUBMENU (image__1__9106897c.png) */}
      {activeModal === 'quality' && (
        <div className="absolute bottom-16 right-4 sm:right-10 z-50 w-72 sm:w-80 bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 text-left animate-in fade-in zoom-in-95 duration-150">
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
        <div className="absolute bottom-16 right-4 sm:right-10 z-50 w-72 sm:w-80 bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 text-left animate-in fade-in zoom-in-95 duration-150">
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
        <div className="absolute bottom-16 right-4 sm:right-10 z-50 w-72 sm:w-80 bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 text-left animate-in fade-in zoom-in-95 duration-150">
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

      {/* Center Big Play Button when Paused */}
      {!isPlaying && !isLoading && !loadError && activeModal === 'none' && (
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer ring-1 ring-white/10"
          aria-label="Play Video"
        >
          <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1 text-white" />
        </button>
      )}

      {/* =========================================================================
          BOTTOM CONTROLS BAR: "You're Watching", Scrubber, & Control Buttons
          (Matches image_12a0d412.png)
         ========================================================================= */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 flex flex-col justify-end ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top of Bottom Section: "You're Watching" (image_12a0d412.png) */}
        <div className="flex flex-col gap-1 max-w-[75%] sm:max-w-md pointer-events-none mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-3.5 bg-red-600 rounded-full shrink-0" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
              You're Watching
            </span>
          </div>

          <h2 className="text-base sm:text-xl font-black text-white truncate drop-shadow-md tracking-tight leading-tight">
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

        {/* Scrubber Bar with Left and Right Timestamps (image_12a0d412.png) */}
        <div className="w-full flex items-center gap-3 mb-3">
          <span className="text-[11px] font-mono text-zinc-400 select-none shrink-0 w-10 text-left">
            {formatTime(currentTime)}
          </span>

          <div
            ref={scrubberRef}
            onMouseDown={handleScrubberMouseDown}
            onMouseMove={handleScrubberMouseMove}
            onMouseLeave={() => setHoverPosition(null)}
            className="relative flex-1 h-1 hover:h-1.5 rounded-full cursor-pointer transition-all flex items-center group/bar bg-white/20"
          >
            {/* Buffered Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all"
              style={{ width: `${duration ? (bufferedTime / duration) * 100 : 0}%` }}
            />

            {/* Current Progress Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white rounded-full flex items-center justify-end"
              style={{ width: `${progressPercent}%` }}
            >
              {/* White Round Scrubber Thumb */}
              <div className="w-3 h-3 bg-white rounded-full shadow-lg -mr-1.5 scale-0 group-hover/bar:scale-100 transition-transform" />
            </div>

            {/* Hover Tooltip */}
            {hoverPosition !== null && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-white text-[10px] font-mono font-bold rounded border border-white/20 pointer-events-none shadow-md"
                style={{ left: `${hoverPosition * 100}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          <span className="text-[11px] font-mono text-zinc-400 select-none shrink-0 w-12 text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Bottom Row Controls: Play/Pause, 15s Skip, Volume, Audio, Subtitles, Settings, Fullscreen */}
        <div className="w-full flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Play / Pause Button */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-zinc-200 transition-transform active:scale-90 cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white ml-0.5" />
              )}
            </button>

            {/* Skip Backward 15s (RotateCcw15Icon) */}
            <button
              onClick={() => handleSkip(-15)}
              className="text-white hover:text-zinc-200 transition-transform active:scale-90 cursor-pointer"
              title="Skip backward 15s"
              aria-label="Rewind 15 seconds"
            >
              <RotateCcw15Icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Skip Forward 15s (RotateCw15Icon) */}
            <button
              onClick={() => handleSkip(15)}
              className="text-white hover:text-zinc-200 transition-transform active:scale-90 cursor-pointer"
              title="Skip forward 15s"
              aria-label="Fast forward 15 seconds"
            >
              <RotateCw15Icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Volume with Smooth Hover Reveal */}
            <div className="flex items-center group/vol gap-2">
              <button
                onClick={toggleMute}
                className="text-white hover:text-zinc-200 transition-colors cursor-pointer"
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

              <div className="w-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 overflow-hidden transition-all duration-200 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-20 accent-white h-1 bg-white/30 rounded-full cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Controls: Quality [4K/1080p], Audio [A文], Subtitles [=], Settings [⚙️], Fullscreen [⤢] */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Stream Quality Badge / Quick-Selector Button */}
            <button
              onClick={() => setActiveModal(curr => (curr === 'quality' ? 'none' : 'quality'))}
              className={`p-1 rounded-lg transition-all cursor-pointer hover:opacity-90 active:scale-95 flex items-center ${
                activeModal === 'quality' ? 'ring-1 ring-white/30' : ''
              }`}
              title={`Video Quality: ${streamQuality.fullLabel} (${streamResolution ? `${streamResolution.width}×${streamResolution.height}` : streamQuality.resolution})`}
              aria-label="Video Quality"
            >
              <QualityBadge quality={streamQuality} variant="player" />
            </button>

            {/* Audio Button (image_de22053a.png) */}
            <button
              onClick={() => setActiveModal(curr => (curr === 'audio' ? 'none' : 'audio'))}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                activeModal === 'audio' ? 'bg-white/20 text-white' : 'text-zinc-300 hover:text-white'
              }`}
              title="Audio Tracks"
              aria-label="Audio"
            >
              <Languages className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Subtitles Button (image_66a8b767.png) */}
            <button
              onClick={() => setActiveModal(curr => (curr === 'subtitles' ? 'none' : 'subtitles'))}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                activeModal === 'subtitles' || activeSubTrackUrl ? 'text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="Subtitles"
              aria-label="Subtitles"
            >
              <Subtitles className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Settings Button (image_2d037829.png) */}
            <button
              onClick={() => setActiveModal(curr => (curr === 'settings' ? 'none' : 'settings'))}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                activeModal === 'settings' ? 'bg-white/20 text-white' : 'text-zinc-300 hover:text-white'
              }`}
              title="Player Settings"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="text-zinc-300 hover:text-white transition-colors cursor-pointer p-1.5"
              title={isFullscreen ? 'Exit full screen (f)' : 'Full screen (f)'}
              aria-label="Fullscreen"
            >
              <Maximize className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
