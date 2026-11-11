import React, { useState } from 'react';
import { Play, Star, Plus, Check } from 'lucide-react';
import { MediaItem, MediaType } from '../types/media';
import { isInWatchlist, toggleWatchlist } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { QualityBadge } from './QualityBadge';

interface MediaCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  onWatch?: (item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onSelect, onWatch }) => {
  const { user, isInWatchlist: isCloudInWatchlist, toggleWatchlist: toggleCloudWatchlist } = useAuth();
  const [inWatchlist, setInWatchlist] = useState(() => (user ? isCloudInWatchlist(item.id) : isInWatchlist(item.id)));
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
    if (user) {
      setInWatchlist(isCloudInWatchlist(item.id));
    }
  }, [user, isCloudInWatchlist, item.id]);

  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '—';
  const isMovie = item.mediaType === 'movie';

  const handleWatchlistClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const localState = toggleWatchlist({
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      releaseDate: item.releaseDate,
      voteAverage: item.voteAverage
    });

    if (user) {
      const cloudState = await toggleCloudWatchlist(item);
      setInWatchlist(cloudState);
    } else {
      setInWatchlist(localState);
    }
  };

  const handleWatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onWatch) {
      onWatch(item);
    } else {
      onSelect(item);
    }
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative cursor-pointer flex flex-col rounded-xl overflow-hidden bg-[#303035] border border-[#3A3A40] hover:border-[#F5C400] transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/60"
    >
      {/* Poster Media Box */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#29292D]">
        {!imageError && item.posterPath ? (
          <img
            src={item.posterPath}
            alt={item.title}
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#29292D] to-[#232326]">
            <Play className="w-10 h-10 text-white/20 mb-2" />
            <span className="text-xs font-medium text-[#A6A6AC] line-clamp-2">{item.title}</span>
          </div>
        )}

        {/* Rating Badge */}
        {item.voteAverage > 0 && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 flex items-center gap-1 text-[11px] font-semibold text-[#F5C400] tabular-nums">
            <Star className="w-3 h-3 fill-[#F5C400] text-[#F5C400]" />
            <span>{item.voteAverage.toFixed(1)}</span>
          </div>
        )}

        {/* Real Quality Tag */}
        <div className="absolute top-2.5 right-2.5">
          <QualityBadge item={item} variant="card" />
        </div>

        {/* Quick Action Overlay on Hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3 backdrop-blur-[2px]">
          <button
            onClick={handleWatchClick}
            className="w-11 h-11 rounded-full bg-[#F5C400] text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg shadow-amber-500/30 cursor-pointer"
            title="Watch Now"
          >
            <Play className="w-5 h-5 fill-black text-black ml-0.5" />
          </button>
          <button
            onClick={handleWatchlistClick}
            className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
              inWatchlist
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-black/60 border-white/30 text-white hover:border-white hover:bg-black/80'
            }`}
            title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
          >
            {inWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Card Content & Zero-Pill Typography */}
      <div className="p-3 flex flex-col flex-grow justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F3F3F3] group-hover:text-[#F5C400] transition-colors line-clamp-1 leading-snug">
            {item.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-[#A6A6AC]">
            <span>{year}</span>
            <span aria-hidden="true" className="text-[#55555c]">·</span>
            <span>{isMovie ? (item.runtime ? `${item.runtime}m` : 'Movie') : (item.numberOfSeasons ? `${item.numberOfSeasons} Seasons` : 'TV Series')}</span>
          </div>
        </div>

        {item.genres && item.genres.length > 0 && (
          <div className="mt-2 text-[11px] text-slate-500 truncate">
            {item.genres.slice(0, 2).map(g => g.name).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};
