import React, { useState, useEffect } from 'react';
import { ChevronRight, Tv } from 'lucide-react';
import { PLATFORMS_LIST, PlatformInfo } from '../../services/platformData';
import { fetchCatalog } from '../../services/tmdb';
import { MediaItem } from '../../types/media';
import { MediaCard } from '../MediaCard';
import { HomeCarousel } from './HomeCarousel';

interface PlatformSectionProps {
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem) => void;
  onNavigate: (view: string, extraParams?: any) => void;
}

export const PlatformSection: React.FC<PlatformSectionProps> = ({
  onSelectMedia,
  onWatchMedia,
  onNavigate
}) => {
  // We feature the top global streaming platforms
  const featuredPlatforms = PLATFORMS_LIST.filter(p =>
    ['netflix', 'disney', 'hbo', 'apple', 'amazon', 'paramount', 'hulu'].includes(p.id)
  );

  const [activePlatformId, setActivePlatformId] = useState<string>('netflix');
  const [platformItems, setPlatformItems] = useState<Record<string, MediaItem[]>>({});
  const [loading, setLoading] = useState<boolean>(false);

  const currentPlatform = featuredPlatforms.find(p => p.id === activePlatformId) || featuredPlatforms[0];

  useEffect(() => {
    let isMounted = true;

    // If already loaded in memory cache, avoid refetching
    if (platformItems[activePlatformId] && platformItems[activePlatformId].length > 0) {
      return;
    }

    async function loadPlatformItems() {
      setLoading(true);
      try {
        const res = await fetchCatalog('platform', 1, {
          platform: activePlatformId,
          sortBy: 'popularity.desc'
        });

        if (isMounted) {
          setPlatformItems(prev => ({
            ...prev,
            [activePlatformId]: res.results.slice(0, 16)
          }));
        }
      } catch (err) {
        console.warn(`Failed loading items for platform ${activePlatformId}:`, err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPlatformItems();
    return () => { isMounted = false; };
  }, [activePlatformId, platformItems]);

  const items = platformItems[activePlatformId] || [];

  return (
    <div className="space-y-4">
      {/* Platform Selector Strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-[#F5C400]" />
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Streaming Platforms
          </h2>
          <span className="text-xs text-[#A6A6AC] font-normal hidden sm:inline">
            · Originals & Exclusives
          </span>
        </div>

        <button
          onClick={() => onNavigate('platform', { platform: activePlatformId })}
          className="text-xs font-semibold text-[#A6A6AC] hover:text-[#F5C400] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Explore all on {currentPlatform.name}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Platform Tabs with Logos (Horizontal touch swipe on mobile, grid on tablet/desktop) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory touch-pan-x -mx-3 sm:mx-0 px-3 sm:px-0 sm:grid sm:grid-cols-4 md:grid-cols-7 pb-1">
        {featuredPlatforms.map(p => {
          const isActive = p.id === activePlatformId;
          return (
            <button
              key={p.id}
              onClick={() => setActivePlatformId(p.id)}
              className={`shrink-0 snap-start min-w-[92px] sm:min-w-0 p-2 sm:p-2.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center relative select-none ${
                isActive
                  ? 'bg-[#303038] border-[#F5C400] shadow-lg shadow-amber-500/10 ring-1 ring-[#F5C400]'
                  : 'bg-[#29292D] border-[#3A3A40] hover:border-white/30 hover:bg-[#303035]'
              }`}
            >
              {/* Logo Area */}
              <div className="h-6 sm:h-7 flex items-center justify-center">
                {p.renderLogo('sm')}
              </div>

              {/* Platform Name */}
              <span className={`text-[10px] font-bold mt-1.5 truncate ${isActive ? 'text-[#F5C400]' : 'text-[#A6A6AC]'}`}>
                {p.name}
              </span>

              {/* Active Pip */}
              {isActive && (
                <div className="absolute -bottom-1 w-6 h-0.5 rounded-full bg-[#F5C400]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Carousel of Titles for Active Platform */}
      <HomeCarousel
        title={`Top on ${currentPlatform.name}`}
        subtitle={currentPlatform.tagline}
        viewAllLink={{
          label: `All ${currentPlatform.name}`,
          onClick: () => onNavigate('platform', { platform: currentPlatform.id })
        }}
      >
        {loading && items.length === 0 ? (
          // Skeleton Cards
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 snap-start w-[135px] sm:w-[165px] aspect-[2/3] rounded-xl bg-[#29292D] animate-pulse border border-[#3A3A40]"
            />
          ))
        ) : (
          items.map(item => (
            <div key={item.id || item.tmdbId} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
              <MediaCard
                item={item}
                onSelect={onSelectMedia}
                onWatch={onWatchMedia}
              />
            </div>
          ))
        )}
      </HomeCarousel>
    </div>
  );
};
