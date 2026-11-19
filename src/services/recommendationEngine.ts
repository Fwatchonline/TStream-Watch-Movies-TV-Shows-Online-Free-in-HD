import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  db,
  cleanFirestoreObject,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
  isQuotaExceededError,
  WatchlistItem
} from './firebase';
import {
  MediaItem,
  MediaType,
  WatchHistoryRecord,
  CompletedMediaRecord
} from '../types/media';
import { buildSeriesKey } from '../utils/mediaKey';

const LOCAL_REC_PROFILE_KEY = 'tstream_recommendation_profile_v1';

export interface RecommendationProfile {
  genreWeights: Record<string, number>;
  actorWeights: Record<string, number>;
  directorWeights: Record<string, number>;
  platformWeights: Record<string, number>;
  mediaTypeWeights: Record<MediaType, number>;
  updatedAt: string;
}

export interface ScoredRecommendation {
  item: MediaItem;
  score: number;
  reasons: string[];
  breakdown: {
    genreSimilarity: number;
    watchHistorySimilarity: number;
    preferredPeople: number;
    userWatchlistSignals: number;
    platformPreference: number;
    ratingQuality: number;
    freshness: number;
    diversityPenalty: number;
  };
}

const DEFAULT_PROFILE = (): RecommendationProfile => ({
  genreWeights: {},
  actorWeights: {},
  directorWeights: {},
  platformWeights: {},
  mediaTypeWeights: { movie: 1, tv: 1, anime: 1 },
  updatedAt: new Date().toISOString()
});

const memoryProfileFallback = new Map<string, string>();

function readRecRaw(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    return memoryProfileFallback.get(key) ?? null;
  } catch {
    return memoryProfileFallback.get(key) ?? null;
  }
}

function writeRecRaw(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
    else memoryProfileFallback.set(key, val);
  } catch {
    memoryProfileFallback.set(key, val);
  }
}

function removeRecRaw(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    else memoryProfileFallback.delete(key);
  } catch {
    memoryProfileFallback.delete(key);
  }
}

export function getRecommendationProfile(userId?: string | null): RecommendationProfile {
  const key = userId ? `${LOCAL_REC_PROFILE_KEY}_${userId}` : LOCAL_REC_PROFILE_KEY;
  try {
    const raw = readRecRaw(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RecommendationProfile>;
      return {
        ...DEFAULT_PROFILE(),
        ...parsed,
        mediaTypeWeights: {
          movie: 1,
          tv: 1,
          anime: 1,
          ...(parsed.mediaTypeWeights || {})
        }
      };
    }
  } catch {}
  return DEFAULT_PROFILE();
}

export async function syncRecommendationProfileFromFirestore(userId: string): Promise<RecommendationProfile> {
  const local = getRecommendationProfile(userId);
  if (!userId || isFirestoreQuotaExceeded()) return local;

  try {
    const ref = doc(db, 'users', userId, 'preferences', 'recommendations');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const raw = snap.data() as any;
      const data = (raw?.data && typeof raw.data === 'object' ? raw.data : raw) as RecommendationProfile;
      const merged: RecommendationProfile = {
        ...DEFAULT_PROFILE(),
        ...data,
        genreWeights: { ...local.genreWeights, ...(data.genreWeights || {}) },
        actorWeights: { ...local.actorWeights, ...(data.actorWeights || {}) },
        directorWeights: { ...local.directorWeights, ...(data.directorWeights || {}) },
        platformWeights: { ...local.platformWeights, ...(data.platformWeights || {}) },
        mediaTypeWeights: {
          ...local.mediaTypeWeights,
          ...(data.mediaTypeWeights || {})
        }
      };
      writeRecRaw(`${LOCAL_REC_PROFILE_KEY}_${userId}`, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    if (isQuotaExceededError(err)) markFirestoreQuotaExceeded();
  }
  return local;
}

export async function recordRecommendationSignal(input: {
  userId?: string | null;
  mediaType: MediaType;
  genres?: string[];
  actors?: string[];
  directors?: string[];
  platformId?: string;
  weightDelta?: number;
}): Promise<RecommendationProfile> {
  const profile = getRecommendationProfile(input.userId);
  const delta = input.weightDelta ?? 1;

  for (const g of input.genres || []) {
    const norm = g.trim().toLowerCase();
    if (!norm) continue;
    profile.genreWeights[norm] = Number(((profile.genreWeights[norm] || 0) + delta).toFixed(2));
  }
  for (const a of input.actors || []) {
    const norm = a.trim().toLowerCase();
    if (!norm) continue;
    profile.actorWeights[norm] = Number(((profile.actorWeights[norm] || 0) + delta).toFixed(2));
  }
  for (const d of input.directors || []) {
    const norm = d.trim().toLowerCase();
    if (!norm) continue;
    profile.directorWeights[norm] = Number(((profile.directorWeights[norm] || 0) + delta * 1.25).toFixed(2));
  }
  if (input.platformId) {
    const p = input.platformId.trim().toLowerCase();
    profile.platformWeights[p] = Number(((profile.platformWeights[p] || 0) + delta).toFixed(2));
  }
  profile.mediaTypeWeights[input.mediaType] = Number(
    ((profile.mediaTypeWeights[input.mediaType] || 1) + delta * 0.5).toFixed(2)
  );
  profile.updatedAt = new Date().toISOString();

  const key = input.userId ? `${LOCAL_REC_PROFILE_KEY}_${input.userId}` : LOCAL_REC_PROFILE_KEY;
  writeRecRaw(key, JSON.stringify(profile));

  if (input.userId && !isFirestoreQuotaExceeded()) {
    try {
      const ref = doc(db, 'users', input.userId, 'preferences', 'recommendations');
      await setDoc(
        ref,
        {
          userId: input.userId,
          prefId: 'recommendations',
          data: cleanFirestoreObject(profile),
          updatedAt: profile.updatedAt
        },
        { merge: true }
      );
    } catch (err) {
      if (isQuotaExceededError(err)) markFirestoreQuotaExceeded();
    }
  }

  return profile;
}

export async function resetRecommendationProfile(userId?: string | null): Promise<void> {
  removeRecRaw(LOCAL_REC_PROFILE_KEY);
  if (userId) {
    removeRecRaw(`${LOCAL_REC_PROFILE_KEY}_${userId}`);
    if (!isFirestoreQuotaExceeded()) {
      try {
        await deleteDoc(doc(db, 'users', userId, 'preferences', 'recommendations'));
      } catch (err) {
        if (isQuotaExceededError(err)) markFirestoreQuotaExceeded();
      }
    }
  }
}

function getRecencyMultiplier(isoDate?: string): number {
  if (!isoDate) return 0.5;
  const ts = new Date(isoDate).getTime();
  if (isNaN(ts)) return 0.5;
  const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
  // Half-life decay around 21 days so recent viewing steers recommendations dynamically
  return Math.max(0.25, Math.exp(-ageDays / 21));
}

function extractItemGenreNames(item: MediaItem): string[] {
  const names: string[] = [];
  if (Array.isArray(item.genres)) {
    for (const g of item.genres as Array<{ name?: string } | string>) {
      if (typeof g === 'string') names.push(g.trim().toLowerCase());
      else if (g && typeof g.name === 'string') names.push(g.name.trim().toLowerCase());
    }
  }
  if (Array.isArray(item.animeTags)) {
    for (const tag of item.animeTags) {
      if (typeof tag === 'string') names.push(tag.trim().toLowerCase());
    }
  }
  return Array.from(new Set(names.filter(Boolean)));
}

/**
 * Multi-signal personalized recommendation scorer across Movies, TV Series, and Anime.
 */
export function rankPersonalizedRecommendations(params: {
  candidates: MediaItem[];
  history: WatchHistoryRecord[];
  completedMedia?: CompletedMediaRecord[];
  watchlist?: WatchlistItem[];
  profile?: RecommendationProfile | null;
  preferredPlatforms?: string[];
  limit?: number;
}): ScoredRecommendation[] {
  const {
    candidates,
    history,
    completedMedia = [],
    watchlist = [],
    profile,
    preferredPlatforms = [],
    limit = 20
  } = params;

  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  // Build exclusion set for already-completed series/films (do not recommend completed movies or in-progress top series duplicates)
  const completedSeriesKeys = new Set<string>();
  for (const c of completedMedia) {
    // Only exclude entire movies once completed, or if an anime/tv movie was completed
    if (c.mediaType === 'movie') {
      completedSeriesKeys.add(`movie_${c.tmdbId || c.mediaKey}`);
    }
    completedSeriesKeys.add(c.mediaKey);
  }
  for (const h of history) {
    if (h.completed && h.mediaType === 'movie') {
      completedSeriesKeys.add(h.seriesKey);
    }
  }

  // Derive live genre, type, and title affinity directly from Watch History (weighted by recency + completion)
  const liveGenreScores = new Map<string, number>();
  const liveTypeScores = new Map<MediaType, number>();
  const watchedSeriesKeys = new Set<string>();

  for (const [k, w] of Object.entries(profile?.genreWeights || {})) {
    liveGenreScores.set(k.toLowerCase(), (liveGenreScores.get(k.toLowerCase()) || 0) + w);
  }
  for (const [t, w] of Object.entries(profile?.mediaTypeWeights || {})) {
    liveTypeScores.set(t as MediaType, (liveTypeScores.get(t as MediaType) || 0) + w);
  }

  for (const h of history) {
    watchedSeriesKeys.add(h.seriesKey);
    const decay = getRecencyMultiplier(h.updatedAt || h.lastWatchedAt);
    const engagement = h.completed ? 1.5 : Math.max(0.4, (h.percentage || 20) / 100);
    const weight = decay * engagement * 3;
    liveTypeScores.set(h.mediaType, (liveTypeScores.get(h.mediaType) || 0) + weight);
    for (const g of h.genres || []) {
      const norm = g.trim().toLowerCase();
      if (norm) liveGenreScores.set(norm, (liveGenreScores.get(norm) || 0) + weight);
    }
  }

  // Signals from Watchlist (bookmarking shows clear explicit interest)
  const watchlistSeriesKeys = new Set<string>();
  const watchlistTypes = new Map<MediaType, number>();
  for (const w of watchlist) {
    const sKey = w.mediaKey || buildSeriesKey({
      mediaType: w.mediaType,
      tmdbId: w.tmdbId,
      anilistId: w.anilistId
    });
    watchlistSeriesKeys.add(sKey);
    watchlistTypes.set(w.mediaType, (watchlistTypes.get(w.mediaType) || 0) + 1.5);
  }

  const dedupSeen = new Set<string>();
  const rawScored: ScoredRecommendation[] = [];

  for (const item of candidates) {
    const sKey = buildSeriesKey({
      mediaType: item.mediaType,
      tmdbId: item.mediaType !== 'anime' ? (item.tmdbId || item.id) : undefined,
      anilistId: item.mediaType === 'anime' ? (item.anilistId || item.id) : undefined,
      id: item.id
    });

    if (dedupSeen.has(sKey)) continue;
    dedupSeen.add(sKey);

    // Exclude already-completed movies or exact items already finished
    if (completedSeriesKeys.has(sKey) || watchedSeriesKeys.has(sKey)) {
      continue;
    }

    const itemGenres = extractItemGenreNames(item);
    const reasons: string[] = [];

    // 1. Genre similarity
    let genreSimilarity = 0;
    const matchedGenres: string[] = [];
    for (const g of itemGenres) {
      const w = liveGenreScores.get(g) || 0;
      if (w > 0) {
        genreSimilarity += Math.min(12, w * 2.2);
        matchedGenres.push(g);
      }
    }
    if (matchedGenres.length > 0) {
      reasons.push(`Matches ${matchedGenres.slice(0, 2).join(' & ')}`);
    }

    // 2. Watch history format / mediaType affinity
    const typeAffinity = liveTypeScores.get(item.mediaType) || 0;
    const watchHistorySimilarity = Math.min(15, typeAffinity * 1.4);
    if (typeAffinity >= 2.5) {
      reasons.push(
        item.mediaType === 'anime'
          ? 'Because you watch anime'
          : item.mediaType === 'tv'
          ? 'Based on your series history'
          : 'Based on your movie history'
      );
    }

    // 3. Preferred actors / directors signals
    let preferredPeople = 0;
    const withCredits = item as MediaItem & {
      credits?: { cast?: Array<{ name: string }>; crew?: Array<{ name: string; job?: string }> };
    };
    const cast = withCredits.credits?.cast || [];
    const crew = withCredits.credits?.crew || [];
    for (const c of cast) {
      const w = profile?.actorWeights?.[c.name.toLowerCase()] || 0;
      if (w > 0) preferredPeople += Math.min(8, w * 2);
    }
    for (const m of crew) {
      if (m.job?.toLowerCase() === 'director') {
        const w = profile?.directorWeights?.[m.name.toLowerCase()] || 0;
        if (w > 0) preferredPeople += Math.min(10, w * 2.5);
      }
    }
    if (preferredPeople > 0) reasons.push('Features favorite cast or director');

    // 4. Watchlist signal alignment
    let userWatchlistSignals = 0;
    const wlTypeBoost = watchlistTypes.get(item.mediaType) || 0;
    if (wlTypeBoost > 0) {
      userWatchlistSignals += Math.min(8, wlTypeBoost * 1.5);
    }
    if (watchlistSeriesKeys.has(sKey)) {
      userWatchlistSignals += 6;
      reasons.push('In your watchlist');
    }

    // 5. Platform preference
    let platformPreference = 0;
    if (item.platformIds && item.platformIds.length > 0) {
      for (const p of item.platformIds) {
        const lowerP = p.toLowerCase();
        const prefWeight = profile?.platformWeights?.[lowerP] || (preferredPlatforms.includes(lowerP) ? 2 : 0);
        if (prefWeight > 0) {
          platformPreference += Math.min(6, prefWeight * 1.5);
        }
      }
    }

    // 6. Rating quality (0 - 12 pts)
    const voteAvg = Number(item.voteAverage || 0);
    const voteCount = Number(item.voteCount || 0);
    const confidence = voteCount > 0 ? Math.min(1, voteCount / 500) : 0.75;
    const ratingQuality = Number(((voteAvg / 10) * 12 * confidence).toFixed(2));

    // 7. Freshness (0 - 8 pts for recent releases within last 2 years)
    let freshness = 0;
    if (item.releaseDate) {
      const year = new Date(item.releaseDate).getFullYear();
      const currentYear = new Date().getFullYear();
      if (!isNaN(year)) {
        const ageYears = Math.max(0, currentYear - year);
        if (ageYears <= 1) freshness = 8;
        else if (ageYears <= 3) freshness = 5;
        else if (ageYears <= 6) freshness = 2.5;
      }
    }

    const total =
      genreSimilarity +
      watchHistorySimilarity +
      preferredPeople +
      userWatchlistSignals +
      platformPreference +
      ratingQuality +
      freshness;

    rawScored.push({
      item,
      score: Number(total.toFixed(2)),
      reasons: reasons.length > 0 ? reasons : ['Critically acclaimed pick'],
      breakdown: {
        genreSimilarity: Number(genreSimilarity.toFixed(2)),
        watchHistorySimilarity: Number(watchHistorySimilarity.toFixed(2)),
        preferredPeople: Number(preferredPeople.toFixed(2)),
        userWatchlistSignals: Number(userWatchlistSignals.toFixed(2)),
        platformPreference: Number(platformPreference.toFixed(2)),
        ratingQuality,
        freshness,
        diversityPenalty: 0
      }
    });
  }

  // Greedy re-ranking pass applying diversity penalty so no single genre dominates all top slots
  rawScored.sort((a, b) => b.score - a.score);
  const selected: ScoredRecommendation[] = [];
  const genreCounts = new Map<string, number>();
  const pool = [...rawScored];

  while (selected.length < limit && pool.length > 0) {
    let bestIdx = 0;
    let bestEffective = -Infinity;

    for (let i = 0; i < Math.min(pool.length, 40); i++) {
      const cand = pool[i];
      const primaryGenre = extractItemGenreNames(cand.item)[0] || cand.item.mediaType;
      const seenCount = genreCounts.get(primaryGenre) || 0;
      const penalty = seenCount * 4.5;
      const effective = cand.score - penalty;
      if (effective > bestEffective) {
        bestEffective = effective;
        bestIdx = i;
      }
    }

    const chosen = pool.splice(bestIdx, 1)[0];
    const primaryGenre = extractItemGenreNames(chosen.item)[0] || chosen.item.mediaType;
    const seenCount = genreCounts.get(primaryGenre) || 0;
    const penaltyApplied = Number((seenCount * 4.5).toFixed(2));
    genreCounts.set(primaryGenre, seenCount + 1);

    chosen.breakdown.diversityPenalty = penaltyApplied;
    chosen.score = Number((chosen.score - penaltyApplied).toFixed(2));
    selected.push(chosen);
  }

  return selected;
}
