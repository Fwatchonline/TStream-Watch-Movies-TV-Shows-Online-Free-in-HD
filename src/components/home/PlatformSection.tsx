import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, RefreshCw, Tv } from 'lucide-react';
import { PLATFORMS_LIST } from '../../services/platformData';
import { fetchCatalog } from '../../services/tmdb';
import { DEFAULT_WATCH_REGION, normalizeWatchRegion } from '../../services/platformConfig';
import { getUserSettings } from '../../services/storage';
import { KeyedFetchCoordinator } from '../../utils/retryState';
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
  // Feature the top global streaming platforms
  const featuredPlatforms = PLATFORMS_LIST.filter(p =>
    ['netflix', 'disney', 'max', 'hbo', 'apple', 'prime', 'amazon', 'paramount', 'hulu'].includes(p.id)
  );

  const [activePlatformId, setActivePlatformId] = useState<string>('netflix');
  const [platformItems, setPlatformItems] = useState<Record<string, MediaItem[]>>({});
  const [platformErrors, setPlatformErrors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [retryTick, setRetryTick] = useState<number>(0);

  const coordinatorRef = useRef<KeyedFetchCoordinator<MediaItem[]> | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = new KeyedFetchCoordinator<MediaItem[]>();
  }

  const activeWatchRegion = normalizeWatchRegion(
    typeof window !== 'undefined' ? getUserSettings()?.preferredWatchRegion : DEFAULT_WATCH_REGION
  );
  const activeKey = `${activePlatformId}:${activeWatchRegion}`;
  const currentPlatform = featuredPlatforms.find(p => p.id === activePlatformId) || featuredPlatforms[0];

  useEffect(() => {
    const coord = new KeyedFetchCoordinator<MediaItem[]>();
    coordinatorRef.current = coord;
    return () => {
      coord.destroy();
    };
  }, []);

  useEffect(() => {
    const coord = coordinatorRef.current;
    if (!coord) return;
    let isMounted = true;
    const key = `${activePlatformId}:${activeWatchRegion}`;
    coord.setActiveKey(key);

    if (coord.hasLoaded(key)) {
      const cached = coord.getCached(key) || [];
      setPlatformItems(prev => (prev[key] ? prev : { ...prev, [key]: cached }));
      setPlatformErrors(prev => ({ ...prev, [key]: null }));
      setLoading(false);
      return;
    }

    async function loadPlatformItems() {
      setLoading(true);
      setPlatformErrors(prev => ({ ...prev, [key]: null }));

      const outcome = await coord!.load(key, async () => {
        const res = await fetchCatalog(
          'platform',
          1,
          {
            platform: activePlatformId,
            sortBy: 'popularity.desc',
            watchRegion: activeWatchRegion
          },
          { throwOnError: true }
        );
        return (res.results || []).slice(0, 16);
      });

      if (!isMounted || outcome.aborted) return;

      if (outcome.ok && outcome.data) {
        setPlatformItems(prev => ({
          ...prev,
          [key]: outcome.data!
        }));
        if (!outcome.stale) {
          setPlatformErrors(prev => ({ ...prev, [key]: null }));
          setLoading(false);
        }
      } else if (!outcome.stale) {
        setPlatformErrors(prev => ({
          ...prev,
          [key]: outcome.error || `Unable to load ${currentPlatform.name} catalog right now.`
        }));
        setLoading(false);
      }
    }

    loadPlatformItems();
    return () => {
      isMounted = false;
    };
  }, [activePlatformId, activeWatchRegion, retryTick, currentPlatform.name]);

  const handleRetryPlatform = useCallback(() => {
    const coord = coordinatorRef.current;
    if (!coord || coord.isLoading(activeKey)) return;
    coord.clearError(activeKey);
    setPlatformErrors(prev => ({ ...prev, [activeKey]: null }));
    setRetryTick(t => t + 1);
  }, [activeKey]);

  const items = platformItems[activeKey] || [];
  const activeError = platformErrors[activeKey] || null;

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
            · {activeWatchRegion} Availability
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
        title={`Top on ${currentPlatform.name} (${activeWatchRegion})`}
        subtitle={currentPlatform.tagline}
        viewAllLink={{
          label: `All ${currentPlatform.name}`,
          onClick: () => onNavigate('platform', { platform: currentPlatform.id })
        }}
      >
        {loading && items.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 snap-start w-[135px] sm:w-[165px] aspect-[2/3] rounded-xl bg-[#29292D] animate-pulse border border-[#3A3A40]"
            />
          ))
        ) : activeError && items.length === 0 ? (
          <div className="w-full min-h-[180px] rounded-xl bg-[#29292D] border border-[#3A3A40] p-6 flex flex-col items-center justify-center text-center gap-3">
            <p className="text-xs sm:text-sm text-[#A6A6AC] max-w-md">
              Unable to load {currentPlatform.name} titles right now.
            </p>
            <button
              type="button"
              onClick={handleRetryPlatform}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[#F5C400] hover:bg-[#e0b400] text-black text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="w-full min-h-[160px] rounded-xl bg-[#29292D] border border-[#3A3A40] p-6 flex flex-col items-center justify-center text-center">
            <p className="text-xs sm:text-sm text-[#A6A6AC]">
              No titles currently listed for {currentPlatform.name} in region {activeWatchRegion}.
            </p>
          </div>
        ) : (
          items.map(item => (
            <div key={`${item.mediaType}-${item.id || item.tmdbId}`} className="shrink-0 snap-start w-[135px] sm:w-[165px]">
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
