import React, { useState } from 'react';
import {
  Play,
  Film,
  Plus,
  Check,
  Share2,
  Star,
  ExternalLink,
  Clock,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { MediaDetail, MediaType, MediaItem } from '../types/media';
import { isInWatchlist, toggleWatchlist, isWatched, toggleWatched } from '../services/storage';
import { useAuth } from '../context/AuthContext';

interface DetailsHeroProps {
  media: MediaDetail;
  onWatchNow: () => void;
  onOpenTrailer: () => void;
  onSelectTag?: (tag: string) => void;
}

export const DetailsHero: React.FC<DetailsHeroProps> = ({
  media,
  onWatchNow,
  onOpenTrailer,
  onSelectTag
}) => {
  const { user, isInWatchlist: isCloudInWatchlist, toggleWatchlist: toggleCloudWatchlist } = useAuth();
  const [inWatchlist, setInWatchlist] = useState(() => (user ? isCloudInWatchlist(media.id) : isInWatchlist(media.id)));
  const [watched, setWatched] = useState(() => isWatched(media.id));
  const [copied, setCopied] = useState(false);
  const [posterError, setPosterError] = useState(false);

  // Keep state updated if cloud watchlist changes
  React.useEffect(() => {
    if (user) {
      setInWatchlist(isCloudInWatchlist(media.id));
    }
  }, [user, isCloudInWatchlist, media.id]);

  const isMovie = media.mediaType === 'movie';
  const releaseYear = media.releaseDate ? new Date(media.releaseDate).getFullYear() : '—';
  const hasTrailer = media.videos && media.videos.length > 0;

  const handleWatchlistToggle = async () => {
    // Local storage toggle
    const localNext = toggleWatchlist({
      id: media.id,
      mediaType: media.mediaType,
      title: media.title,
      posterPath: media.posterPath,
      backdropPath: media.backdropPath,
      releaseDate: media.releaseDate,
      voteAverage: media.voteAverage
    });

    if (user) {
      const cloudNext = await toggleCloudWatchlist({
        id: media.id,
        mediaType: media.mediaType,
        title: media.title,
        posterPath: media.posterPath,
        voteAverage: media.voteAverage,
        releaseDate: media.releaseDate,
        overview: media.overview || ''
      });
      setInWatchlist(cloudNext);
    } else {
      setInWatchlist(localNext);
    }
  };

  const handleWatchedToggle = () => {
    const nextState = toggleWatched(media.id);
    setWatched(nextState);
  };

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="relative w-full overflow-hidden bg-[#0d0d0f] pb-12">
      {/* Full-bleed Backdrop Hero with Scrim Gradient */}
      <div className="absolute inset-0 h-[520px] sm:h-[620px] lg:h-[700px] w-full overflow-hidden select-none pointer-events-none">
        {media.backdropPath ? (
          <img
            src={media.backdropPath}
            alt={media.title}
            className="w-full h-full object-cover object-top opacity-35 scale-105 filter blur-[1px]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#181820] to-[#0d0d0f]" />
        )}
        {/* Multilayered cinematic scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0f] via-[#0d0d0f]/60 to-transparent" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-16 lg:pt-24">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          {/* Left Poster Frame */}
          <div className="w-48 sm:w-64 lg:w-72 shrink-0 mx-auto lg:mx-0 shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-[#16161c]">
            <div className="relative aspect-[2/3] w-full bg-[#1e1e26]">
              {!posterError && media.posterPath ? (
                <img
                  src={media.posterPath}
                  alt={media.title}
                  onError={() => setPosterError(true)}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <Film className="w-12 h-12 mb-3 text-slate-600" />
                  <span className="font-semibold text-sm">{media.title}</span>
                </div>
              )}

              {/* Quality badge */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                4K ULTRA HD
              </div>
            </div>
          </div>

          {/* Right Details Column */}
          <div className="flex-1 flex flex-col min-w-0 text-left">
            {/* Tagline */}
            {media.tagline && (
              <p className="text-xs sm:text-sm font-medium tracking-wide uppercase text-red-500 mb-1">
                {media.tagline}
              </p>
            )}

            {/* Title */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight text-balance leading-tight">
              {media.title}
            </h1>

            {/* Unboxed Metadata Strip (Zero-Pill Discipline per frontend-design skill) */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mt-3 text-xs sm:text-sm text-slate-300 font-medium">
              <span>{releaseYear}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>

              {isMovie ? (
                <span>{media.runtime ? `${Math.floor(media.runtime / 60)}h ${media.runtime % 60}m` : 'Feature'}</span>
              ) : (
                <span>{media.numberOfSeasons ? `${media.numberOfSeasons} Seasons` : 'Series'}</span>
              )}

              {media.certification && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="border border-white/20 px-1.5 py-0.2 rounded text-[11px] font-bold text-slate-200">
                    {media.certification}
                  </span>
                </>
              )}

              {media.genres && media.genres.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400">
                    {media.genres.map(g => g.name).join(', ')}
                  </span>
                </>
              )}
            </div>

            {/* Ratings Bar: Real TMDB & Legitimate IMDb link */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-white/5">
              {/* TMDB Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-amber-400 font-bold text-base sm:text-lg tabular-nums">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span>{media.voteAverage.toFixed(1)}</span>
                  <span className="text-xs font-normal text-slate-400">/ 10</span>
                </div>
                <span className="text-xs text-slate-400 tabular-nums">
                  ({media.voteCount.toLocaleString()} votes on TMDB)
                </span>
              </div>

              {/* Legitimate IMDb external link */}
              {media.imdbId && (
                <a
                  href={`https://www.imdb.com/title/${media.imdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f5c518] text-black font-extrabold text-xs hover:opacity-90 transition-opacity"
                  title="View on IMDb"
                >
                  <span>IMDb</span>
                  <ExternalLink className="w-3 h-3 text-black/80" />
                </a>
              )}
            </div>

            {/* Action Buttons Strip */}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              {/* Primary Watch Now CTA */}
              <button
                onClick={onWatchNow}
                className="inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-extrabold text-sm sm:text-base transition-all shadow-xl shadow-amber-500/20 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-black text-black" />
                <span>Watch Now</span>
              </button>

              {/* Watch Trailer */}
              {hasTrailer && (
                <button
                  onClick={onOpenTrailer}
                  className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-semibold text-sm transition-all border border-white/10"
                >
                  <Film className="w-4 h-4 text-slate-300" />
                  <span>Trailer</span>
                </button>
              )}

              {/* Watchlist Toggle */}
              <button
                onClick={handleWatchlistToggle}
                className={`inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl font-semibold text-sm transition-all border ${
                  inWatchlist
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
              </button>

              {/* Watched Toggle */}
              <button
                onClick={handleWatchedToggle}
                className={`inline-flex items-center justify-center gap-1.5 h-12 px-4 rounded-xl font-medium text-xs sm:text-sm transition-all border ${
                  watched
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
                title={watched ? 'Mark as unwatched' : 'Mark as watched'}
              >
                <Check className="w-4 h-4" />
                <span>{watched ? 'Watched' : 'Mark Watched'}</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-slate-300 hover:text-white text-xs sm:text-sm font-medium transition-all"
                title="Share link"
              >
                <Share2 className="w-4 h-4" />
                <span>{copied ? 'Link Copied!' : 'Share'}</span>
              </button>
            </div>

            {/* Overview / Synopsis */}
            <div className="mt-6 max-w-3xl">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Overview
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                {media.overview || 'No synopsis is available for this title.'}
              </p>
            </div>

            {/* Metadata Footer: Production, Countries, Languages */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-white/5 text-xs text-slate-400">
              {media.productionCompanies && media.productionCompanies.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-200 block mb-0.5">Studios</span>
                  <span>{media.productionCompanies.map(p => p.name).join(', ')}</span>
                </div>
              )}

              {media.productionCountries && media.productionCountries.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-200 block mb-0.5">Origin</span>
                  <span>{media.productionCountries.join(', ')}</span>
                </div>
              )}

              {media.spokenLanguages && media.spokenLanguages.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-200 block mb-0.5">Languages</span>
                  <span>{media.spokenLanguages.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Keywords / Tags */}
            {media.keywords && media.keywords.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 mr-1">Tags:</span>
                {media.keywords.map(kw => (
                  <button
                    key={kw.id}
                    onClick={() => onSelectTag && onSelectTag(kw.name)}
                    className="px-2.5 py-1 rounded bg-[#1c1c24] hover:bg-[#252530] text-slate-300 hover:text-white text-xs font-medium transition-colors border border-white/5"
                  >
                    #{kw.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
