import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Unsubscribe
} from 'firebase/firestore';
import {
  db,
  cleanFirestoreObject,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
  handleFirestoreError,
  OperationType,
  saveUserContinueWatching,
  removeUserContinueWatching,
  addToWatchlist
} from './firebase';
import {
  MediaType,
  WatchHistoryRecord,
  CompletedMediaRecord,
  ContinueWatchingItem
} from '../types/media';
import { buildMediaKey, buildSeriesKey, isCompletionReached } from '../utils/mediaKey';
import {
  getGuestWatchHistory,
  saveGuestWatchHistoryRecord,
  removeGuestWatchHistoryItem,
  clearHistory as clearGuestHistoryStorage,
  getGuestCompletedMedia,
  saveGuestCompletedRecord,
  removeGuestCompletedItem,
  clearGuestCompletedMedia as clearGuestCompletedStorage,
  getContinueWatching as getGuestContinueWatching,
  saveProgress as saveGuestProgressStorage,
  removeContinueWatching as removeGuestContinueWatchingStorage,
  getWatchlist as getGuestWatchlist
} from './storage';

const HISTORY_CLOUD_SYNC_INTERVAL_MS = 15_000;
const lastHistoryCloudSync = new Map<string, { syncedAt: number; percentage: number; episodeKey: string; completed: boolean }>();

export interface RecordPlaybackProgressInput {
  userId?: string | null;
  mediaType: MediaType;
  tmdbId?: string | number;
  anilistId?: number;
  malId?: number;
  id?: string | number;
  mediaFormat?: string;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  progressSeconds: number;
  durationSeconds: number;
  forceSync?: boolean;
  device?: string;
  serverId?: string;
  audioLang?: string;
  genres?: string[];
}

export function resolveSafeResumeSeconds(record: {
  progressSeconds?: number;
  durationSeconds?: number;
  percentage?: number;
  completed?: boolean;
} | null | undefined): number {
  if (!record) return 0;
  if (record.completed || (record.percentage ?? 0) >= 92) {
    return 0;
  }
  const prog = Number(record.progressSeconds || 0);
  if (!Number.isFinite(prog) || prog <= 10) return 0;
  return Math.floor(prog);
}

/**
 * Resolve conflict between two WatchHistoryRecords non-destructively using newest updatedAt.
 */
export function resolveHistoryConflict(
  existingRec: WatchHistoryRecord | undefined,
  incomingRec: WatchHistoryRecord
): WatchHistoryRecord {
  if (!existingRec) return incomingRec;
  const tExisting = new Date(existingRec.updatedAt || existingRec.lastWatchedAt || 0).getTime();
  const tIncoming = new Date(incomingRec.updatedAt || incomingRec.lastWatchedAt || 0).getTime();
  const winner = tIncoming >= tExisting ? incomingRec : existingRec;
  const loser = winner === incomingRec ? existingRec : incomingRec;
  return {
    ...loser,
    ...winner,
    completed: Boolean(existingRec.completed || incomingRec.completed),
    completedAt: existingRec.completedAt || incomingRec.completedAt,
    genres: (winner.genres && winner.genres.length > 0) ? winner.genres : loser.genres
  };
}

/**
 * Deduplicate WatchHistoryRecord array by mediaKey preserving newest record per key.
 */
export function deduplicateHistoryRecords(records: WatchHistoryRecord[]): WatchHistoryRecord[] {
  const byKey = new Map<string, WatchHistoryRecord>();
  for (const rec of records) {
    if (!rec.mediaKey) continue;
    const prev = byKey.get(rec.mediaKey);
    byKey.set(rec.mediaKey, resolveHistoryConflict(prev, rec));
  }
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.updatedAt || b.lastWatchedAt).getTime() - new Date(a.updatedAt || a.lastWatchedAt).getTime()
  );
}

/**
 * Unified progress persistence for BOTH guests (localStorage) and registered users (Firestore + local mirror).
 */
export async function recordWatchProgress(input: RecordPlaybackProgressInput): Promise<WatchHistoryRecord> {
  const now = new Date().toISOString();
  const safeProg = Math.max(0, Math.floor(input.progressSeconds || 0));
  const safeDur = Math.max(0, Math.floor(input.durationSeconds || 0));
  const percentage = safeDur > 0
    ? Math.min(100, Math.max(1, Math.round((safeProg / safeDur) * 100)))
    : 1;
  const completed = isCompletionReached(safeProg, safeDur);

  const primaryNumId = Number(
    input.mediaType === 'anime'
      ? (input.anilistId || input.id || 0)
      : (input.tmdbId || input.id || 0)
  );

  const tmdbStr = input.mediaType !== 'anime'
    ? String(input.tmdbId ?? input.id ?? '0')
    : input.tmdbId !== undefined
    ? String(input.tmdbId)
    : undefined;

  const seriesKey = buildSeriesKey({
    mediaType: input.mediaType,
    tmdbId: tmdbStr,
    anilistId: input.anilistId ?? (input.mediaType === 'anime' ? primaryNumId : undefined),
    id: primaryNumId
  });

  const mediaKey = buildMediaKey({
    mediaType: input.mediaType,
    tmdbId: tmdbStr,
    anilistId: input.anilistId ?? (input.mediaType === 'anime' ? primaryNumId : undefined),
    id: primaryNumId,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber
  });

  const record: WatchHistoryRecord = {
    userId: input.userId || undefined,
    mediaKey,
    seriesKey,
    mediaType: input.mediaType,
    tmdbId: tmdbStr ? tmdbStr.slice(0, 64) : undefined,
    anilistId: input.anilistId ?? (input.mediaType === 'anime' ? primaryNumId : undefined),
    malId: input.malId,
    mediaFormat: input.mediaFormat ? input.mediaFormat.slice(0, 64) : undefined,
    title: (input.title || 'Untitled').slice(0, 300),
    posterPath: (input.posterPath || '').slice(0, 1024),
    backdropPath: (input.backdropPath || '').slice(0, 1024),
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    episodeName: input.episodeName ? input.episodeName.slice(0, 300) : undefined,
    progressSeconds: safeProg,
    durationSeconds: safeDur,
    percentage,
    completed,
    completedAt: completed ? now : undefined,
    lastWatchedAt: now,
    updatedAt: now,
    device: (input.device || 'Web').slice(0, 64),
    serverId: input.serverId ? input.serverId.slice(0, 128) : undefined,
    audioLang: input.audioLang ? input.audioLang.slice(0, 32) : undefined,
    genres: Array.isArray(input.genres) ? input.genres.slice(0, 20) : undefined
  };

  // Always save immediately locally so offline/guest/reload never loses playback state
  saveGuestProgressStorage({
    id: primaryNumId,
    mediaType: input.mediaType,
    title: record.title,
    posterPath: record.posterPath || '',
    backdropPath: record.backdropPath || '',
    progressSeconds: safeProg,
    durationSeconds: safeDur,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    episodeName: input.episodeName,
    tmdbId: tmdbStr ? Number(tmdbStr) : undefined,
    anilistId: record.anilistId,
    malId: record.malId,
    mediaFormat: record.mediaFormat,
    genres: record.genres,
    serverId: record.serverId,
    audioLang: record.audioLang
  });

  if (!input.userId) {
    return record;
  }

  // User-scoped local cache mirror
  try {
    if (typeof localStorage !== 'undefined') {
      const cacheKey = `tstream_history_${input.userId}`;
      const raw = localStorage.getItem(cacheKey);
      const list: WatchHistoryRecord[] = raw ? JSON.parse(raw) : [];
      const merged = deduplicateHistoryRecords([{ ...record, userId: input.userId }, ...list]).slice(0, 150);
      localStorage.setItem(cacheKey, JSON.stringify(merged));
    }
  } catch {}

  if (isFirestoreQuotaExceeded()) {
    return record;
  }

  // Throttle high-frequency writes during playback, but allow immediate write on pause/switch/end/completion
  const syncCacheKey = `${input.userId}_${mediaKey}`;
  const epKey = `${input.seasonNumber ?? ''}:${input.episodeNumber ?? ''}`;
  const prevSync = lastHistoryCloudSync.get(syncCacheKey);
  const nowMs = Date.now();

  if (
    !input.forceSync &&
    prevSync &&
    prevSync.episodeKey === epKey &&
    prevSync.completed === completed &&
    nowMs - prevSync.syncedAt < HISTORY_CLOUD_SYNC_INTERVAL_MS &&
    Math.abs(percentage - prevSync.percentage) < 5
  ) {
    return record;
  }

  lastHistoryCloudSync.set(syncCacheKey, {
    syncedAt: nowMs,
    percentage,
    episodeKey: epKey,
    completed
  });

  try {
    const cleanRec = cleanFirestoreObject({ ...record, userId: input.userId });
    await setDoc(doc(db, 'users', input.userId, 'history', mediaKey), cleanRec, { merge: true });

    if (completed) {
      const compRec: CompletedMediaRecord = {
        userId: input.userId,
        mediaKey,
        mediaType: input.mediaType,
        tmdbId: tmdbStr,
        anilistId: record.anilistId,
        malId: record.malId,
        title: record.title,
        posterPath: record.posterPath,
        seasonNumber: record.seasonNumber,
        episodeNumber: record.episodeNumber,
        completedAt: now,
        updatedAt: now
      };
      await setDoc(
        doc(db, 'users', input.userId, 'completed', mediaKey),
        cleanFirestoreObject(compRec),
        { merge: true }
      );
      if (percentage >= 95) {
        await removeUserContinueWatching(
          input.userId,
          input.mediaType,
          input.mediaType === 'anime' ? String(record.anilistId || primaryNumId) : String(tmdbStr || primaryNumId)
        );
      }
    } else {
      await saveUserContinueWatching({
        userId: input.userId,
        tmdbId: String(input.mediaType === 'anime' ? (record.anilistId || primaryNumId) : (tmdbStr || primaryNumId)),
        mediaType: input.mediaType,
        anilistId: record.anilistId,
        malId: record.malId,
        mediaKey: seriesKey,
        title: record.title,
        posterPath: record.posterPath,
        backdropPath: record.backdropPath,
        progressSeconds: safeProg,
        durationSeconds: safeDur,
        percentage,
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
        episodeName: input.episodeName
      });
    }
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      return record;
    }
    console.warn('Cloud watch history sync fell back to local storage:', err);
  }

  return record;
}

/**
 * Subscribe to authenticated user's unified Watch History collection in Firestore
 */
export function subscribeToUserWatchHistory(
  userId: string,
  onUpdate: (items: WatchHistoryRecord[]) => void
): Unsubscribe {
  const localKey = `tstream_history_${userId}`;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(localKey);
      if (raw) onUpdate(JSON.parse(raw));
    }
  } catch {}

  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }

  return onSnapshot(
    query(collection(db, 'users', userId, 'history'), where('userId', '==', userId)),
    (snap) => {
      const cloud: WatchHistoryRecord[] = [];
      snap.forEach((d) => cloud.push(d.data() as WatchHistoryRecord));
      const deduped = deduplicateHistoryRecords(cloud);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(localKey, JSON.stringify(deduped));
        }
      } catch {}
      onUpdate(deduped);
    },
    (err) => {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
        return;
      }
      handleFirestoreError(err, OperationType.GET, `users/${userId}/history`);
    }
  );
}

/**
 * Subscribe to authenticated user's Completed collection in Firestore
 */
export function subscribeToUserCompleted(
  userId: string,
  onUpdate: (items: CompletedMediaRecord[]) => void
): Unsubscribe {
  const localKey = `tstream_completed_${userId}`;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(localKey);
      if (raw) onUpdate(JSON.parse(raw));
    }
  } catch {}

  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }

  return onSnapshot(
    query(collection(db, 'users', userId, 'completed'), where('userId', '==', userId)),
    (snap) => {
      const list: CompletedMediaRecord[] = [];
      snap.forEach((d) => list.push(d.data() as CompletedMediaRecord));
      list.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(localKey, JSON.stringify(list));
        }
      } catch {}
      onUpdate(list);
    },
    (err) => {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
        return;
      }
      handleFirestoreError(err, OperationType.GET, `users/${userId}/completed`);
    }
  );
}

export async function removeUserHistoryItem(userId: string | null | undefined, mediaKey: string): Promise<void> {
  removeGuestWatchHistoryItem(mediaKey);
  if (!userId) return;

  try {
    if (typeof localStorage !== 'undefined') {
      const localKey = `tstream_history_${userId}`;
      const raw = localStorage.getItem(localKey);
      if (raw) {
        const list = (JSON.parse(raw) as WatchHistoryRecord[]).filter(r => r.mediaKey !== mediaKey);
        localStorage.setItem(localKey, JSON.stringify(list));
      }
    }
  } catch {}

  if (isFirestoreQuotaExceeded()) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'history', mediaKey));
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/history/${mediaKey}`);
  }
}

export async function clearUserWatchHistory(userId: string | null | undefined): Promise<void> {
  clearGuestHistoryStorage();
  if (!userId) return;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`tstream_history_${userId}`);
    }
  } catch {}

  if (isFirestoreQuotaExceeded()) return;
  try {
    const snap = await getDocs(query(collection(db, 'users', userId, 'history'), where('userId', '==', userId)));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/history`);
  }
}

export async function removeUserCompletedItem(userId: string | null | undefined, mediaKey: string): Promise<void> {
  removeGuestCompletedItem(mediaKey);
  if (!userId || isFirestoreQuotaExceeded()) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'completed', mediaKey));
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/completed/${mediaKey}`);
  }
}

export async function clearUserCompleted(userId: string | null | undefined): Promise<void> {
  clearGuestCompletedStorage();
  if (!userId || isFirestoreQuotaExceeded()) return;
  try {
    const snap = await getDocs(query(collection(db, 'users', userId, 'completed'), where('userId', '==', userId)));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}/completed`);
  }
}

/**
 * Pure conflict-resolution planner for merging guest arrays with cloud arrays.
 * Extracted cleanly so automated tests can verify timestamp precedence & deduplication directly.
 */
export function buildGuestToCloudMergePlan(params: {
  userId: string;
  guestHistory: WatchHistoryRecord[];
  cloudHistory: WatchHistoryRecord[];
  guestContinueWatching: ContinueWatchingItem[];
  guestCompleted: CompletedMediaRecord[];
  cloudCompleted: CompletedMediaRecord[];
}): {
  historyWrites: WatchHistoryRecord[];
  completedWrites: CompletedMediaRecord[];
  continueWrites: ContinueWatchingItem[];
} {
  const cloudHistMap = new Map(params.cloudHistory.map(h => [h.mediaKey, h]));
  const historyWrites: WatchHistoryRecord[] = [];

  for (const guestItem of params.guestHistory) {
    if (!guestItem.mediaKey) continue;
    const cloudExisting = cloudHistMap.get(guestItem.mediaKey);
    const resolved = resolveHistoryConflict(cloudExisting, {
      ...guestItem,
      userId: params.userId
    });
    if (
      !cloudExisting ||
      new Date(resolved.updatedAt).getTime() > new Date(cloudExisting.updatedAt || 0).getTime() ||
      (resolved.completed && !cloudExisting.completed)
    ) {
      historyWrites.push({ ...resolved, userId: params.userId });
    }
  }

  const cloudCompMap = new Map(params.cloudCompleted.map(c => [c.mediaKey, c]));
  const completedWrites: CompletedMediaRecord[] = [];
  for (const comp of params.guestCompleted) {
    if (!comp.mediaKey) continue;
    if (!cloudCompMap.has(comp.mediaKey)) {
      completedWrites.push({ ...comp, userId: params.userId });
    }
  }

  const continueWrites: ContinueWatchingItem[] = params.guestContinueWatching.filter(
    cw => !cw.completed && (cw.percentage ?? 0) < 95
  );

  return { historyWrites, completedWrites, continueWrites };
}

/**
 * Non-destructive automatic merge of Guest Watch History, Continue Watching, Completed, and Watchlist
 * into an authenticated user's Firestore collections on sign-in.
 */
export async function mergeGuestDataToAccount(userId: string): Promise<{
  mergedHistory: number;
  mergedCompleted: number;
  mergedWatchlist: number;
  mergedContinue: number;
}> {
  if (!userId || isFirestoreQuotaExceeded()) {
    return { mergedHistory: 0, mergedCompleted: 0, mergedWatchlist: 0, mergedContinue: 0 };
  }

  const guestHistory = getGuestWatchHistory();
  const guestCw = getGuestContinueWatching();
  const guestComp = getGuestCompletedMedia();
  const guestWl = getGuestWatchlist();

  if (guestHistory.length === 0 && guestCw.length === 0 && guestComp.length === 0 && guestWl.length === 0) {
    return { mergedHistory: 0, mergedCompleted: 0, mergedWatchlist: 0, mergedContinue: 0 };
  }

  try {
    const [cloudHistSnap, cloudCompSnap, cloudWlSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', userId, 'history'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'users', userId, 'completed'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'users', userId, 'watchlist'), where('userId', '==', userId)))
    ]);

    const cloudHistory = cloudHistSnap.docs.map(d => d.data() as WatchHistoryRecord);
    const cloudCompleted = cloudCompSnap.docs.map(d => d.data() as CompletedMediaRecord);
    const cloudWlKeys = new Set(cloudWlSnap.docs.map(d => d.id));

    const plan = buildGuestToCloudMergePlan({
      userId,
      guestHistory,
      cloudHistory,
      guestContinueWatching: guestCw,
      guestCompleted: guestComp,
      cloudCompleted
    });

    for (const h of plan.historyWrites) {
      const cleanMediaKey = (h.mediaKey.replace(/[^a-zA-Z0-9_-]/g, '_') || 'item').slice(0, 128);
      const sanitizedHistory = cleanFirestoreObject({
        ...h,
        userId,
        mediaKey: cleanMediaKey,
        seriesKey: h.seriesKey ? h.seriesKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) : undefined,
        tmdbId: h.tmdbId !== undefined ? String(h.tmdbId).slice(0, 64) : undefined,
        mediaFormat: h.mediaFormat ? String(h.mediaFormat).slice(0, 64) : undefined,
        title: (h.title || 'Untitled').slice(0, 300),
        posterPath: (h.posterPath || '').slice(0, 1024),
        backdropPath: (h.backdropPath || '').slice(0, 1024),
        seasonNumber: typeof h.seasonNumber === 'number' && !isNaN(h.seasonNumber)
          ? Math.max(0, Math.min(500, Math.floor(h.seasonNumber)))
          : undefined,
        episodeNumber: typeof h.episodeNumber === 'number' && !isNaN(h.episodeNumber)
          ? Math.max(1, Math.min(10000, Math.floor(h.episodeNumber)))
          : undefined,
        episodeName: h.episodeName ? String(h.episodeName).slice(0, 300) : undefined,
        progressSeconds: Math.max(0, Number(h.progressSeconds) || 0),
        durationSeconds: Math.max(0, Number(h.durationSeconds) || 0),
        percentage: Math.max(0, Math.min(100, Number(h.percentage) || 0)),
        updatedAt: (h.updatedAt || new Date().toISOString()).slice(0, 64),
        device: h.device ? String(h.device).slice(0, 64) : undefined,
        serverId: h.serverId ? String(h.serverId).slice(0, 128) : undefined,
        audioLang: h.audioLang ? String(h.audioLang).slice(0, 32) : undefined,
        genres: Array.isArray(h.genres) ? h.genres.slice(0, 20) : undefined
      });
      await setDoc(doc(db, 'users', userId, 'history', cleanMediaKey), sanitizedHistory, { merge: true });
    }

    for (const c of plan.completedWrites) {
      const cleanMediaKey = (c.mediaKey.replace(/[^a-zA-Z0-9_-]/g, '_') || 'item').slice(0, 128);
      const sanitizedCompleted = cleanFirestoreObject({
        ...c,
        userId,
        mediaKey: cleanMediaKey,
        tmdbId: c.tmdbId !== undefined ? String(c.tmdbId).slice(0, 64) : undefined,
        title: (c.title || 'Untitled').slice(0, 300),
        posterPath: c.posterPath ? String(c.posterPath).slice(0, 1024) : undefined,
        seasonNumber: typeof c.seasonNumber === 'number' && !isNaN(c.seasonNumber)
          ? Math.max(0, Math.min(500, Math.floor(c.seasonNumber)))
          : undefined,
        episodeNumber: typeof c.episodeNumber === 'number' && !isNaN(c.episodeNumber)
          ? Math.max(1, Math.min(10000, Math.floor(c.episodeNumber)))
          : undefined,
        completedAt: (c.completedAt || new Date().toISOString()).slice(0, 64),
        updatedAt: (c.updatedAt || new Date().toISOString()).slice(0, 64)
      });
      await setDoc(doc(db, 'users', userId, 'completed', cleanMediaKey), sanitizedCompleted, { merge: true });
    }

    let mergedContinue = 0;
    for (const cw of plan.continueWrites) {
      const targetId = String(cw.mediaType === 'anime' ? (cw.anilistId || cw.id) : (cw.tmdbId || cw.id));
      await saveUserContinueWatching({
        userId,
        tmdbId: targetId,
        mediaType: cw.mediaType,
        anilistId: cw.anilistId,
        malId: cw.malId,
        mediaKey: cw.seriesKey || `${cw.mediaType}_${targetId}`,
        title: cw.title,
        posterPath: cw.posterPath,
        backdropPath: cw.backdropPath,
        progressSeconds: cw.progressSeconds,
        durationSeconds: cw.durationSeconds,
        percentage: cw.percentage,
        seasonNumber: cw.seasonNumber,
        episodeNumber: cw.episodeNumber,
        episodeName: cw.episodeName
      });
      mergedContinue++;
    }

    let mergedWatchlist = 0;
    for (const wl of guestWl) {
      const docId = String(wl.mediaKey || (wl.mediaType === 'anime' ? `anime_${wl.anilistId || wl.id}` : wl.id));
      if (!cloudWlKeys.has(docId) && !cloudWlKeys.has(String(wl.id))) {
        await addToWatchlist({
          userId,
          tmdbId: String(wl.tmdbId || wl.id),
          mediaType: wl.mediaType,
          mediaKey: docId,
          anilistId: wl.anilistId,
          malId: wl.malId,
          title: wl.title,
          posterPath: wl.posterPath,
          backdropPath: wl.backdropPath,
          voteAverage: wl.voteAverage,
          releaseDate: wl.releaseDate
        });
        mergedWatchlist++;
      }
    }

    return {
      mergedHistory: plan.historyWrites.length,
      mergedCompleted: plan.completedWrites.length,
      mergedWatchlist,
      mergedContinue
    };
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    } else {
      console.warn('Guest-to-account merge paused (local data preserved safely):', err);
    }
    return { mergedHistory: 0, mergedCompleted: 0, mergedWatchlist: 0, mergedContinue: 0 };
  }
}
