import React from 'react';
import { MediaItem } from '../types/media';
import { getMediaQuality, QualityInfo } from '../services/quality';

export interface QualityBadgeProps {
  item?: Partial<MediaItem> | null;
  quality?: QualityInfo;
  variant?: 'card' | 'full' | 'pill' | 'player';
  className?: string;
  showFormat?: boolean; // Also show TV / Movie tag if needed
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({
  item,
  quality: explicitQuality,
  variant = 'card',
  className = '',
  showFormat = false
}) => {
  const quality = explicitQuality || getMediaQuality(item);
  const isMovie = item?.mediaType !== 'tv';

  if (variant === 'card') {
    return (
      <div
        className={`px-1.5 py-0.5 rounded-md backdrop-blur-md border text-[10px] font-black uppercase tracking-wider tabular-nums select-none ${quality.badgeClass} ${className}`}
        title={quality.fullLabel}
      >
        {quality.label}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md backdrop-blur-md border text-xs font-black uppercase tracking-wider select-none ${quality.badgeClass} ${className}`}
        title={`Native Stream Quality: ${quality.resolution}`}
      >
        <span>{quality.fullLabel}</span>
      </div>
    );
  }

  if (variant === 'player') {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border text-[11px] font-extrabold uppercase tracking-wider select-none ${quality.badgeClass} ${className}`}
        title={`Stream Resolution: ${quality.resolution}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        <span>{quality.label}</span>
      </div>
    );
  }

  // Pill variant
  return (
    <span
      className={`px-2 py-0.5 rounded font-extrabold text-xs uppercase tracking-wide border ${quality.badgeClass} ${className}`}
      title={quality.fullLabel}
    >
      {showFormat && <span className="opacity-75 mr-1">{isMovie ? 'Movie' : 'Series'} ·</span>}
      {quality.label}
    </span>
  );
};
