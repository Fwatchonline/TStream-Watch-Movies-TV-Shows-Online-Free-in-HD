import React, { useState, useEffect } from 'react';
import { Play, Flame, Zap, Calendar, Clock, Star } from 'lucide-react';
import { NewEpisodeItem, episodeItemToMediaItem } from '../../services/newEpisodes';
import { MediaItem } from '../../types/media';
import { buildImageProxyUrl, isProxiedImagePath, resolveSafeImageSrc } from '../../utils/imageUrl';

interface EpisodeCardProps {
  episode: NewEpisodeItem;
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem, season?: number, episode?: number) => void;
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({
  episode,
  onSelectMedia,
  onWatchMedia
}) => {
  const media = episodeItemToMediaItem(episode);
  const rawPrimary = episode.stillPath || episode.showBackdrop || episode.showPoster;
  const rawSecondary = episode.showBackdrop || episode.showPoster;
  const [imgSrc, setImgSrc] = useState<string>(() => resolveSafeImageSrc(rawPrimary));
  const [fallbackStep, setFallbackStep] = useState(0);

  useEffect(() => {
    setImgSrc(resolveSafeImageSrc(rawPrimary));
    setFallbackStep(0);
  }, [episode.id, rawPrimary]);

  const handleImageError = () => {
    if (fallbackStep === 0 && rawPrimary && !isProxiedImagePath(imgSrc)) {
      setImgSrc(buildImageProxyUrl(rawPrimary));
      setFallbackStep(1);
      return;
    }
    if (fallbackStep <= 1 && rawSecondary && rawSecondary !== rawPrimary) {
      setImgSrc(resolveSafeImageSrc(rawSecondary));
      setFallbackStep(2);
      return;
    }
    setFallbackStep(3);
  };

  const handleWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWatchMedia(media, episode.seasonNumber, episode.episodeNumber);
  };

  const handleSelect = () => {
    onSelectMedia(media);
  };

  const renderReleaseBadge = () => {
    if (episode.releasePeriod === 'today') {
      return (
        <span className="px-2 py-0.5 rounded bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-[9px] uppercase tracking-wide flex items-center gap-1 shadow-sm">
          <Flame className="w-2.5 h-2.5 fill-white" />
          <span>Today</span>
        </span>
      );
    } else if (episode.releasePeriod === 'yesterday') {
      return (
        <span className="px-2 py-0.5 rounded bg-[#F5C400] text-black font-black text-[9px] uppercase tracking-wide flex items-center gap-1 shadow-sm">
          <Zap className="w-2.5 h-2.5 fill-black text-black" />
          <span>Yesterday</span>
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 rounded bg-[#2a2a30] border border-white/10 text-slate-300 font-bold text-[9px] flex items-center gap-1">
          <Calendar className="w-2.5 h-2.5 text-[#F5C400]" />
          <span>{episode.relativeTimeText || 'This Week'}</span>
        </span>
      );
    }
  };

  return (
    <div
      onClick={handleSelect}
      className="shrink-0 snap-start w-[240px] xs:w-[260px] sm:w-[280px] group cursor-pointer flex flex-col rounded-xl overflow-hidden bg-[#29292D] border border-[#3A3A40] hover:border-[#F5C400] transition-all duration-200 select-none hover:-translate-y-1 shadow-md hover:shadow-xl"
    >
      {/* 16:9 Landscape Video Still / Backdrop */}
      <div className="relative aspect-video w-full bg-[#1b1b20] overflow-hidden">
        {imgSrc && fallbackStep < 3 ? (
          <img
            src={imgSrc}
            alt={episode.episodeName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        ) : null}

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

        {/* Season & Episode Tag (Top Left) */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-black/85 backdrop-blur-md border border-white/15 text-white font-mono font-black text-[10px] tracking-tight shadow">
            S{episode.seasonNumber} · E{episode.episodeNumber}
          </span>
        </div>

        {/* Release Status Badge (Top Right) */}
        <div className="absolute top-2 right-2">
          {renderReleaseBadge()}
        </div>

        {/* Hover Play Button Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center backdrop-blur-[1px]">
          <button
            onClick={handleWatch}
            className="w-10 h-10 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform cursor-pointer"
            title={`Play S${episode.seasonNumber} E${episode.episodeNumber}`}
          >
            <Play className="w-4 h-4 fill-black text-black ml-0.5" />
          </button>
        </div>

        {/* Rating & Air Date at bottom of thumbnail */}
        <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-between text-[10px] pointer-events-none">
          <span className="text-slate-300 font-medium truncate max-w-[170px]">
            &quot;{episode.episodeName}&quot;
          </span>
          {episode.voteAverage > 0 && (
            <span className="flex items-center gap-0.5 text-[#F5C400] font-bold">
              ★ {episode.voteAverage.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Card Info Body */}
      <div className="p-3 flex flex-col justify-between flex-1">
        <div>
          <div className="flex items-start justify-between gap-1">
            <h4
              className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors truncate leading-tight"
              title={episode.showTitle}
            >
              {episode.showTitle}
            </h4>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#A6A6AC] shrink-0">
              TV
            </span>
          </div>

          <p className="text-[10px] text-[#A6A6AC] line-clamp-2 mt-1 leading-relaxed">
            {episode.overview}
          </p>
        </div>

        {/* Watch Button Strip */}
        <button
          type="button"
          onClick={handleWatch}
          className="mt-3 w-full h-7 rounded-lg bg-[#303035] group-hover:bg-[#F5C400] group-hover:text-black text-white text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[#3A3A40] group-hover:border-[#F5C400]"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Watch Episode</span>
        </button>
      </div>
    </div>
  );
};
