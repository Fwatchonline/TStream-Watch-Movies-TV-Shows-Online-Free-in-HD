import React, { useRef } from 'react';
import { Play, X, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MediaItem } from '../types/media';
import { ContinueWatchingRecord } from '../services/firebase';

interface ContinueWatchingSectionProps {
  onWatchMedia: (item: MediaItem, season?: number, episode?: number) => void;
  onSelectMedia?: (item: MediaItem) => void;
  variant?: 'home' | 'library';
}

export const ContinueWatchingSection: React.FC<ContinueWatchingSectionProps> = ({
  onWatchMedia,
  variant = 'home'
}) => {
  const { user, continueWatching, removeContinueWatching, openAuthModal } = useAuth();
  const carouselRef = useRef<HTMLDivElement>(null);

  if (continueWatching.length === 0) {
    if (variant === 'library') {
      return (
        <div className="bg-[#1a1a1d] border border-[#3A3A40] rounded-xl p-10 text-center max-w-md mx-auto my-6">
          <Clock className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No In-Progress Titles</h3>
          <p className="text-xs text-[#A6A6AC] leading-relaxed">
            When you watch movies, TV shows, or anime, your exact playback position is saved here automatically so you can resume anytime.
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
    const isAnime = item.mediaType === 'anime';
    const numericId = parseInt(item.tmdbId, 10) || item.anilistId || 0;
    const mediaItem: MediaItem = {
      id: isAnime ? (item.anilistId || numericId) : numericId,
      tmdbId: isAnime ? numericId : numericId,
      anilistId: isAnime ? (item.anilistId || numericId) : undefined,
      malId: item.malId,
      title: item.title,
      overview: '',
      posterPath: item.posterPath || '',
      backdropPath: item.backdropPath || item.posterPath || '',
      releaseDate: '',
      voteAverage: 0,
      voteCount: 0,
      popularity: 0,
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
    <section className="mb-10 w-full">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Continue Watching
            </h2>
            <span className="text-xs text-[#A6A6AC] tabular-nums">
              {user
                ? `Synced · ${user.displayName || user.email?.split('@')[0]}`
                : 'Saved locally · '}
              {!user && (
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="text-[#F5C400] hover:underline font-semibold cursor-pointer"
                >
                  Sign in to sync across devices
                </button>
              )}
            </span>
          </div>
          <p className="text-xs text-[#A6A6AC] mt-0.5">
            Pick up right where you left off across movies, series, and anime
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label="Scroll continue watching left"
            className="w-9 h-9 rounded-lg bg-[#29292D] border border-[#3A3A40] flex items-center justify-center text-slate-300 hover:text-white hover:border-[#F5C400] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label="Scroll continue watching right"
            className="w-9 h-9 rounded-lg bg-[#29292D] border border-[#3A3A40] flex items-center justify-center text-slate-300 hover:text-white hover:border-[#F5C400] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={carouselRef}
        className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {continueWatching.map((item) => {
          const isTV = item.mediaType === 'tv';
          const isAnime = item.mediaType === 'anime';
          const isEpisodic = isTV || isAnime;
          const remainingSecs = Math.max(0, (item.durationSeconds || 0) - (item.progressSeconds || 0));
          const percent = Math.min(
            100,
            Math.max(2, item.percentage || Math.round(((item.progressSeconds || 0) / (item.durationSeconds || 1)) * 100))
          );
          const itemIdForRemove = isAnime ? (item.anilistId || item.tmdbId) : item.tmdbId;

          return (
            <div
              key={`${item.mediaType}_${item.mediaKey || item.tmdbId}`}
              className="flex-shrink-0 w-64 sm:w-72 bg-[#1a1a1d] rounded-xl overflow-hidden border border-[#3A3A40] hover:border-[#F5C400]/80 transition-all duration-200 group relative snap-start cursor-pointer"
              onClick={() => handleResume(item)}
            >
              <div className="relative aspect-video w-full bg-[#121215] overflow-hidden">
                {item.backdropPath || item.posterPath ? (
                  <img
                    src={item.backdropPath || item.posterPath}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#232326] to-[#121215] text-xs font-semibold text-[#A6A6AC] px-4 text-center">
                    {item.title}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeContinueWatching(item.mediaType, itemIdForRemove);
                  }}
                  aria-label={`Remove ${item.title} from Continue Watching`}
                  title="Remove from Continue Watching"
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/75 hover:bg-rose-600 text-slate-200 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  </div>
                </div>

                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white">
                  <span className="tabular-nums text-[#F5C400] drop-shadow">
                    {isAnime
                      ? `Ep ${item.episodeNumber || 1}`
                      : isTV && item.seasonNumber && item.episodeNumber
                      ? `S${item.seasonNumber} · E${item.episodeNumber}`
                      : 'Movie'}
                  </span>
                  <span className="tabular-nums text-slate-200 drop-shadow">
                    {remainingSecs > 60 ? `${formatTime(remainingSecs)} left` : `${percent}%`}
                  </span>
                </div>
              </div>

              <div className="w-full h-1 bg-[#2e2e34]">
                <div
                  className="h-full bg-[#F5C400] transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="p-3">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#F5C400] transition-colors">
                  {item.title}
                </h3>
                <p className="text-[11px] text-[#A6A6AC] truncate mt-0.5 tabular-nums">
                  {isEpisodic && item.episodeName
                    ? `${item.episodeName} · ${percent}%`
                    : `${isAnime ? 'Anime' : isTV ? 'TV Series' : 'Movie'} · ${percent}% watched`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
