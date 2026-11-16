/**
 * Automated Production & Staging HTTP SEO Verification Script for TStream.online
 *
 * Usage:
 *   npx tsx scripts/verify-production.ts
 *   npx tsx scripts/verify-production.ts --base-url=http://127.0.0.1:3099
 */

import fs from 'fs';
import path from 'path';

const GOOGLEBOT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

function getBaseUrl(): string {
  const arg = process.argv.find(a => a.startsWith('--base-url='));
  const raw = arg ? arg.split('=')[1] : process.env.APP_URL || 'https://tstream.online';
  return raw.replace(/\/+$/, '');
}

function getExpectedCommit(): string {
  const arg = process.argv.find(a => a.startsWith('--expected-commit='));
  return (arg ? arg.split('=')[1] : process.env.APP_COMMIT_SHA || '').trim();
}

function shouldCheckLocalDist(): boolean {
  if (process.argv.includes('--skip-dist')) return false;
  return fs.existsSync(path.resolve(process.cwd(), 'dist', 'prerender-report.json'));
}

function extractCanonical(html: string): { count: number; href: string | null } {
  const tags = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi) || [];
  if (tags.length === 0) return { count: 0, href: null };
  const first = tags[0] || '';
  const hrefMatch = first.match(/href=["']([^"']+)["']/i);
  return { count: tags.length, href: hrefMatch ? hrefMatch[1] : null };
}

function extractRobots(html: string): string {
  const m =
    html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']robots["'][^>]*>/i);
  return m ? m[1].toLowerCase() : '';
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractDescription(html: string): string {
  const m =
    html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  return m ? m[1].trim() : '';
}

function extractJsonLd(html: string): Record<string, any> | null {
  const m = html.match(/<script\s+[^>]*id=["']json-ld-schema["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function extractCardTitles(html: string): string[] {
  const matches = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
  return matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
}

async function fetchHtml(baseUrl: string, route: string, ua: string, method: 'GET' | 'HEAD' = 'GET') {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: { 'User-Agent': ua, Accept: 'text/html' },
    redirect: 'manual'
  });
  const body = method === 'HEAD' ? '' : await res.text();
  return { status: res.status, headers: res.headers, body };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await worker(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

async function run() {
  const baseUrl = getBaseUrl();
  const checkDist = shouldCheckLocalDist();
  const distDir = path.resolve(process.cwd(), 'dist');

  console.log(`=== TStream Production SEO & Server Verification: ${baseUrl} (dist parity: ${checkDist}) ===\n`);
  const results: CheckResult[] = [];

  const record = (name: string, ok: boolean, detail: string) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  };

  // 1. Health & Runtime identity
  const expectedCommit = getExpectedCommit();
  try {
    const hRes = await fetch(`${baseUrl}/api/health`);
    const hJson: any = await hRes.json().catch(() => null);
    const hasCommitFields = Boolean(hJson?.version && hJson?.commitSha);
    const commitMatches = !expectedCommit || hJson?.commitSha === expectedCommit;
    record(
      'GET /api/health',
      hRes.status === 200 &&
        hJson?.status === 'ok' &&
        hJson?.service === 'tstream-production' &&
        hasCommitFields &&
        commitMatches,
      `HTTP ${hRes.status}, status=${hJson?.status}, commitSha=${hJson?.commitSha || 'missing'}`
    );
  } catch (err: any) {
    record('GET /api/health', false, err.message);
  }

  // 2. API Input Validation, CORS & SSRF Security Checks (must NOT return 200!)
  const apiChecks: Array<{ path: string; expectedStatus: number; label: string; headers?: Record<string, string> }> = [
    { path: '/api/stream-resolve', expectedStatus: 400, label: 'Missing tmdbId on /api/stream-resolve' },
    { path: '/api/stream/movie/invalid-id', expectedStatus: 400, label: 'Invalid numeric ID on /api/stream' },
    { path: '/api/proxy', expectedStatus: 400, label: 'Missing url on /api/proxy' },
    { path: '/api/proxy?url=http://127.0.0.1/secret', expectedStatus: 403, label: 'SSRF loopback blocked on /api/proxy' },
    { path: '/api/subtitle-proxy', expectedStatus: 400, label: 'Missing url on /api/subtitle-proxy' },
    { path: '/api/tmdb/unknown/route', expectedStatus: 400, label: 'Disallowed path on /api/tmdb' },
    {
      path: '/api/tmdb/discover/movie?page=1',
      expectedStatus: 403,
      label: 'Untrusted CORS Origin blocked on /api/tmdb',
      headers: { Origin: 'https://untrusted.example.com' }
    },
    { path: '/api/nonexistent-endpoint', expectedStatus: 404, label: 'Unknown /api/* returns 404 JSON' }
  ];

  for (const check of apiChecks) {
    try {
      const apiRes = await fetch(`${baseUrl}${check.path}`, {
        headers: check.headers
      });
      record(check.label, apiRes.status === check.expectedStatus, `HTTP ${apiRes.status}`);
    } catch (err: any) {
      record(check.label, false, err.message);
    }
  }

  // 3. Robots, Sitemaps & Full XML Integrity Validation
  let mainSitemapUrls: string[] = [];
  let moviesSitemapUrls: string[] = [];
  let tvSitemapUrls: string[] = [];
  let episodesSitemapUrls: string[] = [];
  try {
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    const robotsTxt = await robotsRes.text();
    record(
      'Static /robots.txt',
      robotsRes.status === 200 &&
        robotsTxt.includes('Sitemap: https://tstream.online/sitemap.xml') &&
        robotsTxt.includes('Allow: /genre/') &&
        robotsTxt.includes('Allow: /tags/'),
      `HTTP ${robotsRes.status}, bytes=${robotsTxt.length}`
    );

    const idxRes = await fetch(`${baseUrl}/sitemap.xml`);
    const idxXml = await idxRes.text();
    const idxLocs = Array.from(idxXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
    record(
      'Sitemap /sitemap.xml',
      idxRes.status === 200 && idxXml.includes('<sitemapindex') && idxLocs.length >= 3,
      `HTTP ${idxRes.status}, children=${idxLocs.length}`
    );

    const childPaths = Array.from(
      new Set([
        '/sitemap-main.xml',
        '/sitemap-movies.xml',
        '/sitemap-tv.xml',
        ...idxLocs.map(u => {
          try {
            return new URL(u).pathname;
          } catch {
            return '';
          }
        }).filter(Boolean)
      ])
    );

    const allSitemapUrlsSet = new Set<string>();
    let crossSitemapDuplicateCount = 0;

    for (const childPath of childPaths) {
      const r = await fetch(`${baseUrl}${childPath}`);
      const xml = await r.text();
      const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
      const uniqueLocs = new Set(locs);
      for (const u of locs) {
        if (allSitemapUrlsSet.has(u)) crossSitemapDuplicateCount++;
        allSitemapUrlsSet.add(u);
      }
      const validOrigin = locs.every(u => u.startsWith('https://tstream.online/'));
      const noDupWatch = locs.every(u => !u.includes('/watch/movie/'));
      const noBadTags = locs.every(u => !u.includes('/tags/') || (!u.includes('%20') && !/[A-Z]/.test(u)));
      const noFakeLastmod = !/<lastmod>/i.test(xml);
      const noCorrupt = locs.every(
        u => !u.includes('spider-man-homecoming-28') && !u.includes('undefined') && !u.includes('null') && !u.includes('NaN')
      );
      const noUtility = locs.every(
        u =>
          !u.endsWith('/random') &&
          !u.endsWith('/people') &&
          !u.endsWith('/new-episodes') &&
          !u.endsWith('/platform/hbo')
      );

      if (childPath.startsWith('/sitemap-main')) mainSitemapUrls.push(...locs);
      if (childPath.startsWith('/sitemap-movies')) moviesSitemapUrls.push(...locs);
      if (childPath.startsWith('/sitemap-tv')) tvSitemapUrls.push(...locs);
      if (childPath.startsWith('/sitemap-episodes')) episodesSitemapUrls.push(...locs);

      const ok =
        r.status === 200 &&
        xml.includes('<?xml') &&
        xml.includes('<urlset') &&
        locs.length > 0 &&
        locs.length <= 50000 &&
        locs.length === uniqueLocs.size &&
        validOrigin &&
        noDupWatch &&
        noBadTags &&
        noFakeLastmod &&
        noCorrupt &&
        noUtility;

      record(
        `Sitemap ${childPath}`,
        ok,
        `HTTP ${r.status}, urls=${locs.length}, unique=${uniqueLocs.size}, noFakeLastmod=${noFakeLastmod}`
      );
    }

    const totalContentUrls =
      mainSitemapUrls.length + moviesSitemapUrls.length + tvSitemapUrls.length + episodesSitemapUrls.length;
    record(
      'Combined sitemap entries populated without cross-file duplicates',
      totalContentUrls > 20 && crossSitemapDuplicateCount === 0,
      `total=${totalContentUrls} (main=${mainSitemapUrls.length}, movies=${moviesSitemapUrls.length}, tv=${tvSitemapUrls.length}, episodes=${episodesSitemapUrls.length}), crossDupes=${crossSitemapDuplicateCount}`
    );
  } catch (err: any) {
    record('Robots & Sitemaps suite', false, err.message);
  }

  // 4. HEAD Requests Consistency
  for (const headPath of ['/', '/api/health', '/movies?page=2', '/robots.txt']) {
    try {
      const hRes = await fetchHtml(baseUrl, headPath, GOOGLEBOT_UA, 'HEAD');
      record(`HEAD ${headPath}`, hRes.status === 200 && hRes.body.length === 0, `HTTP ${hRes.status}`);
    } catch (err: any) {
      record(`HEAD ${headPath}`, false, err.message);
    }
  }

  // 5. Indexable 200 Routes + Googlebot vs Browser Parity + JSON-LD + Semantic Body + Multiword Tags + Real Genres
  const indexableChecks: Array<{
    path: string;
    expectedCanonical: string;
    expectedJsonLdType?: string;
    requireCards?: boolean;
    distHtmlRel?: string;
  }> = [
    { path: '/', expectedCanonical: 'https://tstream.online/' },
    { path: '/movies', expectedCanonical: 'https://tstream.online/movies', requireCards: true },
    { path: '/movies?page=2', expectedCanonical: 'https://tstream.online/movies?page=2', requireCards: true },
    { path: '/tv-shows', expectedCanonical: 'https://tstream.online/tv-shows', requireCards: true },
    { path: '/trending', expectedCanonical: 'https://tstream.online/trending', requireCards: true },
    { path: '/top-rated', expectedCanonical: 'https://tstream.online/top-rated', requireCards: true },
    { path: '/collections', expectedCanonical: 'https://tstream.online/collections', expectedJsonLdType: 'CollectionPage', distHtmlRel: 'collections/index.html' },
    { path: '/tags', expectedCanonical: 'https://tstream.online/tags' },
    { path: '/tags/revenge', expectedCanonical: 'https://tstream.online/tags/revenge', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'tags/revenge/index.html' },
    { path: '/tags/friendship', expectedCanonical: 'https://tstream.online/tags/friendship', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'tags/friendship/index.html' },
    { path: '/tags/magic', expectedCanonical: 'https://tstream.online/tags/magic', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'tags/magic/index.html' },
    { path: '/tags/time-travel', expectedCanonical: 'https://tstream.online/tags/time-travel', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'tags/time-travel/index.html' },
    { path: '/tags/based-on-novel-or-book', expectedCanonical: 'https://tstream.online/tags/based-on-novel-or-book', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'tags/based-on-novel-or-book/index.html' },
    { path: '/tags/coming-of-age', expectedCanonical: 'https://tstream.online/tags/coming-of-age', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'tags/coming-of-age/index.html' },
    { path: '/tags/school-friend', expectedCanonical: 'https://tstream.online/tags/school-friend', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'tags/school-friend/index.html' },
    { path: '/tags/based-on-comic-book', expectedCanonical: 'https://tstream.online/tags/based-on-comic-book', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'tags/based-on-comic-book/index.html' },
    { path: '/genre/action', expectedCanonical: 'https://tstream.online/genre/action', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'genre/action/index.html' },
    { path: '/genre/comedy', expectedCanonical: 'https://tstream.online/genre/comedy', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'genre/comedy/index.html' },
    { path: '/genre/drama', expectedCanonical: 'https://tstream.online/genre/drama', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'genre/drama/index.html' },
    { path: '/genre/mystery', expectedCanonical: 'https://tstream.online/genre/mystery', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'genre/mystery/index.html' },
    { path: '/genre/science-fiction', expectedCanonical: 'https://tstream.online/genre/science-fiction', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'genre/science-fiction/index.html' },
    { path: '/genre/thriller', expectedCanonical: 'https://tstream.online/genre/thriller', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'genre/thriller/index.html' },
    { path: '/genre/action-adventure', expectedCanonical: 'https://tstream.online/genre/action-adventure', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'genre/action-adventure/index.html' },
    { path: '/genre/sci-fi-fantasy', expectedCanonical: 'https://tstream.online/genre/sci-fi-fantasy', expectedJsonLdType: 'CollectionPage', requireCards: true, distHtmlRel: 'genre/sci-fi-fantasy/index.html' },
    { path: '/platform/netflix', expectedCanonical: 'https://tstream.online/platform/netflix', requireCards: true },
    { path: '/platform/max', expectedCanonical: 'https://tstream.online/platform/max', requireCards: true },
    { path: '/az/S', expectedCanonical: 'https://tstream.online/az/S', requireCards: true },
    { path: '/movie/spider-man-homecoming-315635', expectedCanonical: 'https://tstream.online/movie/spider-man-homecoming-315635', expectedJsonLdType: 'Movie' },
    { path: '/watch/movie/spider-man-homecoming-315635', expectedCanonical: 'https://tstream.online/movie/spider-man-homecoming-315635', expectedJsonLdType: 'Movie' },
    { path: '/tv/breaking-bad-1396', expectedCanonical: 'https://tstream.online/tv/breaking-bad-1396', expectedJsonLdType: 'TVSeries' },
    { path: '/watch/tv/breaking-bad-1396/1/1', expectedCanonical: 'https://tstream.online/watch/tv/breaking-bad-1396/1/1', expectedJsonLdType: 'TVEpisode' }
  ];

  let moviesP1Cards: string[] = [];
  let moviesP2Cards: string[] = [];

  for (const item of indexableChecks) {
    try {
      const [bot, user] = await Promise.all([
        fetchHtml(baseUrl, item.path, GOOGLEBOT_UA),
        fetchHtml(baseUrl, item.path, BROWSER_UA)
      ]);
      const canBot = extractCanonical(bot.body);
      const canUser = extractCanonical(user.body);
      const robotsBot = extractRobots(bot.body);
      const titleBot = extractTitle(bot.body);
      const titleUser = extractTitle(user.body);
      const descBot = extractDescription(bot.body);
      const jsonLd = extractJsonLd(bot.body);
      const cards = extractCardTitles(bot.body);
      const hasH1 = /<h1[^>]*>[\s\S]+?<\/h1>/i.test(bot.body);
      const hasContent = bot.body.includes('id="seo-prerender"');
      const jsonLdOk =
        Boolean(jsonLd && jsonLd['@context'] === 'https://schema.org') &&
        (!item.expectedJsonLdType || jsonLd?.['@type'] === item.expectedJsonLdType);

      if (item.path === '/movies') moviesP1Cards = cards;
      if (item.path === '/movies?page=2') moviesP2Cards = cards;
      if (item.path === '/top-rated') {
        const hasMovieLink = /href="\/movie\//i.test(bot.body);
        const hasTvLink = /href="\/tv\//i.test(bot.body);
        record(
          'Balanced /top-rated includes both movies & TV shows',
          hasMovieLink && hasTvLink,
          `hasMovieLink=${hasMovieLink}, hasTvLink=${hasTvLink}`
        );
      }
      if (item.path === '/collections') {
        const collectionHeadings = (bot.body.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || []).length;
        const collectionLinks = (bot.body.match(/href="\/movie\//gi) || []).length;
        record(
          'Franchises /collections renders real collection cards and movie links',
          collectionHeadings >= 4 && collectionLinks >= 10,
          `collections=${collectionHeadings}, movieLinks=${collectionLinks}`
        );
      }
      if (item.path === '/platform/netflix') {
        const hasRegionScope = bot.body.includes('(US)') || bot.body.includes('region US');
        record('Platform /platform/netflix declares default watch region US', hasRegionScope, `hasRegionScope=${hasRegionScope}`);
      }
      if (item.path === '/watch/tv/breaking-bad-1396/1/1') {
        const leakedParentRating =
          jsonLd?.aggregateRating?.ratingValue === 8.9 && jsonLd?.aggregateRating?.ratingCount === 13500;
        record(
          'TVEpisode /watch/tv/breaking-bad-1396/1/1 does NOT inherit parent series aggregateRating',
          Boolean(jsonLd && jsonLd['@type'] === 'TVEpisode' && !leakedParentRating),
          `hasAggregateRating=${Boolean(jsonLd?.aggregateRating)}, leakedParent=${leakedParentRating}`
        );
      }
      if (item.path === '/genre/action-adventure') {
        const hasTvLinks = /href="\/tv\//i.test(bot.body);
        const hasMovieLinks = /href="\/movie\//i.test(bot.body);
        record(
          'Genre /genre/action-adventure renders TV series only without movie bleed',
          hasTvLinks && !hasMovieLinks,
          `hasTvLinks=${hasTvLinks}, hasMovieLinks=${hasMovieLinks}`
        );
      }
      if (checkDist && item.distHtmlRel) {
        const diskPath = path.join(distDir, item.distHtmlRel);
        const diskExists = fs.existsSync(diskPath);
        const diskCan = diskExists ? extractCanonical(fs.readFileSync(diskPath, 'utf8')).href : null;
        record(
          `Dist disk parity ${item.distHtmlRel}`,
          diskExists && diskCan === item.expectedCanonical,
          `exists=${diskExists}, canonical=${diskCan}`
        );
      }

      const ok =
        bot.status === 200 &&
        user.status === 200 &&
        canBot.count === 1 &&
        canBot.href === item.expectedCanonical &&
        canUser.href === canBot.href &&
        !robotsBot.includes('noindex') &&
        Boolean(titleBot) &&
        Boolean(descBot) &&
        titleBot === titleUser &&
        hasH1 &&
        hasContent &&
        jsonLdOk &&
        (!item.requireCards || cards.length > 0);

      record(
        `Indexable ${item.path}`,
        ok,
        `HTTP=${bot.status}/${user.status}, canonical=${canBot.href}, cards=${cards.length}, jsonld=${jsonLd?.['@type'] || 'none'}`
      );
    } catch (err: any) {
      record(`Indexable ${item.path}`, false, err.message);
    }
  }

  // Verify genuine pagination difference on /movies vs /movies?page=2
  const distinctPages =
    moviesP1Cards.length > 0 &&
    moviesP2Cards.length > 0 &&
    moviesP1Cards[0] !== moviesP2Cards[0];
  record(
    'Pagination /movies vs /movies?page=2 distinct items',
    distinctPages,
    `p1[0]="${moviesP1Cards[0] || 'none'}", p2[0]="${moviesP2Cards[0] || 'none'}"`
  );

  // 6. Query Parameter Policy, Filters, Legacy Aliases, Search, Empty A-Z, Utility -> 200 + noindex
  const noindexChecks: Array<{ path: string; expectedCanonical: string; expectNoindex: boolean }> = [
    { path: '/movies?genreId=28&year=2024', expectedCanonical: 'https://tstream.online/movies', expectNoindex: true },
    { path: '/movies?sortBy=vote_average.desc', expectedCanonical: 'https://tstream.online/movies', expectNoindex: true },
    { path: '/movies?country=US', expectedCanonical: 'https://tstream.online/movies', expectNoindex: true },
    { path: '/movies?mediaType=movie', expectedCanonical: 'https://tstream.online/movies', expectNoindex: true },
    { path: '/movies?unknownParam=foo', expectedCanonical: 'https://tstream.online/movies', expectNoindex: true },
    { path: '/movies?page=0', expectedCanonical: 'https://tstream.online/movies', expectNoindex: true },
    { path: '/movies?page=9999', expectedCanonical: 'https://tstream.online/movies', expectNoindex: true },
    { path: '/movies?page=1&utm_source=test', expectedCanonical: 'https://tstream.online/movies', expectNoindex: false },
    { path: '/tag/revenge', expectedCanonical: 'https://tstream.online/tags/revenge', expectNoindex: true },
    { path: '/tags/time%20travel', expectedCanonical: 'https://tstream.online/tags/time-travel', expectNoindex: true },
    { path: '/genre/sci-fi', expectedCanonical: 'https://tstream.online/genre/science-fiction', expectNoindex: true },
    { path: '/platform/hbo', expectedCanonical: 'https://tstream.online/platform/max', expectNoindex: true },
    { path: '/search?q=batman', expectedCanonical: 'https://tstream.online/search', expectNoindex: true },
    { path: '/random', expectedCanonical: 'https://tstream.online/random', expectNoindex: true }
  ];

  for (const item of noindexChecks) {
    try {
      const res = await fetchHtml(baseUrl, item.path, GOOGLEBOT_UA);
      const can = extractCanonical(res.body);
      const robots = extractRobots(res.body);
      const ok =
        res.status === 200 &&
        (item.expectNoindex ? robots.includes('noindex') : !robots.includes('noindex')) &&
        can.count === 1 &&
        can.href === item.expectedCanonical;
      record(
        `Query/Noindex ${item.path}`,
        ok,
        `HTTP=${res.status}, robots="${robots}", canonical=${can.href}`
      );
    } catch (err: any) {
      record(`Query/Noindex ${item.path}`, false, err.message);
    }
  }

  // Parity checks for platforms, genres & A-Z letters (including offline-empty /az/Z & /az/Q)
  for (const parityRoute of [
    { url: '/platform/crunchyroll', fullUrl: 'https://tstream.online/platform/crunchyroll', label: 'Platform /platform/crunchyroll' },
    { url: '/genre/western', fullUrl: 'https://tstream.online/genre/western', label: 'Genre /genre/western' },
    { url: '/genre/horror', fullUrl: 'https://tstream.online/genre/horror', label: 'Genre /genre/horror' },
    { url: '/az/Q', fullUrl: 'https://tstream.online/az/Q', label: 'A-Z /az/Q' },
    { url: '/az/Z', fullUrl: 'https://tstream.online/az/Z', label: 'A-Z /az/Z' }
  ]) {
    try {
      const res = await fetchHtml(baseUrl, parityRoute.url, GOOGLEBOT_UA);
      const robots = extractRobots(res.body);
      const inSitemap = mainSitemapUrls.includes(parityRoute.fullUrl);
      const isNoindex = robots.includes('noindex');
      const cards = extractCardTitles(res.body);
      const hasCards = cards.length > 0;
      const ok = res.status === 200 && (!inSitemap ? isNoindex && !hasCards : !isNoindex && hasCards);
      record(
        `${parityRoute.label} sitemap-indexability parity`,
        ok,
        `HTTP=${res.status}, inSitemap=${inSitemap}, noindex=${isNoindex}, cards=${hasCards}`
      );
      if (parityRoute.url === '/genre/horror') {
        const clean =
          !cards.includes('The Batman') && !cards.includes('Stranger Things') && !cards.includes('Severance');
        record(
          'Genre /genre/horror excludes Mystery (9648) cross-contamination',
          clean,
          `cards=${cards.length}, clean=${clean}`
        );
      }
    } catch (err: any) {
      record(`${parityRoute.label} sitemap-indexability parity`, false, err.message);
    }
  }

  // 7. Genuine 404 routes -> MUST return HTTP 404 (not 200!)
  const notFoundChecks = [
    '/movie/999999999-nonexistent-movie',
    '/tv/999999999-nonexistent-show',
    '/tags/nonexistent-tag-xyz-999',
    '/genre/nonexistent-genre',
    '/watch/tv/breaking-bad-1396/99/99',
    '/watch/tv/breaking-bad-1396/2/99',
    '/watch/tv/breaking-bad-1396/1/999',
    '/platform/nonexistent-platform-xyz',
    '/nonexistent-page-xyz',
    '/assets/nonexistent-chunk-xyz.js'
  ];

  for (const p of notFoundChecks) {
    try {
      const res = await fetchHtml(baseUrl, p, GOOGLEBOT_UA);
      const isAsset = p.endsWith('.js');
      const robots = isAsset ? '' : extractRobots(res.body);
      const ok = res.status === 404 && (isAsset || robots.includes('noindex'));
      record(`404 ${p}`, ok, `HTTP=${res.status}${isAsset ? '' : `, robots="${robots}"`}`);
    } catch (err: any) {
      record(`404 ${p}`, false, err.message);
    }
  }

  // 8. Redirect checks (only when running against public non-localhost domain)
  const parsedBase = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost'].includes(parsedBase.hostname)) {
    const bareHost = parsedBase.hostname.replace(/^www\./, '');
    for (const redirectOrigin of [`http://${bareHost}`, `https://www.${bareHost}`]) {
      try {
        const res = await fetch(`${redirectOrigin}/`, { redirect: 'manual' });
        const loc = res.headers.get('location') || '';
        const ok = (res.status === 301 || res.status === 308) && loc.startsWith(`https://${bareHost}/`);
        record(`Redirect ${redirectOrigin}/`, ok, `HTTP=${res.status}, Location=${loc}`);
      } catch (err: any) {
        record(`Redirect ${redirectOrigin}/`, false, err.message);
      }
    }
  }

  // 9. Bounded-Concurrency Sitemap URL Verification (all main + sample episodes + head/tail movies & TV)
  const samplePool = [
    ...mainSitemapUrls,
    ...episodesSitemapUrls.slice(0, 25),
    ...episodesSitemapUrls.slice(-10),
    ...moviesSitemapUrls.slice(0, 25),
    ...moviesSitemapUrls.slice(-15),
    ...tvSitemapUrls.slice(0, 15),
    ...tvSitemapUrls.slice(-10)
  ];
  const uniqueSample = Array.from(new Set(samplePool));
  const crawlFailures: string[] = [];
  let server5xxCount = 0;

  await mapWithConcurrency(uniqueSample, 4, async fullUrl => {
    const pathname = new URL(fullUrl).pathname;
    try {
      const res = await fetchHtml(baseUrl, pathname, GOOGLEBOT_UA);
      if (res.status >= 500) server5xxCount++;
      const can = extractCanonical(res.body);
      const robots = extractRobots(res.body);
      const title = extractTitle(res.body);
      const hasH1 = /<h1[^>]*>[\s\S]+?<\/h1>/i.test(res.body);
      if (
        res.status !== 200 ||
        can.count !== 1 ||
        can.href !== fullUrl ||
        robots.includes('noindex') ||
        !title ||
        !hasH1
      ) {
        crawlFailures.push(`${pathname} (HTTP=${res.status}, can=${can.href}, robots=${robots})`);
      }
    } catch (err: any) {
      crawlFailures.push(`${pathname} (${err.message})`);
    }
  });

  record(
    'Bounded-concurrency sitemap URL verification',
    crawlFailures.length === 0 && server5xxCount === 0 && uniqueSample.length > 20,
    `checked=${uniqueSample.length}, 5xx=${server5xxCount}, failures=${crawlFailures.length}${crawlFailures.length ? ` [${crawlFailures.slice(0, 3).join('; ')}]` : ''}`
  );

  const failed = results.filter(r => !r.ok);
  console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
