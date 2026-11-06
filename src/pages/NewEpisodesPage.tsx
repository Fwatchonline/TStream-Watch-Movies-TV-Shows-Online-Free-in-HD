import React, { useState, useEffect, useMemo } from 'react';
import {
  Tv,
  Calendar,
  Sparkles,
  Play,
  BellRing,
  Check,
  Search,
  Flame,
  Radio,
  Clock,
  Zap,
  Filter,
  Bookmark,
  RotateCw
} from 'lucide-react';
import {
  fetchNewEpisodes,
  NewEpisodeItem,
  episodeItemToMediaItem,
  EpisodeReleasePeriod
} from '../services/newEpisodes';
import { MediaItem } from '../types/media';
import { useAuth } from '../context/AuthContext';
import { PageLoadingIndicator } from '../components/PageLoadingIndicator';

interface NewEpisodesPageProps {
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem, season?: number, episode?: number) => void;
}

type TabType = 'all' | 'today' | 'yesterday' | 'this_week' | 'followed';

export const NewEpisodesPage: React.FC<NewEpisodesPageProps> = ({
  onSelectMedia,
  onWatchMedia
}) => {
  const {
    user,
    followedShows,
    toggleFollowShow,
    isFollowingShow,
    openAuthModal
  } = useAuth();

  const [episodes, setEpisodes] = useState<NewEpisodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ id: string; msg: string } | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const followedIds = followedShows
        .map(s => Number(s.showId))
        .filter(id => !isNaN(id) && id > 0);
      const data = await fetchNewEpisodes({
        forceRefresh: force,
        extraShowIds: followedIds
      });
      setEpisodes(data);
    } catch (err) {
      console.warn('Failed loading new episodes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFollowClick = async (e: React.MouseEvent, ep: NewEpisodeItem) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal('login');
      return;
    }

    const wasFollowing = isFollowingShow(ep.showId);
    const media = episodeItemToMediaItem(ep);
    await toggleFollowShow(media);

    setActionFeedback({
      id: ep.id,
      msg: wasFollowing ? 'Unfollowed series' : 'Followed! You will get episode alerts.'
    });

    setTimeout(() => {
      setActionFeedback(prev => (prev?.id === ep.id ? null : prev));
    }, 2500);
  };

  const handleWatchClick = (ep: NewEpisodeItem) => {
    const media = episodeItemToMediaItem(ep);
    onWatchMedia(media, ep.seasonNumber, ep.episodeNumber);
  };

  const handleShowDetails = (ep: NewEpisodeItem) => {
    const media = episodeItemToMediaItem(ep);
    onSelectMedia(media);
  };

  // Compute counts per category
  const todayCount = useMemo(() => episodes.filter(e => e.releasePeriod === 'today').length, [episodes]);
  const yesterdayCount = useMemo(() => episodes.filter(e => e.releasePeriod === 'yesterday').length, [episodes]);
  const thisWeekCount = useMemo(() => episodes.filter(e => e.releasePeriod === 'this_week' || e.releasePeriod === 'recent').length, [episodes]);
  const followedCount = useMemo(() => {
    const ids = new Set(followedShows.map(s => String(s.showId)));
    return episodes.filter(e => ids.has(String(e.showId))).length;
  }, [episodes, followedShows]);

  // Filter episodes based on active tab and search query
  const filteredEpisodes = useMemo(() => {
    let list = [...episodes];

    if (activeTab === 'today') {
      list = list.filter(ep => ep.releasePeriod === 'today');
    } else if (activeTab === 'yesterday') {
      list = list.filter(ep => ep.releasePeriod === 'yesterday');
    } else if (activeTab === 'this_week') {
      list = list.filter(ep => ep.releasePeriod === 'this_week' || ep.releasePeriod === 'recent');
    } else if (activeTab === 'followed') {
      const followedIds = new Set(followedShows.map(s => String(s.showId)));
      list = list.filter(ep => followedIds.has(String(ep.showId)));
    }

    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      list = list.filter(ep =>
        ep.showTitle.toLowerCase().includes(q) ||
        ep.episodeName.toLowerCase().includes(q) ||
        (ep.genres && ep.genres.some(g => g.toLowerCase().includes(q)))
      );
    }

    return list;
  }, [episodes, activeTab, followedShows, searchFilter]);

  // Grouped sets for section view when "all" is active and no search query
  const groupedSections = useMemo(() => {
    const todayList = filteredEpisodes.filter(e => e.releasePeriod === 'today');
    const yesterdayList = filteredEpisodes.filter(e => e.releasePeriod === 'yesterday');
    const thisWeekList = filteredEpisodes.filter(e => e.releasePeriod === 'this_week' || e.releasePeriod === 'recent');

    return [
      {
        id: 'today',
        title: 'Released Today',
        subtitle: 'Broadcasted live within the last 24 hours',
        icon: Flame,
        iconColor: 'text-red-500',
        badgeBg: 'bg-red-500/15 border-red-500/30 text-red-400',
        items: todayList
      },
      {
        id: 'yesterday',
        title: 'Yesterday',
        subtitle: 'Episodes released yesterday',
        icon: Zap,
        iconColor: 'text-amber-400',
        badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        items: yesterdayList
      },
      {
        id: 'this_week',
        title: 'This Week',
        subtitle: 'Fresh releases from earlier this week',
        icon: Calendar,
        iconColor: 'text-blue-400',
        badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
        items: thisWeekList
      }
    ];
  }, [filteredEpisodes]);

  const formatAirDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderReleaseBadge = (ep: NewEpisodeItem) => {
    if (ep.releasePeriod === 'today') {
      return (
        <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-[10px] uppercase tracking-wide flex items-center gap-1 shadow-md animate-pulse">
          <Flame className="w-3 h-3 fill-white" />
          <span>Released Today</span>
        </span>
      );
    } else if (ep.releasePeriod === 'yesterday') {
      return (
        <span className="px-2.5 py-0.5 rounded-lg bg-[#F5C400] text-black font-extrabold text-[10px] uppercase tracking-wide flex items-center gap-1 shadow-md">
          <Zap className="w-3 h-3 fill-black text-black" />
          <span>Yesterday</span>
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-[#2a2a32] border border-white/10 text-slate-200 font-bold text-[10px] flex items-center gap-1 shadow-sm">
          <Calendar className="w-3 h-3 text-[#F5C400]" />
          <span>{ep.relativeTimeText || 'This Week'}</span>
        </span>
      );
    }
  };

  const renderEpisodeCard = (ep: NewEpisodeItem) => {
    const isFollowing = isFollowingShow(ep.showId);
    const feedback = actionFeedback?.id === ep.id ? actionFeedback.msg : null;

    return (
      <div
        key={ep.id}
        className="group relative rounded-2xl bg-[#19191e] border border-[#303036] hover:border-[#F5C400]/60 transition-all duration-300 flex flex-col overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1"
      >
        {/* Episode Still / Backdrop */}
        <div
          onClick={() => handleWatchClick(ep)}
          className="relative aspect-video w-full bg-[#121215] overflow-hidden cursor-pointer"
        >
          <img
            src={ep.stillPath || ep.showBackdrop || ep.showPoster}
            alt={ep.episodeName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#19191e] via-black/20 to-transparent" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/10 text-white font-mono font-black text-xs shadow-md">
              S{ep.seasonNumber} · E{ep.episodeNumber}
            </span>
          </div>

          <div className="absolute top-3 right-3">
            {renderReleaseBadge(ep)}
          </div>

          {/* Play hover button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px]">
            <div className="w-12 h-12 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-xl shadow-amber-500/30 transform group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-black ml-0.5" />
            </div>
          </div>

          {/* Air date badge bottom right */}
          <div className="absolute bottom-2.5 right-3 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[11px] font-semibold text-slate-300 flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#F5C400]" />
            <span>{formatAirDate(ep.airDate)}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            {/* Show Title & Details link */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => handleShowDetails(ep)}
                  className="text-sm font-bold text-white hover:text-[#F5C400] transition-colors truncate text-left block"
                  title={ep.showTitle}
                >
                  {ep.showTitle}
                </button>
                <h3 className="text-xs text-slate-300 font-semibold mt-0.5 truncate" title={ep.episodeName}>
                  &quot;{ep.episodeName}&quot;
                </h3>
              </div>

              {/* Rating */}
              {ep.voteAverage > 0 && (
                <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-amber-400 font-bold text-xs shrink-0 flex items-center gap-1">
                  <span>★</span>
                  <span>{ep.voteAverage.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Overview */}
            <p className="text-[11px] text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
              {ep.overview}
            </p>
          </div>

          {/* Bottom Action Strip */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
            {/* Watch button */}
            <button
              type="button"
              onClick={() => handleWatchClick(ep)}
              className="flex-1 h-9 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Watch Episode</span>
            </button>

            {/* Follow Series Toggle Button */}
            <button
              type="button"
              onClick={(e) => handleFollowClick(e, ep)}
              className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isFollowing
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 hover:bg-amber-500/30'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title={isFollowing ? 'Following (click to unfollow)' : 'Follow series for new episode alerts'}
            >
              <BellRing className={`w-3.5 h-3.5 ${isFollowing ? 'fill-amber-400/30 text-amber-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">
                {isFollowing ? 'Following' : 'Follow'}
              </span>
            </button>
          </div>

          {/* User Action Feedback Toast */}
          {feedback && (
            <div className="mt-2 text-[10px] font-bold text-[#F5C400] bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5 text-center animate-in fade-in duration-200">
              {feedback}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <PageLoadingIndicator label="Loading new broadcast releases..." />
      </div>
    );
  }

  return (
    <div className="w-full pb-24 text-[#F3F3F3]">
      {/* Hero Header */}
      <div className="relative border-b border-[#3A3A40] bg-gradient-to-b from-[#18181e] via-[#141418] to-[#101013] px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Badge & Title */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5C400]/15 border border-[#F5C400]/30 text-[#F5C400] text-xs font-black uppercase tracking-wider">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-red-500" />
                  <span>Live Broadcast Schedule</span>
                </div>
                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="px-2.5 py-1 rounded-full bg-[#1f1f26] border border-[#3A3A40] text-slate-300 hover:text-white hover:border-[#F5C400]/50 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Check TMDB for newly broadcasted episodes"
                >
                  <RotateCw className={`w-3 h-3 text-[#F5C400] ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                <span>New Episodes</span>
                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-[#F5C400] text-black font-extrabold uppercase">
                  Schedule
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Browse recent TV episodes categorized by release date. Follow your favorite shows to get automatic alerts the moment new episodes drop.
              </p>
            </div>

            {/* Category Quick Chips Banner */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setActiveTab('today')}
                className={`px-3.5 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                  activeTab === 'today'
                    ? 'bg-red-500/20 border-red-500/60 ring-1 ring-red-500/50 shadow-lg'
                    : 'bg-[#1c1c22] border-[#3A3A40] hover:border-red-500/40'
                }`}
              >
                <div className="text-base font-black text-red-400 flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-red-400" />
                  <span>{todayCount}</span>
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Released Today</div>
              </button>

              <button
                onClick={() => setActiveTab('yesterday')}
                className={`px-3.5 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                  activeTab === 'yesterday'
                    ? 'bg-[#F5C400]/20 border-[#F5C400]/60 ring-1 ring-[#F5C400]/50 shadow-lg'
                    : 'bg-[#1c1c22] border-[#3A3A40] hover:border-amber-500/40'
                }`}
              >
                <div className="text-base font-black text-[#F5C400] flex items-center justify-center gap-1">
                  <Zap className="w-3.5 h-3.5 fill-[#F5C400]" />
                  <span>{yesterdayCount}</span>
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Yesterday</div>
              </button>

              <button
                onClick={() => setActiveTab('this_week')}
                className={`px-3.5 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                  activeTab === 'this_week'
                    ? 'bg-blue-500/20 border-blue-500/60 ring-1 ring-blue-500/50 shadow-lg'
                    : 'bg-[#1c1c22] border-[#3A3A40] hover:border-blue-500/40'
                }`}
              >
                <div className="text-base font-black text-blue-400 flex items-center justify-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{thisWeekCount}</span>
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-400">This Week</div>
              </button>

              {user && (
                <button
                  onClick={() => setActiveTab('followed')}
                  className={`px-3.5 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                    activeTab === 'followed'
                      ? 'bg-amber-500/20 border-amber-500/60 ring-1 ring-amber-500/50 shadow-lg'
                      : 'bg-[#1c1c22] border-[#3A3A40] hover:border-amber-500/40'
                  }`}
                >
                  <div className="text-base font-black text-amber-300 flex items-center justify-center gap-1">
                    <BellRing className="w-3.5 h-3.5" />
                    <span>{followedCount}</span>
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Followed</div>
                </button>
              )}
            </div>
          </div>

          {/* Tab Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-[#F5C400] text-black font-black shadow-lg shadow-amber-500/20'
                    : 'bg-[#1e1e24] text-slate-300 hover:text-white hover:bg-[#282830] border border-[#3A3A40]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>All Releases ({episodes.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('today')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'today'
                    ? 'bg-red-600 text-white font-black shadow-lg shadow-red-600/30'
                    : 'bg-[#1e1e24] text-slate-300 hover:text-white hover:bg-[#282830] border border-[#3A3A40]'
                }`}
              >
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>Released Today ({todayCount})</span>
              </button>

              <button
                onClick={() => setActiveTab('yesterday')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'yesterday'
                    ? 'bg-[#F5C400] text-black font-black shadow-lg shadow-amber-500/20'
                    : 'bg-[#1e1e24] text-slate-300 hover:text-white hover:bg-[#282830] border border-[#3A3A40]'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Yesterday ({yesterdayCount})</span>
              </button>

              <button
                onClick={() => setActiveTab('this_week')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'this_week'
                    ? 'bg-[#F5C400] text-black font-black shadow-lg shadow-amber-500/20'
                    : 'bg-[#1e1e24] text-slate-300 hover:text-white hover:bg-[#282830] border border-[#3A3A40]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>This Week ({thisWeekCount})</span>
              </button>

              <button
                onClick={() => {
                  if (!user) {
                    openAuthModal('login');
                  } else {
                    setActiveTab('followed');
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'followed'
                    ? 'bg-[#F5C400] text-black font-black shadow-lg shadow-amber-500/20'
                    : 'bg-[#1e1e24] text-slate-300 hover:text-white hover:bg-[#282830] border border-[#3A3A40]'
                }`}
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Followed Shows ({followedCount})</span>
              </button>
            </div>

            {/* Filter Input */}
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by series or episode..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#1c1c22] border border-[#3A3A40] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F5C400]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === 'all' && !searchFilter.trim() ? (
          /* Grouped Categorized View (Today, Yesterday, This Week) */
          <div className="space-y-12">
            {groupedSections.map((sec) => {
              if (sec.items.length === 0) return null;
              const IconComp = sec.icon;

              return (
                <section key={sec.id} className="space-y-4">
                  {/* Section Title Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#1e1e24] border border-[#3A3A40] flex items-center justify-center">
                        <IconComp className={`w-4 h-4 ${sec.iconColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                            {sec.title}
                          </h2>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${sec.badgeBg}`}>
                            {sec.items.length} {sec.items.length === 1 ? 'Episode' : 'Episodes'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {sec.subtitle}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab(sec.id as TabType)}
                      className="text-xs font-bold text-[#F5C400] hover:underline cursor-pointer hidden sm:block"
                    >
                      View all in {sec.title} →
                    </button>
                  </div>

                  {/* Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sec.items.map(ep => renderEpisodeCard(ep))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : filteredEpisodes.length > 0 ? (
          /* Filtered Tab Grid */
          <div>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/5">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>
                    {activeTab === 'today' && 'Released Today'}
                    {activeTab === 'yesterday' && 'Episodes Released Yesterday'}
                    {activeTab === 'this_week' && 'Episodes Released This Week'}
                    {activeTab === 'followed' && 'My Followed Series Releases'}
                    {activeTab === 'all' && 'Search Results'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[#25252b] border border-white/10 text-[#F5C400] font-bold">
                    {filteredEpisodes.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeTab === 'today' && 'Episodes broadcasted within the last 24 hours'}
                  {activeTab === 'yesterday' && 'Episodes released yesterday'}
                  {activeTab === 'this_week' && 'Episodes aired earlier in the current 7-day cycle'}
                  {activeTab === 'followed' && 'Latest episodes from the shows you are following'}
                  {activeTab === 'all' && `Matching query "${searchFilter}"`}
                </p>
              </div>

              {activeTab !== 'all' && (
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Show all sections
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEpisodes.map(ep => renderEpisodeCard(ep))}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="py-20 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#1c1c24] border border-[#3A3A40] text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Tv className="w-8 h-8 text-[#F5C400]" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">
              {activeTab === 'followed'
                ? 'No followed series yet'
                : activeTab === 'today'
                ? 'No episodes released today'
                : activeTab === 'yesterday'
                ? 'No episodes released yesterday'
                : 'No episodes match your filter'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {activeTab === 'followed'
                ? 'Follow your favorite TV series from their details page or from the episode cards. When a new episode airs, it will appear here and alert you via the notification bell!'
                : 'Try switching to "All Releases" to see recently broadcasted episodes.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setSearchFilter('');
              }}
              className="px-5 py-2.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs transition-all shadow-lg cursor-pointer"
            >
              Browse All Releases
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
