/**
 * Phase 4 Task 5 Regression Tests: Retryability, Concurrency Deduplication,
 * Unmount Safety, Stale-Response Protection & Authentic Episode Metadata
 */

import fs from 'node:fs';
import path from 'node:path';
import { KeyedFetchCoordinator } from '../../utils/retryState';
import { fetchSeasonEpisodesStrict, fetchCatalog } from '../tmdb';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function runTests() {
  console.log('--- Running Phase 4 Retry, Concurrency & Unmount Regression Tests ---\n');

  // 1. Season episode failure (HTTP 500) -> failed attempt clears lock -> retry succeeds cleanly
  let seasonAttempt = 0;
  const mockSeasonFetch = (async () => {
    seasonAttempt++;
    if (seasonAttempt === 1) {
      return new Response('Upstream error', { status: 500 });
    }
    return new Response(
      JSON.stringify({
        episodes: [
          {
            id: 5001,
            episode_number: 1,
            season_number: 2,
            name: 'Seven Thirty-Seven',
            overview: 'Season 2 opens.',
            vote_average: 8.7,
            runtime: 47
          }
        ]
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  const seasonCoord = new KeyedFetchCoordinator<any[]>();
  const firstSeasonRes = await seasonCoord.load('1396_2', () =>
    fetchSeasonEpisodesStrict(1396, 2, mockSeasonFetch)
  );
  assert(
    !firstSeasonRes.ok &&
      !seasonCoord.hasLoaded('1396_2') &&
      Boolean(seasonCoord.getError('1396_2')),
    'Season coordinator does not mark failed season HTTP 500 as loaded'
  );

  const retrySeasonRes = await seasonCoord.retry('1396_2', () =>
    fetchSeasonEpisodesStrict(1396, 2, mockSeasonFetch)
  );
  assert(
    retrySeasonRes.ok &&
      seasonAttempt === 2 &&
      seasonCoord.hasLoaded('1396_2') &&
      retrySeasonRes.data?.[0]?.name === 'Seven Thirty-Seven',
    'Season coordinator successfully retries failed season fetch and caches real episodes'
  );

  // 2. Platform catalog failure (HTTP 429) -> retry succeeds cleanly without permanent lockout
  let platAttempt = 0;
  const mockPlatFetch = (async () => {
    platAttempt++;
    if (platAttempt <= 2) {
      return new Response('Rate limited', { status: 429 });
    }
    return new Response(
      JSON.stringify({
        results: [
          { id: 777, title: 'Platform Hit', media_type: 'movie', poster_path: '/p.jpg', vote_average: 7.4 }
        ],
        total_pages: 1,
        total_results: 1
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  const platCoord = new KeyedFetchCoordinator<any[]>();
  const failedPlat = await platCoord.load('apple:US', async () => {
    const res = await fetchCatalog(
      'platform',
      1,
      { platform: 'apple', watchRegion: 'US' },
      { throwOnError: true, fetchImpl: mockPlatFetch }
    );
    return res.results;
  });
  assert(
    !failedPlat.ok && !platCoord.hasLoaded('apple:US'),
    'Platform coordinator clears failed HTTP 429 state so platform can be retried'
  );

  const retriedPlat = await platCoord.retry('apple:US', async () => {
    const res = await fetchCatalog(
      'platform',
      1,
      { platform: 'apple', watchRegion: 'US' },
      { throwOnError: true, fetchImpl: mockPlatFetch }
    );
    return res.results;
  });
  assert(
    retriedPlat.ok && platAttempt === 4 && retriedPlat.data?.[0]?.title === 'Platform Hit',
    'Platform retry succeeds cleanly after transient failure'
  );

  // 3. Duplicate concurrent clicks deduplicate into a single in-flight request
  let concurrentFetches = 0;
  let resolveSlow!: (v: any[]) => void;
  const dedupeCoord = new KeyedFetchCoordinator<any[]>();
  const slowFetcher = () => {
    concurrentFetches++;
    return new Promise<any[]>(res => {
      resolveSlow = res;
    });
  };

  const pA = dedupeCoord.load('disney:US', slowFetcher);
  const pB = dedupeCoord.load('disney:US', slowFetcher);
  assert(dedupeCoord.isLoading('disney:US'), 'Coordinator tracks active in-flight key cleanly');
  resolveSlow([{ id: 1 }]);
  const [resA, resB] = await Promise.all([pA, pB]);
  assert(
    concurrentFetches === 1 && resA.ok && resB.ok && resA.data?.[0]?.id === 1,
    'Concurrent duplicate requests collapse into one underlying fetch'
  );

  // 4. Rapid platform/season switching marks slow earlier response as stale so it cannot overwrite active tab
  const switchCoord = new KeyedFetchCoordinator<string>();
  let resolveSlowTab!: (v: string) => void;
  const tabAPromise = switchCoord.load(
    'max:US',
    () =>
      new Promise<string>(res => {
        resolveSlowTab = res;
      })
  );
  // Immediately switch active key to Hulu before Max finishes
  const tabBPromise = switchCoord.load('hulu:US', async () => 'Hulu Data');
  const tabBRes = await tabBPromise;
  resolveSlowTab('Late Max Data');
  const tabARes = await tabAPromise;

  assert(
    !tabBRes.stale && tabBRes.data === 'Hulu Data' && tabARes.stale === true,
    'Rapid switching marks delayed response from previous tab/season as stale'
  );

  // 5. Unmount safety: destroy() suppresses callbacks/state writes when request finishes after unmount
  const unmountCoord = new KeyedFetchCoordinator<string>();
  let resolveAfterUnmount!: (v: string) => void;
  const unmountPromise = unmountCoord.load(
    'netflix:US',
    () =>
      new Promise<string>(res => {
        resolveAfterUnmount = res;
      })
  );
  unmountCoord.destroy();
  resolveAfterUnmount('Should Be Ignored');
  const postUnmount = await unmountPromise;
  assert(
    postUnmount.aborted && !unmountCoord.hasLoaded('netflix:US'),
    'Unmount destroy() prevents state updates after component teardown'
  );

  // 6. Verify StreamingPlayer placeholder episodes never fabricate rating 8.0
  const playerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/StreamingPlayer.tsx'), 'utf8');
  assert(
    !playerSrc.includes('attemptedSeasonsRef') &&
      !playerSrc.includes('voteAverage: 8.0') &&
      playerSrc.includes('voteAverage: 0'),
    'StreamingPlayer removes permanent attemptedSeasonsRef lock and fabricated 8.0 episode ratings'
  );
  const platSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/PlatformSection.tsx'), 'utf8');
  assert(
    !platSrc.includes('attemptedPlatformsRef') && platSrc.includes('Retry'),
    'PlatformSection removes permanent attemptedPlatformsRef lock and exposes Retry control'
  );

  console.log('\n--- ALL RETRY, CONCURRENCY & UNMOUNT TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('Retry test failure:', err);
  process.exit(1);
});
