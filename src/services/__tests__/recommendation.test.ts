import assert from 'node:assert/strict';
import {
  rankPersonalizedRecommendations,
  recordRecommendationSignal,
  getRecommendationProfile,
  resetRecommendationProfile
} from '../recommendationEngine';
import { MediaItem, WatchHistoryRecord } from '../../types/media';

function makeCandidate(overrides: Partial<MediaItem> & { id: number; title: string }): MediaItem {
  return {
    tmdbId: overrides.id,
    overview: 'Real test overview',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    releaseDate: '2025-05-10',
    voteAverage: 8.2,
    voteCount: 1200,
    popularity: 80,
    genres: [{ id: 1, name: 'Sci-Fi' }],
    mediaType: 'movie',
    ...overrides
  };
}

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`PASS: ${name}`))
    .catch((err) => {
      console.error(`FAIL: ${name}`);
      console.error(err);
      process.exitCode = 1;
    });
}

async function main() {
  await runTest('ranks candidates matching watch history genres & anime format higher while excluding completed films', async () => {
    await resetRecommendationProfile();

    const history: WatchHistoryRecord[] = [
      {
        mediaKey: 'anime_16498_ep_12',
        seriesKey: 'anime_16498',
        mediaType: 'anime',
        anilistId: 16498,
        title: 'Attack on Titan',
        genres: ['Action', 'Dark Fantasy'],
        progressSeconds: 1400,
        durationSeconds: 1440,
        percentage: 97,
        completed: true,
        lastWatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        mediaKey: 'movie_999',
        seriesKey: 'movie_999',
        mediaType: 'movie',
        tmdbId: '999',
        title: 'Already Watched Film',
        genres: ['Romance'],
        progressSeconds: 7000,
        durationSeconds: 7200,
        percentage: 97,
        completed: true,
        lastWatchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const candidates: MediaItem[] = [
      makeCandidate({ id: 999, title: 'Already Watched Film', mediaType: 'movie' }),
      makeCandidate({
        id: 101,
        title: 'Low Match Comedy',
        mediaType: 'movie',
        genres: [{ id: 35, name: 'Comedy' }],
        voteAverage: 6.2
      }),
      makeCandidate({
        id: 11061,
        anilistId: 11061,
        title: 'Hunter x Hunter',
        mediaType: 'anime',
        genres: [{ id: 1, name: 'Action' }, { id: 2, name: 'Dark Fantasy' }],
        voteAverage: 9.0,
        voteCount: 2500
      })
    ];

    const ranked = rankPersonalizedRecommendations({
      candidates,
      history,
      limit: 5
    });

    // Completed movie_999 must be excluded
    assert.equal(ranked.some((r) => r.item.id === 999), false);
    // Anime matching Action + Dark Fantasy must rank #1
    assert.equal(ranked[0].item.id, 11061);
    assert.ok(ranked[0].score > ranked[1].score);
    assert.ok(ranked[0].reasons.length > 0);
  });

  await runTest('diversity penalty prevents repetitive same-genre flooding across top results', () => {
    const candidates: MediaItem[] = [
      makeCandidate({ id: 1, title: 'Action One', genres: [{ id: 28, name: 'Action' }], voteAverage: 8.5 }),
      makeCandidate({ id: 2, title: 'Action Two', genres: [{ id: 28, name: 'Action' }], voteAverage: 8.4 }),
      makeCandidate({ id: 3, title: 'Action Three', genres: [{ id: 28, name: 'Action' }], voteAverage: 8.3 }),
      makeCandidate({ id: 4, title: 'Drama Masterpiece', genres: [{ id: 18, name: 'Drama' }], voteAverage: 8.45 })
    ];

    const ranked = rankPersonalizedRecommendations({
      candidates,
      history: [],
      limit: 4
    });

    // After Action One is selected first, Drama Masterpiece beats Action Two due to diversity penalty
    assert.equal(ranked[0].item.id, 1);
    assert.equal(ranked[1].item.id, 4);
    assert.ok(ranked[2].breakdown.diversityPenalty > 0);
  });

  await runTest('recordRecommendationSignal updates guest weights and resetRecommendationProfile clears them', async () => {
    await resetRecommendationProfile();
    await recordRecommendationSignal({
      mediaType: 'tv',
      genres: ['Thriller', 'Mystery'],
      directors: ['Vince Gilligan'],
      actors: ['Bryan Cranston'],
      platformId: 'netflix'
    });

    const profile = getRecommendationProfile();
    assert.ok(profile.genreWeights['thriller'] > 0);
    assert.ok(profile.directorWeights['vince gilligan'] > 0);
    assert.ok(profile.platformWeights['netflix'] > 0);

    await resetRecommendationProfile();
    const cleared = getRecommendationProfile();
    assert.deepEqual(cleared.genreWeights, {});
  });

  process.exit(process.exitCode ?? 0);
}

main();
