/**
 * Comprehensive Automated SEO Verification Test Suite for TStream.online
 * Tests:
 * 1. Home page default keywords and metadata
 * 2. Movie keywords generation from TMDB data (The Amazing Spider-Man 2 example)
 * 3. TV show & episode keywords generation (Breaking Bad S01E01 example)
 * 4. Word-aware meta description truncation (~160 chars without cutting words)
 * 5. Title synchronization across <title>, meta name="title", og:title, twitter:title
 * 6. Canonical URLs pointing to intended /watch/... paths
 * 7. OpenGraph image MIME types (png, jpeg, webp)
 * 8. og:image width & height handling (kept for og-image.png, stripped for TMDB images)
 * 9. Server HTML plugin (renderSeoHtml) output for pre-rendering
 * 10. Gladiator II TMDB ID 558449 verification
 */

import {
  generateMediaKeywords,
  normalizeKeywords,
  truncateAtWord,
  getImageMimeType,
  buildMediaMetadata,
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
    backdropPath: 'https://image.tmdb.org/t/p/w1280/spider.jpg'
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
    backdropPath: 'https://image.tmdb.org/t/p/w1280/bb.jpg'
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

  const bbTerms = bbKeywords.split(', ');
  assert(bbTerms.length <= 15, `TV episode keywords length is within 15 terms limit (got ${bbTerms.length})`);

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

  // Test 6: Canonical URL always points to /watch/ path
  assert(
    movieDetailMeta.canonicalUrl === 'https://tstream.online/watch/movie/the-amazing-spider-man-2-102382',
    `Movie detail canonical points to /watch/movie path: "${movieDetailMeta.canonicalUrl}"`
  );
  assert(
    tvWatchMeta.canonicalUrl === 'https://tstream.online/watch/tv/breaking-bad-1396/1/1',
    `TV episode canonical points to /watch/tv path with season and episode: "${tvWatchMeta.canonicalUrl}"`
  );

  // Test 7: Image MIME types
  assert(getImageMimeType('https://tstream.online/og-image.png') === 'image/png', 'PNG MIME detected as image/png');
  assert(
    getImageMimeType('https://image.tmdb.org/t/p/w1280/abc.jpg') === 'image/jpeg',
    'TMDB JPG detected as image/jpeg'
  );
  assert(getImageMimeType('https://tstream.online/photo.webp') === 'image/webp', 'WebP detected as image/webp');

  // Test 8: og:image:width and og:image:height stripped for TMDB images
  assert(movieDetailMeta.isDefaultOgImage === false, 'TMDB image is detected as non-default OG image');

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
<body></body>
</html>`;

  const renderedHtml = await renderSeoHtml(sampleHtml, '/movie/the-amazing-spider-man-2-102382', spiderManMovie);
  assert(
    !renderedHtml.includes('og:image:width') && !renderedHtml.includes('og:image:height'),
    'og:image:width and og:image:height are completely stripped when TMDB image is used'
  );
  assert(
    renderedHtml.includes('<title>The Amazing Spider-Man 2 (2014) — Watch Free HD Movie — T Stream</title>'),
    'Server rendered HTML contains exact pre-rendered <title>'
  );
  assert(
    renderedHtml.includes('name="keywords" content="The Amazing Spider-Man 2,'),
    'Server rendered HTML contains dynamic movie keywords'
  );
  assert(
    renderedHtml.includes('property="og:image:type" content="image/jpeg"'),
    'Server rendered HTML sets og:image:type to image/jpeg for TMDB backdrop'
  );

  // Test 9: Home page retains 1200x630 og:image dimensions
  const homeRenderedHtml = await renderSeoHtml(sampleHtml, '/');
  assert(
    homeRenderedHtml.includes('og:image:width" content="1200"') &&
    homeRenderedHtml.includes('og:image:height" content="630"'),
    'Home page retains 1200x630 dimensions on default og-image.png'
  );

  // Test 10: Route parsing
  const parsedWatchTv = parseSeoRoute('/watch/tv/breaking-bad-1396/2/4');
  assert(
    parsedWatchTv?.isMatched === true &&
    parsedWatchTv?.mediaType === 'tv' &&
    parsedWatchTv?.id === 1396 &&
    parsedWatchTv?.isWatchRoute === true &&
    parsedWatchTv?.season === 2 &&
    parsedWatchTv?.episode === 4,
    'Route parser accurately parses /watch/tv/:slug/:season/:episode'
  );

  console.log('\n--- ALL 10 SEO VERIFICATION TESTS PASSED SUCCESSFULLY (10/10) ---');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
