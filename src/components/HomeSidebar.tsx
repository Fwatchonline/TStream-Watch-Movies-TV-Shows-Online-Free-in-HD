import React, { useState } from 'react';
import {
  Home,
  Film,
  Tv,
  Flame,
  Star,
  Compass,
  ChevronDown,
  ChevronRight,
  X,
  Layers,
  Sparkles,
  Users,
  Shuffle,
  Bookmark,
  User as UserIcon,
  LogOut,
  Sliders,
  PlaySquare,
  Clock,
  TrendingUp,
  Award,
  Video,
  Clapperboard,
  Heart,
  Calendar,
  Search
} from 'lucide-react';
import { ALL_GENRES } from '../services/catalogData';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../utils/admin';
import { TStreamLogo } from './TStreamLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { PLATFORMS_LIST } from '../services/platformData';

interface HomeSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string, extraParams?: any) => void;
  onSelectGenre?: (genreId: number, genreName: string) => void;
  onSelectPlatform?: (platformId: string) => void;
  selectedPlatform?: string;
  selectedGenreId?: number | null;
  currentView?: string;
}

export const HomeSidebar: React.FC<HomeSidebarProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectGenre,
  onSelectPlatform,
  selectedPlatform,
  selectedGenreId,
  currentView = 'home'
}) => {
  const { user, profile, watchlist, continueWatching, openAuthModal, logout } = useAuth();
  const isAdmin = isAdminUser(user?.email);

  // Accordion open states
  const [openSection, setOpenSection] = useState<string | null>('movies');
  const [searchMobileQuery, setSearchMobileQuery] = useState('');

  const toggleSection = (section: string) => {
    setOpenSection(prev => (prev === section ? null : section));
  };

  const handleMobileSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchMobileQuery.trim()) {
      onNavigate('search', { query: searchMobileQuery.trim() });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-out Drawer Panel */}
      <aside
        className="fixed top-0 left-0 bottom-0 z-50 w-80 max-w-[85vw] bg-[#1e1e24] border-r border-[#3A3A40] shadow-2xl flex flex-col justify-between select-none animate-in slide-in-from-left duration-250 ring-1 ring-white/10"
      >
        {/* Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#3A3A40] bg-[#23232a]">
          <button
            type="button"
            onClick={() => {
              onNavigate('home');
              onClose();
            }}
            className="flex items-center focus:outline-none cursor-pointer"
            aria-label="TStream Home"
          >
            <TStreamLogo size="sm" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A6A6AC] hover:text-white hover:bg-[#303038] transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-3 px-3 space-y-3">
          {/* Mobile Quick Search Input */}
          <form onSubmit={handleMobileSearchSubmit} className="relative w-full">
            <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search movies, TV shows..."
              value={searchMobileQuery}
              onChange={(e) => setSearchMobileQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#141418] border border-[#3A3A40] text-xs text-white placeholder:text-[#8E8E93] focus:outline-none focus:border-[#F5C400]"
            />
          </form>

          {/* User Profile Card */}
          <div className="p-3 rounded-2xl bg-[#25252e] border border-[#3A3A40]">
            {user ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      className="w-9 h-9 rounded-xl object-cover border border-[#F5C400]"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-[#F5C400] text-black font-black text-sm flex items-center justify-center shrink-0">
                      {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {profile?.displayName || user.displayName || 'VIP Streamer'}
                    </p>
                    <p className="text-[10px] text-[#8E8E93] truncate">{user.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openAuthModal('watchlist');
                    }}
                    className="py-1.5 px-2 rounded-xl bg-[#30303a] hover:bg-[#F5C400] hover:text-black text-[11px] font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#F5C400]" />
                    <span>Watchlist ({watchlist.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openAuthModal('profile');
                    }}
                    className="py-1.5 px-2 rounded-xl bg-[#30303a] hover:bg-[#F5C400] hover:text-black text-[11px] font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-[#F5C400]" />
                    <span>Profile</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>Sign In for Watchlist</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#F5C400]" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthModal('login');
                  }}
                  className="w-full py-2 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-bold text-xs flex items-center justify-center transition-all cursor-pointer shadow-sm"
                >
                  Sign In / Register
                </button>
              </div>
            )}
          </div>

          {/* Quick Direct Buttons */}
          <div className="space-y-1">
            {/* Home */}
            <button
              type="button"
              onClick={() => {
                onNavigate('home');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'home'
                  ? 'bg-[#F5C400] text-black shadow-sm'
                  : 'text-[#E5E5EA] hover:text-white hover:bg-[#282830]'
              }`}
            >
              <Home className={`w-4 h-4 ${currentView === 'home' ? 'text-black' : 'text-[#F5C400]'}`} />
              <span>Home</span>
            </button>

            {/* New Episodes (Direct with badge) */}
            <button
              type="button"
              onClick={() => {
                onNavigate('new-episodes');
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'new-episodes'
                  ? 'bg-[#F5C400] text-black shadow-sm'
                  : 'text-[#E5E5EA] hover:text-white hover:bg-[#282830]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className={`w-4 h-4 ${currentView === 'new-episodes' ? 'text-black' : 'text-rose-500'}`} />
                <span>New Episodes</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase">
                NEW
              </span>
            </button>

            {/* Random */}
            <button
              type="button"
              onClick={() => {
                onNavigate('random');
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentView === 'random'
                  ? 'bg-[#F5C400] text-black shadow-sm'
                  : 'text-[#E5E5EA] hover:text-white hover:bg-[#282830]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Shuffle className={`w-4 h-4 ${currentView === 'random' ? 'text-black' : 'text-[#F5C400]'}`} />
                <span>Random Picker</span>
              </div>
              <span className="px-1.5 py-0.2 rounded bg-[#F5C400]/20 text-[#F5C400] text-[9px] font-black uppercase">
                Spin
              </span>
            </button>
          </div>

          <div className="w-full h-px bg-white/5 my-2" />

          {/* Accordion 1: Movies */}
          <div className="border border-[#3A3A40]/70 rounded-xl overflow-hidden bg-[#222228]">
            <button
              type="button"
              onClick={() => toggleSection('movies')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Film className="w-4 h-4 text-[#F5C400]" />
                <span>Movies</span>
              </div>
              {openSection === 'movies' ? (
                <ChevronDown className="w-4 h-4 text-[#F5C400]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
              )}
            </button>

            {openSection === 'movies' && (
              <div className="p-2 space-y-1 bg-[#1a1a20] border-t border-white/5 text-xs">
                {[
                  { label: 'Discover Movies', action: () => onNavigate('movies') },
                  { label: 'Popular Movies', action: () => onNavigate('movies', { sortBy: 'popularity.desc' }) },
                  { label: 'Now Playing', action: () => onNavigate('movies', { sortBy: 'primary_release_date.desc' }) },
                  { label: 'Top Rated', action: () => onNavigate('movies', { sortBy: 'vote_average.desc', minRating: 7.5 }) },
                  { label: 'Upcoming Movies', action: () => onNavigate('movies', { sortBy: 'popularity.desc', year: 2026 }) },
                  { label: 'Latest Movies', action: () => onNavigate('movies', { sortBy: 'primary_release_date.desc' }) }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-slate-300 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Accordion 2: TV Series */}
          <div className="border border-[#3A3A40]/70 rounded-xl overflow-hidden bg-[#222228]">
            <button
              type="button"
              onClick={() => toggleSection('tv')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Tv className="w-4 h-4 text-[#F5C400]" />
                <span>TV Series</span>
              </div>
              {openSection === 'tv' ? (
                <ChevronDown className="w-4 h-4 text-[#F5C400]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
              )}
            </button>

            {openSection === 'tv' && (
              <div className="p-2 space-y-1 bg-[#1a1a20] border-t border-white/5 text-xs">
                {[
                  { label: 'Discover TV Shows', action: () => onNavigate('tv-shows') },
                  { label: 'Popular TV Shows', action: () => onNavigate('tv-shows', { sortBy: 'popularity.desc' }) },
                  { label: 'Top Rated TV Shows', action: () => onNavigate('tv-shows', { sortBy: 'vote_average.desc', minRating: 7.5 }) },
                  { label: 'Currently Airing', action: () => onNavigate('tv-shows', { sortBy: 'primary_release_date.desc' }) },
                  { label: 'Latest TV Shows', action: () => onNavigate('tv-shows', { sortBy: 'primary_release_date.desc' }) }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-slate-300 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Accordion 3: Genres Multi-Column Grid */}
          <div className="border border-[#3A3A40]/70 rounded-xl overflow-hidden bg-[#222228]">
            <button
              type="button"
              onClick={() => toggleSection('genres')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-[#F5C400]" />
                <span>Genres ({ALL_GENRES.length})</span>
              </div>
              {openSection === 'genres' ? (
                <ChevronDown className="w-4 h-4 text-[#F5C400]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
              )}
            </button>

            {openSection === 'genres' && (
              <div className="p-2 bg-[#1a1a20] border-t border-white/5">
                <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto no-scrollbar">
                  {ALL_GENRES.map((g) => {
                    const isSelected = selectedGenreId === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          if (onSelectGenre) onSelectGenre(g.id, g.name);
                          else onNavigate('movies', { genreId: g.id });
                          onClose();
                        }}
                        className={`text-left text-xs px-2.5 py-1.5 rounded-lg font-medium truncate transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5C400] text-black font-bold'
                            : 'text-slate-300 hover:text-black hover:bg-[#F5C400]'
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Accordion 4: Popular / Trending */}
          <div className="border border-[#3A3A40]/70 rounded-xl overflow-hidden bg-[#222228]">
            <button
              type="button"
              onClick={() => toggleSection('popular')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-[#F5C400]" />
                <span>Popular &amp; Trending</span>
              </div>
              {openSection === 'popular' ? (
                <ChevronDown className="w-4 h-4 text-[#F5C400]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
              )}
            </button>

            {openSection === 'popular' && (
              <div className="p-2 space-y-1 bg-[#1a1a20] border-t border-white/5 text-xs">
                {[
                  { label: 'Trending Today', action: () => onNavigate('trending') },
                  { label: 'Trending This Week', action: () => onNavigate('trending', { timeWindow: 'week' }) },
                  { label: 'Popular Movies', action: () => onNavigate('movies', { sortBy: 'popularity.desc' }) },
                  { label: 'Popular TV Shows', action: () => onNavigate('tv-shows', { sortBy: 'popularity.desc' }) },
                  { label: 'Highest Rated', action: () => onNavigate('top-rated') }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-slate-300 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Accordion 5: Collections */}
          <div className="border border-[#3A3A40]/70 rounded-xl overflow-hidden bg-[#222228]">
            <button
              type="button"
              onClick={() => toggleSection('collections')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-[#F5C400]" />
                <span>Collections &amp; Sagas</span>
              </div>
              {openSection === 'collections' ? (
                <ChevronDown className="w-4 h-4 text-[#F5C400]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
              )}
            </button>

            {openSection === 'collections' && (
              <div className="p-2 space-y-1 bg-[#1a1a20] border-t border-white/5 text-xs">
                {[
                  { label: 'Browse All Collections', action: () => onNavigate('collections') },
                  { label: 'Marvel Universe (MCU)', action: () => onNavigate('collections', { collectionId: 86311 }) },
                  { label: 'DC Universe & Batman', action: () => onNavigate('collections', { collectionId: 263 }) },
                  { label: 'Harry Potter Saga', action: () => onNavigate('collections', { collectionId: 1241 }) },
                  { label: 'Star Wars Saga', action: () => onNavigate('collections', { collectionId: 10 }) },
                  { label: 'Fast & Furious', action: () => onNavigate('collections', { collectionId: 9485 }) },
                  { label: 'Lord of the Rings', action: () => onNavigate('collections', { collectionId: 119 }) }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-slate-300 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Accordion 6: People */}
          <div className="border border-[#3A3A40]/70 rounded-xl overflow-hidden bg-[#222228]">
            <button
              type="button"
              onClick={() => toggleSection('people')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-[#F5C400]" />
                <span>People &amp; Directors</span>
              </div>
              {openSection === 'people' ? (
                <ChevronDown className="w-4 h-4 text-[#F5C400]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
              )}
            </button>

            {openSection === 'people' && (
              <div className="p-2 space-y-1 bg-[#1a1a20] border-t border-white/5 text-xs">
                {[
                  { label: 'Popular Actors', action: () => onNavigate('people', { filter: 'actors' }) },
                  { label: 'Popular Actresses', action: () => onNavigate('people', { filter: 'actresses' }) },
                  { label: 'Popular Directors', action: () => onNavigate('people', { filter: 'directors' }) },
                  { label: 'Browse All Cast', action: () => onNavigate('people') }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-slate-300 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Accordion 7: Streaming Platforms */}
          <div className="border border-[#3A3A40]/70 rounded-xl overflow-hidden bg-[#222228]">
            <button
              type="button"
              onClick={() => toggleSection('platforms')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Video className="w-4 h-4 text-[#F5C400]" />
                <span>Streaming Platforms</span>
              </div>
              {openSection === 'platforms' ? (
                <ChevronDown className="w-4 h-4 text-[#F5C400]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#8E8E93]" />
              )}
            </button>

            {openSection === 'platforms' && (
              <div className="p-2 bg-[#1a1a20] border-t border-white/5">
                <div className="grid grid-cols-2 gap-1">
                  {PLATFORMS_LIST.map((platform) => {
                    const isSelected = selectedPlatform === platform.id;
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        onClick={() => {
                          if (onSelectPlatform) onSelectPlatform(platform.id);
                          else onNavigate('platform', { platform: platform.id });
                          onClose();
                        }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#F5C400] text-black font-bold'
                            : 'text-slate-300 hover:text-white hover:bg-[#282832]'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: platform.color }}
                        />
                        <span className="truncate">{platform.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Player & Server Settings (Registered Members Feature) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (user) {
                onNavigate('settings');
              } else {
                openAuthModal('login');
              }
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#282832] hover:bg-[#32323e] text-slate-200 text-xs font-bold border border-white/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-[#F5C400]" />
              <span>Player &amp; Server Settings</span>
            </div>
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#F5C400]/20 text-[#F5C400] font-mono">
              {user ? 'Cloud' : 'Members'}
            </span>
          </button>

          {/* Admin Panel button if admin */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                onNavigate('admin');
                onClose();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Admin Operations</span>
              </div>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300">
                Panel
              </span>
            </button>
          )}

          {/* PWA In-App Install */}
          <div className="pt-2">
            <PWAInstallButton variant="sidebar" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#3A3A40] bg-[#23232a] text-[11px] text-[#A6A6AC] flex items-center justify-between">
          <span className="font-semibold">TStream Online</span>
          <span className="text-[#F5C400] font-black">Ultra HD 4K</span>
        </div>
      </aside>
    </>
  );
};
