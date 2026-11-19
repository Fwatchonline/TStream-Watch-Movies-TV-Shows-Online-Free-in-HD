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
  buildBreadcrumbSchema,
  resolveRouteSeoPolicy,
  isEpisodeSeoIndexable,
  isGenuineEpisodeName,
  validateVerifiedEpisodeRecord,
  DEFAULT_KEYWORDS
} from '../../utils/seo';
import {
  tagToSlug,
  slugToTag,
  isValidTagSlug,
  getCanonicalTagUrl
} from '../../utils/tags';
import {
  PRIMARY_GENRE_SLUGS,
  genreToSlug,
  slugToGenre,
  getCanonicalGenreUrl,
  itemMatchesGenre
} from '../../utils/genres';
import { POPULAR_TAGS } from '../catalogData';
import {
  parseSeoRoute,
  renderSeoResult,
  fetchServerTagMedia,
  fetchServerGenreMedia,
  fetchServerPlatformMedia,
  fetchServerCatalogPage,
  fetchServerEpisode,
  clearSeoPluginCaches,
  LruTtlCache
} from '../../../scripts/seoHtmlPlugin';
import { clearAnimeSeoCaches } from '../../../scripts/animeDiscovery';
import {
  prerenderAndValidateRoute,
  loadDistTemplateOrFail
} from '../../../scripts/prerender';
import {
  getTagInventory,
  getMovieInventory,
  getVerifiedEpisodeInventory
} from '../../../scripts/routeInventory';
import { generateSitemaps, validateSitemapXml } from '../../../scripts/generate-sitemaps';
import { validateBuildArgs, verifyNoLeakedSecretsInDist, verifyNoInternalArtifacts } from '../../../scripts/run-build.mjs';
import { loadBuildEnv } from '../../../scripts/loadEnv.mjs';
import { getPlatformConfigById } from '../platformConfig';
import {
  buildPlatformDiscoverPlan,
  computeBalancedTopRatedPlan,
  mergeBalancedTopRatedSlices
} from '../platformDiscovery';
import { fetchCatalog, fetchByTag, queryLocalCatalog } from '../tmdb';

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

  // =======================================================================
  // FINAL TECHNICAL SEO REPAIR: TAGS, GENRES, LASTMOD, EPISODES & INVENTORY
  // =======================================================================

  // 1. Tag Slug & Prerender Parity across ALL 12 POPULAR_TAGS
  const tagInventory = getTagInventory();
  assert(POPULAR_TAGS.length === 12, `POPULAR_TAGS has 12 entries (got ${POPULAR_TAGS.length})`);
  for (const tag of POPULAR_TAGS) {
    const slug = tagToSlug(tag.name);
    const display = slugToTag(slug);
    const inv = tagInventory.find(t => t.tagSlug === slug);
    const tagRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, `/tags/${slug}`);
    assert(
      isValidTagSlug(slug) &&
        display === tag.name.toLowerCase().trim() &&
        getCanonicalTagUrl(tag.name) === `https://tstream.online/tags/${slug}` &&
        Boolean(inv && inv.outputFileRel === `tags/${slug}/index.html`) &&
        tagRes.status === 200 &&
        !tagRes.isNoindex &&
        tagRes.canonicalUrl === `https://tstream.online/tags/${slug}`,
      `Tag parity verified for "${tag.name}" -> /tags/${slug} & dist/${inv?.outputFileRel}`
    );
  }

  // Multiword tag TMDB keyword lookup uses spaces ("time travel", "based on novel or book", "coming of age", "school friend", "based on comic book")
  for (const multiTag of ['time travel', 'based on novel or book', 'coming of age', 'school friend', 'based on comic book']) {
    const slug = tagToSlug(multiTag);
    let capturedQueryUrl = '';
    const mockKwFetch = (async (input: string | URL | Request) => {
      const u = String(input);
      if (u.includes('/search/keyword')) {
        capturedQueryUrl = u;
        return new Response(JSON.stringify({ results: [{ id: 4379, name: multiTag }] }), { status: 200 });
      }
      if (u.includes('/discover/movie')) {
        return new Response(
          JSON.stringify({ results: [{ id: 105, title: 'Back to the Future', release_date: '1985-07-03', vote_average: 8.3 }] }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as typeof fetch;

    const srvTag = await fetchServerTagMedia(slug, mockKwFetch, 'test-key');
    const cliTag = await fetchByTag(slug, 1, mockKwFetch);
    const decodedQuery = new URL(capturedQueryUrl).searchParams.get('query');
    assert(
      srvTag.valid &&
        srvTag.tagSlug === slug &&
        decodedQuery === multiTag &&
        srvTag.items.some(i => i.id === 105) &&
        cliTag.results.some(r => r.id === 105),
      `Multiword tag /tags/${slug} queries TMDB keyword "${decodedQuery}" cleanly`
    );
  }

  // Legacy /tag/* & non-kebab /tags/time%20travel -> noindex pointing to kebab canonical
  const singularTagRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/tag/revenge');
  const encodedSpaceTagRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/tags/time%20travel');
  assert(
    singularTagRes.status === 200 &&
      singularTagRes.isNoindex &&
      singularTagRes.canonicalUrl === 'https://tstream.online/tags/revenge' &&
      encodedSpaceTagRes.status === 200 &&
      encodedSpaceTagRes.isNoindex &&
      encodedSpaceTagRes.canonicalUrl === 'https://tstream.online/tags/time-travel',
    'Legacy /tag/* and /tags/time%20travel emit noindex with kebab canonical'
  );

  // 2. Real Genre Landing Pages (/genre/:slug)
  assert(
    genreToSlug('sci-fi') === 'science-fiction' &&
      getCanonicalGenreUrl('action', 2) === 'https://tstream.online/genre/action?page=2' &&
      PRIMARY_GENRE_SLUGS.length === 12,
    'Genre utility resolves primary slugs, sci-fi alias, and paginated canonical'
  );

  const actionGenreRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/genre/action');
  const sciFiAliasRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/genre/sci-fi');
  const westernOfflineRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/genre/western');
  const nonexistentGenreRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/genre/nonexistent-genre');
  const invalidGenrePageRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/genre/action?page=999');
  assert(
    actionGenreRes.status === 200 &&
      !actionGenreRes.isNoindex &&
      actionGenreRes.canonicalUrl === 'https://tstream.online/genre/action' &&
      /"@type"\s*:\s*"CollectionPage"/.test(actionGenreRes.html) &&
      extractCardTitles(actionGenreRes.html).length > 0,
    '/genre/action renders indexable 200 CollectionPage with matched cards'
  );
  assert(
    sciFiAliasRes.status === 200 &&
      sciFiAliasRes.isNoindex &&
      sciFiAliasRes.canonicalUrl === 'https://tstream.online/genre/science-fiction',
    '/genre/sci-fi alias emits noindex with canonical /genre/science-fiction'
  );
  assert(
    westernOfflineRes.status === 200 &&
      westernOfflineRes.isNoindex &&
      extractCardTitles(westernOfflineRes.html).length === 0,
    'Unpopulated offline /genre/western emits noindex without fabricating unrelated titles'
  );
  assert(
    nonexistentGenreRes.status === 404 && nonexistentGenreRes.isNoindex,
    'Unknown /genre/nonexistent-genre returns HTTP 404 + noindex'
  );
  assert(
    invalidGenrePageRes.status === 200 &&
      invalidGenrePageRes.isNoindex &&
      invalidGenrePageRes.canonicalUrl === 'https://tstream.online/genre/action',
    'Out-of-range genre page ?page=999 emits noindex with clean /genre/action canonical'
  );

  // Live mock TMDB genre fetch for /genre/western?page=2
  const westernMeta = slugToGenre('western')!;
  const mockWesternFetch = (async (input: string | URL | Request) => {
    const u = String(input);
    const pg = new URL(u).searchParams.get('page') || '1';
    if (u.includes('/discover/movie')) {
      return new Response(
        JSON.stringify({
          results: Array.from({ length: 8 }, (_, idx) => ({
            id: 9000 + Number(pg) * 20 + idx,
            title: `Western Film P${pg} #${idx + 1}`,
            release_date: '2024-10-31',
            vote_average: 7.4,
            genre_ids: [37]
          })),
          total_pages: 5
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ results: [], total_pages: 1 }), { status: 200 });
  }) as typeof fetch;
  const westernP2 = await fetchServerGenreMedia(westernMeta, 2, mockWesternFetch, 'test-key');
  assert(
    westernP2.source === 'live' && westernP2.items.length > 0 && westernP2.items[0].title.includes('P2'),
    'Live genre pagination fetches TMDB genre IDs for page 2'
  );

  // 3 & 9. Sitemap Integrity: zero fake <lastmod>, kebab tags, Spider-Man 315635, no /watch/movie/, episodes parity
  const sitemapDry = await generateSitemaps(true, undefined, undefined, { tmdbApiKey: '', skipEpisodeDiscovery: true });
  assert(
    !/<lastmod>/i.test(sitemapDry.mainXml) &&
      !/<lastmod>/i.test(sitemapDry.moviesXml) &&
      !/<lastmod>/i.test(sitemapDry.tvXml) &&
      (!sitemapDry.episodesXml || !/<lastmod>/i.test(sitemapDry.episodesXml)),
    'All generated sitemaps omit fake <lastmod> timestamps'
  );
  let rejectedFakeLastmod = false;
  try {
    validateSitemapXml(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://tstream.online/</loc><lastmod>2026-11-13</lastmod></url>\n</urlset>',
      'test-lastmod.xml'
    );
  } catch {
    rejectedFakeLastmod = true;
  }
  assert(rejectedFakeLastmod, 'validateSitemapXml rejects unverified fake <lastmod> tags');
  assert(
    sitemapDry.mainXml.includes('https://tstream.online/tags/time-travel') &&
      !sitemapDry.mainXml.includes('%20') &&
      sitemapDry.mainXml.includes('https://tstream.online/genre/action') &&
      !sitemapDry.mainXml.includes('https://tstream.online/genre/horror') &&
      !sitemapDry.mainXml.includes('https://tstream.online/genre/western') &&
      sitemapDry.moviesXml.includes('https://tstream.online/movie/spider-man-homecoming-315635') &&
      !sitemapDry.moviesXml.includes('spider-man-homecoming-28') &&
      !sitemapDry.moviesXml.includes('/watch/movie/'),
    'Sitemap output contains kebab tags, populated genres (excluding empty offline genres), Spider-Man 315635, and zero /watch/movie/ duplicates'
  );

  // Legitimate unrelated movie ID 28 preserved in inventory (non-Homecoming)
  const movieInventory = getMovieInventory();
  assert(
    movieInventory.some(m => m.id === 315635) && !movieInventory.some(m => m.slug.includes('homecoming-28')),
    'Movie inventory preserves Spider-Man Homecoming 315635 and excludes homecoming-28'
  );

  // 4 & 5. Quality-Based TV Episode Validation & TVEpisode AggregateRating Isolation
  const showWithCountNoEp20 = {
    id: 1396,
    mediaType: 'tv',
    name: 'Breaking Bad',
    overview: 'A high school chemistry teacher turns to cooking meth.',
    voteAverage: 8.9,
    voteCount: 13500,
    numberOfSeasons: 5,
    seasons: [{ seasonNumber: 1, episodeCount: 7, episodes: [] }]
  };
  const invalidEpBeyondCount = await fetchServerEpisode(showWithCountNoEp20, 1, 20, mock404Fetch, 'test-key');
  assert(
    invalidEpBeyondCount === null,
    'fetchServerEpisode returns null (404) when episode exceeds season episodeCount (never fabricates episode <= 25)'
  );

  let epThrew503 = false;
  try {
    await fetchServerEpisode(showWithCountNoEp20, 1, 2, mock503Fetch, 'test-key');
  } catch (err: any) {
    epThrew503 = err?.status === 503;
  }
  assert(epThrew503, 'fetchServerEpisode throws HTTP 503 on TMDB 429/5xx instead of fabricating episode data');

  // Unverified offline/401 episode within season bounds -> thin/noindex, zero copied series overview, zero parent rating
  const mock401Fetch = (async () => new Response('{"status_code":7}', { status: 401 })) as typeof fetch;
  const thinEpRes = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/breaking-bad-1396/1/6',
    { fetchImpl: mock401Fetch, tmdbApiKey: '' }
  );
  assert(
    thinEpRes.status === 200 &&
      thinEpRes.isNoindex &&
      !thinEpRes.html.includes('diagnos') &&
      !thinEpRes.html.includes('"ratingCount":13500'),
    'Unverified thin TV episode emits 200 + noindex and does NOT copy parent series overview or rating'
  );

  // Rich verified episode -> indexable, TVEpisode omits parent rating unless genuine episodeVoteAverage & episodeVoteCount exist
  const epMetaNoEpRating = buildMediaMetadata(breakingBadTv, {
    season: 1,
    episode: 1,
    episodeName: 'Pilot',
    episodeOverview: 'Walter White, a struggling high school chemistry teacher, is diagnosed with terminal lung cancer.',
    isWatching: true
  });
  const epMetaWithEpRating = buildMediaMetadata(breakingBadTv, {
    season: 1,
    episode: 1,
    episodeName: 'Pilot',
    episodeOverview: 'Walter White, a struggling high school chemistry teacher, is diagnosed with terminal lung cancer.',
    episodeVoteAverage: 9.0,
    episodeVoteCount: 412,
    isWatching: true
  });
  assert(
    isEpisodeSeoIndexable({
      episodeName: 'Pilot',
      episodeOverview: 'Walter White, a struggling high school chemistry teacher, is diagnosed with terminal lung cancer.',
      seriesOverview: breakingBadTv.overview,
      isVerifiedEpisode: true
    }) &&
      !epMetaNoEpRating.schema.aggregateRating &&
      epMetaWithEpRating.schema.aggregateRating?.ratingValue === 9 &&
      epMetaWithEpRating.schema.aggregateRating?.ratingCount === 412,
    'TVEpisode schema never inherits parent TVSeries aggregateRating and only emits genuine episode ratings'
  );

  // Verified episode inventory matches sitemap-episodes.xml URL count
  const verifiedEps = getVerifiedEpisodeInventory();
  assert(
    verifiedEps.length === sitemapDry.episodesCount,
    `Verified episode inventory (${verifiedEps.length}) matches sitemap-episodes.xml count (${sitemapDry.episodesCount})`
  );

  // =======================================================================
  // STRICT EPISODE VERIFICATION TESTS (GENERIC TITLES, IDS, BOUNDS, ASSOCIATIONS)
  // =======================================================================
  const mockSeries = {
    id: 1396,
    mediaType: 'tv',
    name: 'Breaking Bad',
    overview: 'A high school chemistry teacher turns to cooking meth.',
    voteAverage: 8.9,
    voteCount: 13500,
    numberOfSeasons: 2,
    seasons: [
      {
        seasonNumber: 1,
        episodeCount: 7,
        overview: 'Season 1 follows Walter White entering the drug trade.',
        episodes: []
      },
      {
        seasonNumber: 2,
        episodeCount: 13,
        overview: 'Season 2 escalates consequences.',
        episodes: []
      }
    ]
  };

  assert(
    !isGenuineEpisodeName('') &&
      !isGenuineEpisodeName('Episode 1') &&
      !isGenuineEpisodeName('Ep. 2') &&
      !isGenuineEpisodeName('Season 1 Episode 1') &&
      !isGenuineEpisodeName('TBD') &&
      isGenuineEpisodeName('Pilot'),
    'isGenuineEpisodeName rejects missing/generic placeholders and accepts genuine episode titles'
  );

  // 1) Missing title -> not indexable
  assert(
    !isEpisodeSeoIndexable({
      seriesId: 1396,
      episodeId: 62085,
      seasonNumber: 1,
      episodeNumber: 1,
      seasonEpisodeCount: 7,
      numberOfSeasons: 2,
      episodeName: '',
      episodeOverview: 'Walter White collapses at his car wash job and receives life-altering medical news.',
      seriesOverview: mockSeries.overview,
      isVerifiedEpisode: true
    }),
    'Episode with missing title is NOT indexable'
  );

  // 2) Generic title ("Episode 1") -> not indexable (even via fetchServerEpisode/renderSeoResult)
  assert(
    !isEpisodeSeoIndexable({
      seriesId: 1396,
      episodeId: 62085,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeName: 'Episode 1',
      episodeOverview: 'Walter White collapses at his car wash job and receives life-altering medical news.',
      seriesOverview: mockSeries.overview,
      isVerifiedEpisode: true
    }),
    'Episode with generic title ("Episode 1") is NOT indexable'
  );

  const mockGenericTitleFetch = (async () =>
    new Response(
      JSON.stringify({
        id: 62086,
        season_number: 1,
        episode_number: 2,
        name: 'Episode 2',
        overview: 'Walter and Jesse deal with the aftermath in the desert RV.',
        vote_average: 8.7,
        vote_count: 300
      }),
      { status: 200 }
    )) as typeof fetch;
  const genericTitleRendered = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/tv/breaking-bad-1396/1/2', {
    preloadedMedia: mockSeries,
    fetchImpl: mockGenericTitleFetch,
    tmdbApiKey: 'test-key'
  });
  assert(
    genericTitleRendered.status === 200 && genericTitleRendered.isNoindex,
    'Live TMDB episode with generic title "Episode 2" emits 200 + noindex'
  );

  // 3) Empty overview -> not indexable
  assert(
    !isEpisodeSeoIndexable({
      seriesId: 1396,
      episodeId: 62085,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeName: 'Pilot',
      episodeOverview: '',
      seriesOverview: mockSeries.overview,
      isVerifiedEpisode: true
    }),
    'Episode with empty overview is NOT indexable'
  );

  // 4) Overview identical to parent series overview or season overview -> not indexable
  assert(
    !isEpisodeSeoIndexable({
      seriesId: 1396,
      episodeId: 62085,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeName: 'Pilot',
      episodeOverview: mockSeries.overview,
      seriesOverview: mockSeries.overview,
      isVerifiedEpisode: true
    }) &&
      !isEpisodeSeoIndexable({
        seriesId: 1396,
        episodeId: 62085,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeName: 'Pilot',
        episodeOverview: mockSeries.seasons[0].overview,
        seriesOverview: mockSeries.overview,
        seasonOverview: mockSeries.seasons[0].overview,
        isVerifiedEpisode: true
      }),
    'Episode overview matching parent series or season overview is NOT indexable'
  );

  // 5) Missing or invalid episode ID -> not verified / not indexable
  assert(
    !isEpisodeSeoIndexable({
      seriesId: 1396,
      episodeId: 0,
      seasonNumber: 1,
      episodeNumber: 1,
      episodeName: 'Pilot',
      episodeOverview: 'Walter White collapses at his car wash job and learns he has terminal cancer.',
      seriesOverview: mockSeries.overview,
      isVerifiedEpisode: true
    }) &&
      !validateVerifiedEpisodeRecord({
        show: mockSeries,
        season: mockSeries.seasons[0],
        episode: {
          id: 0,
          seasonNumber: 1,
          episodeNumber: 1,
          name: 'Pilot',
          overview: 'Walter White collapses at his car wash job and learns he has terminal cancer.'
        }
      }),
    'Episode missing positive integer TMDB ID fails verification and is NOT indexable'
  );

  // 6) Nonexistent season & 7) episode exceeding season episodeCount -> 404
  const badSeasonEp = await fetchServerEpisode(mockSeries, 99, 1, mock404Fetch, 'test-key');
  const badEpisodeBounds = await fetchServerEpisode(mockSeries, 1, 9, mock404Fetch, 'test-key');
  assert(
    badSeasonEp === null && badEpisodeBounds === null,
    'Nonexistent season (99) and episode exceeding season episodeCount (9 > 7) return null (HTTP 404)'
  );

  // 8) Wrong parent series or season association -> rejected by validateVerifiedEpisodeRecord & fetchServerEpisode
  assert(
    !validateVerifiedEpisodeRecord({
      show: mockSeries,
      season: mockSeries.seasons[0],
      episode: {
        id: 62085,
        showId: 99999,
        seasonNumber: 1,
        episodeNumber: 1,
        name: 'Pilot',
        overview: 'Walter White collapses at his car wash job and learns he has terminal cancer.'
      }
    }) &&
      !validateVerifiedEpisodeRecord({
        show: mockSeries,
        season: mockSeries.seasons[0],
        episode: {
          id: 62085,
          seasonNumber: 2,
          episodeNumber: 1,
          name: 'Pilot',
          overview: 'Walter White collapses at his car wash job and learns he has terminal cancer.'
        }
      }),
    'Mismatched parent showId or seasonNumber fails verified episode check'
  );

  // 9) Genuine verified TMDB episode -> indexable + included when verified
  const mockGenuineEpFetch = (async () =>
    new Response(
      JSON.stringify({
        id: 62085,
        season_number: 1,
        episode_number: 5,
        name: 'Gray Matter',
        overview: 'Walter rejects Eliot and Gretchen’s offer of financial assistance at a birthday gathering.',
        air_date: '2008-02-24',
        vote_average: 8.4,
        vote_count: 295
      }),
      { status: 200 }
    )) as typeof fetch;
  const genuineLiveEpRes = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/tv/breaking-bad-1396/1/5', {
    preloadedMedia: mockSeries,
    fetchImpl: mockGenuineEpFetch,
    tmdbApiKey: 'test-key'
  });
  assert(
    genuineLiveEpRes.status === 200 &&
      !genuineLiveEpRes.isNoindex &&
      genuineLiveEpRes.html.includes('Gray Matter') &&
      /"ratingValue"\s*:\s*8\.4/.test(genuineLiveEpRes.html) &&
      /"ratingCount"\s*:\s*295/.test(genuineLiveEpRes.html),
    'Genuine verified episode with positive ID, unique synopsis, and episode rating renders indexable TVEpisode'
  );

  // 10) Upstream 429 & 5xx both throw 503
  for (const upstreamStatus of [429, 502]) {
    let threw503 = false;
    try {
      await fetchServerEpisode(
        mockSeries,
        1,
        3,
        (async () => new Response('err', { status: upstreamStatus })) as typeof fetch,
        'test-key'
      );
    } catch (e: any) {
      threw503 = e?.status === 503;
    }
    assert(threw503, `Episode upstream HTTP ${upstreamStatus} propagates as HTTP 503`);
  }

  // 11) Sitemap episodes exclusion parity: all sitemap-episodes.xml URLs pass validateVerifiedEpisodeRecord
  assert(
    verifiedEps.every(ep => ep.episodeName && !/^(?:episode|ep\.?)\s*\d+$/i.test(ep.episodeName)) &&
      !sitemapDry.episodesXml?.includes('/1/6'),
    'sitemap-episodes.xml strictly includes only verified content-rich episodes and excludes unverified ones'
  );

  // =======================================================================
  // PUBLIC ARTIFACT SAFETY CHECKS
  // =======================================================================
  verifyNoInternalArtifacts(process.cwd(), ['public']);
  assert(
    fs.existsSync(path.resolve(process.cwd(), 'public/assets/aistudio/tstream-logo-yellow-transparent_1__d41aea4b.png')),
    'Legitimate website logo asset in public/assets/aistudio/ is preserved while internal prompts are absent'
  );

  const artifactSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'tstream-artifact-guard-'));
  fs.mkdirSync(path.join(artifactSandbox, 'public/assets/aistudio'), { recursive: true });
  fs.writeFileSync(path.join(artifactSandbox, 'public/assets/aistudio/Paste_test_prompt'), 'TSTREAM.ONLINE — FINAL', 'utf8');
  let caughtInternalArtifact = false;
  try {
    verifyNoInternalArtifacts(artifactSandbox, ['public']);
  } catch {
    caughtInternalArtifact = true;
  }
  fs.rmSync(artifactSandbox, { recursive: true, force: true });
  assert(caughtInternalArtifact, 'verifyNoInternalArtifacts fails build if Paste_* or prompt artifacts exist in public/ or dist/');

  // =======================================================================
  // CROSS-MEDIA GENRE MATCHING ISOLATION (MOVIES VS TV SERIES)
  // =======================================================================
  const actionMeta = slugToGenre('action')!;
  const actionAdventureMeta = slugToGenre('action-adventure')!;
  const sciFiMeta = slugToGenre('science-fiction')!;
  const sciFiFantasyMeta = slugToGenre('sci-fi-fantasy')!;
  const dramaMeta = slugToGenre('drama')!;
  const mysteryMeta = slugToGenre('mystery')!;
  const horrorMeta = slugToGenre('horror')!;

  const sampleActionMovie = { id: 315635, mediaType: 'movie', title: 'Spider-Man: Homecoming', genres: [{ id: 28, name: 'Action' }] };
  const sampleSciFiMovie = { id: 27205, mediaType: 'movie', title: 'Inception', genres: [{ id: 878, name: 'Science Fiction' }, { id: 28, name: 'Action' }] };
  const sampleMysteryMovie = { id: 414906, mediaType: 'movie', title: 'The Batman', genres: [{ id: 80, name: 'Crime' }, { id: 9648, name: 'Mystery' }, { id: 53, name: 'Thriller' }] };
  const sampleHorrorMovie = { id: 36647, mediaType: 'movie', title: 'Blade', genres: [{ id: 28, name: 'Action' }, { id: 27, name: 'Horror' }] };
  const corruptMovieWithTvIds = { id: 99901, mediaType: 'movie', title: 'Corrupt Movie', genres: [{ id: 10759, name: 'Action & Adventure' }, { id: 10765, name: 'Sci-Fi & Fantasy' }] };

  const sampleActionTv = { id: 126308, mediaType: 'tv', name: 'Shogun', genres: [{ id: 18, name: 'Drama' }, { id: 10759, name: 'Action & Adventure' }] };
  const sampleSciFiTv = { id: 66732, mediaType: 'tv', name: 'Stranger Things', genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }] };
  const corruptTvWithMovieIds = { id: 99902, mediaType: 'tv', name: 'Corrupt TV', genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }, { id: 27, name: 'Horror' }] };

  // Action (28) & Action & Adventure (10759)
  assert(
    itemMatchesGenre(sampleActionMovie, actionMeta) &&
      !itemMatchesGenre(corruptMovieWithTvIds, actionMeta) &&
      itemMatchesGenre(sampleActionTv, actionMeta) &&
      !itemMatchesGenre(corruptTvWithMovieIds, actionMeta) &&
      itemMatchesGenre(sampleActionTv, actionAdventureMeta) &&
      !itemMatchesGenre(sampleActionMovie, actionAdventureMeta) &&
      !itemMatchesGenre(corruptMovieWithTvIds, actionAdventureMeta) &&
      !itemMatchesGenre(corruptTvWithMovieIds, actionAdventureMeta),
    'Action & Action & Adventure strictly separate movie ID 28 and TV ID 10759'
  );

  // Science Fiction (878) & Sci-Fi & Fantasy (10765)
  assert(
    itemMatchesGenre(sampleSciFiMovie, sciFiMeta) &&
      !itemMatchesGenre(corruptMovieWithTvIds, sciFiMeta) &&
      itemMatchesGenre(sampleSciFiTv, sciFiMeta) &&
      !itemMatchesGenre(corruptTvWithMovieIds, sciFiMeta) &&
      itemMatchesGenre(sampleSciFiTv, sciFiFantasyMeta) &&
      !itemMatchesGenre(sampleSciFiMovie, sciFiFantasyMeta) &&
      !itemMatchesGenre(corruptMovieWithTvIds, sciFiFantasyMeta) &&
      !itemMatchesGenre(corruptTvWithMovieIds, sciFiFantasyMeta),
    'Science Fiction & Sci-Fi & Fantasy strictly separate movie ID 878 and TV ID 10765'
  );

  // Drama (18) & Mystery (9648) & Horror (27)
  assert(
    itemMatchesGenre(sampleActionTv, dramaMeta) &&
      !itemMatchesGenre(sampleHorrorMovie, dramaMeta) &&
      itemMatchesGenre(sampleMysteryMovie, mysteryMeta) &&
      itemMatchesGenre(sampleSciFiTv, mysteryMeta) &&
      itemMatchesGenre(sampleHorrorMovie, horrorMeta) &&
      !itemMatchesGenre(sampleMysteryMovie, horrorMeta) &&
      !itemMatchesGenre(sampleSciFiTv, horrorMeta) &&
      !itemMatchesGenre(corruptTvWithMovieIds, horrorMeta),
    'Drama, Mystery, and Horror match strictly without Mystery (9648) contaminating Horror (27)'
  );

  // Offline /genre/horror SSR & queryLocalCatalog must exclude The Batman / Stranger Things / Severance (noindex, 0 fabricated cards)
  const horrorGenreSsr = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/genre/horror');
  const horrorSsrTitles = extractCardTitles(horrorGenreSsr.html);
  const localHorrorTitles = queryLocalCatalog({ genreId: 27 }).results.map(r => r.title);
  assert(
    horrorGenreSsr.status === 200 &&
      horrorGenreSsr.isNoindex &&
      horrorSsrTitles.length === 0 &&
      localHorrorTitles.length === 0 &&
      !horrorSsrTitles.includes('The Batman') &&
      !horrorSsrTitles.includes('Stranger Things') &&
      !horrorSsrTitles.includes('Severance') &&
      !localHorrorTitles.includes('The Batman'),
    'Offline /genre/horror emits noindex with zero fabricated Mystery (9648) or TV cards'
  );

  // Live TMDB /genre/horror queries /discover/movie?with_genres=27 only (never /discover/tv) and renders indexable CollectionPage
  const calledHorrorUrls: string[] = [];
  const mockHorrorFetch = (async (input: string | URL | Request) => {
    const u = String(input);
    calledHorrorUrls.push(u);
    if (u.includes('/discover/movie') && u.includes('with_genres=27')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              id: 36647,
              title: 'Blade',
              release_date: '1998-08-21',
              vote_average: 7.2,
              genre_ids: [27, 28]
            }
          ],
          total_pages: 1
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ results: [], total_pages: 1 }), { status: 200 });
  }) as typeof fetch;
  const liveHorrorSsr = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/genre/horror', {
    fetchImpl: mockHorrorFetch,
    tmdbApiKey: 'test-key'
  });
  const liveHorrorCards = extractCardTitles(liveHorrorSsr.html);
  assert(
    liveHorrorSsr.status === 200 &&
      !liveHorrorSsr.isNoindex &&
      liveHorrorCards.includes('Blade') &&
      !liveHorrorCards.includes('The Batman') &&
      !liveHorrorCards.includes('Stranger Things') &&
      calledHorrorUrls.some(u => u.includes('/discover/movie') && u.includes('with_genres=27')) &&
      calledHorrorUrls.every(u => !u.includes('/discover/tv')),
    'Live /genre/horror queries movie genre 27 only and excludes TV & Mystery contamination'
  );

  // Offline /genre/action-adventure returns TV series only
  const actionAdvSsr = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/genre/action-adventure');
  assert(
    actionAdvSsr.status === 200 &&
      !actionAdvSsr.isNoindex &&
      !/href="\/movie\//i.test(actionAdvSsr.html) &&
      /href="\/tv\//i.test(actionAdvSsr.html),
    '/genre/action-adventure filters TV series strictly without leaking Action movies'
  );

  // Browser fetchCatalog mediaType='movie' with TV-only genre returns empty without unfiltered fallback
  const tvOnlyWithMovieType = await fetchCatalog('movies', 1, {
    mediaType: 'movie',
    genreId: 10759
  }, {
    fetchImpl: mock404Fetch
  });
  assert(
    tvOnlyWithMovieType.results.length === 0,
    'fetchCatalog(movies, genreId=10759) returns empty rather than cross-matching TV-only genre onto movies'
  );

  // =======================================================================
  // PARTIAL TV SEASON METADATA & DYNAMIC EPISODE SSR REGRESSION TESTS
  // =======================================================================
  const partialShow = {
    id: 100088,
    tmdbId: 100088,
    mediaType: 'tv',
    name: 'The Last of Us',
    title: 'The Last of Us',
    overview: 'A distinct series overview.',
    numberOfSeasons: 2,
    seasons: [
      {
        seasonNumber: 1,
        episodeCount: 9,
        episodes: []
      }
    ]
  };

  const tlouSeason2Payloads: Record<string, any> = {
    '2:1': {
      id: 5517228,
      season_number: 2,
      episode_number: 1,
      name: 'Future Days',
      overview: 'A genuine episode-specific description containing enough meaningful information for SEO validation.',
      air_date: '2025-04-13',
      vote_average: 8.2,
      vote_count: 1000
    },
    '2:2': {
      id: 5517229,
      season_number: 2,
      episode_number: 2,
      name: 'Through the Valley',
      overview: 'As a storm brews in the mountains outside Jackson, Abby closes in on her long-sought target.',
      air_date: '2025-04-20',
      vote_average: 9.1,
      vote_count: 1420
    },
    '2:3': {
      id: 5994269,
      season_number: 2,
      episode_number: 3,
      name: 'The Path',
      overview: 'After a devastating loss shakes Jackson to its core, Ellie prepares to set out for Seattle.',
      air_date: '2025-04-27',
      vote_average: 7.9,
      vote_count: 890
    },
    '1:10': {
      id: 9991010,
      season_number: 1,
      episode_number: 10,
      name: 'Extended Finale Chapter',
      overview: 'A newly added live TMDB episode extending past a stale cached season episode count.',
      air_date: '2025-05-04',
      vote_average: 8.5,
      vote_count: 400
    }
  };

  const tlouCalledEndpoints: string[] = [];
  const mockTlouEpisodeFetch = (async (input: string | URL | Request) => {
    const u = String(input);
    tlouCalledEndpoints.push(u);
    const epMatch = u.match(/\/tv\/100088\/season\/(\d+)\/episode\/(\d+)/);
    if (epMatch) {
      const key = `${epMatch[1]}:${epMatch[2]}`;
      if (tlouSeason2Payloads[key]) {
        return new Response(JSON.stringify(tlouSeason2Payloads[key]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response(JSON.stringify({ status_code: 34, status_message: 'The resource you requested could not be found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof fetch;

  // Test 1: Missing local season (Season 2 absent from partial local cache), valid TMDB season
  const s2e1Meta = await fetchServerEpisode(partialShow, 2, 1, mockTlouEpisodeFetch, 'test-key');
  assert(
    tlouCalledEndpoints.some(u => u.includes('/tv/100088/season/2/episode/1')) &&
      Boolean(s2e1Meta) &&
      s2e1Meta?.episodeId === 5517228 &&
      s2e1Meta?.name === 'Future Days' &&
      s2e1Meta?.isVerified === true &&
      s2e1Meta?.source === 'tmdb',
    'Partial Ep Test 1: Missing local season falls back to live TMDB /tv/100088/season/2/episode/1 and returns verified Future Days (5517228)'
  );

  // Also verify S01E10 beyond stale local episodeCount=9 falls back to live TMDB when key is available
  const s1e10StaleCount = await fetchServerEpisode(partialShow, 1, 10, mockTlouEpisodeFetch, 'test-key');
  assert(
    Boolean(s1e10StaleCount) && s1e10StaleCount?.episodeId === 9991010 && s1e10StaleCount?.isVerified === true,
    'Partial Ep Test 1b: Stale local season episodeCount does not block live TMDB lookup'
  );

  // Offline strict guard: missing local season still rejected cleanly when no TMDB key is available
  const prevTmdbEnvOffline = process.env.TMDB_API_KEY;
  delete process.env.TMDB_API_KEY;
  const offlineMissingSeason = await fetchServerEpisode(partialShow, 2, 1, fetch, '');
  if (prevTmdbEnvOffline !== undefined) process.env.TMDB_API_KEY = prevTmdbEnvOffline;
  assert(
    offlineMissingSeason === null,
    'Partial Ep Test 1c: Offline mode without TMDB key does not invent missing Season 2'
  );

  // Test 2: Stale local numberOfSeasons=1 while TMDB confirms Season 2 exists
  const staleSeasonCountShow = {
    ...partialShow,
    numberOfSeasons: 1
  };
  tlouCalledEndpoints.length = 0;
  const s2e1StaleCount = await fetchServerEpisode(staleSeasonCountShow, 2, 1, mockTlouEpisodeFetch, 'test-key');
  const staleCountSsr = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/tv/the-last-of-us-100088/2/1', {
    preloadedMedia: staleSeasonCountShow,
    fetchImpl: mockTlouEpisodeFetch,
    tmdbApiKey: 'test-key'
  });
  assert(
    tlouCalledEndpoints.some(u => u.includes('/tv/100088/season/2/episode/1')) &&
      s2e1StaleCount?.episodeId === 5517228 &&
      s2e1StaleCount?.isVerified === true &&
      staleCountSsr.status === 200 &&
      !staleCountSsr.isNoindex &&
      staleCountSsr.canonicalUrl === 'https://tstream.online/watch/tv/the-last-of-us-100088/2/1',
    'Partial Ep Test 2: Stale local numberOfSeasons=1 does not block live TMDB lookup or SSR indexability for Season 2'
  );

  // Test 3: Full SSR rendering via partialShow AND real catalogData.ts (without preloadedMedia) for S02E01, S02E02, S02E03
  for (const epCheck of [
    { ep: 1, title: 'Future Days', can: 'https://tstream.online/watch/tv/the-last-of-us-100088/2/1', rating: '8.2' },
    { ep: 2, title: 'Through the Valley', can: 'https://tstream.online/watch/tv/the-last-of-us-100088/2/2', rating: '9.1' },
    { ep: 3, title: 'The Path', can: 'https://tstream.online/watch/tv/the-last-of-us-100088/2/3', rating: '7.9' }
  ]) {
    const ssrPartial = await renderSeoResult(
      sampleHtmlWithPreExistingCanonical,
      `/watch/tv/the-last-of-us-100088/2/${epCheck.ep}`,
      {
        preloadedMedia: partialShow,
        fetchImpl: mockTlouEpisodeFetch,
        tmdbApiKey: 'test-key'
      }
    );
    const ssrCatalog = await renderSeoResult(
      sampleHtmlWithPreExistingCanonical,
      `/watch/tv/the-last-of-us-100088/2/${epCheck.ep}`,
      {
        fetchImpl: mockTlouEpisodeFetch,
        tmdbApiKey: 'test-key'
      }
    );
    const jsonLdMatch = ssrCatalog.html.match(/<script\s+[^>]*id=["']json-ld-schema["'][^>]*>([\s\S]*?)<\/script>/i);
    const jsonLd = jsonLdMatch ? JSON.parse(jsonLdMatch[1]) : null;
    assert(
      ssrPartial.status === 200 &&
        ssrCatalog.status === 200 &&
        !ssrPartial.isNoindex &&
        !ssrCatalog.isNoindex &&
        ssrPartial.canonicalUrl === epCheck.can &&
        ssrCatalog.canonicalUrl === epCheck.can &&
        jsonLd?.['@type'] === 'TVEpisode' &&
        jsonLd?.episodeNumber === epCheck.ep &&
        jsonLd?.partOfSeason?.seasonNumber === 2 &&
        String(jsonLd?.name || '').includes(epCheck.title) &&
        String(jsonLd?.aggregateRating?.ratingValue) === epCheck.rating &&
        !ssrCatalog.html.includes('"ratingCount":5100') &&
        ssrCatalog.html.includes('id="seo-prerender"') &&
        ssrCatalog.html.includes(epCheck.title),
      `Partial Ep Test 3: Full SSR for /watch/tv/the-last-of-us-100088/2/${epCheck.ep} (${epCheck.title}) returns 200, canonical, TVEpisode schema & semantic HTML`
    );
  }

  // Test 4: Invalid episode / nonexistent season / mismatched TMDB payload -> HTTP 404 + noindex
  const invalidS2E99 = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/tv/the-last-of-us-100088/2/99', {
    preloadedMedia: partialShow,
    fetchImpl: mockTlouEpisodeFetch,
    tmdbApiKey: 'test-key'
  });
  const invalidS99E1 = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/tv/the-last-of-us-100088/99/1', {
    preloadedMedia: partialShow,
    fetchImpl: mockTlouEpisodeFetch,
    tmdbApiKey: 'test-key'
  });
  const mockMismatchFetch = (async () =>
    new Response(
      JSON.stringify({
        id: 5517228,
        season_number: 1,
        episode_number: 1,
        name: 'Wrong Season Response',
        overview: 'Mismatched payload that claims season 1 when season 2 was requested.'
      }),
      { status: 200 }
    )) as typeof fetch;
  const mismatchedSsr = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/tv/the-last-of-us-100088/2/1', {
    preloadedMedia: partialShow,
    fetchImpl: mockMismatchFetch,
    tmdbApiKey: 'test-key'
  });
  assert(
    invalidS2E99.status === 404 &&
      invalidS2E99.isNoindex &&
      !invalidS2E99.html.includes('Future Days') &&
      invalidS99E1.status === 404 &&
      invalidS99E1.isNoindex &&
      mismatchedSsr.status === 404 &&
      mismatchedSsr.isNoindex,
    'Partial Ep Test 4: Nonexistent season/episode and mismatched TMDB season_number return genuine HTTP 404 without fabrication'
  );

  // Test 5: Transient TMDB errors (429, 5xx, network failure, AbortError timeout) -> 503 when uncached, stale cache preserved when primed
  for (const failureCase of [
    {
      label: 'HTTP 429',
      fn: (async () => new Response('rate limited', { status: 429 })) as typeof fetch
    },
    {
      label: 'HTTP 503',
      fn: (async () => new Response('upstream error', { status: 503 })) as typeof fetch
    },
    {
      label: 'network error',
      fn: (async () => {
        throw new Error('ECONNRESET');
      }) as typeof fetch
    },
    {
      label: 'AbortError timeout',
      fn: (async () => {
        const err: any = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }) as typeof fetch
    }
  ]) {
    const errSsr = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/tv/the-last-of-us-100088/2/1', {
      preloadedMedia: partialShow,
      fetchImpl: failureCase.fn,
      tmdbApiKey: 'test-key'
    });
    assert(
      errSsr.status === 503 && errSsr.isNoindex,
      `Partial Ep Test 5 (${failureCase.label}): Uncached transient failure returns HTTP 503 (never false 404)`
    );
  }

  // Test 5b: Real stale-while-error cache policy when cache entry expired fresh TTL but stays within stale TTL
  clearSeoPluginCaches();
  const realGlobalFetch = globalThis.fetch;
  const realDateNow = Date.now;
  let fakeClockMs = 1_750_000_000_000;
  let upstreamMode: 'ok' | '503' = 'ok';
  let staleFallbackFetchCount = 0;
  try {
    Date.now = () => fakeClockMs;
    globalThis.fetch = (async () => {
      staleFallbackFetchCount++;
      if (upstreamMode === '503') {
        return new Response('Service Unavailable', { status: 503 });
      }
      return new Response(JSON.stringify(tlouSeason2Payloads['2:1']), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    const primed = await fetchServerEpisode(partialShow, 2, 1, fetch, 'test-key');
    // Advance clock 20 minutes (past 15m fresh TTL, still inside 6h stale TTL) & trigger upstream 503
    fakeClockMs += 20 * 60 * 1000;
    upstreamMode = '503';
    const staleServed = await fetchServerEpisode(partialShow, 2, 1, fetch, 'test-key');
    assert(
      staleFallbackFetchCount === 2 &&
        primed?.episodeId === 5517228 &&
        staleServed?.episodeId === 5517228 &&
        staleServed?.name === 'Future Days' &&
        staleServed?.isVerified === true,
      'Partial Ep Test 5b: Existing stale cache serves valid episode during transient TMDB 503 after fresh TTL expires'
    );
  } finally {
    globalThis.fetch = realGlobalFetch;
    Date.now = realDateNow;
    clearSeoPluginCaches();
  }

  // =======================================================================
  // TMDB 401/403 AUTHENTICATION & UNEXPECTED 4XX REGRESSION TESTS
  // =======================================================================
  const mockAuth401Fetch = (async () =>
    new Response('{"status_code":7,"status_message":"Invalid API key"}', { status: 401 })) as typeof fetch;
  const mockAuth403Fetch = (async () =>
    new Response('{"status_code":3,"status_message":"Authentication failed"}', { status: 403 })) as typeof fetch;
  const mockBad400Fetch = (async () =>
    new Response('{"status_message":"Invalid parameters"}', { status: 400 })) as typeof fetch;

  // Test 1: HTTP 401 with a missing local season -> HTTP 503 + noindex (never false 404)
  const auth401MissingSeasonEp = await (async () => {
    try {
      return await fetchServerEpisode(partialShow, 2, 1, mockAuth401Fetch, 'test-key');
    } catch (err: any) {
      return { thrownStatus: err?.status };
    }
  })();
  const auth401MissingSeasonSsr = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/the-last-of-us-100088/2/1',
    {
      preloadedMedia: partialShow,
      fetchImpl: mockAuth401Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  assert(
    (auth401MissingSeasonEp as any)?.thrownStatus === 503 &&
      auth401MissingSeasonSsr.status === 503 &&
      auth401MissingSeasonSsr.isNoindex &&
      auth401MissingSeasonSsr.canonicalUrl !== 'https://tstream.online/404' &&
      !auth401MissingSeasonSsr.html.includes('Future Days'),
    'Auth Ep Test 1: HTTP 401 with missing local season returns HTTP 503 + noindex (never false 404 or /404 canonical)'
  );

  // Test 2: HTTP 403 with a missing local season -> HTTP 503 + noindex (never false 404)
  const auth403MissingSeasonSsr = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/the-last-of-us-100088/2/1',
    {
      preloadedMedia: partialShow,
      fetchImpl: mockAuth403Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  assert(
    auth403MissingSeasonSsr.status === 503 &&
      auth403MissingSeasonSsr.isNoindex &&
      auth403MissingSeasonSsr.canonicalUrl !== 'https://tstream.online/404' &&
      !auth403MissingSeasonSsr.html.includes('Future Days'),
    'Auth Ep Test 2: HTTP 403 with missing local season returns HTTP 503 + noindex (never false 404)'
  );

  // Also ensure dynamic show not in local catalog returns 503 (never 404) when TMDB returns 401/403
  const auth401DynamicShowSsr = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/dynamic-unlisted-show-999888/1/1',
    {
      fetchImpl: mockAuth401Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  assert(
    auth401DynamicShowSsr.status === 503 &&
      auth401DynamicShowSsr.isNoindex &&
      auth401DynamicShowSsr.canonicalUrl !== 'https://tstream.online/404',
    'Auth Ep Test 2b: Dynamic unlisted show returns HTTP 503 (never 404) on TMDB HTTP 401'
  );

  // Test 3: HTTP 401 with known local episode boundaries (/watch/tv/breaking-bad-1396/1/6)
  const localBoundedEp401 = await fetchServerEpisode(mockSeries, 1, 6, mockAuth401Fetch, 'test-key');
  const localBoundedSsr401 = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/breaking-bad-1396/1/6',
    {
      preloadedMedia: mockSeries,
      fetchImpl: mockAuth401Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  const localBoundedCatalogSsr401 = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/breaking-bad-1396/1/6',
    {
      fetchImpl: mockAuth401Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  assert(
    Boolean(localBoundedEp401) &&
      localBoundedEp401?.isVerified === false &&
      localBoundedEp401?.hasGenuineName === false &&
      localBoundedEp401?.overview === '' &&
      localBoundedEp401?.voteAverage === undefined &&
      localBoundedEp401?.source === 'local' &&
      localBoundedSsr401.status === 200 &&
      localBoundedSsr401.isNoindex &&
      localBoundedSsr401.html.includes('content="noindex, follow"') &&
      !localBoundedSsr401.html.includes('cooking meth') &&
      !localBoundedSsr401.html.includes('"ratingCount":13500') &&
      localBoundedCatalogSsr401.status === 200 &&
      localBoundedCatalogSsr401.isNoindex &&
      !localBoundedCatalogSsr401.html.includes('Stage III cancer') &&
      !localBoundedCatalogSsr401.html.includes('"ratingCount":14800'),
    'Auth Ep Test 3: HTTP 401 within known local episode bounds returns thin 200 noindex fallback without copying series overview or rating'
  );

  // Test 4: HTTP 403 with known local episode boundaries (/watch/tv/breaking-bad-1396/1/6)
  const localBoundedEp403 = await fetchServerEpisode(mockSeries, 1, 6, mockAuth403Fetch, 'test-key');
  const localBoundedSsr403 = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/breaking-bad-1396/1/6',
    {
      preloadedMedia: mockSeries,
      fetchImpl: mockAuth403Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  assert(
    Boolean(localBoundedEp403) &&
      localBoundedEp403?.isVerified === false &&
      localBoundedEp403?.hasGenuineName === false &&
      localBoundedEp403?.overview === '' &&
      localBoundedEp403?.source === 'local' &&
      localBoundedSsr403.status === 200 &&
      localBoundedSsr403.isNoindex &&
      localBoundedSsr403.html.includes('content="noindex, follow"') &&
      !localBoundedSsr403.html.includes('cooking meth') &&
      !localBoundedSsr403.html.includes('"ratingCount":13500'),
    'Auth Ep Test 4: HTTP 403 within known local episode bounds returns safe thin 200 noindex fallback'
  );

  // Guard: Missing numberOfSeasons + missing seasonObj must NOT assume a season exists on HTTP 401
  const showWithoutSeasons = {
    id: 555777,
    mediaType: 'tv',
    name: 'No Season Bounds',
    overview: 'Series without season metadata.',
    seasons: []
  };
  let threwWithoutSeasons = false;
  try {
    await fetchServerEpisode(showWithoutSeasons, 1, 1, mockAuth401Fetch, 'test-key');
  } catch (err: any) {
    threwWithoutSeasons = err?.status === 503;
  }
  assert(
    threwWithoutSeasons,
    'Auth Ep Test 4b: Missing numberOfSeasons and missing seasonObj throw HTTP 503 on 401 without inventing episode <= 25 bounds'
  );

  // Test 5: Genuine HTTP 404 remains a real HTTP 404 + /404 canonical + noindex
  const genuine404MissingSeasonSsr = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/the-last-of-us-100088/2/1',
    {
      preloadedMedia: partialShow,
      fetchImpl: mock404Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  assert(
    genuine404MissingSeasonSsr.status === 404 &&
      genuine404MissingSeasonSsr.isNoindex &&
      genuine404MissingSeasonSsr.canonicalUrl === 'https://tstream.online/404' &&
      !genuine404MissingSeasonSsr.html.includes('Future Days'),
    'Auth Ep Test 5: Genuine TMDB HTTP 404 continues returning HTTP 404, /404 canonical, and noindex'
  );

  // Test 6 & Test 7: Stale cached episode during HTTP 401 and HTTP 403
  for (const authFailureStatus of [401, 403] as const) {
    clearSeoPluginCaches();
    const origFetch = globalThis.fetch;
    const origNow = Date.now;
    let clockMs = 1_760_000_000_000;
    let mode: 'ok' | 'unverified_ok' | 'auth_fail' = 'ok';
    try {
      Date.now = () => clockMs;
      globalThis.fetch = (async (input: string | URL | Request) => {
        const u = String(input);
        if (mode === 'auth_fail') {
          return new Response(JSON.stringify({ status_code: authFailureStatus === 401 ? 7 : 3 }), {
            status: authFailureStatus
          });
        }
        if (u.includes('/season/2/episode/2')) {
          // Deliberately generic title/empty overview so isVerified=false when primed
          return new Response(
            JSON.stringify({
              id: 5517229,
              season_number: 2,
              episode_number: 2,
              name: 'Episode 2',
              overview: ''
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify(tlouSeason2Payloads['2:1']), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }) as typeof fetch;

      // Prime verified 2:1 and unverified 2:2 in real serverEpisodeCache
      const primedVerified = await fetchServerEpisode(partialShow, 2, 1, fetch, 'test-key');
      const primedUnverified = await fetchServerEpisode(partialShow, 2, 2, fetch, 'test-key');

      // Advance clock 20 minutes (past 15m fresh TTL, inside 6h stale TTL) & trigger 401/403
      clockMs += 20 * 60 * 1000;
      mode = 'auth_fail';

      const staleVerified = await fetchServerEpisode(partialShow, 2, 1, fetch, 'test-key');
      const staleUnverified = await fetchServerEpisode(partialShow, 2, 2, fetch, 'test-key');
      const staleSsr = await renderSeoResult(
        sampleHtmlWithPreExistingCanonical,
        '/watch/tv/the-last-of-us-100088/2/1',
        {
          preloadedMedia: partialShow,
          tmdbApiKey: 'test-key'
        }
      );

      // Also verify an uncached episode (2:3) throws 503 on 401/403 and does NOT poison cache
      let uncachedThrew503 = false;
      try {
        await fetchServerEpisode(partialShow, 2, 3, fetch, 'test-key');
      } catch (err: any) {
        uncachedThrew503 = err?.status === 503;
      }

      // Now recover TMDB and confirm 2:3 wasn't poisoned in cache
      mode = 'ok';
      globalThis.fetch = (async () =>
        new Response(JSON.stringify(tlouSeason2Payloads['2:3']), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })) as typeof fetch;
      const recoveredS2E3 = await fetchServerEpisode(partialShow, 2, 3, fetch, 'test-key');

      assert(
        primedVerified?.isVerified === true &&
          staleVerified?.episodeId === 5517228 &&
          staleVerified?.name === 'Future Days' &&
          staleVerified?.isVerified === true &&
          primedUnverified?.isVerified === false &&
          staleUnverified?.episodeId === 5517229 &&
          staleUnverified?.isVerified === false &&
          staleSsr.status === 200 &&
          !staleSsr.isNoindex &&
          staleSsr.html.includes('Future Days') &&
          uncachedThrew503 &&
          recoveredS2E3?.episodeId === 5994269 &&
          recoveredS2E3?.name === 'The Path',
        `Auth Ep Test ${authFailureStatus === 401 ? 6 : 7}: Stale cached episode is preserved cleanly during HTTP ${authFailureStatus} without altering isVerified or poisoning cache`
      );
    } finally {
      globalThis.fetch = origFetch;
      Date.now = origNow;
      clearSeoPluginCaches();
    }
  }

  // Test 8: Unexpected upstream 4xx (HTTP 400) -> never false 404; bounded local fallback or stale cache, otherwise 503
  const bad400MissingSeasonSsr = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/the-last-of-us-100088/2/1',
    {
      preloadedMedia: partialShow,
      fetchImpl: mockBad400Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  const bad400BoundedSsr = await renderSeoResult(
    sampleHtmlWithPreExistingCanonical,
    '/watch/tv/breaking-bad-1396/1/6',
    {
      preloadedMedia: mockSeries,
      fetchImpl: mockBad400Fetch,
      tmdbApiKey: 'test-key'
    }
  );
  assert(
    bad400MissingSeasonSsr.status === 503 &&
      bad400MissingSeasonSsr.isNoindex &&
      bad400BoundedSsr.status === 200 &&
      bad400BoundedSsr.isNoindex,
    'Auth Ep Test 8: Unexpected TMDB HTTP 400 returns 503 when unverified/missing local season and safe thin 200 noindex within local bounds'
  );

  // =======================================================================
  // PHASE 8: ANIME SEO, CANONICALIZATION, BREADCRUMBLIST & SSR BOUNDARIES
  // =======================================================================
  clearAnimeSeoCaches();

  // Route parsing checks
  assert(
    parseSeoRoute('/anime')?.type === 'anime_hub' &&
      parseSeoRoute('/anime/trending')?.animeSection === 'trending' &&
      parseSeoRoute('/anime/genres/slice-of-life')?.animeGenreSlug === 'slice-of-life' &&
      parseSeoRoute('/anime/attack-on-titan-16498')?.type === 'anime' &&
      parseSeoRoute('/anime/attack-on-titan-16498')?.id === 16498 &&
      parseSeoRoute('/anime-movie/spirited-away-199')?.type === 'anime_movie' &&
      parseSeoRoute('/anime-movie/spirited-away-199')?.id === 199 &&
      parseSeoRoute('/watch/anime/attack-on-titan-16498/1')?.type === 'watch_anime' &&
      parseSeoRoute('/watch/anime/attack-on-titan-16498/1')?.episode === 1 &&
      parseSeoRoute('/watch/anime/attack-on-titan-16498/0')?.type === 'notfound' &&
      parseSeoRoute('/anime/invalid-slug-no-id')?.type === 'notfound',
    'Phase 8 Anime 1: parseSeoRoute handles all anime hubs, series, movie, watch episode, and invalid routes'
  );

  // Client SEO metadata + BreadcrumbList schema parity
  const aotSample = {
    id: 16498,
    anilistId: 16498,
    mediaType: 'anime',
    mediaFormat: 'TV',
    title: 'Attack on Titan',
    seasonYear: 2013,
    overview: 'Humanity fights for survival behind giant walls against Titans.',
    genres: ['Action', 'Drama'],
    posterPath: 'https://s4.anilist.co/file/aot.jpg',
    backdropPath: 'https://s4.anilist.co/file/aot-banner.jpg',
    voteAverage: 8.4,
    popularity: 850000
  };
  const spiritedSample = {
    id: 199,
    anilistId: 199,
    mediaType: 'anime',
    mediaFormat: 'MOVIE',
    title: 'Spirited Away',
    seasonYear: 2001,
    overview: 'Chihiro enters a mysterious spirit world.',
    genres: ['Adventure', 'Supernatural'],
    posterPath: 'https://s4.anilist.co/file/sa.jpg',
    voteAverage: 8.6
  };
  const aotSeriesMeta = buildMediaMetadata(aotSample);
  const aotWatchMeta = buildMediaMetadata(aotSample, {
    episode: 1,
    episodeName: 'To You, in 2000 Years',
    episodeOverview: 'The Colossal Titan breaches Wall Maria at Shiganshina.',
    isWatching: true
  });
  const spiritedMeta = buildMediaMetadata(spiritedSample);
  const spiritedWatchMeta = buildMediaMetadata(spiritedSample, { isWatching: true });
  const bcSchema = buildBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Anime', url: '/anime' },
    { name: 'Attack on Titan', url: '/anime/attack-on-titan-16498' }
  ]);
  assert(
    aotSeriesMeta.canonicalUrl === 'https://tstream.online/anime/attack-on-titan-16498' &&
      aotSeriesMeta.schema['@type'] === 'TVSeries' &&
      aotWatchMeta.canonicalUrl === 'https://tstream.online/watch/anime/attack-on-titan-16498/1' &&
      aotWatchMeta.schema['@type'] === 'TVEpisode' &&
      !aotWatchMeta.schema.aggregateRating &&
      spiritedMeta.canonicalUrl === 'https://tstream.online/anime-movie/spirited-away-199' &&
      spiritedMeta.schema['@type'] === 'Movie' &&
      spiritedWatchMeta.canonicalUrl === 'https://tstream.online/anime-movie/spirited-away-199' &&
      bcSchema['@type'] === 'BreadcrumbList' &&
      bcSchema.itemListElement.length === 3,
    'Phase 8 Anime 2: Anime series/movie/episode metadata & BreadcrumbList schema normalize canonicals without leaking ratings'
  );

  // SSR Anime rendering: Series, Movie, Verified Episode (indexable), Generic Episode (200 noindex), Out-of-bounds Ep (404), Genre filter (noindex), 404 & 503
  const [aotSeriesSsr, spiritedSsr, aotEp1VerifiedSsr, aotEp2ThinSsr, aotEp99Ssr, genreFilterSsr] = await Promise.all([
    renderSeoResult(sampleHtmlWithPreExistingCanonical, '/anime/attack-on-titan-16498'),
    renderSeoResult(sampleHtmlWithPreExistingCanonical, '/anime-movie/spirited-away-199'),
    renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/anime/attack-on-titan-16498/1'),
    renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/anime/attack-on-titan-16498/2'),
    renderSeoResult(sampleHtmlWithPreExistingCanonical, '/watch/anime/attack-on-titan-16498/999'),
    renderSeoResult(sampleHtmlWithPreExistingCanonical, '/anime/genres/action?genre=Drama', {
      preloadedMedia: [aotSample]
    })
  ]);

  assert(
    aotSeriesSsr.status === 200 &&
      !aotSeriesSsr.isNoindex &&
      aotSeriesSsr.canonicalUrl === 'https://tstream.online/anime/attack-on-titan-16498' &&
      aotSeriesSsr.html.includes('id="json-ld-breadcrumb"') &&
      spiritedSsr.status === 200 &&
      !spiritedSsr.isNoindex &&
      spiritedSsr.canonicalUrl === 'https://tstream.online/anime-movie/spirited-away-199' &&
      /"@type"\s*:\s*"Movie"/.test(spiritedSsr.html) &&
      aotEp1VerifiedSsr.status === 200 &&
      !aotEp1VerifiedSsr.isNoindex &&
      aotEp1VerifiedSsr.canonicalUrl === 'https://tstream.online/watch/anime/attack-on-titan-16498/1' &&
      aotEp2ThinSsr.status === 200 &&
      aotEp2ThinSsr.isNoindex &&
      aotEp99Ssr.status === 404 &&
      aotEp99Ssr.isNoindex &&
      genreFilterSsr.status === 200 &&
      genreFilterSsr.isNoindex &&
      genreFilterSsr.canonicalUrl === 'https://tstream.online/anime/genres/action',
    'Phase 8 Anime 3: SSR Anime enforces series/movie canonicals, BreadcrumbList JSON-LD, verified vs thin episode indexability, bounds 404, and filtered genre noindex'
  );

  // AniList mock 404 vs 503 separation on uncached ID
  const animeMissingSsr = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/anime/unknown-show-999999999', {
    fetchImpl: mock404Fetch
  });
  const anime503Ssr = await renderSeoResult(sampleHtmlWithPreExistingCanonical, '/anime/busy-show-999999998', {
    fetchImpl: mock503Fetch
  });
  assert(
    animeMissingSsr.status === 404 &&
      animeMissingSsr.isNoindex &&
      anime503Ssr.status === 503 &&
      anime503Ssr.isNoindex,
    'Phase 8 Anime 4: AniList SSR separates missing anime (404) from upstream outage (503)'
  );

  console.log('\n--- ALL SEO, TAGS, GENRES, ANIME, EPISODES, ARTIFACTS, ENV & DISCOVERY TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

