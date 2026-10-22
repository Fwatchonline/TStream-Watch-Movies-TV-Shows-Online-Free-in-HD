import React, { useState, useEffect } from 'react';
import { X, Sparkles, Play, Info, RefreshCw, Star } from 'lucide-react';
import { MediaItem } from '../types/media';
import { EXPANDED_CATALOG } from '../services/catalogData';

interface SurpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem) => void;
}

export const SurpriseModal: React.FC<SurpriseModalProps> = ({
  isOpen,
  onClose,
  onSelectMedia,
  onWatchMedia
}) => {
  const [pick, setPick] = useState<MediaItem>(EXPANDED_CATALOG[0]);
  const [rolling, setRolling] = useState(false);

  const roll = () => {
    setRolling(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * EXPANDED_CATALOG.length);
      setPick(EXPANDED_CATALOG[randomIndex]);
      setRolling(false);
    }, 300);
  };

  useEffect(() => {
    if (isOpen) {
      roll();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#29292D] border border-[#3A3A40] rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Backdrop Banner */}
        <div className="relative aspect-video w-full bg-[#232326] overflow-hidden">
          <img
            src={pick.backdropPath || pick.posterPath}
            alt={pick.title}
            className={`w-full h-full object-cover transition-opacity duration-300 ${rolling ? 'opacity-30' : 'opacity-80'}`}
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#29292D] via-[#29292D]/60 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F5C400] text-black text-[10px] font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-black" />
            <span>Random Pick</span>
          </div>

          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {pick.title}
            </h3>
            <div className="flex items-center gap-2 text-xs text-[#A6A6AC] mt-1">
              <span>{new Date(pick.releaseDate).getFullYear()}</span>
              <span>·</span>
              <span>{pick.mediaType === 'movie' ? 'Movie' : 'TV Series'}</span>
              <span>·</span>
              <span className="flex items-center gap-1 text-[#F5C400] font-bold tabular-nums">
                <Star className="w-3 h-3 fill-[#F5C400]" />
                {pick.voteAverage.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Content & Actions */}
        <div className="p-5">
          <p className="text-xs text-[#A6A6AC] line-clamp-3 leading-relaxed mb-6">
            {pick.overview}
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => {
                onWatchMedia(pick);
                onClose();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black text-black" />
              <span>Watch Now</span>
            </button>

            <button
              onClick={() => {
                onSelectMedia(pick);
                onClose();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#303035] hover:bg-[#3A3A40] text-[#F3F3F3] font-semibold text-xs sm:text-sm border border-[#3A3A40] transition-all cursor-pointer"
            >
              <Info className="w-4 h-4 text-[#A6A6AC]" />
              <span>Details</span>
            </button>

            <button
              onClick={roll}
              disabled={rolling}
              className="px-3 h-11 rounded-xl bg-[#232326] hover:bg-[#303035] text-[#A6A6AC] hover:text-white border border-[#3A3A40] transition-colors flex items-center justify-center cursor-pointer"
              title="Roll Another Title"
            >
              <RefreshCw className={`w-4 h-4 ${rolling ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
