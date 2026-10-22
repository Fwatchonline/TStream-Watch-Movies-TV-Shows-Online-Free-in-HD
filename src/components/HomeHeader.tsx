import React, { useState } from 'react';
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
  User
} from 'lucide-react';

interface HomeHeaderProps {
  onToggleSidebar: () => void;
  onNavigate: (view: string, extraParams?: any) => void;
  onSearch: (query: string) => void;
  onSurpriseMe: () => void;
  onOpenFilter?: () => void;
  currentView?: string;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onToggleSidebar,
  onNavigate,
  onSearch,
  onSurpriseMe,
  onOpenFilter,
  currentView
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
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
              className="flex items-center gap-2 group focus:outline-none text-left cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-[#F5C400] flex items-center justify-center text-black font-black shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
                <svg className="w-3.5 h-3.5 fill-black ml-0.5" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                T <span className="text-[#F5C400]">Stream</span>
              </span>
            </button>
          </div>

          {/* Search bar with Filter button inside */}
          <div className="hidden sm:flex items-center max-w-xs md:max-w-sm lg:max-w-md w-full relative">
            <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-3 pr-18 rounded bg-[#232326] border border-[#3A3A40] text-xs text-white placeholder:text-[#A6A6AC] focus:outline-none focus:border-[#F5C400] transition-colors"
              />
              <button
                type="button"
                onClick={() => onOpenFilter ? onOpenFilter() : onNavigate('movies')}
                className="absolute right-1 h-6 px-2 rounded bg-[#303035] hover:bg-[#3A3A40] border border-[#3A3A40] text-[10px] font-semibold text-[#F3F3F3] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-2.5 h-2.5 text-[#F5C400]" />
                <span>Filter</span>
              </button>
            </form>
          </div>

          {/* Center-Right Nav: Ordered per user request (Home, Movies, TV Series, Popular, Top Rated, Random) */}
          <div className="flex items-center gap-3 lg:gap-5">
            <nav className="hidden md:flex items-center gap-3.5 lg:gap-5 text-[10px] text-white">
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

              {/* 4. Popular */}
              <button
                onClick={() => onNavigate('trending')}
                className={`flex flex-col items-center group cursor-pointer transition-colors ${
                  currentView === 'trending' ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">Popular</span>
              </button>

              {/* 5. Top Rated */}
              <button
                onClick={() => onNavigate('top-rated')}
                className={`flex flex-col items-center group cursor-pointer transition-colors ${
                  currentView === 'top-rated' ? 'text-[#F5C400]' : 'text-white hover:text-[#F5C400]'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">Top Rated</span>
              </button>

              {/* 6. Random */}
              <button
                onClick={onSurpriseMe}
                className="flex flex-col items-center group cursor-pointer hover:text-[#F5C400] transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#F5C400] mb-0.5" />
                <span className="font-semibold whitespace-nowrap">Random</span>
              </button>
            </nav>

            {/* Login Yellow Button on the far right matching image */}
            <button
              onClick={() => setLoginModalOpen(true)}
              className="h-8 px-4 rounded bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-bold text-xs flex items-center justify-center transition-all cursor-pointer shadow-sm"
            >
              {isLoggedIn ? 'Account' : 'Login'}
            </button>
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#1a1a1e] border border-[#303036] rounded-xl max-w-sm w-full p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setLoginModalOpen(false)}
              className="absolute top-4 right-4 text-[#A6A6AC] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-base font-bold mb-3 text-[#F5C400]">
              <User className="w-5 h-5" />
              <span>{isLoggedIn ? 'User Account' : 'Sign in to T Stream'}</span>
            </div>
            {isLoggedIn ? (
              <div className="space-y-4 text-xs">
                <p className="text-[#A6A6AC]">You are currently signed in as a registered viewer.</p>
                <button
                  onClick={() => {
                    setIsLoggedIn(false);
                    setLoginModalOpen(false);
                  }}
                  className="w-full py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setIsLoggedIn(true);
                  setLoginModalOpen(false);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="text-[11px] text-[#A6A6AC] block mb-1">Email / Username</label>
                  <input
                    type="text"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded bg-[#121215] border border-[#2d2d33] text-xs text-white focus:outline-none focus:border-[#F5C400]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#A6A6AC] block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full h-9 px-3 rounded bg-[#121215] border border-[#2d2d33] text-xs text-white focus:outline-none focus:border-[#F5C400]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded bg-[#F5C400] text-black font-bold text-xs hover:bg-[#e0b400] cursor-pointer mt-2"
                >
                  Sign In
                </button>
                <p className="text-[10px] text-center text-[#888890] mt-2">
                  No subscription needed. Free streaming for all devices.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
