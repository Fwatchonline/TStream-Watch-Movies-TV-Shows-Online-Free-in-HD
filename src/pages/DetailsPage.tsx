import React, { useState, useEffect } from 'react';
import {
  Play,
  Film,
  Bookmark,
  Check,
  Star,
  ExternalLink,
  Clock,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Share2,
  Flag,
  Eye,
  ChevronRight,
  Tv,
  Sparkles,
  X,
  Users,
  Flame,
  BellRing
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MediaDetail, MediaItem, VideoItem, TVDetail, Episode } from '../types/media';
import { getMediaDetail, fetchSeasonEpisodes } from '../services/tmdb';
import { isInWatchlist, toggleWatchlist } from '../services/storage';
import { TrailerModal } from '../components/TrailerModal';
import { CastCarousel } from '../components/CastCarousel';
import { RatingViewsBar } from '../components/RatingViewsBar';
import { QualityBadge } from '../components/QualityBadge';
import { PageLoadingIndicator } from '../components/PageLoadingIndicator';
import { ShareModal } from '../components/ShareModal';
import { ReportIssueModal } from '../components/ReportIssueModal';
import { getPlatformById } from '../services/platformData';
import { autoDiscoverMovieFranchise, DiscoveredCollection } from '../services/collectionStore';
import { createMediaSlug } from '../utils/slug';
import { updateMediaSEO } from '../utils/seo';

interface DetailsPageProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  onBack: () => void;
  onWatchNow: (media: MediaDetail, season?: number, episode?: number) => void;
  onSelectMedia: (item: MediaItem) => void;
  onSelectPerson?: (personId: number) => void;
  onSelectTag?: (tag: string) => void;
  onSelectGenre?: (genreId: number, genreName: string) => void;
  onNavigateCollections?: () => void;
  onSelectPlatform?: (platformId: string) => void;
}

export const DetailsPage: React.FC<DetailsPageProps> = ({
  mediaId,
  mediaType,
  onBack,
  onWatchNow,
  onSelectMedia,
  onSelectPerson,
  onSelectTag,
  onSelectGenre,
  onNavigateCollections,
  onSelectPlatform
}) => {
  const { user, toggleFollowShow, isFollowingShow } = useAuth();
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'cast' | 'videos' | 'similar' | 'recommended'>('cast');
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState<boolean>(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [selectedTrailerKey, setSelectedTrailerKey] = useState<string>('JfVOs4VSpmA');
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({ 0: true });
  const [autoCreatedFranchise, setAutoCreatedFranchise] = useState<DiscoveredCollection | null>(null);
  const [showAutoFranchiseToast, setShowAutoFranchiseToast] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      window.scrollTo({ top: 0, behavior: 'instant' as any });
      const data = await getMediaDetail(mediaId, mediaType);
      if (isMounted) {
        setDetail(data);
        if (data) {
          updateMediaSEO(data);
          const slug = createMediaSlug(data.title || (data as any).name, data.id);
          const expectedUrl = `/${data.mediaType}/${slug}`;
          if (!window.location.pathname.includes(slug)) {
            window.history.replaceState({}, '', expectedUrl);
          }
          setInWatchlist(isInWatchlist(data.id));
          const trailer = data.videos?.find(v => v.type?.toLowerCase() === 'trailer') || data.videos?.[0];
          if (trailer?.key) {
            setSelectedTrailerKey(trailer.key);
          }
          if (data.mediaType === 'tv') {
            setActiveTab('episodes');
            const tv = data as TVDetail;
            const initSeason = tv.seasons?.[0]?.seasonNumber ?? 1;
            setSelectedSeasonNumber(initSeason);
            if (tv.seasons?.[0]?.episodes && tv.seasons[0].episodes.length > 0) {
              setSeasonEpisodes(tv.seasons[0].episodes);
            } else {
              setEpisodesLoading(true);
              fetchSeasonEpisodes(data.id, initSeason)
                .then(eps => {
                  if (isMounted) {
                    setSeasonEpisodes(eps);
                    if (tv.seasons?.[0]) tv.seasons[0].episodes = eps;
                  }
                })
                .finally(() => {
                  if (isMounted) setEpisodesLoading(false);
                });
            }
          } else {
            setActiveTab('cast');
            // Auto-create and discover franchise collection (e.g. Pirates, Avatar, Fast & Furious)
            autoDiscoverMovieFranchise(data).then(franchise => {
              if (isMounted && franchise) {
                setAutoCreatedFranchise(franchise);
                setShowAutoFranchiseToast(true);
                setDetail(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    belongsToCollection: franchise
                  } as any;
                });
              }
            });
          }
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [mediaId, mediaType]);

  const handleSelectSeason = async (seasonNum: number) => {
    setSelectedSeasonNumber(seasonNum);
    if (!detail) return;
    const tv = detail as TVDetail;
    const targetSeason = tv?.seasons?.find(s => s.seasonNumber === seasonNum);
    if (targetSeason?.episodes && targetSeason.episodes.length > 0) {
      setSeasonEpisodes(targetSeason.episodes);
      return;
    }
    setEpisodesLoading(true);
    try {
      const eps = await fetchSeasonEpisodes(detail.id, seasonNum);
      setSeasonEpisodes(eps);
      if (targetSeason) {
        targetSeason.episodes = eps;
      }
    } catch (err) {
      console.warn('Failed to fetch season episodes:', err);
    } finally {
      setEpisodesLoading(false);
    }
  };

  if (loading || !detail) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <PageLoadingIndicator label="Loading title details..." />
      </div>
    );
  }

  const isMovie = detail.mediaType === 'movie';
  const movieDetail = isMovie ? (detail as any) : null;
  const tvDetail = !isMovie ? (detail as TVDetail) : null;
  const releaseYear = detail.releaseDate ? new Date(detail.releaseDate).getFullYear() : '2026';

  // Compute all available seasons so no seasons are ever missed
  const allSeasons = (() => {
    if (!tvDetail) return [];
    const list = Array.isArray(tvDetail.seasons) ? [...tvDetail.seasons] : [];
    const maxSeason = Math.max(
      tvDetail.numberOfSeasons || 1,
      list.length,
      ...(list.map(s => s.seasonNumber || 1))
    );
    for (let i = 1; i <= maxSeason; i++) {
      if (!list.some(s => s.seasonNumber === i)) {
        list.push({
          id: (tvDetail.id || 1000) * 100 + i,
          seasonNumber: i,
          name: `Season ${i}`,
          overview: `Season ${i} of ${tvDetail.title}.`,
          posterPath: tvDetail.posterPath,
          airDate: '',
          episodeCount: 10,
          episodes: undefined
        });
      }
    }
    return list.sort((a, b) => a.seasonNumber - b.seasonNumber);
  })();

  const handleWatchlistToggle = () => {
    const nextState = toggleWatchlist({
      id: detail.id,
      mediaType: detail.mediaType,
      title: detail.title,
      posterPath: detail.posterPath,
      backdropPath: detail.backdropPath,
      releaseDate: detail.releaseDate,
      voteAverage: detail.voteAverage
    });
    setInWatchlist(nextState);
  };

  const handlePlayTrailer = (key: string) => {
    setSelectedTrailerKey(key);
    setTrailerOpen(true);
  };

  const handleFollowToggle = async () => {
    if (!detail) return;
    await toggleFollowShow({
      id: detail.id,
      mediaType: 'tv',
      title: detail.title,
      posterPath: detail.posterPath,
      backdropPath: detail.backdropPath,
      voteAverage: detail.voteAverage
    });
  };

  const isFollowing = detail ? isFollowingShow(detail.id) : false;

  const toggleFaq = (idx: number) => {
    setFaqOpen(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="w-full pb-24">
      {/* Top Breadcrumbs & Badges Strip matching Slika 4 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Breadcrumb line */}
        <div className="flex items-center gap-2 text-slate-400 font-medium">
          <button onClick={onBack} className="hover:text-white transition-colors">Home</button>
          <span>/</span>
          <button onClick={onBack} className="hover:text-white transition-colors">
            {isMovie ? 'Movies' : 'TV Shows'}
          </button>
          <span>/</span>
          <span className="text-slate-200 truncate">{detail.title}</span>
        </div>

        {/* Badges on right matching Slika 4 */}
        <div className="flex items-center gap-2.5">
          <div className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-extrabold text-[11px] flex items-center gap-1 border border-amber-500/30">
            <span>🏆 Top 10</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 font-extrabold text-[11px] flex items-center gap-1 border border-emerald-500/30">
            <span>★ {detail.voteAverage.toFixed(1)}</span>
          </div>
          <span className="text-emerald-400 font-bold text-xs">
            {detail.matchPercentage || 78}% Match
          </span>
          <QualityBadge item={detail} variant="pill" />
          <span className="px-1.5 py-0.2 rounded border border-white/20 text-[10px] font-bold text-slate-300">
            {detail.certification || 'PG-13'}
          </span>
        </div>
      </div>

      {/* Main Split Hero Section matching Slika 4 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Column: Poster + 3 Action Buttons matching Slika 4 */}
          <div className="w-56 sm:w-64 lg:w-72 shrink-0 mx-auto lg:mx-0">
            {/* Poster Card */}
            <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden border border-white/10 bg-[#16161c] shadow-2xl">
              <img
                src={detail.posterPath}
                alt={detail.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Action Buttons under Poster: Watch Now, Trailer, Bookmark, Share */}
            <div className="flex items-center gap-2 mt-4 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => onWatchNow(detail, isMovie ? undefined : selectedSeasonNumber, 1)}
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-extrabold text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer min-w-[120px]"
              >
                <Play className="w-4 h-4 fill-black text-black" />
                <span>{isMovie ? 'Watch Now' : `Watch S${selectedSeasonNumber} E1`}</span>
              </button>

              <button
                onClick={() => {
                  const trailer = detail.videos?.find(v => v.type?.toLowerCase() === 'trailer') || detail.videos?.[0];
                  handlePlayTrailer(trailer?.key || 'JfVOs4VSpmA');
                }}
                className="inline-flex items-center justify-center gap-1.5 h-11 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors border border-white/10 cursor-pointer"
                title="Watch Trailer"
              >
                <Film className="w-4 h-4 text-[#F5C400]" />
                <span className="hidden sm:inline">Trailer</span>
              </button>

              <button
                onClick={handleWatchlistToggle}
                className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                  inWatchlist
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              >
                {inWatchlist ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShareModalOpen(true)}
                className="w-11 h-11 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-[#F5C400] transition-all cursor-pointer"
                title="Share this Title"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Follow Series Toggle Button for TV Shows */}
            {!isMovie && (
              <button
                type="button"
                onClick={handleFollowToggle}
                className={`w-full mt-3 h-10 rounded-xl flex items-center justify-center gap-2 border font-bold text-xs transition-all cursor-pointer ${
                  isFollowing
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 hover:bg-amber-500/30 shadow-sm'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title={isFollowing ? 'Following series (click to unfollow)' : 'Follow series to get notified when new episodes air'}
              >
                <BellRing className={`w-4 h-4 ${isFollowing ? 'text-amber-400 fill-amber-400/20' : 'text-slate-400'}`} />
                <span>{isFollowing ? 'Following Series (Episode Alerts On)' : 'Follow Series (Get Episode Alerts)'}</span>
              </button>
            )}
          </div>

          {/* Right Column: Title, Metadata, Overview, Details Table matching Slika 4 */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {detail.title} <span className="text-slate-400 font-normal">({releaseYear})</span>
            </h1>

            {/* Tagline */}
            <p className="text-xs sm:text-sm italic text-slate-400 mt-1">
              &quot;{detail.tagline || (isMovie ? 'A brand new day starts now.' : 'Every ending has a beginning.')}&quot;
            </p>

            {/* Director & Writer */}
            <div className="text-xs text-slate-400 mt-2 flex flex-wrap items-center gap-1">
              <span className="font-semibold text-slate-200">{isMovie ? 'Director' : 'Creator'}: </span>
              <button
                type="button"
                onClick={() => {
                  if (onSelectPerson) {
                    const directorCrew = (detail as any).crew?.find((c: any) => c.job === 'Director');
                    onSelectPerson(directorCrew?.id || 1083010);
                  }
                }}
                className="text-[#F5C400] hover:underline font-bold transition-colors cursor-pointer"
              >
                {detail.director || (isMovie ? 'Destin Daniel Cretton' : 'Series Creator')}
              </button>
              <span className="mx-2 text-slate-600">·</span>
              <span className="font-semibold text-slate-200">Writer: </span>
              <span>{detail.writer || (isMovie ? 'Erik Sommers' : 'Staff Writers')}</span>
            </div>

            {/* Rating & Metadata Bar matching Slika 4 */}
            <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-1 text-amber-400 font-bold tabular-nums">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>{detail.voteAverage.toFixed(1)}</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  ({detail.voteCount.toLocaleString()} votes)
                </span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="flex items-center gap-1">
                {isMovie ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{detail.runtime ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m` : '2h 25m'}</span>
                  </>
                ) : (
                  <>
                    <Tv className="w-3.5 h-3.5 text-red-500" />
                    <span className="font-semibold text-white">
                      {detail.numberOfSeasons || tvDetail?.seasons?.length || 1} Seasons
                    </span>
                    <span className="text-slate-500">·</span>
                    <span>
                      {detail.numberOfEpisodes
                        ? `${detail.numberOfEpisodes} Episodes`
                        : `${tvDetail?.seasons?.[0]?.episodeCount || 8} Episodes`}
                    </span>
                  </>
                )}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{detail.certification || (isMovie ? 'PG-13' : 'TV-MA')}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="uppercase">{detail.spokenLanguages?.[0]?.slice(0, 2) || 'EN'}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{detail.productionCountries?.[0] || 'United States of America'}</span>
            </div>

            {/* Clickable Genre Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {detail.genres.map(g => (
                <button
                  key={g.id}
                  onClick={() => {
                    if (onSelectGenre) onSelectGenre(g.id, g.name);
                    else if (onSelectTag) onSelectTag(g.name);
                  }}
                  className="px-2.5 py-1 rounded bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black text-[11px] font-extrabold transition-all cursor-pointer shadow-sm flex items-center gap-1 group"
                  title={`Browse all ${g.name} titles`}
                >
                  <span>{g.name}</span>
                  <span className="text-[10px] opacity-60 group-hover:opacity-100 transition-opacity">↗</span>
                </button>
              ))}
            </div>

            {/* Overview */}
            <div className="mt-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                Overview
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {detail.overview}
              </p>
            </div>

            {/* Details Table Grid (3 Columns) matching Slika 4 */}
            <div className="mt-6 border border-white/10 rounded-xl overflow-hidden bg-[#141418] text-xs">
              <div className="px-4 py-2.5 bg-[#181820] border-b border-white/10 font-bold text-white text-xs uppercase tracking-wider">
                Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
                {/* Column 1 */}
                <div className="p-3.5 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Release</span>
                    <span className="text-white font-medium">{detail.releaseDate ? new Date(detail.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jul 29, 2026'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Writer</span>
                    <span className="text-white font-medium">{detail.writer || 'Erik Sommers'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status</span>
                    <span className="text-white font-medium">{movieDetail?.status || 'Released'}</span>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="p-3.5 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Runtime</span>
                    <span className="text-white font-medium">{detail.runtime ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m` : '2h 25m'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Language</span>
                    <span className="text-white font-medium uppercase">{detail.spokenLanguages?.[0]?.slice(0, 2) || 'EN'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Budget</span>
                    <span className="text-white font-medium">{movieDetail?.budgetFormatted || '$225M'}</span>
                  </div>
                </div>

                {/* Column 3 */}
                <div className="p-3.5 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Director</span>
                    <span className="text-white font-medium">{detail.director || 'Destin Daniel Cretton'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Country</span>
                    <span className="text-white font-medium">{detail.productionCountries?.[0] || 'United States of America'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Revenue</span>
                    <span className="text-white font-medium">{movieDetail?.revenueFormatted || '$2.5B'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Production Studios Badges matching Slika 4 */}
            <div className="mt-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A6A6AC] block mb-2">
                Production & Studios
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {(((detail as any)?.productionCompanies || movieDetail?.productionCompanies) || []).map((pc: any) => {
                  const matched = getPlatformById(pc.name);
                  return (
                    <button
                      key={pc.id || pc.name}
                      onClick={() => {
                        if (matched && onSelectPlatform) {
                          onSelectPlatform(matched.id);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        matched
                          ? 'bg-[#303035] border-[#F5C400]/50 text-white hover:border-[#F5C400] cursor-pointer shadow-sm'
                          : 'bg-[#29292D] border-[#3A3A40] text-[#A6A6AC] cursor-default'
                      }`}
                      title={matched ? `View all ${matched.name} productions` : pc.name}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: matched ? matched.color : '#F5C400' }}
                      />
                      <span>{pc.name}</span>
                      {matched && (
                        <span className="text-[10px] text-[#F5C400] font-bold ml-0.5">↗</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* External Links matching Slika 4 */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                External Links:
              </span>
              <a
                href={`https://www.themoviedb.org/${detail.mediaType}/${detail.tmdbId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white font-medium underline"
              >
                TMDB
              </a>
              {detail.imdbId && (
                <a
                  href={`https://www.imdb.com/title/${detail.imdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-white font-medium underline"
                >
                  IMDb
                </a>
              )}
              <span className="text-slate-300 hover:text-white font-medium underline cursor-pointer">
                Official Site
              </span>
            </div>

            {/* Share & Real-time Rating/Views Bar */}
            <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Share:</span>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-[#F5C400] hover:text-black flex items-center justify-center text-white transition-all cursor-pointer shadow-xs"
                  title="Share this title"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Connected to live Firestore views and functioning Report Problem modal */}
              <RatingViewsBar
                mediaId={detail.id}
                mediaType={detail.mediaType}
                mediaTitle={detail.title}
                onOpenReport={() => setReportModalOpen(true)}
              />
            </div>

            {/* Keyword / Tags Pills matching Slika 4 */}
            {detail.keywords && detail.keywords.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {detail.keywords.map(kw => (
                  <button
                    key={kw.id}
                    onClick={() => onSelectTag?.(kw.name)}
                    className="px-2.5 py-1 rounded bg-[#181820] text-slate-400 hover:text-white hover:border-red-500/50 hover:bg-[#20202a] text-[11px] font-medium border border-white/5 transition-all cursor-pointer"
                    title={`Browse titles tagged with #${kw.name}`}
                  >
                    #{kw.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs: Episodes (if TV) | Cast | Videos | Similar | Recommended */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex items-center gap-6 border-b border-white/10 text-xs sm:text-sm font-bold overflow-x-auto no-scrollbar">
          {(isMovie
            ? (['cast', 'videos', 'similar', 'recommended'] as const)
            : (['episodes', 'cast', 'videos', 'similar', 'recommended'] as const)
          ).map(tab => {
            const tabConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
              episodes: { label: 'Seasons & Episodes', icon: Tv },
              cast: { label: 'Cast', icon: Users },
              videos: { label: 'Trailers', icon: Play },
              similar: { label: 'More Like This', icon: Sparkles },
              recommended: { label: 'Recommended', icon: Flame }
            };
            const conf = tabConfig[tab] || { label: tab, icon: Film };
            const Icon = conf.icon;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 transition-colors relative shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab
                    ? 'text-white font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#F5C400]" />
                <span>{conf.label}</span>
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F5C400] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seasons & Episodes Tab Content */}
      {activeTab === 'episodes' && !isMovie && tvDetail && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8">
          {/* Header Strip with Season selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-[#F5C400]" />
                <h3 className="text-xl font-bold text-white">
                  Seasons & Episodes
                </h3>
              </div>
              <p className="text-xs text-[#A6A6AC] mt-1">
                Browse all {allSeasons.length} seasons and verified episodes from TMDB
              </p>
            </div>

            {allSeasons.length > 5 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A6A6AC]">Jump to season:</span>
                <select
                  value={selectedSeasonNumber}
                  onChange={(e) => handleSelectSeason(Number(e.target.value))}
                  className="bg-[#29292D] border border-[#3A3A40] text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#F5C400] cursor-pointer"
                >
                  {allSeasons.map(s => (
                    <option key={s.seasonNumber} value={s.seasonNumber}>
                      {s.name} ({s.episodeCount || 10} eps)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Full-Width Scrollable Season Selector Pills */}
          {allSeasons.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar scroll-smooth">
              {allSeasons.map(season => {
                const isSelected = season.seasonNumber === selectedSeasonNumber;
                return (
                  <button
                    key={season.id || season.seasonNumber}
                    onClick={() => handleSelectSeason(season.seasonNumber)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2.5 border cursor-pointer ${
                      isSelected
                        ? 'bg-[#F5C400] text-black border-[#F5C400] shadow-lg shadow-amber-500/20 font-black'
                        : 'bg-[#29292D] text-[#A6A6AC] hover:text-white hover:bg-[#303035] border-[#3A3A40]'
                    }`}
                  >
                    <span>{season.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isSelected ? 'bg-black/20 text-black' : 'bg-white/5 text-[#A6A6AC]'
                      }`}
                    >
                      {season.episodeCount || 10} eps
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Current Season Info Card */}
          {(() => {
            const currentSeason = tvDetail.seasons?.find(s => s.seasonNumber === selectedSeasonNumber);
            if (!currentSeason) return null;
            return (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#141418] border border-white/5 mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-start gap-4">
                  {currentSeason.posterPath && (
                    <div className="w-14 sm:w-16 aspect-[2/3] rounded-lg overflow-hidden bg-slate-900 border border-white/10 shrink-0 hidden sm:block">
                      <img
                        src={currentSeason.posterPath}
                        alt={currentSeason.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{currentSeason.name}</span>
                      {currentSeason.airDate && (
                        <span className="text-xs font-normal text-slate-400">
                          ({new Date(currentSeason.airDate).getFullYear()})
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      {currentSeason.overview ||
                        `Season ${currentSeason.seasonNumber} features ${currentSeason.episodeCount} episodes.`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onWatchNow(detail, selectedSeasonNumber, 1)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black text-xs font-extrabold transition-all shrink-0 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Play Season from Ep 1</span>
                </button>
              </div>
            );
          })()}

          {/* Episodes List / Grid */}
          {episodesLoading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-3 border-[#F5C400] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Loading Season {selectedSeasonNumber} episodes from TMDB...</p>
            </div>
          ) : seasonEpisodes.length === 0 ? (
            <div className="py-12 text-center p-8 rounded-2xl bg-[#29292D] border border-[#3A3A40]">
              <p className="text-sm text-slate-300 font-semibold mb-3">No episodes loaded for this season.</p>
              <button
                onClick={() => onWatchNow(detail, selectedSeasonNumber, 1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5C400] text-black text-xs font-bold cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Stream Season {selectedSeasonNumber} Episode 1</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seasonEpisodes.map(ep => (
                <div
                  key={ep.id}
                  onClick={() => onWatchNow(detail, selectedSeasonNumber, ep.episodeNumber)}
                  className="group cursor-pointer rounded-2xl overflow-hidden bg-[#29292D] border border-[#3A3A40] hover:border-[#F5C400] hover:bg-[#303035] transition-all flex flex-col sm:flex-row gap-3.5 p-3 sm:p-3.5 shadow-sm hover:shadow-lg"
                >
                  {/* Thumbnail Still */}
                  <div className="relative aspect-video w-full sm:w-44 rounded-xl overflow-hidden bg-[#232326] shrink-0 border border-[#3A3A40]">
                    <img
                      src={
                        ep.stillPath ||
                        detail.backdropPath ||
                        'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=600&auto=format&fit=crop&q=80'
                      }
                      alt={ep.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#F5C400] flex items-center justify-center text-black shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                      </div>
                    </div>
                    {/* Episode number badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-black text-white uppercase tracking-wider">
                      EP {ep.episodeNumber}
                    </div>
                    {/* Runtime */}
                    {ep.runtime && (
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[9px] font-bold text-slate-300">
                        {ep.runtime}m
                      </div>
                    )}
                  </div>

                  {/* Episode Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#F5C400] transition-colors line-clamp-1">
                          {ep.episodeNumber}. {ep.name}
                        </h4>
                        {ep.voteAverage > 0 && (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-[#F5C400] shrink-0">
                            <Star className="w-3 h-3 fill-[#F5C400]" />
                            <span>{ep.voteAverage.toFixed(1)}</span>
                          </div>
                        )}
                      </div>

                      {ep.airDate && (
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                          {new Date(ep.airDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      )}

                      <p className="text-xs text-slate-300 line-clamp-2 mt-2 leading-relaxed">
                        {ep.overview || 'Click to stream this episode now.'}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                      <span className="text-slate-400 font-semibold group-hover:text-slate-200">
                        Season {selectedSeasonNumber} · Episode {ep.episodeNumber}
                      </span>
                      <span className="text-[#F5C400] font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Play Episode</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content Area: Cast */}
      {activeTab === 'cast' && detail.cast && (
        <CastCarousel
          cast={detail.cast}
          onSelectPerson={(person) => onSelectPerson && onSelectPerson(person.id)}
        />
      )}

      {activeTab === 'videos' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-[#F5C400]" />
              <span>Official Trailers</span>
              <span className="text-xs text-[#A6A6AC] font-normal">
                ({(detail.videos || []).filter(v => v.type?.toLowerCase() === 'trailer').length || (detail.videos || []).filter(v => v.type?.toLowerCase() === 'teaser').length})
              </span>
            </h3>
          </div>

          {(() => {
            const strictlyTrailers = (detail.videos || []).filter(v => v.type?.toLowerCase() === 'trailer');
            const trailersToShow = strictlyTrailers.length > 0
              ? strictlyTrailers
              : (detail.videos || []).filter(v => v.type?.toLowerCase() === 'teaser');

            if (trailersToShow.length === 0) {
              return (
                <div className="p-8 text-center bg-[#1c1c24] rounded-xl border border-white/5">
                  <p className="text-xs text-[#A6A6AC]">No official trailers found for this title.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {trailersToShow.map(v => (
                  <div
                    key={v.id}
                    onClick={() => handlePlayTrailer(v.key)}
                    className="group cursor-pointer rounded-xl overflow-hidden bg-[#29292D] border border-[#3A3A40] hover:border-[#F5C400] transition-all shadow-md"
                  >
                    <div className="relative aspect-video w-full bg-[#1c1c24]">
                      <img
                        src={`https://img.youtube.com/vi/${v.key}/mqdefault.jpg`}
                        alt={v.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-[#F5C400] flex items-center justify-center text-black shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-black ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-black uppercase text-[#F5C400] tracking-wider">
                        Official Trailer
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors line-clamp-2 leading-snug">
                        {v.name}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab Content Area: Similar Titles */}
      {activeTab === 'similar' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">More Like This</h3>
            <span className="text-xs text-[#A6A6AC]">Similar titles based on genres and themes</span>
          </div>
          {detail.similar && detail.similar.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
              {detail.similar.map(sim => (
                <div
                  key={sim.id}
                  onClick={() => onSelectMedia(sim)}
                  className="group cursor-pointer rounded-xl overflow-hidden bg-[#141418] border border-white/5 hover:border-white/25 transition-all"
                >
                  <div className="relative aspect-[2/3] w-full bg-[#1c1c24]">
                    <img
                      src={sim.posterPath}
                      alt={sim.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                      <span>{sim.voteAverage.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate">
                      {sim.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {new Date(sim.releaseDate).getFullYear()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-[#1c1c24] rounded-xl border border-white/5">
              <p className="text-xs text-[#A6A6AC]">No similar titles found.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content Area: Recommended Titles */}
      {activeTab === 'recommended' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Recommended For You</h3>
            <span className="text-xs text-[#A6A6AC]">Curated picks based on viewer ratings</span>
          </div>
          {detail.recommendations && detail.recommendations.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
              {detail.recommendations.map(rec => (
                <div
                  key={rec.id}
                  onClick={() => onSelectMedia(rec)}
                  className="group cursor-pointer rounded-xl overflow-hidden bg-[#141418] border border-white/5 hover:border-white/25 transition-all"
                >
                  <div className="relative aspect-[2/3] w-full bg-[#1c1c24]">
                    <img
                      src={rec.posterPath}
                      alt={rec.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                      <span>{rec.voteAverage.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate">
                      {rec.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {new Date(rec.releaseDate).getFullYear()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-[#1c1c24] rounded-xl border border-white/5">
              <p className="text-xs text-[#A6A6AC]">No recommendations available.</p>
            </div>
          )}
        </div>
      )}

      {/* Section: "More from Franchise Collection" matching Slika 4 */}
      {movieDetail?.belongsToCollection && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white">
                More from {movieDetail.belongsToCollection.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#F5C400]/20 text-[#F5C400] text-[10px] font-black uppercase tracking-wider border border-[#F5C400]/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#F5C400]" /> Auto-Franchise Collection
              </span>
            </div>
            {onNavigateCollections && (
              <button
                onClick={onNavigateCollections}
                className="text-xs font-semibold text-[#F5C400] hover:text-[#e0b400] flex items-center gap-1 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <span>View all collections</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Franchise Banner Frame matching Slika 4 */}
          <div className="relative rounded-2xl overflow-hidden bg-[#29292D] border border-[#3A3A40] p-5 sm:p-6 mb-6">
            <p className="text-xs text-slate-300 mb-4">
              This movie is part of the <strong className="text-white">{movieDetail.belongsToCollection.name}</strong> collection.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {movieDetail.belongsToCollection.parts.map((film: any, idx: number) => {
                const isCurrent = film.id === detail.id;
                return (
                  <div
                    key={film.id}
                    onClick={() => onSelectMedia(film)}
                    className={`group cursor-pointer rounded-xl overflow-hidden border transition-all ${
                      isCurrent
                        ? 'border-[#F5C400] bg-[#F5C400]/10 ring-1 ring-[#F5C400]'
                        : 'border-[#3A3A40] bg-[#232326] hover:border-[#F5C400]/50'
                    }`}
                  >
                    <div className="relative aspect-[2/3] w-full bg-[#242430]">
                      <img
                        src={film.posterPath}
                        alt={film.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      {isCurrent ? (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#F5C400] text-black text-[9px] font-black uppercase tracking-wider">
                          You&apos;re watching
                        </div>
                      ) : (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-[#F5C400] flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-[#F5C400]" />
                          <span>{film.voteAverage.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <h4 className="text-xs font-semibold text-white group-hover:text-[#F5C400] truncate">
                        {film.title}
                      </h4>
                      <p className="text-[11px] text-[#A6A6AC] mt-0.5">
                        {new Date(film.releaseDate).getFullYear()} · Part {idx + 1}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Section: "Frequently Asked Questions" matching Slika 4 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-12">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {[
            {
              q: `Where can I watch ${detail.title} (${releaseYear}) online?`,
              a: `${detail.title} is available for high definition streaming on TStream with support for 1080p video servers, subtitle selection in Serbian, Croatian, Bosnian, and English, and zero buffering interruptions.`
            },
            {
              q: `What is ${detail.title} about?`,
              a: detail.overview
            },
            {
              q: `Who stars in ${detail.title}?`,
              a: detail.cast ? detail.cast.map(c => `${c.name} (${c.character})`).join(', ') : 'Tom Holland, Zendaya, Jacob Batalon, Jon Favreau'
            }
          ].map((faq, idx) => (
            <div
              key={idx}
              className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full flex items-center justify-between p-4 text-left font-bold text-xs sm:text-sm text-white hover:text-[#F5C400] transition-colors"
              >
                <span>{faq.q}</span>
                {faqOpen[idx] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {faqOpen[idx] && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Mini-Player Bar matching Slika 4 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#121217]/95 backdrop-blur-md border-t border-white/10 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-11 rounded overflow-hidden bg-[#1c1c24] shrink-0 border border-white/10">
            <img
              src={detail.posterPath}
              alt={detail.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
              {detail.title}
            </h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
              <span>{releaseYear}</span>
              <span>·</span>
              <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
                <Star className="w-2.5 h-2.5 fill-amber-400" />
                {detail.voteAverage.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onWatchNow(detail, isMovie ? undefined : selectedSeasonNumber, 1)}
          className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-black text-black" />
          <span>{isMovie ? 'Watch' : `Watch S${selectedSeasonNumber} E1`}</span>
        </button>
      </div>

      {/* Auto-Discovered Franchise Collection Toast Notification */}
      {showAutoFranchiseToast && autoCreatedFranchise && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] bg-[#1c1c22] border border-[#F5C400]/50 rounded-2xl p-4 shadow-2xl shadow-black/80 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F5C400]/15 border border-[#F5C400]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[#F5C400]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#F5C400]">
                <span>Auto-Collection Created</span>
                <span className="w-1 h-1 rounded-full bg-[#F5C400]" />
                <span>Saved</span>
              </div>
              <div className="text-xs font-bold text-white truncate">
                {autoCreatedFranchise.name} ({autoCreatedFranchise.parts.length} films)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateCollections && (
              <button
                onClick={() => {
                  setShowAutoFranchiseToast(false);
                  onNavigateCollections();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#F5C400] text-black font-extrabold text-xs hover:bg-[#e0b400] transition-colors cursor-pointer shadow-sm"
              >
                Explore
              </button>
            )}
            <button
              onClick={() => setShowAutoFranchiseToast(false)}
              className="p-1 rounded text-[#A6A6AC] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Official Trailer Modal */}
      {selectedTrailerKey && (
        <TrailerModal
          isOpen={trailerOpen}
          onClose={() => setTrailerOpen(false)}
          video={{
            id: selectedTrailerKey,
            key: selectedTrailerKey,
            name: `${detail.title} — Official Trailer`,
            site: 'YouTube',
            type: 'Trailer',
            official: true
          }}
          title={detail.title}
        />
      )}

      {/* Universal Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={detail.title}
        overview={detail.overview}
      />

      {/* Report a Problem Modal connected to live Firestore */}
      <ReportIssueModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        mediaId={detail.id}
        mediaType={detail.mediaType}
        mediaTitle={detail.title}
        currentServer="Details Page View"
      />
    </div>
  );
};
