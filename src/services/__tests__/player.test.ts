import assert from 'node:assert/strict';
import { createAniSkipRoute } from '../../server/api/aniskip';
import {
  clearIntroSkipCacheForTests,
  fetchEpisodeSkipTimings,
  findActiveSkipSegment
} from '../introSkip';
import {
  normalizeHlsAudioTracks,
  resolveAdjacentEpisodes
} from '../../utils/episodeNavigation';
import {
  getUserPlayerSettings,
  saveUserPlayerSettings,
  getEffectiveAutoplayNextEpisode,
  setAutoplayNextEpisodePreference
} from '../playerSettings';

function setupMockLocalStorage(): void {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, val: string) {
      store.set(key, String(val));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

async function runTests(): Promise<void> {
  setupMockLocalStorage();

  // 1. Episode navigation: intra-season, cross-season, Specials exclusion, zero fabrication
  const seasons = [
    { id: 0, seasonNumber: 0, name: 'Specials', episodeCount: 4 },
    { id: 1, seasonNumber: 1, name: 'Season 1', episodeCount: 7 },
    { id: 2, seasonNumber: 2, name: 'Season 2', episodeCount: 13 }
  ];

  // Intra-season next/prev
  const midSeason = resolveAdjacentEpisodes({
    isMovie: false,
    currentSeason: 1,
    currentEpisode: 3,
    seasonsList: seasons
  });
  assert.equal(midSeason.hasNext, true);
  assert.equal(midSeason.next?.season, 1);
  assert.equal(midSeason.next?.episode, 4);
  assert.equal(midSeason.next?.isSeasonTransition, false);
  assert.equal(midSeason.hasPrev, true);
  assert.equal(midSeason.prev?.season, 1);
  assert.equal(midSeason.prev?.episode, 2);

  // Cross-season forward transition: S01E07 -> S02E01
  const endOfS1 = resolveAdjacentEpisodes({
    isMovie: false,
    currentSeason: 1,
    currentEpisode: 7,
    seasonsList: seasons,
    loadedSeasonsMap: {
      2: [{ id: 201, episodeNumber: 1, seasonNumber: 2, name: 'Future Days' } as any]
    }
  });
  assert.equal(endOfS1.hasNext, true);
  assert.equal(endOfS1.next?.season, 2);
  assert.equal(endOfS1.next?.episode, 1);
  assert.equal(endOfS1.next?.episodeName, 'Future Days');
  assert.equal(endOfS1.next?.isSeasonTransition, true);

  // Cross-season backward transition: S02E01 -> S01E07 (must skip Season 0 Specials!)
  const startOfS2 = resolveAdjacentEpisodes({
    isMovie: false,
    currentSeason: 2,
    currentEpisode: 1,
    seasonsList: seasons
  });
  assert.equal(startOfS2.hasPrev, true);
  assert.equal(startOfS2.prev?.season, 1);
  assert.equal(startOfS2.prev?.episode, 7);
  assert.equal(startOfS2.prev?.isSeasonTransition, true);

  // Specials must never leak ahead of S1E1
  const startOfS1 = resolveAdjacentEpisodes({
    isMovie: false,
    currentSeason: 1,
    currentEpisode: 1,
    seasonsList: seasons
  });
  assert.equal(startOfS1.hasPrev, false);
  assert.equal(startOfS1.prev, null);

  // Missing season metadata: NEVER assume 8 or 10 placeholder episodes
  const missingMeta = resolveAdjacentEpisodes({
    isMovie: false,
    currentSeason: 1,
    currentEpisode: 1,
    seasonsList: []
  });
  assert.equal(missingMeta.hasNext, false);
  assert.equal(missingMeta.next, null);

  // Movies always have no adjacent episodes
  const movieNav = resolveAdjacentEpisodes({
    isMovie: true,
    currentSeason: 1,
    currentEpisode: 1,
    seasonsList: seasons
  });
  assert.equal(movieNav.hasNext, false);
  assert.equal(movieNav.hasPrev, false);

  // 2. Audio track normalization
  const normalizedAudio = normalizeHlsAudioTracks([
    { id: 0, lang: 'jpn', name: 'Japanese', default: true },
    { id: 1, lang: 'eng', name: 'English', default: false },
    { id: 2, lang: 'srp', name: 'Srpski', default: false },
    { id: 3, lang: 'hrv', name: '', default: false },
    { id: 4, lang: 'bos', name: '', default: false }
  ]);
  assert.equal(normalizedAudio[0].code, 'ja');
  assert.equal(normalizedAudio[0].displayName, 'Japanese — Original');
  assert.equal(normalizedAudio[1].code, 'en');
  assert.equal(normalizedAudio[1].languageName, 'English');
  assert.equal(normalizedAudio[2].code, 'sr');
  assert.equal(normalizedAudio[2].languageName, 'Serbian');
  assert.equal(normalizedAudio[3].code, 'hr');
  assert.equal(normalizedAudio[3].languageName, 'Croatian');
  assert.equal(normalizedAudio[4].code, 'bs');
  assert.equal(normalizedAudio[4].languageName, 'Bosnian');

  // 3. AniSkip Hono route
  const aniSkip = createAniSkipRoute({
    fetchImpl: (async (url: string) => {
      if (url.includes('/16498/1')) {
        return new Response(
          JSON.stringify({
            found: true,
            results: [
              { skipType: 'op', interval: { startTime: 85.2, endTime: 175.0 }, episodeLength: 1420 },
              { skipType: 'ed', interval: { startTime: 1300.0, endTime: 1390.0 }, episodeLength: 1420 }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ found: false, results: [] }), { status: 404 });
    }) as typeof fetch
  });

  const skipFoundRes = await aniSkip.request('/skip-times/16498/1?episodeLength=1420');
  assert.equal(skipFoundRes.status, 200);
  const skipFoundJson = await skipFoundRes.json() as any;
  assert.equal(skipFoundJson.found, true);
  assert.equal(skipFoundJson.intervals.length, 2);
  assert.equal(skipFoundJson.intervals[0].skipType, 'op');

  // Cached hit on second call
  const skipCachedRes = await aniSkip.request('/skip-times/16498/1');
  const skipCachedJson = await skipCachedRes.json() as any;
  assert.equal(skipCachedJson.cached, true);

  // Graceful 404 from AniSkip -> 200 found: false
  const skipMissRes = await aniSkip.request('/skip-times/999999/1');
  assert.equal(skipMissRes.status, 200);
  const skipMissJson = await skipMissRes.json() as any;
  assert.equal(skipMissJson.found, false);
  assert.deepEqual(skipMissJson.intervals, []);

  // Invalid params -> 400
  const badRes = await aniSkip.request('/skip-times/abc/0');
  assert.equal(badRes.status, 400);

  // 4. Client fetchEpisodeSkipTimings & findActiveSkipSegment (zero fabricated intervals)
  clearIntroSkipCacheForTests();
  const timings = await fetchEpisodeSkipTimings({
    mediaType: 'anime',
    providerId: 16498,
    anilistId: 16498,
    malId: 16498,
    episode: 1,
    skipFirestore: true,
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          success: true,
          found: true,
          intervals: [
            { skipType: 'recap', startTime: 0, endTime: 40 },
            { skipType: 'op', startTime: 85, endTime: 175 },
            { skipType: 'ed', startTime: 1300, endTime: 1390 }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch
  });
  assert.ok(timings);
  assert.equal(timings.source, 'aniskip');
  assert.equal(timings.introStart, 85);
  assert.equal(timings.introEnd, 175);

  // Segment boundaries
  assert.equal(findActiveSkipSegment(timings, 12)?.kind, 'recap');
  assert.equal(findActiveSkipSegment(timings, 60), null);
  assert.equal(findActiveSkipSegment(timings, 100)?.kind, 'intro');
  assert.equal(findActiveSkipSegment(timings, 1320)?.kind, 'credits');
  assert.equal(findActiveSkipSegment(null, 100), null);

  // Without MAL ID -> returns null (never invents timestamps)
  clearIntroSkipCacheForTests();
  const missingSkip = await fetchEpisodeSkipTimings({
    mediaType: 'tv',
    providerId: 1396,
    tmdbId: 1396,
    season: 1,
    episode: 1,
    skipFirestore: true
  });
  assert.equal(missingSkip, null);

  // 5. Guest player settings persistence (no authentication required)
  const savedGuest = await saveUserPlayerSettings({
    autoPlayNextSeason: false,
    nextEpisodeCountdownSeconds: 8,
    autoSkipIntro: true,
    skipRecap: true,
    skipCredits: false,
    subtitlePosition: 'top',
    subtitleDelay: 1.5,
    preferredAudioLang: 'ja',
    animeAudioPreference: 'dub',
    rememberLastServer: false,
    maintainFullscreen: true
  });
  assert.equal(savedGuest.autoPlayNextSeason, false);
  assert.equal(savedGuest.nextEpisodeCountdownSeconds, 8);
  assert.equal(savedGuest.autoSkipIntro, true);
  assert.equal(savedGuest.subtitlePosition, 'top');
  assert.equal(savedGuest.subtitleDelay, 1.5);
  assert.equal(savedGuest.preferredAudioLang, 'ja');
  assert.equal(savedGuest.animeAudioPreference, 'dub');

  const reloadedGuest = getUserPlayerSettings();
  assert.equal(reloadedGuest.nextEpisodeCountdownSeconds, 8);
  assert.equal(reloadedGuest.subtitlePosition, 'top');

  await setAutoplayNextEpisodePreference(false);
  assert.equal(getEffectiveAutoplayNextEpisode(), false);
  await setAutoplayNextEpisodePreference(true);
  assert.equal(getEffectiveAutoplayNextEpisode(), true);

  console.log('ALL PHASE 5 PLAYER & ANISKIP TESTS PASSED');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Player tests failed:', err);
    process.exit(1);
  });
