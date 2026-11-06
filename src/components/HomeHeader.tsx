import React from 'react';
import {
  Menu,
  Home,
  Film,
  Tv,
  Star,
  Shuffle,
  Clock,
  PlaySquare,
  Calendar,
  Bookmark,
  TrendingUp,
  Video,
  Sparkles
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { useAuth } from '../context/AuthContext';
import { TStreamLogo } from './TStreamLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationBell } from './NotificationBell';
import { NavDropdown } from './nav/NavDropdown';
import { NavSearch } from './nav/NavSearch';
import { UserProfileDropdown } from './nav/UserProfileDropdown';

interface HomeHeaderProps {
  onToggleSidebar: () => void;
  onNavigate: (view: string, extraParams?: any) => void;
  onSearch: (query: string) => void;
  onSelectMedia?: (item: MediaItem) => void;
  onSelectGenre?: (genreId: number, genreName: string) => void;
  onSurpriseMe: () => void;
  onOpenFilter?: () => void;
  onWatchEpisode?: (showId: number, showTitle: string, season: number, episode: number, posterPath?: string) => void;
  currentView?: string;
  selectedGenreId?: number | null;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onToggleSidebar,
  onNavigate,
  onSearch,
  onSelectMedia,
  onSurpriseMe,
  onOpenFilter,
  onWatchEpisode,
  currentView = 'home'
}) => {
  const { user, watchlist, openAuthModal } = useAuth();
  const currentYear = new Date().getFullYear();

  return (
    <header className="sticky top-0 z-50 w-full bg-[#232326]/95 backdrop-blur-xl border-b border-[#3A3A40] text-[#F3F3F3] select-none shadow-xl transition-all">
      <div className="max-w-[1600px] mx-auto px-2 sm:px-4 lg:px-6 h-[64px] flex items-center justify-between gap-2 lg:gap-4">
        {/* Left Section: Mobile Menu & Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-[#E5E5EA] hover:text-[#F5C400] hover:bg-[#303036]/60 transition-colors focus:outline-none cursor-pointer"
            aria-label="Toggle Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* TStream Logo */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center focus:outline-none text-left cursor-pointer transition-transform hover:opacity-95"
            aria-label="TStream Home"
          >
            <TStreamLogo size="md" />
          </button>
        </div>

        {/* Center-Left: Main Navigation Menu (Desktop & Tablet) */}
        <nav className="hidden md:flex items-center gap-1.5 shrink-0">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all cursor-pointer ${
              currentView === 'home'
                ? 'text-[#F5C400] bg-[#303036]/80 border border-[#F5C400]/40 shadow-sm'
                : 'text-[#E5E5EA] hover:text-[#F5C400] hover:bg-[#303036]/40 border border-transparent'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-[#F5C400]" />
            <span>Home</span>
          </button>

          {/* 2. Movies Dropdown */}
          <NavDropdown
            label="Movies"
            icon={Film}
            isActive={currentView === 'movies'}
            widthClass="w-72"
            onLabelClick={() => onNavigate('movies')}
          >
            {(close) => (
              <div className="space-y-1 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] border-b border-white/5 flex items-center justify-between">
                  <span>Movies Hub</span>
                  <span className="text-[#F5C400]">Full HD &amp; 4K</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('movies');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <Film className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Discover Movies</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('movies', { sortBy: 'popularity.desc' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <TrendingUp className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Popular Movies</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('movies', { sortBy: 'primary_release_date.desc' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <PlaySquare className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Now Playing</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('movies', { sortBy: 'vote_average.desc', minRating: 7.5 });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <Star className="w-4 h-4 text-amber-400 group-hover:text-black shrink-0" />
                  <span>Top Rated</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('movies', { sortBy: 'popularity.desc', year: currentYear });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <Calendar className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Upcoming Movies</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('movies', { sortBy: 'primary_release_date.desc' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <Clock className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Latest Movies</span>
                </button>

                {/* Browse by Year Sub-bar */}
                <div className="pt-1 border-t border-white/5">
                  <span className="block px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">
                    Browse by Year
                  </span>
                  <div className="grid grid-cols-4 gap-1 px-2 pb-1">
                    {[2026, 2025, 2024, 2023].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          close();
                          onNavigate('movies', { year: yr });
                        }}
                        className="py-1 rounded-md text-[11px] font-mono text-center bg-[#282830] hover:bg-[#F5C400] hover:text-black text-slate-300 font-bold transition-colors cursor-pointer"
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Browse by Country */}
                <div className="pt-1 border-t border-white/5">
                  <span className="block px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">
                    Browse by Country
                  </span>
                  <div className="grid grid-cols-3 gap-1 px-2 pb-1 text-[10px]">
                    {[
                      { code: 'US', label: 'United States' },
                      { code: 'GB', label: 'United Kingdom' },
                      { code: 'FR', label: 'France' },
                      { code: 'JP', label: 'Japan / Anime' },
                      { code: 'KR', label: 'South Korea' },
                      { code: 'ES', label: 'Spain' }
                    ].map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          close();
                          onNavigate('movies', { country: c.code });
                        }}
                        className="py-1 px-1 rounded-md text-center bg-[#282830] hover:bg-[#F5C400] hover:text-black text-slate-300 font-medium truncate transition-colors cursor-pointer"
                        title={c.label}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </NavDropdown>

          {/* 3. TV Series Dropdown */}
          <NavDropdown
            label="TV Series"
            icon={Tv}
            isActive={currentView === 'tv-shows'}
            widthClass="w-68"
            onLabelClick={() => onNavigate('tv-shows')}
          >
            {(close) => (
              <div className="space-y-1 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8E8E93] border-b border-white/5 flex items-center justify-between">
                  <span>Television Hub</span>
                  <span className="text-[#F5C400]">Full Seasons</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('tv-shows');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <Tv className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Discover TV Shows</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('tv-shows', { sortBy: 'popularity.desc' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <TrendingUp className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Popular TV Shows</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('tv-shows', { sortBy: 'vote_average.desc', minRating: 7.5 });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <Star className="w-4 h-4 text-amber-400 group-hover:text-black shrink-0" />
                  <span>Top Rated TV Shows</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('tv-shows', { sortBy: 'primary_release_date.desc' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <PlaySquare className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Currently Airing</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('tv-shows');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <Video className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>On TV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('new-episodes');
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                    <span>New Episodes</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[8px] font-black uppercase">
                    New
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onNavigate('tv-shows', { sortBy: 'primary_release_date.desc' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer text-left font-medium group"
                >
                  <Calendar className="w-4 h-4 text-[#F5C400] group-hover:text-black shrink-0" />
                  <span>Latest TV Shows</span>
                </button>
              </div>
            )}
          </NavDropdown>

          {/* 4. Random Direct Picker */}
          <button
            type="button"
            onClick={onSurpriseMe}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all cursor-pointer ${
              currentView === 'random'
                ? 'text-[#F5C400] bg-[#303036]/80 border border-[#F5C400]/40 shadow-sm'
                : 'text-[#E5E5EA] hover:text-[#F5C400] hover:bg-[#303036]/40 border border-transparent'
            }`}
            title="Pick a random surprise title"
          >
            <Shuffle className="w-3.5 h-3.5 text-[#F5C400]" />
            <span>Random</span>
          </button>
        </nav>

        {/* Center: Enhanced Live Search Bar */}
        <div className="shrink-0 sm:flex-1 sm:max-w-sm lg:max-w-md xl:max-w-lg sm:mx-2 lg:mx-4">
          <NavSearch
            onSearch={onSearch}
            onSelectMedia={onSelectMedia}
            onNavigate={onNavigate}
          />
        </div>

        {/* Right Section: Actions (Install, Notifications, Watchlist, Profile) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* PWA Install Button */}
          <PWAInstallButton variant="header" />

          {/* Episode Notifications Bell */}
          <NotificationBell
            variant="header"
            onWatchEpisode={onWatchEpisode}
            onNavigateNewEpisodes={() => onNavigate('new-episodes')}
          />

          {/* Quick Watchlist Button */}
          {user && (
            <button
              type="button"
              onClick={() => openAuthModal('watchlist')}
              className="h-8.5 px-2.5 rounded-xl bg-[#212126] hover:bg-[#2b2b32] text-[#E5E5EA] hover:text-[#F5C400] text-xs font-semibold hidden md:flex items-center gap-1.5 transition-colors cursor-pointer border border-[#3A3A40]"
              title="My Saved Watchlist"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#F5C400]" />
              <span className="hidden lg:inline">Watchlist</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#F5C400] text-black text-[10px] font-black">
                {watchlist.length}
              </span>
            </button>
          )}

          {/* User Profile Dropdown */}
          <UserProfileDropdown
            onNavigate={onNavigate}
            onOpenPlaybackSettings={onOpenFilter}
          />
        </div>
      </div>
    </header>
  );
};
