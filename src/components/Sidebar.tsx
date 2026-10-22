import React, { useState } from 'react';
import {
  Home,
  Film,
  Tv,
  Flame,
  Compass,
  Layers,
  Hash,
  Bookmark,
  PlayCircle,
  Clock,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronRight,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Shield
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  subCategory?: string;
  onNavigate: (view: string, extraParams?: any) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  subCategory,
  onNavigate,
  isCollapsed,
  onToggleCollapse
}) => {
  const [moviesExpanded, setMoviesExpanded] = useState(true);
  const [tvExpanded, setTvExpanded] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);

  const isNavActive = (view: string, sub?: string) => {
    if (sub) {
      return currentView === view && subCategory === sub;
    }
    return currentView === view && !subCategory;
  };

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 bg-[#29292D] border-r border-[#3A3A40] transition-all duration-300 flex flex-col justify-between select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Top: Logo & Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        {/* Brand Logo Header */}
        <div className="h-16 flex items-center px-4 gap-2.5 shrink-0 border-b border-[#3A3A40]">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 text-left focus:outline-none group cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-[#F5C400] flex items-center justify-center shrink-0 shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
              <Play className="w-3.5 h-3.5 fill-black text-black ml-0.5" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-extrabold text-white tracking-tight font-sans">
                T <span className="text-[#F5C400]">Stream</span>
              </span>
            )}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="px-2 py-4 space-y-6">
          {/* Section: DISCOVER */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#A6A6AC]">
                Discover
              </div>
            )}

            <div className="space-y-0.5">
              {/* Home */}
              <button
                onClick={() => onNavigate('home')}
                title="Home"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isNavActive('home')
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-[#A6A6AC] hover:text-white hover:bg-white/5'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Home</span>}
              </button>

              {/* Movies Accordion */}
              <div>
                <button
                  onClick={() => {
                    if (isCollapsed) onToggleCollapse();
                    setMoviesExpanded(!moviesExpanded);
                  }}
                  title="Movies"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    currentView === 'movies'
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Film className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>Movies</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="text-slate-500">
                      {moviesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </button>

                {/* Movies Sub-links */}
                {!isCollapsed && moviesExpanded && (
                  <div className="ml-7 pl-2 border-l border-white/5 space-y-0.5 mt-0.5 py-1">
                    {[
                      { label: 'Discover', sub: 'discover' },
                      { label: 'Now Playing', sub: 'now-playing' },
                      { label: 'Popular', sub: 'popular' },
                      { label: 'Top Rated', sub: 'top-rated' },
                      { label: 'Collections', sub: 'collections' }
                    ].map(item => {
                      const active = isNavActive('movies', item.sub);
                      return (
                        <button
                          key={item.sub}
                          onClick={() => {
                            if (item.sub === 'collections') {
                              onNavigate('collections');
                            } else {
                              onNavigate('movies', { subCategory: item.sub });
                            }
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors block ${
                            active
                              ? 'text-[#F5C400] font-semibold bg-[#303035]'
                              : 'text-[#A6A6AC] hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* TV Shows Accordion */}
              <div>
                <button
                  onClick={() => {
                    if (isCollapsed) onToggleCollapse();
                    setTvExpanded(!tvExpanded);
                  }}
                  title="TV Shows"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    currentView === 'tv-shows'
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Tv className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>TV Shows</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="text-slate-500">
                      {tvExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </button>

                {/* TV Sub-links */}
                {!isCollapsed && tvExpanded && (
                  <div className="ml-7 pl-2 border-l border-white/5 space-y-0.5 mt-0.5 py-1">
                    {[
                      { label: 'Discover', sub: 'discover' },
                      { label: 'Airing Today', sub: 'airing-today' },
                      { label: 'On The Air', sub: 'on-the-air' },
                      { label: 'Popular', sub: 'popular' },
                      { label: 'Top Rated', sub: 'top-rated' },
                      { label: 'New Episodes', sub: 'new-episodes' }
                    ].map(item => {
                      const active = isNavActive('tv-shows', item.sub);
                      return (
                        <button
                          key={item.sub}
                          onClick={() => onNavigate('tv-shows', { subCategory: item.sub })}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors block ${
                            active
                              ? 'text-[#F5C400] font-semibold bg-[#303035]'
                              : 'text-[#A6A6AC] hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Trending */}
              <button
                onClick={() => onNavigate('trending')}
                title="Trending"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isNavActive('trending')
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Flame className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Trending</span>}
              </button>

              {/* Genres */}
              <button
                onClick={() => onNavigate('genres')}
                title="Genres"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isNavActive('genres')
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Compass className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Genres</span>}
              </button>

              {/* Collections (Slika 2) */}
              <button
                onClick={() => onNavigate('collections')}
                title="Collections"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isNavActive('collections')
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Collections</span>}
              </button>

              {/* Tags (Slika 3) */}
              <button
                onClick={() => onNavigate('tags')}
                title="Tags"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isNavActive('tags')
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Hash className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Tags</span>}
              </button>
            </div>
          </div>

          {/* Section: MY LIBRARY */}
          <div>
            {!isCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                My Library
              </div>
            )}

            <div className="space-y-0.5">
              {/* Watchlist */}
              <button
                onClick={() => onNavigate('library', { tab: 'watchlist' })}
                title="Watchlist"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'library' && (!subCategory || subCategory === 'watchlist')
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Bookmark className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Watchlist</span>}
              </button>

              {/* Continue Watching */}
              <button
                onClick={() => onNavigate('library', { tab: 'continue' })}
                title="Continue Watching"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'library' && subCategory === 'continue'
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <PlayCircle className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Continue Watching</span>}
              </button>

              {/* Watch History */}
              <button
                onClick={() => onNavigate('library', { tab: 'history' })}
                title="Watch History"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'library' && subCategory === 'history'
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Watch History</span>}
              </button>

              {/* Episode Calendar */}
              <button
                onClick={() => onNavigate('calendar')}
                title="Episode Calendar"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'calendar'
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Episode Calendar</span>}
              </button>

              {/* Surprise Me */}
              <button
                onClick={() => onNavigate('surprise')}
                title="Surprise Me"
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'surprise'
                    ? 'bg-[#303035] text-[#F5C400] border-l-2 border-[#F5C400]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                {!isCollapsed && <span>Surprise Me</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Area: Account, Collapse, Version */}
      <div className="p-2 border-t border-white/5 space-y-1 shrink-0">
        {/* Account Button */}
        <div>
          <button
            onClick={() => setAccountExpanded(!accountExpanded)}
            title="Account"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Account</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${accountExpanded ? 'rotate-180' : ''}`} />
            )}
          </button>

          {!isCollapsed && accountExpanded && (
            <div className="p-2 text-[11px] text-slate-400 bg-[#141418] rounded-lg mt-1 space-y-1">
              <button onClick={() => onNavigate('admin')} className="w-full text-left py-1 hover:text-white flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-red-500" />
                <span>Admin Operations</span>
              </button>
              <div className="text-[10px] text-slate-400">Guest Session Active</div>
            </div>
          )}
        </div>

        {/* Collapse Sidebar Button */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4 shrink-0" />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>

        {/* Preview Version Tag */}
        {!isCollapsed && (
          <div className="px-3 pt-2 text-[9px] font-mono uppercase text-slate-400 tracking-wider">
            TSTREAM<br />
            <span>V1.0 PREVIEW</span>
          </div>
        )}
      </div>
    </aside>
  );
};
