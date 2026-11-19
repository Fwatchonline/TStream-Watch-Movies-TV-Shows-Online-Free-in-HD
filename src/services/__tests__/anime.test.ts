import assert from 'node:assert/strict';
import {
  createAniListRoute,
  clearAniListCache,
  getCachedTmdbMappingForAnime,
  normalizeAniListMedia
} from '../../server/api/anilist';
import {
  animeMediaToDetail,
  animeMediaToMediaItem,
  formatAnimeEpisodeRange
} from '../animeCatalog';
import { SUPPORTED_WATCH_REGIONS, getPlatformConfigById } from '../platformConfig';
import {
  buildPlatformDiscoverPlan,
  computeBalancedTopRatedPlan
} from '../platformDiscovery';
import { getGuestWatchHistory, resetMemoryStorageForTests } from '../storage';
import { recordWatchProgress } from '../watchHistory';
import { rankPersonalizedRecommendations } from '../recommendationEngine';

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

function makeRawAniListMedia(overrides: Record<string, any> = {}) {
  return {
    id: 16498,
    idMal: 16498,
    format: 'TV',
    status: 'FINISHED',
    title: {
      english: 'Attack on Titan',
      romaji: 'Shingeki no Kyojin',
      native: '進撃の巨人'
    },
    description: '<p>Humanity fights inside <b>massive walls</b>.<br/>Real AniList synopsis.</p>',
    coverImage: { extraLarge: 'https://s4.anilist.co/file/aot-xl.jpg', large: 'https://s4.anilist.co/file/aot-l.jpg' },
    bannerImage: 'https://s4.anilist.co/file/aot-banner.jpg',
    episodes: 25,
    duration: 24,
    season: 'SPRING',
    seasonYear: 2013,
    startDate: { year: 2013, month: 4, day: 7 },
    endDate: { year: 2013, month: 9, day: 29 },
    averageScore: 84,
    popularity: 680000,
    genres: ['Action', 'Drama', 'Fantasy'],
    tags: [{ name: 'Survival', rank: 90, isGeneralSpoiler: false, isMediaSpoiler: false }],
    studios: { nodes: [{ id: 858, name: 'Wit Studio', isAnimationStudio: true }] },
    isAdult: false,
    trailer: { id: 'MGRm4IzK1SQ', site: 'youtube', thumbnail: '' },
    streamingEpisodes: [],
    characters: { edges: [] },
    relations: { edges: [] },
    recommendations: { nodes: [] },
    ...overrides
  };
}

async function main() {
  await runTest('normalizeAniListMedia preserves AniList/MAL IDs and leaves tmdbId unset when unmapped', () => {
    const raw = makeRawAniListMedia();
    const norm = normalizeAniListMedia(raw);
    assert.equal(norm.anilistId, 16498);
    assert.equal(norm.malId, 16498);
    assert.equal(norm.tmdbId, undefined);
    assert.equal(norm.voteAverage, 8.4);
    assert.equal(norm.description, 'Humanity fights inside massive walls.\nReal AniList synopsis.');

    const cardItem = animeMediaToMediaItem(norm);
    assert.equal(cardItem.id, 16498);
    assert.equal(cardItem.anilistId, 16498);
    assert.equal(cardItem.tmdbId, 0);
    assert.equal(cardItem.mediaType, 'anime');

    const detail = animeMediaToDetail(norm);
    assert.equal(detail.videos?.[0]?.key, 'MGRm4IzK1SQ');
    assert.equal(detail.seasons?.[0]?.episodeCount, 25);
  });

  await runTest('AniList Hono routes handle /trending, /search, 429 retry, and upstream errors gracefully', async () => {
    clearAniListCache();
    let trendingCalls = 0;

    const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('graphql.anilist.co')) {
        trendingCalls += 1;
        if (trendingCalls === 1) {
          return new Response('Rate Limited', { status: 429, headers: { 'Retry-After': '0' } });
        }
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: { total: 40, currentPage: 1, lastPage: 2, hasNextPage: true, perPage: 20 },
                media: [
                  makeRawAniListMedia(),
                  makeRawAniListMedia({ id: 999999, isAdult: true, title: { english: 'Adult Hidden' } })
                ]
              }
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    };

    const app = createAniListRoute({ fetchFn: mockFetch, tmdbApiKey: 'test-key' });
    const res1 = await app.request('/trending?page=1&perPage=20');
    assert.equal(res1.status, 200);
    const body1 = (await res1.json()) as any;
    assert.equal(trendingCalls, 2);
    assert.equal(body1.results.length, 1);
    assert.equal(body1.results[0].anilistId, 16498);

    // Second request hits TTL cache without another upstream fetch
    const res2 = await app.request('/trending?page=1&perPage=20');
    assert.equal(res2.status, 200);
    assert.equal(trendingCalls, 2);

    // Filtered search endpoint
    const searchRes = await app.request('/search?genre=Action&year=2024&country=JP&minScore=75&page=1');
    assert.equal(searchRes.status, 200);
    const searchBody = (await searchRes.json()) as any;
    assert.ok(Array.isArray(searchBody.results));
  });

  await runTest('AniList /media/:id enriches Jikan episode titles and /resolve-tmdb maps without ID collision', async () => {
    clearAniListCache();
    const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('graphql.anilist.co')) {
        return new Response(
          JSON.stringify({
            data: {
              Media: makeRawAniListMedia({ id: 21, idMal: 21, episodes: 3, title: { english: 'One Piece' } })
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('api.jikan.moe/v4/anime/21/episodes')) {
        return new Response(
          JSON.stringify({
            data: [
              { mal_id: 1, title: "I'm Luffy! The Man Who's Gonna Be King of the Pirates!", aired: '1999-10-20T00:00:00+00:00', filler: false },
              { mal_id: 2, title: 'Enter the Great Swordsman! Pirate Hunter Roronoa Zoro!', aired: '1999-11-17T00:00:00+00:00', filler: false }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('api.themoviedb.org/3/search/tv')) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 37854,
                name: 'One Piece',
                original_name: 'ワンピース',
                first_air_date: '1999-10-20',
                genre_ids: [16, 10759],
                origin_country: ['JP']
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    };

    const app = createAniListRoute({ fetchFn: mockFetch, tmdbApiKey: 'test-key' });
    const detailRes = await app.request('/media/21');
    assert.equal(detailRes.status, 200);
    const detailBody = (await detailRes.json()) as any;
    assert.equal(detailBody.anilistId, 21);
    assert.equal(detailBody.malId, 21);
    assert.equal(detailBody.episodes.length, 2);
    assert.equal(detailBody.episodes[0].title, "I'm Luffy! The Man Who's Gonna Be King of the Pirates!");

    // Pad missing episodes neutrally as "Episode N" — never fabricate story titles
    const padded = formatAnimeEpisodeRange(detailBody.episodes, 3);
    assert.equal(padded.length, 3);
    assert.equal(padded[2].title, 'Episode 3');

    const mapRes = await app.request('/resolve-tmdb/21?title=One%20Piece&format=TV');
    assert.equal(mapRes.status, 200);
    const mapBody = (await mapRes.json()) as any;
    assert.equal(mapBody.anilistId, 21);
    assert.equal(mapBody.tmdbId, 37854);
    assert.equal(getCachedTmdbMappingForAnime(21)?.tmdbId, 37854);
  });

  await runTest('AniList route handles 500 upstream failure without throwing unhandled error', async () => {
    clearAniListCache();
    const failFetch: typeof fetch = async () => new Response('Server Error', { status: 500 });
    const app = createAniListRoute({ fetchFn: failFetch });
    const res = await app.request('/popular');
    assert.equal(res.status, 502);
    const body = (await res.json()) as any;
    assert.deepEqual(body.results, []);
    assert.ok(body.error);
  });

  await runTest('Platform discovery supports IT/ES/BA regions and combined language filter plan', () => {
    const codes = new Set<string>(SUPPORTED_WATCH_REGIONS.map((r) => r.code));
    for (const reqCode of ['US', 'GB', 'CA', 'DE', 'FR', 'IT', 'ES', 'AU', 'BA', 'HR', 'RS']) {
      assert.ok(codes.has(reqCode), `Expected watch region ${reqCode}`);
    }

    const crunchyroll = getPlatformConfigById('crunchyroll')!;
    const plan = buildPlatformDiscoverPlan(crunchyroll, {
      page: 2,
      mediaType: 'tv',
      sortBy: 'vote_average.desc',
      watchRegion: 'it',
      genreId: 16,
      year: 2024,
      minRating: 7.5,
      language: 'ja'
    });

    assert.equal(plan.watchRegion, 'IT');
    assert.equal(plan.moviePathAndQuery, null);
    assert.ok(plan.tvPathAndQuery);
    assert.ok(plan.tvPathAndQuery.includes('with_watch_providers=283'));
    assert.ok(plan.tvPathAndQuery.includes('watch_region=IT'));
    assert.ok(plan.tvPathAndQuery.includes('with_original_language=ja'));
    assert.ok(plan.tvPathAndQuery.includes('first_air_date_year=2024'));

    const p1 = computeBalancedTopRatedPlan(1);
    const p2 = computeBalancedTopRatedPlan(2);
    assert.equal(p1.globalEnd, p2.globalStart);
  });

  await runTest('Watch history and recommendation engine support anime items cleanly', async () => {
    resetMemoryStorageForTests();
    await recordWatchProgress({
      mediaType: 'anime',
      anilistId: 11061,
      malId: 11061,
      title: 'Hunter x Hunter (2011)',
      posterPath: '/hxh.jpg',
      episodeNumber: 12,
      progressSeconds: 600,
      durationSeconds: 1440,
      genres: ['Action', 'Adventure', 'Fantasy']
    });

    const history = getGuestWatchHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].mediaType, 'anime');
    assert.equal(history[0].anilistId, 11061);

    const candidates = [
      animeMediaToMediaItem(normalizeAniListMedia(makeRawAniListMedia({ id: 200, averageScore: 86, genres: ['Action', 'Adventure'] }))),
      {
        id: 11061,
        tmdbId: 11061,
        title: 'Unrelated Movie With Same Numeric ID',
        overview: 'Should not collide with AniList 11061',
        posterPath: '',
        backdropPath: '',
        releaseDate: '2025-01-01',
        voteAverage: 7.2,
        voteCount: 400,
        popularity: 50,
        genres: [{ id: 18, name: 'Drama' }],
        mediaType: 'movie' as const
      }
    ];

    const recs = rankPersonalizedRecommendations({ candidates, history, limit: 10 });
    assert.equal(recs.length, 2);
    assert.equal(recs[0].item.anilistId, 200);
    assert.ok(recs[0].score > recs[1].score);
  });
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
