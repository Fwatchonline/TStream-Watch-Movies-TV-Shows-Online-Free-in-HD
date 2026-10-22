import { queryLocalCatalog } from '../tmdb';
import { normalizeLanguageCode } from '../subtitles';

function runTests() {
  console.log('--- Running TStream Pagination & Integration Tests ---');
  let failures = 0;

  // Test 1: Page 1 vs Page 2 differentiation
  const page1 = queryLocalCatalog({ page: 1 });
  const page2 = queryLocalCatalog({ page: 2 });

  if (page1.results.length === 0 || page2.results.length === 0) {
    console.error('FAIL: Expected results on both page 1 and page 2');
    failures++;
  } else if (page1.results[0].id === page2.results[0].id) {
    console.error('FAIL: Page 1 and Page 2 returned duplicate first records');
    failures++;
  } else {
    console.log('PASS: Page 1 and Page 2 return distinct offset records');
  }

  // Test 2: Handling invalid and out-of-range pages
  const invalidNegative = queryLocalCatalog({ page: -5 });
  if (invalidNegative.page !== 1) {
    console.error('FAIL: Negative page should clamp to 1');
    failures++;
  } else {
    console.log('PASS: Negative page successfully clamped to 1');
  }

  const outOfRange = queryLocalCatalog({ page: 9999 });
  if (outOfRange.page > outOfRange.totalPages) {
    console.error('FAIL: Out of range page should clamp to totalPages');
    failures++;
  } else {
    console.log('PASS: Out-of-range page successfully clamped to totalPages');
  }

  // Test 3: Filter preservation across pages
  const moviesPage1 = queryLocalCatalog({ mediaType: 'movie', page: 1 });
  const moviesPage2 = queryLocalCatalog({ mediaType: 'movie', page: 2 });

  const allMoviesP1 = moviesPage1.results.every(r => r.mediaType === 'movie');
  const allMoviesP2 = moviesPage2.results.every(r => r.mediaType === 'movie');

  if (!allMoviesP1 || !allMoviesP2) {
    console.error('FAIL: Media type filter not preserved across pages');
    failures++;
  } else {
    console.log('PASS: Media type filter preserved across page 1 and page 2');
  }

  // Test 4: Subtitle code normalization
  const sr = normalizeLanguageCode('sr');
  const hr = normalizeLanguageCode('croatian');
  const bs = normalizeLanguageCode('bs');
  const en = normalizeLanguageCode('english');

  if (sr.normalizedCode !== 'sr' || hr.normalizedCode !== 'hr' || bs.normalizedCode !== 'bs' || en.normalizedCode !== 'en') {
    console.error('FAIL: Subtitle language code normalization error');
    failures++;
  } else {
    console.log('PASS: Subtitle language normalization verified (sr, hr, bs, en)');
  }

  if (failures === 0) {
    console.log('ALL TESTS PASSED SUCCESSFULLY (4/4)');
  } else {
    process.exit(1);
  }
}

runTests();
