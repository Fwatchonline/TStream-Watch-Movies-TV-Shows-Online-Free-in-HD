/**
 * Production Build-Time Pre-rendering & Validation Engine for TStream.online
 *
 * Uses authoritative routeInventory.ts shared cleanly with generate-sitemaps.ts and verify-production.ts.
 * Enforces strict build validation:
 * - Terminates immediately with non-zero exit if `dist/index.html` is missing or empty.
 * - Rejects HTTP 404 or 503 results from being written/counted as successful routes.
 * - Validates file existence, single exact canonical URL, <title>, <h1>, semantic body,
 *   robots indexability parity, and referenced local `/assets/*` existence.
 * - Reports separate indexableSucceeded & noindexSucceeded counts in `dist/prerender-report.json`.
 */

import fs from 'fs';
import path from 'path';
import { loadBuildEnv } from './loadEnv.mjs';
import {
  renderSeoResult,
  render404Html,
  getServerTmdbApiKey,
  type RenderSeoOptions
} from './seoHtmlPlugin.ts';
import {
  getAuthoritativeRouteInventory,
  getBuildInventorySnapshotPath,
  readFreshBuildInventorySnapshot,
  type AuthoritativeInventoryResult
} from './routeInventory.ts';
import type { TmdbDiscoveryOptions } from './tmdbDiscovery.ts';
import { PRIMARY_ORIGIN } from '../src/utils/seo.ts';

loadBuildEnv();

const DEFAULT_DIST_DIR = path.resolve(process.cwd(), 'dist');

export const DEFAULT_PRERENDER_MAX_DYNAMIC_MOVIES = 100;
export const DEFAULT_PRERENDER_MAX_DYNAMIC_TV = 50;
export const DEFAULT_PRERENDER_MAX_DYNAMIC_EPISODES = 50;

export interface PrerenderOptions extends TmdbDiscoveryOptions {
  inventory?: AuthoritativeInventoryResult;
  inventorySnapshotPath?: string | false;
  maxDynamicMovies?: number;
  maxDynamicTv?: number;
  maxDynamicEpisodes?: number;
}

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
  inventorySource: 'getAuthoritativeRouteInventory';
  usedBuildSnapshot: boolean;
  attempted: number;
  succeeded: number;
  indexableSucceeded: number;
  noindexSucceeded: number;
  failed: number;
  authoritativeInventoryCounts: {
    main: number;
    movies: number;
    tvShows: number;
    episodes: number;
  };
  prerenderedCounts: {
    movies: number;
    tvShows: number;
    episodes: number;
    dynamicMovies: number;
    dynamicTvShows: number;
    dynamicEpisodes: number;
  };
  hybridSsrDynamicCounts: {
    movies: number;
    tvShows: number;
    episodes: number;
  };
  sampleDynamicSsrRoutes: {
    movies: string[];
    tvShows: string[];
    episodes: string[];
  };
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

function parseDynamicLimit(raw: string | number | undefined, fallback: number): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    return fallback;
  }
  return Math.min(num, 5000);
}

export async function prerenderAll(
  distDir: string = DEFAULT_DIST_DIR,
  options: PrerenderOptions = {}
): Promise<PrerenderReport> {
  const template = loadDistTemplateOrFail(distDir);
  const distIndex = path.join(distDir, 'index.html');
  console.log(`[Prerender] Starting build-time static HTML generation & strict validation into ${distDir}...`);

  const maxDynamicMovies = parseDynamicLimit(
    options.maxDynamicMovies ?? process.env.PRERENDER_MAX_DYNAMIC_MOVIES,
    DEFAULT_PRERENDER_MAX_DYNAMIC_MOVIES
  );
  const maxDynamicTv = parseDynamicLimit(
    options.maxDynamicTv ?? process.env.PRERENDER_MAX_DYNAMIC_TV,
    DEFAULT_PRERENDER_MAX_DYNAMIC_TV
  );
  const maxDynamicEpisodes = parseDynamicLimit(
    options.maxDynamicEpisodes ?? process.env.PRERENDER_MAX_DYNAMIC_EPISODES,
    DEFAULT_PRERENDER_MAX_DYNAMIC_EPISODES
  );

  let inventory: AuthoritativeInventoryResult | null = options.inventory || null;
  let usedBuildSnapshot = false;

  if (!inventory && options.inventorySnapshotPath !== false) {
    const snapshotTarget =
      typeof options.inventorySnapshotPath === 'string'
        ? options.inventorySnapshotPath
        : !options.fetchImpl && path.resolve(distDir) === DEFAULT_DIST_DIR
          ? getBuildInventorySnapshotPath()
          : null;
    if (snapshotTarget) {
      const effectiveKey = (options.tmdbApiKey !== undefined ? options.tmdbApiKey : getServerTmdbApiKey()).trim();
      const cached = readFreshBuildInventorySnapshot(snapshotTarget, undefined, Boolean(effectiveKey));
      if (cached) {
        inventory = cached;
        usedBuildSnapshot = true;
      }
    }
  }

  if (!inventory) {
    inventory = await getAuthoritativeRouteInventory(options);
  }

  console.log(
    `[Prerender Inventory] source=getAuthoritativeRouteInventory, usedBuildSnapshot=${usedBuildSnapshot}, ` +
      `movies=${inventory.movies.length}, tv=${inventory.tvShows.length}, episodes=${inventory.episodes.length}`
  );

  const routeResults: PrerenderValidationResult[] = [];

  async function processRoute(
    urlPath: string,
    outputPath: string,
    preloadedMedia?: any,
    expectedCanonical?: string,
    expectedNoindex?: boolean
  ) {
    const seoInput: any =
      options.fetchImpl !== undefined || options.tmdbApiKey !== undefined
        ? {
            preloadedMedia,
            fetchImpl: options.fetchImpl,
            tmdbApiKey: options.tmdbApiKey
          }
        : preloadedMedia;
    const res = await prerenderAndValidateRoute(
      template,
      urlPath,
      outputPath,
      seoInput,
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
  for (const p of inventory.hubs) {
    await processRoute(p.url, path.join(distDir, p.file), undefined, p.can, p.noindex);
  }

  // 4. Valuable Tag Landing Pages (strictly kebab-case slugs shared with routeInventory)
  for (const tagEntry of inventory.tags) {
    await processRoute(
      tagEntry.urlPath,
      path.join(distDir, tagEntry.outputFileRel),
      undefined,
      tagEntry.canonicalUrl,
      false
    );
  }

  // 5. Real Genre Landing Pages (indexable when populated; noindex when empty)
  for (const genreEntry of inventory.genres) {
    await processRoute(
      genreEntry.urlPath,
      path.join(distDir, genreEntry.outputFileRel),
      undefined,
      genreEntry.canonicalUrl,
      !genreEntry.indexable
    );
  }

  // 6. OTT Platform Hubs (indexable only when genuine matching content exists)
  for (const platEntry of inventory.platforms) {
    await processRoute(
      platEntry.urlPath,
      path.join(distDir, platEntry.outputFileRel),
      undefined,
      platEntry.canonicalUrl,
      !platEntry.indexable
    );
  }

  // 7. A-Z Directory (letters with matching catalog entries)
  for (const azEntry of inventory.az) {
    await processRoute(
      azEntry.urlPath,
      path.join(distDir, azEntry.outputFileRel),
      undefined,
      azEntry.canonicalUrl,
      false
    );
  }

  // 8. Movies: All curated + bounded dynamically discovered movies (remaining dynamic URLs use Hybrid SSR)
  const curatedMoviesToPrerender = inventory.movies.filter(m => m.source !== 'tmdb');
  const dynamicMovies = inventory.movies.filter(m => m.source === 'tmdb');
  const dynamicMoviesToPrerender = dynamicMovies.slice(0, maxDynamicMovies);
  const hybridSsrMovies = dynamicMovies.slice(maxDynamicMovies);

  for (const movieEntry of [...curatedMoviesToPrerender, ...dynamicMoviesToPrerender]) {
    await processRoute(
      movieEntry.detailPath,
      path.join(distDir, `movie/${movieEntry.slug}/index.html`),
      movieEntry.media,
      movieEntry.canonicalUrl,
      false
    );

    await processRoute(
      movieEntry.watchPath,
      path.join(distDir, `watch/movie/${movieEntry.slug}/index.html`),
      movieEntry.media,
      movieEntry.canonicalUrl,
      false
    );
  }

  // 9. TV Series: All curated + bounded dynamically discovered TV shows (remaining dynamic URLs use Hybrid SSR)
  const curatedTvToPrerender = inventory.tvShows.filter(t => t.source !== 'tmdb');
  const dynamicTv = inventory.tvShows.filter(t => t.source === 'tmdb');
  const dynamicTvToPrerender = dynamicTv.slice(0, maxDynamicTv);
  const hybridSsrTv = dynamicTv.slice(maxDynamicTv);

  for (const tvEntry of [...curatedTvToPrerender, ...dynamicTvToPrerender]) {
    await processRoute(
      tvEntry.detailPath,
      path.join(distDir, `tv/${tvEntry.slug}/index.html`),
      tvEntry.media,
      tvEntry.canonicalUrl,
      false
    );
  }

  // 10. Verified Episodes: All curated + bounded dynamically discovered verified episodes (remaining use Hybrid SSR)
  const curatedEpisodesToPrerender = inventory.episodes.filter(ep => ep.source !== 'tmdb');
  const dynamicEpisodes = inventory.episodes.filter(ep => ep.source === 'tmdb');
  const dynamicEpisodesToPrerender = dynamicEpisodes.slice(0, maxDynamicEpisodes);
  const hybridSsrEpisodes = dynamicEpisodes.slice(maxDynamicEpisodes);

  for (const epEntry of [...curatedEpisodesToPrerender, ...dynamicEpisodesToPrerender]) {
    await processRoute(
      epEntry.urlPath,
      path.join(distDir, epEntry.outputFileRel),
      epEntry.show,
      epEntry.canonicalUrl,
      false
    );
  }

  const authoritativeMainCount =
    1 +
    inventory.hubs.filter(h => !h.noindex).length +
    inventory.tags.length +
    inventory.genres.filter(g => g.indexable).length +
    inventory.platforms.filter(p => p.indexable).length +
    inventory.az.length;

  const sampleDynamicMovieRoutes = Array.from(
    new Set([
      ...dynamicMoviesToPrerender.slice(0, 3).map(m => m.detailPath),
      ...hybridSsrMovies.slice(0, 5).map(m => m.detailPath),
      ...hybridSsrMovies.slice(-5).map(m => m.detailPath)
    ])
  );
  const sampleDynamicTvRoutes = Array.from(
    new Set([
      ...dynamicTvToPrerender.slice(0, 3).map(t => t.detailPath),
      ...hybridSsrTv.slice(0, 5).map(t => t.detailPath),
      ...hybridSsrTv.slice(-5).map(t => t.detailPath)
    ])
  );
  const sampleDynamicEpisodeRoutes = Array.from(
    new Set([
      ...dynamicEpisodesToPrerender.slice(0, 3).map(e => e.urlPath),
      ...hybridSsrEpisodes.slice(0, 5).map(e => e.urlPath),
      ...hybridSsrEpisodes.slice(-5).map(e => e.urlPath)
    ])
  );

  const succeededList = routeResults.filter(r => r.success);
  const failedList = routeResults.filter(r => !r.success);
  const indexableSucceeded = succeededList.filter(r => r.indexable === true).length;
  const noindexSucceeded = succeededList.filter(r => r.indexable === false).length;

  const report: PrerenderReport = {
    outputDirectory: distDir,
    generatedAt: new Date().toISOString(),
    inventorySource: 'getAuthoritativeRouteInventory',
    usedBuildSnapshot,
    attempted: routeResults.length,
    succeeded: succeededList.length,
    indexableSucceeded,
    noindexSucceeded,
    failed: failedList.length,
    authoritativeInventoryCounts: {
      main: authoritativeMainCount,
      movies: inventory.movies.length,
      tvShows: inventory.tvShows.length,
      episodes: inventory.episodes.length
    },
    prerenderedCounts: {
      movies: curatedMoviesToPrerender.length + dynamicMoviesToPrerender.length,
      tvShows: curatedTvToPrerender.length + dynamicTvToPrerender.length,
      episodes: curatedEpisodesToPrerender.length + dynamicEpisodesToPrerender.length,
      dynamicMovies: dynamicMoviesToPrerender.length,
      dynamicTvShows: dynamicTvToPrerender.length,
      dynamicEpisodes: dynamicEpisodesToPrerender.length
    },
    hybridSsrDynamicCounts: {
      movies: hybridSsrMovies.length,
      tvShows: hybridSsrTv.length,
      episodes: hybridSsrEpisodes.length
    },
    sampleDynamicSsrRoutes: {
      movies: sampleDynamicMovieRoutes,
      tvShows: sampleDynamicTvRoutes,
      episodes: sampleDynamicEpisodeRoutes
    },
    routes: routeResults
  };

  fs.writeFileSync(path.join(distDir, 'prerender-report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log(`--------------------------------------------------`);
  console.log(`[Prerender Summary]`);
  console.log(`- Attempted routes:   ${report.attempted}`);
  console.log(`- Succeeded total:    ${report.succeeded}`);
  console.log(`  - Indexable HTML:   ${report.indexableSucceeded}`);
  console.log(`  - Noindex/404 HTML: ${report.noindexSucceeded}`);
  console.log(
    `- Dynamic routes:     prerendered(movies=${report.prerenderedCounts.dynamicMovies}, tv=${report.prerenderedCounts.dynamicTvShows}, ep=${report.prerenderedCounts.dynamicEpisodes}), ` +
      `hybridSSR(movies=${report.hybridSsrDynamicCounts.movies}, tv=${report.hybridSsrDynamicCounts.tvShows}, ep=${report.hybridSsrDynamicCounts.episodes})`
  );
  if (report.failed > 0) {
    console.log(`- Failed routes:      ${report.failed}`);
  } else {
    console.log(`- Verification check: All ${report.succeeded} routes passed cleanly`);
  }
  console.log(`- Output directory:   ${distDir}`);
  console.log(`- Report written:     ${path.join(distDir, 'prerender-report.json')}`);
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
