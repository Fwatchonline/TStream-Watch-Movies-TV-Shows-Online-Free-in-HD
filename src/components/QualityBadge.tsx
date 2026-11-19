import React from 'react';
import { MediaItem } from '../types/media';
import { getMediaQuality, QualityInfo } from '../services/quality';

export interface QualityBadgeProps {
  item?: Partial<MediaItem> | null;
  quality?: QualityInfo;
  variant?: 'card' | 'full' | 'pill' | 'player';
  className?: string;
  showFormat?: boolean;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({
  item,
  quality: explicitQuality,
  variant = 'card',
  className = '',
  showFormat = false
}) => {
  const quality = explicitQuality || getMediaQuality(item);
  const isAnime = item?.mediaType === 'anime';
  const isMovie = item?.mediaType === 'movie';
  const formatLabel = isAnime ? 'Anime' : isMovie ? 'Movie' : 'Series';

  // Never show fabricated quality pills on browse cards unless stream resolution was genuinely verified
  if (!quality.verified || quality.tag === 'Unknown') {
    if (variant === 'card') {
      return null;
    }
    if (variant === 'player') {
      return (
        <div
          className={`inline-flex items-center px-2 py-0.5 rounded-md bg-black/80 border border-white/15 text-[11px] font-bold uppercase tracking-wider text-zinc-300 select-none ${className}`}
          title="Adaptive stream resolution checks automatically once playback begins"
        >
          <span>Auto</span>
        </div>
      );
    }
    if (variant === 'full') {
      return null;
    }
  }

  if (variant === 'card') {
    return (
      <div
        className={`px-1.5 py-0.5 rounded-md backdrop-blur-md border text-[10px] font-black uppercase tracking-wider tabular-nums select-none ${quality.badgeClass} ${className}`}
        title={`Verified Stream Quality: ${quality.fullLabel}`}
      >
        {quality.label}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md backdrop-blur-md border text-xs font-black uppercase tracking-wider select-none tabular-nums ${quality.badgeClass} ${className}`}
        title={`Verified Stream Quality: ${quality.resolution}`}
      >
        <span>{quality.fullLabel}</span>
      </div>
    );
  }

  if (variant === 'player') {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border text-[11px] font-extrabold uppercase tracking-wider select-none tabular-nums ${quality.badgeClass} ${className}`}
        title={`Verified Resolution: ${quality.resolution}`}
      >
        <span>{quality.label}</span>
      </div>
    );
  }

  return (
    <span
      className={`px-2 py-0.5 rounded font-extrabold text-xs uppercase tracking-wide border tabular-nums ${quality.badgeClass} ${className}`}
      title={quality.fullLabel}
    >
      {showFormat && <span className="opacity-75 mr-1">{formatLabel} ·</span>}
      {quality.label}
    </span>
  );
};
