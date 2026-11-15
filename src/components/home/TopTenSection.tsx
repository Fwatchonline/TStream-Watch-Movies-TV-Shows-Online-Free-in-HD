import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Flame } from 'lucide-react';
import { MediaItem } from '../../types/media';
import { QualityBadge } from '../QualityBadge';
import { buildImageProxyUrl, isProxiedImagePath, resolveSafeImageSrc } from '../../utils/imageUrl';

interface TopTenSectionProps {
  items: MediaItem[];
  title?: string;
  subtitle?: string;
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia?: (item: MediaItem) => void;
}

export const TopTenSection: React.FC<TopTenSectionProps> = ({
  items,
  title = 'Top 10 Today',
  subtitle = 'Most streamed movies & shows right now',
  onSelectMedia,
  onWatchMedia
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollAmount = Math.max(container.clientWidth * 0.75, 320);
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#F5C400] shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {title}
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#F5C400]/20 text-[#F5C400] border border-[#F5C400]/40">
            Top 10
          </span>
          {subtitle && (
            <span className="text-xs text-[#A6A6AC] font-normal hidden sm:inline">
              · {subtitle}
            </span>
          )}
        </div>

        {/* Scroll Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            className="w-7 h-7 rounded bg-[#29292D] hover:bg-[#303035] hover:text-[#F5C400] border border-[#3A3A40] text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
            aria-label="Scroll Top 10 left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-7 h-7 rounded bg-[#29292D] hover:bg-[#303035] hover:text-[#F5C400] border border-[#3A3A40] text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
            aria-label="Scroll Top 10 right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top 10 Cards Track with Mobile Snap & Edge-to-Edge Bleed */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory touch-pan-x -mx-3 sm:mx-0 px-3 sm:px-0 pb-2 pt-0.5"
      >
        {items.slice(0, 10).map((item, idx) => {
          const rank = idx + 1;
          const rankStr = rank.toString().padStart(2, '0');
          const isMovie = item.mediaType === 'movie';
          const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '2026';

          return (
            <div
              key={item.id || item.tmdbId}
              onClick={() => onSelectMedia(item)}
              className="shrink-0 snap-start flex items-stretch gap-2.5 bg-[#29292D] hover:bg-[#303035] p-2 rounded-xl border border-[#3A3A40] hover:border-[#F5C400] transition-all duration-200 cursor-pointer shadow-md group select-none hover:-translate-y-1"
            >
              {/* Left Column: Vertical Title & Bold Ranking Number */}
              <div className="w-8 sm:w-9 flex flex-col justify-between items-center py-1 select-none shrink-0">
                <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
                  <span
                    className="text-xs font-bold text-[#F3F3F3] group-hover:text-[#F5C400] transition-colors truncate tracking-tight [writing-mode:vertical-rl] rotate-180 max-h-[140px] leading-tight block text-center"
                    title={item.title}
                  >
                    {item.title}
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black italic tracking-tighter text-[#F5C400] tabular-nums leading-none mt-2 drop-shadow-[0_2px_8px_rgba(245,196,0,0.3)]">
                  {rankStr}
                </div>
              </div>

              {/* Right Column: Poster with HD badge and Hover Play overlay */}
              <div className="relative aspect-[2/3] w-[125px] sm:w-[138px] rounded-lg overflow-hidden bg-[#232326] shrink-0 border border-[#3A3A40]/60">
                <img
                  src={resolveSafeImageSrc(item.posterPath || item.backdropPath)}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const currentSrc = img.getAttribute('src') || '';
                    if (item.posterPath && !isProxiedImagePath(currentSrc)) {
                      img.src = buildImageProxyUrl(item.posterPath);
                      return;
                    }
                    if (item.backdropPath && !currentSrc.includes(encodeURIComponent(item.backdropPath))) {
                      img.src = resolveSafeImageSrc(item.backdropPath);
                    }
                  }}
                />

                {/* Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />

                {/* Top Right Quality Badge */}
                <div className="absolute top-1.5 right-1.5">
                  <QualityBadge item={item} variant="card" />
                </div>

                {/* Bottom Metadata: Media Type and Rating */}
                <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-center justify-between text-[10px] pointer-events-none">
                  <span className="text-[#A6A6AC] font-semibold text-[9px] uppercase tracking-wider">
                    {year}
                  </span>
                  <span className="flex items-center gap-0.5 text-[#F5C400] font-bold text-[10px]">
                    ★ {item.voteAverage?.toFixed(1) || '8.0'}
                  </span>
                </div>

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onWatchMedia) onWatchMedia(item);
                      else onSelectMedia(item);
                    }}
                    className="w-10 h-10 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform cursor-pointer"
                    title="Watch Now"
                  >
                    <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
