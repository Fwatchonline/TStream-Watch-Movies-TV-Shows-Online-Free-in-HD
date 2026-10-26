import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  SlidersHorizontal,
  Search,
  Home,
  Flame,
  Shuffle,
  Film,
  Star,
  Tv,
  X,
  Check,
  Share2,
  User,
  Compass,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { ALL_GENRES } from '../services/catalogData';
import { fetchCatalog } from '../services/tmdb';
import { MediaItem } from '../types/media';
import { useAuth } from '../context/AuthContext';
import { TStreamLogo } from './TStreamLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface HomeHeaderProps {
  onToggleSidebar: () => void;
  onNavigate: (view: string, extraParams?: any) => void;
  onSearch: (query: string) => void;
  onSelectMedia?: (item: MediaItem) => void;
  onSelectGenre?: (genreId: number, genreName: string) => void;
  onSurpriseMe: () => void;
  onOpenFilter?: () => void;
  currentView?: string;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onToggleSidebar,
  onNavigate,
  onSearch,
  onSelectMedia,
  onSelectGenre,
  onSurpriseMe,
  onOpenFilter,
  currentView
}) => {
  const { user, profile, watchlist, openAuthModal } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Genres menu state
  const [genresDropdownOpen, setGenresDropdownOpen] = useState(false);

  // Live search state
  const [liveResults, setLiveResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [liveSearchOpen, setLiveSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Debounced live search
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setLiveResults([]);
      setIsSearching(false);
      setLiveSearchOpen(false);
      return;
    }

    setIsSearching(true);
    setLiveSearchOpen(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetchCatalog('search', 1, { query: q });
        setLiveResults(res.results.slice(0, 7));
      } catch (err) {
        console.warn('Live search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close live search & genres dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setLiveSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLiveSearchOpen(false);
      onSearch(searchQuery.trim());
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#29292D] border-b border-[#3A3A40] text-[#F3F3F3] select-none shadow-md">
        <div className="max-w-[1520px] mx-auto px-3 sm:px-5 lg:px-6 h-[60px] flex items-center justify-between gap-2 lg:gap-4">
          {/* Left: Hamburger & T Stream Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onToggleSidebar}
              className="p-1 rounded text-white hover:text-[#F5C400] transition-colors focus:outline-none cursor-pointer"
              aria-label="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* T Stream Logo */}
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center group focus:outline-none text-left cursor-pointer transition-transform hover:opacity-95"
              aria-label="T Stream Home"
            >
              <TStreamLogo size="md" />
            </button>
          </div>

          {/* Search bar with Live Search Dropdown */}
          <div ref={searchContainerRef} className="hidden sm:flex items-center max-w-xs md:max-w-sm lg:max-w-md w-full relative">
            <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
              <input
                type="text"
                placeholder="Live search movies, series..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setLiveSearchOpen(true);
                }}
                className="w-full h-8 pl-3 pr-22 rounded bg-[#232326] border border-[#3A3A40] text-xs text-white placeholder:text-[#A6A6AC] focus:outline-none focus:border-[#F5C400] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setLiveResults([]);
                    setLiveSearchOpen(false);
                  }}
                  className="absolute right-14 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenFilter ? onOpenFilter() : onNavigate('movies')}
                className="absolute right-1 h-6 px-2 rounded bg-[#303035] hover:bg-[#3A3A40] border border-[#3A3A40] text-[10px] font-semibold text-[#F3F3F3] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-2.5 h-2.5 text-[#F5C400]" />
                <span>Filter</span>
              </button>
            </form>

            {/* Live Search Floating Results Dropdown */}
            {liveSearchOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1c1c20] border border-[#3A3A40] rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl animate-in fade-in duration-150">
                <div className="px-3 py-1.5 bg-[#25252b] border-b border-white/5 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-[#F5C400]" />
                    <span>Live Search Results</span>
                  </div>
                  {isSearching && (
                    <span className="text-[10px] text-[#F5C400] font-mono animate-pulse">Searching...</span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                  {liveResults.length > 0 ? (
                    liveResults.map((item) => (
                      <div
                        key={`${item.mediaType}-${item.id}`}
                        onClick={() => {
                          setLiveSearchOpen(false);
                          if (onSelectMedia) {
                            onSelectMedia(item);
                          } else {
                            onNavigate(item.mediaType === 'movie' ? 'movie' : 'tv', { id: item.id });
                          }
                        }}
                        className="flex items-center gap-3 p-2 hover:bg-[#282830] transition-colors cursor-pointer group"
                      >
                        <div className="w-9 h-13 rounded bg-[#121215] shrink-0 overflow-hidden border border-white/10">
                          {item.posterPath ? (
                            <img
                              src={item.posterPath}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">
                              <Film className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors truncate">
                              {item.title}
                            </span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-slate-300 font-mono uppercase">
                              {item.mediaType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            {item.releaseDate && (
                              <span>{new Date(item.releaseDate).getFullYear() || item.releaseDate}</span>
                            )}
                            {item.voteAverage > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
                                ★ {item.voteAverage.toFixed(1)}
                              </span>
                            )}
                            {item.genres?.length > 0 && (
                              <span className="truncate opacity-75">
                                · {item.genres.slice(0, 2).map(g => g.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : !isSearching ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No titles found for &quot;{searchQuery}&quot;
                    </div>
                  ) : null}
                </div>

                {/* Footer view all link */}
                <button
                  onClick={() => {
                    setLiveSearchOpen(false);
                    onSearch(searchQuery.trim());
                  }}
                  className="w-full py-2 px-3 bg-[#232328] hover:bg-[#2b2b32] text-xs font-bold text-[#F5C400] flex items-center justify-center gap-1 transition-colors border-t border-white/5 cursor-pointer"
                >
                  <span>View all results for &quot;{searchQuery}&quot;</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Center-Right Nav: Home, Movies, TV Series, Genres, Popular, Top Rated, Random */}
          <div className="flex items-center gap-3 lg:gap-5">
            <nav className="hidden md:flex items-center gap-3 lg:gap-4.5 text-[10px] text-white">
              {/* 1. Home */}
              <button
                onClick={() => onNavigate('home')}
                className={`flex flex-col items-center group cursor-pointer transition-colors ${
                  currentView === 'home' ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                }`}
              >
                <Home className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">Home</span>
              </button>

              {/* 2. Movies */}
              <button
                onClick={() => onNavigate('movies')}
                className={`flex flex-col items-center group cursor-pointer transition-colors ${
                  currentView === 'movies' ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                }`}
              >
                <Film className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">Movies</span>
              </button>

              {/* 3. TV Series */}
              <button
                onClick={() => onNavigate('tv-shows')}
                className={`flex flex-col items-center group cursor-pointer transition-colors ${
                  currentView === 'tv-shows' ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                }`}
              >
                <Tv className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">TV Series</span>
              </button>

              {/* 4. Genres Dropdown Menu in Top Bar */}
              <div className="relative">
                <button
                  onClick={() => {
                    setGenresDropdownOpen(!genresDropdownOpen);
                    setLiveSearchOpen(false);
                  }}
                  className={`flex flex-col items-center group cursor-pointer transition-colors ${
                    genresDropdownOpen ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                  }`}
                >
                  <div className="flex items-center gap-0.5">
                    <Compass className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                    <ChevronDown className="w-2.5 h-2.5 text-[#F5C400]" />
                  </div>
                  <span className="font-semibold whitespace-nowrap">Genres</span>
                </button>

                {genresDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setGenresDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-[#1e1e23] border border-[#3A3A40] rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#A6A6AC] px-2 py-1 border-b border-white/5 mb-1.5 flex items-center justify-between">
                        <span>All Genres ({ALL_GENRES.length})</span>
                        <span className="text-[#F5C400]">Click to browse</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto no-scrollbar">
                        {ALL_GENRES.map(g => (
                          <button
                            key={g.id}
                            onClick={() => {
                              setGenresDropdownOpen(false);
                              if (onSelectGenre) onSelectGenre(g.id, g.name);
                              else onNavigate('movies', { genreId: g.id });
                            }}
                            className="text-left text-xs px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-black hover:bg-[#F5C400] transition-colors font-semibold truncate cursor-pointer"
                          >
                            {g.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 5. Popular */}
              <button
                onClick={() => onNavigate('trending')}
                className={`flex flex-col items-center group cursor-pointer transition-colors ${
                  currentView === 'trending' ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">Popular</span>
              </button>

              {/* 6. Top Rated */}
              <button
                onClick={() => onNavigate('top-rated')}
                className={`flex flex-col items-center group cursor-pointer transition-colors ${
                  currentView === 'top-rated' ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">Top Rated</span>
              </button>

              {/* 7. Random */}
              <button
                onClick={onSurpriseMe}
                className={`flex flex-col items-center group cursor-pointer transition-colors ${
                  currentView === 'random' ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">Random</span>
              </button>
            </nav>

            {/* PWA Install Button */}
            <PWAInstallButton variant="header" />

            {/* Watchlist & Account Buttons */}
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuthModal('watchlist')}
                  className="h-8 px-2.5 rounded-lg bg-[#242428] hover:bg-[#303036] text-[#A6A6AC] hover:text-[#F5C400] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#3A3A40]"
                  title="My Watchlist"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Watchlist</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-[#F5C400] text-black text-[10px] font-black">
                    {watchlist.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => openAuthModal('profile')}
                  className="h-8 pl-1.5 pr-3 rounded-lg bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                  title="My Profile"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      className="w-5 h-5 rounded-full object-cover border border-black/20"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-black text-[#F5C400] font-black text-[10px] flex items-center justify-center">
                      {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[85px] truncate">
                    {profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Account'}
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="h-8 px-4 rounded bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-bold text-xs flex items-center justify-center transition-all cursor-pointer shadow-sm"
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
};
