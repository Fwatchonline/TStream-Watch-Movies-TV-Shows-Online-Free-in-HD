import React from 'react';
import { Layers, Calendar, Star, ChevronRight } from 'lucide-react';
import { CollectionSummary, MediaItem } from '../types/media';

interface CollectionSectionProps {
  collection: CollectionSummary;
  currentMediaId: number;
  onSelectMedia: (item: MediaItem) => void;
}

export const CollectionSection: React.FC<CollectionSectionProps> = ({
  collection,
  currentMediaId,
  onSelectMedia
}) => {
  if (!collection || !collection.parts || collection.parts.length === 0) return null;

  return (
    <div className="my-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Franchise Banner Frame */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#141418] p-6 sm:p-8">
        {/* Backdrop Glow */}
        {collection.backdropPath && (
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
            <img
              src={collection.backdropPath}
              alt={collection.name}
              className="w-full h-full object-cover filter blur-sm"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141418] via-[#141418]/90 to-transparent" />
          </div>
        )}

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-500 mb-1">
            <Layers className="w-4 h-4" />
            <span>Belongs to Franchise</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
            {collection.name}
          </h2>

          {collection.overview && (
            <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {collection.overview}
            </p>
          )}

          {/* Franchise Movies Cards */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {collection.parts.map(part => {
              const isCurrent = part.id === currentMediaId;
              const year = part.releaseDate ? new Date(part.releaseDate).getFullYear() : '—';

              return (
                <div
                  key={part.id}
                  onClick={() => onSelectMedia(part)}
                  className={`group cursor-pointer rounded-xl overflow-hidden border transition-all duration-200 ${
                    isCurrent
                      ? 'border-[#F5C400] bg-[#303035] shadow-lg shadow-black/40 ring-1 ring-[#F5C400]'
                      : 'border-[#3A3A40] bg-[#303035] hover:border-[#F5C400]/60 hover:-translate-y-1'
                  }`}
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#29292D]">
                    {part.posterPath ? (
                      <img
                        src={part.posterPath}
                        alt={part.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-4 text-center text-xs text-[#A6A6AC]">
                        {part.title}
                      </div>
                    )}

                    {isCurrent && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#F5C400] text-black text-[10px] font-black uppercase tracking-wider shadow">
                        Now Viewing
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#F5C400] line-clamp-1">
                      {part.title}
                    </h3>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 font-medium">
                      <span>{year}</span>
                      {part.voteAverage > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-400 tabular-nums">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {part.voteAverage.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
