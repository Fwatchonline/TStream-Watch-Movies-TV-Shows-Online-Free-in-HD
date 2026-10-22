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
  Shuffle
} from 'lucide-react';
import { ALL_GENRES } from '../services/catalogData';

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

import { PLATFORMS_LIST, PlatformInfo } from '../services/platformData';

export const OTT_PLATFORMS = PLATFORMS_LIST;

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
  const [genresExpanded, setGenresExpanded] = useState(true);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-out Drawer Panel */}
      <aside
        className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#29292D] border-r border-[#3A3A40] shadow-2xl flex flex-col justify-between select-none animate-in slide-in-from-left duration-200"
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#3A3A40]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#F5C400] flex items-center justify-center text-black font-black">
              <svg className="w-3 h-3 fill-black ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="font-extrabold text-base tracking-tight text-white font-sans">
              T <span className="text-[#F5C400]">Stream</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-[#A6A6AC] hover:text-white hover:bg-[#303035] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-5">
          {/* Main Links */}
          <div className="space-y-1">
            <button
              onClick={() => {
                onNavigate('home');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
                currentView === 'home'
                  ? 'bg-[#303035] text-[#F5C400]'
                  : 'text-[#A6A6AC] hover:text-[#F3F3F3] hover:bg-[#303035]'
              }`}
            >
              <Home className="w-4 h-4 text-[#F5C400]" />
              <span>Home</span>
            </button>

            <button
              onClick={() => {
                onNavigate('movies');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'movies'
                  ? 'bg-[#303035] text-[#F5C400] font-bold'
                  : 'text-[#A6A6AC] hover:text-[#F3F3F3] hover:bg-[#303035]'
              }`}
            >
              <Film className="w-4 h-4 text-[#F5C400]" />
              <span>Movies</span>
            </button>

            <button
              onClick={() => {
                onNavigate('tv-shows');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'tv-shows'
                  ? 'bg-[#303035] text-[#F5C400] font-bold'
                  : 'text-[#A6A6AC] hover:text-[#F3F3F3] hover:bg-[#303035]'
              }`}
            >
              <Tv className="w-4 h-4 text-[#F5C400]" />
              <span>TV Series</span>
            </button>

            <button
              onClick={() => {
                onNavigate('trending');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'trending'
                  ? 'bg-[#303035] text-[#F5C400] font-bold'
                  : 'text-[#A6A6AC] hover:text-[#F3F3F3] hover:bg-[#303035]'
              }`}
            >
              <Flame className="w-4 h-4 text-[#F5C400]" />
              <span>Popular / Trending</span>
            </button>

            <button
              onClick={() => {
                onNavigate('top-rated');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'top-rated'
                  ? 'bg-[#303035] text-[#F5C400] font-bold'
                  : 'text-[#A6A6AC] hover:text-[#F3F3F3] hover:bg-[#303035]'
              }`}
            >
              <Star className="w-4 h-4 text-[#F5C400]" />
              <span>Top Rated</span>
            </button>

            <button
              onClick={() => {
                onNavigate('az', { letter: 'A' });
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'az'
                  ? 'bg-[#303035] text-[#F5C400] font-bold'
                  : 'text-[#A6A6AC] hover:text-[#F3F3F3] hover:bg-[#303035]'
              }`}
            >
              <span className="w-4 h-4 rounded bg-[#F5C400] text-black font-black text-[10px] flex items-center justify-center shrink-0">A</span>
              <span>A-Z Directory</span>
            </button>

            <button
              onClick={() => {
                onNavigate('collections');
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                currentView === 'collections'
                  ? 'bg-[#303035] text-[#F5C400] font-bold'
                  : 'text-[#A6A6AC] hover:text-[#F3F3F3] hover:bg-[#303035]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-[#F5C400]" />
                <span>Collections</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-[#F5C400]/20 text-[#F5C400] text-[9px] font-black uppercase tracking-wider">
                Sagas
              </span>
            </button>
          </div>

          <div className="w-full h-px bg-[#26262c]" />

          {/* Genres Section */}
          <div>
            <button
              onClick={() => setGenresExpanded(!genresExpanded)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-white uppercase tracking-wider mb-1"
            >
              <div className="flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-[#F5C400]" />
                <span>Genres</span>
              </div>
              {genresExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#888890]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#888890]" />}
            </button>

            {genresExpanded && (
              <div className="grid grid-cols-2 gap-1 px-1">
                {ALL_GENRES.map((g) => {
                  const isSelected = selectedGenreId === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        if (onSelectGenre) onSelectGenre(g.id, g.name);
                        else onNavigate('movies', { genreId: g.id });
                        onClose();
                      }}
                      className={`text-left text-[11px] px-2 py-1.5 rounded truncate transition-colors font-medium ${
                        isSelected
                          ? 'bg-[#F5C400] text-black font-bold'
                          : 'text-[#888890] hover:text-white hover:bg-[#1e1e24]'
                      }`}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-full h-px bg-[#26262c]" />

          {/* OTT Platforms */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#888890]">
              Streaming Platforms
            </div>

            <div className="grid grid-cols-2 gap-1 px-1">
              {OTT_PLATFORMS.map((platform) => {
                const isSelected = selectedPlatform === platform.id;
                return (
                  <button
                    key={platform.id}
                    onClick={() => {
                      if (onSelectPlatform) onSelectPlatform(platform.id);
                      else onNavigate('platform', { platform: platform.id });
                      onClose();
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F5C400] text-black font-bold'
                        : 'text-[#A6A6AC] hover:text-[#F3F3F3] hover:bg-[#303035]'
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
        </div>

        <div className="p-3 border-t border-[#3A3A40] text-[11px] text-[#A6A6AC] flex items-center justify-between">
          <span>T Stream</span>
          <span className="text-[#F5C400] font-bold">HD 1080p</span>
        </div>
      </aside>
    </>
  );
};
