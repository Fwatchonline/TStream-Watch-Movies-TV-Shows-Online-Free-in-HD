import React, { useState } from 'react';
import { Play, Star, Plus, Check } from 'lucide-react';
import type { AnimeMedia } from '../../types/media';
import { animeMediaToMediaItem } from '../../services/animeCatalog';
import { isInWatchlist, toggleWatchlist } from '../../services/storage';

interface AnimeCardProps {
  anime: AnimeMedia;
  onSelect: (anime: AnimeMedia) => void;
  onWatch: (anime: AnimeMedia, episode?: number) => void;
  episodeBadge?: number;
}

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  onSelect,
  onWatch,
  episodeBadge
}) => {
  const [inWatchlist, setInWatchlist] = useState<boolean>(() => isInWatchlist(anime.anilistId));
  const [imgFailed, setImgFailed] = useState(false);

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggleWatchlist(animeMediaToMediaItem(anime));
    setInWatchlist(added);
  };

  const score = anime.voteAverage && anime.voteAverage > 0 ? anime.voteAverage.toFixed(1) : null;
  const formatLabel = anime.format ? anime.format.replace(/_/g, ' ') : 'TV';
  const epLabel =
    anime.format === 'MOVIE'
      ? anime.durationMinutes
        ? `${anime.durationMinutes}m`
        : 'Movie'
      : episodeBadge
      ? `Ep ${episodeBadge}`
      : anime.nextAiringEpisode
      ? `Ep ${Math.max(1, anime.nextAiringEpisode.episode - 1)}/${anime.episodesCount || '?'}`
      : anime.episodesCount
      ? `${anime.episodesCount} eps`
      : null;

  return (
    <div
      onClick={() => onSelect(anime)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(anime);
        }
      }}
      className="group relative flex flex-col bg-[#1b1b20] hover:bg-[#23232a] rounded-xl overflow-hidden transition-all duration-300 cursor-pointer shadow-lg shadow-black/40 border border-[#34343c] hover:border-[#F5C400]/60 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C400]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#141418]">
        {anime.coverImage && !imgFailed ? (
          <img
            src={anime.coverImage}
            alt={anime.title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs font-bold text-[#8E8E93] bg-[#141418]">
            {anime.title}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

        {score && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[11px] font-bold text-white border border-white/10 tabular-nums">
            <Star className="w-3 h-3 fill-[#F5C400] text-[#F5C400]" />
            <span>{score}</span>
          </div>
        )}

        {episodeBadge && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#F5C400] text-black text-[10px] font-black uppercase tracking-wider tabular-nums shadow">
            Ep {episodeBadge}
          </div>
        )}

        {/* Hover Action Controls */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-10 px-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWatch(anime, episodeBadge || 1);
            }}
            className="h-9 px-3 rounded-full bg-[#F5C400] hover:bg-[#ffcf14] text-black text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer transition-transform hover:scale-105"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>Watch</span>
          </button>

          <button
            type="button"
            onClick={handleToggleWatchlist}
            aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all cursor-pointer border ${
              inWatchlist
                ? 'bg-emerald-500 text-black border-emerald-400'
                : 'bg-black/70 text-white border-white/25 hover:bg-black hover:border-[#F5C400]'
            }`}
          >
            {inWatchlist ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-medium text-[#D1D1D6] tabular-nums pointer-events-none">
          <span className="truncate uppercase tracking-wider text-[#F5C400] font-bold">{formatLabel}</span>
          {epLabel && <span className="text-white/90 font-semibold">{epLabel}</span>}
        </div>
      </div>

      <div className="p-2.5 flex flex-col gap-0.5 flex-grow justify-between">
        <h3 className="text-xs sm:text-[13px] font-bold text-[#F3F3F3] group-hover:text-[#F5C400] line-clamp-2 leading-snug transition-colors">
          {anime.title}
        </h3>
        <div className="text-[11px] text-[#9A9AA2] flex items-center gap-1.5 truncate tabular-nums">
          {anime.seasonYear && <span>{anime.seasonYear}</span>}
          {anime.seasonYear && anime.genres[0] && <span>·</span>}
          {anime.genres[0] && <span className="truncate">{anime.genres[0]}</span>}
        </div>
      </div>
    </div>
  );
};
