import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  Clock,
  History,
  Trash2,
  Play,
  Settings,
  Film,
  Tv,
  Sparkles,
  CheckCircle2,
  ArrowUpDown
} from 'lucide-react';
import { getUserSettings, updateUserSettings, UserSettings } from '../services/storage';
import { setAutoplayNextEpisodePreference } from '../services/playerSettings';
import {
  MediaItem,
  MediaType,
  WatchHistoryRecord,
  CompletedMediaRecord
} from '../types/media';
import { STREAMING_PROVIDERS } from '../services/providers';
import { useAuth } from '../context/AuthContext';
import { ContinueWatchingSection } from '../components/ContinueWatchingSection';

interface LibraryPageProps {
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem, season?: number, episode?: number) => void;
  onExplore: () => void;
}

type LibraryTab =
  | 'continue'
  | 'history'
  | 'watchlist'
  | 'completed'
  | 'movies'
  | 'tv'
  | 'anime'
  | 'settings';

type SortOrder = 'recent' | 'title' | 'progress';

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onSelectMedia,
  onWatchMedia,
  onExplore
}) => {
  const {
    user,
    openAuthModal,
    watchlist,
    continueWatching,
    watchHistory,
    completedMedia,
    toggleWatchlist,
    removeHistoryItem,
    clearWatchHistory,
    removeCompletedItem,
    clearCompletedMedia
  } = useAuth();

  const [activeTab, setActiveTab] = useState<LibraryTab>('continue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [confirmClear, setConfirmClear] = useState<'history' | 'completed' | null>(null);
  const [settings, setSettings] = useState<UserSettings>(getUserSettings);

  const buildMediaItemFromRecord = (rec: {
    tmdbId?: string;
    anilistId?: number;
    malId?: number;
    mediaType: MediaType;
    title: string;
    posterPath?: string;
    backdropPath?: string;
    releaseDate?: string;
    voteAverage?: number;
    genres?: string[];
  }): MediaItem => {
    const isAnime = rec.mediaType === 'anime';
    const numId = Number(isAnime ? (rec.anilistId || rec.tmdbId || 0) : (rec.tmdbId || 0));
    return {
      id: numId,
      tmdbId: numId,
      anilistId: isAnime ? (rec.anilistId || numId) : undefined,
      malId: rec.malId,
      title: rec.title,
      overview: '',
      posterPath: rec.posterPath || '',
      backdropPath: rec.backdropPath || rec.posterPath || '',
      releaseDate: rec.releaseDate || '',
      voteAverage: rec.voteAverage || 0,
      voteCount: 0,
      popularity: 0,
      genres: (rec.genres || []).map((name, idx) => ({ id: idx, name })),
      mediaType: rec.mediaType
    };
  };

  const sortHistory = (list: WatchHistoryRecord[]): WatchHistoryRecord[] => {
    const copy = [...list];
    if (sortOrder === 'title') {
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortOrder === 'progress') {
      return copy.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    }
    return copy.sort(
      (a, b) =>
        new Date(b.updatedAt || b.lastWatchedAt).getTime() -
        new Date(a.updatedAt || a.lastWatchedAt).getTime()
    );
  };

  const sortedHistory = useMemo(() => sortHistory(watchHistory), [watchHistory, sortOrder]);
  const moviesHistory = useMemo(
    () => sortedHistory.filter((h) => h.mediaType === 'movie'),
    [sortedHistory]
  );
  const tvHistory = useMemo(
    () => sortedHistory.filter((h) => h.mediaType === 'tv'),
    [sortedHistory]
  );
  const animeHistory = useMemo(
    () => sortedHistory.filter((h) => h.mediaType === 'anime'),
    [sortedHistory]
  );

  const sortedWatchlist = useMemo(() => {
    const copy = [...watchlist];
    if (sortOrder === 'title') {
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    }
    return copy.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [watchlist, sortOrder]);

  const sortedCompleted = useMemo(() => {
    const copy = [...completedMedia];
    if (sortOrder === 'title') {
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    }
    return copy.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [completedMedia, sortOrder]);

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    if (key === 'autoplayNext') {
      void setAutoplayNextEpisodePreference(Boolean(value));
      setSettings((prev) => ({ ...prev, autoplayNext: Boolean(value) }));
      return;
    }
    const updated = updateUserSettings({ [key]: value });
    setSettings(updated);
  };

  const renderHistoryList = (items: WatchHistoryRecord[], emptyTitle: string, emptyHint: string) => {
    if (items.length === 0) {
      return (
        <div className="min-h-[36vh] flex flex-col items-center justify-center p-8 text-center bg-[#1a1a1d] rounded-xl border border-[#3A3A40]">
          <History className="w-11 h-11 text-slate-500 mb-3" />
          <h3 className="text-base font-bold text-white">{emptyTitle}</h3>
          <p className="text-xs text-[#A6A6AC] max-w-sm mt-1 mb-5 leading-relaxed">{emptyHint}</p>
          <button
            type="button"
            onClick={onExplore}
            className="px-5 py-2.5 rounded-lg bg-[#F5C400] text-black text-xs font-bold hover:bg-[#e0b400] transition-colors cursor-pointer"
          >
            Browse Catalog
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {items.map((item) => {
          const mediaItem = buildMediaItemFromRecord(item);
          const isEpisodic = item.mediaType === 'tv' || item.mediaType === 'anime';
          const episodeLabel =
            item.mediaType === 'anime'
              ? `Ep ${item.episodeNumber || 1}`
              : item.mediaType === 'tv' && item.seasonNumber && item.episodeNumber
              ? `S${item.seasonNumber} · E${item.episodeNumber}`
              : 'Feature';

          return (
            <div
              key={item.mediaKey}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#1a1a1d] border border-[#3A3A40] hover:border-[#F5C400]/60 transition-colors"
            >
              <div
                className="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1"
                onClick={() => onSelectMedia(mediaItem)}
              >
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-[#121215] shrink-0 border border-white/5">
                  {item.posterPath ? (
                    <img
                      src={item.posterPath}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <Film className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate hover:text-[#F5C400] transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#A6A6AC] mt-0.5 truncate tabular-nums">
                    {item.mediaType.toUpperCase()} · {episodeLabel}
                    {isEpisodic && item.episodeName ? ` — ${item.episodeName}` : ''} · Watched{' '}
                    {new Date(item.lastWatchedAt || item.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-2.5 mt-2 max-w-xs">
                    <div className="flex-1 h-1.5 bg-[#2e2e34] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.completed ? 'bg-emerald-400' : 'bg-[#F5C400]'}`}
                        style={{ width: `${Math.min(100, Math.max(2, item.percentage || 0))}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-300 tabular-nums shrink-0">
                      {item.completed ? 'Completed' : `${item.percentage || 0}%`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 justify-end">
                <button
                  type="button"
                  onClick={() => onWatchMedia(mediaItem, item.seasonNumber || 1, item.episodeNumber || 1)}
                  className="px-3.5 py-2 rounded-lg bg-[#F5C400] hover:bg-[#e0b400] text-black text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>{item.completed ? 'Watch Again' : 'Resume'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void removeHistoryItem(item.mediaKey)}
                  aria-label={`Remove ${item.title} from history`}
                  title="Remove entry"
                  className="p-2 rounded-lg bg-[#29292D] hover:bg-rose-600/90 text-slate-300 hover:text-white border border-[#3A3A40] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const tabs: { id: LibraryTab; label: string; count?: number; icon: React.ReactNode }[] = [
    { id: 'continue', label: 'Continue Watching', count: continueWatching.length, icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'history', label: 'Watch History', count: watchHistory.length, icon: <History className="w-3.5 h-3.5" /> },
    { id: 'watchlist', label: 'My Watchlist', count: watchlist.length, icon: <Bookmark className="w-3.5 h-3.5" /> },
    { id: 'completed', label: 'Completed', count: completedMedia.length, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { id: 'movies', label: 'Movies', count: moviesHistory.length, icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'tv', label: 'TV Shows', count: tvHistory.length, icon: <Tv className="w-3.5 h-3.5" /> },
    { id: 'anime', label: 'Anime', count: animeHistory.length, icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Preferences', icon: <Settings className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      <div className="mb-7 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Personal Library
          </h1>
          <p className="text-xs sm:text-sm text-[#A6A6AC] mt-1">
            {user
              ? `Cloud synced to ${user.email || user.displayName} · Movies, TV Series, and Anime`
              : 'Saved locally on this device · '}
            {!user && (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="text-[#F5C400] hover:underline font-semibold cursor-pointer"
              >
                Sign in to sync across devices
              </button>
            )}
          </p>
        </div>

        {activeTab !== 'settings' && activeTab !== 'continue' && (
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#A6A6AC]" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              aria-label="Sort library items"
              className="bg-[#29292D] border border-[#3A3A40] text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#F5C400] cursor-pointer"
            >
              <option value="recent">Recently Watched / Added</option>
              <option value="title">Title (A–Z)</option>
              <option value="progress">Completion %</option>
            </select>
          </div>
        )}
      </div>

      {/* 7 Library Sections + Preferences */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#1a1a1d] rounded-xl border border-[#3A3A40] mb-6">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setConfirmClear(null);
                setActiveTab(tab.id);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                isActive
                  ? 'bg-[#F5C400] text-black font-bold'
                  : 'text-[#A6A6AC] hover:text-white hover:bg-[#29292D]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`text-[11px] ${isActive ? 'text-black/75' : 'text-slate-400'}`}>
                  ({tab.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'continue' && (
        <ContinueWatchingSection
          onWatchMedia={onWatchMedia}
          onSelectMedia={onSelectMedia}
          variant="library"
        />
      )}

      {activeTab === 'history' && (
        <div>
          {sortedHistory.length > 0 && (
            <div className="flex justify-end mb-4 gap-2">
              {confirmClear === 'history' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void clearWatchHistory();
                      setConfirmClear(null);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Confirm Clear All History
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(null)}
                    className="px-3.5 py-2 rounded-lg bg-[#29292D] text-slate-300 text-xs font-semibold border border-[#3A3A40] cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear('history')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1a1a1d] hover:bg-rose-950/50 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-[#3A3A40] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          )}
          {renderHistoryList(
            sortedHistory,
            'No Watch History Yet',
            'Movies, TV series, and anime episodes you play are recorded automatically here.'
          )}
        </div>
      )}

      {activeTab === 'watchlist' && (
        <div>
          {sortedWatchlist.length === 0 ? (
            <div className="min-h-[36vh] flex flex-col items-center justify-center p-8 text-center bg-[#1a1a1d] rounded-xl border border-[#3A3A40]">
              <Bookmark className="w-11 h-11 text-slate-500 mb-3" />
              <h3 className="text-base font-bold text-white">Your Watchlist is Empty</h3>
              <p className="text-xs text-[#A6A6AC] max-w-sm mt-1 mb-5 leading-relaxed">
                Bookmark any movie, TV series, or anime to save it here for later.
              </p>
              <button
                type="button"
                onClick={onExplore}
                className="px-5 py-2.5 rounded-lg bg-[#F5C400] text-black text-xs font-bold hover:bg-[#e0b400] transition-colors cursor-pointer"
              >
                Browse Popular Titles
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {sortedWatchlist.map((item) => {
                const mediaItem = buildMediaItemFromRecord(item);
                return (
                  <div
                    key={item.mediaKey || `${item.mediaType}_${item.tmdbId}`}
                    onClick={() => onSelectMedia(mediaItem)}
                    className="group relative bg-[#1a1a1d] rounded-xl overflow-hidden border border-[#3A3A40] hover:border-[#F5C400] transition-colors cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-[2/3] w-full bg-[#121215] overflow-hidden">
                      {item.posterPath ? (
                        <img
                          src={item.posterPath}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#A6A6AC] p-3 text-center">
                          {item.title}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleWatchlist(mediaItem);
                        }}
                        aria-label={`Remove ${item.title} from watchlist`}
                        className="absolute top-2 right-2 p-2 rounded-lg bg-black/75 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-3">
                      <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#F5C400] line-clamp-1">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-[#A6A6AC] mt-0.5">
                        {item.mediaType === 'anime' ? 'Anime' : item.mediaType === 'tv' ? 'TV Series' : 'Movie'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div>
          {sortedCompleted.length === 0 ? (
            <div className="min-h-[36vh] flex flex-col items-center justify-center p-8 text-center bg-[#1a1a1d] rounded-xl border border-[#3A3A40]">
              <CheckCircle2 className="w-11 h-11 text-slate-500 mb-3" />
              <h3 className="text-base font-bold text-white">No Completed Titles Yet</h3>
              <p className="text-xs text-[#A6A6AC] max-w-sm mt-1 leading-relaxed">
                Titles you watch through at least 90% are automatically marked as Completed here.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex justify-end mb-4 gap-2">
                {confirmClear === 'completed' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void clearCompletedMedia();
                        setConfirmClear(null);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Confirm Clear Completed
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(null)}
                      className="px-3.5 py-2 rounded-lg bg-[#29292D] text-slate-300 text-xs font-semibold border border-[#3A3A40] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear('completed')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1a1a1d] hover:bg-rose-950/50 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-[#3A3A40] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Completed</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {sortedCompleted.map((item: CompletedMediaRecord) => {
                  const mediaItem = buildMediaItemFromRecord(item);
                  return (
                    <div
                      key={item.mediaKey}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#1a1a1d] border border-[#3A3A40] hover:border-[#F5C400]/60 transition-colors"
                    >
                      <div
                        className="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1"
                        onClick={() => onSelectMedia(mediaItem)}
                      >
                        <div className="w-11 h-15 rounded-lg overflow-hidden bg-[#121215] shrink-0">
                          {item.posterPath && (
                            <img
                              src={item.posterPath}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                          <p className="text-xs text-[#A6A6AC] mt-0.5 tabular-nums">
                            {item.mediaType.toUpperCase()}
                            {item.seasonNumber && item.episodeNumber
                              ? ` · S${item.seasonNumber} E${item.episodeNumber}`
                              : item.episodeNumber
                              ? ` · Ep ${item.episodeNumber}`
                              : ''}
                            {' · '}Completed {new Date(item.completedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onWatchMedia(mediaItem, item.seasonNumber || 1, item.episodeNumber || 1)}
                          className="px-3 py-2 rounded-lg bg-[#29292D] hover:bg-[#F5C400] hover:text-black text-white text-xs font-semibold border border-[#3A3A40] transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Rewatch</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeCompletedItem(item.mediaKey)}
                          aria-label={`Remove ${item.title} from completed`}
                          className="p-2 rounded-lg bg-[#29292D] hover:bg-rose-600/90 text-slate-300 hover:text-white border border-[#3A3A40] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'movies' &&
        renderHistoryList(
          moviesHistory,
          'No Movies Watched Yet',
          'Start any movie to track progress and quick-resume here.'
        )}

      {activeTab === 'tv' &&
        renderHistoryList(
          tvHistory,
          'No TV Series Watched Yet',
          'Episodes you watch across any TV season appear here.'
        )}

      {activeTab === 'anime' &&
        renderHistoryList(
          animeHistory,
          'No Anime Watched Yet',
          'Stream anime episodes from the Anime hub to track episodes and resume positions.'
        )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-[#1a1a1d] border border-[#3A3A40] rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Streaming Preferences</h3>
            <p className="text-xs text-[#A6A6AC]">Configure your default streaming servers, subtitle language, and autoplay behavior.</p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Default Stream Server
              </label>
              <select
                value={settings.preferredServer}
                onChange={(e) => handleSettingChange('preferredServer', e.target.value)}
                className="w-full bg-[#29292D] border border-[#3A3A40] text-xs text-white rounded-lg p-3 focus:outline-none focus:border-[#F5C400] cursor-pointer"
              >
                <optgroup label="Primary Direct HLS Servers">
                  {STREAMING_PROVIDERS.filter((s) => s.category === 'vyla').map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} ({srv.badge})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Backup Direct HLS Clusters">
                  {STREAMING_PROVIDERS.filter((s) => s.category === 'featured').map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} ({srv.badge})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Default Subtitle Language
              </label>
              <select
                value={settings.preferredSubtitleLang}
                onChange={(e) => handleSettingChange('preferredSubtitleLang', e.target.value)}
                className="w-full bg-[#29292D] border border-[#3A3A40] text-xs text-white rounded-lg p-3 focus:outline-none focus:border-[#F5C400]"
              >
                <option value="sr">Serbian (sr)</option>
                <option value="hr">Croatian (hr)</option>
                <option value="bs">Bosnian (bs)</option>
                <option value="en">English (en)</option>
                <option value="es">Spanish (es)</option>
                <option value="de">German (de)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#232326] border border-[#3A3A40]">
              <div>
                <span className="text-xs font-bold text-white block">Autoplay Next Episode</span>
                <span className="text-[11px] text-[#A6A6AC]">Automatically transition to the next episode or next season on finish.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoplayNext}
                onChange={(e) => handleSettingChange('autoplayNext', e.target.checked)}
                className="w-4 h-4 accent-[#F5C400] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
