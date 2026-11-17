import { WatchlistItem, ContinueWatchingItem, HistoryItem, MediaType } from '../types/media';

const WATCHLIST_KEY = 'tstream_watchlist';
const CONTINUE_WATCHING_KEY = 'tstream_continue_watching';
const HISTORY_KEY = 'tstream_history';
const WATCHED_KEY = 'tstream_watched_ids';
const SETTINGS_KEY = 'tstream_user_settings';

export interface UserSettings {
  preferredServer: string;
  preferredSubtitleLang: string;
  preferredWatchRegion: string;
  autoplayNext: boolean;
  theme: 'dark' | 'cinema';
}

const DEFAULT_SETTINGS: UserSettings = {
  preferredServer: 'cinejoy',
  preferredSubtitleLang: 'en',
  preferredWatchRegion: 'US',
  autoplayNext: true,
  theme: 'dark'
};

function emitStorageEvent(type: string) {
  window.dispatchEvent(new CustomEvent('tstream:storage_update', { detail: { type } }));
}

// Watchlist
export function getWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isInWatchlist(id: number): boolean {
  return getWatchlist().some(item => item.id === id);
}

export function toggleWatchlist(item: { id: number; mediaType: MediaType; title: string; posterPath: string; backdropPath: string; releaseDate: string; voteAverage: number }): boolean {
  const current = getWatchlist();
  const exists = current.some(i => i.id === item.id);
  let updated: WatchlistItem[];

  if (exists) {
    updated = current.filter(i => i.id !== item.id);
  } else {
    updated = [
      {
        ...item,
        addedAt: new Date().toISOString()
      },
      ...current
    ];
  }

  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
  emitStorageEvent('watchlist');
  return !exists;
}

// Continue Watching
export function getContinueWatching(): ContinueWatchingItem[] {
  try {
    const raw = localStorage.getItem(CONTINUE_WATCHING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProgress(item: {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string;
  backdropPath: string;
  progressSeconds: number;
  durationSeconds: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
}): void {
  const current = getContinueWatching();
  const percentage = Math.min(100, Math.round((item.progressSeconds / (item.durationSeconds || 1)) * 100));

  const filtered = current.filter(i => !(i.id === item.id && i.seasonNumber === item.seasonNumber && i.episodeNumber === item.episodeNumber));
  const updated: ContinueWatchingItem[] = [
    {
      ...item,
      percentage,
      lastWatched: new Date().toISOString()
    },
    ...filtered
  ].slice(0, 20); // Keep last 20 items

  localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(updated));
  emitStorageEvent('continue_watching');
}

export function removeContinueWatching(id: number): void {
  const current = getContinueWatching();
  const updated = current.filter(i => i.id !== id);
  localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(updated));
  emitStorageEvent('continue_watching');
}

// Watch History
export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToHistory(item: { id: number; mediaType: MediaType; title: string; posterPath: string; seasonNumber?: number; episodeNumber?: number }): void {
  const current = getHistory();
  const filtered = current.filter(i => i.id !== item.id);
  const updated = [
    {
      ...item,
      watchedAt: new Date().toISOString()
    },
    ...filtered
  ].slice(0, 30);

  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  emitStorageEvent('history');
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  emitStorageEvent('history');
}

// Watched status
export function getWatchedIds(): number[] {
  try {
    const raw = localStorage.getItem(WATCHED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isWatched(id: number): boolean {
  return getWatchedIds().includes(id);
}

export function toggleWatched(id: number): boolean {
  const current = getWatchedIds();
  const exists = current.includes(id);
  const updated = exists ? current.filter(i => i !== id) : [...current, id];
  localStorage.setItem(WATCHED_KEY, JSON.stringify(updated));
  emitStorageEvent('watched');
  return !exists;
}

// Settings
export function getUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateUserSettings(partial: Partial<UserSettings>): UserSettings {
  const current = getUserSettings();
  const updated = { ...current, ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  emitStorageEvent('settings');
  return updated;
}
