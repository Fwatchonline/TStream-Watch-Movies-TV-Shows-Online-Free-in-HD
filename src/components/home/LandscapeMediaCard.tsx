import React from 'react';
import { Play, Star, Calendar } from 'lucide-react';
import { MediaItem } from '../../types/media';
import { QualityBadge } from '../QualityBadge';

interface LandscapeMediaCardProps {
  item: MediaItem;
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia?: (item: MediaItem) => void;
  badge?: string;
}

export const LandscapeMediaCard: React.FC<LandscapeMediaCardProps> = ({
  item,
  onSelectMedia,
  onWatchMedia,
  badge
}) => {
  const isMovie = item.mediaType === 'movie';
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '2026';
  const genreName = item.genres?.[0]?.name || (isMovie ? 'Cinema' : 'Series');

  const handleWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onWatchMedia) onWatchMedia(item);
    else onSelectMedia(item);
  };

  return (
    <div
      onClick={() => onSelectMedia(item)}
      className="shrink-0 snap-start w-[230px] sm:w-[260px] group cursor-pointer flex flex-col rounded-xl overflow-hidden bg-[#29292D] border border-[#3A3A40] hover:border-[#F5C400] transition-all duration-200 select-none hover:-translate-y-1 shadow-md hover:shadow-xl"
    >
      {/* 16:9 Backdrop Image */}
      <div className="relative aspect-video w-full bg-[#1b1b20] overflow-hidden">
        <img
          src={item.backdropPath || item.posterPath}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {badge ? (
            <span className="px-2 py-0.5 rounded bg-[#F5C400] text-black font-extrabold text-[9px] uppercase tracking-wider shadow">
              {badge}
            </span>
          ) : (
            <QualityBadge item={item} variant="card" />
          )}
        </div>

        {/* Rating Badge Top Right */}
        {item.voteAverage > 0 && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs border border-white/10 flex items-center gap-1 text-[10px] font-bold text-[#F5C400]">
            <Star className="w-2.5 h-2.5 fill-[#F5C400] text-[#F5C400]" />
            <span>{item.voteAverage.toFixed(1)}</span>
          </div>
        )}

        {/* Hover Play Button */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center backdrop-blur-[1px]">
          <button
            onClick={handleWatch}
            className="w-10 h-10 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform cursor-pointer"
            title="Watch Now"
          >
            <Play className="w-4 h-4 fill-black text-black ml-0.5" />
          </button>
        </div>

        {/* Bottom Metadata bar */}
        <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-between text-[10px] pointer-events-none">
          <span className="text-[#A6A6AC] font-medium">
            {genreName}
          </span>
          <span className="text-slate-300 font-semibold">
            {year}
          </span>
        </div>
      </div>

      {/* Card Info Body */}
      <div className="p-3">
        <h4
          className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors truncate leading-tight"
          title={item.title}
        >
          {item.title}
        </h4>
        <p className="text-[10px] text-[#A6A6AC] line-clamp-1 mt-1">
          {item.overview || 'Stream full high definition video online.'}
        </p>
      </div>
    </div>
  );
};
