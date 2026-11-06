import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Film, Tv, Users, Star, ArrowRight, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { MediaItem } from '../../types/media';
import { fetchCatalog } from '../../services/tmdb';

interface NavSearchProps {
  onSearch: (query: string) => void;
  onSelectMedia?: (item: MediaItem) => void;
  onNavigate: (view: string, extraParams?: any) => void;
}

type SearchCategory = 'all' | 'movies' | 'tv';

export const NavSearch: React.FC<NavSearchProps> = ({
  onSearch,
  onSelectMedia,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    setLoading(true);
    setIsOpen(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetchCatalog('search', 1, { query: q });
        setResults(res.results || []);
      } catch (err) {
        console.warn('Search suggestions error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener for desktop dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus mobile input on open
  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    }
  }, [mobileSearchOpen]);

  // Filtered results based on category
  const filteredResults = results.filter(item => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'movies') return item.mediaType === 'movie';
    if (activeCategory === 'tv') return item.mediaType === 'tv';
    return true;
  }).slice(0, 8);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedIndex >= 0 && filteredResults[selectedIndex]) {
      handleItemClick(filteredResults[selectedIndex]);
      return;
    }
    if (query.trim()) {
      setIsOpen(false);
      setMobileSearchOpen(false);
      onSearch(query.trim());
      inputRef.current?.blur();
      mobileInputRef.current?.blur();
    }
  };

  const handleItemClick = (item: MediaItem) => {
    setIsOpen(false);
    setMobileSearchOpen(false);
    if (onSelectMedia) {
      onSelectMedia(item);
    } else {
      onNavigate(item.mediaType === 'movie' ? 'movie' : 'tv', { id: item.id });
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setMobileSearchOpen(false);
    }
  };

  return (
    <>
      {/* MOBILE TRIGGER BUTTON (Visible on <sm screens) */}
      <div className="sm:hidden flex items-center">
        <button
          type="button"
          onClick={() => setMobileSearchOpen(true)}
          className="h-8.5 w-8.5 rounded-xl bg-[#212126] hover:bg-[#2b2b32] text-[#E5E5EA] hover:text-[#F5C400] flex items-center justify-center transition-colors cursor-pointer border border-[#3A3A40]"
          aria-label="Open Search"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* FULL-SCREEN MOBILE SEARCH OVERLAY (when mobileSearchOpen is true) */}
      {mobileSearchOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-[#16161a] flex flex-col animate-in fade-in duration-150">
          {/* Top Search Input Bar */}
          <div className="h-16 px-3 bg-[#1e1e24] border-b border-[#3A3A40] flex items-center gap-2 shadow-lg shrink-0">
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(false);
                setQuery('');
              }}
              className="p-1.5 rounded-lg text-[#A6A6AC] hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <form onSubmit={handleSubmit} className="flex-1 relative flex items-center">
              <Search className="w-4 h-4 text-[#8E8E93] absolute left-3 pointer-events-none" />
              <input
                ref={mobileInputRef}
                type="text"
                placeholder="Search movies, TV shows..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-10 pl-9 pr-16 rounded-full bg-[#121215] border border-[#3A3A40] text-sm text-white placeholder:text-[#8E8E93] focus:outline-none focus:border-[#F5C400]"
              />

              {loading ? (
                <div className="absolute right-3">
                  <Loader2 className="w-4 h-4 text-[#F5C400] animate-spin" />
                </div>
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 p-1 text-[#8E8E93] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </form>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!query.trim()}
              className="px-3 py-2 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs shrink-0 disabled:opacity-40"
            >
              Search
            </button>
          </div>

          {/* Mobile Category Filters */}
          {query.trim().length >= 2 && (
            <div className="px-3 py-2 bg-[#23232a] border-b border-white/5 flex items-center gap-2 shrink-0">
              {(['all', 'movies', 'tv'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                    activeCategory === cat
                      ? 'bg-[#F5C400] text-black'
                      : 'bg-[#18181c] text-[#8E8E93]'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat === 'movies' ? 'Movies' : 'TV Shows'}
                </button>
              ))}
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
            {filteredResults.length > 0 ? (
              filteredResults.map(item => {
                const isMovie = item.mediaType === 'movie';
                const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '—';

                return (
                  <div
                    key={`${item.mediaType}-${item.id}`}
                    onClick={() => handleItemClick(item)}
                    className="p-2 rounded-xl bg-[#212128] border border-[#3A3A40] active:scale-[0.98] transition-transform flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-[#18181c] shrink-0 border border-white/5">
                      {item.posterPath ? (
                        <img src={item.posterPath} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                          {isMovie ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm truncate">{item.title}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#303038] text-[#F5C400] font-black uppercase shrink-0">
                          {isMovie ? 'HD' : 'TV'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#A6A6AC] mt-1">
                        <span>{year}</span>
                        {item.voteAverage > 0 && (
                          <span className="text-amber-400 font-bold flex items-center gap-0.5">
                            ★ {item.voteAverage.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#8E8E93] shrink-0" />
                  </div>
                );
              })
            ) : query.trim().length >= 2 && !loading ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No titles found matching &quot;{query}&quot;
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                Search tens of thousands of movies and TV series
              </div>
            )}
          </div>
        </div>
      )}

      {/* DESKTOP / TABLET INLINE SEARCH (Visible on sm+ screens) */}
      <div ref={containerRef} className="hidden sm:block relative w-full max-w-xs md:max-w-sm lg:max-w-md">
        <form onSubmit={handleSubmit} className="relative w-full flex items-center">
          <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-3 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search movies, TV shows, actors..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className="w-full h-8.5 pl-9 pr-18 rounded-full bg-[#1e1e24] border border-[#3A3A40] text-xs text-white placeholder:text-[#8E8E93] focus:outline-none focus:border-[#F5C400] focus:ring-1 focus:ring-[#F5C400]/40 transition-all duration-200"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {loading && <Loader2 className="w-3.5 h-3.5 text-[#F5C400] animate-spin" />}
            {query && !loading && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="p-1 text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="h-6 px-2.5 rounded-full bg-[#303036] hover:bg-[#F5C400] hover:text-black text-[10px] font-bold text-[#E5E5EA] transition-colors cursor-pointer flex items-center gap-1"
            >
              Go
            </button>
          </div>
        </form>

        {/* Live Suggestions Floating Dropdown */}
        {isOpen && query.trim().length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1c1c22] border border-[#3A3A40] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/50">
            <div className="px-3 py-2 bg-[#25252c] border-b border-white/5 flex items-center justify-between gap-1 text-[11px]">
              <div className="flex items-center gap-1">
                {(['all', 'movies', 'tv'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-[#F5C400] text-black shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat === 'movies' ? 'Movies' : 'Series'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {filteredResults.length} matches
              </span>
            </div>

            <div className="max-h-[360px] overflow-y-auto divide-y divide-white/5 no-scrollbar">
              {filteredResults.length > 0 ? (
                filteredResults.map((item, index) => {
                  const isSelected = selectedIndex === index;
                  const isMovie = item.mediaType === 'movie';
                  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '—';

                  return (
                    <div
                      key={`${item.mediaType}-${item.id}`}
                      onClick={() => handleItemClick(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`p-2.5 flex items-center gap-3 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-[#303038]' : 'hover:bg-[#25252d]'
                      }`}
                    >
                      <div className="w-10 h-14 rounded-lg overflow-hidden bg-[#18181c] shrink-0 border border-white/5">
                        {item.posterPath ? (
                          <img src={item.posterPath} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            {isMovie ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold truncate transition-colors ${
                            isSelected ? 'text-[#F5C400]' : 'text-white group-hover:text-[#F5C400]'
                          }`}>
                            {item.title}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/60 border border-white/10 text-slate-300 font-mono uppercase shrink-0">
                            {isMovie ? 'HD' : 'TV'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          <span>{year}</span>
                          {item.voteAverage > 0 && (
                            <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                              <Star className="w-2.5 h-2.5 fill-amber-400" />
                              {item.voteAverage.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#F5C400] transition-colors shrink-0" />
                    </div>
                  );
                })
              ) : !loading ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No titles found for &quot;{query}&quot;
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => handleSubmit()}
              className="w-full py-2.5 px-3 bg-[#23232a] hover:bg-[#2b2b34] text-xs font-bold text-[#F5C400] flex items-center justify-center gap-1.5 transition-colors border-t border-white/5 cursor-pointer"
            >
              <span>Search all results for &quot;{query}&quot;</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
