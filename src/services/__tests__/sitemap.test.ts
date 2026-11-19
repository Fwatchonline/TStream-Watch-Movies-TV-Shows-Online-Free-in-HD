/**
 * Comprehensive Automated Tests for Dynamic XML Sitemap Expansion & TMDB Discovery
 * Covers all 15 scenarios: multi-page pagination, multi-feed discovery, homepage parity,
 * movie/TV separation, deduplication, canonical slugs, invalid record filtering,
 * bounded episode validation, XML/index validation, automatic chunking/splitting,
 * timeouts & 429/5xx retries, outage fallback & preservation, routeInventory parity,
 * and SSR HTTP 200 canonical verification for dynamically discovered URLs.
 */

import fs from 'fs';
import http from 'node:http';
import os from 'os';
import path from 'path';
import { discoverTmdbCatalog } from '../../../scripts/tmdbDiscovery.ts';
import {
  getAuthoritativeRouteInventory,
  readFreshBuildInventorySnapshot
} from '../../../scripts/routeInventory.ts';
import {
  generateSitemaps,
  validateSitemapXml,
  validateSitemapIndexXml,
  splitAndBuildUrlsetChunks
} from '../../../scripts/generate-sitemaps.ts';
import { prerenderAll } from '../../../scripts/prerender.ts';
import { renderSeoResult } from '../../../scripts/seoHtmlPlugin.ts';
import { verifyDistArtifacts, verifyNoLeakedSecretsInDist } from '../../../scripts/run-build.mjs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>T Stream</title>
    <meta name="description" content="Default" />
    <link rel="canonical" href="https://tstream.online/" />
  </head>
  <body><div id="root"></div></body>
</html>`;

async function runTests() {
  console.log('--- Running Dynamic Sitemap & TMDB Discovery Test Suite ---');

  // Mock TMDB multi-page API covering all feeds, duplicates, invalid entries, TV seasons & episodes
  const requestedUrls: string[] = [];
  let retryCounter = 0;

  const mockTmdbFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(input);
    requestedUrls.push(urlStr);

    if (init?.signal?.aborted) {
      const err: any = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }

    const u = new URL(urlStr);
    const pathname = u.pathname;
    const page = Number(u.searchParams.get('page') || '1');

    // Simulate transient 429 on first attempt to /movie/upcoming page 2, then succeed
    if (pathname.endsWith('/movie/upcoming') && page === 2 && retryCounter === 0) {
      retryCounter++;
      return new Response('rate limited', { status: 429, headers: { 'Retry-After': '0' } });
    }

    // Simulate transient 502 on first attempt to /tv/popular page 2, then succeed
    if (pathname.endsWith('/tv/popular') && page === 2 && retryCounter === 1) {
      retryCounter++;
      return new Response('bad gateway', { status: 502 });
    }

    if (pathname.endsWith('/trending/all/week')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 2,
          results: page === 1
            ? [
                { id: 157336, media_type: 'movie', title: 'Interstellar', release_date: '2014-11-05', overview: 'A team of explorers travel through a wormhole in space.' },
                { id: 94997, media_type: 'tv', name: 'House of the Dragon', first_air_date: '2022-08-21', overview: 'The Targaryen civil war.' },
                { id: 500001, media_type: 'person', name: 'Actor Ignored' }
              ]
            : [
                { id: 603, media_type: 'movie', title: 'The Matrix', release_date: '1999-03-31', overview: 'Reality simulation.' },
                { id: 94605, media_type: 'tv', name: 'Arcane', first_air_date: '2021-11-06', overview: 'Piltover and Zaun.' }
              ]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/trending/movie/week')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 3,
          results: page === 1
            ? [
                { id: 157336, title: 'Interstellar', release_date: '2014-11-05' }, // duplicate across feeds
                { id: 700101, title: 'Dynamic Movie Alpha', release_date: '2025-01-10' },
                { id: 0, title: 'Zero ID Invalid' },
                { id: -5, title: 'Negative ID Invalid' },
                { id: 28, title: 'Spider-Man: Homecoming' }, // corrupted homecoming-28 must be rejected
                { id: 700999, title: 'Adult Item', adult: true }
              ]
            : page === 2
            ? [
                { id: 700102, title: 'Dynamic Movie Beta', release_date: '2025-02-10' },
                { id: 700103, title: '' } // empty title rejected
              ]
            : [{ id: 700104, title: 'Dynamic Movie Gamma', release_date: '2025-03-10' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/movie/popular')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 2,
          results: page === 1
            ? [{ id: 700201, title: 'Popular Film One' }, { id: 700101, title: 'Dynamic Movie Alpha' }]
            : [{ id: 700202, title: 'Popular Film Two' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/movie/top_rated')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 2,
          results: page === 1 ? [{ id: 700301, title: 'Top Film One' }] : [{ id: 700302, title: 'Top Film Two' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/movie/now_playing')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 1,
          results: [{ id: 700401, title: 'Now Playing Film' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/movie/upcoming')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 2,
          results: page === 1 ? [{ id: 700501, title: 'Upcoming Film One' }] : [{ id: 700502, title: 'Upcoming Film Two' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/discover/movie')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 2,
          results: page === 1 ? [{ id: 700601, title: 'Discover Movie One' }] : [{ id: 700602, title: 'Discover Movie Two' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/trending/tv/week')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 2,
          results: page === 1
            ? [{ id: 1396, name: 'Breaking Bad', first_air_date: '2008-01-20' }, { id: 800101, name: 'Dynamic Show Alpha' }]
            : [{ id: 800102, name: 'Dynamic Show Beta' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/tv/popular')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 2,
          results: page === 1
            ? [{ id: 800201, name: 'Popular Show One' }]
            : [{ id: 800202, name: 'Popular Show Two' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/tv/top_rated')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 1,
          results: [{ id: 800301, name: 'Top Show One' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/tv/on_the_air')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 1,
          results: [{ id: 800401, name: 'On Air Show One' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/tv/airing_today')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 1,
          results: [{ id: 800501, name: 'Airing Today Show' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/discover/tv')) {
      return new Response(
        JSON.stringify({
          page,
          total_pages: 2,
          results: page === 1 ? [{ id: 800601, name: 'Discover TV One' }] : [{ id: 800602, name: 'Discover TV Two' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/tv/800101')) {
      return new Response(
        JSON.stringify({
          id: 800101,
          name: 'Dynamic Show Alpha',
          overview: 'A long-form parent series overview that must never be copied into episodes.',
          first_air_date: '2025-01-15',
          vote_average: 8.5,
          vote_count: 200,
          number_of_seasons: 1,
          seasons: [{ season_number: 1, episode_count: 4, name: 'Season 1', overview: 'Season 1 distinct summary text.' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/tv/800101/season/1')) {
      return new Response(
        JSON.stringify({
          season_number: 1,
          name: 'Season 1',
          overview: 'Season 1 distinct summary text.',
          episodes: [
            {
              id: 990001,
              season_number: 1,
              episode_number: 1,
              name: 'Genesis Spark',
              overview: 'The protagonists arrive at the hidden station and discover the encrypted signal.',
              air_date: '2025-01-15',
              vote_average: 8.4,
              vote_count: 55
            },
            {
              id: 990002,
              season_number: 1,
              episode_number: 2,
              name: 'Episode 2', // Generic title -> MUST BE EXCLUDED
              overview: 'Valid synopsis that should still fail because title is generic placeholder.',
              air_date: '2025-01-22'
            },
            {
              id: 990003,
              season_number: 1,
              episode_number: 3,
              name: 'Copied Overview',
              overview: 'A long-form parent series overview that must never be copied into episodes.', // Matches parent -> EXCLUDED
              air_date: '2025-01-29'
            },
            {
              id: 0, // Invalid ID=0 -> EXCLUDED
              season_number: 1,
              episode_number: 4,
              name: 'Missing ID Episode',
              overview: 'Episode missing a valid TMDB ID must fail verification.',
              air_date: '2025-02-05'
            }
          ]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/movie/700104')) {
      return new Response(
        JSON.stringify({
          id: 700104,
          title: 'Dynamic Movie Gamma',
          overview: 'Third-page TMDB movie rendered dynamically on request with full SEO metadata.',
          release_date: '2025-03-10',
          vote_average: 7.9,
          vote_count: 320,
          genres: [{ id: 878, name: 'Science Fiction' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/tv/800101/season/1/episode/1')) {
      return new Response(
        JSON.stringify({
          id: 990001,
          season_number: 1,
          episode_number: 1,
          name: 'Genesis Spark',
          overview: 'The protagonists arrive at the hidden station and discover the encrypted signal.',
          air_date: '2025-01-15',
          vote_average: 8.4,
          vote_count: 55
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/movie/709999')) {
      return new Response(
        JSON.stringify({
          id: 709999,
          title: 'Surviving Feed Film',
          overview: 'A brand new movie discovered from the single surviving TMDB feed during partial outage.',
          release_date: '2025-04-01',
          vote_average: 7.4,
          vote_count: 85,
          genres: [{ id: 28, name: 'Action' }]
        }),
        { status: 200 }
      );
    }

    if (pathname.endsWith('/tv/800102')) {
      return new Response(
        JSON.stringify({
          id: 800102,
          name: 'Dynamic Show Beta',
          overview: 'Second-page TMDB TV series verified via live hybrid SSR.',
          first_air_date: '2025-02-01',
          vote_average: 8.1,
          vote_count: 140,
          number_of_seasons: 1,
          seasons: [{ season_number: 1, episode_count: 8, name: 'Season 1' }]
        }),
        { status: 200 }
      );
    }

    return new Response(JSON.stringify({ results: [], total_pages: 1 }), { status: 200 });
  }) as typeof fetch;

  // 1-8. Discovery tests: pagination > 1, multi-feeds, TV/movie separation, deduplication, invalid rejection, episode rules, retries
  const discovery = await discoverTmdbCatalog({
    fetchImpl: mockTmdbFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 3,
    maxConcurrency: 3,
    maxRetries: 2,
    retryBaseDelayMs: 5,
    maxEpisodeShows: 5,
    maxEpisodeSeasonsPerShow: 2,
    seedTvShowIds: [800101]
  });

  // 1. Multi-page TMDB movie pagination (page 3 movie 700104 fetched!)
  assert(
    discovery.movies.some(m => m.id === 700104) &&
      discovery.stats.pagesFetchedByFeed['movie:trending_movie_week'] === 3 &&
      discovery.movies.some(m => m.id === 700202) &&
      discovery.movies.some(m => m.id === 700502) &&
      discovery.movies.some(m => m.id === 700602),
    '1. Multi-page TMDB movie pagination traverses pages 2..N across multiple feeds'
  );

  // 2. All movie feeds queried
  const expectedMovieFeeds = [
    'trending_movie_week',
    'trending_all_week',
    'movie_popular',
    'movie_top_rated',
    'movie_now_playing',
    'movie_upcoming',
    'discover_movie'
  ];
  assert(
    expectedMovieFeeds.every(f => discovery.stats.sourcesUsed.includes(f)) &&
      discovery.movies.some(m => m.id === 603) &&
      discovery.movies.some(m => m.id === 700302) &&
      discovery.movies.some(m => m.id === 700401),
    '2. All real TStream movie feeds contribute validated movies and reuse cached /trending/all/week'
  );
  assert(
    discovery.stats.cachedHits > 0,
    `Per-build request deduplication cache hit /trending/all/week cleanly (cachedHits=${discovery.stats.cachedHits})`
  );

  // 4. TV feed separation (movie IDs never appear in TV list & TV IDs never appear in movie list, person 500001 ignored)
  assert(
    discovery.tvShows.some(t => t.id === 94997) &&
      discovery.tvShows.some(t => t.id === 800102) &&
      discovery.tvShows.some(t => t.id === 800202) &&
      discovery.tvShows.some(t => t.id === 800501) &&
      discovery.tvShows.some(t => t.id === 800602) &&
      !discovery.tvShows.some(t => t.id === 157336 || t.id === 603 || t.id === 500001) &&
      !discovery.movies.some(m => m.id === 94997 || m.id === 800101 || m.id === 500001),
    '4. TMDB TV & movie inventories strictly separate mediaType entities and ignore person results'
  );

  // 5 & 7. Deduplication & invalid rejection
  assert(
    discovery.stats.duplicateMoviesRemoved >= 2 &&
      discovery.stats.invalidMoviesRejected >= 4 &&
      !discovery.movies.some(m => m.id <= 0 || !m.title || m.id === 28 || m.id === 700999),
    '5 & 7. Deduplicates cross-feed movie IDs cleanly and rejects 0/negative/adult/empty/Homecoming-28 records'
  );

  // 8. Episode validation
  assert(
    discovery.episodes.length === 1 &&
      discovery.episodes[0].showId === 800101 &&
      discovery.episodes[0].seasonNumber === 1 &&
      discovery.episodes[0].episodeNumber === 1 &&
      discovery.episodes[0].episodeName === 'Genesis Spark' &&
      discovery.stats.rejectedEpisodesCount === 3,
    '8. Episode discovery keeps genuine Genesis Spark and rejects generic, copied-overview, and ID=0 episodes'
  );

  // 12. Security check: API key never leaked into stats/errors
  const serializedStats = JSON.stringify(discovery.stats);
  assert(
    !serializedStats.includes('secret-test-tmdb-key-123'),
    '12. TMDB_API_KEY is never leaked into discovery stats or error messages'
  );

  // 3, 6, 9, 10, 14. Full sitemap generation with mock live TMDB + curated collections + canonical slugs
  const tmpSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tstream-sitemap-test-'));
  const pubDir = path.join(tmpSandbox, 'public');
  const distDir = path.join(tmpSandbox, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'assets', 'app.js'), 'console.log("ok")', 'utf8');
  fs.writeFileSync(path.join(distDir, 'index.html'), SAMPLE_HTML, 'utf8');
  fs.writeFileSync(path.join(distDir, 'server.mjs'), '// server', 'utf8');
  fs.writeFileSync(path.join(distDir, 'robots.txt'), 'User-agent: *\nSitemap: https://tstream.online/sitemap.xml\n', 'utf8');
  fs.writeFileSync(path.join(distDir, 'prerender-report.json'), '{}', 'utf8');

  const mockAniListFetch = (async () =>
    new Response(
      JSON.stringify({
        data: {
          Page: {
            pageInfo: { currentPage: 1, lastPage: 1, hasNextPage: false },
            media: [
              {
                id: 170001,
                idMal: 59001,
                format: 'TV',
                status: 'RELEASING',
                isAdult: false,
                episodes: 12,
                duration: 24,
                seasonYear: 2025,
                averageScore: 87,
                popularity: 120000,
                title: { english: 'Dynamic Anime Quest', romaji: 'Dynamic Anime Quest' },
                description: 'A dynamically discovered AniList series for sitemap and SSR parity.',
                genres: ['Action', 'Fantasy'],
                studios: { nodes: [{ id: 1, name: 'Bones', isAnimationStudio: true }] }
              },
              {
                id: 170002,
                idMal: 59002,
                format: 'MOVIE',
                status: 'FINISHED',
                isAdult: false,
                episodes: 1,
                duration: 110,
                seasonYear: 2025,
                averageScore: 84,
                popularity: 95000,
                title: { english: 'Dynamic Anime Movie', romaji: 'Dynamic Anime Movie' },
                description: 'A dynamically discovered AniList feature film.',
                genres: ['Sci-Fi', 'Drama'],
                studios: { nodes: [{ id: 2, name: 'Madhouse', isAnimationStudio: true }] }
              },
              {
                id: 170999,
                isAdult: true,
                format: 'TV',
                title: { english: 'Adult Anime Rejected' }
              }
            ]
          }
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch;

  const liveGen = await generateSitemaps(false, pubDir, distDir, {
    fetchImpl: mockTmdbFetch,
    animeFetchImpl: mockAniListFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 3,
    maxConcurrency: 3,
    maxRetries: 2,
    retryBaseDelayMs: 5,
    maxEpisodeShows: 15,
    maxEpisodeSeasonsPerShow: 2
  });

  assert(
    liveGen.moviesCount >= 350 &&
      liveGen.moviesXml.includes('https://tstream.online/movie/interstellar-157336') &&
      liveGen.moviesXml.includes('https://tstream.online/movie/avatar-19995') &&
      liveGen.moviesXml.includes('https://tstream.online/movie/dynamic-movie-gamma-700104') &&
      liveGen.tvXml.includes('https://tstream.online/tv/breaking-bad-1396') &&
      liveGen.tvXml.includes('https://tstream.online/tv/dynamic-show-alpha-800101') &&
      Boolean(liveGen.episodesXml?.includes('https://tstream.online/watch/tv/dynamic-show-alpha-800101/1/1')) &&
      liveGen.animeCount >= 16 &&
      Boolean(liveGen.animeXml?.includes('https://tstream.online/anime/attack-on-titan-16498')) &&
      Boolean(liveGen.animeXml?.includes('https://tstream.online/anime-movie/spirited-away-199')) &&
      Boolean(liveGen.animeXml?.includes('https://tstream.online/anime/dynamic-anime-quest-170001')) &&
      Boolean(liveGen.animeXml?.includes('https://tstream.online/anime-movie/dynamic-anime-movie-170002')) &&
      !liveGen.animeXml?.includes('adult-anime-rejected') &&
      liveGen.mainXml.includes('https://tstream.online/anime') &&
      liveGen.mainXml.includes('https://tstream.online/anime/genres/action'),
    '3 & 6. Sitemaps include curated 80 collections (Avatar 19995), homepage feeds, canonical slugs, expanded live movies/TV/episodes, and anime sitemap-anime.xml'
  );

  // 14. Authoritative routeInventory parity
  const inv = await getAuthoritativeRouteInventory({
    fetchImpl: mockTmdbFetch,
    animeFetchImpl: mockAniListFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 3,
    retryBaseDelayMs: 5,
    maxEpisodeShows: 15,
    maxEpisodeSeasonsPerShow: 2
  });
  assert(
    inv.movies.length === liveGen.moviesCount &&
      inv.tvShows.length === liveGen.tvCount &&
      inv.episodes.length === liveGen.episodesCount &&
      inv.anime.length === liveGen.animeCount,
    '14. Authoritative routeInventory counts (including anime) match generated sitemap URL counts 1:1'
  );

  // 11. Automatic Sitemap Splitting / Chunking & cleanup of old chunk files
  const splitGen = await generateSitemaps(false, pubDir, distDir, {
    fetchImpl: mockTmdbFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 2,
    retryBaseDelayMs: 5,
    maxUrlsPerFile: 50,
    skipEpisodeDiscovery: true
  });

  assert(
    splitGen.chunkFiles.movies.length >= 7 &&
      splitGen.chunkFiles.movies.includes('sitemap-movies.xml') &&
      splitGen.chunkFiles.movies.includes('sitemap-movies-2.xml') &&
      validateSitemapIndexXml(splitGen.sitemapIndexXml, splitGen.files).childFilenames.includes('sitemap-movies-2.xml') &&
      fs.existsSync(path.join(pubDir, 'sitemap-movies-2.xml')) &&
      fs.existsSync(path.join(distDir, 'sitemap-movies-2.xml')),
    '10 & 11. Oversized movie sitemap automatically splits into sitemap-movies-2.xml+ and updates sitemap.xml index cleanly'
  );

  // Verify run-build verifyDistArtifacts & verifyNoLeakedSecretsInDist handle chunked files cleanly
  const distCheck = verifyDistArtifacts(tmpSandbox);
  verifyNoLeakedSecretsInDist(tmpSandbox, 'secret-test-tmdb-key-123');
  assert(
    distCheck.files.includes('sitemap-movies-2.xml'),
    '14. Build artifact verifier dynamically validates chunked sitemap-movies-2.xml and zero leaked secrets'
  );

  // Verify byte-limit chunking helper as well
  const byteChunks = splitAndBuildUrlsetChunks(
    'sitemap-bytes',
    Array.from({ length: 20 }, (_, i) => ({ url: `https://tstream.online/movie/test-${i + 1}` })),
    50000,
    900
  );
  assert(
    byteChunks.length > 1 && byteChunks.every(c => Buffer.byteLength(c.xml, 'utf8') <= 900),
    '11. Sitemap chunker splits cleanly when byte threshold is reached'
  );

  // 12 & 13. Timeout + total TMDB outage preserves existing valid sitemaps on disk instead of overwriting!
  const beforeOutageIndex = fs.readFileSync(path.join(pubDir, 'sitemap.xml'), 'utf8');
  const beforeOutageMovies = fs.readFileSync(path.join(pubDir, 'sitemap-movies.xml'), 'utf8');

  const failingOutageFetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    // Abort / 503 failure simulation
    if (init?.signal) {
      return new Response('upstream down', { status: 503 });
    }
    return new Response('upstream down', { status: 503 });
  }) as typeof fetch;

  const outageResult = await generateSitemaps(false, pubDir, distDir, {
    fetchImpl: failingOutageFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 2,
    maxRetries: 1,
    retryBaseDelayMs: 5,
    preserveExistingOnTotalOutage: true
  });

  assert(
    outageResult.preservedExisting === true &&
      fs.readFileSync(path.join(pubDir, 'sitemap.xml'), 'utf8') === beforeOutageIndex &&
      fs.readFileSync(path.join(pubDir, 'sitemap-movies.xml'), 'utf8') === beforeOutageMovies,
    '13. Total live TMDB outage preserves healthy existing sitemaps instead of overwriting them'
  );

  // Verify timeout AbortError recovery when request stalls past timeout
  let timeoutCall = 0;
  const timeoutThenOkFetch = ((_input: string | URL | Request, init?: RequestInit) => {
    timeoutCall++;
    if (timeoutCall === 1) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const e: any = new Error('The operation was aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    }
    return Promise.resolve(new Response(JSON.stringify({ results: [], total_pages: 1 }), { status: 200 }));
  }) as typeof fetch;

  const timeoutRecovery = await discoverTmdbCatalog({
    fetchImpl: timeoutThenOkFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 1,
    requestTimeoutMs: 500,
    maxRetries: 1,
    retryBaseDelayMs: 5,
    skipEpisodeDiscovery: true
  });
  assert(
    timeoutRecovery.stats.successfulRequests > 0,
    '12. Timed-out request aborts cleanly and retries successfully'
  );

  // Verify offline fallback without TMDB key still generates valid curated sitemaps (350+ movies) and cleans stale chunks
  const offlineCleanup = await generateSitemaps(false, pubDir, distDir, {
    tmdbApiKey: '',
    skipEpisodeDiscovery: true
  });
  assert(
    offlineCleanup.preservedExisting === false &&
      offlineCleanup.moviesCount >= 350 &&
      !fs.existsSync(path.join(pubDir, 'sitemap-movies-2.xml')),
    '11 & 13. Offline curated fallback generates 350+ movies and cleans up stale chunk files cleanly'
  );

  // 15. Production SSR HTTP 200 verification for dynamically discovered page-3 movie & verified episode URLs
  const gammaMovieSsr = await renderSeoResult(SAMPLE_HTML, '/movie/dynamic-movie-gamma-700104', {
    fetchImpl: mockTmdbFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123'
  });
  const avatarCuratedSsr = await renderSeoResult(SAMPLE_HTML, '/movie/avatar-19995');
  const dynamicEpSsr = await renderSeoResult(SAMPLE_HTML, '/watch/tv/dynamic-show-alpha-800101/1/1', {
    fetchImpl: mockTmdbFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123'
  });

  assert(
    gammaMovieSsr.status === 200 &&
      !gammaMovieSsr.isNoindex &&
      gammaMovieSsr.canonicalUrl === 'https://tstream.online/movie/dynamic-movie-gamma-700104' &&
      gammaMovieSsr.html.includes('Dynamic Movie Gamma') &&
      avatarCuratedSsr.status === 200 &&
      !avatarCuratedSsr.isNoindex &&
      avatarCuratedSsr.canonicalUrl === 'https://tstream.online/movie/avatar-19995' &&
      dynamicEpSsr.status === 200 &&
      !dynamicEpSsr.isNoindex &&
      dynamicEpSsr.canonicalUrl === 'https://tstream.online/watch/tv/dynamic-show-alpha-800101/1/1' &&
      dynamicEpSsr.html.includes('Genesis Spark'),
    '15. Dynamically discovered sitemap URLs & curated collection movies resolve HTTP 200 with exact canonicals & metadata'
  );

  // 16. Partial TMDB Outage Protection: 1 feed succeeds while multiple feeds + TV + episodes fail
  const partialSnapshotPath = path.join(tmpSandbox, 'inventory-snapshot.json');
  const healthyBaseline = await generateSitemaps(false, pubDir, distDir, {
    fetchImpl: mockTmdbFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 3,
    maxConcurrency: 3,
    maxRetries: 1,
    retryBaseDelayMs: 5,
    maxEpisodeShows: 15,
    maxEpisodeSeasonsPerShow: 2,
    inventorySnapshotPath: partialSnapshotPath
  });

  const partialOutageFetch = (async (input: string | URL | Request) => {
    const pathname = new URL(String(input)).pathname;
    if (pathname.endsWith('/movie/popular')) {
      return new Response(
        JSON.stringify({
          page: 1,
          total_pages: 1,
          results: [
            { id: 709999, title: 'Surviving Feed Film', release_date: '2025-04-01' },
            { id: 700201, title: 'Popular Film One' }
          ]
        }),
        { status: 200 }
      );
    }
    return new Response('partial upstream failure', { status: 503 });
  }) as typeof fetch;

  const partialResult = await generateSitemaps(false, pubDir, distDir, {
    fetchImpl: partialOutageFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 2,
    maxRetries: 0,
    retryBaseDelayMs: 1,
    maxEpisodeShows: 5,
    maxEpisodeSeasonsPerShow: 1,
    inventorySnapshotPath: false
  });

  const diskMoviesAfterPartial = fs.readFileSync(path.join(pubDir, 'sitemap-movies.xml'), 'utf8');
  const diskTvAfterPartial = fs.readFileSync(path.join(pubDir, 'sitemap-tv.xml'), 'utf8');
  const diskEpisodesAfterPartial = fs.readFileSync(path.join(pubDir, 'sitemap-episodes.xml'), 'utf8');

  assert(
    partialResult.stats.hadTotalLiveOutage === false &&
      partialResult.stats.hadPartialOutage === true &&
      partialResult.stats.failedFeeds.length >= 6 &&
      partialResult.stats.succeededFeeds.includes('movie:movie_popular') &&
      partialResult.mergedFromPreviousOnPartialOutage === true &&
      partialResult.preservedUrlsAddedCount > 0 &&
      partialResult.moviesCount >= healthyBaseline.moviesCount &&
      diskMoviesAfterPartial.includes('https://tstream.online/movie/surviving-feed-film-709999') &&
      diskMoviesAfterPartial.includes('https://tstream.online/movie/dynamic-movie-gamma-700104') &&
      diskTvAfterPartial.includes('https://tstream.online/tv/dynamic-show-beta-800102') &&
      diskEpisodesAfterPartial.includes('https://tstream.online/watch/tv/dynamic-show-alpha-800101/1/1'),
    '16. Partial TMDB outage (1 live feed + multiple failed feeds) merges & preserves all healthy previous URLs plus new live URLs'
  );

  // 17. Prerender uses authoritative inventory + reuses fresh build snapshot (0 redundant TMDB calls) + Hybrid SSR accounting
  // Regenerate healthy baseline cleanly so dist & snapshot match full discovery
  const fullGen = await generateSitemaps(false, pubDir, distDir, {
    fetchImpl: mockTmdbFetch,
    animeFetchImpl: mockAniListFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    maxPagesPerFeed: 3,
    maxConcurrency: 3,
    maxRetries: 2,
    retryBaseDelayMs: 5,
    maxEpisodeShows: 15,
    maxEpisodeSeasonsPerShow: 2,
    inventorySnapshotPath: partialSnapshotPath
  });

  const loadedSnap = readFreshBuildInventorySnapshot(partialSnapshotPath);
  assert(
    loadedSnap !== null && !JSON.stringify(loadedSnap).includes('secret-test-tmdb-key-123'),
    '17a. Secret-free build inventory snapshot saved & readable with zero leaked TMDB_API_KEY'
  );

  const prerenderFetchUrls: string[] = [];
  const trackingPrerenderFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    prerenderFetchUrls.push(String(input));
    return mockTmdbFetch(input, init);
  }) as typeof fetch;

  const prerenderReport = await prerenderAll(distDir, {
    fetchImpl: trackingPrerenderFetch,
    tmdbApiKey: 'secret-test-tmdb-key-123',
    inventorySnapshotPath: partialSnapshotPath,
    maxDynamicMovies: 2,
    maxDynamicTv: 1,
    maxDynamicEpisodes: 1,
    maxDynamicAnime: 1
  });

  const redundantDiscoveryCalls = prerenderFetchUrls.filter(u =>
    /\/(trending\/movie\/week|trending\/tv\/week|movie\/now_playing|movie\/upcoming|tv\/on_the_air|tv\/airing_today)/.test(u) ||
    /[?&]page=[23]\b/.test(u)
  );
  const dynamicMoviesTotal = fullGen.moviesCount - prerenderReport.routes.filter(r => r.url.startsWith('/movie/') && r.success).length;
  assert(
    prerenderReport.inventorySource === 'getAuthoritativeRouteInventory' &&
      prerenderReport.usedBuildSnapshot === true &&
      redundantDiscoveryCalls.length === 0 &&
      prerenderReport.failed === 0 &&
      prerenderReport.authoritativeInventoryCounts.movies === fullGen.moviesCount &&
      prerenderReport.authoritativeInventoryCounts.tvShows === fullGen.tvCount &&
      prerenderReport.authoritativeInventoryCounts.episodes === fullGen.episodesCount &&
      prerenderReport.authoritativeInventoryCounts.anime === fullGen.animeCount &&
      prerenderReport.prerenderedCounts.dynamicMovies === 2 &&
      prerenderReport.prerenderedCounts.dynamicAnime === 1 &&
      prerenderReport.hybridSsrDynamicCounts.anime === 1 &&
      prerenderReport.hybridSsrDynamicCounts.movies > 0 &&
      dynamicMoviesTotal >= 0 &&
      fs.existsSync(path.join(distDir, 'anime/attack-on-titan-16498/index.html')) &&
      fs.existsSync(path.join(distDir, 'anime-movie/spirited-away-199/index.html')) &&
      fs.existsSync(path.join(distDir, 'prerender-report.json')),
    '17b. Prerender consumes shared authoritative inventory snapshot with 0 redundant discovery calls and documents Hybrid SSR counts including Anime'
  );

  // 18. Real Production-Style Live HTTP Server & XML Parse Verification (prerendered + non-prerendered dynamic routes)
  const xmlMoviesOnDisk = fs.readFileSync(path.join(distDir, 'sitemap-movies.xml'), 'utf8');
  const xmlTvOnDisk = fs.readFileSync(path.join(distDir, 'sitemap-tv.xml'), 'utf8');
  const xmlEpisodesOnDisk = fs.readFileSync(path.join(distDir, 'sitemap-episodes.xml'), 'utf8');
  const parsedMovieLocs = Array.from(xmlMoviesOnDisk.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
  const parsedTvLocs = Array.from(xmlTvOnDisk.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
  const parsedEpLocs = Array.from(xmlEpisodesOnDisk.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);

  // Verify real XML contains dynamic entries beyond curated set
  assert(
    parsedMovieLocs.includes('https://tstream.online/movie/dynamic-movie-gamma-700104') &&
      parsedTvLocs.includes('https://tstream.online/tv/dynamic-show-beta-800102') &&
      parsedEpLocs.includes('https://tstream.online/watch/tv/dynamic-show-alpha-800101/1/1'),
    '18a. Actual generated XML files contain dynamically discovered movie, TV, and episode URLs'
  );

  const testHttpServer = http.createServer(async (req, res) => {
    const reqUrl = req.url || '/';
    const pathname = new URL(reqUrl, 'http://127.0.0.1').pathname;
    if (pathname.endsWith('.xml')) {
      const f = path.join(distDir, pathname.replace(/^\/+/, ''));
      if (fs.existsSync(f)) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.end(fs.readFileSync(f, 'utf8'));
        return;
      }
    }
    const cleanRel = pathname.replace(/^\/+|\/+$/g, '');
    const prerenderFile = cleanRel ? path.join(distDir, cleanRel, 'index.html') : path.join(distDir, 'index.html');
    if (fs.existsSync(prerenderFile)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(prerenderFile, 'utf8'));
      return;
    }
    const seoRes = await renderSeoResult(SAMPLE_HTML, reqUrl, {
      fetchImpl: mockTmdbFetch,
      tmdbApiKey: 'secret-test-tmdb-key-123'
    });
    res.statusCode = seoRes.status;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(seoRes.html);
  });

  await new Promise<void>(resolve => testHttpServer.listen(0, '127.0.0.1', () => resolve()));
  const addr = testHttpServer.address();
  const serverPort = typeof addr === 'object' && addr ? addr.port : 0;
  const localOrigin = `http://127.0.0.1:${serverPort}`;

  try {
    // Check routes served over real HTTP (both prerendered & live Hybrid SSR routes from generated XML)
    const liveRoutesToCheck = [
      { path: '/movie/avatar-19995', expectedCan: 'https://tstream.online/movie/avatar-19995', expectedType: 'Movie' },
      { path: '/movie/dynamic-movie-gamma-700104', expectedCan: 'https://tstream.online/movie/dynamic-movie-gamma-700104', expectedType: 'Movie' },
      { path: '/tv/dynamic-show-beta-800102', expectedCan: 'https://tstream.online/tv/dynamic-show-beta-800102', expectedType: 'TVSeries' },
      { path: '/watch/tv/dynamic-show-alpha-800101/1/1', expectedCan: 'https://tstream.online/watch/tv/dynamic-show-alpha-800101/1/1', expectedType: 'TVEpisode' },
      { path: '/anime/attack-on-titan-16498', expectedCan: 'https://tstream.online/anime/attack-on-titan-16498', expectedType: 'TVSeries' },
      { path: '/anime-movie/spirited-away-199', expectedCan: 'https://tstream.online/anime-movie/spirited-away-199', expectedType: 'Movie' },
      { path: '/anime', expectedCan: 'https://tstream.online/anime', expectedType: 'CollectionPage' }
    ];

    // Assert gamma movie is NOT prerendered on disk (because maxDynamicMovies=2 excluded later pages), proving real Hybrid SSR!
    const gammaDiskPath = path.join(distDir, 'movie/dynamic-movie-gamma-700104/index.html');
    assert(!fs.existsSync(gammaDiskPath), '18b. Non-prerendered dynamic movie exercises live Hybrid SSR rather than disk cache');

    for (const check of liveRoutesToCheck) {
      const httpRes = await fetch(`${localOrigin}${check.path}`);
      const html = await httpRes.text();
      const canMatches = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi) || [];
      const canHref =
        html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] ||
        html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
        '';
      const robots = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
      const hasH1 = /<h1[^>]*>[\s\S]+?<\/h1>/i.test(html);
      const hasSeo = html.includes('id="seo-prerender"');
      const jsonLdMatch = html.match(/<script\s+[^>]*id=["']json-ld-schema["'][^>]*>([\s\S]*?)<\/script>/i);
      const jsonLd = jsonLdMatch ? JSON.parse(jsonLdMatch[1]) : null;
      assert(
        httpRes.status === 200 &&
          canMatches.length === 1 &&
          canHref === check.expectedCan &&
          !robots.toLowerCase().includes('noindex') &&
          hasH1 &&
          hasSeo &&
          jsonLd?.['@type'] === check.expectedType,
        `18c. Live HTTP ${check.path} -> 200, canonical=${canHref}, h1=${hasH1}, jsonLd=${jsonLd?.['@type']}`
      );
    }
  } finally {
    testHttpServer.closeAllConnections?.();
    await new Promise<void>(resolve => testHttpServer.close(() => resolve()));
  }

  // 9. Validation rejection sanity check for utility/noindex URLs
  let rejectedAdmin = false;
  try {
    validateSitemapXml(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://tstream.online/admin</loc></url>\n</urlset>',
      'bad-admin.xml'
    );
  } catch {
    rejectedAdmin = true;
  }
  assert(rejectedAdmin, '9. validateSitemapXml strictly rejects /admin or utility noindex URLs');

  fs.rmSync(tmpSandbox, { recursive: true, force: true });
  console.log('\n--- ALL 18 DYNAMIC SITEMAP, PARTIAL OUTAGE, PRERENDER & HYBRID SSR TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
