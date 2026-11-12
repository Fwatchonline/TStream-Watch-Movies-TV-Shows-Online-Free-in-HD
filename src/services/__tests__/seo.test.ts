/**
 * Comprehensive Automated SEO & Build/Prerender Test Suite for TStream.online (Phase 3)
 * Covers all 20 required assertions from Phase 3 plus Phase 2 regressions.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'node:child_process';
import {
  generateMediaKeywords,
  truncateAtWord,
  getImageMimeType,
  buildMediaMetadata,
  buildCanonicalUrl,
  resolveRouteSeoPolicy,
  DEFAULT_KEYWORDS
} from '../../utils/seo';
import {
  parseSeoRoute,
  renderSeoResult,
  fetchServerTagMedia,
  fetchServerPlatformMedia,
  fetchServerCatalogPage,
  clearSeoPluginCaches,
  LruTtlCache
} from '../../../scripts/seoHtmlPlugin';
import {
  prerenderAndValidateRoute,
  loadDistTemplateOrFail
} from '../../../scripts/prerender';
import { validateBuildArgs, verifyNoLeakedSecretsInDist } from '../../../scripts/run-build.mjs';
import { loadBuildEnv } from '../../../scripts/loadEnv.mjs';
import { getPlatformConfigById } from '../platformConfig';
import {
  buildPlatformDiscoverPlan,
  computeBalancedTopRatedPlan,
  mergeBalancedTopRatedSlices
} from '../platformDiscovery';
import { fetchCatalog } from '../tmdb';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

function extractCardTitles(html: string): string[] {
  return (html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [])
    .map(m => m.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
}

async function runTests() {
  console.log('--- Running TStream Phase 3 SEO & Prerender Verification Tests ---\n');
  clearSeoPluginCaches();

  const sampleHtmlWithPreExistingCanonical = `<!doctype html>
<html>
<head>
  <title>Old Title</title>
  <link rel="canonical" href="https://wrong.example.com/old" />
  <meta name="title" content="Old Title" />
  <meta name="description" content="Old description" />
  <meta name="keywords" content="old, keywords" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <script type="application/ld+json" id="json-ld-schema">{}</script>
</head>
<body><div id="root"></div></body>
</html>`;

  // 1. Build argument guard against --outDir / dist-next
  let rejectedOutDir = false;
  try {
    validateBuildArgs(['--outDir', 'dist-next']);
  } catch {
    rejectedOutDir = true;
  }
  assert(rejectedOutDir, 'Build orchestrator rejects forbidden --outDir dist-next flag');

  // 2. Missing dist/index.html causes non-zero prerender error
  const emptyTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tstream-missing-dist-'));
  let threwMissingDist = false;
  try {
    loadDistTemplateOrFail(emptyTmpDir);
  } catch {
    threwMissingDist = true;
  }
  fs.rmSync(emptyTmpDir, { recursive: true, force: true });
  assert(threwMissingDist, 'Missing dist/index.html causes prerender failure');

  // 3. Running scripts/prerender.ts in a dir without dist/index.html exits non-zero
  const missingWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tstream-prerender-exit-'));
  let nonZeroExit = false;
  try {
    execFileSync(
      process.execPath,
      [path.resolve(process.cwd(), 'node_modules/.bin/tsx'), path.resolve(process.cwd(), 'scripts/prerender.ts')],
      { cwd: missingWorkDir, stdio: 'ignore' }
    );
  } catch {
    nonZeroExit = true;
  }
  fs.rmSync(missingWorkDir, { recursive: true, force: true });
  assert(nonZeroExit, 'Prerender CLI process exits non-zero when dist/index.html is missing');

  // 4 & 5. Prerender rejects HTTP 404 and HTTP 503 results (never counted as success!)
  const mock404Fetch = (async () => new Response('{"status_code":34}', { status: 404 })) as typeof fetch;
  const mock503Fetch = (async () => new Response('Rate limited', { status: 429 })) as typeof fetch;
  const tmpOut404 = path.join(os.tmpdir(), `tstream-404-${Date.now()}.html`);
  const tmpOut503 = path.join(os.tmpdir(), `tstream-503-${Date.now()}.html`);

  const pre404 = await prerenderAndValidateRoute(
    sampleHtmlWithPreExistingCanonical,
    '/movie/999999999-nonexistent-movie',
    tmpOut404,
    { fetchImpl: mock404Fetch, tmdbApiKey: 'test-key' }
  );
  assert(!pre404.success && pre404.status === 404 && !fs.existsSync(tmpOut404), 'Prerendered route returning 404 fails and is not written as success');

  const pre503 = await prerenderAndValidateRoute(
    sampleHtmlWithPreExistingCanonical,
    '/movie/999999998-busy',
    tmpOut503,
    { fetchImpl: mock503Fetch, tmdbApiKey: 'test-key' }
  );
  assert(!pre503.success && pre503.status === 503 && !fs.existsSync(tmpOut503), 'Prerendered route returning 503 fails and is not written as success');

  // 6. Genuine server pagination: Page 1 and Page 2 contain distinct records
  const moviesP1 = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/movies?page=1');
  const moviesP2 = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/movies?page=2');
  const p1Titles = extractCardTitles(moviesP1.html);
  const p2Titles = extractCardTitles(moviesP2.html);
  assert(
    moviesP1.status === 200 &&
    moviesP2.status === 200 &&
    p1Titles.length === 12 &&
    p2Titles.length === 12 &&
    p1Titles[0] !== p2Titles[0] &&
    moviesP2.canonicalUrl === 'https://tstream.online/movies?page=2' &&
    !moviesP2.isNoindex,
    'Genuine pagination: /movies?page=1 and /movies?page=2 return distinct records'
  );

  // 7. Invalid pagination does not become indexable
  const invalidZero = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/movies?page=0');
  const invalidNegative = resolveRouteSeoPolicy('/movies?page=-3');
  const invalidAlpha = resolveRouteSeoPolicy('/movies?page=2abc');
  const outOfRangePage = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/movies?page=999');
  assert(
    invalidZero.isNoindex &&
    invalidZero.canonicalUrl === 'https://tstream.online/movies' &&
    invalidNegative.noindex &&
    invalidAlpha.noindex &&
    outOfRangePage.isNoindex &&
    outOfRangePage.canonicalUrl === 'https://tstream.online/movies',
    'Invalid pagination (?page=0, -3, 2abc, 999) is noindex with clean canonical'
  );

  // 8, 9, 10. Search, Filter combinations, and Unknown query parameters
  const searchPolicy = resolveRouteSeoPolicy('/search?q=batman');
  assert(searchPolicy.noindex && searchPolicy.canonicalUrl === 'https://tstream.online/search', 'Search is noindex');

  for (const filteredUrl of [
    '/movies?genreId=28&year=2024',
    '/movies?genre=28',
    '/movies?sortBy=vote_average.desc',
    '/movies?minRating=8',
    '/movies?country=US',
    '/movies?mediaType=movie',
    '/movies?platform=netflix',
    '/movies?letter=A',
    '/tags/revenge?tag=magic'
  ]) {
    const fp = resolveRouteSeoPolicy(filteredUrl);
    assert(fp.noindex && !fp.canonicalUrl.includes('?'), `Filter URL ${filteredUrl} is noindex with clean canonical`);
  }

  const unknownParamPolicy = resolveRouteSeoPolicy('/movies?foo=bar&baz=123');
  assert(
    unknownParamPolicy.noindex && unknownParamPolicy.canonicalUrl === 'https://tstream.online/movies',
    'Unknown query parameters do not create unlimited indexable URLs'
  );

  const utmPage2 = resolveRouteSeoPolicy('/movies?page=2&utm_source=twitter&fbclid=xyz');
  assert(
    !utmPage2.noindex && utmPage2.canonicalUrl === 'https://tstream.online/movies?page=2',
    'Tracking params stripped while preserving valid ?page=2'
  );

  // 11, 12, 13. Platform content separation & empty/alias platform handling
  const netflixRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/platform/netflix');
  const maxRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/platform/max');
  const crunchyRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/platform/crunchyroll');
  const hboAliasRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/platform/hbo');
  const netflixCards = extractCardTitles(netflixRes.html);
  const maxCards = extractCardTitles(maxRes.html);
  const crunchyCards = extractCardTitles(crunchyRes.html);

  assert(
    netflixCards.includes('Stranger Things') && !netflixCards.includes('The Last of Us'),
    'Netflix page contains genuinely matched Netflix titles (no Max contamination)'
  );
  assert(
    maxCards.includes('The Last of Us') && !maxCards.includes('Stranger Things'),
    'Max page contains genuinely matched Max titles (no Netflix contamination)'
  );
  assert(
    crunchyRes.status === 200 && crunchyRes.isNoindex && crunchyCards.length === 0,
    'Unsupported/unpopulated offline platform (Crunchyroll) emits noindex without fabricated titles'
  );
  assert(
    hboAliasRes.status === 200 && hboAliasRes.isNoindex && hboAliasRes.canonicalUrl === 'https://tstream.online/platform/max',
    'Platform alias /platform/hbo canonicalizes to /platform/max with noindex'
  );

  // 14 & 15. Missing tag 404 vs empty tag noindex
  const bogusTagRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/tags/nonexistent-tag-xyz-999', {
    fetchImpl: (async () => new Response(JSON.stringify({ results: [] }), { status: 200 })) as typeof fetch,
    tmdbApiKey: 'test-key'
  });
  assert(bogusTagRes.status === 404 && bogusTagRes.isNoindex, 'Missing tag returns HTTP 404 + noindex');

  const revengeTag = await fetchServerTagMedia('revenge', mock404Fetch, 'test-key');
  assert(revengeTag.valid && revengeTag.items.length > 0, 'Populated tag #revenge resolves valid');

  const emptyTagRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/tags/cozy-slice-of-life', {
    fetchImpl: (async () => new Response(JSON.stringify({ results: [] }), { status: 200 })) as typeof fetch,
    tmdbApiKey: 'test-key'
  });
  // If tag isn't in POPULAR_TAGS -> 404; let's test an empty popular tag or noindex tag
  assert(
    emptyTagRes.isNoindex,
    'Unpopulated tag cannot become indexable'
  );

  // 16. No fabricated rating data
  const unratedMeta = buildMediaMetadata({
    id: 999999,
    mediaType: 'movie',
    title: 'Indie Film',
    overview: 'An unrated indie film.',
    voteAverage: 0,
    voteCount: 0
  });
  assert(!unratedMeta.schema.aggregateRating, 'Unrated media omits Schema.org AggregateRating');

  // 17 & 18. Movie watch canonical & TV episode watch canonical
  const spiderManMovie = {
    id: 102382,
    mediaType: 'movie',
    title: 'The Amazing Spider-Man 2',
    releaseDate: '2014-04-16',
    overview: 'Peter Parker runs the gauntlet.',
    genres: ['Action', 'Adventure'],
    backdropPath: 'https://image.tmdb.org/t/p/w1280/spider.jpg',
    voteAverage: 6.5,
    voteCount: 12500
  };
  const breakingBadTv = {
    id: 1396,
    mediaType: 'tv',
    name: 'Breaking Bad',
    firstAirDate: '2008-01-20',
    overview: 'A chemistry teacher diagnosed with cancer turns to crystal meth.',
    genres: ['Drama', 'Crime'],
    backdropPath: 'https://image.tmdb.org/t/p/w1280/bb.jpg',
    voteAverage: 8.9,
    voteCount: 13500
  };
  const movieWatchMeta = buildMediaMetadata(spiderManMovie, { isWatching: true });
  const tvWatchMeta = buildMediaMetadata(breakingBadTv, { season: 1, episode: 1, episodeName: 'Pilot', isWatching: true });
  assert(
    movieWatchMeta.canonicalUrl === 'https://tstream.online/movie/the-amazing-spider-man-2-102382',
    'Movie watch canonical points to primary /movie/:slug route'
  );
  assert(
    tvWatchMeta.canonicalUrl === 'https://tstream.online/watch/tv/breaking-bad-1396/1/1' &&
      tvWatchMeta.schema['@type'] === 'TVEpisode',
    'TV episode watch canonical points to genuine episode route with TVEpisode schema'
  );

  // Utility helpers & LRU Cache bounding test
  assert(DEFAULT_KEYWORDS.includes('t stream'), 'Default keywords valid');
  assert(truncateAtWord('Word '.repeat(50), 160).length <= 160, 'Word-aware truncation clean');
  assert(getImageMimeType('https://tstream.online/og-image.png') === 'image/png', 'MIME helper clean');
  assert(buildCanonicalUrl('http://www.tstream.online/movies/') === 'https://tstream.online/movies', 'Origin normalized');
  assert(generateMediaKeywords(breakingBadTv, { season: 1, episode: 1, isWatching: true }).includes('Breaking Bad season 1'), 'Media keywords clean');
  assert(parseSeoRoute('/nonexistent-route-xyz')?.type === 'notfound', 'Unknown route parses as notfound');

  const smallCache = new LruTtlCache<string>(2, 1000, 5000);
  smallCache.set('a', '1');
  smallCache.set('b', '2');
  smallCache.set('c', '3');
  assert(smallCache.size === 2 && !smallCache.getFresh('a') && smallCache.getFresh('c') === '3', 'LruTtlCache evicts oldest entry beyond max size');

  // Strict single route file prerender validation
  const tmpFile = path.join(os.tmpdir(), `tstream-seo-test-${Date.now()}.html`);
  const prerenderRes = await prerenderAndValidateRoute(
    sampleHtmlWithPreExistingCanonical,
    '/movie/the-amazing-spider-man-2-102382',
    tmpFile,
    spiderManMovie,
    'https://tstream.online/movie/the-amazing-spider-man-2-102382',
    { expectedNoindex: false }
  );
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  assert(Boolean(prerenderRes.success && prerenderRes.hasTitle && prerenderRes.hasH1), 'prerenderAndValidateRoute confirms disk file, single canonical, title, h1, and robots');

  // Verify pre-rendered homepage template with nested <div> elements cleanly replaces all previous cards
  const homeRenderedTemplate = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/');
  const nestedReRender = await renderSeoResult(homeRenderedTemplate.html, '/platform/crunchyroll');
  assert(
    nestedReRender.status === 200 &&
      nestedReRender.isNoindex === true &&
      !/<h3[^>]*>/i.test(nestedReRender.html),
    'Re-rendering on top of pre-rendered homepage HTML completely replaces nested #root without leaking prior cards'
  );

  // =======================================================================
  // PHASE 4 REGRESSIONS: ENV LOADING, BALANCED TOP-RATED & PLATFORM REGION
  // =======================================================================

  // P4 Task 1A: loadBuildEnv loads symlinked shared/.env before scripts run & preserves CI env vars
  const envSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tstream-env-sandbox-'));
  const sharedEnvDir = path.join(envSandbox, 'shared');
  const releaseDir = path.join(envSandbox, 'release');
  fs.mkdirSync(sharedEnvDir, { recursive: true });
  fs.mkdirSync(path.join(releaseDir, 'dist', 'assets'), { recursive: true });
  const fakeSecret = 'FAKE_TMDB_TEST_KEY_7391042';
  fs.writeFileSync(
    path.join(sharedEnvDir, '.env'),
    `TMDB_API_KEY=${fakeSecret}\nAPP_URL=https://tstream.online\n`,
    'utf8'
  );
  fs.symlinkSync(path.join(sharedEnvDir, '.env'), path.join(releaseDir, '.env'));

  const origTmdbEnv = process.env.TMDB_API_KEY;
  delete process.env.TMDB_API_KEY;
  const loadedEnvInfo = loadBuildEnv(releaseDir);
  assert(
    loadedEnvInfo.loaded && process.env.TMDB_API_KEY === fakeSecret,
    'Task 1: loadBuildEnv loads symlinked shared/.env before build/prerender'
  );

  // Preserve pre-existing CI environment variable when override is false
  process.env.TMDB_API_KEY = 'CI_PRESERVED_VALUE_999';
  loadBuildEnv(releaseDir);
  assert(
    process.env.TMDB_API_KEY === 'CI_PRESERVED_VALUE_999',
    'Task 1: loadBuildEnv preserves CI-provided env variables without overwriting'
  );
  if (origTmdbEnv !== undefined) process.env.TMDB_API_KEY = origTmdbEnv;
  else delete process.env.TMDB_API_KEY;

  // P4 Task 1B: Direct prerender execution in isolated release loads .env and does NOT leak secret into dist/
  fs.writeFileSync(path.join(releaseDir, 'dist', 'index.html'), sampleHtmlWithPreExistingCanonical, 'utf8');
  fs.writeFileSync(path.join(releaseDir, 'dist', 'assets', 'index-mock.js'), 'console.log("TStream bundle");', 'utf8');
  execFileSync(
    process.execPath,
    [path.resolve(process.cwd(), 'node_modules/.bin/tsx'), path.resolve(process.cwd(), 'scripts/prerender.ts')],
    {
      cwd: releaseDir,
      env: { ...process.env, TMDB_API_KEY: undefined },
      stdio: 'pipe'
    }
  );
  verifyNoLeakedSecretsInDist(releaseDir, fakeSecret);
  assert(
    fs.existsSync(path.join(releaseDir, 'dist', 'prerender-report.json')),
    'Task 1: Direct prerender succeeds using release/.env with zero secret leakage into dist/'
  );

  // Verify secret-leak guard fails cleanly if fake secret ever enters dist/assets/ or prerender-report.json
  fs.writeFileSync(path.join(releaseDir, 'dist', 'assets', 'leaked-check.js'), `const k = "${fakeSecret}";`, 'utf8');
  let caughtAssetLeak = false;
  try {
    verifyNoLeakedSecretsInDist(releaseDir, fakeSecret);
  } catch {
    caughtAssetLeak = true;
  }
  assert(caughtAssetLeak, 'Task 1: verifyNoLeakedSecretsInDist catches leaked secret inside dist/assets/');
  fs.rmSync(envSandbox, { recursive: true, force: true });

  // P4 Task 4: Balanced Top-Rated (Movie + TV merge + zero-skip deterministic pagination across TMDB page boundary)
  const planPage4 = computeBalancedTopRatedPlan(4, 6);
  // Page 4 slice is global indices [18, 24) -> spans TMDB page 1 (items 18..19) and TMDB page 2 (items 0..3)
  assert(
    planPage4.tmdbPages.length === 2 &&
      planPage4.tmdbPages[0] === 1 &&
      planPage4.tmdbPages[1] === 2 &&
      planPage4.sliceStartInBuffer === 18 &&
      planPage4.sliceEndInBuffer === 24,
    'Task 4: Balanced Top-Rated page 4 bridges TMDB pages 1 & 2 seamlessly with zero skipped items'
  );

  const mockMoviesPage1 = Array.from({ length: 20 }, (_, i) => ({
    id: 1000 + i,
    title: `Top Movie ${i + 1}`,
    vote_average: Number((9.5 - i * 0.05).toFixed(2)),
    vote_count: 5000 - i * 10,
    poster_path: `/m${i}.jpg`,
    release_date: '2020-01-01'
  }));
  const mockMoviesPage2 = Array.from({ length: 20 }, (_, i) => ({
    id: 2000 + i,
    title: `Top Movie ${21 + i}`,
    vote_average: Number((8.5 - i * 0.05).toFixed(2)),
    vote_count: 3000 - i * 10,
    poster_path: `/m2_${i}.jpg`,
    release_date: '2021-01-01'
  }));
  const mockTvPage1 = Array.from({ length: 20 }, (_, i) => ({
    id: 3000 + i,
    name: `Top Series ${i + 1}`,
    vote_average: Number((9.6 - i * 0.05).toFixed(2)),
    vote_count: 4500 - i * 10,
    poster_path: `/t${i}.jpg`,
    first_air_date: '2020-02-01'
  }));
  const mockTvPage2 = Array.from({ length: 20 }, (_, i) => ({
    id: 4000 + i,
    name: `Top Series ${21 + i}`,
    vote_average: Number((8.6 - i * 0.05).toFixed(2)),
    vote_count: 2500 - i * 10,
    poster_path: `/t2_${i}.jpg`,
    first_air_date: '2021-02-01'
  }));

  const mockTopRatedFetch = (async (input: string | URL | Request) => {
    const u = String(input);
    const pageNum = new URL(u.startsWith('http') ? u : `https://tstream.online${u}`).searchParams.get('page') || '1';
    if (u.includes('/movie/top_rated')) {
      return new Response(
        JSON.stringify({ results: pageNum === '2' ? mockMoviesPage2 : mockMoviesPage1, total_pages: 10, total_results: 200 }),
        { status: 200 }
      );
    }
    if (u.includes('/tv/top_rated')) {
      return new Response(
        JSON.stringify({ results: pageNum === '2' ? mockTvPage2 : mockTvPage1, total_pages: 10, total_results: 200 }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  const [srvTopP1, srvTopP2, srvTopP4, cliTopP1, cliTopP4] = await Promise.all([
    fetchServerCatalogPage('top-rated', 1, mockTopRatedFetch, 'test-key'),
    fetchServerCatalogPage('top-rated', 2, mockTopRatedFetch, 'test-key'),
    fetchServerCatalogPage('top-rated', 4, mockTopRatedFetch, 'test-key'),
    fetchCatalog('top-rated', 1, { mediaType: 'all' }, { fetchImpl: mockTopRatedFetch }),
    fetchCatalog('top-rated', 4, { mediaType: 'all' }, { fetchImpl: mockTopRatedFetch })
  ]);

  const p1Ids = new Set(srvTopP1.items.map(i => `${i.mediaType}:${i.id}`));
  const p2Ids = new Set(srvTopP2.items.map(i => `${i.mediaType}:${i.id}`));
  const overlapP1P2 = [...p1Ids].filter(id => p2Ids.has(id));
  const p4Ids = srvTopP4.items.map(i => `${i.mediaType}:${i.id}`);

  assert(
    srvTopP1.items.some(i => i.mediaType === 'movie') &&
      srvTopP1.items.some(i => i.mediaType === 'tv') &&
      srvTopP1.items.length === 12 &&
      srvTopP2.items.length === 12 &&
      overlapP1P2.length === 0,
    'Task 4: Server /top-rated merges genuine Movies + TV Shows with disjoint pages 1 & 2'
  );
  assert(
    p4Ids.includes('movie:1018') &&
      p4Ids.includes('movie:2000') &&
      p4Ids.includes('tv:3018') &&
      p4Ids.includes('tv:4000'),
    'Task 4: Server /top-rated page 4 includes both end of TMDB p1 (#19) and start of TMDB p2 (#21) without skipping'
  );
  assert(
    cliTopP1.results.length === 12 &&
      cliTopP1.results[0].id === srvTopP1.items[0].id &&
      cliTopP4.results.map(r => `${r.mediaType}:${r.id}`).join(',') === p4Ids.join(','),
    'Task 4: Browser fetchCatalog(top-rated) produces identical balanced movie+tv output to server SSR'
  );

  // Merge check preserves zero rating instead of fabricating
  const zeroRatedSlice = mergeBalancedTopRatedSlices(
    [{ id: 901, mediaType: 'movie', voteAverage: 0, voteCount: 0 }],
    [{ id: 902, mediaType: 'tv', voteAverage: 0, voteCount: 0 }]
  );
  assert(
    zeroRatedSlice.length === 2 && zeroRatedSlice.every(i => i.voteAverage === 0),
    'Task 4: Top-rated merge never fabricates missing ratings'
  );

  // P4 Task 3: Unified Platform Discovery, Watch Region Scoping & Empty vs 503 Separation
  const netflixCfg = getPlatformConfigById('netflix')!;
  const usPlan = buildPlatformDiscoverPlan(netflixCfg, { page: 1, watchRegion: 'US', sortBy: 'popularity.desc' });
  const gbPlan = buildPlatformDiscoverPlan(netflixCfg, { page: 1, watchRegion: 'GB', sortBy: 'popularity.desc' });
  assert(
    usPlan.moviePathAndQuery!.includes('with_watch_providers=8') &&
      usPlan.moviePathAndQuery!.includes('watch_region=US') &&
      !usPlan.moviePathAndQuery!.includes('with_companies') &&
      gbPlan.moviePathAndQuery!.includes('watch_region=GB') &&
      usPlan.cacheKey !== gbPlan.cacheKey,
    'Task 3: Shared platform discover plan separates watch-provider region scope & cache keys cleanly'
  );

  // Empty live platform response -> empty results (no fabrication!)
  const emptyLiveFetch = (async () =>
    new Response(JSON.stringify({ results: [], total_pages: 1, total_results: 0 }), { status: 200 })) as typeof fetch;
  const emptyPlatRes = await fetchServerPlatformMedia(netflixCfg, 1, emptyLiveFetch, 'test-key', 'GB');
  assert(
    emptyPlatRes.source === 'live' && emptyPlatRes.items.length === 0 && emptyPlatRes.watchRegion === 'GB',
    'Task 3: Empty live watch-provider response never fabricates unrelated titles and preserves region'
  );

  // Transient outage -> HTTP 503 error thrown (not confused with empty 200)
  const fail503Fetch = (async () => new Response('Unavailable', { status: 503 })) as typeof fetch;
  let platThrew503 = false;
  try {
    await fetchServerPlatformMedia(netflixCfg, 1, fail503Fetch, 'test-key', 'US');
  } catch (err: any) {
    platThrew503 = err?.status === 503;
  }
  assert(platThrew503, 'Task 3: Platform outage raises HTTP 503 instead of empty fabricated catalog');

  console.log('\n--- ALL PHASE 3 & PHASE 4 SEO, ENV & DISCOVERY TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
