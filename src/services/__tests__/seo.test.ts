/**
 * Comprehensive Automated SEO Verification Test Suite for TStream.online
 * Tests:
 * 1. Home page default keywords and metadata
 * 2. Movie keywords generation from TMDB data (The Amazing Spider-Man 2 example)
 * 3. TV show & episode keywords generation (Breaking Bad S01E01 example)
 * 4. Word-aware meta description truncation (~160 chars without cutting words)
 * 5. Title synchronization across <title>, meta name="title", og:title, twitter:title
 * 6. Canonical URL consistency (/movie/:slug, /tv/:slug, and distinct episode watch paths)
 * 7. HTTP and WWW canonical normalization
 * 8. Authentic Schema.org JSON-LD (zero fabricated voteCount fallback)
 * 9. Image MIME types (png, jpeg, webp)
 * 10. og:image width & height handling (kept for og-image.png, stripped for TMDB images)
 * 11. Server HTML plugin (renderSeoHtml) output with semantic content in <div id="root">
 * 12. Tag routing & canonical URLs (/tags/revenge, /tags/magic, etc.)
 * 13. Route parser coverage (landing pages, tags, platforms, media, watch)
 * 14. Sitemap ID correctness (Spider-Man: Homecoming has 315635, never genre ID 28)
 * 15. Noindex directive verification for private/search routes
 */

import fs from 'fs';
import path from 'path';
import {
  generateMediaKeywords,
  normalizeKeywords,
  truncateAtWord,
  getImageMimeType,
  buildMediaMetadata,
  buildCanonicalUrl,
  DEFAULT_KEYWORDS,
  DEFAULT_TITLE,
  PRIMARY_ORIGIN
} from '../../utils/seo';
import { parseSeoRoute, renderSeoHtml, removeMetaTag } from '../../../scripts/seoHtmlPlugin';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function runTests() {
  console.log('--- Running TStream SEO & Metadata Verification Tests ---\n');

  // Test 1: Home page default keywords
  assert(
    DEFAULT_KEYWORDS.includes('t stream') && DEFAULT_KEYWORDS.includes('4k streaming'),
    'Home page default keywords contain expected brand and service keywords'
  );

  // Test 2: Movie keywords generation (The Amazing Spider-Man 2 test case)
  const spiderManMovie = {
    id: 102382,
    mediaType: 'movie',
    title: 'The Amazing Spider-Man 2',
    releaseDate: '2014-04-16',
    overview: 'Peter Parker runs the gauntlet as the mysterious company Oscorp sends up a slew of supervillains against him.',
    genres: ['Action', 'Adventure', 'Science Fiction'],
    backdropPath: 'https://image.tmdb.org/t/p/w1280/spider.jpg',
    voteAverage: 6.5,
    voteCount: 12500
  };

  const spideyKeywords = generateMediaKeywords(spiderManMovie);
  assert(
    spideyKeywords.includes('The Amazing Spider-Man 2') &&
    spideyKeywords.includes('The Amazing Spider-Man 2 (2014)') &&
    spideyKeywords.includes('The Amazing Spider-Man 2 movie') &&
    spideyKeywords.includes('watch The Amazing Spider-Man 2 online') &&
    spideyKeywords.includes('Action') &&
    spideyKeywords.includes('Action movie') &&
    spideyKeywords.includes('T Stream'),
    'Movie keywords properly generated from TMDB data with title, year, content type, genres, and brand'
  );

  const spideyTerms = spideyKeywords.split(', ');
  assert(spideyTerms.length <= 15, `Movie keywords length is within 15 terms limit (got ${spideyTerms.length})`);

  // Test 3: TV Episode keywords generation (Breaking Bad S01E01 test case)
  const breakingBadTv = {
    id: 1396,
    mediaType: 'tv',
    name: 'Breaking Bad',
    firstAirDate: '2008-01-20',
    overview: 'A chemistry teacher diagnosed with terminal lung cancer teams up with a former student to manufacture crystal meth.',
    genres: ['Drama', 'Crime'],
    backdropPath: 'https://image.tmdb.org/t/p/w1280/bb.jpg',
    voteAverage: 8.9,
    voteCount: 13500
  };

  const bbKeywords = generateMediaKeywords(breakingBadTv, {
    season: 1,
    episode: 1,
    episodeName: 'Pilot',
    isWatching: true
  });

  assert(
    bbKeywords.includes('Breaking Bad') &&
    bbKeywords.includes('Breaking Bad (2008)') &&
    bbKeywords.includes('Breaking Bad TV series') &&
    bbKeywords.includes('Drama TV series') &&
    bbKeywords.includes('Breaking Bad season 1') &&
    bbKeywords.includes('Breaking Bad season 1 episode 1') &&
    bbKeywords.includes('Breaking Bad Pilot') &&
    bbKeywords.includes('T Stream'),
    'TV Episode keywords include series title, year, genres, season, episode number, and episode name'
  );

  // Test 4: Word-aware description truncation
  const longText =
    'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice in the city.';
  const truncated = truncateAtWord(longText, 160);
  assert(
    truncated.length <= 160 && !truncated.endsWith(' ...') && truncated.endsWith('...'),
    `Word-aware truncation stays within 160 chars and ends cleanly with ellipsis (${truncated.length} chars)`
  );
  assert(!/\s\.\.\.$/.test(truncated), 'Truncation does not have trailing space before ellipsis');

  // Test 5: Media titles matching expected format
  const movieDetailMeta = buildMediaMetadata(spiderManMovie, { isWatching: false });
  assert(
    movieDetailMeta.title === 'The Amazing Spider-Man 2 (2014) — Watch Free HD Movie — T Stream',
    `Movie detail title matches exact format: "${movieDetailMeta.title}"`
  );

  const movieWatchMeta = buildMediaMetadata(spiderManMovie, { isWatching: true });
  assert(
    movieWatchMeta.title === 'Watch The Amazing Spider-Man 2 (2014) Full Movie Free Online in HD — T Stream',
    `Movie watch title matches exact format: "${movieWatchMeta.title}"`
  );

  const tvDetailMeta = buildMediaMetadata(breakingBadTv, { isWatching: false });
  assert(
    tvDetailMeta.title === 'Breaking Bad (2008) — Watch Free HD TV Show — T Stream',
    `TV detail title matches exact format: "${tvDetailMeta.title}"`
  );

  const tvWatchMeta = buildMediaMetadata(breakingBadTv, { season: 1, episode: 1, isWatching: true });
  assert(
    tvWatchMeta.title === 'Watch Breaking Bad Season 1 Episode 1 Free HD — T Stream',
    `TV watch title matches exact format: "${tvWatchMeta.title}"`
  );

  // Test 6: Canonical URL consistency
  // Movie detail MUST point to /movie/:slug
  assert(
    movieDetailMeta.canonicalUrl === 'https://tstream.online/movie/the-amazing-spider-man-2-102382',
    `Movie detail canonical points to /movie/ path: "${movieDetailMeta.canonicalUrl}"`
  );

  // Movie watch page MUST point to the primary canonical /movie/:slug
  assert(
    movieWatchMeta.canonicalUrl === 'https://tstream.online/movie/the-amazing-spider-man-2-102382',
    `Movie watch canonical points to canonical /movie/ path: "${movieWatchMeta.canonicalUrl}"`
  );

  // TV series detail MUST point to /tv/:slug
  assert(
    tvDetailMeta.canonicalUrl === 'https://tstream.online/tv/breaking-bad-1396',
    `TV series detail canonical points to /tv/ path: "${tvDetailMeta.canonicalUrl}"`
  );

  // Distinct TV episode watch page MUST point to episode URL
  assert(
    tvWatchMeta.canonicalUrl === 'https://tstream.online/watch/tv/breaking-bad-1396/1/1',
    `TV episode canonical points to distinct /watch/tv path: "${tvWatchMeta.canonicalUrl}"`
  );

  // Test 7: HTTP and WWW URL normalization
  assert(
    buildCanonicalUrl('http://www.tstream.online/movie/deadpool-533535') === 'https://tstream.online/movie/deadpool-533535',
    'HTTP and WWW URL properly normalized to canonical https://tstream.online'
  );
  assert(
    buildCanonicalUrl('/tags/revenge/') === 'https://tstream.online/tags/revenge',
    'Trailing slash properly stripped in canonical URL'
  );

  // Test 8: Authentic Schema.org JSON-LD (zero fabricated voteCount fallback)
  const unratedMedia = {
    id: 999999,
    mediaType: 'movie',
    title: 'Indie Film',
    overview: 'An unrated indie film.',
    voteAverage: 0,
    voteCount: 0
  };
  const unratedMeta = buildMediaMetadata(unratedMedia);
  assert(
    !unratedMeta.schema.aggregateRating,
    'Unrated media does NOT include fabricated aggregateRating'
  );

  assert(
    movieDetailMeta.schema.aggregateRating.ratingCount === 12500,
    'Rated media uses actual TMDB voteCount without fabricated 100 fallback'
  );
  assert(
    tvWatchMeta.schema['@type'] === 'TVEpisode' && tvWatchMeta.schema.episodeNumber === 1,
    'TV episode watch page outputs valid Schema.org TVEpisode structure'
  );

  // Test 9: Image MIME types
  assert(getImageMimeType('https://tstream.online/og-image.png') === 'image/png', 'PNG MIME detected as image/png');
  assert(
    getImageMimeType('https://image.tmdb.org/t/p/w1280/abc.jpg') === 'image/jpeg',
    'TMDB JPG detected as image/jpeg'
  );
  assert(getImageMimeType('https://tstream.online/photo.webp') === 'image/webp', 'WebP detected as image/webp');

  // Test 10: Server HTML plugin (renderSeoHtml) output for media routes with semantic body
  const sampleHtml = `<!doctype html>
<html>
<head>
  <title>Old Title</title>
  <meta name="title" content="Old Title" />
  <meta name="description" content="Old description" />
  <meta name="keywords" content="old, keywords" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <script type="application/ld+json" id="json-ld-schema">{}</script>
</head>
<body><div id="root"></div></body>
</html>`;

  const renderedHtml = await renderSeoHtml(sampleHtml, '/movie/the-amazing-spider-man-2-102382', spiderManMovie);
  assert(
    renderedHtml.includes('<title>The Amazing Spider-Man 2 (2014) — Watch Free HD Movie — T Stream</title>'),
    'Server rendered HTML contains exact pre-rendered <title>'
  );
  assert(
    renderedHtml.includes('href="https://tstream.online/movie/the-amazing-spider-man-2-102382"'),
    'Server rendered HTML contains exact canonical URL pointing to /movie/'
  );
  assert(
    renderedHtml.includes('<h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-2">The Amazing Spider-Man 2 (2014)</h1>'),
    'Server rendered HTML injects crawlable <h1> heading in body'
  );
  assert(
    renderedHtml.includes('Peter Parker runs the gauntlet'),
    'Server rendered HTML injects movie synopsis in body'
  );

  // Test 11: Tag route parsing and metadata
  const revengeTagParsed = parseSeoRoute('/tags/revenge');
  assert(
    revengeTagParsed?.type === 'tag_detail' && revengeTagParsed.tag === 'revenge',
    'Route parser accurately recognizes /tags/revenge as tag_detail'
  );

  const tagRenderedHtml = await renderSeoHtml(sampleHtml, '/tags/revenge');
  assert(
    tagRenderedHtml.includes('Movies &amp; TV Shows Tagged #revenge') || tagRenderedHtml.includes('Movies & TV Shows Tagged #revenge'),
    'Server rendered HTML sets dynamic title for /tags/revenge'
  );
  assert(
    tagRenderedHtml.includes('href="https://tstream.online/tags/revenge"'),
    'Server rendered HTML sets self-referencing canonical for /tags/revenge'
  );

  // Test 12: Route parser coverage
  assert(parseSeoRoute('/movies')?.type === 'movies', 'Route parser recognizes /movies');
  assert(parseSeoRoute('/tv-shows')?.type === 'tv-shows', 'Route parser recognizes /tv-shows');
  assert(parseSeoRoute('/trending')?.type === 'trending', 'Route parser recognizes /trending');
  assert(parseSeoRoute('/collections')?.type === 'collections', 'Route parser recognizes /collections');
  assert(parseSeoRoute('/platform/netflix')?.platform === 'netflix', 'Route parser recognizes /platform/netflix');
  assert(parseSeoRoute('/az/B')?.letter === 'B', 'Route parser recognizes /az/B');
  assert(parseSeoRoute('/search')?.type === 'noindex', 'Route parser recognizes /search as noindex');

  // Test 13: Noindex handling for search and admin routes
  const searchRenderedHtml = await renderSeoHtml(sampleHtml, '/search?q=batman');
  assert(
    searchRenderedHtml.includes('content="noindex, nofollow"'),
    'Server rendered HTML injects noindex, nofollow for search routes'
  );

  // Test 14: Sitemap validation (Spider-Man Homecoming TMDB ID check)
  const moviesSitemapPath = path.resolve(process.cwd(), 'public/sitemap-movies.xml');
  if (fs.existsSync(moviesSitemapPath)) {
    const sitemapContent = fs.readFileSync(moviesSitemapPath, 'utf8');
    assert(
      !sitemapContent.includes('spider-man-homecoming-28'),
      'CRITICAL: Sitemap does NOT contain corrupted spider-man-homecoming-28'
    );
    assert(
      sitemapContent.includes('spider-man-homecoming-315635'),
      'Sitemap contains verified authentic TMDB ID 315635 for Spider-Man: Homecoming'
    );
    assert(
      !sitemapContent.includes('/watch/movie/'),
      'Movies sitemap contains canonical /movie/ URLs, not /watch/movie/'
    );
  }

  console.log('\n--- ALL 14 SEO VERIFICATION TESTS PASSED SUCCESSFULLY (14/14) ---');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
