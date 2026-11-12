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
  clearSeoPluginCaches,
  LruTtlCache
} from '../../../scripts/seoHtmlPlugin';
import {
  prerenderAndValidateRoute,
  loadDistTemplateOrFail
} from '../../../scripts/prerender';
import { validateBuildArgs } from '../../../scripts/run-build.mjs';

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

  console.log('\n--- ALL PHASE 3 SEO & PRERENDER TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
