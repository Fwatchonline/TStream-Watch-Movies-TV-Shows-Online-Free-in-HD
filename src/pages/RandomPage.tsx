import React, { useState, useEffect } from 'react';
import {
  Shuffle,
  Play,
  Star,
  Film,
  Tv,
  Sparkles,
  RefreshCw,
  Info,
  SlidersHorizontal,
  Flame,
  Award
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { fetchRandomMedia } from '../services/tmdb';
import { ALL_GENRES } from '../services/catalogData';

interface RandomPageProps {
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem, season?: number, episode?: number) => void;
}

export const RandomPage: React.FC<RandomPageProps> = ({
  onSelectMedia,
  onWatchMedia
}) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReshuffling, setIsReshuffling] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv'>('all');
  const [selectedGenreId, setSelectedGenreId] = useState<number | undefined>(undefined);
  const [spotlightWinner, setSpotlightWinner] = useState<MediaItem | null>(null);

  const loadRandom = async (type = filterType, genreId = selectedGenreId) => {
    setIsReshuffling(true);
    try {
      const results = await fetchRandomMedia(20, type, genreId);
      setItems(results);
      if (results.length > 0) {
        setSpotlightWinner(results[Math.floor(Math.random() * results.length)]);
      }
    } catch (err) {
      console.warn('Failed to load random media:', err);
    } finally {
      setIsReshuffling(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadRandom(filterType, selectedGenreId);
  }, [filterType, selectedGenreId]);

  const handlePickLuckyWinner = () => {
    if (items.length === 0) return;
    const randomPick = items[Math.floor(Math.random() * items.length)];
    setSpotlightWinner(randomPick);
    // Smooth scroll to winner section
    const el = document.getElementById('lucky-winner-spotlight');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-[#121215] text-[#F3F3F3]">
      {/* Top Cinema Banner Header */}
      <div className="relative overflow-hidden border-b border-[#3A3A40] bg-gradient-to-b from-[#232328] via-[#1a1a1e] to-[#121215] py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#F5C400_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5C400]/15 border border-[#F5C400]/30 text-[#F5C400] text-xs font-bold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>20 Handpicked Random Titles</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                Random <span className="text-[#F5C400]">Movie &amp; TV</span> Picker
              </h1>
              <p className="text-sm sm:text-base text-[#A6A6AC] mt-2 max-w-2xl leading-relaxed">
                Can&apos;t decide what to stream? We picked 20 diverse, top-rated movies and series for you. Don&apos;t like them? Hit Reshuffle for a completely new batch!
              </p>
            </div>

            {/* Actions: Reshuffle Button + Lucky Winner */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={() => loadRandom(filterType, selectedGenreId)}
                disabled={isReshuffling}
                className="px-6 py-3.5 rounded-xl bg-[#F5C400] text-black font-black text-sm hover:bg-[#e0b400] active:scale-95 transition-all shadow-xl shadow-amber-500/25 flex items-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                <Shuffle className={`w-4 h-4 ${isReshuffling ? 'animate-spin' : ''}`} />
                <span>{isReshuffling ? 'Reshuffling...' : 'Reshuffle 20 Movies'}</span>
              </button>

              <button
                onClick={handlePickLuckyWinner}
                className="px-5 py-3.5 rounded-xl bg-[#29292D] hover:bg-[#34343a] text-white border border-[#3A3A40] font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Award className="w-4 h-4 text-[#F5C400]" />
                <span>Pick 1 Winner</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-8 pt-6 border-t border-[#3A3A40]/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 p-1 bg-[#232328] rounded-xl border border-[#3A3A40] w-fit">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-[#F5C400] text-black shadow-md'
                    : 'text-[#A6A6AC] hover:text-white'
                }`}
              >
                All (Movies &amp; Series)
              </button>
              <button
                onClick={() => setFilterType('movie')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === 'movie'
                    ? 'bg-[#F5C400] text-black shadow-md'
                    : 'text-[#A6A6AC] hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Movies Only</span>
              </button>
              <button
                onClick={() => setFilterType('tv')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === 'tv'
                    ? 'bg-[#F5C400] text-black shadow-md'
                    : 'text-[#A6A6AC] hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>TV Shows Only</span>
              </button>
            </div>

            {/* Optional Genre Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold hidden sm:inline">Genre:</span>
              <select
                value={selectedGenreId || ''}
                onChange={(e) => setSelectedGenreId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                className="bg-[#232328] border border-[#3A3A40] text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#F5C400] cursor-pointer"
              >
                <option value="">All Genres</option>
                {ALL_GENRES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Lucky Winner Spotlight Banner (if selected) */}
        {spotlightWinner && (
          <div
            id="lucky-winner-spotlight"
            className="mb-10 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#202026] via-[#1a1a20] to-[#141418] border border-[#F5C400]/40 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-80 h-full opacity-20 pointer-events-none overflow-hidden">
              <img
                src={spotlightWinner.backdropPath || spotlightWinner.posterPath}
                alt=""
                className="w-full h-full object-cover blur-xs"
              />
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
              <div className="relative aspect-[2/3] w-28 sm:w-32 rounded-xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
                <img
                  src={spotlightWinner.posterPath}
                  alt={spotlightWinner.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F5C400] text-black text-[10px] font-black uppercase tracking-wider mb-2">
                  <Flame className="w-3 h-3 fill-black" />
                  <span>Random Spotlight Winner</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                  {spotlightWinner.title}
                </h2>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-slate-300 mt-1 mb-2">
                  <span className="text-[#F5C400] font-bold">★ {spotlightWinner.voteAverage.toFixed(1)}</span>
                  <span>·</span>
                  <span>{spotlightWinner.releaseDate ? new Date(spotlightWinner.releaseDate).getFullYear() : 'Recent'}</span>
                  <span>·</span>
                  <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10">{spotlightWinner.mediaType}</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 max-w-2xl">
                  {spotlightWinner.overview || 'Stream this title in high definition on T Stream.'}
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                  <button
                    onClick={() => onWatchMedia(spotlightWinner)}
                    className="px-5 py-2.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Watch This Now</span>
                  </button>
                  <button
                    onClick={() => onSelectMedia(spotlightWinner)}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>Details &amp; Trailer</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 20 Random Items Grid */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-[#F5C400]" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              20 Random Suggestions
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Showing {items.length} titles
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-[#1c1c22] rounded-xl overflow-hidden aspect-[2/3] border border-[#2d2d33]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {items.map((item, idx) => (
              <div
                key={`${item.id}_${idx}`}
                onClick={() => onSelectMedia(item)}
                className="group relative bg-[#1c1c22] rounded-xl overflow-hidden border border-[#303036] hover:border-[#F5C400] transition-all duration-200 cursor-pointer flex flex-col shadow-md hover:shadow-amber-500/10 hover:-translate-y-1"
              >
                {/* Poster */}
                <div className="relative aspect-[2/3] w-full bg-[#121215] overflow-hidden">
                  <img
                    src={item.posterPath}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

                  {/* Rating Top Left */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-bold text-[#F5C400] border border-[#F5C400]/20">
                    <Star className="w-2.5 h-2.5 fill-[#F5C400]" />
                    <span>{item.voteAverage ? item.voteAverage.toFixed(1) : '8.0'}</span>
                  </div>

                  {/* Type Top Right */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider text-slate-300 border border-white/10">
                    {item.mediaType === 'movie' ? 'Movie' : 'TV'}
                  </div>

                  {/* Hover Center Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatchMedia(item);
                      }}
                      className="w-11 h-11 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-xl shadow-amber-500/30 transform transition-transform group-hover:scale-110 cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </button>
                  </div>

                  {/* Bottom Year & Genres */}
                  <div className="absolute bottom-2 inset-x-2">
                    <h4 className="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-[#F5C400] transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                      <span>{item.releaseDate ? new Date(item.releaseDate).getFullYear() : 'Cinema'}</span>
                      {item.genres?.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="truncate">{item.genres[0].name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Reshuffle Bar */}
        <div className="mt-12 text-center p-8 rounded-2xl bg-[#1c1c22] border border-[#303036]">
          <h3 className="text-lg font-bold text-white mb-2">
            Still haven&apos;t found the right title?
          </h3>
          <p className="text-xs text-[#A6A6AC] mb-5 max-w-md mx-auto">
            Click reshuffle to generate a brand new selection of 20 random movies and TV shows from our database.
          </p>
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              loadRandom(filterType, selectedGenreId);
            }}
            disabled={isReshuffling}
            className="px-8 py-3.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-black text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Shuffle className={`w-4 h-4 ${isReshuffling ? 'animate-spin' : ''}`} />
            <span>Shuffle Again (20 New Picks)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
