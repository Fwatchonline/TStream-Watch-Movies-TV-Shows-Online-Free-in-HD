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
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Server,
  Tv,
  Film,
  Check,
  PictureInPicture2,
  Sliders,
  Layers,
  Radio,
  Moon,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Zap,
  Globe,
  Search
} from 'lucide-react';
import { ResolvedStream, DirectProviderResult } from '../services/directStreamClient';
import { SubtitleTrack } from '../types/media';

interface DirectVideoPlayerProps {
  title: string;
  isMovie: boolean;
  currentSeason?: number;
  currentEpisode?: number;
  providerResults: DirectProviderResult[];
  availableSubtitles?: SubtitleTrack[];
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPrevEpisode?: boolean;
  storageKey?: string;
  onRefreshStreams?: () => void;
  isTheaterMode?: boolean;
  onToggleTheater?: () => void;
  isLightsDimmed?: boolean;
  onToggleLights?: () => void;
}

export const DirectVideoPlayer: React.FC<DirectVideoPlayerProps> = ({
  title,
  isMovie,
  currentSeason,
  currentEpisode,
  providerResults,
  availableSubtitles = [],
  onNextEpisode,
  onPrevEpisode,
  hasNextEpisode,
  hasPrevEpisode,
  storageKey,
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

  // Flatten all direct streams with server info
  const allStreams: Array<ResolvedStream & { providerName: string; providerKey: string }> = [];
  for (const pr of providerResults) {
    for (const st of pr.streams) {
      allStreams.push({
        ...st,
        providerName: pr.providerName,
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

  // Menus on the Player
  const [showServerMenu, setShowServerMenu] = useState<boolean>(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState<boolean>(false);

  // Accordion state for direct server providers
  const [openProviderKeys, setOpenProviderKeys] = useState<Record<string, boolean>>({
    vidapi: true,
    vidrock: true,
    vidlink: true,
    direct_hls_backup: true
  });

  // Accordion state for subtitle language groups
  const [openSubLanguages, setOpenSubLanguages] = useState<Record<string, boolean>>({
    Croatian: true,
    English: true
  });
  const [subSearchQuery, setSubSearchQuery] = useState<string>('');

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

    // Preserve current seek position across server switch
    let initialSeek = video.currentTime > 0 ? video.currentTime : 0;
    if (initialSeek === 0 && resumeKey) {
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
        if (initialSeek > 0) {
          video.currentTime = initialSeek;
        }
        video.play().catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal HLS error:', data);
              hls.destroy();
              // Auto-advance to next direct server if available!
              if (selectedStreamIndex < allStreams.length - 1) {
                setSelectedStreamIndex(prev => prev + 1);
              } else {
                setLoadError(`Direct stream interrupted on ${activeStream?.server || 'current server'}. Select another server.`);
                setIsLoading(false);
              }
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHls) {
      // Native Safari HLS
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        if (initialSeek > 0) video.currentTime = initialSeek;
        video.play().catch(() => setIsPlaying(false));
      }, { once: true });
    } else {
      // Direct MP4
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

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (resumeKey && video.currentTime > 5) {
        localStorage.setItem(resumeKey, video.currentTime.toString());
      }
      if (video.buffered.length > 0) {
        setBufferedTime(video.buffered.end(video.buffered.length - 1));
      }
    };

    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onError = () => {
      console.warn(`Playback error on ${activeStream?.server || 'source'}`);
      if (selectedStreamIndex < allStreams.length - 1) {
        setSelectedStreamIndex(prev => prev + 1);
      } else {
        setIsLoading(false);
        setLoadError(`Direct stream error on ${activeStream?.server || 'server'}. Please select another server.`);
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
      if (isPlaying && !showSettingsMenu && !showSubtitlesMenu && !showServerMenu) {
        setShowControls(false);
      }
    }, 3200);
  }, [isPlaying, showSettingsMenu, showSubtitlesMenu, showServerMenu]);

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
          setIsMuted(m => {
            video.muted = !m;
            return !m;
          });
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
      handleMouseMove();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMouseMove]);

  // Toggle Play / Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  // Seek
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
  };

  // Hover Seek Bar
  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos);
    setHoverTime(pos * duration);
  };

  const handleScrubberMouseLeave = () => setHoverPosition(null);

  // Skip +/- 10s
  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration || 0, video.currentTime + seconds));
  };

  // Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  // Speed
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setShowSettingsMenu(false);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Picture in Picture
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video !== document.pictureInPictureElement) {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP not supported or failed', e);
    }
  };

  // Switch Stream Server directly on the player
  const handleSelectStream = (index: number) => {
    setSelectedStreamIndex(index);
    setShowServerMenu(false);
    setLoadError(null);
  };

  const handleNextStream = () => {
    if (allStreams.length <= 1) return;
    const nextIdx = (selectedStreamIndex + 1) % allStreams.length;
    handleSelectStream(nextIdx);
  };

  // Combine Subtitles from Provider + App Subtitles
  const combinedSubtitles: Array<{ label: string; url: string; language?: string; isVtt?: boolean }> = [];
  for (const pr of providerResults) {
    for (const sub of pr.subtitles || []) {
      if (!combinedSubtitles.some(s => s.url === sub.url)) {
        combinedSubtitles.push({
          label: sub.label,
          url: sub.url,
          language: sub.language
        });
      }
    }
  }
  for (const sub of availableSubtitles) {
    if (!combinedSubtitles.some(s => s.url === sub.url)) {
      combinedSubtitles.push({
        label: sub.label,
        url: sub.url,
        language: sub.languageCode,
        isVtt: sub.format === 'vtt'
      });
    }
  }

  // Group streams by provider for Provider Accordions (VidAPI, VidRock, VidLink, etc.)
  interface ProviderGroup {
    key: string;
    name: string;
    streams: Array<{
      stream: ResolvedStream & { providerName: string; providerKey: string };
      globalIndex: number;
    }>;
  }

  const providerGroups: ProviderGroup[] = [];
  allStreams.forEach((st, idx) => {
    const rawKey = (st.providerKey || 'vidapi').toLowerCase();
    let group = providerGroups.find(g => g.key.toLowerCase() === rawKey);
    if (!group) {
      let displayName = st.providerName;
      if (!displayName || displayName.toLowerCase() === rawKey) {
        if (rawKey === 'vidapi') displayName = 'VidAPI Direct';
        else if (rawKey === 'vidrock') displayName = 'VidRock Multi-CDN';
        else if (rawKey === 'vidlink') displayName = 'VidLink Direct';
        else displayName = `${rawKey.toUpperCase()} Stream`;
      }
      group = {
        key: rawKey,
        name: displayName,
        streams: []
      };
      providerGroups.push(group);
    }
    group.streams.push({ stream: st, globalIndex: idx });
  });

  const toggleProviderGroup = (key: string) => {
    setOpenProviderKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Helper to normalize and group subtitles by language
  const getSubLanguageGroup = (label: string, langCode?: string): string => {
    const norm = label.toLowerCase().trim();

    if (norm.includes('chinese') && (norm.includes('simplified') || norm.includes('hans'))) return 'Chinese (Simplified)';
    if (norm.includes('chinese') && (norm.includes('traditional') || norm.includes('hant'))) return 'Chinese (Traditional)';
    if (norm.includes('spanish') && (norm.includes('latin') || norm.includes('latam'))) return 'Spanish (Latin)';
    if (norm.includes('portuguese') && (norm.includes('brazil') || norm.includes('br'))) return 'Portuguese (Brazil)';

    // Strip parentheses e.g. (V1), (CC), (SDH) and trailing digits e.g. Croatian2 -> Croatian
    let clean = label.replace(/\s*\([^)]*\)/g, '').trim();
    clean = clean.replace(/\d+$/, '').trim();

    const lower = clean.toLowerCase();
    const knownMap: Record<string, string> = {
      croat: 'Croatian',
      hrv: 'Croatian',
      serb: 'Serbian',
      srp: 'Serbian',
      bosn: 'Bosnian',
      bos: 'Bosnian',
      sloven: 'Slovenian',
      macedon: 'Macedonian',
      alban: 'Albanian',
      engl: 'English',
      span: 'Spanish',
      espan: 'Spanish',
      fren: 'French',
      franc: 'French',
      germ: 'German',
      deut: 'German',
      ital: 'Italian',
      portug: 'Portuguese',
      russ: 'Russian',
      arab: 'Arabic',
      bulgar: 'Bulgarian',
      greek: 'Greek',
      turk: 'Turkish',
      pol: 'Polish',
      czech: 'Czech',
      hungar: 'Hungarian',
      roman: 'Romanian',
      dutch: 'Dutch',
      swed: 'Swedish',
      norweg: 'Norwegian',
      dan: 'Danish',
      finn: 'Finnish',
      hebr: 'Hebrew',
      hind: 'Hindi',
      indones: 'Indonesian',
      japan: 'Japanese',
      korean: 'Korean',
      thai: 'Thai',
      vietnam: 'Vietnamese',
      ukrain: 'Ukrainian'
    };

    for (const [prefix, name] of Object.entries(knownMap)) {
      if (lower.startsWith(prefix)) return name;
    }

    if (langCode) {
      const code = langCode.toLowerCase().slice(0, 2);
      const codeMap: Record<string, string> = {
        hr: 'Croatian',
        sr: 'Serbian',
        bs: 'Bosnian',
        en: 'English',
        it: 'Italian',
        ar: 'Arabic',
        bg: 'Bulgarian',
        es: 'Spanish',
        fr: 'French',
        de: 'German',
        ru: 'Russian',
        zh: 'Chinese',
        pt: 'Portuguese',
        tr: 'Turkish',
        el: 'Greek',
        pl: 'Polish'
      };
      if (codeMap[code]) return codeMap[code];
    }

    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Other';
  };

  interface SubtitleGroup {
    language: string;
    tracks: Array<{
      label: string;
      url: string;
      language?: string;
      isVtt?: boolean;
    }>;
  }

  const subtitleGroups: SubtitleGroup[] = [];
  for (const sub of combinedSubtitles) {
    const lang = getSubLanguageGroup(sub.label, sub.language);
    let group = subtitleGroups.find(g => g.language.toLowerCase() === lang.toLowerCase());
    if (!group) {
      group = { language: lang, tracks: [] };
      subtitleGroups.push(group);
    }
    group.tracks.push(sub);
  }

  // Priority order: Croatian, Serbian, Bosnian, English first, then alphabetical
  const priorityLangs = ['croatian', 'serbian', 'bosnian', 'english'];
  subtitleGroups.sort((a, b) => {
    const aIdx = priorityLangs.indexOf(a.language.toLowerCase());
    const bIdx = priorityLangs.indexOf(b.language.toLowerCase());
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.language.localeCompare(b.language);
  });

  const toggleSubLanguage = (lang: string) => {
    setOpenSubLanguages(prev => ({
      ...prev,
      [lang]: !prev[lang]
    }));
  };

  const filteredSubtitleGroups = subSearchQuery.trim()
    ? subtitleGroups.filter(g =>
        g.language.toLowerCase().includes(subSearchQuery.toLowerCase()) ||
        g.tracks.some(t => t.label.toLowerCase().includes(subSearchQuery.toLowerCase()))
      )
    : subtitleGroups;

  // Real-time custom subtitle parser
  useEffect(() => {
    if (!activeSubTrackUrl) {
      setCustomSubtitleText('');
      return;
    }

    let isMounted = true;
    async function loadSub() {
      try {
        const res = await fetch(activeSubTrackUrl!);
        const text = await res.text();
        if (!isMounted) return;

        const cues: Array<{ start: number; end: number; text: string }> = [];
        const lines = text.split('\n');

        const parseTime = (str: string) => {
          const parts = str.trim().replace(',', '.').split(':');
          if (parts.length === 3) {
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
          }
          if (parts.length === 2) {
            return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
          }
          return 0;
        };

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.includes('-->')) {
            const [startStr, endStr] = line.split('-->');
            const start = parseTime(startStr) + subDelay;
            const end = parseTime(endStr) + subDelay;
            let cueText = '';
            i++;
            while (i < lines.length && lines[i].trim() !== '') {
              cueText += (cueText ? ' ' : '') + lines[i].trim();
              i++;
            }
            cues.push({ start, end, text: cueText.replace(/<[^>]+>/g, '') });
          }
        }

        const video = videoRef.current;
        if (!video) return;

        const checkCue = () => {
          const t = video.currentTime;
          const currentCue = cues.find(c => t >= c.start && t <= c.end);
          setCustomSubtitleText(currentCue ? currentCue.text : '');
        };

        video.addEventListener('timeupdate', checkCue);
        return () => video.removeEventListener('timeupdate', checkCue);
      } catch (err) {
        console.warn('Subtitle load error:', err);
      }
    }

    loadSub();
    return () => {
      isMounted = false;
    };
  }, [activeSubTrackUrl, subDelay]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden select-none group border border-white/10 shadow-2xl transition-all ${
        isFullscreen ? 'rounded-none border-0' : ''
      }`}
    >
      {/* Native HTML5 Video Element */}
      <video
        ref={videoRef}
        playsInline
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className="w-full h-full object-contain cursor-pointer bg-black"
      />

      {/* Custom Subtitles Overlay */}
      {customSubtitleText && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-6 text-center max-w-[85%]">
          <span className="inline-block bg-black/85 text-yellow-300 font-bold text-sm sm:text-lg md:text-xl px-3.5 py-1.5 rounded-lg shadow-2xl leading-relaxed tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] border border-black/40">
            {customSubtitleText}
          </span>
        </div>
      )}

      {/* Top Header Overlay with Title & Quick Server Info */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-3 sm:p-4 bg-gradient-to-b from-black/95 via-black/60 to-transparent transition-opacity duration-300 flex items-center justify-between gap-2 pointer-events-auto ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#232326]/90 border border-[#3A3A40] text-[10px] font-extrabold uppercase tracking-widest text-[#F5C400] shadow-md backdrop-blur-md">
            <Radio className="w-3 h-3 animate-pulse text-[#F5C400]" />
            <span>100% DIRECT HLS</span>
          </span>
          <span className="text-white font-bold text-xs sm:text-sm truncate drop-shadow-md hidden xs:inline">
            {isMovie ? title : `${title} · S${currentSeason} E${currentEpisode}`}
          </span>
          {activeStream && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#232326]/80 text-[#F5C400] text-[10px] font-bold border border-[#3A3A40] backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5C400] animate-pulse" />
              {activeStream.server} · {activeStream.quality}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick TV Episode Stepper */}
          {!isMovie && (hasPrevEpisode != null || hasNextEpisode != null) && (
            <div className="hidden sm:flex items-center gap-1 bg-[#232326]/90 border border-[#3A3A40] rounded-lg p-0.5 backdrop-blur-md">
              {onPrevEpisode && (
                <button
                  onClick={onPrevEpisode}
                  disabled={!hasPrevEpisode}
                  title="Previous Episode"
                  className="p-1 rounded text-white hover:text-[#F5C400] disabled:opacity-30 disabled:hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-[10px] font-bold text-[#F5C400] px-1.5 tabular-nums">
                E{currentEpisode}
              </span>
              {onNextEpisode && (
                <button
                  onClick={onNextEpisode}
                  disabled={!hasNextEpisode}
                  title="Next Episode"
                  className="p-1 rounded text-white hover:text-[#F5C400] disabled:opacity-30 disabled:hover:text-white cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Server List Modal Toggle Button */}
          <button
            onClick={() => {
              setShowServerMenu(!showServerMenu);
              setShowSettingsMenu(false);
              setShowSubtitlesMenu(false);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#232326]/90 hover:bg-[#303035] text-white text-[11px] font-bold backdrop-blur-md border border-[#3A3A40] hover:border-[#F5C400] transition-all cursor-pointer shadow-sm"
          >
            <Server className="w-3.5 h-3.5 text-[#F5C400]" />
            <span className="hidden xs:inline">HLS Servers</span>
            <span className="w-4 h-4 rounded-full bg-[#F5C400] text-black text-[9px] font-black flex items-center justify-center">
              {allStreams.length}
            </span>
          </button>

          {/* Rescan / Reload Streams */}
          {onRefreshStreams && (
            <button
              onClick={onRefreshStreams}
              title="Rescan HLS Streams"
              className="p-1.5 rounded-lg bg-[#232326]/90 hover:bg-[#303035] text-[#A6A6AC] hover:text-[#F5C400] border border-[#3A3A40] transition-colors cursor-pointer backdrop-blur-md"
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
                  ? 'bg-[#F5C400] text-black border-[#F5C400]'
                  : 'bg-[#232326]/90 text-[#A6A6AC] hover:text-white border-[#3A3A40]'
              }`}
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
                  ? 'bg-[#F5C400] text-black border-[#F5C400]'
                  : 'bg-[#232326]/90 text-[#A6A6AC] hover:text-white border-[#3A3A40]'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Full Server Drawer / Modal ON THE PLAYER */}
      {showServerMenu && (
        <div className="absolute inset-y-0 right-0 w-80 sm:w-96 bg-[#1a1a1e]/98 border-l border-[#3A3A40] p-4 sm:p-5 z-40 backdrop-blur-2xl overflow-y-auto flex flex-col justify-between shadow-2xl transition-all">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#3A3A40] mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#F5C400]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Direct HLS Servers ({allStreams.length})
                </h3>
              </div>
              <button
                onClick={() => setShowServerMenu(false)}
                className="p-1 rounded text-[#A6A6AC] hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[#A6A6AC] mb-3 leading-relaxed">
              100% Direct HLS video feeds without iframe servers. Click any server to switch stream:
            </p>

            <div className="space-y-2.5">
              {providerGroups.map((group) => {
                const isOpen = openProviderKeys[group.key] ?? true;
                const hasActiveStream = group.streams.some(s => s.globalIndex === selectedStreamIndex);
                const isVidApi = group.key.includes('vidapi');
                const isVidRock = group.key.includes('vidrock');
                const isVidLink = group.key.includes('vidlink');

                const ProviderIcon = isVidApi ? Zap : isVidRock ? Radio : isVidLink ? Layers : Server;
                const accentColor = isVidApi ? 'text-[#F5C400]' : isVidRock ? 'text-sky-400' : 'text-emerald-400';

                return (
                  <div
                    key={group.key}
                    className="rounded-xl border border-white/10 bg-[#212126] overflow-hidden shadow-sm transition-all"
                  >
                    {/* Provider Accordion Header */}
                    <button
                      onClick={() => toggleProviderGroup(group.key)}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs font-bold transition-colors cursor-pointer ${
                        hasActiveStream
                          ? 'bg-[#292930] text-white border-b border-white/10'
                          : 'bg-[#1e1e23] text-slate-300 hover:text-white hover:bg-[#25252b]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ProviderIcon className={`w-3.5 h-3.5 ${accentColor}`} />
                        <span className="text-white font-bold">{group.name}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/10 text-slate-300 font-mono">
                          {group.streams.length}
                        </span>
                        {hasActiveStream && (
                          <span className="w-2 h-2 rounded-full bg-[#F5C400] animate-pulse" title="Active Provider" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {hasActiveStream && (
                          <span className="text-[10px] font-black uppercase text-[#F5C400] tracking-wider">
                            Active
                          </span>
                        )}
                        {isOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Provider Servers List */}
                    {isOpen && (
                      <div className="p-2 space-y-1.5 bg-[#17171b]">
                        {group.streams.map(({ stream: st, globalIndex: idx }) => {
                          const isActive = idx === selectedStreamIndex;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelectStream(idx)}
                              className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer border ${
                                isActive
                                  ? 'bg-[#F5C400] text-black border-[#F5C400] font-bold shadow-md shadow-amber-500/20'
                                  : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/5 hover:text-white'
                              }`}
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse shrink-0" />}
                                  <span className="text-xs font-bold truncate">{st.server}</span>
                                </div>
                                <span className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-black/80' : 'text-slate-400'}`}>
                                  {st.providerName} · {st.type.toUpperCase()} Master
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  isActive ? 'bg-black/20 text-black' : 'bg-black/40 text-slate-200'
                                }`}>
                                  {st.quality}
                                </span>
                                {isActive && <Check className="w-4 h-4 text-black shrink-0" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {onRefreshStreams && (
            <div className="pt-3 border-t border-white/10 mt-4">
              <button
                onClick={onRefreshStreams}
                className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-scan Direct Servers</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xs pointer-events-none">
          <div className="relative">
            <RefreshCw className="w-12 h-12 animate-spin text-[#F5C400]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
          </div>
          <span className="text-xs font-bold text-white tracking-wider uppercase mt-4">
            Loading Direct Stream...
          </span>
          <span className="text-[11px] text-[#F5C400] mt-1 font-mono">
            {activeStream?.server || 'VidAPI / VidRock'}
          </span>
        </div>
      )}

      {/* Error Overlay with Auto Next Stream */}
      {loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/90 backdrop-blur-md text-white">
          <AlertTriangle className="w-12 h-12 text-[#F5C400] mb-3 animate-bounce" />
          <h4 className="text-base font-bold text-white mb-1">Direct Stream Source Interrupted</h4>
          <p className="text-xs text-slate-400 max-w-md mb-4">{loadError}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNextStream}
              className="px-4 py-2 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Next Direct Stream ({selectedStreamIndex + 1}/{allStreams.length})</span>
            </button>
            {onRefreshStreams && (
              <button
                onClick={onRefreshStreams}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Reload Streams
              </button>
            )}
          </div>
        </div>
      )}

      {/* Center Big Play Button when Paused */}
      {!isPlaying && !isLoading && !loadError && (
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#F5C400]/95 hover:bg-[#F5C400] text-black flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-amber-500/30"
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
          className="relative w-full h-2.5 bg-white/20 hover:h-4 rounded-full cursor-pointer transition-all flex items-center group/bar"
        >
          {/* Buffered Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full transition-all"
            style={{ width: `${duration ? (bufferedTime / duration) * 100 : 0}%` }}
          />

          {/* Current Progress Bar */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#F5C400] rounded-full flex items-center justify-end"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          >
            <div className="w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover/bar:scale-100 transition-transform -mr-2" />
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
                className="w-16 sm:w-20 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[#F5C400]"
              />
            </div>

            {/* Time Display */}
            <div className="text-[11px] sm:text-xs font-mono font-medium text-slate-300 ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: TV Episode Nav, Subtitles, Settings, Server Menu, PiP, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* TV Episode Quick Controls */}
            {!isMovie && (
              <div className="flex items-center gap-1 mr-1">
                {hasPrevEpisode && (
                  <button
                    onClick={onPrevEpisode}
                    className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Previous Episode"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {hasNextEpisode && (
                  <button
                    onClick={onNextEpisode}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-[#F5C400] hover:text-black text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    title="Next Episode"
                  >
                    <span>Next Ep</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Subtitles Menu Toggle */}
            <div className="relative">
              <button
                onClick={() => {
                  const nextState = !showSubtitlesMenu;
                  setShowSubtitlesMenu(nextState);
                  if (nextState && activeSubTrackUrl) {
                    const activeGroup = subtitleGroups.find(g => g.tracks.some(t => t.url === activeSubTrackUrl));
                    if (activeGroup) {
                      setOpenSubLanguages(prev => ({ ...prev, [activeGroup.language]: true }));
                    }
                  }
                  setShowSettingsMenu(false);
                  setShowServerMenu(false);
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeSubTrackUrl ? 'text-[#F5C400] bg-white/15' : 'text-slate-300 hover:bg-white/15 hover:text-white'
                }`}
                title="Subtitles"
              >
                <Subtitles className="w-4 h-4" />
              </button>

              {/* Subtitles Popup */}
              {showSubtitlesMenu && (
                <div className="absolute right-0 bottom-full mb-3 w-72 sm:w-80 bg-[#1c1c20] border border-[#3A3A40] rounded-2xl shadow-2xl p-3 z-40 backdrop-blur-2xl max-h-[380px] overflow-y-auto">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider px-1 pb-2 border-b border-[#3A3A40] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Subtitles className="w-3.5 h-3.5 text-[#F5C400]" />
                      <span>Subtitles ({combinedSubtitles.length})</span>
                    </div>
                    {activeSubTrackUrl && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5C400] text-black font-extrabold uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Quick Search */}
                  {combinedSubtitles.length > 5 && (
                    <div className="relative mt-2.5 mb-1.5">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search language..."
                        value={subSearchQuery}
                        onChange={(e) => setSubSearchQuery(e.target.value)}
                        className="w-full bg-[#141418] border border-white/10 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#F5C400] transition-colors"
                      />
                    </div>
                  )}

                  {/* Off Option */}
                  <button
                    onClick={() => {
                      setActiveSubTrackUrl(null);
                      setShowSubtitlesMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs mt-1.5 flex items-center justify-between cursor-pointer border transition-colors ${
                      !activeSubTrackUrl
                        ? 'bg-[#F5C400] text-black border-[#F5C400] font-bold shadow-md shadow-amber-500/20'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>Off (No Subtitles)</span>
                    {!activeSubTrackUrl && <Check className="w-3.5 h-3.5 text-black" />}
                  </button>

                  {/* Subtitle Offset / Sync Controls */}
                  {activeSubTrackUrl && (
                    <div className="px-3 py-2 my-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs text-slate-300">
                      <span>Sync Offset:</span>
                      <div className="flex items-center gap-1 font-mono">
                        <button
                          onClick={() => setSubDelay(d => Math.round((d - 0.5) * 10) / 10)}
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                        >
                          -0.5s
                        </button>
                        <span className="px-1 text-[11px] font-bold text-[#F5C400]">
                          {subDelay >= 0 ? `+${subDelay}` : subDelay}s
                        </span>
                        <button
                          onClick={() => setSubDelay(d => Math.round((d + 0.5) * 10) / 10)}
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                        >
                          +0.5s
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Grouped Subtitle Languages Accordion */}
                  <div className="space-y-1.5 mt-2">
                    {filteredSubtitleGroups.map((group) => {
                      const isOpen = openSubLanguages[group.language] ?? false;
                      const hasActiveTrack = group.tracks.some(t => t.url === activeSubTrackUrl);

                      return (
                        <div
                          key={group.language}
                          className="rounded-xl border border-white/10 bg-[#16161a] overflow-hidden transition-all shadow-xs"
                        >
                          {/* Language Accordion Header */}
                          <button
                            onClick={() => toggleSubLanguage(group.language)}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                              hasActiveTrack
                                ? 'bg-[#26262e] text-white font-bold'
                                : 'bg-[#1b1b20] text-slate-200 hover:bg-[#222228] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Globe className={`w-3.5 h-3.5 ${hasActiveTrack ? 'text-[#F5C400]' : 'text-slate-400'}`} />
                              <span className="font-semibold text-white">{group.language}</span>
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10 text-slate-300 font-mono">
                                {group.tracks.length}
                              </span>
                              {hasActiveTrack && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#F5C400] animate-pulse" />
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {hasActiveTrack && (
                                <span className="text-[9px] font-black uppercase text-[#F5C400] tracking-wider">
                                  Selected
                                </span>
                              )}
                              {isOpen ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {/* Individual Tracks inside this Language */}
                          {isOpen && (
                            <div className="p-1.5 space-y-1 bg-[#121215] border-t border-white/5">
                              {group.tracks.map((sub, sIdx) => {
                                const isSelected = activeSubTrackUrl === sub.url;
                                return (
                                  <button
                                    key={sIdx}
                                    onClick={() => {
                                      setActiveSubTrackUrl(sub.url);
                                      setShowSubtitlesMenu(false);
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-[#F5C400] text-black font-bold shadow-xs'
                                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                    }`}
                                  >
                                    <span className="truncate pr-2">{sub.label}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-black shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {filteredSubtitleGroups.length === 0 && (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No subtitles match &quot;{subSearchQuery}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings Menu Toggle (Speed & Quality) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSettingsMenu(!showSettingsMenu);
                  setShowSubtitlesMenu(false);
                  setShowServerMenu(false);
                }}
                className="p-1.5 rounded-lg hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Settings Dropdown */}
              {showSettingsMenu && (
                <div className="absolute right-0 bottom-full mb-3 w-56 bg-[#232326] border border-[#3A3A40] rounded-xl shadow-2xl p-2 z-40 backdrop-blur-xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5 border-b border-[#3A3A40]">
                    Playback Speed
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-1 p-1">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`py-1 rounded text-xs text-center font-mono font-medium cursor-pointer ${
                          playbackSpeed === speed
                            ? 'bg-[#F5C400] text-black font-bold'
                            : 'bg-white/5 text-slate-300 hover:bg-white/15'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1.5 border-t border-b border-white/10 mt-2">
                    Current Stream
                  </div>
                  <div className="px-2 py-1.5 text-xs text-emerald-400 font-mono font-bold flex items-center justify-between">
                    <span>{activeStream?.server || 'Server'}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{activeStream?.quality}</span>
                  </div>
                </div>
              )}
            </div>

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
    </div>
  );
};
