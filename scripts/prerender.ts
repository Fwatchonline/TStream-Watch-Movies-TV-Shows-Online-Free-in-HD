/**
 * Production Build-Time Pre-rendering & Validation Engine for TStream.online
 *
 * Runs after `vite build` to pre-render full-content HTML files into `dist/`
 * for every public route (movies, series, watch routes, TV episodes, tags, hubs).
 *
 * Enforces strict build validation:
 * - Terminates immediately with non-zero exit if `dist/index.html` is missing or empty.
 * - Rejects HTTP 404 or 503 results from being written/counted as successful routes.
 * - Validates file existence, single exact canonical URL, <title>, <h1>, semantic body,
 *   robots indexability parity, and referenced local `/assets/*` existence.
 * - Writes structured validation output to `dist/prerender-report.json`.
 */

import fs from 'fs';
import path from 'path';
import { loadBuildEnv } from './loadEnv.mjs';
import {
  renderSeoResult,
  render404Html,
  getMatchingCatalogForTag,
  getMatchingCatalogForLetter,
  getAllCatalogMedia,
  type RenderSeoOptions
} from './seoHtmlPlugin.ts';

loadBuildEnv();
import {
  DETAILED_MOVIES,
  DETAILED_TV_SHOWS,
  POPULAR_TAGS,
  SPIDERMAN_COLLECTION,
  AVENGERS_COLLECTION,
  HARRY_POTTER_COLLECTION,
  PIRATES_COLLECTION
} from '../src/services/catalogData.ts';
import { PLATFORM_CONFIGS } from '../src/services/platformConfig.ts';
import { createMediaSlug } from '../src/utils/slug.ts';
import { PRIMARY_ORIGIN } from '../src/utils/seo.ts';

const DEFAULT_DIST_DIR = path.resolve(process.cwd(), 'dist');

export interface PrerenderValidationResult {
  url: string;
  outputPath: string;
  success: boolean;
  status?: number;
  error?: string;
  canonical?: string;
  indexable?: boolean;
  hasTitle?: boolean;
  hasH1?: boolean;
}

export interface PrerenderReport {
  outputDirectory: string;
  generatedAt: string;
  attempted: number;
  succeeded: number;
  failed: number;
  routes: PrerenderValidationResult[];
}

export function loadDistTemplateOrFail(distDir: string = DEFAULT_DIST_DIR): string {
  const distIndex = path.join(distDir, 'index.html');
  if (!fs.existsSync(distIndex)) {
    throw new Error(`[Prerender] Missing required build template: ${distIndex}. Run "vite build" first.`);
  }
  const template = fs.readFileSync(distIndex, 'utf8');
  if (!template || template.trim().length < 50) {
    throw new Error(`[Prerender] Build template is empty or invalid: ${distIndex}`);
  }
  return template;
}

function validateReferencedAssetsExist(html: string, distDir: string): string | null {
  const assetRegex = /(?:src|href)=["'](\/assets\/[^"'?#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = assetRegex.exec(html)) !== null) {
    const assetRel = match[1].replace(/^\/+/, '');
    const assetPath = path.resolve(distDir, assetRel);
    if (!assetPath.startsWith(path.resolve(distDir, 'assets') + path.sep)) {
      return `Invalid local asset reference path: ${match[1]}`;
    }
    if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
      return `Referenced local asset missing on disk: ${match[1]}`;
    }
  }
  return null;
}

/**
 * Renders and strictly validates a single route.
 */
export async function prerenderAndValidateRoute(
  template: string,
  urlPath: string,
  outputPath: string,
  preloadedMediaOrOptions?: any | RenderSeoOptions,
  expectedCanonical?: string,
  validationOptions: { expectedNoindex?: boolean; distDir?: string; checkAssets?: boolean } = {}
): Promise<PrerenderValidationResult> {
  const distDir = validationOptions.distDir || DEFAULT_DIST_DIR;
  try {
    const seoResult = await renderSeoResult(template, urlPath, preloadedMediaOrOptions);
    const html = seoResult.html;

    // 1. Strictly enforce HTTP 200 status (never save/count 404 or 503 as valid route output)
    if (seoResult.status !== 200) {
      return {
        url: urlPath,
        outputPath,
        success: false,
        status: seoResult.status,
        canonical: seoResult.canonicalUrl,
        indexable: false,
        error: `Unexpected HTTP status ${seoResult.status} during prerender`
      };
    }

    // 2. Validate canonical URL before writing to disk
    const canonicalMatches = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi) || [];
    if (canonicalMatches.length === 0) {
      return {
        url: urlPath,
        outputPath,
        success: false,
        status: seoResult.status,
        error: 'Missing canonical URL link'
      };
    }
    if (canonicalMatches.length > 1) {
      return {
        url: urlPath,
        outputPath,
        success: false,
        status: seoResult.status,
        error: `Duplicate canonical URLs found (${canonicalMatches.length})`
      };
    }

    const matchHref =
      html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) ||
      html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    const actualCanonical = matchHref ? matchHref[1] : '';
    if (!actualCanonical.startsWith(`${PRIMARY_ORIGIN}/`)) {
      return {
        url: urlPath,
        outputPath,
        success: false,
        status: seoResult.status,
        canonical: actualCanonical,
        error: `Invalid canonical origin/URL: ${actualCanonical}`
      };
    }
    if (expectedCanonical && actualCanonical !== expectedCanonical) {
      return {
        url: urlPath,
        outputPath,
        success: false,
        status: seoResult.status,
        canonical: actualCanonical,
        error: `Canonical mismatch: expected ${expectedCanonical}, got ${actualCanonical}`
      };
    }

    // 3. Validate <title>, <h1>, and semantic prerender content
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!titleMatch || !titleMatch[1].trim()) {
      return { url: urlPath, outputPath, success: false, status: seoResult.status, error: 'Missing or empty <title>' };
    }
    if (!h1Match || !h1Match[1].trim()) {
      return { url: urlPath, outputPath, success: false, status: seoResult.status, error: 'Missing or empty <h1>' };
    }
    if (!html.includes('id="seo-prerender"')) {
      return {
        url: urlPath,
        outputPath,
        success: false,
        status: seoResult.status,
        error: 'Missing semantic body content (#seo-prerender)'
      };
    }

    // 4. Validate robots directive consistency
    const robotsMatch =
      html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
      html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']robots["'][^>]*>/i);
    const robotsContent = robotsMatch ? robotsMatch[1].toLowerCase() : '';
    const isNoindexDoc = robotsContent.includes('noindex') || seoResult.isNoindex;
    if (validationOptions.expectedNoindex !== undefined && isNoindexDoc !== validationOptions.expectedNoindex) {
      return {
        url: urlPath,
        outputPath,
        success: false,
        status: seoResult.status,
        canonical: actualCanonical,
        indexable: !isNoindexDoc,
        error: `Robots indexability mismatch: expected noindex=${validationOptions.expectedNoindex}, got "${robotsContent}"`
      };
    }

    // 5. Verify referenced local /assets/* exist on disk when checking a full dist build
    if (validationOptions.checkAssets) {
      const assetErr = validateReferencedAssetsExist(html, distDir);
      if (assetErr) {
        return {
          url: urlPath,
          outputPath,
          success: false,
          status: seoResult.status,
          canonical: actualCanonical,
          indexable: !isNoindexDoc,
          error: assetErr
        };
      }
    }

    // 6. Write validated HTML to disk and verify file size
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, html, 'utf8');

    if (!fs.existsSync(outputPath)) {
      return { url: urlPath, outputPath, success: false, status: seoResult.status, error: 'File was not written to disk' };
    }
    const stat = fs.statSync(outputPath);
    if (stat.size < 100) {
      return { url: urlPath, outputPath, success: false, status: seoResult.status, error: `Generated file too small (${stat.size} bytes)` };
    }

    return {
      url: urlPath,
      outputPath,
      success: true,
      status: seoResult.status,
      canonical: actualCanonical,
      indexable: !isNoindexDoc,
      hasTitle: true,
      hasH1: true
    };
  } catch (err: any) {
    return {
      url: urlPath,
      outputPath,
      success: false,
      error: err.message || String(err)
    };
  }
}

export async function prerenderAll(distDir: string = DEFAULT_DIST_DIR): Promise<PrerenderReport> {
  const template = loadDistTemplateOrFail(distDir);
  const distIndex = path.join(distDir, 'index.html');
  console.log(`[Prerender] Starting build-time static HTML generation & strict validation into ${distDir}...`);

  const routeResults: PrerenderValidationResult[] = [];

  async function processRoute(
    urlPath: string,
    outputPath: string,
    preloadedMedia?: any,
    expectedCanonical?: string,
    expectedNoindex?: boolean
  ) {
    const res = await prerenderAndValidateRoute(
      template,
      urlPath,
      outputPath,
      preloadedMedia,
      expectedCanonical,
      { expectedNoindex, distDir, checkAssets: true }
    );
    routeResults.push(res);
    if (!res.success) {
      console.error(`[Prerender FAILED] ${urlPath} -> ${res.error}`);
    }
  }

  // 1. Pre-render dist/404.html error template (HTTP 404 artifact)
  const path404 = path.join(distDir, '404.html');
  try {
    const notFoundHtml = render404Html(template);
    fs.writeFileSync(path404, notFoundHtml, 'utf8');
    const stat404 = fs.existsSync(path404) ? fs.statSync(path404) : null;
    if (!stat404 || stat404.size < 100 || !notFoundHtml.includes('noindex')) {
      routeResults.push({
        url: '/404',
        outputPath: path404,
        success: false,
        status: 404,
        indexable: false,
        error: '404.html generation validation failed'
      });
    } else {
      routeResults.push({
        url: '/404',
        outputPath: path404,
        success: true,
        status: 404,
        canonical: `${PRIMARY_ORIGIN}/404`,
        indexable: false,
        hasTitle: true,
        hasH1: true
      });
    }
  } catch (e: any) {
    routeResults.push({
      url: '/404',
      outputPath: path404,
      success: false,
      status: 404,
      indexable: false,
      error: e.message || String(e)
    });
  }

  // 2. Homepage: update dist/index.html
  await processRoute('/', distIndex, undefined, `${PRIMARY_ORIGIN}/`, false);

  // 3. Main Public Hub & Landing Pages
  const landingPages = [
    { url: '/movies', file: 'movies/index.html', can: `${PRIMARY_ORIGIN}/movies`, noindex: false },
    { url: '/tv-shows', file: 'tv-shows/index.html', can: `${PRIMARY_ORIGIN}/tv-shows`, noindex: false },
    { url: '/trending', file: 'trending/index.html', can: `${PRIMARY_ORIGIN}/trending`, noindex: false },
    { url: '/top-rated', file: 'top-rated/index.html', can: `${PRIMARY_ORIGIN}/top-rated`, noindex: false },
    { url: '/collections', file: 'collections/index.html', can: `${PRIMARY_ORIGIN}/collections`, noindex: false },
    { url: '/new-episodes', file: 'new-episodes/index.html', can: `${PRIMARY_ORIGIN}/new-episodes`, noindex: true },
    { url: '/people', file: 'people/index.html', can: `${PRIMARY_ORIGIN}/people`, noindex: true },
    { url: '/random', file: 'random/index.html', can: `${PRIMARY_ORIGIN}/random`, noindex: true },
    { url: '/tags', file: 'tags/index.html', can: `${PRIMARY_ORIGIN}/tags`, noindex: false }
  ];

  for (const p of landingPages) {
    await processRoute(p.url, path.join(distDir, p.file), undefined, p.can, p.noindex);
  }

  // 4. Valuable Tag Landing Pages (only prerender tags that have matching catalog items)
  for (const tag of POPULAR_TAGS) {
    if (tag.name) {
      const clean = tag.name.toLowerCase().trim();
      const matches = getMatchingCatalogForTag(clean);
      if (matches.length > 0) {
        const slug = clean.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const tagUrl = `/tags/${encodeURIComponent(clean)}`;
        const tagCan = `${PRIMARY_ORIGIN}/tags/${encodeURIComponent(clean)}`;
        await processRoute(tagUrl, path.join(distDir, `tags/${slug}/index.html`), undefined, tagCan, false);
      }
    }
  }

  // 5. OTT Platform Hubs (indexable only when genuine matching content exists)
  for (const plat of PLATFORM_CONFIGS) {
    const platRes = await renderSeoResult(template, `/platform/${plat.id}`);
    await processRoute(
      `/platform/${plat.id}`,
      path.join(distDir, `platform/${plat.id}/index.html`),
      undefined,
      `${PRIMARY_ORIGIN}/platform/${plat.id}`,
      platRes.isNoindex
    );
  }

  // 6. A-Z Directory (only prerender letters with matching catalog entries)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const letter of alphabet) {
    if (getMatchingCatalogForLetter(letter).length > 0) {
      await processRoute(`/az/${letter}`, path.join(distDir, `az/${letter}/index.html`), undefined, `${PRIMARY_ORIGIN}/az/${letter}`, false);
    }
  }

  // 7. All Movies (Detail Pages + Watch Pages)
  const movieMap = new Map<number, any>();
  for (const m of DETAILED_MOVIES) {
    if (m.id && m.title) movieMap.set(m.id, m);
  }
  const collections = [SPIDERMAN_COLLECTION, AVENGERS_COLLECTION, HARRY_POTTER_COLLECTION, PIRATES_COLLECTION];
  for (const col of collections) {
    for (const part of col.parts) {
      const id = part.id || (part as any).tmdbId;
      if (id && part.title && !movieMap.has(id)) {
        movieMap.set(id, part);
      }
    }
  }
  for (const item of getAllCatalogMedia()) {
    if (item.mediaType !== 'tv' && item.id && item.title && !movieMap.has(item.id)) {
      movieMap.set(item.id, item);
    }
  }

  for (const movie of movieMap.values()) {
    const slug = createMediaSlug(movie.title, movie.id);
    const movieCanonical = `${PRIMARY_ORIGIN}/movie/${slug}`;

    // 7A: Authoritative Movie Detail Page
    const detailUrl = `/movie/${slug}`;
    const detailFile = path.join(distDir, `movie/${slug}/index.html`);
    await processRoute(detailUrl, detailFile, movie, movieCanonical, false);

    // 7B: Movie Playback / Watch Page (Canonical MUST point to /movie/:slug)
    const watchUrl = `/watch/movie/${slug}`;
    const watchFile = path.join(distDir, `watch/movie/${slug}/index.html`);
    await processRoute(watchUrl, watchFile, movie, movieCanonical, false);
  }

  // 8. All TV Series (Detail Pages + Episode Watch Pages for Detailed Episodes)
  const tvMap = new Map<number, any>();
  for (const s of DETAILED_TV_SHOWS) {
    if (s.id && ((s as any).name || s.title)) tvMap.set(s.id, s);
  }
  for (const item of getAllCatalogMedia()) {
    if (item.mediaType === 'tv' && item.id && !tvMap.has(item.id)) {
      tvMap.set(item.id, item);
    }
  }

  for (const show of tvMap.values()) {
    const title = show.name || show.title;
    const slug = createMediaSlug(title, show.id);
    const tvCanonical = `${PRIMARY_ORIGIN}/tv/${slug}`;

    // 8A: TV Series Detail Page
    const tvUrl = `/tv/${slug}`;
    const tvFile = path.join(distDir, `tv/${slug}/index.html`);
    await processRoute(tvUrl, tvFile, show, tvCanonical, false);

    // 8B: TV Episode Watch Pages for genuine detailed episodes
    if (Array.isArray(show.seasons)) {
      for (const season of show.seasons) {
        if (season && season.seasonNumber && Array.isArray(season.episodes)) {
          for (const ep of season.episodes) {
            if (ep && ep.episodeNumber) {
              const epUrl = `/watch/tv/${slug}/${season.seasonNumber}/${ep.episodeNumber}`;
              const epFile = path.join(distDir, `watch/tv/${slug}/${season.seasonNumber}/${ep.episodeNumber}/index.html`);
              const epCanonical = `${PRIMARY_ORIGIN}/watch/tv/${slug}/${season.seasonNumber}/${ep.episodeNumber}`;
              await processRoute(epUrl, epFile, show, epCanonical, false);
            }
          }
        }
      }
    }
  }

  const succeededList = routeResults.filter(r => r.success);
  const failedList = routeResults.filter(r => !r.success);
  const report: PrerenderReport = {
    outputDirectory: distDir,
    generatedAt: new Date().toISOString(),
    attempted: routeResults.length,
    succeeded: succeededList.length,
    failed: failedList.length,
    routes: routeResults
  };

  fs.writeFileSync(path.join(distDir, 'prerender-report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(`--------------------------------------------------`);
  console.log(`[Prerender Summary]`);
  console.log(`- Attempted routes:  ${report.attempted}`);
  console.log(`- Succeeded routes:  ${report.succeeded}`);
  console.log(`- Failed routes:     ${report.failed}`);
  console.log(`- Output directory:  ${distDir}`);
  console.log(`- Report written:    ${path.join(distDir, 'prerender-report.json')}`);
  console.log(`--------------------------------------------------`);

  if (failedList.length > 0) {
    throw new Error(`Prerender failed for ${failedList.length} route(s): ${failedList.map(f => `${f.url} (${f.error})`).join('; ')}`);
  }

  console.log(`[Prerender Complete] All ${report.succeeded} static HTML routes verified successfully.`);
  return report;
}

// Run if invoked directly
const isMainModule = Boolean(
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
);
if (isMainModule) {
  prerenderAll().catch(err => {
    console.error('Prerender error:', err?.message || err);
    process.exit(1);
  });
}
