import React from 'react';
import { ALL_GENRES } from '../../services/catalogData';
import {
  Compass,
  Zap,
  Mountain,
  Smile,
  Ghost,
  Heart,
  Skull,
  Rocket,
  Flame,
  Search,
  Sparkles,
  Shield,
  Film,
  Music,
  Tv,
  ArrowRight
} from 'lucide-react';

interface MegaMenuGenresProps {
  onSelectGenre: (genreId: number, genreName: string) => void;
  onNavigate: (view: string, extraParams?: any) => void;
  selectedGenreId?: number | null;
  onClose: () => void;
}

// Assign visual icons for top genres
const GENRE_ICONS: Record<string, React.ReactNode> = {
  Action: <Zap className="w-3.5 h-3.5 text-amber-400" />,
  Adventure: <Mountain className="w-3.5 h-3.5 text-emerald-400" />,
  Animation: <Sparkles className="w-3.5 h-3.5 text-indigo-400" />,
  Comedy: <Smile className="w-3.5 h-3.5 text-yellow-400" />,
  Crime: <Shield className="w-3.5 h-3.5 text-red-400" />,
  Documentary: <Film className="w-3.5 h-3.5 text-blue-400" />,
  Drama: <Flame className="w-3.5 h-3.5 text-rose-400" />,
  Family: <Smile className="w-3.5 h-3.5 text-teal-400" />,
  Fantasy: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
  Horror: <Skull className="w-3.5 h-3.5 text-red-500" />,
  Music: <Music className="w-3.5 h-3.5 text-pink-400" />,
  Mystery: <Search className="w-3.5 h-3.5 text-violet-400" />,
  Romance: <Heart className="w-3.5 h-3.5 text-pink-500" />,
  'Science Fiction': <Rocket className="w-3.5 h-3.5 text-cyan-400" />,
  'TV Movie': <Tv className="w-3.5 h-3.5 text-orange-400" />,
  Thriller: <Ghost className="w-3.5 h-3.5 text-amber-500" />,
  War: <Shield className="w-3.5 h-3.5 text-stone-400" />,
  Western: <Compass className="w-3.5 h-3.5 text-orange-500" />
};

export const MegaMenuGenres: React.FC<MegaMenuGenresProps> = ({
  onSelectGenre,
  onNavigate,
  selectedGenreId,
  onClose
}) => {
  // Primary genres requested: Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, Horror, Mystery, Romance, Science Fiction, Thriller, War, Western
  const primaryGenres = ALL_GENRES.filter(g =>
    [
      'Action',
      'Adventure',
      'Animation',
      'Comedy',
      'Crime',
      'Documentary',
      'Drama',
      'Family',
      'Fantasy',
      'History',
      'Horror',
      'Music',
      'Mystery',
      'Romance',
      'Science Fiction',
      'Thriller',
      'War',
      'Western'
    ].includes(g.name)
  );

  return (
    <div className="w-[580px] p-4 bg-[#1e1e24] rounded-2xl border border-[#3A3A40] text-white">
      {/* Mega Menu Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#F5C400]/20 flex items-center justify-center text-[#F5C400]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-wide uppercase text-white">
              Explore By Genre
            </h4>
            <p className="text-[10px] text-[#8E8E93]">
              Discover thousands of titles categorized by story style and tone
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onNavigate('tags');
          }}
          className="text-[10px] font-bold text-[#F5C400] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>All Tags</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* 4-column Grid of Genres */}
      <div className="grid grid-cols-4 gap-1.5">
        {primaryGenres.map((g) => {
          const isSelected = selectedGenreId === g.id;
          const icon = GENRE_ICONS[g.name] || <Film className="w-3.5 h-3.5 text-[#8E8E93]" />;

          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onClose();
                onSelectGenre(g.id, g.name);
              }}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs transition-all cursor-pointer group ${
                isSelected
                  ? 'bg-[#F5C400] text-black font-bold shadow-sm'
                  : 'text-[#D1D1D6] hover:text-black hover:bg-[#F5C400] font-medium'
              }`}
            >
              <span className="shrink-0 transition-transform group-hover:scale-110">
                {icon}
              </span>
              <span className="truncate group-hover:text-black">{g.name}</span>
            </button>
          );
        })}
      </div>

      {/* Footer Quick Links */}
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#8E8E93]">
        <span className="text-[10px]">Filter by both Movies and TV Series</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('movies');
            }}
            className="hover:text-[#F5C400] font-semibold transition-colors cursor-pointer"
          >
            All Movies &rarr;
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('tv-shows');
            }}
            className="hover:text-[#F5C400] font-semibold transition-colors cursor-pointer"
          >
            All TV Series &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
