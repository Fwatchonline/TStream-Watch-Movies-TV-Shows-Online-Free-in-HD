import React, { useRef } from 'react';
import { Play, X, ChevronLeft, ChevronRight, Clock, Tv, Film, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MediaItem } from '../types/media';
import { ContinueWatchingRecord } from '../services/firebase';

interface ContinueWatchingSectionProps {
  onWatchMedia: (item: MediaItem, season?: number, episode?: number) => void;
  onSelectMedia: (item: MediaItem) => void;
  variant?: 'home' | 'library';
}

export const ContinueWatchingSection: React.FC<ContinueWatchingSectionProps> = ({
  onWatchMedia,
  onSelectMedia,
  variant = 'home'
}) => {
  const { user, continueWatching, removeContinueWatching, openAuthModal } = useAuth();
  const carouselRef = useRef<HTMLDivElement>(null);

  // Strictly for registered users
  if (!user) {
    if (variant === 'library') {
      return (
        <div className="bg-[#1a1a1d] border border-[#3A3A40] rounded-2xl p-8 text-center max-w-xl mx-auto my-8 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#F5C400]/10 border border-[#F5C400]/20 flex items-center justify-center mx-auto mb-4 text-[#F5C400]">
            <Clock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-extrabold text-white mb-2">
            Continue Watching is for Registered Members
          </h3>
          <p className="text-xs sm:text-sm text-[#A6A6AC] mb-6 leading-relaxed">
            Create a free account or sign in with Google to automatically save your playback progress across all your devices and never lose your spot.
          </p>
          <button
            onClick={() => openAuthModal('login')}
            className="px-6 py-2.5 rounded-xl bg-[#F5C400] text-black font-extrabold text-xs sm:text-sm hover:bg-[#e0b400] transition-transform active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            Sign In to Continue Watching
          </button>
        </div>
      );
    }
    return null;
  }

  if (continueWatching.length === 0) {
    if (variant === 'library') {
      return (
        <div className="bg-[#1a1a1d] border border-[#3A3A40] rounded-2xl p-12 text-center max-w-md mx-auto my-6">
          <Clock className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No In-Progress Titles</h3>
          <p className="text-xs text-[#A6A6AC]">
            When you watch movies or series, your progress will be securely saved here in real-time.
          </p>
        </div>
      );
    }
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const offset = direction === 'left' ? -380 : 380;
    carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleResume = (item: ContinueWatchingRecord) => {
    const mediaItem: MediaItem = {
      id: parseInt(item.tmdbId, 10) || 0,
      tmdbId: parseInt(item.tmdbId, 10) || 0,
      title: item.title,
      overview: '',
      posterPath: item.posterPath || '',
      backdropPath: item.backdropPath || item.posterPath || '',
      releaseDate: '',
      voteAverage: 8.0,
      voteCount: 100,
      popularity: 100,
      genres: [],
      mediaType: item.mediaType
    };
    onWatchMedia(mediaItem, item.seasonNumber || 1, item.episodeNumber || 1);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m`;
  };

  return (
    <section className="mb-10 w-full animate-fadeIn">
      {/* Row Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F5C400]/10 border border-[#F5C400]/20 flex items-center justify-center text-[#F5C400]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Continue Watching
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F5C400]/15 text-[#F5C400] border border-[#F5C400]/30">
                <Sparkles className="w-2.5 h-2.5" />
                Synced for {user.displayName || user.email?.split('@')[0]}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#A6A6AC]">
              Pick up right where you left off on any screen
            </p>
          </div>
        </div>

        {/* Carousel Arrows */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className="w-8 h-8 rounded-lg bg-[#29292D] border border-[#3A3A40] flex items-center justify-center text-slate-300 hover:text-white hover:border-[#F5C400] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className="w-8 h-8 rounded-lg bg-[#29292D] border border-[#3A3A40] flex items-center justify-center text-slate-300 hover:text-white hover:border-[#F5C400] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards Scroll Container */}
      <div
        ref={carouselRef}
        className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {continueWatching.map((item) => {
          const isTV = item.mediaType === 'tv';
          const remainingSecs = Math.max(0, item.durationSeconds - item.progressSeconds);
          const percent = Math.min(100, Math.max(2, item.percentage || Math.round((item.progressSeconds / (item.durationSeconds || 1)) * 100)));

          return (
            <div
              key={`${item.mediaType}_${item.tmdbId}`}
              className="flex-shrink-0 w-64 sm:w-72 bg-[#1a1a1d] rounded-xl overflow-hidden border border-[#3A3A40] hover:border-[#F5C400]/80 transition-all duration-200 group relative snap-start shadow-lg hover:shadow-amber-500/10 cursor-pointer"
              onClick={() => handleResume(item)}
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full bg-[#121215] overflow-hidden">
                <img
                  src={item.backdropPath || item.posterPath || '/og-image.png'}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeContinueWatching(item.mediaType, item.tmdbId);
                  }}
                  title="Remove from Continue Watching"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Media Type Badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold uppercase tracking-wider text-slate-200 backdrop-blur-xs">
                  {isTV ? <Tv className="w-3 h-3 text-[#F5C400]" /> : <Film className="w-3 h-3 text-[#F5C400]" />}
                  <span>{isTV ? 'TV Series' : 'Movie'}</span>
                </div>

                {/* Center Play Button on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-xl shadow-amber-500/40 transform transition-transform group-hover:scale-110">
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  </div>
                </div>

                {/* TV Episode Pill */}
                {isTV && item.seasonNumber && item.episodeNumber && (
                  <div className="absolute bottom-2 left-2 text-[11px] font-extrabold text-[#F5C400] bg-black/80 px-2 py-0.5 rounded backdrop-blur-xs border border-[#F5C400]/30">
                    S{item.seasonNumber} · E{item.episodeNumber}
                  </div>
                )}

                {/* Time Remaining Pill */}
                <div className="absolute bottom-2 right-2 text-[10px] font-semibold text-slate-300 bg-black/80 px-1.5 py-0.5 rounded backdrop-blur-xs">
                  {remainingSecs > 60 ? `${formatTime(remainingSecs)} left` : `${percent}%`}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1 bg-[#2e2e34]">
                <div
                  className="h-full bg-[#F5C400] transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Info Bottom Card */}
              <div className="p-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-[#F5C400] transition-colors">
                  {item.title}
                </h3>
                {isTV && item.episodeName ? (
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {item.episodeName}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <span>Watched {percent}%</span>
                    <span>·</span>
                    <span>Resume playback</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
