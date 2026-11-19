import assert from 'node:assert/strict';
import {
  buildMediaKey,
  buildSeriesKey,
  parseMediaKey,
  isCompletionReached,
  resolvePrimaryId
} from '../../utils/mediaKey';
import {
  resetMemoryStorageForTests,
  saveProgress,
  getContinueWatching,
  getGuestWatchHistory,
  getGuestWatchProgressItem,
  getGuestCompletedMedia,
  removeContinueWatching,
  toggleWatchlist,
  isInWatchlist
} from '../storage';
import {
  recordWatchProgress,
  resolveSafeResumeSeconds,
  resolveHistoryConflict,
  deduplicateHistoryRecords,
  buildGuestToCloudMergePlan
} from '../watchHistory';
import { WatchHistoryRecord } from '../../types/media';

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS: ${name}`);
    })
    .catch((err) => {
      console.error(`FAIL: ${name}`);
      console.error(err);
      process.exitCode = 1;
    });
}

async function main() {
  await runTest('deterministic mediaKey & seriesKey keep Movie, TV, and Anime IDs strictly isolated', () => {
    const movieKey = buildMediaKey({ mediaType: 'movie', tmdbId: 550 });
    const tvKey = buildMediaKey({ mediaType: 'tv', tmdbId: 550, seasonNumber: 1, episodeNumber: 2 });
    const animeKey = buildMediaKey({ mediaType: 'anime', anilistId: 550, episodeNumber: 2 });

    assert.equal(movieKey, 'movie_550');
    assert.equal(tvKey, 'tv_550_s1_e2');
    assert.equal(animeKey, 'anime_550_ep_2');

    // Never collide even with identical numeric IDs
    assert.notEqual(movieKey, tvKey);
    assert.notEqual(tvKey, animeKey);
    assert.notEqual(movieKey, animeKey);

    assert.equal(buildSeriesKey({ mediaType: 'anime', anilistId: 16498 }), 'anime_16498');
    assert.deepEqual(parseMediaKey(tvKey), {
      mediaType: 'tv',
      primaryId: '550',
      seasonNumber: 1,
      episodeNumber: 2,
      isEpisodeLevel: true,
      seriesKey: 'tv_550'
    });
    assert.deepEqual(parseMediaKey(animeKey), {
      mediaType: 'anime',
      primaryId: '550',
      episodeNumber: 2,
      isEpisodeLevel: true,
      seriesKey: 'anime_550'
    });
    assert.equal(resolvePrimaryId({ mediaType: 'anime', anilistId: 16498, tmdbId: 999 }), '16498');
  });

  await runTest('guest playback saves progress immediately across movie, tv, and anime without login', async () => {
    resetMemoryStorageForTests();

    await recordWatchProgress({
      mediaType: 'movie',
      tmdbId: 550,
      title: 'Fight Club',
      posterPath: '/fc.jpg',
      progressSeconds: 1200,
      durationSeconds: 7200
    });

    await recordWatchProgress({
      mediaType: 'anime',
      anilistId: 16498,
      malId: 16498,
      title: 'Attack on Titan',
      posterPath: '/aot.jpg',
      episodeNumber: 5,
      episodeName: 'First Battle',
      progressSeconds: 450,
      durationSeconds: 1440
    });

    const cw = getContinueWatching();
    assert.equal(cw.length, 2);

    const history = getGuestWatchHistory();
    assert.equal(history.length, 2);

    const animeRec = getGuestWatchProgressItem('anime_16498_ep_5');
    assert.ok(animeRec);
    assert.equal(animeRec.episodeName, 'First Battle');
    assert.equal(animeRec.progressSeconds, 450);
    assert.equal(resolveSafeResumeSeconds(animeRec), 450);

    removeContinueWatching(16498, 'anime');
    assert.equal(getContinueWatching().length, 1);
  });

  await runTest('completion threshold marks >=90% watched as Completed and resets resume position to 0', async () => {
    resetMemoryStorageForTests();

    assert.equal(isCompletionReached(899, 1000), false);
    assert.equal(isCompletionReached(900, 1000), true);

    const rec = await recordWatchProgress({
      mediaType: 'tv',
      tmdbId: 1396,
      title: 'Breaking Bad',
      seasonNumber: 5,
      episodeNumber: 16,
      episodeName: 'Felina',
      progressSeconds: 2950,
      durationSeconds: 3000
    });

    assert.equal(rec.completed, true);
    assert.equal(resolveSafeResumeSeconds(rec), 0);

    const completed = getGuestCompletedMedia();
    assert.equal(completed.length, 1);
    assert.equal(completed[0].mediaKey, 'tv_1396_s5_e16');

    // Removed from Continue Watching once >= 95%
    assert.equal(getContinueWatching().length, 0);
  });

  await runTest('deduplicateHistoryRecords and resolveHistoryConflict preserve newest updatedAt without duplicates', () => {
    const older: WatchHistoryRecord = {
      mediaKey: 'movie_550',
      seriesKey: 'movie_550',
      mediaType: 'movie',
      tmdbId: '550',
      title: 'Fight Club',
      progressSeconds: 300,
      durationSeconds: 7200,
      percentage: 4,
      completed: false,
      lastWatchedAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z'
    };

    const newer: WatchHistoryRecord = {
      ...older,
      progressSeconds: 3600,
      percentage: 50,
      lastWatchedAt: '2026-01-02T12:00:00.000Z',
      updatedAt: '2026-01-02T12:00:00.000Z'
    };

    const resolved = resolveHistoryConflict(newer, older);
    assert.equal(resolved.progressSeconds, 3600);
    assert.equal(resolved.percentage, 50);

    const deduped = deduplicateHistoryRecords([older, newer, older]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].progressSeconds, 3600);
  });

  await runTest('non-destructive guest-to-account merge keeps newer progress and never overwrites newer cloud records', () => {
    const guestHistory: WatchHistoryRecord[] = [
      {
        mediaKey: 'movie_550',
        seriesKey: 'movie_550',
        mediaType: 'movie',
        tmdbId: '550',
        title: 'Fight Club',
        progressSeconds: 4000,
        durationSeconds: 7200,
        percentage: 56,
        completed: false,
        lastWatchedAt: '2026-05-02T10:00:00.000Z',
        updatedAt: '2026-05-02T10:00:00.000Z' // newer than cloud
      },
      {
        mediaKey: 'anime_21_ep_100',
        seriesKey: 'anime_21',
        mediaType: 'anime',
        anilistId: 21,
        title: 'One Piece',
        episodeNumber: 100,
        progressSeconds: 200,
        durationSeconds: 1400,
        percentage: 14,
        completed: false,
        lastWatchedAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z' // older than cloud
      }
    ];

    const cloudHistory: WatchHistoryRecord[] = [
      {
        userId: 'u1',
        mediaKey: 'movie_550',
        seriesKey: 'movie_550',
        mediaType: 'movie',
        tmdbId: '550',
        title: 'Fight Club',
        progressSeconds: 900,
        durationSeconds: 7200,
        percentage: 13,
        completed: false,
        lastWatchedAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z'
      },
      {
        userId: 'u1',
        mediaKey: 'anime_21_ep_100',
        seriesKey: 'anime_21',
        mediaType: 'anime',
        anilistId: 21,
        title: 'One Piece',
        episodeNumber: 100,
        progressSeconds: 1350,
        durationSeconds: 1400,
        percentage: 96,
        completed: true,
        lastWatchedAt: '2026-05-03T10:00:00.000Z',
        updatedAt: '2026-05-03T10:00:00.000Z'
      }
    ];

    const plan = buildGuestToCloudMergePlan({
      userId: 'u1',
      guestHistory,
      cloudHistory,
      guestContinueWatching: [],
      guestCompleted: [],
      cloudCompleted: []
    });

    // Only Fight Club should overwrite cloud; One Piece cloud record is newer & preserved!
    assert.equal(plan.historyWrites.length, 1);
    assert.equal(plan.historyWrites[0].mediaKey, 'movie_550');
    assert.equal(plan.historyWrites[0].progressSeconds, 4000);
  });

  await runTest('guest watchlist isolates anime IDs from TMDB IDs cleanly', () => {
    resetMemoryStorageForTests();
    toggleWatchlist({
      id: 21,
      mediaType: 'anime',
      anilistId: 21,
      title: 'One Piece',
      posterPath: '/op.jpg',
      backdropPath: '',
      releaseDate: '1999-10-20',
      voteAverage: 8.8
    });

    assert.equal(isInWatchlist(21, 'anime'), true);
    assert.equal(isInWatchlist(21, 'movie'), false);

    // Ensure saveProgress keeps anime record out of movie queries
    saveProgress({
      id: 21,
      mediaType: 'anime',
      anilistId: 21,
      title: 'One Piece',
      posterPath: '/op.jpg',
      backdropPath: '',
      progressSeconds: 150,
      durationSeconds: 1400,
      episodeNumber: 1
    });
    assert.equal(getGuestWatchHistory()[0].mediaType, 'anime');
  });

  process.exit(process.exitCode ?? 0);
}

main();
