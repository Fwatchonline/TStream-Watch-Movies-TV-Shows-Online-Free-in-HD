/**
 * Automated Production & Staging HTTP SEO Verification Script for TStream.online
 *
 * Usage:
 *   npx tsx scripts/verify-production.ts
 *   npx tsx scripts/verify-production.ts --base-url=http://127.0.0.1:3000
 */

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

async function run() {
  const baseUrl = getBaseUrl();
  console.log(`=== TStream Production SEO & Server Verification: ${baseUrl} ===\n`);
  const results: CheckResult[] = [];

  const record = (name: string, ok: boolean, detail: string) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  };

  // 1. Health & Runtime identity
  try {
    const hRes = await fetch(`${baseUrl}/api/health`);
    const hJson: any = await hRes.json().catch(() => null);
    record(
      'GET /api/health',
      hRes.status === 200 && hJson?.status === 'ok' && hJson?.service === 'tstream-production',
      `HTTP ${hRes.status}, status=${hJson?.status}, service=${hJson?.service}`
    );
  } catch (err: any) {
    record('GET /api/health', false, err.message);
  }

  // 2. API Input Validation & SSRF Security Checks (must NOT return 200!)
  const apiChecks: Array<{ path: string; expectedStatus: number; label: string }> = [
    { path: '/api/stream-resolve', expectedStatus: 400, label: 'Missing tmdbId on /api/stream-resolve' },
    { path: '/api/stream/movie/invalid-id', expectedStatus: 400, label: 'Invalid numeric ID on /api/stream' },
    { path: '/api/proxy', expectedStatus: 400, label: 'Missing url on /api/proxy' },
    { path: '/api/proxy?url=http://127.0.0.1/secret', expectedStatus: 403, label: 'SSRF loopback blocked on /api/proxy' },
    { path: '/api/subtitle-proxy', expectedStatus: 400, label: 'Missing url on /api/subtitle-proxy' },
    { path: '/api/tmdb/unknown/route', expectedStatus: 400, label: 'Disallowed path on /api/tmdb' },
    { path: '/api/nonexistent-endpoint', expectedStatus: 404, label: 'Unknown /api/* returns 404 JSON' }
  ];

  for (const check of apiChecks) {
    try {
      const apiRes = await fetch(`${baseUrl}${check.path}`);
      record(check.label, apiRes.status === check.expectedStatus, `HTTP ${apiRes.status}`);
    } catch (err: any) {
      record(check.label, false, err.message);
    }
  }

  // 3. Robots, Sitemaps & Full XML Integrity Validation
  let mainSitemapUrls: string[] = [];
  let moviesSitemapUrls: string[] = [];
  let tvSitemapUrls: string[] = [];
  try {
    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    const robotsTxt = await robotsRes.text();
    record(
      'Static /robots.txt',
      robotsRes.status === 200 && robotsTxt.includes('Sitemap: https://tstream.online/sitemap.xml'),
      `HTTP ${robotsRes.status}, bytes=${robotsTxt.length}`
    );

    const sitemapFiles = [
      { path: '/sitemap.xml', required: '<sitemapindex' },
      { path: '/sitemap-main.xml', required: '<urlset' },
      { path: '/sitemap-movies.xml', required: '<urlset' },
      { path: '/sitemap-tv.xml', required: '<urlset' }
    ];

    for (const sm of sitemapFiles) {
      const r = await fetch(`${baseUrl}${sm.path}`);
      const xml = await r.text();
      const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
      const uniqueLocs = new Set(locs);
      const validOrigin = locs.every(u => u.startsWith('https://tstream.online/'));
      const noDupWatch = locs.every(u => !u.includes('/watch/movie/'));
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

      if (sm.path === '/sitemap-main.xml') mainSitemapUrls = locs;
      if (sm.path === '/sitemap-movies.xml') moviesSitemapUrls = locs;
      if (sm.path === '/sitemap-tv.xml') tvSitemapUrls = locs;

      const ok =
        r.status === 200 &&
        xml.includes('<?xml') &&
        xml.includes(sm.required) &&
        locs.length > 0 &&
        locs.length === uniqueLocs.size &&
        validOrigin &&
        noDupWatch &&
        noCorrupt &&
        noUtility;

      record(`Sitemap ${sm.path}`, ok, `HTTP ${r.status}, urls=${locs.length}, unique=${uniqueLocs.size}`);
    }

    const totalContentUrls = mainSitemapUrls.length + moviesSitemapUrls.length + tvSitemapUrls.length;
    record('Combined sitemap entries populated', totalContentUrls > 20, `total=${totalContentUrls}`);
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

  // 5. Indexable 200 Routes + Googlebot vs Browser Parity + JSON-LD + Semantic Body
  const indexableChecks: Array<{ path: string; expectedCanonical: string; expectedJsonLdType?: string }> = [
    { path: '/', expectedCanonical: 'https://tstream.online/' },
    { path: '/movies', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/movies?page=2', expectedCanonical: 'https://tstream.online/movies?page=2' },
    { path: '/tv-shows', expectedCanonical: 'https://tstream.online/tv-shows' },
    { path: '/trending', expectedCanonical: 'https://tstream.online/trending' },
    { path: '/top-rated', expectedCanonical: 'https://tstream.online/top-rated' },
    { path: '/collections', expectedCanonical: 'https://tstream.online/collections' },
    { path: '/tags', expectedCanonical: 'https://tstream.online/tags' },
    { path: '/tags/revenge', expectedCanonical: 'https://tstream.online/tags/revenge' },
    { path: '/platform/netflix', expectedCanonical: 'https://tstream.online/platform/netflix' },
    { path: '/platform/max', expectedCanonical: 'https://tstream.online/platform/max' },
    { path: '/az/S', expectedCanonical: 'https://tstream.online/az/S' },
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
      const hasH1 = /<h1[^>]*>[\s\S]+?<\/h1>/i.test(bot.body);
      const hasContent = bot.body.includes('id="seo-prerender"');
      const jsonLdOk =
        Boolean(jsonLd && jsonLd['@context'] === 'https://schema.org') &&
        (!item.expectedJsonLdType || jsonLd?.['@type'] === item.expectedJsonLdType);

      if (item.path === '/movies') moviesP1Cards = extractCardTitles(bot.body);
      if (item.path === '/movies?page=2') moviesP2Cards = extractCardTitles(bot.body);

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
        jsonLdOk;

      record(
        `Indexable ${item.path}`,
        ok,
        `HTTP=${bot.status}/${user.status}, canonical=${canBot.href} (count=${canBot.count}), jsonld=${jsonLd?.['@type'] || 'none'}`
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

  // 6. Query Parameter Policy, Filters, Search, Empty A-Z, Platform Alias, Utility -> 200 + noindex
  const noindexChecks: Array<{ path: string; expectedCanonical: string }> = [
    { path: '/movies?genreId=28&year=2024', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/movies?sortBy=vote_average.desc', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/movies?country=US', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/movies?mediaType=movie', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/movies?unknownParam=foo', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/movies?page=0', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/movies?page=9999', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/movies?page=1&utm_source=test', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/platform/hbo', expectedCanonical: 'https://tstream.online/platform/max' },
    { path: '/search?q=batman', expectedCanonical: 'https://tstream.online/search' },
    { path: '/random', expectedCanonical: 'https://tstream.online/random' },
    { path: '/az/Q', expectedCanonical: 'https://tstream.online/az/Q' }
  ];

  for (const item of noindexChecks) {
    try {
      const res = await fetchHtml(baseUrl, item.path, GOOGLEBOT_UA);
      const can = extractCanonical(res.body);
      const robots = extractRobots(res.body);
      // Note: /movies?page=1&utm_source=test strips ?page=1 & utm_source and stays indexable with clean /movies canonical
      const expectNoindex = !item.path.startsWith('/movies?page=1&');
      const ok =
        res.status === 200 &&
        (expectNoindex ? robots.includes('noindex') : !robots.includes('noindex')) &&
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

  // Platform with no offline data (Crunchyroll) — verify noindex parity with sitemap
  try {
    const crRes = await fetchHtml(baseUrl, '/platform/crunchyroll', GOOGLEBOT_UA);
    const crRobots = extractRobots(crRes.body);
    const inSitemap = mainSitemapUrls.includes('https://tstream.online/platform/crunchyroll');
    const isNoindex = crRobots.includes('noindex');
    const crHasCards = extractCardTitles(crRes.body).length > 0;
    // Consistency rule: either populated (indexed & not claiming unrelated titles) OR empty (noindex & excluded from sitemap)
    const ok = crRes.status === 200 && (!inSitemap ? isNoindex && !crHasCards : !isNoindex && crHasCards);
    record(
      'Platform /platform/crunchyroll sitemap-indexability parity',
      ok,
      `HTTP=${crRes.status}, inSitemap=${inSitemap}, noindex=${isNoindex}, cards=${crHasCards}`
    );
  } catch (err: any) {
    record('Platform /platform/crunchyroll sitemap-indexability parity', false, err.message);
  }

  // 7. Genuine 404 routes -> MUST return HTTP 404 (not 200!)
  const notFoundChecks = [
    '/movie/999999999-nonexistent-movie',
    '/tv/999999999-nonexistent-show',
    '/tags/nonexistent-tag-xyz-999',
    '/watch/tv/breaking-bad-1396/99/99',
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
