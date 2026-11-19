import {
  WatchlistItem,
  ContinueWatchingItem,
  HistoryItem,
  MediaType,
  WatchHistoryRecord,
  CompletedMediaRecord,
  Genre
} from '../types/media';
import { buildMediaKey, buildSeriesKey, isCompletionReached } from '../utils/mediaKey';

const WATCHLIST_KEY = 'tstream_watchlist';
const CONTINUE_WATCHING_KEY = 'tstream_continue_watching';
const HISTORY_KEY = 'tstream_history';
const WATCHED_KEY = 'tstream_watched_ids';
const SETTINGS_KEY = 'tstream_user_settings';
const GUEST_UNIFIED_HISTORY_KEY = 'tstream_guest_watch_history_v1';
const GUEST_COMPLETED_KEY = 'tstream_guest_completed_v1';

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

// In-memory storage fallback for SSR / Node test environments where window.localStorage is absent
const memoryFallbackStore = new Map<string, string>();

function readStorageRaw(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return memoryFallbackStore.get(key) ?? null;
  } catch {
    return memoryFallbackStore.get(key) ?? null;
  }
}

function writeStorageRaw(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    } else {
      memoryFallbackStore.set(key, value);
    }
  } catch {
    memoryFallbackStore.set(key, value);
  }
}

function removeStorageRaw(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    } else {
      memoryFallbackStore.delete(key);
    }
  } catch {
    memoryFallbackStore.delete(key);
  }
}

export function resetMemoryStorageForTests(): void {
  memoryFallbackStore.clear();
}

function emitStorageEvent(type: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tstream:storage_update', { detail: { type } }));
  }
}

function detectClientDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent || '';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

// ============================================================================
// Watchlist (Guest + Unified)
// ============================================================================
export function getWatchlist(): WatchlistItem[] {
  try {
    const raw = readStorageRaw(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isInWatchlist(id: number, mediaType?: MediaType): boolean {
  return getWatchlist().some(item => {
    if (mediaType && item.mediaType !== mediaType) return false;
    return (
      item.id === id ||
      item.tmdbId === id ||
      item.anilistId === id
    );
  });
}

export function toggleWatchlist(item: {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string;
  backdropPath: string;
  releaseDate: string;
  voteAverage: number;
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  mediaFormat?: string;
  genres?: Array<string | Genre>;
}): boolean {
  const current = getWatchlist();
  const targetSeriesKey = buildSeriesKey({
    mediaType: item.mediaType,
    tmdbId: item.tmdbId ?? (item.mediaType !== 'anime' ? item.id : undefined),
    anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
    id: item.id
  });

  const exists = current.some(i => {
    const k = i.mediaKey || buildSeriesKey({
      mediaType: i.mediaType,
      tmdbId: i.tmdbId ?? (i.mediaType !== 'anime' ? i.id : undefined),
      anilistId: i.anilistId ?? (i.mediaType === 'anime' ? i.id : undefined),
      id: i.id
    });
    return k === targetSeriesKey || (i.id === item.id && i.mediaType === item.mediaType);
  });

  let updated: WatchlistItem[];

  if (exists) {
    updated = current.filter(i => {
      const k = i.mediaKey || buildSeriesKey({
        mediaType: i.mediaType,
        tmdbId: i.tmdbId ?? (i.mediaType !== 'anime' ? i.id : undefined),
        anilistId: i.anilistId ?? (i.mediaType === 'anime' ? i.id : undefined),
        id: i.id
      });
      return k !== targetSeriesKey && !(i.id === item.id && i.mediaType === item.mediaType);
    });
  } else {
    const normalizedGenres = Array.isArray(item.genres)
      ? item.genres
          .map((g) => (typeof g === 'string' ? g : g?.name || ''))
          .filter(Boolean)
      : undefined;
    updated = [
      {
        ...item,
        genres: normalizedGenres,
        mediaKey: targetSeriesKey,
        addedAt: new Date().toISOString()
      },
      ...current
    ];
  }

  writeStorageRaw(WATCHLIST_KEY, JSON.stringify(updated));
  emitStorageEvent('watchlist');
  return !exists;
}

// ============================================================================
// Continue Watching (Guest Session Support Included)
// ============================================================================
export function getContinueWatching(): ContinueWatchingItem[] {
  try {
    const raw = readStorageRaw(CONTINUE_WATCHING_KEY);
    const list: ContinueWatchingItem[] = raw ? JSON.parse(raw) : [];
    return list.filter(i => !i.completed && (i.percentage ?? 0) < 95);
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
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  mediaFormat?: string;
  genres?: string[];
  serverId?: string;
  audioLang?: string;
}): void {
  const now = new Date().toISOString();
  const safeDur = Math.max(0, Math.floor(item.durationSeconds || 0));
  const safeProg = Math.max(0, Math.floor(item.progressSeconds || 0));
  const percentage = safeDur > 0
    ? Math.min(100, Math.max(1, Math.round((safeProg / safeDur) * 100)))
    : 1;
  const completed = isCompletionReached(safeProg, safeDur);

  const seriesKey = buildSeriesKey({
    mediaType: item.mediaType,
    tmdbId: item.tmdbId ?? (item.mediaType !== 'anime' ? item.id : undefined),
    anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
    id: item.id
  });

  const mediaKey = buildMediaKey({
    mediaType: item.mediaType,
    tmdbId: item.tmdbId ?? (item.mediaType !== 'anime' ? item.id : undefined),
    anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
    id: item.id,
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber
  });

  // 1. Update Continue Watching list (unless completed >= 95%)
  try {
    const rawCw = readStorageRaw(CONTINUE_WATCHING_KEY);
    const currentCw: ContinueWatchingItem[] = rawCw ? JSON.parse(rawCw) : [];
    const filteredCw = currentCw.filter(i => {
      const k = i.seriesKey || buildSeriesKey({
        mediaType: i.mediaType,
        tmdbId: i.tmdbId ?? (i.mediaType !== 'anime' ? i.id : undefined),
        anilistId: i.anilistId ?? (i.mediaType === 'anime' ? i.id : undefined),
        id: i.id
      });
      return k !== seriesKey;
    });

    if (percentage < 95) {
      filteredCw.unshift({
        ...item,
        mediaKey,
        seriesKey,
        percentage,
        completed: false,
        lastWatched: now
      });
    }
    writeStorageRaw(CONTINUE_WATCHING_KEY, JSON.stringify(filteredCw.slice(0, 30)));
    emitStorageEvent('continue_watching');
  } catch {}

  // 2. Also persist into Unified Guest Watch History (keyed by mediaKey)
  saveGuestWatchHistoryRecord({
    mediaKey,
    seriesKey,
    mediaType: item.mediaType,
    tmdbId: item.tmdbId !== undefined
      ? String(item.tmdbId)
      : item.mediaType !== 'anime'
      ? String(item.id)
      : undefined,
    anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
    malId: item.malId,
    mediaFormat: item.mediaFormat,
    title: item.title,
    posterPath: item.posterPath,
    backdropPath: item.backdropPath,
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber,
    episodeName: item.episodeName,
    progressSeconds: safeProg,
    durationSeconds: safeDur,
    percentage,
    completed,
    completedAt: completed ? now : undefined,
    lastWatchedAt: now,
    updatedAt: now,
    device: detectClientDeviceLabel(),
    serverId: item.serverId,
    audioLang: item.audioLang,
    genres: item.genres
  });
}

export function removeContinueWatching(id: number, mediaType?: MediaType): void {
  try {
    const rawCw = readStorageRaw(CONTINUE_WATCHING_KEY);
    const current: ContinueWatchingItem[] = rawCw ? JSON.parse(rawCw) : [];
    const updated = current.filter(i => {
      if (mediaType) {
        const matchId = i.id === id || i.tmdbId === id || i.anilistId === id;
        return !(matchId && i.mediaType === mediaType);
      }
      return i.id !== id && i.tmdbId !== id && i.anilistId !== id;
    });
    writeStorageRaw(CONTINUE_WATCHING_KEY, JSON.stringify(updated));
    emitStorageEvent('continue_watching');
  } catch {}
}

// ============================================================================
// Unified Guest Watch History & Completed Records
// ============================================================================
export function getGuestWatchHistory(): WatchHistoryRecord[] {
  try {
    const raw = readStorageRaw(GUEST_UNIFIED_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WatchHistoryRecord[];
      return parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    // Migrate legacy GUEST HISTORY_KEY records non-destructively on first read
    const legacyRaw = readStorageRaw(HISTORY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as HistoryItem[];
      return legacy.map(item => ({
        mediaKey: item.mediaKey || buildMediaKey({
          mediaType: item.mediaType,
          tmdbId: item.tmdbId ?? (item.mediaType !== 'anime' ? item.id : undefined),
          anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
          id: item.id,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber
        }),
        seriesKey: item.seriesKey || buildSeriesKey({
          mediaType: item.mediaType,
          tmdbId: item.tmdbId ?? (item.mediaType !== 'anime' ? item.id : undefined),
          anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
          id: item.id
        }),
        mediaType: item.mediaType,
        tmdbId: item.tmdbId ? String(item.tmdbId) : item.mediaType !== 'anime' ? String(item.id) : undefined,
        anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
        malId: item.malId,
        mediaFormat: item.mediaFormat,
        title: item.title,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        episodeName: item.episodeName,
        progressSeconds: item.progressSeconds ?? 0,
        durationSeconds: item.durationSeconds ?? 0,
        percentage: item.percentage ?? 0,
        completed: Boolean(item.completed),
        completedAt: item.completedAt,
        lastWatchedAt: item.watchedAt,
        updatedAt: item.updatedAt || item.watchedAt
      }));
    }
  } catch {}
  return [];
}

export function saveGuestWatchHistoryRecord(record: WatchHistoryRecord): WatchHistoryRecord[] {
  const list = getGuestWatchHistory();
  const idx = list.findIndex(r => r.mediaKey === record.mediaKey);
  const existing = idx >= 0 ? list[idx] : undefined;

  // Resolve non-destructively using newest timestamp; preserve earliest completedAt if already completed
  const merged: WatchHistoryRecord = {
    ...existing,
    ...record,
    completed: Boolean(record.completed || existing?.completed),
    completedAt: existing?.completedAt || record.completedAt || (record.completed ? record.updatedAt : undefined),
    genres: record.genres && record.genres.length > 0 ? record.genres : existing?.genres
  };

  const without = list.filter(r => r.mediaKey !== record.mediaKey);
  const next = [merged, ...without].slice(0, 150);
  writeStorageRaw(GUEST_UNIFIED_HISTORY_KEY, JSON.stringify(next));

  if (merged.completed) {
    saveGuestCompletedRecord({
      mediaKey: merged.mediaKey,
      mediaType: merged.mediaType,
      tmdbId: merged.tmdbId,
      anilistId: merged.anilistId,
      malId: merged.malId,
      title: merged.title,
      posterPath: merged.posterPath,
      seasonNumber: merged.seasonNumber,
      episodeNumber: merged.episodeNumber,
      completedAt: merged.completedAt || merged.updatedAt,
      updatedAt: merged.updatedAt
    });
  }

  // Also keep legacy HISTORY_KEY synchronized for any legacy consumers
  try {
    const legacyList: HistoryItem[] = next.slice(0, 50).map(h => ({
      id: Number(h.anilistId || h.tmdbId || 0),
      mediaKey: h.mediaKey,
      seriesKey: h.seriesKey,
      tmdbId: h.tmdbId ? Number(h.tmdbId) : undefined,
      anilistId: h.anilistId,
      malId: h.malId,
      mediaType: h.mediaType,
      mediaFormat: h.mediaFormat,
      title: h.title,
      posterPath: h.posterPath || '',
      backdropPath: h.backdropPath,
      watchedAt: h.lastWatchedAt,
      updatedAt: h.updatedAt,
      seasonNumber: h.seasonNumber,
      episodeNumber: h.episodeNumber,
      episodeName: h.episodeName,
      progressSeconds: h.progressSeconds,
      durationSeconds: h.durationSeconds,
      percentage: h.percentage,
      completed: h.completed,
      completedAt: h.completedAt
    }));
    writeStorageRaw(HISTORY_KEY, JSON.stringify(legacyList));
  } catch {}

  emitStorageEvent('history');
  return next;
}

export function getGuestWatchProgressItem(mediaKey: string): WatchHistoryRecord | null {
  const list = getGuestWatchHistory();
  return list.find(r => r.mediaKey === mediaKey) || null;
}

export function removeGuestWatchHistoryItem(mediaKey: string): void {
  const next = getGuestWatchHistory().filter(r => r.mediaKey !== mediaKey);
  writeStorageRaw(GUEST_UNIFIED_HISTORY_KEY, JSON.stringify(next));
  try {
    const legacy = getHistory().filter(i => i.mediaKey !== mediaKey);
    writeStorageRaw(HISTORY_KEY, JSON.stringify(legacy));
  } catch {}
  emitStorageEvent('history');
}

export function getGuestCompletedMedia(): CompletedMediaRecord[] {
  try {
    const raw = readStorageRaw(GUEST_COMPLETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestCompletedRecord(record: CompletedMediaRecord): CompletedMediaRecord[] {
  const current = getGuestCompletedMedia().filter(c => c.mediaKey !== record.mediaKey);
  const next = [record, ...current].slice(0, 150);
  writeStorageRaw(GUEST_COMPLETED_KEY, JSON.stringify(next));
  emitStorageEvent('completed');
  return next;
}

export function removeGuestCompletedItem(mediaKey: string): void {
  const next = getGuestCompletedMedia().filter(c => c.mediaKey !== mediaKey);
  writeStorageRaw(GUEST_COMPLETED_KEY, JSON.stringify(next));
  emitStorageEvent('completed');
}

export function clearGuestCompletedMedia(): void {
  removeStorageRaw(GUEST_COMPLETED_KEY);
  emitStorageEvent('completed');
}

// Legacy History helpers (backward compatible)
export function getHistory(): HistoryItem[] {
  try {
    const unified = getGuestWatchHistory();
    if (unified.length > 0) {
      return unified.map(h => ({
        id: Number(h.anilistId || h.tmdbId || 0),
        mediaKey: h.mediaKey,
        seriesKey: h.seriesKey,
        tmdbId: h.tmdbId ? Number(h.tmdbId) : undefined,
        anilistId: h.anilistId,
        malId: h.malId,
        mediaType: h.mediaType,
        mediaFormat: h.mediaFormat,
        title: h.title,
        posterPath: h.posterPath || '',
        backdropPath: h.backdropPath,
        watchedAt: h.lastWatchedAt,
        updatedAt: h.updatedAt,
        seasonNumber: h.seasonNumber,
        episodeNumber: h.episodeNumber,
        episodeName: h.episodeName,
        progressSeconds: h.progressSeconds,
        durationSeconds: h.durationSeconds,
        percentage: h.percentage,
        completed: h.completed,
        completedAt: h.completedAt,
        genres: h.genres
      }));
    }
    const raw = readStorageRaw(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToHistory(item: {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string;
  backdropPath?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  tmdbId?: number;
  anilistId?: number;
  malId?: number;
  genres?: string[];
}): void {
  const now = new Date().toISOString();
  const seriesKey = buildSeriesKey({
    mediaType: item.mediaType,
    tmdbId: item.tmdbId ?? (item.mediaType !== 'anime' ? item.id : undefined),
    anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
    id: item.id
  });
  const mediaKey = buildMediaKey({
    mediaType: item.mediaType,
    tmdbId: item.tmdbId ?? (item.mediaType !== 'anime' ? item.id : undefined),
    anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
    id: item.id,
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber
  });
  const existing = getGuestWatchProgressItem(mediaKey);
  saveGuestWatchHistoryRecord({
    mediaKey,
    seriesKey,
    mediaType: item.mediaType,
    tmdbId: item.tmdbId ? String(item.tmdbId) : item.mediaType !== 'anime' ? String(item.id) : undefined,
    anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
    malId: item.malId,
    title: item.title,
    posterPath: item.posterPath,
    backdropPath: item.backdropPath,
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber,
    episodeName: item.episodeName || existing?.episodeName,
    progressSeconds: existing?.progressSeconds ?? 0,
    durationSeconds: existing?.durationSeconds ?? 0,
    percentage: existing?.percentage ?? 0,
    completed: Boolean(existing?.completed),
    completedAt: existing?.completedAt,
    lastWatchedAt: now,
    updatedAt: now,
    device: detectClientDeviceLabel(),
    genres: item.genres || existing?.genres
  });
}

export function clearHistory(): void {
  removeStorageRaw(HISTORY_KEY);
  removeStorageRaw(GUEST_UNIFIED_HISTORY_KEY);
  emitStorageEvent('history');
}

// Watched status
export function getWatchedIds(): number[] {
  try {
    const raw = readStorageRaw(WATCHED_KEY);
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
  writeStorageRaw(WATCHED_KEY, JSON.stringify(updated));
  emitStorageEvent('watched');
  return !exists;
}

// Settings
export function getUserSettings(): UserSettings {
  try {
    const raw = readStorageRaw(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateUserSettings(partial: Partial<UserSettings>): UserSettings {
  const current = getUserSettings();
  const updated = { ...current, ...partial };
  writeStorageRaw(SETTINGS_KEY, JSON.stringify(updated));
  emitStorageEvent('settings');
  return updated;
}
