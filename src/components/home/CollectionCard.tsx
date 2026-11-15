import React from 'react';
import { Layers, ChevronRight } from 'lucide-react';
import { DiscoveredCollection } from '../../services/collectionStore';
import {
  buildImageProxyUrl,
  isProxiedImagePath,
  resolveSafeImageSrc,
  unwrapImageProxyUrl
} from '../../utils/imageUrl';

interface CollectionCardProps {
  collection: DiscoveredCollection;
  onClick: (col: DiscoveredCollection) => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  onClick
}) => {
  const parts = collection.parts || [];
  const filmCount = parts.length || 1;

  // Extract up to 3 posters for the fanned artwork
  const fallbackPoster = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80';
  const collectionPoster = resolveSafeImageSrc(collection.posterPath) || fallbackPoster;
  const posterCenter = resolveSafeImageSrc(parts[0]?.posterPath) || collectionPoster;
  const posterLeft = resolveSafeImageSrc(parts[1]?.posterPath || parts[0]?.posterPath) || collectionPoster;
  const posterRight = resolveSafeImageSrc(parts[2]?.posterPath || parts[1]?.posterPath) || collectionPoster;
  const safeBackdrop = resolveSafeImageSrc(collection.backdropPath);

  const handlePosterError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackStage === 'done') return;

    const currentUrl = img.getAttribute('src') || '';
    if (!img.dataset.proxyTried && currentUrl.startsWith('http') && !isProxiedImagePath(currentUrl)) {
      img.dataset.proxyTried = '1';
      img.src = buildImageProxyUrl(currentUrl);
      return;
    }

    if (!img.dataset.fallbackStage && unwrapImageProxyUrl(currentUrl) !== unwrapImageProxyUrl(collectionPoster)) {
      img.dataset.fallbackStage = 'collection';
      img.dataset.proxyTried = '';
      img.src = collectionPoster;
      return;
    }
    if (currentUrl !== fallbackPoster) {
      img.dataset.fallbackStage = 'done';
      img.src = fallbackPoster;
    }
  };

  return (
    <div
      onClick={() => onClick(collection)}
      className="shrink-0 snap-start w-[230px] sm:w-[260px] group cursor-pointer flex flex-col rounded-xl overflow-hidden bg-[#29292D] border border-[#3A3A40] hover:border-[#F5C400] transition-all duration-300 select-none hover:-translate-y-1.5 shadow-lg hover:shadow-2xl"
    >
      {/* Visual Area: 3 Fanned / Overlapping Posters */}
      <div className="relative h-[190px] sm:h-[200px] w-full overflow-hidden bg-gradient-to-b from-[#1c1c22] via-[#22222a] to-[#29292D] flex items-center justify-center pt-2">
        {/* Subtle Backdrop Ambient Glow */}
        {safeBackdrop && (
          <div className="absolute inset-0 z-0 opacity-15 overflow-hidden">
            <img
              src={safeBackdrop}
              alt=""
              className="w-full h-full object-cover filter blur-md"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* 3-Poster Layered Stack Container */}
        <div className="relative z-10 flex items-center justify-center w-full h-full pb-3">
          {/* Left Poster (tilted left) */}
          <div className="absolute w-[85px] sm:w-[95px] aspect-[2/3] rounded-md overflow-hidden shadow-lg border border-white/10 transform -rotate-10 -translate-x-8 sm:-translate-x-9 translate-y-1 group-hover:-translate-x-11 group-hover:-rotate-14 transition-all duration-300 opacity-75 bg-[#18181c]">
            <img
              src={posterLeft}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handlePosterError}
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>

          {/* Right Poster (tilted right) */}
          <div className="absolute w-[85px] sm:w-[95px] aspect-[2/3] rounded-md overflow-hidden shadow-lg border border-white/10 transform rotate-10 translate-x-8 sm:translate-x-9 translate-y-1 group-hover:translate-x-11 group-hover:rotate-14 transition-all duration-300 opacity-75 bg-[#18181c]">
            <img
              src={posterRight}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handlePosterError}
            />
            <div className="absolute inset-0 bg-black/25" />
          </div>

          {/* Center Poster (straight, elevated in front) */}
          <div className="relative z-20 w-[100px] sm:w-[110px] aspect-[2/3] rounded-md overflow-hidden shadow-2xl border border-[#F5C400]/40 group-hover:border-[#F5C400] transform group-hover:scale-105 group-hover:-translate-y-1 transition-all duration-300 bg-[#18181c]">
            <img
              src={posterCenter}
              alt={collection.name}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handlePosterError}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Top Franchise Indicator */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs border border-white/10 text-[9px] font-bold text-[#F5C400] uppercase tracking-wider">
          <Layers className="w-2.5 h-2.5" />
          <span>Franchise</span>
        </div>
      </div>

      {/* Info Body */}
      <div className="p-3.5 flex flex-col justify-between flex-1 border-t border-[#3A3A40]/60">
        <div>
          <h4
            className="text-xs sm:text-sm font-bold text-white group-hover:text-[#F5C400] transition-colors truncate leading-tight"
            title={collection.name}
          >
            {collection.name}
          </h4>

          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
            <span className="font-extrabold text-[#F5C400]">
              {filmCount} {filmCount === 1 ? 'Movie' : 'Movies'}
            </span>
            <span aria-hidden="true" className="text-[#555560]">·</span>
            <span className="text-[#A6A6AC] font-medium">Complete Saga</span>
          </div>

          {collection.overview && (
            <p className="text-[10px] text-[#A6A6AC] line-clamp-2 mt-1.5 leading-relaxed">
              {collection.overview}
            </p>
          )}
        </div>

        {/* View Collection Action */}
        <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-[#A6A6AC] group-hover:text-[#F5C400] transition-colors">
          <span>View Collection</span>
          <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
};
