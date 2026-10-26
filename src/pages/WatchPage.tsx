import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Info,
  Star,
  ExternalLink,
  Film,
  Tv,
  Bookmark,
  Share2,
  Moon,
  Sun,
  Maximize2,
  Sparkles,
  Calendar,
  Clock,
  Play,
  Layers,
  Search,
  Check,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { MediaDetail, MediaItem, TVDetail, Episode } from '../types/media';
import { getMediaDetail, fetchSeasonEpisodes } from '../services/tmdb';
import { isInWatchlist, toggleWatchlist } from '../services/storage';
import { StreamingPlayer } from '../components/StreamingPlayer';
import { MediaCard } from '../components/MediaCard';
import { CastCarousel } from '../components/CastCarousel';
import { autoDiscoverMovieFranchise, DiscoveredCollection } from '../services/collectionStore';
import { createMediaSlug } from '../utils/slug';
import { updateMediaSEO } from '../utils/seo';

interface WatchPageProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  onBackToDetails: () => void;
  onSelectMedia: (item: MediaItem) => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({
  mediaId,
  mediaType,
  season = 1,
  episode = 1,
  onBackToDetails,
  onSelectMedia
}) => {
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [currentSeason, setCurrentSeason] = useState(season);
  const [currentEpisode, setCurrentEpisode] = useState(episode);
  const [loading, setLoading] = useState(true);

  // Cinema UI Controls
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isLightsDimmed, setIsLightsDimmed] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'story' | 'franchise' | 'recommended'>('episodes');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // TV Episodes search & list
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [episodesMap, setEpisodesMap] = useState<Record<number, Episode[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Franchise collection
  const [franchiseCollection, setFranchiseCollection] = useState<DiscoveredCollection | null>(null);

  useEffect(() => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);
  }, [season, episode]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      window.scrollTo({ top: 0, behavior: 'instant' as any });
      const data = await getMediaDetail(mediaId, mediaType);
      if (isMounted) {
        setDetail(data);
        if (data) {
          updateMediaSEO(data, { season: currentSeason, episode: currentEpisode, isWatching: true });
          setInWatchlist(isInWatchlist(data.id));
          const slug = createMediaSlug(data.title || (data as any).name, data.id);
          if (data.mediaType === 'movie') {
            setActiveTab('story');
            const expectedUrl = `/watch/movie/${slug}`;
            if (window.location.pathname !== expectedUrl) {
              window.history.replaceState({}, '', expectedUrl);
            }
            autoDiscoverMovieFranchise(data).then(col => {
              if (isMounted && col) setFranchiseCollection(col);
            });
          } else {
            setActiveTab('episodes');
            const expectedUrl = `/watch/tv/${slug}/${season}/${episode}`;
            if (!window.location.pathname.includes(slug)) {
              window.history.replaceState({}, '', expectedUrl);
            }
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

  // Update SEO when TV season/episode changes
  useEffect(() => {
    if (detail && detail.mediaType === 'tv') {
      updateMediaSEO(detail, { season: currentSeason, episode: currentEpisode, isWatching: true });
    }
  }, [currentSeason, currentEpisode, detail]);

  // Load TV episodes for the season
  useEffect(() => {
    if (!detail || detail.mediaType === 'movie') return;
    let isMounted = true;
    const tv = detail as TVDetail;
    const currentSeasonObj = tv.seasons?.find(s => s.seasonNumber === currentSeason);

    if (currentSeasonObj?.episodes && currentSeasonObj.episodes.length > 0) {
      setEpisodesMap(prev => ({ ...prev, [currentSeason]: currentSeasonObj.episodes! }));
      return;
    }

    if (episodesMap[currentSeason]) return;

    setLoadingEpisodes(true);
    fetchSeasonEpisodes(detail.id, currentSeason)
      .then(eps => {
        if (isMounted) {
          setEpisodesMap(prev => ({ ...prev, [currentSeason]: eps }));
        }
      })
      .finally(() => {
        if (isMounted) setLoadingEpisodes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [detail, currentSeason]);

  const handleEpisodeChange = (s: number, e: number) => {
    setCurrentSeason(s);
    setCurrentEpisode(e);
    if (detail) {
      const slug = createMediaSlug(detail.title || (detail as any).name, detail.id);
      window.history.replaceState({}, '', `/watch/tv/${slug}/${s}/${e}`);
    }
  };

  const handleToggleWatchlist = () => {
    if (!detail) return;
    const added = toggleWatchlist({
      id: detail.id,
      mediaType: detail.mediaType,
      title: detail.title,
      posterPath: detail.posterPath,
      backdropPath: detail.backdropPath,
      releaseDate: detail.releaseDate,
      voteAverage: detail.voteAverage
    });
    setInWatchlist(added);
    showToast(added ? 'Saved to Your Watchlist' : 'Removed from Watchlist');
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      showToast('Watch URL copied to clipboard');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (loading || !detail) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-[#121215]">
        <div className="w-12 h-12 border-3 border-[#3A3A40] border-t-[#F5C400] rounded-full animate-spin mb-4" />
        <h2 className="text-base font-extrabold text-white tracking-wide uppercase">
          Initializing Cinema Room
        </h2>
        <p className="text-xs text-[#A6A6AC] mt-1">
          Loading 1080p high definition streams & audio channels...
        </p>
      </div>
    );
  }

  const isMovie = detail.mediaType === 'movie';
  const tvDetail = !isMovie ? (detail as TVDetail) : null;
  const currentSeasonData = tvDetail?.seasons?.find(s => s.seasonNumber === currentSeason) || tvDetail?.seasons?.[0];

  const rawEpisodes = episodesMap[currentSeason] || currentSeasonData?.episodes;
  const episodesList: Episode[] =
    rawEpisodes && rawEpisodes.length > 0
      ? rawEpisodes
      : Array.from({ length: currentSeasonData?.episodeCount || 8 }, (_, i) => ({
          id: Number(`${detail.id}${currentSeason}${i + 1}`),
          episodeNumber: i + 1,
          seasonNumber: currentSeason,
          name: `Episode ${i + 1}`,
          overview: 'Episode synopsis available in player feed.',
          stillPath: null,
          airDate: detail.releaseDate || '2026',
          voteAverage: 8.0,
          runtime: 45
        }));

  const filteredEpisodes = episodesList.filter(ep =>
    (ep.name || '').toLowerCase().includes(episodeSearch.toLowerCase()) ||
    ep.episodeNumber.toString() === episodeSearch.trim()
  );

  const releaseYear = detail.releaseDate ? new Date(detail.releaseDate).getFullYear() : '2026';

  return (
    <div className={`relative min-h-screen bg-[#121215] text-[#F3F3F3] pb-24 transition-colors duration-500`}>
      {/* Lights Off Dimming Overlay */}
      {isLightsDimmed && (
        <div
          onClick={() => setIsLightsDimmed(false)}
          className="fixed inset-0 z-20 bg-black/85 backdrop-blur-xs transition-opacity duration-500 cursor-pointer"
          title="Click anywhere to turn lights back on"
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#232326] border border-[#F5C400]/40 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200">
          <Check className="w-4 h-4 text-[#F5C400]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Cinema Bar with Breadcrumbs & Actions */}
      <div className="relative z-30 border-b border-[#3A3A40]/60 bg-[#16161a]">
        <div className="max-w-[1520px] mx-auto px-3 sm:px-5 lg:px-6 h-14 flex items-center justify-between gap-3">
          {/* Back & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBackToDetails}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#232326] hover:bg-[#303035] text-[#F3F3F3] hover:text-[#F5C400] text-xs font-bold transition-colors border border-[#3A3A40] cursor-pointer shadow-sm shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Overview</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#A6A6AC] font-medium truncate">
              <span>T STREAM</span>
              <span>/</span>
              <span>WATCH</span>
              <span>/</span>
              <span className="text-white font-bold truncate">{detail.title}</span>
            </div>
          </div>

          {/* Right: Quick Metadata and Controls */}
          <div className="flex items-center gap-2">
            {/* Rating */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#232326] border border-[#3A3A40] text-xs font-bold text-[#F5C400]">
              <Star className="w-3.5 h-3.5 fill-[#F5C400]" />
              <span className="text-white">{detail.voteAverage.toFixed(1)}</span>
            </div>

            {/* Watchlist Bookmark */}
            <button
              onClick={handleToggleWatchlist}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                inWatchlist
                  ? 'bg-[#F5C400] text-black border-[#F5C400]'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border-[#3A3A40]'
              }`}
              title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-black' : ''}`} />
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="p-2 rounded-lg bg-[#232326] hover:bg-[#303035] text-[#A6A6AC] hover:text-white border border-[#3A3A40] transition-colors cursor-pointer"
              title="Share Stream Link"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Cinema Lights Button */}
            <button
              onClick={() => setIsLightsDimmed(prev => !prev)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                isLightsDimmed
                  ? 'bg-[#F5C400] text-black border-[#F5C400]'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border-[#3A3A40]'
              }`}
              title={isLightsDimmed ? 'Turn on lights' : 'Cinema lights off'}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>

            {/* Theater Mode Button */}
            <button
              onClick={() => setIsTheaterMode(prev => !prev)}
              className={`hidden md:flex p-2 rounded-lg border transition-colors cursor-pointer ${
                isTheaterMode
                  ? 'bg-[#F5C400] text-black border-[#F5C400]'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border-[#3A3A40]'
              }`}
              title={isTheaterMode ? 'Standard width' : 'Full-width theater'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Cinema Player Container */}
      <div
        className={`relative z-30 mx-auto transition-all duration-300 pt-4 sm:pt-6 ${
          isTheaterMode
            ? 'w-full max-w-[1920px] px-2 sm:px-4'
            : 'max-w-[1360px] px-3 sm:px-6'
        }`}
      >
        {/* Subtle Ambient Glow behind player matching movie artwork */}
        {detail.backdropPath && (
          <div
            className="absolute -top-12 inset-x-0 h-96 -z-10 opacity-20 blur-3xl pointer-events-none"
            style={{
              backgroundImage: `url(${detail.backdropPath})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        )}

        {/* The Re-architected High-End Player */}
        <StreamingPlayer
          media={detail}
          initialSeason={currentSeason}
          initialEpisode={currentEpisode}
          onEpisodeChange={handleEpisodeChange}
          isTheaterMode={isTheaterMode}
          onToggleTheater={() => setIsTheaterMode(prev => !prev)}
          isLightsDimmed={isLightsDimmed}
          onToggleLights={() => setIsLightsDimmed(prev => !prev)}
        />
      </div>

      {/* Under-Player Metadata & Information Hub */}
      <div
        className={`mx-auto mt-6 transition-all duration-300 ${
          isTheaterMode
            ? 'w-full max-w-[1920px] px-2 sm:px-4'
            : 'max-w-[1360px] px-3 sm:px-6'
        }`}
      >
        {/* Main Title, Badge & Tagline Box */}
        <div className="rounded-2xl bg-[#1b1b22] border border-[#3A3A40] p-5 sm:p-6 shadow-xl relative overflow-hidden mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0">
              {/* Unboxed clean metadata per frontend-design */}
              <div className="flex items-center gap-2 text-xs text-[#A6A6AC] mb-1.5 flex-wrap font-medium">
                <span className="text-[#F5C400] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  {isMovie ? <Film className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                  <span>{isMovie ? 'Feature Film' : `Series · Season ${currentSeason}`}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>{releaseYear}</span>
                {detail.certification && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{detail.certification}</span>
                  </>
                )}
                {detail.runtime && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{detail.runtime} min</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-bold">1080p Ultra HD</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {detail.title}
                {!isMovie && (
                  <span className="text-[#F5C400] font-extrabold text-lg sm:text-xl ml-2">
                    — S{currentSeason} E{currentEpisode}
                  </span>
                )}
              </h1>

              {detail.tagline && (
                <p className="text-xs sm:text-sm text-[#A6A6AC] italic mt-1 font-sans">
                  &quot;{detail.tagline}&quot;
                </p>
              )}
            </div>

            {/* Right side stats & IMDb */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-[#232326] border border-[#3A3A40] px-3.5 py-2 rounded-xl">
                <Star className="w-5 h-5 fill-[#F5C400] text-[#F5C400]" />
                <div>
                  <span className="text-base font-black text-white block leading-none">
                    {detail.voteAverage.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-[#A6A6AC] uppercase font-bold">Rating</span>
                </div>
              </div>

              {detail.imdbId && (
                <a
                  href={`https://www.imdb.com/title/${detail.imdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
                >
                  <span>IMDb</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Tabs Header */}
        <div className="flex items-center gap-2 border-b border-[#3A3A40] pb-3 mb-6 overflow-x-auto no-scrollbar">
          {!isMovie && (
            <button
              onClick={() => setActiveTab('episodes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'episodes'
                  ? 'bg-[#F5C400] text-black shadow-md font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Episodes ({episodesList.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('story')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'story'
                ? 'bg-[#F5C400] text-black shadow-md font-extrabold'
                : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Story & Cast</span>
          </button>

          {franchiseCollection && (
            <button
              onClick={() => setActiveTab('franchise')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'franchise'
                  ? 'bg-[#F5C400] text-black shadow-md font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#F5C400]" />
              <span>Franchise Saga ({franchiseCollection.parts.length} films)</span>
            </button>
          )}

          {detail.recommendations && detail.recommendations.length > 0 && (
            <button
              onClick={() => setActiveTab('recommended')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'recommended'
                  ? 'bg-[#F5C400] text-black shadow-md font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Recommended Next</span>
            </button>
          )}
        </div>

        {/* Tab 1: TV Series Episodes Panel */}
        {!isMovie && activeTab === 'episodes' && (
          <div className="space-y-4">
            {/* Seasons Strip and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1b1b22] border border-[#3A3A40] rounded-xl p-3">
              {/* Season Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-bold text-[#A6A6AC] uppercase tracking-wider mr-1 hidden sm:inline">
                  Season:
                </span>
                {tvDetail?.seasons &&
                  tvDetail.seasons
                    .filter(s => s.seasonNumber > 0)
                    .map(s => {
                      const isActive = s.seasonNumber === currentSeason;
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setCurrentSeason(s.seasonNumber);
                            setCurrentEpisode(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                            isActive
                              ? 'bg-[#F5C400] text-black border-[#F5C400] font-black shadow-sm'
                              : 'bg-[#232326] text-[#A6A6AC] hover:text-white border-[#3A3A40]'
                          }`}
                        >
                          Season {s.seasonNumber}
                        </button>
                      );
                    })}
              </div>

              {/* Episode Search */}
              <div className="relative max-w-xs w-full">
                <input
                  type="text"
                  placeholder="Find episode by name or number..."
                  value={episodeSearch}
                  onChange={e => setEpisodeSearch(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#232326] border border-[#3A3A40] text-xs text-white placeholder:text-[#A6A6AC] focus:outline-none focus:border-[#F5C400]"
                />
                <Search className="w-3.5 h-3.5 text-[#A6A6AC] absolute left-2.5 top-2.5" />
              </div>
            </div>

            {loadingEpisodes && (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 border-3 border-[#F5C400] border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs text-[#A6A6AC]">Loading season episodes...</span>
              </div>
            )}

            {/* Episode Grid with High-Quality Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredEpisodes.map(ep => {
                const isCurrent = ep.episodeNumber === currentEpisode;
                return (
                  <div
                    key={ep.id || ep.episodeNumber}
                    onClick={() => {
                      setCurrentEpisode(ep.episodeNumber);
                      window.scrollTo({ top: 120, behavior: 'smooth' });
                    }}
                    className={`group rounded-xl overflow-hidden bg-[#1b1b22] border transition-all cursor-pointer flex flex-col justify-between ${
                      isCurrent
                        ? 'border-[#F5C400] bg-[#F5C400]/10 ring-1 ring-[#F5C400] shadow-lg shadow-amber-500/10'
                        : 'border-[#3A3A40] hover:border-[#F5C400]/60 hover:bg-[#232326]'
                    }`}
                  >
                    {/* Thumbnail Still */}
                    <div className="relative aspect-video w-full bg-[#16161c] overflow-hidden">
                      {ep.stillPath ? (
                        <img
                          src={ep.stillPath}
                          alt={ep.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#232326] flex items-center justify-center">
                          <Tv className="w-8 h-8 text-[#3A3A40]" />
                        </div>
                      )}

                      {/* Episode Number Badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-black uppercase text-white">
                        Ep. {ep.episodeNumber}
                      </div>

                      {/* Current Playing indicator */}
                      {isCurrent ? (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#F5C400] text-black text-[9px] font-black uppercase tracking-wider shadow-sm">
                          Playing Now
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 fill-black ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Meta */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors line-clamp-1">
                          {ep.name || `Episode ${ep.episodeNumber}`}
                        </h4>
                        <p className="text-[11px] text-[#A6A6AC] line-clamp-2 mt-1 leading-relaxed">
                          {ep.overview || 'No synopsis provided for this episode.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#888890] mt-3 pt-2 border-t border-[#3A3A40]/40 font-medium">
                        <span>{ep.airDate || 'Aired'}</span>
                        {ep.runtime && <span>{ep.runtime} min</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Story Synopsis, Director & Cast */}
        {activeTab === 'story' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-[#1b1b22] border border-[#3A3A40] p-6 shadow-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5C400] mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>Synopsis & Production Details</span>
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                {detail.overview}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-[#3A3A40]">
                {detail.director && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#A6A6AC] tracking-wider block">
                      Director
                    </span>
                    <span className="text-xs font-semibold text-white">{detail.director}</span>
                  </div>
                )}
                {detail.writer && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#A6A6AC] tracking-wider block">
                      Writer
                    </span>
                    <span className="text-xs font-semibold text-white">{detail.writer}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A6A6AC] tracking-wider block">
                    Original Language
                  </span>
                  <span className="text-xs font-semibold text-white">English (5.1 Audio)</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A6A6AC] tracking-wider block">
                    Streaming Status
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">Available in Full HD</span>
                </div>
              </div>
            </div>

            {/* Cast Carousel */}
            {detail.cast && detail.cast.length > 0 && (
              <div className="rounded-2xl bg-[#1b1b22] border border-[#3A3A40] p-6 shadow-lg">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5C400] mb-4">
                  Cast & Characters
                </h3>
                <CastCarousel cast={detail.cast} />
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Franchise Saga Collection */}
        {activeTab === 'franchise' && franchiseCollection && (
          <div className="rounded-2xl bg-[#1b1b22] border border-[#3A3A40] p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <span className="px-2 py-0.5 rounded-full bg-[#F5C400]/20 text-[#F5C400] text-[10px] font-black uppercase tracking-wider border border-[#F5C400]/30 inline-block mb-1">
                  Franchise Chronicles
                </span>
                <h3 className="text-xl font-black text-white">{franchiseCollection.name}</h3>
                <p className="text-xs text-[#A6A6AC] mt-1 max-w-2xl">{franchiseCollection.overview}</p>
              </div>
              <span className="text-xs font-bold text-[#F5C400]">
                {franchiseCollection.parts.length} Films in Chronological Order
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-2">
              {franchiseCollection.parts.map((film, idx) => {
                const isCurrentFilm = film.id === detail.id;
                return (
                  <div
                    key={film.id}
                    onClick={() => onSelectMedia(film)}
                    className={`group rounded-xl overflow-hidden bg-[#232326] border transition-all cursor-pointer flex flex-col justify-between ${
                      isCurrentFilm
                        ? 'border-[#F5C400] ring-1 ring-[#F5C400] shadow-md'
                        : 'border-[#3A3A40] hover:border-[#F5C400]'
                    }`}
                  >
                    <div className="relative aspect-[2/3] w-full bg-[#1c1c24] overflow-hidden">
                      {film.posterPath ? (
                        <img
                          src={film.posterPath}
                          alt={film.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#A6A6AC] p-2 text-center">
                          {film.title}
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white">
                        Part {idx + 1}
                      </div>
                      {isCurrentFilm && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#F5C400] text-black text-[9px] font-black uppercase tracking-wider">
                          Watching
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="text-xs font-bold text-white group-hover:text-[#F5C400] truncate">
                        {film.title}
                      </h4>
                      <p className="text-[10px] text-[#A6A6AC] mt-0.5">
                        {film.releaseDate ? new Date(film.releaseDate).getFullYear() : 'Classic'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Up Next & Recommended */}
        {activeTab === 'recommended' && detail.recommendations && detail.recommendations.length > 0 && (
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight mb-4">
              Similar Masterpieces & Blockbusters
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {detail.recommendations.slice(0, 12).map(rec => (
                <MediaCard key={rec.id} item={rec} onSelect={onSelectMedia} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
