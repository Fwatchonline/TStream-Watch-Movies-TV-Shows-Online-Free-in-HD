import React from 'react';
import { User, Sparkles } from 'lucide-react';
import { CastMember } from '../types/media';

interface CastCarouselProps {
  cast: CastMember[];
  onSelectPerson?: (person: CastMember) => void;
  title?: string;
}

export const CastCarousel: React.FC<CastCarouselProps> = ({
  cast,
  onSelectPerson,
  title = 'Top Cast'
}) => {
  if (!cast || cast.length === 0) return null;

  return (
    <div className="my-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <span>{title}</span>
        </h2>
        <span className="text-xs text-[#A6A6AC] font-medium">
          {cast.length} Featured Artists · Click to view filmography
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
        {cast.map((person) => {
          return (
            <div
              key={person.id}
              onClick={() => onSelectPerson && onSelectPerson(person)}
              className="shrink-0 w-32 sm:w-36 flex flex-col items-center text-center group cursor-pointer"
            >
              {/* Headshot Portrait */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-[#1c1c24] border-2 border-white/10 group-hover:border-[#F5C400] transition-all duration-200 shadow-md group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(245,196,0,0.3)]">
                {person.profilePath ? (
                  <img
                    src={person.profilePath}
                    alt={person.name}
                    className="w-full h-full object-cover transition-transform duration-200"
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
                <span className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-[#F5C400] transition-colors line-clamp-1">
                  {person.name}
                </span>
                <span className="text-[11px] text-[#8E8E93] line-clamp-1 mt-0.5">
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
