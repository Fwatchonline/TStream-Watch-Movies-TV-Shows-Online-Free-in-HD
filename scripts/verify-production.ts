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

async function fetchHtml(baseUrl: string, route: string, ua: string) {
  const res = await fetch(`${baseUrl}${route}`, {
    headers: { 'User-Agent': ua, Accept: 'text/html' },
    redirect: 'manual'
  });
  const body = await res.text();
  return { status: res.status, headers: res.headers, body };
}

async function run() {
  const baseUrl = getBaseUrl();
  console.log(`=== TStream Production SEO Verification: ${baseUrl} ===\n`);
  const results: CheckResult[] = [];

  const record = (name: string, ok: boolean, detail: string) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} — ${detail}`);
  };

  // 1. Health endpoint
  try {
    const hRes = await fetch(`${baseUrl}/api/health`);
    const hJson: any = await hRes.json().catch(() => null);
    record(
      'GET /api/health',
      hRes.status === 200 && hJson?.status === 'ok',
      `HTTP ${hRes.status}, status=${hJson?.status}`
    );
  } catch (err: any) {
    record('GET /api/health', false, err.message);
  }

  // 2. API input validation (must NOT return HTTP 200 on invalid params)
  try {
    const apiRes = await fetch(`${baseUrl}/api/stream-resolve`);
    record(
      'GET /api/stream-resolve (missing tmdbId)',
      apiRes.status === 400,
      `HTTP ${apiRes.status}`
    );
  } catch (err: any) {
    record('GET /api/stream-resolve (missing tmdbId)', false, err.message);
  }

  // 3. Robots & XML Sitemaps
  for (const file of ['/robots.txt', '/sitemap.xml', '/sitemap-main.xml', '/sitemap-movies.xml', '/sitemap-tv.xml']) {
    try {
      const r = await fetch(`${baseUrl}${file}`);
      const txt = await r.text();
      const validBody = file === '/robots.txt' ? txt.includes('Sitemap:') : txt.includes('<?xml');
      record(`Static ${file}`, r.status === 200 && validBody, `HTTP ${r.status}, bytes=${txt.length}`);
    } catch (err: any) {
      record(`Static ${file}`, false, err.message);
    }
  }

  // 4. Indexable 200 routes + Googlebot vs Browser parity
  const indexableChecks: Array<{ path: string; expectedCanonical: string }> = [
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
    { path: '/movie/spider-man-homecoming-315635', expectedCanonical: 'https://tstream.online/movie/spider-man-homecoming-315635' },
    { path: '/watch/movie/spider-man-homecoming-315635', expectedCanonical: 'https://tstream.online/movie/spider-man-homecoming-315635' },
    { path: '/tv/breaking-bad-1396', expectedCanonical: 'https://tstream.online/tv/breaking-bad-1396' },
    { path: '/watch/tv/breaking-bad-1396/1/1', expectedCanonical: 'https://tstream.online/watch/tv/breaking-bad-1396/1/1' }
  ];

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
      const hasH1 = /<h1[^>]*>[\s\S]+?<\/h1>/i.test(bot.body);

      const ok =
        bot.status === 200 &&
        user.status === 200 &&
        canBot.count === 1 &&
        canBot.href === item.expectedCanonical &&
        canUser.href === canBot.href &&
        !robotsBot.includes('noindex') &&
        Boolean(titleBot) &&
        titleBot === titleUser &&
        hasH1;

      record(
        `Indexable ${item.path}`,
        ok,
        `HTTP=${bot.status}/${user.status}, canonical=${canBot.href} (count=${canBot.count}), h1=${hasH1}`
      );
    } catch (err: any) {
      record(`Indexable ${item.path}`, false, err.message);
    }
  }

  // 5. Filtered / Search / Utility routes -> 200 + noindex
  const noindexChecks = [
    { path: '/movies?genre=28&year=2024', expectedCanonical: 'https://tstream.online/movies' },
    { path: '/search?q=batman', expectedCanonical: 'https://tstream.online/search' },
    { path: '/random', expectedCanonical: 'https://tstream.online/random' }
  ];

  for (const item of noindexChecks) {
    try {
      const res = await fetchHtml(baseUrl, item.path, GOOGLEBOT_UA);
      const can = extractCanonical(res.body);
      const robots = extractRobots(res.body);
      const ok =
        res.status === 200 &&
        robots.includes('noindex') &&
        can.count === 1 &&
        can.href === item.expectedCanonical;
      record(
        `Noindex ${item.path}`,
        ok,
        `HTTP=${res.status}, robots="${robots}", canonical=${can.href}`
      );
    } catch (err: any) {
      record(`Noindex ${item.path}`, false, err.message);
    }
  }

  // 6. Genuine 404 routes -> MUST return HTTP 404 (not 200!)
  const notFoundChecks = [
    '/movie/999999999-nonexistent-movie',
    '/tags/nonexistent-tag-xyz-999',
    '/watch/tv/breaking-bad-1396/99/99',
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

  // 7. Redirect checks (only when running against public non-localhost domain)
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
