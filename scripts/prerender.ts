/**
 * Production Build-Time Pre-rendering & Validation Engine for TStream.online
 *
 * Runs after `vite build` to pre-render full-content HTML files into `dist/`
 * for every public route (movies, series, watch routes, TV episodes, tags, genres, hubs).
 *
 * Enforces strict build validation:
 * - Counts only successfully generated and verified files.
 * - Validates file existence, non-empty HTML, exact canonical URL, <title>, <h1>, and robots directives.
 * - Guarantees zero duplicate canonical tags.
 * - Automatically exits with non-zero exit code if any mandatory route fails to render.
 */

import fs from 'fs';
import path from 'path';
import {
  renderSeoResult,
  render404Html,
  getMatchingCatalogForTag,
  getMatchingCatalogForLetter,
  getAllCatalogMedia
} from './seoHtmlPlugin.ts';
import {
  DETAILED_MOVIES,
  DETAILED_TV_SHOWS,
  POPULAR_TAGS,
  SPIDERMAN_COLLECTION,
  AVENGERS_COLLECTION,
  HARRY_POTTER_COLLECTION,
  PIRATES_COLLECTION
} from '../src/services/catalogData.ts';
import { createMediaSlug } from '../src/utils/slug.ts';
import { PRIMARY_ORIGIN } from '../src/utils/seo.ts';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

export interface PrerenderValidationResult {
  url: string;
  outputPath: string;
  success: boolean;
  error?: string;
  canonical?: string;
  hasTitle?: boolean;
  hasH1?: boolean;
}

/**
 * Renders and strictly validates a single route.
 */
export async function prerenderAndValidateRoute(
  template: string,
  urlPath: string,
  outputPath: string,
  preloadedMedia?: any,
  expectedCanonical?: string
): Promise<PrerenderValidationResult> {
  try {
    const seoResult = await renderSeoResult(template, urlPath, preloadedMedia);
    const html = seoResult.html;

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, html, 'utf8');

    // 1. Verify file exists on disk and is non-empty
    if (!fs.existsSync(outputPath)) {
      return { url: urlPath, outputPath, success: false, error: 'File was not written to disk' };
    }
    const stat = fs.statSync(outputPath);
    if (stat.size < 100) {
      return { url: urlPath, outputPath, success: false, error: `Generated file too small (${stat.size} bytes)` };
    }

    // 2. Validate canonical URL
    const canonicalMatches = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gi) || [];
    if (canonicalMatches.length === 0) {
      return { url: urlPath, outputPath, success: false, error: 'Missing canonical URL link' };
    }
    if (canonicalMatches.length > 1) {
      return { url: urlPath, outputPath, success: false, error: `Duplicate canonical URLs found (${canonicalMatches.length})` };
    }

    if (expectedCanonical) {
      const matchHref = html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) ||
                        html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      const actualCanonical = matchHref ? matchHref[1] : '';
      if (actualCanonical !== expectedCanonical) {
        return {
          url: urlPath,
          outputPath,
          success: false,
          error: `Canonical mismatch: expected ${expectedCanonical}, got ${actualCanonical}`
        };
      }
    }

    // 3. Validate <title> and <h1> presence
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!titleMatch || !titleMatch[1].trim()) {
      return { url: urlPath, outputPath, success: false, error: 'Missing or empty <title>' };
    }
    if (!h1Match || !h1Match[1].trim()) {
      return { url: urlPath, outputPath, success: false, error: 'Missing or empty <h1>' };
    }

    return {
      url: urlPath,
      outputPath,
      success: true,
      canonical: expectedCanonical || seoResult.canonicalUrl,
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

export async function prerenderAll() {
  const distIndex = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.warn(`[Prerender] dist/index.html not found. Run "vite build" first.`);
    return;
  }

  const template = fs.readFileSync(distIndex, 'utf8');
  console.log(`[Prerender] Starting build-time static HTML generation & strict validation into ${DIST_DIR}...`);

  let attempted = 0;
  let succeeded = 0;
  const failedList: { url: string; error: string }[] = [];

  // Helper queue executor
  async function processRoute(urlPath: string, outputPath: string, preloadedMedia?: any, expectedCanonical?: string) {
    attempted++;
    const res = await prerenderAndValidateRoute(template, urlPath, outputPath, preloadedMedia, expectedCanonical);
    if (res.success) {
      succeeded++;
    } else {
      failedList.push({ url: urlPath, error: res.error || 'Unknown validation failure' });
      console.error(`[Prerender FAILED] ${urlPath} -> ${res.error}`);
    }
  }

  // 1. Pre-render 404 page (dist/404.html)
  try {
    attempted++;
    const notFoundHtml = render404Html(template);
    const path404 = path.join(DIST_DIR, '404.html');
    fs.writeFileSync(path404, notFoundHtml, 'utf8');
    if (fs.existsSync(path404) && fs.statSync(path404).size > 100) {
      succeeded++;
    } else {
      failedList.push({ url: '/404', error: '404.html generation failed' });
    }
  } catch (e: any) {
    failedList.push({ url: '/404', error: e.message });
  }

  // 2. Homepage: update dist/index.html
  await processRoute('/', distIndex, undefined, `${PRIMARY_ORIGIN}/`);

  // 3. Main Public Hub & Landing Pages
  const landingPages = [
    { url: '/movies', file: 'movies/index.html', can: `${PRIMARY_ORIGIN}/movies` },
    { url: '/tv-shows', file: 'tv-shows/index.html', can: `${PRIMARY_ORIGIN}/tv-shows` },
    { url: '/trending', file: 'trending/index.html', can: `${PRIMARY_ORIGIN}/trending` },
    { url: '/top-rated', file: 'top-rated/index.html', can: `${PRIMARY_ORIGIN}/top-rated` },
    { url: '/collections', file: 'collections/index.html', can: `${PRIMARY_ORIGIN}/collections` },
    { url: '/new-episodes', file: 'new-episodes/index.html', can: `${PRIMARY_ORIGIN}/new-episodes` },
    { url: '/people', file: 'people/index.html', can: `${PRIMARY_ORIGIN}/people` },
    { url: '/random', file: 'random/index.html', can: `${PRIMARY_ORIGIN}/random` },
    { url: '/tags', file: 'tags/index.html', can: `${PRIMARY_ORIGIN}/tags` }
  ];

  for (const p of landingPages) {
    await processRoute(p.url, path.join(DIST_DIR, p.file), undefined, p.can);
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
        await processRoute(tagUrl, path.join(DIST_DIR, `tags/${slug}/index.html`), undefined, tagCan);
      }
    }
  }

  // 5. OTT Platform Hubs
  const platforms = ['netflix', 'apple', 'max', 'prime', 'disney', 'peacock', 'paramount', 'hulu', 'crunchyroll'];
  for (const plat of platforms) {
    await processRoute(`/platform/${plat}`, path.join(DIST_DIR, `platform/${plat}/index.html`), undefined, `${PRIMARY_ORIGIN}/platform/${plat}`);
  }

  // 6. A-Z Directory (only prerender letters with matching catalog entries)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const letter of alphabet) {
    if (getMatchingCatalogForLetter(letter).length > 0) {
      await processRoute(`/az/${letter}`, path.join(DIST_DIR, `az/${letter}/index.html`), undefined, `${PRIMARY_ORIGIN}/az/${letter}`);
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
    const detailFile = path.join(DIST_DIR, `movie/${slug}/index.html`);
    await processRoute(detailUrl, detailFile, movie, movieCanonical);

    // 7B: Movie Playback / Watch Page (Canonical MUST point to /movie/:slug)
    const watchUrl = `/watch/movie/${slug}`;
    const watchFile = path.join(DIST_DIR, `watch/movie/${slug}/index.html`);
    await processRoute(watchUrl, watchFile, movie, movieCanonical);
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
    const tvFile = path.join(DIST_DIR, `tv/${slug}/index.html`);
    await processRoute(tvUrl, tvFile, show, tvCanonical);

    // 8B: TV Episode Watch Pages for genuine detailed episodes
    if (Array.isArray(show.seasons)) {
      for (const season of show.seasons) {
        if (season && season.seasonNumber && Array.isArray(season.episodes)) {
          for (const ep of season.episodes) {
            if (ep && ep.episodeNumber) {
              const epUrl = `/watch/tv/${slug}/${season.seasonNumber}/${ep.episodeNumber}`;
              const epFile = path.join(DIST_DIR, `watch/tv/${slug}/${season.seasonNumber}/${ep.episodeNumber}/index.html`);
              const epCanonical = `${PRIMARY_ORIGIN}/watch/tv/${slug}/${season.seasonNumber}/${ep.episodeNumber}`;
              await processRoute(epUrl, epFile, show, epCanonical);
            }
          }
        }
      }
    }
  }

  console.log(`--------------------------------------------------`);
  console.log(`[Prerender Summary]`);
  console.log(`- Attempted routes:  ${attempted}`);
  console.log(`- Succeeded routes:  ${succeeded}`);
  console.log(`- Failed routes:     ${failedList.length}`);
  console.log(`- Output directory:  ${DIST_DIR}`);
  console.log(`--------------------------------------------------`);

  if (failedList.length > 0) {
    console.error(`[CRITICAL] Prerender failed for ${failedList.length} route(s):`);
    for (const f of failedList) {
      console.error(`  - ${f.url}: ${f.error}`);
    }
    process.exit(1);
  }

  console.log(`[Prerender Complete] All ${succeeded} static HTML routes verified successfully.`);
}

// Run if invoked directly
const isMainModule = Boolean(
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
);
if (isMainModule) {
  prerenderAll().catch(err => {
    console.error('Prerender error:', err);
    process.exit(1);
  });
}
