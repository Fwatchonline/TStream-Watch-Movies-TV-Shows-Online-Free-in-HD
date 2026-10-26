import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Clock,
  History,
  Trash2,
  Play,
  Settings,
  Film,
  Check,
  Server,
  Subtitles
} from 'lucide-react';
import {
  getWatchlist,
  getHistory,
  clearHistory,
  toggleWatchlist,
  getUserSettings,
  updateUserSettings,
  UserSettings
} from '../services/storage';
import { MediaItem, WatchlistItem, HistoryItem } from '../types/media';
import { STREAMING_PROVIDERS } from '../services/providers';
import { useAuth } from '../context/AuthContext';
import { ContinueWatchingSection } from '../components/ContinueWatchingSection';

interface LibraryPageProps {
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem, season?: number, episode?: number) => void;
  onExplore: () => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onSelectMedia,
  onWatchMedia,
  onExplore
}) => {
  const { user, continueWatching } = useAuth();
  const [activeTab, setActiveTab] = useState<'watchlist' | 'continue' | 'history' | 'settings'>('watchlist');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(getWatchlist);
  const [history, setHistory] = useState<HistoryItem[]>(getHistory);
  const [settings, setSettings] = useState<UserSettings>(getUserSettings);

  const refreshData = () => {
    setWatchlist(getWatchlist());
    setHistory(getHistory());
    setSettings(getUserSettings());
  };

  useEffect(() => {
    window.addEventListener('tstream:storage_update', refreshData);
    return () => window.removeEventListener('tstream:storage_update', refreshData);
  }, []);

  const handleRemoveWatchlist = (e: React.MouseEvent, item: WatchlistItem) => {
    e.stopPropagation();
    toggleWatchlist({
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      releaseDate: item.releaseDate,
      voteAverage: item.voteAverage
    });
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear your entire watch history?')) {
      clearHistory();
    }
  };

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    const updated = updateUserSettings({ [key]: value });
    setSettings(updated);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Personal Library
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manage your saved watchlist, in-progress streams, and viewing history.
        </p>

        {/* Library Tab Segmented Control */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#29292D] rounded-xl border border-[#3A3A40] w-fit mt-5">
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'watchlist'
                ? 'bg-[#F5C400] text-black font-bold shadow-md'
                : 'text-[#A6A6AC] hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Watchlist ({watchlist.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('continue')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'continue'
                ? 'bg-[#F5C400] text-black font-bold shadow-md'
                : 'text-[#A6A6AC] hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Continue Watching {user ? `(${continueWatching.length})` : '(Registered)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#F5C400] text-black font-bold shadow-md'
                : 'text-[#A6A6AC] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Watch History ({history.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#F5C400] text-black font-bold shadow-md'
                : 'text-[#A6A6AC] hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* Watchlist View */}
      {activeTab === 'watchlist' && (
        <div>
          {watchlist.length === 0 ? (
            <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 text-center bg-[#29292D] rounded-2xl border border-[#3A3A40]">
              <Bookmark className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-white">Your Watchlist is Empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">
                Add titles by clicking the + button on any movie or TV show card to track titles you want to watch.
              </p>
              <button
                onClick={onExplore}
                className="px-5 py-2.5 rounded-xl bg-[#F5C400] text-black text-xs font-bold hover:bg-[#e0b400] transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Browse Popular Titles
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {watchlist.map(item => {
                const mediaItem: MediaItem = {
                  id: item.id,
                  tmdbId: item.id,
                  title: item.title,
                  overview: '',
                  posterPath: item.posterPath,
                  backdropPath: item.backdropPath,
                  releaseDate: item.releaseDate,
                  voteAverage: item.voteAverage,
                  voteCount: 100,
                  popularity: 100,
                  genres: [],
                  mediaType: item.mediaType
                };

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectMedia(mediaItem)}
                    className="group relative bg-[#141418] rounded-xl overflow-hidden border border-white/5 hover:border-white/20 transition-all cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-[2/3] w-full bg-[#1c1c24] overflow-hidden">
                      <img
                        src={item.posterPath}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={(e) => handleRemoveWatchlist(e, item)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-red-600 text-white transition-colors"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-3">
                      <h4 className="text-xs sm:text-sm font-semibold text-white group-hover:text-red-400 line-clamp-1">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.mediaType === 'movie' ? 'Movie' : 'TV Series'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Continue Watching View (Exclusively for Registered Users) */}
      {activeTab === 'continue' && (
        <ContinueWatchingSection
          onWatchMedia={onWatchMedia}
          onSelectMedia={onSelectMedia}
          variant="library"
        />
      )}

      {/* History View */}
      {activeTab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 text-center bg-[#141418] rounded-2xl border border-white/5">
              <History className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-white">No Watch History</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">
                Titles you watch will be automatically recorded here for convenient reference.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-950/40 text-slate-400 hover:text-red-400 text-xs font-semibold border border-white/5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              </div>

              <div className="space-y-2">
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#141418] border border-white/5 hover:border-white/15 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded overflow-hidden bg-[#1c1c24] shrink-0">
                        <img
                          src={item.posterPath}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.seasonNumber ? `S${item.seasonNumber} : E${item.episodeNumber}` : 'Full Movie'} · Watched {new Date(item.watchedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preferences / Settings */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-[#141418] border border-white/10 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Streaming Preferences</h3>
            <p className="text-xs text-slate-400">Configure your default streaming nodes and subtitle language.</p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Default Stream Server
              </label>
              <select
                value={settings.preferredServer}
                onChange={(e) => handleSettingChange('preferredServer', e.target.value)}
                className="w-full bg-[#1c1c24] border border-white/10 text-xs text-slate-200 rounded-lg p-3 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                <optgroup label="✨ Primary Direct HLS Servers">
                  {STREAMING_PROVIDERS.filter(s => s.category === 'vyla').map(srv => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} ({srv.quality || '1080p'} · {srv.badge})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🌟 Backup Direct HLS Clusters">
                  {STREAMING_PROVIDERS.filter(s => s.category === 'featured').map(srv => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name} ({srv.quality || '1080p'} · {srv.badge})
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
                className="w-full bg-[#1c1c24] border border-white/10 text-xs text-slate-200 rounded-lg p-3 focus:outline-none focus:border-red-500"
              >
                <option value="sr">Serbian (sr)</option>
                <option value="hr">Croatian (hr)</option>
                <option value="bs">Bosnian (bs)</option>
                <option value="en">English (en)</option>
                <option value="es">Spanish (es)</option>
                <option value="de">German (de)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1c1c24] border border-white/5">
              <div>
                <span className="text-xs font-bold text-white block">Autoplay Next Episode</span>
                <span className="text-[11px] text-slate-400">Automatically switch to the next TV episode upon finish.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoplayNext}
                onChange={(e) => handleSettingChange('autoplayNext', e.target.checked)}
                className="w-4 h-4 accent-red-600 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
