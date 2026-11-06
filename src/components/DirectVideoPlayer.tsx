import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  PictureInPicture2,
  SlidersHorizontal,
  Database,
  Moon,
  Maximize2,
  FastForward,
  Rewind,
  Sparkles,
  HelpCircle,
  X,
  Gauge,
  Server
} from 'lucide-react';
import { ResolvedStream, DirectProviderResult, cleanServerDisplay } from '../services/directStreamClient';
import { SubtitleTrack, Episode } from '../types/media';
import {
  PlaybackSettingsModal,
  SettingsSubView
} from './PlaybackSettingsModal';
import { PlayerLoadingSpinner } from './PlayerLoadingSpinner';
import { getUserPlayerSettings, UserPlayerSettings } from '../services/playerSettings';

interface DirectVideoPlayerProps {
  title: string;
  isMovie: boolean;
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

interface HudFeedback {
  id: number;
  type: 'play' | 'pause' | 'volume' | 'mute' | 'speed' | 'seek-forward' | 'seek-backward' | 'subtitle';
  text: string;
  icon?: any;
}

export const DirectVideoPlayer: React.FC<DirectVideoPlayerProps> = ({
  title,
  isMovie,
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
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const isDraggingScrubberRef = useRef<boolean>(false);

  // Flatten all direct streams with sanitized server info
  const allStreams: Array<ResolvedStream & { providerName: string; providerKey: string }> = [];
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
      allStreams.push({
        ...st,
        server: cleanServerDisplay(st.server),
        providerName: cleanServerDisplay(pr.providerName),
        providerKey: pr.provider
      });
    }
  }

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
  const [showRemainingTime, setShowRemainingTime] = useState<boolean>(false);

  // Player Settings & Preferences
  const [playerSettings, setPlayerSettings] = useState<UserPlayerSettings>(() => getUserPlayerSettings());

  useEffect(() => {
    const handleSettingsChanged = () => {
      const updated = getUserPlayerSettings();
      setPlayerSettings(updated);
      if (updated.playerAccentColor) {
        setAccentColor(updated.playerAccentColor);
      }
    };
    window.addEventListener('tstream_player_settings_changed', handleSettingsChanged);
    return () => window.removeEventListener('tstream_player_settings_changed', handleSettingsChanged);
  }, []);

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    try {
      const s = getUserPlayerSettings();
      return s.defaultSpeed || 1;
    } catch {
      return 1;
    }
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // On-screen HUD Feedback (Visual toast in center/top)
  const [hudFeedback, setHudFeedback] = useState<HudFeedback | null>(null);
  const [rippleEffect, setRippleEffect] = useState<{ id: number; type: 'play' | 'pause' | 'left' | 'right' } | null>(null);

  // Help shortcut modal
  const [showShortcutHelp, setShowShortcutHelp] = useState<boolean>(false);

  // Playback Settings Modal state
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsSubView, setSettingsSubView] = useState<SettingsSubView>('main');

  // Player Accent Color (Defaults to #F5C400 yellow matching the site brand)
  const [accentColor, setAccentColor] = useState<string>(() => {
    try {
      const s = getUserPlayerSettings();
      if (s.playerAccentColor) return s.playerAccentColor;
      return '#F5C400';
    } catch {
      return '#F5C400';
    }
  });

  const handleSetAccentColor = (color: string) => {
    setAccentColor(color);
  };

  // Quality state
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto');

  // Audio track state
  const [availableAudioTracks, setAvailableAudioTracks] = useState<Array<{ id: number; name: string }>>([
    { id: 0, name: 'Default (Original Studio)' },
    { id: 1, name: 'Stereo 2.0 Direct' },
    { id: 2, name: 'Dolby Digital 5.1' }
  ]);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<number>(0);

  // Subtitles
  const [activeSubTrackUrl, setActiveSubTrackUrl] = useState<string | null>(null);
  const [subDelay, setSubDelay] = useState<number>(0);
  const [customSubtitleText, setCustomSubtitleText] = useState<string>('');

  // Scrubber Hover
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);

  // Saved resume time
  const resumeKey = storageKey ? `stream_progress_${storageKey}` : null;

  // Trigger HUD Notification
  const triggerHud = useCallback((type: HudFeedback['type'], text: string) => {
    const id = Date.now();
    setHudFeedback({ id, type, text });
    setTimeout(() => {
      setHudFeedback(curr => (curr?.id === id ? null : curr));
    }, 900);
  }, []);

  // Format seconds to HH:MM:SS or MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Failover seamless resume reference
  const failoverSeekRef = useRef<number>(0);

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
        triggerHud('speed', `Auto-failover: ${nextServer.providerName || nextServer.server}`);
        return nextIdx;
      });
    } else {
      setLoadError(`Direct stream interrupted on ${cleanServerDisplay(activeStream?.server)}. Please select another source.`);
      setIsLoading(false);
    }
  }, [allStreams, activeStream, triggerHud]);

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
            console.warn('Autoplay with audio blocked by browser policy, attempting muted autoplay:', err);
            v.muted = true;
            setIsMuted(true);
            v.play()
              .then(() => {
                setIsPlaying(true);
                setIsLoading(false);
              })
              .catch(e => {
                console.warn('Playback waiting for user gesture:', e);
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
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          const detected = hls.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || t.lang || `Audio Track ${idx + 1}`
          }));
          setAvailableAudioTracks(detected);
        }
        triggerAutoPlay();
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
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHls) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        triggerAutoPlay();
      }, { once: true });
    } else {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        triggerAutoPlay();
      }, { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedStreamIndex, activeStream?.url, resumeKey]);

  // 2. Track playback & save progress
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
      if (playerSettings.autoplayNextEpisode && hasNextEpisode && onNextEpisode) {
        onNextEpisode();
      }
    };
    const onError = () => {
      console.warn(`Native video error on ${activeStream?.server || 'current'}, initiating auto-failover...`);
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
  }, [activeStream, resumeKey, selectedStreamIndex, allStreams.length, playerSettings.autoplayNextEpisode, hasNextEpisode, onNextEpisode]);

  // 3. User interaction & auto-hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsModal && !showShortcutHelp) {
        setShowControls(false);
      }
    }, 3200);
  }, [isPlaying, showSettingsModal, showShortcutHelp]);

  // Control handlers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      triggerHud('play', 'Playing');
      setRippleEffect({ id: Date.now(), type: 'play' });
    } else {
      video.pause();
      triggerHud('pause', 'Paused');
      setRippleEffect({ id: Date.now(), type: 'pause' });
    }
  };

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
    triggerHud(nextMuted ? 'mute' : 'volume', nextMuted ? 'Muted' : `Volume ${Math.round((nextMuted ? 0 : volume) * 100)}%`);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (video) {
      video.volume = val;
      video.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(duration, video.currentTime + seconds));
    video.currentTime = next;
    triggerHud(seconds > 0 ? 'seek-forward' : 'seek-backward', `${seconds > 0 ? '+' : ''}${seconds}s`);
    setRippleEffect({ id: Date.now(), type: seconds > 0 ? 'right' : 'left' });
  };

  const cycleSpeed = () => {
    const video = videoRef.current;
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (video) video.playbackRate = nextSpeed;
    triggerHud('speed', `${nextSpeed}x Speed`);
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    setPlaybackSpeed(speed);
    if (video) video.playbackRate = speed;
    triggerHud('speed', `${speed}x Speed`);
  };

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

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP failed:', err);
    }
  };

  const handleNextStream = () => {
    if (allStreams.length <= 1) return;
    const nextIdx = (selectedStreamIndex + 1) % allStreams.length;
    setSelectedStreamIndex(nextIdx);
    triggerHud('speed', `Switched: ${allStreams[nextIdx].server}`);
  };

  // Scrubber Seeking & Dragging
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

  const handleScrubberMouseLeave = () => {
    setHoverPosition(null);
  };

  // Double-Click / Double-Tap detection on player surface
  const lastClickRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const timeDiff = now - lastClickRef.current.time;

    if (timeDiff < 280) {
      // Double tap registered!
      if (relativeX < 0.35) {
        handleSkip(-10);
      } else if (relativeX > 0.65) {
        handleSkip(10);
      } else {
        toggleFullscreen();
      }
      lastClickRef.current = { time: 0, x: 0 };
    } else {
      // Single tap -> toggle play after slight delay or immediately
      lastClickRef.current = { time: now, x: e.clientX };
      togglePlay();
    }
  };

  // 4. Keyboard Shortcuts
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
          handleSkip(10);
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          handleSkip(-10);
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
          // Toggle subtitles
          if (activeSubTrackUrl) {
            setActiveSubTrackUrl(null);
            triggerHud('subtitle', 'Subtitles Off');
          } else if (combinedSubtitles.length > 0) {
            setActiveSubTrackUrl(combinedSubtitles[0].url);
            triggerHud('subtitle', `Subtitles: ${combinedSubtitles[0].label || 'On'}`);
          }
          break;
        case 's':
          e.preventDefault();
          setSettingsSubView('main');
          setShowSettingsModal(prev => !prev);
          break;
        case '?':
          e.preventDefault();
          setShowShortcutHelp(prev => !prev);
          break;
        case 'escape':
          if (showSettingsModal) setShowSettingsModal(false);
          if (showShortcutHelp) setShowShortcutHelp(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettingsModal, showShortcutHelp, activeSubTrackUrl, isMuted, volume, duration]);

  // Combine subtitles from API + stream metadata
  const combinedSubtitles: SubtitleTrack[] = [];
  const seenUrls = new Set<string>();

  for (const pr of providerResults) {
    if (Array.isArray(pr.subtitles)) {
      for (const sub of pr.subtitles) {
        if (sub?.url && !seenUrls.has(sub.url)) {
          seenUrls.add(sub.url);
          combinedSubtitles.push({
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
      combinedSubtitles.push(sub);
    }
  }

  // Auto-select subtitle according to user player settings
  useEffect(() => {
    if (!playerSettings.autoLoadSubtitles || playerSettings.defaultSubtitleLang === 'off') {
      return;
    }
    if (activeSubTrackUrl) return;
    if (combinedSubtitles.length === 0) return;

    const targetLang = (playerSettings.defaultSubtitleLang || 'exyu').toLowerCase();

    const matchedTrack = combinedSubtitles.find(sub => {
      const code = (sub.languageCode || sub.language || '').toLowerCase();
      const label = (sub.label || '').toLowerCase();

      if (targetLang === 'exyu') {
        return (
          code.startsWith('bs') ||
          code.startsWith('hr') ||
          code.startsWith('sr') ||
          code === 'bhs' ||
          label.includes('bosan') ||
          label.includes('hrvat') ||
          label.includes('srps') ||
          label.includes('serb') ||
          label.includes('croat') ||
          label.includes('exyu')
        );
      }

      return code === targetLang || code.startsWith(targetLang) || label.includes(targetLang);
    });

    if (matchedTrack?.url) {
      setActiveSubTrackUrl(matchedTrack.url);
    }
  }, [combinedSubtitles.length, playerSettings.autoLoadSubtitles, playerSettings.defaultSubtitleLang, activeSubTrackUrl]);

  // Parse custom VTT or SRT subtitle tracks
  interface ParsedCue {
    start: number;
    end: number;
    text: string;
  }
  const [cues, setCues] = useState<ParsedCue[]>([]);

  useEffect(() => {
    if (!activeSubTrackUrl) {
      setCustomSubtitleText('');
      return;
    }

    let isMounted = true;
    async function fetchSub() {
      try {
        const proxyUrl = `/api/subtitle-proxy?url=${encodeURIComponent(activeSubTrackUrl!)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('Sub load failed');
        const text = await res.text();
        if (isMounted) {
          parseSubtitles(text);
        }
      } catch (err) {
        console.warn('Failed to load subtitle:', err);
      }
    }

    fetchSub();
    return () => {
      isMounted = false;
    };
  }, [activeSubTrackUrl]);

  const parseSubtitles = (raw: string) => {
    const list: ParsedCue[] = [];
    const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let i = 0;
    const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})/;

    while (i < lines.length) {
      const line = lines[i].trim();
      const match = line.match(timeRegex);
      if (match) {
        const h1 = parseInt(match[1] || '0', 10);
        const m1 = parseInt(match[2], 10);
        const s1 = parseInt(match[3], 10);
        const ms1 = parseInt(match[4], 10);
        const start = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000;

        const h2 = parseInt(match[5] || '0', 10);
        const m2 = parseInt(match[6], 10);
        const s2 = parseInt(match[7], 10);
        const ms2 = parseInt(match[8], 10);
        const end = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000;

        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        list.push({
          start,
          end,
          text: textLines.join('\n').replace(/<[^>]+>/g, '')
        });
      }
      i++;
    }
    setCues(list);
  };

  useEffect(() => {
    if (!cues.length || !activeSubTrackUrl) {
      setCustomSubtitleText('');
      return;
    }
    const adjustedTime = currentTime - subDelay;
    const currentCue = cues.find(c => adjustedTime >= c.start && adjustedTime <= c.end);
    setCustomSubtitleText(currentCue ? currentCue.text : '');
  }, [currentTime, cues, subDelay, activeSubTrackUrl]);

  // Quality switch handler
  const handleQualityChange = (q: string) => {
    setSelectedQuality(q);
    if (hlsRef.current) {
      if (q === 'Auto') {
        hlsRef.current.currentLevel = -1;
      } else {
        const heightTarget = parseInt(q, 10);
        if (!isNaN(heightTarget) && hlsRef.current.levels) {
          const matchedLevel = hlsRef.current.levels.findIndex(l => l.height === heightTarget);
          if (matchedLevel !== -1) {
            hlsRef.current.currentLevel = matchedLevel;
          }
        }
      }
    }

    const streamMatch = allStreams.findIndex(s => s.quality.toLowerCase().includes(q.toLowerCase()));
    if (streamMatch !== -1 && streamMatch !== selectedStreamIndex) {
      setSelectedStreamIndex(streamMatch);
    }
    triggerHud('speed', `Quality: ${q}`);
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const activeSub = combinedSubtitles.find(s => s.url === activeSubTrackUrl);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full aspect-video bg-black select-none overflow-hidden group/player rounded-2xl"
      style={{ '--player-accent': accentColor } as React.CSSProperties}
    >
      {/* Native HTML5 <video> */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        preload="auto"
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Surface Click Overlay for Double-Tap gestures & Play/Pause */}
      <div
        onClick={handleSurfaceClick}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label="Video Playback Surface"
      />

      {/* Ripple Animation Indicator when clicking surface */}
      {rippleEffect && (
        <div
          key={rippleEffect.id}
          className={`absolute z-20 pointer-events-none ${
            rippleEffect.type === 'left'
              ? 'left-1/4 top-1/2'
              : rippleEffect.type === 'right'
              ? 'right-1/4 top-1/2'
              : 'left-1/2 top-1/2'
          }`}
        >
          <div className="w-20 h-20 rounded-full bg-black/60 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-2xl animate-ripple-pulse">
            {rippleEffect.type === 'play' && <Play className="w-8 h-8 fill-white ml-1 text-white" />}
            {rippleEffect.type === 'pause' && <Pause className="w-8 h-8 fill-white text-white" />}
            {rippleEffect.type === 'left' && (
              <div className="flex flex-col items-center">
                <Rewind className="w-6 h-6 fill-white" />
                <span className="text-[10px] font-bold mt-0.5">-10s</span>
              </div>
            )}
            {rippleEffect.type === 'right' && (
              <div className="flex flex-col items-center">
                <FastForward className="w-6 h-6 fill-white" />
                <span className="text-[10px] font-bold mt-0.5">+10s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic HUD Feedback Badge (e.g. Volume 80%, Seeking, Speed) */}
      {hudFeedback && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-hud-feedback">
          <div className="px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2.5 shadow-2xl">
            {hudFeedback.type === 'volume' && <Volume2 className="w-4 h-4 text-[#F5C400]" />}
            {hudFeedback.type === 'mute' && <VolumeX className="w-4 h-4 text-red-400" />}
            {hudFeedback.type === 'speed' && <Gauge className="w-4 h-4 text-[#F5C400]" />}
            {hudFeedback.type === 'subtitle' && <Subtitles className="w-4 h-4 text-[#F5C400]" />}
            {hudFeedback.type === 'seek-forward' && <RotateCw className="w-4 h-4 text-[#F5C400]" />}
            {hudFeedback.type === 'seek-backward' && <RotateCcw className="w-4 h-4 text-[#F5C400]" />}
            <span>{hudFeedback.text}</span>
          </div>
        </div>
      )}

      {/* Synchronized Subtitle Overlay */}
      {customSubtitleText && (
        <div className="absolute bottom-16 sm:bottom-22 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
          <div
            className={`text-center max-w-[85%] leading-relaxed font-semibold transition-all ${
              playerSettings.subtitleSize === 'small'
                ? 'text-xs sm:text-sm'
                : playerSettings.subtitleSize === 'large'
                ? 'text-base sm:text-xl md:text-2xl'
                : playerSettings.subtitleSize === 'xlarge'
                ? 'text-lg sm:text-2xl md:text-3xl'
                : 'text-sm sm:text-base md:text-lg'
            } ${
              playerSettings.subtitleColor === 'yellow'
                ? 'text-[#FFD000]'
                : playerSettings.subtitleColor === 'cyan'
                ? 'text-[#00E5FF]'
                : playerSettings.subtitleColor === 'green'
                ? 'text-[#00FF88]'
                : 'text-white'
            } ${
              playerSettings.subtitleBackground === 'shadow'
                ? 'bg-black/35 backdrop-blur-[1px] px-3 py-1 rounded drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
                : playerSettings.subtitleBackground === 'outline'
                ? 'bg-transparent px-2 py-0.5 [text-shadow:_0_0_4px_#000,_0_0_6px_#000,_0_0_8px_#000]'
                : 'bg-black/85 border border-white/10 backdrop-blur-xs shadow-lg px-4 py-1.5 rounded-lg'
            }`}
          >
            {customSubtitleText}
          </div>
        </div>
      )}

      {/* Top Header Bar ON THE PLAYER */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex items-center justify-between gap-3 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left: Title & Season/Episode */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_var(--player-accent)]"
            style={{ backgroundColor: accentColor }}
          />
          <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[180px] sm:max-w-md drop-shadow">
            {title}
          </h2>
          {!isMovie && (
            <span
              className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md text-white shrink-0 border"
              style={{ backgroundColor: `${accentColor}25`, borderColor: `${accentColor}60` }}
            >
              S{currentSeason} · E{currentEpisode}
            </span>
          )}
        </div>

        {/* Right: Cinema & Control Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick TV Episode Stepper */}
          {!isMovie && (
            <div className="hidden sm:flex items-center gap-1 mr-1">
              {hasPrevEpisode && (
                <button
                  onClick={onPrevEpisode}
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white border border-white/15 transition-colors cursor-pointer"
                  title="Previous Episode"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {hasNextEpisode && (
                <button
                  onClick={onNextEpisode}
                  className="px-2 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[11px] font-bold border border-white/15 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Next Episode"
                >
                  <span>Next Ep</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Quick Server Selector Dropdown */}
          {allStreams.length > 0 && (
            <div className="flex items-center bg-black/70 hover:bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 text-xs transition-colors shadow-sm">
              <Server className="w-3.5 h-3.5 mr-1.5 shrink-0" style={{ color: accentColor }} />
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mr-1.5 hidden md:inline">Server:</span>
              <select
                value={selectedStreamIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  if (!isNaN(idx) && allStreams[idx]) {
                    const v = videoRef.current;
                    if (v && v.currentTime > 2) {
                      failoverSeekRef.current = v.currentTime;
                    }
                    setSelectedStreamIndex(idx);
                    triggerHud('speed', `Server: ${allStreams[idx].providerName || allStreams[idx].server}`);
                  }
                }}
                className="bg-transparent font-extrabold text-[11px] outline-none cursor-pointer pr-1"
                style={{ color: accentColor }}
              >
                {allStreams.map((st, idx) => (
                  <option key={`${st.server}-${idx}`} value={idx} className="bg-[#18181c] text-white py-1">
                    {st.providerName || st.server} ({st.type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Primary Playback Settings Toggle */}
          <button
            onClick={() => {
              setSettingsSubView('main');
              setShowSettingsModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/85 text-white text-[11px] font-bold backdrop-blur-md border border-white/15 hover:border-white/30 transition-all cursor-pointer shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="hidden xs:inline">Settings</span>
          </button>

          {/* Keyboard Shortcuts Help Button */}
          <button
            onClick={() => setShowShortcutHelp(true)}
            className="p-1.5 rounded-lg bg-black/60 hover:bg-black/85 text-[#A6A6AC] hover:text-white border border-white/15 transition-colors cursor-pointer backdrop-blur-md hidden sm:flex"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {/* Cinema Lights Toggle */}
          {onToggleLights && (
            <button
              onClick={onToggleLights}
              title={isLightsDimmed ? 'Turn on lights' : 'Cinema lights off'}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer backdrop-blur-md ${
                isLightsDimmed
                  ? 'text-black border-transparent shadow-[0_0_8px_var(--player-accent)]'
                  : 'bg-black/60 text-[#A6A6AC] hover:text-white border-white/15'
              }`}
              style={isLightsDimmed ? { backgroundColor: accentColor } : {}}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Theater Mode Toggle */}
          {onToggleTheater && (
            <button
              onClick={onToggleTheater}
              title={isTheaterMode ? 'Standard view' : 'Theater mode'}
              className={`hidden md:flex p-1.5 rounded-lg border transition-colors cursor-pointer backdrop-blur-md ${
                isTheaterMode
                  ? 'text-black border-transparent shadow-[0_0_8px_var(--player-accent)]'
                  : 'bg-black/60 text-[#A6A6AC] hover:text-white border-white/15'
              }`}
              style={isTheaterMode ? { backgroundColor: accentColor } : {}}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs pointer-events-none">
          <PlayerLoadingSpinner
            subtitle="Fast multi-server HLS playback, multilingual subtitles, and zero ads."
          />
        </div>
      )}

      {/* Error Overlay with Auto Next Stream */}
      {loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/90 backdrop-blur-md text-white">
          <AlertTriangle className="w-12 h-12 mb-3 animate-bounce" style={{ color: accentColor }} />
          <h4 className="text-base font-bold text-white mb-1">Direct Stream Source Interrupted</h4>
          <p className="text-xs text-slate-400 max-w-md mb-4">{loadError}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNextStream}
              className="px-4 py-2 rounded-xl text-black font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-lg cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Next Source</span>
            </button>
            <button
              onClick={() => {
                setSettingsSubView('sources');
                setShowSettingsModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Choose Server
            </button>
          </div>
        </div>
      )}

      {/* Center Big Play Button when Paused */}
      {!isPlaying && !isLoading && !loadError && (
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full text-black flex items-center justify-center shadow-[0_0_30px_rgba(245,196,0,0.5)] transition-transform hover:scale-110 active:scale-95 cursor-pointer ring-4 ring-black/30"
          style={{ backgroundColor: accentColor }}
          aria-label="Play Video"
        >
          <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-black ml-1 text-black" />
        </button>
      )}

      {/* Bottom Controls Bar ON THE PLAYER */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-2.5 sm:p-4 bg-gradient-to-t from-black/95 via-black/75 to-transparent transition-opacity duration-300 flex flex-col gap-1.5 sm:gap-2.5 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Modern Interactive Progress Scrubber Bar */}
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          onMouseMove={handleScrubberMouseMove}
          onMouseLeave={handleScrubberMouseLeave}
          className="relative w-full h-2 hover:h-3.5 rounded-full cursor-pointer transition-all flex items-center group/bar bg-white/20"
        >
          {/* Buffered Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/35 rounded-full transition-all"
            style={{ width: `${duration ? (bufferedTime / duration) * 100 : 0}%` }}
          />

          {/* Current Progress Bar with Accent Glow */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full flex items-center justify-end"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: accentColor
            }}
          >
            {/* Glowing Scrubber Head Thumb */}
            <div
              className="w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-0 group-hover/bar:scale-100 transition-transform -mr-1.5 border border-black/20"
              style={{ boxShadow: `0 0 12px ${accentColor}` }}
            />
          </div>

          {/* Hover Time Tooltip */}
          {hoverPosition !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 px-2.5 py-1 bg-black/95 text-white text-[11px] font-mono font-bold rounded-lg shadow-xl pointer-events-none border border-white/15"
              style={{ left: `${hoverPosition * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 text-white">
          {/* Left: Play/Pause, Rewind, Forward, Volume, Time */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={togglePlay}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-white transition-all cursor-pointer active:scale-95"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white text-white" />
              ) : (
                <Play className="w-5 h-5 fill-white text-white ml-0.5" />
              )}
            </button>

            {/* Skip Backward 10s */}
            <button
              onClick={() => handleSkip(-10)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95 relative"
              title="Rewind 10s (Left Arrow / J)"
            >
              <RotateCcw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="text-[7px] font-extrabold absolute inset-0 flex items-center justify-center pt-0.5">
                10
              </span>
            </button>

            {/* Skip Forward 10s */}
            <button
              onClick={() => handleSkip(10)}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95 relative"
              title="Forward 10s (Right Arrow / L)"
            >
              <RotateCw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span className="text-[7px] font-extrabold absolute inset-0 flex items-center justify-center pt-0.5">
                10
              </span>
            </button>

            {/* Volume Control with hover-slider */}
            <div className="flex items-center gap-1 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 sm:p-2 rounded-xl hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                ) : (
                  <Volume2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-20 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer hidden xs:inline-block"
                style={{ accentColor: accentColor }}
              />
            </div>

            {/* Time Display with Elapsed / Remaining toggle */}
            <button
              type="button"
              onClick={() => setShowRemainingTime(prev => !prev)}
              className="text-[11px] sm:text-xs font-mono font-medium text-slate-300 hover:text-white transition-colors px-1 py-0.5 rounded cursor-pointer"
              title="Click to toggle Elapsed / Remaining time"
            >
              {showRemainingTime ? (
                <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
              ) : (
                <>
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-slate-500 mx-1">/</span>
                  <span>{formatTime(duration)}</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Server Badge, Quality, CC, Speed, PiP, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Quick Source Pill */}
            {activeStream && (
              <button
                type="button"
                onClick={() => {
                  setSettingsSubView('sources');
                  setShowSettingsModal(true);
                }}
                className="hidden lg:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-200 transition-colors cursor-pointer"
                title="Switch Video Source"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                <span className="truncate max-w-[90px]">{cleanServerDisplay(activeStream.server)}</span>
              </button>
            )}

            {/* Quality Badge */}
            <button
              type="button"
              onClick={() => {
                setSettingsSubView('quality');
                setShowSettingsModal(true);
              }}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-mono font-bold text-slate-200 transition-colors cursor-pointer border border-white/10"
              title="Video Resolution & Quality"
            >
              <span>{selectedQuality === 'Auto' ? 'HD' : selectedQuality}</span>
            </button>

            {/* Subtitles CC Button */}
            <button
              onClick={() => {
                setSettingsSubView('subtitles');
                setShowSettingsModal(true);
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/15 flex items-center gap-1 ${
                activeSubTrackUrl ? 'border border-white/20' : ''
              }`}
              style={activeSubTrackUrl ? { color: accentColor, backgroundColor: `${accentColor}18` } : { color: '#CBD5E1' }}
              title="Subtitles (C)"
            >
              <Subtitles className="w-4 h-4" />
              {activeSub && (
                <span className="text-[9px] font-mono font-extrabold uppercase hidden md:inline">
                  {activeSub.languageCode || 'CC'}
                </span>
              )}
            </button>

            {/* Quick Speed Button (Cycle on click) */}
            <button
              onClick={cycleSpeed}
              className="px-2 py-1 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer text-[10px] font-mono font-bold hidden sm:inline-block"
              title="Cycle Playback Speed"
            >
              {playbackSpeed}x
            </button>

            {/* Playback Settings Modal Button */}
            <button
              onClick={() => {
                setSettingsSubView('main');
                setShowSettingsModal(true);
              }}
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Playback Settings (S)"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors hidden md:inline-block cursor-pointer"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Maximize className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutHelp && (
        <div
          onClick={() => setShowShortcutHelp(false)}
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#121217] border border-white/15 p-5 shadow-2xl text-white relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" style={{ color: accentColor }} />
                <h3 className="text-sm font-bold text-white">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcutHelp(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span>Play / Pause</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 font-mono text-[10px] text-white">Space / K</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span>Seek ±10s</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 font-mono text-[10px] text-white">← / →</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span>Volume ±10%</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 font-mono text-[10px] text-white">↑ / ↓</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span>Mute / Unmute</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 font-mono text-[10px] text-white">M</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span>Toggle Subtitles</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 font-mono text-[10px] text-white">C</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span>Fullscreen</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 font-mono text-[10px] text-white">F</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span>Playback Settings</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 font-mono text-[10px] text-white">S</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <span>Double-tap surface</span>
                <span className="text-[10px] text-slate-400">±10s Seek</span>
              </div>
            </div>

            <button
              onClick={() => setShowShortcutHelp(false)}
              className="w-full mt-4 py-2 rounded-xl text-black font-extrabold text-xs transition-colors cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* The Unified Playback Settings Modal */}
      <PlaybackSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        subView={settingsSubView}
        setSubView={setSettingsSubView}
        allStreams={allStreams}
        selectedStreamIndex={selectedStreamIndex}
        onSelectStream={(idx) => {
          setSelectedStreamIndex(idx);
        }}
        isMovie={isMovie}
        currentSeason={currentSeason}
        currentEpisode={currentEpisode}
        totalSeasons={totalSeasons}
        seasonsList={seasonsList}
        episodesList={episodesList}
        onSelectEpisode={onSelectEpisode}
        selectedQuality={selectedQuality}
        onSelectQuality={handleQualityChange}
        activeSubTrackUrl={activeSubTrackUrl}
        combinedSubtitles={combinedSubtitles}
        onSelectSubtitle={(url) => setActiveSubTrackUrl(url)}
        subDelay={subDelay}
        onChangeSubDelay={(delta) => setSubDelay(d => Math.round((d + delta) * 10) / 10)}
        accentColor={accentColor}
        onChangeAccentColor={handleSetAccentColor}
        availableAudioTracks={availableAudioTracks}
        selectedAudioTrackId={selectedAudioTrackId}
        onSelectAudioTrack={(id) => {
          setSelectedAudioTrackId(id);
          if (hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks[id]) {
            hlsRef.current.audioTrack = id;
          }
        }}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={handleSpeedChange}
      />
    </div>
  );
};
