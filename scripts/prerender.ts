/**
 * Production Build-Time Pre-rendering Script for TStream.online
 *
 * Runs after `vite build` to pre-render full-content HTML files into `dist/`
 * for every public indexable route (movies, series, tags, genres, hubs).
 *
 * Solves the Nginx static serving problem (`try_files $uri $uri/ /index.html`),
 * ensuring Googlebot receives 100% semantic crawlable HTML, accurate canonicals,
 * and valid structured data without requiring JavaScript execution.
 */

import fs from 'fs';
import path from 'path';
import { renderSeoHtml } from './seoHtmlPlugin.ts';
import {
  DETAILED_MOVIES,
  DETAILED_TV_SHOWS,
  EXPANDED_CATALOG,
  POPULAR_TAGS,
  SPIDERMAN_COLLECTION,
  AVENGERS_COLLECTION,
  HARRY_POTTER_COLLECTION,
  PIRATES_COLLECTION
} from '../src/services/catalogData.ts';
import { createMediaSlug } from '../src/utils/slug.ts';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

async function prerenderRoute(template: string, urlPath: string, outputPath: string, preloadedMedia?: any) {
  try {
    const rendered = await renderSeoHtml(template, urlPath, preloadedMedia);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, rendered, 'utf8');
  } catch (err: any) {
    console.error(`Failed to prerender ${urlPath}:`, err.message);
  }
}

export async function prerenderAll() {
  const distIndex = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.warn(`[Prerender] dist/index.html not found. Run "vite build" first.`);
    return;
  }

  const template = fs.readFileSync(distIndex, 'utf8');
  console.log(`[Prerender] Starting build-time static HTML generation into ${DIST_DIR}...`);

  let count = 0;

  // 1. Homepage: update dist/index.html
  await prerenderRoute(template, '/', distIndex);
  count++;

  // 2. Main Public Landing Pages
  const landingPages = [
    { url: '/movies', file: 'movies/index.html' },
    { url: '/tv-shows', file: 'tv-shows/index.html' },
    { url: '/trending', file: 'trending/index.html' },
    { url: '/top-rated', file: 'top-rated/index.html' },
    { url: '/collections', file: 'collections/index.html' },
    { url: '/new-episodes', file: 'new-episodes/index.html' },
    { url: '/people', file: 'people/index.html' },
    { url: '/random', file: 'random/index.html' },
    { url: '/tags', file: 'tags/index.html' }
  ];

  for (const p of landingPages) {
    await prerenderRoute(template, p.url, path.join(DIST_DIR, p.file));
    count++;
  }

  // 3. Valuable Tag Landing Pages
  for (const tag of POPULAR_TAGS) {
    if (tag.name) {
      const clean = tag.name.toLowerCase().trim();
      const slug = clean.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      await prerenderRoute(template, `/tags/${encodeURIComponent(clean)}`, path.join(DIST_DIR, `tags/${slug}/index.html`));
      count++;
    }
  }

  // 4. Platform Hubs
  const platforms = ['netflix', 'disney', 'prime', 'apple', 'hbo', 'hulu', 'paramount'];
  for (const plat of platforms) {
    await prerenderRoute(template, `/platform/${plat}`, path.join(DIST_DIR, `platform/${plat}/index.html`));
    count++;
  }

  // 5. A-Z Directory
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const letter of alphabet) {
    await prerenderRoute(template, `/az/${letter}`, path.join(DIST_DIR, `az/${letter}/index.html`));
    count++;
  }

  // 6. All Movies
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
  for (const item of EXPANDED_CATALOG) {
    if (item.mediaType !== 'tv' && item.id && item.title && !movieMap.has(item.id)) {
      movieMap.set(item.id, item);
    }
  }

  for (const movie of movieMap.values()) {
    const slug = createMediaSlug(movie.title, movie.id);
    const routeUrl = `/movie/${slug}`;
    const filePath = path.join(DIST_DIR, `movie/${slug}/index.html`);
    await prerenderRoute(template, routeUrl, filePath, movie);
    count++;
  }

  // 7. All TV Shows
  const tvMap = new Map<number, any>();
  for (const s of DETAILED_TV_SHOWS) {
    if (s.id && ((s as any).name || s.title)) tvMap.set(s.id, s);
  }
  for (const item of EXPANDED_CATALOG) {
    if (item.mediaType === 'tv' && item.id && !tvMap.has(item.id)) {
      tvMap.set(item.id, item);
    }
  }

  for (const show of tvMap.values()) {
    const title = show.name || show.title;
    const slug = createMediaSlug(title, show.id);
    const routeUrl = `/tv/${slug}`;
    const filePath = path.join(DIST_DIR, `tv/${slug}/index.html`);
    await prerenderRoute(template, routeUrl, filePath, show);
    count++;
  }

  console.log(`[Prerender Complete] Pre-rendered ${count} static HTML routes into ${DIST_DIR}`);
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  prerenderAll().catch(err => {
    console.error('Prerender error:', err);
    process.exit(1);
  });
}
