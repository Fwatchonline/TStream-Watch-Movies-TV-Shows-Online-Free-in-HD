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
  Maximize2
} from 'lucide-react';
import { ResolvedStream, DirectProviderResult, cleanServerDisplay } from '../services/directStreamClient';
import { SubtitleTrack, Episode } from '../types/media';
import {
  PlaybackSettingsModal,
  SettingsSubView
} from './PlaybackSettingsModal';

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
  onToggleLights
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten all direct streams with sanitized server info (excluding castle completely)
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
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Playback Settings Modal state (matching image_bb8944d1.png)
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsSubView, setSettingsSubView] = useState<SettingsSubView>('main');

  // Player Accent Color (Defaults to #F5C400 yellow matching the site brand)
  const [accentColor, setAccentColor] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vyla_player_accent');
      if (saved && saved !== '#3B82F6') return saved;
      return '#F5C400';
    } catch {
      return '#F5C400';
    }
  });

  const handleSetAccentColor = (color: string) => {
    setAccentColor(color);
    try {
      localStorage.setItem('vyla_player_accent', color);
    } catch {}
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
  const [subDelay, setSubDelay] = useState<number>(0); // in seconds
  const [customSubtitleText, setCustomSubtitleText] = useState<string>('');

  // Scrubber Hover
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number>(0);

  // Saved resume time
  const resumeKey = storageKey ? `stream_progress_${storageKey}` : null;

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

    // Preserve current seek position across server switch or registered user continue watching
    let initialSeek = video.currentTime > 0 ? video.currentTime : 0;
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
        setIsLoading(false);
        // Detect audio tracks
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          const detected = hls.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || t.lang || `Audio Track ${idx + 1}`
          }));
          setAvailableAudioTracks(detected);
        }

        if (initialSeek > 0) {
          video.currentTime = initialSeek;
        }
        video.play().catch(() => setIsPlaying(false));
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
              console.error('Fatal HLS error:', data);
              hls.destroy();
              if (selectedStreamIndex < allStreams.length - 1) {
                setSelectedStreamIndex(prev => prev + 1);
              } else {
                setLoadError(`Direct stream interrupted on ${cleanServerDisplay(activeStream?.server)}. Please select another source.`);
                setIsLoading(false);
              }
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHls) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (initialSeek > 0) video.currentTime = initialSeek;
        video.play().catch(() => setIsPlaying(false));
      }, { once: true });
    } else {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (initialSeek > 0) video.currentTime = initialSeek;
        video.play().catch(() => setIsPlaying(false));
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
    const onError = () => {
      if (selectedStreamIndex < allStreams.length - 1) {
        setSelectedStreamIndex(prev => prev + 1);
      } else {
        setIsLoading(false);
        setLoadError(`Stream feed error. Select another source from playback settings.`);
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
    };
  }, [activeStream, resumeKey, selectedStreamIndex, allStreams.length]);

  // 3. User interaction & auto-hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsModal) {
        setShowControls(false);
      }
    }, 3200);
  }, [isPlaying, showSettingsModal]);

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
          if (video.paused) video.play();
          else video.pause();
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(v => {
            const next = Math.min(1, v + 0.1);
            video.volume = next;
            return next;
          });
          setIsMuted(false);
          video.muted = false;
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(v => {
            const next = Math.max(0, v - 0.1);
            video.volume = next;
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
        case 's':
          e.preventDefault();
          setSettingsSubView('main');
          setShowSettingsModal(prev => !prev);
          break;
        case 'escape':
          if (showSettingsModal) {
            setShowSettingsModal(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettingsModal]);

  // Control handlers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const target = Math.max(0, Math.min(duration, pos * duration));
    video.currentTime = target;
    setCurrentTime(target);
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

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    setPlaybackSpeed(speed);
    if (video) video.playbackRate = speed;
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
    setSelectedStreamIndex((selectedStreamIndex + 1) % allStreams.length);
  };

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

  // Parse custom VTT or SRT subtitle tracks
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

  interface ParsedCue {
    start: number;
    end: number;
    text: string;
  }
  const [cues, setCues] = useState<ParsedCue[]>([]);

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

  // Sync subtitle cues with video playback time
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

    // Also match any direct stream with that quality
    const streamMatch = allStreams.findIndex(s => s.quality.toLowerCase().includes(q.toLowerCase()));
    if (streamMatch !== -1 && streamMatch !== selectedStreamIndex) {
      setSelectedStreamIndex(streamMatch);
    }
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full aspect-video bg-black select-none overflow-hidden group/player"
      style={{ '--player-accent': accentColor } as React.CSSProperties}
    >
      {/* Native HTML5 <video> */}
      <video
        ref={videoRef}
        onClick={togglePlay}
        playsInline
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Synchronized Subtitle Overlay */}
      {customSubtitleText && (
        <div className="absolute bottom-16 sm:bottom-20 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
          <div className="px-4 py-1.5 rounded-lg bg-black/85 text-white font-medium text-sm sm:text-base md:text-lg tracking-wide text-center max-w-[85%] leading-relaxed shadow-lg border border-white/10 backdrop-blur-xs">
            {customSubtitleText}
          </div>
        </div>
      )}

      {/* Top Header Bar ON THE PLAYER */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/60 to-transparent transition-opacity duration-300 flex items-center justify-between gap-3 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Left: Title & Season/Episode */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
            style={{ backgroundColor: accentColor }}
          />
          <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md drop-shadow">
            {title}
          </h2>
          {!isMovie && (
            <span
              className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full text-white shrink-0"
              style={{ backgroundColor: `${accentColor}33`, borderColor: accentColor }}
            >
              S{currentSeason} · E{currentEpisode}
            </span>
          )}
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick TV Episode Stepper */}
          {!isMovie && (
            <div className="hidden sm:flex items-center gap-1 mr-1">
              {hasPrevEpisode && (
                <button
                  onClick={onPrevEpisode}
                  className="p-1.5 rounded-lg bg-[#232326]/90 hover:bg-[#303035] text-slate-300 hover:text-white border border-[#3A3A40] transition-colors cursor-pointer"
                  title="Previous Episode"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {hasNextEpisode && (
                <button
                  onClick={onNextEpisode}
                  className="px-2 py-1 rounded-lg bg-[#232326]/90 hover:bg-[#303035] text-white text-[11px] font-bold border border-[#3A3A40] transition-colors flex items-center gap-1 cursor-pointer"
                  title="Next Episode"
                >
                  <span>Next Ep</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Primary Playback Settings Toggle (Matches User Screenshot) */}
          <button
            onClick={() => {
              setSettingsSubView('main');
              setShowSettingsModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#232326]/90 hover:bg-[#303035] text-white text-[11px] font-bold backdrop-blur-md border border-[#3A3A40] hover:border-white/30 transition-all cursor-pointer shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Playback Settings</span>
          </button>

          {/* Video Sources Shortcut */}
          <button
            onClick={() => {
              setSettingsSubView('sources');
              setShowSettingsModal(true);
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#232326]/90 hover:bg-[#303035] text-white text-[11px] font-bold backdrop-blur-md border border-[#3A3A40] hover:border-white/30 transition-all cursor-pointer shadow-sm"
          >
            <Database className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Video Sources</span>
            <span
              className="w-4 h-4 rounded-full text-black text-[9px] font-black flex items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              {allStreams.length}
            </span>
          </button>

          {/* Rescan / Reload Streams */}
          {onRefreshStreams && (
            <button
              onClick={onRefreshStreams}
              title="Rescan Streams"
              className="p-1.5 rounded-lg bg-[#232326]/90 hover:bg-[#303035] text-[#A6A6AC] hover:text-white border border-[#3A3A40] transition-colors cursor-pointer backdrop-blur-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Cinema Lights Toggle */}
          {onToggleLights && (
            <button
              onClick={onToggleLights}
              title={isLightsDimmed ? 'Turn on lights' : 'Cinema lights off'}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer backdrop-blur-md ${
                isLightsDimmed
                  ? 'text-black border-transparent'
                  : 'bg-[#232326]/90 text-[#A6A6AC] hover:text-white border-[#3A3A40]'
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
                  ? 'text-black border-transparent'
                  : 'bg-[#232326]/90 text-[#A6A6AC] hover:text-white border-[#3A3A40]'
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
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xs pointer-events-none">
          <div className="relative">
            <RefreshCw className="w-12 h-12 animate-spin" style={{ color: accentColor }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
          </div>
          <span className="text-xs font-bold text-white tracking-wider uppercase mt-4">
            Connecting Stream...
          </span>
          <span className="text-[11px] mt-1 font-mono" style={{ color: accentColor }}>
            {cleanServerDisplay(activeStream?.server || 'Zeus Ultra 4K')}
          </span>
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
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full text-black flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer"
          style={{ backgroundColor: accentColor }}
        >
          <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-black ml-1" />
        </button>
      )}

      {/* Bottom Controls Bar ON THE PLAYER */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/75 to-transparent transition-opacity duration-300 flex flex-col gap-2 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Scrubber Bar */}
        <div
          onClick={handleSeek}
          onMouseMove={handleScrubberMouseMove}
          onMouseLeave={handleScrubberMouseLeave}
          className="relative w-full h-2.5 bg-white/20 hover:h-3.5 rounded-full cursor-pointer transition-all flex items-center group/bar"
        >
          {/* Buffered Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all"
            style={{ width: `${duration ? (bufferedTime / duration) * 100 : 0}%` }}
          />

          {/* Current Progress Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full flex items-center justify-end"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: accentColor
            }}
          >
            <div
              className="w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-0 group-hover/bar:scale-100 transition-transform -mr-1.5"
              style={{ boxShadow: `0 0 10px ${accentColor}` }}
            />
          </div>

          {/* Hover Time Tooltip */}
          {hoverPosition !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-[10px] font-mono font-bold rounded shadow-md pointer-events-none border border-white/10"
              style={{ left: `${hoverPosition * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-3 text-white">
          {/* Left: Play/Pause, Rewind, Forward, Volume, Time */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            <button
              onClick={() => handleSkip(-10)}
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Rewind 10s (J / Left Arrow)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleSkip(10)}
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Forward 10s (L / Right Arrow)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-20 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: accentColor }}
              />
            </div>

            {/* Time Display */}
            <div className="text-[11px] sm:text-xs font-mono font-medium text-slate-300 ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Subtitles, Settings, PiP, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Subtitles Button -> Opens Settings Modal on Subtitles Tab */}
            <button
              onClick={() => {
                setSettingsSubView('subtitles');
                setShowSettingsModal(true);
              }}
              className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/15"
              style={activeSubTrackUrl ? { color: accentColor } : { color: '#CBD5E1' }}
              title="Subtitles (CC)"
            >
              <Subtitles className="w-4 h-4" />
            </button>

            {/* Playback Settings Button -> Opens Settings Modal on Main View */}
            <button
              onClick={() => {
                setSettingsSubView('main');
                setShowSettingsModal(true);
              }}
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Playback Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors hidden sm:inline-block cursor-pointer"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* The Unified Playback Settings Modal (Pictured in screenshot image_bb8944d1.png) */}
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
