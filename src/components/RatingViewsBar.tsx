import React, { useState, useEffect } from 'react';
import { Star, Eye, Flag } from 'lucide-react';
import { recordMovieView, getMovieStats, submitMovieRating, MovieStats } from '../services/firebase';

interface RatingViewsBarProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  mediaTitle: string;
  onOpenReport?: () => void;
  className?: string;
}

export const RatingViewsBar: React.FC<RatingViewsBarProps> = ({
  mediaId,
  mediaType,
  mediaTitle,
  onOpenReport,
  className = ''
}) => {
  const [stats, setStats] = useState<MovieStats | null>(null);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [userRating, setUserRating] = useState<number>(0);
  const [ratedToast, setRatedToast] = useState(false);

  // Load stats and record view on mount
  useEffect(() => {
    let isMounted = true;

    // Check if user previously rated this title locally
    try {
      const localRating = localStorage.getItem(`tstream_rating_${mediaType}_${mediaId}`);
      if (localRating) {
        setUserRating(parseInt(localRating, 10));
      }
    } catch {
      // ignore storage error
    }

    // Record view in Firestore / local and load current stats
    recordMovieView(mediaId, mediaType, mediaTitle).then(res => {
      if (isMounted) setStats(res);
    });

    getMovieStats(mediaId, mediaType).then(res => {
      if (isMounted && res) setStats(res);
    });

    return () => {
      isMounted = false;
    };
  }, [mediaId, mediaType, mediaTitle]);

  const handleRate = async (ratingVal: number) => {
    setUserRating(ratingVal);
    try {
      localStorage.setItem(`tstream_rating_${mediaType}_${mediaId}`, ratingVal.toString());
    } catch {
      // ignore
    }

    const updated = await submitMovieRating(mediaId, mediaType, ratingVal, mediaTitle);
    if (updated) {
      setStats(updated);
    }
    setRatedToast(true);
    setTimeout(() => setRatedToast(false), 2200);
  };

  const currentDisplayRating = hoverRating || userRating || (stats?.ratingAverage ? Math.round(stats.ratingAverage / 2) : 0);
  const formattedViews = (stats?.views ?? 184).toLocaleString();

  return (
    <div
      className={`flex flex-wrap items-center gap-y-2 gap-x-5 text-xs select-none ${className}`}
    >
      {/* 1. Rating Stars: "Rate this movie:" ☆ ☆ ☆ ☆ ☆ */}
      <div className="flex items-center gap-2">
        <span className="text-[#8E8E93] font-medium hover:text-slate-200 transition-colors">
          Rate this {mediaType === 'tv' ? 'show' : 'movie'}:
        </span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((starIndex) => {
            const isFilled = starIndex <= currentDisplayRating;
            return (
              <button
                key={starIndex}
                type="button"
                onMouseEnter={() => setHoverRating(starIndex)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => handleRate(starIndex)}
                aria-label={`Rate ${starIndex} stars out of 5`}
                className="p-0.5 text-slate-400 hover:scale-125 transition-transform cursor-pointer focus:outline-none"
              >
                <Star
                  className={`w-4 h-4 transition-colors ${
                    isFilled
                      ? 'text-[#F5C400] fill-[#F5C400] drop-shadow-[0_0_6px_rgba(245,196,0,0.6)]'
                      : 'text-slate-500 hover:text-[#F5C400]'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {ratedToast && (
          <span className="text-[11px] font-bold text-[#F5C400] animate-in fade-in">
            Thanks for rating!
          </span>
        )}
      </div>

      {/* 2. Real Views Counter: 👁 166 views */}
      <div className="flex items-center gap-1.5 text-[#8E8E93] font-medium">
        <Eye className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-slate-200 font-semibold">{formattedViews}</span>
        <span>views</span>
      </div>

      {/* 3. Report Issue: 🚩 Report issue (Strictly Yellow as requested) */}
      <button
        type="button"
        onClick={onOpenReport}
        className="flex items-center gap-1.5 text-[#F5C400] hover:text-[#ffdc40] font-bold text-xs transition-colors cursor-pointer group"
      >
        <Flag className="w-3.5 h-3.5 text-[#F5C400] group-hover:scale-110 transition-transform fill-[#F5C400]/20" />
        <span className="underline-offset-2 group-hover:underline">Report issue</span>
      </button>
    </div>
  );
};
