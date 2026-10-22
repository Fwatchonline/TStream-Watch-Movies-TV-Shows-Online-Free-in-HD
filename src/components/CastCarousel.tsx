import React from 'react';
import { User } from 'lucide-react';
import { CastMember } from '../types/media';

interface CastCarouselProps {
  cast: CastMember[];
  onSelectPerson?: (person: CastMember) => void;
}

export const CastCarousel: React.FC<CastCarouselProps> = ({ cast, onSelectPerson }) => {
  if (!cast || cast.length === 0) return null;

  return (
    <div className="my-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Top Cast
        </h2>
        <span className="text-xs text-slate-400 font-medium">
          {cast.length} Featured Actors
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
        {cast.map(person => {
          return (
            <div
              key={person.id}
              onClick={() => onSelectPerson && onSelectPerson(person)}
              className="shrink-0 w-32 sm:w-36 flex flex-col items-center text-center group cursor-pointer"
            >
              {/* Headshot Portrait */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-[#1c1c24] border-2 border-white/10 group-hover:border-red-500 transition-all duration-200 shadow-md">
                {person.profilePath ? (
                  <img
                    src={person.profilePath}
                    alt={person.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-[#16161c] to-[#252532] text-slate-500">
                    <User className="w-10 h-10" />
                  </div>
                )}
              </div>

              {/* Name & Character */}
              <div className="mt-2.5 w-full">
                <span className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-red-400 transition-colors line-clamp-1">
                  {person.name}
                </span>
                <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                  {person.character || 'Cast'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
