import React, { useState } from 'react';
import {
  Database,
  Layers,
  SlidersHorizontal,
  Subtitles,
  Palette,
  Volume2,
  Gauge,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Search,
  Globe,
  Film
} from 'lucide-react';
import { ResolvedStream, cleanServerDisplay, formatQualityBadge, stripQualityFromName, getQualityPillClasses } from '../services/directStreamClient';
import { SubtitleTrack, Episode } from '../types/media';

export type SettingsSubView =
  | 'main'
  | 'sources'
  | 'episodes'
  | 'quality'
  | 'subtitles'
  | 'color'
  | 'audio'
  | 'speed';

interface PlaybackSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subView: SettingsSubView;
  setSubView: (view: SettingsSubView) => void;
  // Sources
  allStreams: Array<ResolvedStream & { providerName: string; providerKey: string }>;
  selectedStreamIndex: number;
  onSelectStream: (index: number) => void;
  // Episodes
  isMovie: boolean;
  currentSeason?: number;
  currentEpisode?: number;
  totalSeasons?: number;
  seasonsList?: any[];
  episodesList?: Episode[];
  onSelectEpisode?: (season: number, episode: number) => void;
  // Quality
  selectedQuality: string;
  onSelectQuality: (quality: string) => void;
  // Subtitles
  activeSubTrackUrl: string | null;
  combinedSubtitles: SubtitleTrack[];
  onSelectSubtitle: (url: string | null) => void;
  subDelay: number;
  onChangeSubDelay: (delta: number) => void;
  // Accent Color
  accentColor: string;
  onChangeAccentColor: (color: string) => void;
  // Audio Track
  availableAudioTracks: Array<{ id: number; name: string }>;
  selectedAudioTrackId: number;
  onSelectAudioTrack: (id: number) => void;
  // Speed
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const PRESET_ACCENT_COLORS = [
  { name: 'T-Stream Yellow', hex: '#F5C400' },
  { name: 'Amber Glow', hex: '#FBBF24' },
  { name: 'Sunset Orange', hex: '#F97316' },
  { name: 'Netflix Crimson', hex: '#E50914' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Vivid Purple', hex: '#8B5CF6' },
  { name: 'Hot Pink', hex: '#EC4899' },
  { name: 'Cyan Neon', hex: '#06B6D4' },
  { name: 'Clean White', hex: '#FFFFFF' }
];

export const QUALITY_OPTIONS = [
  { label: 'Auto (Adaptive Bitrate)', value: 'Auto' },
  { label: '2160p (4K Ultra HD)', value: '2160p' },
  { label: '1080p (Full HD)', value: '1080p' },
  { label: '720p (HD)', value: '720p' },
  { label: '480p (SD)', value: '480p' },
  { label: '360p (Low)', value: '360p' }
];

export const SPEED_OPTIONS = [
  { label: '0.5x (Slow)', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: 'Normal (1.0x)', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '1.75x', value: 1.75 },
  { label: '2.0x (Fast)', value: 2 }
];

export const PlaybackSettingsModal: React.FC<PlaybackSettingsModalProps> = ({
  isOpen,
  onClose,
  subView,
  setSubView,
  allStreams,
  selectedStreamIndex,
  onSelectStream,
  isMovie,
  currentSeason = 1,
  currentEpisode = 1,
  totalSeasons = 1,
  seasonsList,
  episodesList = [],
  onSelectEpisode,
  selectedQuality,
  onSelectQuality,
  activeSubTrackUrl,
  combinedSubtitles,
  onSelectSubtitle,
  subDelay,
  onChangeSubDelay,
  accentColor,
  onChangeAccentColor,
  availableAudioTracks,
  selectedAudioTrackId,
  onSelectAudioTrack,
  playbackSpeed,
  onChangeSpeed
}) => {
  const [subSearch, setSubSearch] = useState('');
  const [customHex, setCustomHex] = useState(accentColor);
  const [selectedSeasonTab, setSelectedSeasonTab] = useState(currentSeason);

  if (!isOpen) return null;

  // Active stream formatted short label e.g. "Aether (4K)"
  const activeStream = allStreams[selectedStreamIndex] || allStreams[0];
  const formatShortStream = (stream?: ResolvedStream): string => {
    if (!stream) return 'Aether (1080p)';
    const clean = stripQualityFromName(cleanServerDisplay(stream.server));
    const qLabel = formatQualityBadge(stream.quality, stream.type);
    const shortName = clean.split('·')[0].trim().slice(0, 18) || 'Aether';
    return `${shortName} (${qLabel})`;
  };

  // Active Subtitle Label
  const activeSub = combinedSubtitles.find(s => s.url === activeSubTrackUrl);
  const activeSubLabel = activeSub ? (activeSub.label || activeSub.language || 'Subtitles') : 'Off';

  // Subtitle filter
  const filteredSubs = combinedSubtitles.filter(s =>
    (s.label || '').toLowerCase().includes(subSearch.toLowerCase()) ||
    (s.language || '').toLowerCase().includes(subSearch.toLowerCase())
  );

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs pointer-events-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl bg-[#0f1015]/95 backdrop-blur-2xl border border-white/10 p-5 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ================= MAIN VIEW (Matches screenshot image_bb8944d1.png) ================= */}
        {subView === 'main' && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 mb-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Playback Settings
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of 7 Settings Items */}
            <div className="space-y-1">
              {/* 1. Video Sources */}
              <button
                onClick={() => setSubView('sources')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <Database
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
                    style={{ color: accentColor }}
                  />
                  <span className="text-sm font-semibold text-white">Video Sources</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: accentColor }}>
                    {formatShortStream(activeStream)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </button>

              {/* 2. Seasons & Episodes */}
              <button
                onClick={() => setSubView('episodes')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <Layers
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
                    style={{ color: accentColor }}
                  />
                  <span className="text-sm font-semibold text-white">Seasons & Episodes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: accentColor }}>
                    {!isMovie ? `S${currentSeason} · E${currentEpisode}` : 'Movie'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </button>

              {/* 3. Quality */}
              <button
                onClick={() => setSubView('quality')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <SlidersHorizontal
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
                    style={{ color: accentColor }}
                  />
                  <span className="text-sm font-semibold text-white">Quality</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-300">
                    {selectedQuality}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </button>

              {/* 4. Subtitles (CC) */}
              <button
                onClick={() => setSubView('subtitles')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <Subtitles
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
                    style={{ color: accentColor }}
                  />
                  <span className="text-sm font-semibold text-white">Subtitles (CC)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: activeSubTrackUrl ? accentColor : '#94A3B8' }}
                  >
                    {activeSubLabel}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </button>

              {/* 5. Player Accent Color */}
              <button
                onClick={() => setSubView('color')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <Palette
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
                    style={{ color: accentColor }}
                  />
                  <span className="text-sm font-semibold text-white">Player Accent Color</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full ring-2 ring-white/10 shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span className="text-sm font-mono font-medium text-slate-300">
                    {accentColor.toUpperCase()}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </button>

              {/* 6. Audio Track */}
              <button
                onClick={() => setSubView('audio')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <Volume2
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
                    style={{ color: accentColor }}
                  />
                  <span className="text-sm font-semibold text-white">Audio Track</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-300">
                    {availableAudioTracks[selectedAudioTrackId]?.name || 'Default'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </button>

              {/* 7. Playback Speed */}
              <button
                onClick={() => setSubView('speed')}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3">
                  <Gauge
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
                    style={{ color: accentColor }}
                  />
                  <span className="text-sm font-semibold text-white">Playback Speed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-300">
                    {playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ================= SUBVIEW: VIDEO SOURCES ================= */}
        {subView === 'sources' && (
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
              <button
                onClick={() => setSubView('main')}
                className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Video Sources</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
              {allStreams.map((st, idx) => {
                const isSelected = idx === selectedStreamIndex;
                let cleanName = stripQualityFromName(cleanServerDisplay(st.server));
                if (!cleanName.includes('·') && !cleanName.includes('Cluster') && !cleanName.includes('Route') && allStreams.length > 1) {
                  cleanName = `${cleanName} · Node ${idx + 1}`;
                }
                const qBadge = formatQualityBadge(st.quality, st.type);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectStream(idx);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left cursor-pointer border ${
                      isSelected
                        ? 'bg-white/10 border-white/20 text-white font-semibold shadow-sm'
                        : 'bg-white/[0.03] border-transparent hover:bg-white/[0.07] text-slate-200'
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs sm:text-sm font-medium truncate text-white">
                          {cleanName}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black tracking-wide shrink-0 ${getQualityPillClasses(qBadge)}`}>
                          {qBadge}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span>{st.type.toUpperCase()}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= SUBVIEW: SEASONS & EPISODES ================= */}
        {subView === 'episodes' && (
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
              <button
                onClick={() => setSubView('main')}
                className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Seasons & Episodes</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isMovie ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-white">Feature Film Presentation</p>
                <p className="text-[11px] mt-1 text-slate-400">Single presentation with full direct controls.</p>
              </div>
            ) : (
              <div>
                {/* Season tabs if series has multiple seasons */}
                {totalSeasons > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
                    {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((sNum) => {
                      const isActive = sNum === selectedSeasonTab;
                      return (
                        <button
                          key={sNum}
                          onClick={() => setSelectedSeasonTab(sNum)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isActive
                              ? 'text-white'
                              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                          }`}
                          style={isActive ? { backgroundColor: accentColor } : {}}
                        >
                          Season {sNum}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Episodes List */}
                <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
                  {episodesList.map((ep) => {
                    const isCurrent =
                      selectedSeasonTab === currentSeason && ep.episodeNumber === currentEpisode;
                    return (
                      <button
                        key={ep.episodeNumber}
                        onClick={() => {
                          if (onSelectEpisode) {
                            onSelectEpisode(selectedSeasonTab, ep.episodeNumber);
                          }
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-white/10 font-bold text-white'
                            : 'hover:bg-white/5 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white"
                            style={isCurrent ? { color: accentColor } : {}}
                          >
                            E{ep.episodeNumber}
                          </span>
                          <span className="text-xs truncate">{ep.name || `Episode ${ep.episodeNumber}`}</span>
                        </div>
                        {isCurrent && (
                          <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= SUBVIEW: QUALITY ================= */}
        {subView === 'quality' && (
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
              <button
                onClick={() => setSubView('main')}
                className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Quality</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              {QUALITY_OPTIONS.map((q) => {
                const isSelected = selectedQuality === q.value;
                return (
                  <button
                    key={q.value}
                    onClick={() => {
                      onSelectQuality(q.value);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white/10 text-white font-semibold'
                        : 'hover:bg-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="text-xs sm:text-sm">{q.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= SUBVIEW: SUBTITLES (CC) ================= */}
        {subView === 'subtitles' && (
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
              <button
                onClick={() => setSubView('main')}
                className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Subtitles (CC)</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search language..."
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                className="w-full bg-[#181920] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Off Option */}
            <button
              onClick={() => {
                onSelectSubtitle(null);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer mb-2 ${
                !activeSubTrackUrl
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span>Off (No Subtitles)</span>
              {!activeSubTrackUrl && (
                <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              )}
            </button>

            {/* Sync Offset Controls */}
            {activeSubTrackUrl && (
              <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl text-xs text-slate-300 mb-2">
                <span>Sync Offset:</span>
                <div className="flex items-center gap-1 font-mono">
                  <button
                    onClick={() => onChangeSubDelay(-0.5)}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                  >
                    -0.5s
                  </button>
                  <span className="px-1 text-[11px] font-bold" style={{ color: accentColor }}>
                    {subDelay >= 0 ? `+${subDelay}` : subDelay}s
                  </span>
                  <button
                    onClick={() => onChangeSubDelay(0.5)}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                  >
                    +0.5s
                  </button>
                </div>
              </div>
            )}

            {/* Subtitles list */}
            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
              {filteredSubs.map((sub, sIdx) => {
                const isSelected = activeSubTrackUrl === sub.url;
                return (
                  <button
                    key={sIdx}
                    onClick={() => {
                      onSelectSubtitle(sub.url);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white/10 text-white font-bold'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{sub.label}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                    )}
                  </button>
                );
              })}

              {filteredSubs.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  No subtitle tracks matching query
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SUBVIEW: PLAYER ACCENT COLOR ================= */}
        {subView === 'color' && (
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
              <button
                onClick={() => setSubView('main')}
                className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Player Accent Color</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Active Preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 mb-3">
              <span
                className="w-7 h-7 rounded-full shadow-lg ring-2 ring-white/20 shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              <div>
                <div className="text-xs font-semibold text-white">Current Accent</div>
                <div className="text-xs font-mono text-slate-400">{accentColor.toUpperCase()}</div>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Color Palette
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESET_ACCENT_COLORS.map((col) => {
                const isSelected = accentColor.toLowerCase() === col.hex.toLowerCase();
                return (
                  <button
                    key={col.hex}
                    onClick={() => onChangeAccentColor(col.hex)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/5 border-transparent hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-white/10"
                      style={{ backgroundColor: col.hex }}
                    />
                    <span className="truncate">{col.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Input */}
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Custom Hex
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                placeholder="#F5C400"
                className="w-full bg-[#181920] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono placeholder-slate-400 focus:outline-none focus:border-white/30"
              />
              <button
                onClick={() => {
                  if (/^#([0-9A-F]{3}){1,2}$/i.test(customHex)) {
                    onChangeAccentColor(customHex);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* ================= SUBVIEW: AUDIO TRACK ================= */}
        {subView === 'audio' && (
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
              <button
                onClick={() => setSubView('main')}
                className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Audio Track</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              {availableAudioTracks.map((track) => {
                const isSelected = track.id === selectedAudioTrackId;
                return (
                  <button
                    key={track.id}
                    onClick={() => {
                      onSelectAudioTrack(track.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white/10 text-white font-semibold'
                        : 'hover:bg-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="text-xs sm:text-sm">{track.name}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= SUBVIEW: PLAYBACK SPEED ================= */}
        {subView === 'speed' && (
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
              <button
                onClick={() => setSubView('main')}
                className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Playback Speed</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              {SPEED_OPTIONS.map((sp) => {
                const isSelected = playbackSpeed === sp.value;
                return (
                  <button
                    key={sp.value}
                    onClick={() => {
                      onChangeSpeed(sp.value);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white/10 text-white font-semibold'
                        : 'hover:bg-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span className="text-xs sm:text-sm">{sp.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
