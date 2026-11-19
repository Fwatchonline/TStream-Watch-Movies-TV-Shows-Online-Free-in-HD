import React from 'react';
import {
  Home,
  Film,
  Tv,
  Sparkles,
  Bookmark,
  User,
  Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string, extraParams?: any) => void;
  onOpenSearch?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenSearch
}) => {
  const { user, watchlist, openAuthModal } = useAuth();

  // If user is currently watching video in theater or full immersion mode, don't obstruct controls
  const isWatching = currentView === 'watch';

  const navItems: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeCount?: number;
    action: () => void;
    isActive: boolean;
  }> = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      action: () => onNavigate('home'),
      isActive: currentView === 'home'
    },
    {
      id: 'movies',
      label: 'Movies',
      icon: Film,
      action: () => onNavigate('movies'),
      isActive: currentView === 'movies'
    },
    {
      id: 'tv-shows',
      label: 'Series',
      icon: Tv,
      action: () => onNavigate('tv-shows'),
      isActive: currentView === 'tv-shows'
    },
    {
      id: 'anime',
      label: 'Anime',
      icon: Sparkles,
      action: () => onNavigate('anime', { section: 'discover' }),
      isActive: currentView === 'anime' || currentView === 'anime-details'
    },
    {
      id: 'library',
      label: user ? 'Watchlist' : 'Sign In',
      icon: user ? Bookmark : User,
      badgeCount: user ? watchlist.length : undefined,
      action: () => {
        if (user) {
          openAuthModal('watchlist');
        } else {
          openAuthModal('login');
        }
      },
      isActive: false
    }
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#16161a]/95 backdrop-blur-xl border-t border-[#3A3A40]/80 transition-transform duration-300 select-none ${
        isWatching ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-15 px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`relative flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer group active:scale-95 ${
                active ? 'text-[#F5C400]' : 'text-[#8E8E93] hover:text-[#E5E5EA]'
              }`}
            >
              {/* Icon Container with subtle glow when active */}
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    active ? 'scale-110 stroke-[2.5]' : 'stroke-2'
                  }`}
                />

                {/* Badge for NEW or Item Count */}
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-red-600 text-[8px] font-black text-white leading-none shadow">
                    {item.badge}
                  </span>
                )}

                {item.badgeCount != null && item.badgeCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-[#F5C400] text-black text-[9px] font-black flex items-center justify-center shadow">
                    {item.badgeCount > 9 ? '9+' : item.badgeCount}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] font-bold tracking-tight mt-1 transition-colors ${
                  active ? 'text-[#F5C400] font-extrabold' : 'text-[#8E8E93]'
                }`}
              >
                {item.label}
              </span>

              {/* Active Indicator Bar */}
              {active && (
                <span className="absolute top-0 w-8 h-0.5 rounded-full bg-[#F5C400] shadow-[0_0_8px_#F5C400]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
