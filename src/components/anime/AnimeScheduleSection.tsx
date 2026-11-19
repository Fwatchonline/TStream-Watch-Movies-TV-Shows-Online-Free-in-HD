import React from 'react';
import { Calendar, Clock, Play } from 'lucide-react';
import type { AnimeMedia } from '../../types/media';
import type { AniListScheduleItem } from '../../services/anilist';

interface AnimeScheduleSectionProps {
  items: AniListScheduleItem[];
  loading?: boolean;
  onSelect: (anime: AnimeMedia) => void;
  onWatch: (anime: AnimeMedia, episode: number) => void;
}

function formatAiringCountdown(airingAtSec: number): string {
  const diffSec = airingAtSec - Math.floor(Date.now() / 1000);
  if (diffSec <= 0) {
    return 'Aired recently';
  }
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `In ${days}d ${hours}h`;
  if (hours > 0) return `In ${hours}h ${mins}m`;
  return `In ${Math.max(1, mins)}m`;
}

export const AnimeScheduleSection: React.FC<AnimeScheduleSectionProps> = ({
  items,
  loading = false,
  onSelect,
  onWatch
}) => {
  if (!loading && items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#F5C400]" />
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Airing Schedule &amp; New Episodes
          </h2>
          <span className="text-xs text-[#A6A6AC] hidden sm:inline">· Real-time AniList Airing Times</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[#29292D] border border-[#3A3A40] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.slice(0, 12).map((entry) => {
            const anime = entry.media;
            const targetEp = Math.max(1, entry.episode);
            const isReleased = entry.airingAt * 1000 <= Date.now();
            return (
              <div
                key={`${anime.anilistId}-${targetEp}`}
                onClick={() => onSelect(anime)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(anime);
                  }
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#1b1b20] hover:bg-[#23232a] border border-[#34343c] hover:border-[#F5C400]/50 transition-colors cursor-pointer group"
              >
                {anime.coverImage ? (
                  <img
                    src={anime.coverImage}
                    alt={anime.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-20 rounded-lg object-cover shrink-0 bg-[#141418] border border-white/10"
                  />
                ) : (
                  <div className="w-14 h-20 rounded-lg bg-[#141418] shrink-0" />
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-bold tabular-nums">
                    <span className="text-[#F5C400]">Episode {targetEp}</span>
                    <span className="text-[#A6A6AC] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatAiringCountdown(entry.airingAt)}
                    </span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#F5C400] truncate transition-colors">
                    {anime.title}
                  </h3>
                  <div className="text-[11px] text-[#9A9AA2] truncate">
                    {new Date(entry.airingAt * 1000).toLocaleString(undefined, {
                      weekday: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {anime.genres[0] ? ` · ${anime.genres[0]}` : ''}
                  </div>
                </div>

                {isReleased && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWatch(anime, targetEp);
                    }}
                    aria-label={`Watch Episode ${targetEp}`}
                    className="w-9 h-9 rounded-full bg-[#F5C400] hover:bg-[#ffcf14] text-black flex items-center justify-center shrink-0 cursor-pointer shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
