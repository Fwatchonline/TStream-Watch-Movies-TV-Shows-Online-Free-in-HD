import React, { useState } from 'react';
import { Play, Info, Star, Plus, Check } from 'lucide-react';
import type { AnimeMedia } from '../../types/media';
import { animeMediaToMediaItem } from '../../services/animeCatalog';
import { isInWatchlist, toggleWatchlist } from '../../services/storage';

interface AnimeHeroProps {
  anime: AnimeMedia;
  onSelect: (anime: AnimeMedia) => void;
  onWatch: (anime: AnimeMedia) => void;
}

export const AnimeHero: React.FC<AnimeHeroProps> = ({ anime, onSelect, onWatch }) => {
  const [inWatchlist, setInWatchlist] = useState(() => isInWatchlist(anime.anilistId));
  const bgUrl = anime.bannerImage || anime.coverImage;
  const studio = anime.studios?.find((s) => s.isAnimationStudio)?.name || anime.studios?.[0]?.name;

  return (
    <section className="relative rounded-2xl overflow-hidden bg-[#141418] border border-[#32323a] shadow-2xl mb-8 min-h-[300px] sm:min-h-[370px] flex items-end">
      {bgUrl && (
        <img
          src={bgUrl}
          alt={anime.title}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-50"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#111115] via-[#111115]/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#111115] via-transparent to-[#111115]/40" />

      <div className="relative z-10 w-full p-5 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-end">
        {anime.coverImage && (
          <img
            src={anime.coverImage}
            alt={anime.title}
            referrerPolicy="no-referrer"
            className="hidden sm:block w-36 md:w-44 aspect-[2/3] rounded-xl object-cover border border-white/15 shadow-2xl shrink-0 bg-[#1a1a20]"
          />
        )}

        <div className="max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#D1D1D6] tabular-nums">
            <span className="text-[#F5C400] font-extrabold uppercase tracking-wider">Featured Anime</span>
            {anime.voteAverage > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-white font-bold">
                  <Star className="w-3.5 h-3.5 fill-[#F5C400] text-[#F5C400]" />
                  {anime.voteAverage.toFixed(1)}
                </span>
              </>
            )}
            {anime.seasonYear && (
              <>
                <span>·</span>
                <span>{anime.seasonYear}</span>
              </>
            )}
            {anime.format && (
              <>
                <span>·</span>
                <span>{anime.format.replace(/_/g, ' ')}</span>
              </>
            )}
            {anime.episodesCount && (
              <>
                <span>·</span>
                <span>{anime.episodesCount} Episodes</span>
              </>
            )}
            {studio && (
              <>
                <span>·</span>
                <span className="text-white">{studio}</span>
              </>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            {anime.title}
          </h1>

          {(anime.romajiTitle && anime.romajiTitle !== anime.title) && (
            <p className="text-xs text-[#A6A6AC] font-medium">
              {anime.romajiTitle}
              {anime.nativeTitle ? ` · ${anime.nativeTitle}` : ''}
            </p>
          )}

          {anime.description && (
            <p className="text-xs sm:text-sm text-[#D1D1D6] line-clamp-3 leading-relaxed">
              {anime.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onWatch(anime)}
              className="px-5 py-2.5 rounded-xl bg-[#F5C400] hover:bg-[#ffcf14] text-black font-black text-xs sm:text-sm flex items-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer shadow-lg"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Watch Now</span>
            </button>

            <button
              type="button"
              onClick={() => onSelect(anime)}
              className="px-4 py-2.5 rounded-xl bg-[#27272e] hover:bg-[#32323b] text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-white/10 transition-colors cursor-pointer"
            >
              <Info className="w-4 h-4 text-[#F5C400]" />
              <span>Full Details</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const added = toggleWatchlist(animeMediaToMediaItem(anime));
                setInWatchlist(added);
              }}
              className={`px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 border transition-colors cursor-pointer ${
                inWatchlist
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-black/40 text-white border-white/15 hover:border-[#F5C400]'
              }`}
            >
              {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
