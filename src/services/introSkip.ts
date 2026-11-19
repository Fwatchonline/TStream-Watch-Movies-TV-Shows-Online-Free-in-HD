import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc } from 'firebase/firestore';
import { db, isFirestoreQuotaExceeded, isQuotaExceededError, markFirestoreQuotaExceeded } from './firebase';

export interface EpisodeSkipTimings {
  provider: 'tmdb' | 'anilist' | 'mal';
  providerId: string;
  season: number;
  episode: number;
  introStart?: number;
  introEnd?: number;
  recapStart?: number;
  recapEnd?: number;
  creditsStart?: number;
  creditsEnd?: number;
  source: 'aniskip' | 'admin';
  updatedAt?: string;
}

export interface ActiveSkipSegment {
  kind: 'intro' | 'recap' | 'credits';
  label: string;
  start: number;
  end: number;
}

const MAX_TIMING_CACHE_ENTRIES = 200;
const TIMING_CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedTimingEntry {
  expiresAt: number;
  timings: EpisodeSkipTimings | null;
}

const skipTimingCache = new Map<string, CachedTimingEntry>();

export function buildIntroTimingDocId(
  provider: 'tmdb' | 'anilist' | 'mal',
  providerId: string | number,
  season: number,
  episode: number
): string {
  const s = Math.max(0, Math.floor(season || 1));
  const e = Math.max(1, Math.floor(episode || 1));
  return `${provider}_${String(providerId).trim()}_s${s}_e${e}`;
}

function setSkipCache(key: string, timings: EpisodeSkipTimings | null): void {
  if (skipTimingCache.size >= MAX_TIMING_CACHE_ENTRIES) {
    const oldest = skipTimingCache.keys().next().value;
    if (oldest) skipTimingCache.delete(oldest);
  }
  skipTimingCache.set(key, {
    expiresAt: Date.now() + TIMING_CACHE_TTL_MS,
    timings
  });
}

export function clearIntroSkipCacheForTests(): void {
  skipTimingCache.clear();
}

function isValidInterval(start?: number, end?: number): boolean {
  return (
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end > start + 2
  );
}

/**
 * Queries real intro/recap/credits timestamps from:
 * 1) Admin-managed Firestore `introTimings` collection (when present & quota OK)
 * 2) Live AniSkip v2 API via `/api/aniskip/skip-times/:malId/:episode` (when MAL ID exists)
 * Never invents or guesses timestamps — returns `null` when unavailable.
 */
export async function fetchEpisodeSkipTimings(params: {
  mediaType: 'movie' | 'tv' | 'anime';
  providerId: string | number;
  season?: number;
  episode?: number;
  malId?: number;
  tmdbId?: number;
  anilistId?: number;
  episodeLengthSeconds?: number;
  fetchImpl?: typeof fetch;
  skipFirestore?: boolean;
}): Promise<EpisodeSkipTimings | null> {
  if (params.mediaType === 'movie') return null;

  const season = params.mediaType === 'anime' ? 1 : Math.max(0, params.season ?? 1);
  const episode = Math.max(1, params.episode ?? 1);
  const provider: 'tmdb' | 'anilist' | 'mal' =
    params.mediaType === 'anime' ? (params.anilistId ? 'anilist' : params.malId ? 'mal' : 'tmdb') : 'tmdb';
  const primaryId =
    params.mediaType === 'anime'
      ? String(params.anilistId || params.malId || params.providerId)
      : String(params.tmdbId || params.providerId);

  const cacheKey = `${provider}:${primaryId}:s${season}:e${episode}:mal${params.malId || ''}`;
  const cached = skipTimingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.timings;
  }

  // 1. Check Firestore `introTimings` override first
  if (!params.skipFirestore && !isFirestoreQuotaExceeded()) {
    try {
      const candidateIds = [buildIntroTimingDocId(provider, primaryId, season, episode)];
      if (params.mediaType === 'anime' && params.malId && provider !== 'mal') {
        candidateIds.push(buildIntroTimingDocId('mal', params.malId, 1, episode));
      }
      if (params.tmdbId && provider !== 'tmdb') {
        candidateIds.push(buildIntroTimingDocId('tmdb', params.tmdbId, season, episode));
      }

      for (const docId of candidateIds) {
        const snap = await getDoc(doc(db, 'introTimings', docId));
        if (snap.exists()) {
          const data = snap.data() as any;
          const record: EpisodeSkipTimings = {
            provider: data.provider || provider,
            providerId: String(data.providerId || primaryId),
            season: Number(data.season ?? season),
            episode: Number(data.episode ?? episode),
            introStart: isValidInterval(data.introStart, data.introEnd) ? Number(data.introStart) : undefined,
            introEnd: isValidInterval(data.introStart, data.introEnd) ? Number(data.introEnd) : undefined,
            recapStart: isValidInterval(data.recapStart, data.recapEnd) ? Number(data.recapStart) : undefined,
            recapEnd: isValidInterval(data.recapStart, data.recapEnd) ? Number(data.recapEnd) : undefined,
            creditsStart: isValidInterval(data.creditsStart, data.creditsEnd) ? Number(data.creditsStart) : undefined,
            creditsEnd: isValidInterval(data.creditsStart, data.creditsEnd) ? Number(data.creditsEnd) : undefined,
            source: 'admin',
            updatedAt: data.updatedAt
          };

          if (record.introStart !== undefined || record.recapStart !== undefined || record.creditsStart !== undefined) {
            setSkipCache(cacheKey, record);
            return record;
          }
        }
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
    }
  }

  // 2. Query AniSkip via server proxy when MAL ID is known
  if (params.malId && params.malId > 0) {
    try {
      const fetchFn = params.fetchImpl || fetch;
      const lenQuery =
        params.episodeLengthSeconds && params.episodeLengthSeconds > 0
          ? `?episodeLength=${Math.round(params.episodeLengthSeconds)}`
          : '';
      const res = await fetchFn(`/api/aniskip/skip-times/${params.malId}/${episode}${lenQuery}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const data = await res.json().catch(() => null) as {
          found?: boolean;
          intervals?: Array<{ skipType: string; startTime: number; endTime: number }>;
        } | null;

        if (data?.found && Array.isArray(data.intervals) && data.intervals.length > 0) {
          const op = data.intervals.find((i) => i.skipType === 'op' || i.skipType === 'mixed-op');
          const recap = data.intervals.find((i) => i.skipType === 'recap');
          const ed = data.intervals.find((i) => i.skipType === 'ed' || i.skipType === 'mixed-ed');

          const result: EpisodeSkipTimings = {
            provider: params.anilistId ? 'anilist' : 'mal',
            providerId: primaryId,
            season,
            episode,
            ...(op && isValidInterval(op.startTime, op.endTime)
              ? { introStart: op.startTime, introEnd: op.endTime }
              : {}),
            ...(recap && isValidInterval(recap.startTime, recap.endTime)
              ? { recapStart: recap.startTime, recapEnd: recap.endTime }
              : {}),
            ...(ed && isValidInterval(ed.startTime, ed.endTime)
              ? { creditsStart: ed.startTime, creditsEnd: ed.endTime }
              : {}),
            source: 'aniskip'
          };

          if (result.introStart !== undefined || result.recapStart !== undefined || result.creditsStart !== undefined) {
            setSkipCache(cacheKey, result);
            return result;
          }
        }
      }
    } catch {
      // AniSkip lookup failed; fail safely without inventing timings
    }
  }

  setSkipCache(cacheKey, null);
  return null;
}

/**
 * Checks whether currentTime falls inside a verified intro, recap, or credits segment.
 */
export function findActiveSkipSegment(
  timings: EpisodeSkipTimings | null | undefined,
  currentTimeSeconds: number,
  durationSeconds?: number
): ActiveSkipSegment | null {
  if (!timings || !Number.isFinite(currentTimeSeconds) || currentTimeSeconds < 0) {
    return null;
  }

  if (
    isValidInterval(timings.recapStart, timings.recapEnd) &&
    currentTimeSeconds >= timings.recapStart! &&
    currentTimeSeconds < timings.recapEnd! - 0.5
  ) {
    return {
      kind: 'recap',
      label: 'Skip Recap',
      start: timings.recapStart!,
      end: timings.recapEnd!
    };
  }

  if (
    isValidInterval(timings.introStart, timings.introEnd) &&
    currentTimeSeconds >= timings.introStart! &&
    currentTimeSeconds < timings.introEnd! - 0.5
  ) {
    return {
      kind: 'intro',
      label: 'Skip Intro',
      start: timings.introStart!,
      end: timings.introEnd!
    };
  }

  const effectiveCreditsEnd =
    timings.creditsEnd ?? (durationSeconds && timings.creditsStart && durationSeconds > timings.creditsStart ? durationSeconds : undefined);

  if (
    typeof timings.creditsStart === 'number' &&
    effectiveCreditsEnd &&
    effectiveCreditsEnd > timings.creditsStart + 2 &&
    currentTimeSeconds >= timings.creditsStart &&
    currentTimeSeconds < effectiveCreditsEnd - 0.5
  ) {
    return {
      kind: 'credits',
      label: 'Skip Credits',
      start: timings.creditsStart,
      end: effectiveCreditsEnd
    };
  }

  return null;
}

// ============================================================================
// Admin Firestore management helpers (`introTimings`)
// ============================================================================
function parseDocIdParts(docId: string): {
  provider: 'tmdb' | 'anilist' | 'mal';
  providerId: string;
  season: number;
  episode: number;
} {
  const match = docId.match(/^(tmdb|anilist|mal)_([a-zA-Z0-9-]+)_s(\d+)_e(\d+)$/);
  if (match) {
    return {
      provider: match[1] as 'tmdb' | 'anilist' | 'mal',
      providerId: match[2],
      season: Number(match[3]),
      episode: Number(match[4])
    };
  }
  return { provider: 'tmdb', providerId: docId, season: 1, episode: 1 };
}

export async function listIntroTimingOverrides(maxItems = 50): Promise<Array<EpisodeSkipTimings & { id: string }>> {
  if (isFirestoreQuotaExceeded()) return [];
  const snap = await getDocs(query(collection(db, 'introTimings'), limit(maxItems)));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    const parsed = parseDocIdParts(d.id);
    return {
      id: d.id,
      provider: data.provider || parsed.provider,
      providerId: String(data.providerId || parsed.providerId),
      season: Number(data.season ?? parsed.season),
      episode: Number(data.episode ?? parsed.episode),
      introStart: typeof data.introStart === 'number' ? data.introStart : undefined,
      introEnd: typeof data.introEnd === 'number' ? data.introEnd : undefined,
      recapStart: typeof data.recapStart === 'number' ? data.recapStart : undefined,
      recapEnd: typeof data.recapEnd === 'number' ? data.recapEnd : undefined,
      creditsStart: typeof data.creditsStart === 'number' ? data.creditsStart : undefined,
      creditsEnd: typeof data.creditsEnd === 'number' ? data.creditsEnd : undefined,
      source: 'admin',
      updatedAt: data.updatedAt
    };
  });
}

export async function saveIntroTimingOverride(input: {
  provider: 'tmdb' | 'anilist' | 'mal';
  providerId: string;
  season: number;
  episode: number;
  introStart?: number;
  introEnd?: number;
  recapStart?: number;
  recapEnd?: number;
  creditsStart?: number;
  creditsEnd?: number;
}): Promise<string> {
  const docId = buildIntroTimingDocId(input.provider, input.providerId, input.season, input.episode);
  const payload: Record<string, any> = {
    id: docId,
    mediaKey: docId,
    source: 'admin',
    updatedAt: new Date().toISOString()
  };

  if (isValidInterval(input.introStart, input.introEnd)) {
    payload.introStart = input.introStart;
    payload.introEnd = input.introEnd;
  }
  if (isValidInterval(input.recapStart, input.recapEnd)) {
    payload.recapStart = input.recapStart;
    payload.recapEnd = input.recapEnd;
  }
  if (typeof input.creditsStart === 'number' && Number.isFinite(input.creditsStart) && input.creditsStart >= 0) {
    payload.creditsStart = input.creditsStart;
  }

  await setDoc(doc(db, 'introTimings', docId), payload, { merge: true });
  skipTimingCache.clear();
  return docId;
}

export async function deleteIntroTimingOverride(docId: string): Promise<void> {
  await deleteDoc(doc(db, 'introTimings', docId));
  skipTimingCache.clear();
}
