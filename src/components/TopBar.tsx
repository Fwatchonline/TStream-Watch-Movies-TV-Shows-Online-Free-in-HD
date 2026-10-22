import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Shuffle,
  Bookmark,
  LogIn,
  X,
  Star,
  Film,
  Tv
} from 'lucide-react';
import { EXPANDED_CATALOG } from '../services/catalogData';
import { MediaItem } from '../types/media';

interface TopBarProps {
  onSearch: (query: string) => void;
  onSelectMedia: (item: MediaItem) => void;
  onNavigate: (view: string, extra?: any) => void;
  onSurpriseMe: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onSearch,
  onSelectMedia,
  onNavigate,
  onSurpriseMe
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Instant live typeahead
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const q = query.trim().toLowerCase();
    const matches = EXPANDED_CATALOG.filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.some(k => k.name.toLowerCase().includes(q)))
    ).slice(0, 5);
    setSearchResults(matches);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setIsFocused(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#0d0d0f]/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Search Input Box with Cmd+K */}
      <div className="relative flex-1 max-w-xl">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search movies, shows, people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="w-full h-10 pl-10 pr-12 rounded-xl bg-[#141418] border border-white/5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-red-500/80 focus:bg-[#181820] transition-all shadow-inner"
          />
          <div className="absolute right-3 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-500 pointer-events-none">
            <span>⌘</span>
            <span>K</span>
          </div>
        </form>

        {/* Live Search Floating Dropdown */}
        {isFocused && searchResults.length > 0 && (
          <div
            className="absolute top-12 left-0 right-0 bg-[#141418] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 divide-y divide-white/5"
            onMouseDown={(e) => e.preventDefault()} // prevent input blur before click
          >
            {searchResults.map(item => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectMedia(item);
                  setIsFocused(false);
                  setQuery('');
                }}
                className="flex items-center gap-3 p-2.5 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <div className="w-9 h-12 rounded overflow-hidden bg-[#1c1c24] shrink-0">
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                    <span>{new Date(item.releaseDate).getFullYear()}</span>
                    <span>·</span>
                    <span>{item.mediaType === 'movie' ? 'Movie' : 'TV Series'}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                      {item.voteAverage.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div
              onClick={() => {
                onSearch(query);
                setIsFocused(false);
              }}
              className="p-2 text-center text-xs font-semibold text-red-400 hover:text-red-300 bg-[#16161c] cursor-pointer"
            >
              View all results for &quot;{query}&quot; →
            </div>
          </div>
        )}
      </div>

      {/* Right Action Icons & Sign In */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Notification Bell */}
        <button
          onClick={() => alert('No new notifications')}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Shuffle / Randomizer */}
        <button
          onClick={onSurpriseMe}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Surprise Me (Shuffle Pick)"
        >
          <Shuffle className="w-4 h-4" />
        </button>

        {/* Bookmark / Watchlist Shortcut */}
        <button
          onClick={() => onNavigate('library', { tab: 'watchlist' })}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="My Watchlist"
        >
          <Bookmark className="w-4 h-4" />
        </button>

        {/* Yellow Sign In Button */}
        <button
          onClick={() => setShowSignInModal(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-extrabold text-xs transition-all shadow-md shadow-amber-500/20 ml-1 cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </button>
      </div>

      {/* Sign In Dialog */}
      {showSignInModal && (
        <div
          onClick={() => setShowSignInModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#29292D] border border-[#3A3A40] rounded-2xl p-6 shadow-2xl relative"
          >
            <button
              onClick={() => setShowSignInModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#F5C400] text-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
                <LogIn className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Sign In to T Stream</h3>
              <p className="text-xs text-slate-400 mt-1">Sync your Watchlist and continue watching across all your devices.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setShowSignInModal(false); alert('Guest session linked successfully!'); }} className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                required
                className="w-full h-10 px-3 rounded-lg bg-[#232326] border border-[#3A3A40] text-xs text-white focus:outline-none focus:border-[#F5C400]"
              />
              <input
                type="password"
                placeholder="Password"
                required
                className="w-full h-10 px-3 rounded-lg bg-[#232326] border border-[#3A3A40] text-xs text-white focus:outline-none focus:border-[#F5C400]"
              />
              <button
                type="submit"
                className="w-full h-10 rounded-lg bg-[#F5C400] text-black font-extrabold text-xs hover:bg-[#e0b400] transition-colors shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Sign In
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
