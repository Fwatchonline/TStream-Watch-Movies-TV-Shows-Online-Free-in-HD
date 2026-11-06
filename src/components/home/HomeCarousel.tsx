import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';

interface HomeCarouselProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  badge?: string;
  badgeColor?: string;
  subtitle?: string;
  viewAllLink?: {
    label?: string;
    onClick: () => void;
  };
  children: React.ReactNode;
  className?: string;
}

export const HomeCarousel: React.FC<HomeCarouselProps> = ({
  title,
  icon: Icon,
  iconColor = 'text-[#F5C400]',
  badge,
  badgeColor = 'bg-[#F5C400]/20 text-[#F5C400] border-[#F5C400]/40',
  subtitle,
  viewAllLink,
  children,
  className = ''
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <section className={`space-y-3 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={`w-4 h-4 ${iconColor} shrink-0`} />}
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {title}
            </h2>
          </div>

          {badge && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
              {badge}
            </span>
          )}

          {subtitle && (
            <span className="text-xs text-[#A6A6AC] font-normal hidden sm:inline">
              · {subtitle}
            </span>
          )}
        </div>

        {/* Right Controls: View All + Arrows */}
        <div className="flex items-center gap-2">
          {viewAllLink && (
            <button
              onClick={viewAllLink.onClick}
              className="text-xs font-semibold text-[#A6A6AC] hover:text-[#F5C400] transition-colors flex items-center gap-1 cursor-pointer mr-1"
            >
              <span>{viewAllLink.label || 'View All'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="w-7 h-7 rounded bg-[#29292D] hover:bg-[#303035] hover:text-[#F5C400] border border-[#3A3A40] text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
              aria-label={`Scroll ${title} left`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-7 h-7 rounded bg-[#29292D] hover:bg-[#303035] hover:text-[#F5C400] border border-[#3A3A40] text-white flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
              aria-label={`Scroll ${title} right`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Track with Mobile Snap & Edge-to-Edge Bleed */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory touch-pan-x -mx-3 sm:mx-0 px-3 sm:px-0 pb-2 pt-0.5"
      >
        {children}
      </div>
    </section>
  );
};
