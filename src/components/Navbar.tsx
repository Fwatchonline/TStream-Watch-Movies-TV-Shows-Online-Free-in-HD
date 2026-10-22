import React, { useState } from 'react';
import {
  Play,
  Search,
  Bookmark,
  Sparkles,
  Menu,
  X,
  Shield,
  Film,
  Tv,
  Flame,
  Clock,
  Layers,
  Hash
} from 'lucide-react';
import { MediaType } from '../types/media';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, extraParams?: any) => void;
  onSearch: (query: string) => void;
  onSurpriseMe: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onSearch,
  onSurpriseMe
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setSearchOpen(false);
    }
  };

  const navLinks = [
    { label: 'Movies', view: 'movies', icon: Film },
    { label: 'TV Shows', view: 'tv-shows', icon: Tv },
    { label: 'Trending', view: 'trending', icon: Flame },
    { label: 'Collections', view: 'collections', icon: Layers },
    { label: 'Tags', view: 'tags', icon: Hash },
    { label: 'Library', view: 'library', icon: Bookmark }
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#29292D]/95 backdrop-blur-md border-b border-[#3A3A40]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element Brand Wordmark */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 group focus:outline-none text-left cursor-pointer shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-[#F5C400] flex items-center justify-center text-black font-black shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
              <Play className="w-3.5 h-3.5 fill-black text-black ml-0.5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white font-sans">
              T <span className="text-[#F5C400]">Stream</span>
            </span>
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#A6A6AC]">
            {navLinks.map(link => {
              const isActive = currentView === link.view;
              return (
                <button
                  key={link.view}
                  onClick={() => onNavigate(link.view)}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                    isActive ? 'text-[#F5C400] font-bold' : 'hover:text-[#F3F3F3]'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F5C400] rounded-full" />
                  )}
                </button>
              );
            })}

            <button
              onClick={onSurpriseMe}
              className="flex items-center gap-1.5 text-[#F5C400] hover:text-[#e0b400] whitespace-nowrap shrink-0 text-xs font-bold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Surprise Me</span>
            </button>
          </nav>

          {/* Zone 3: Search bar & primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Desktop Search Trigger / Input */}
            <form onSubmit={handleSearchSubmit} className="hidden sm:flex relative items-center">
              <input
                type="text"
                placeholder="Search movies, TV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 lg:w-64 h-9 pl-9 pr-3 rounded-lg bg-[#181820] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-red-500 focus:w-72 transition-all"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            </form>

            {/* Mobile Search Icon Button */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="sm:hidden p-2 rounded-lg text-slate-400 hover:text-white"
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Admin Dashboard Action */}
            <button
              onClick={() => onNavigate('admin')}
              className={`p-2 rounded-lg border transition-colors ${
                currentView === 'admin'
                  ? 'bg-[#303035] border-[#F5C400] text-[#F5C400]'
                  : 'bg-[#303035] border-[#3A3A40] text-[#A6A6AC] hover:text-[#F3F3F3] hover:border-[#F5C400]/50'
              }`}
              title="Admin Panel & Operational Health"
            >
              <Shield className="w-4 h-4" />
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Input Drawer */}
        {searchOpen && (
          <div className="sm:hidden py-3 border-t border-white/10">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                type="text"
                placeholder="Search movies, TV shows, actors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#181820] border border-white/15 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-red-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
            </form>
          </div>
        )}
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#29292D] border-b border-[#3A3A40] px-4 py-4 space-y-2">
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = currentView === link.view;
            return (
              <button
                key={link.view}
                onClick={() => {
                  onNavigate(link.view);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#F5C400] text-black font-bold'
                    : 'text-[#A6A6AC] hover:bg-[#303035] hover:text-[#F3F3F3]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => {
              onSurpriseMe();
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#F5C400] hover:bg-[#303035] cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Surprise Me</span>
          </button>
        </div>
      )}
    </header>
  );
};
