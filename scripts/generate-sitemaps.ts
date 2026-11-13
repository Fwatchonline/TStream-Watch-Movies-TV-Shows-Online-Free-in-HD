/**
 * Production TypeScript XML Sitemap Generator for TStream.online
 *
 * Uses the single authoritative routeInventory.ts shared with prerender.ts and verify-production.ts:
 * - Positive integer TMDB IDs.
 * - Explicit Spider-Man: Homecoming TMDB ID 315635 verification.
 * - Preserves legitimate TMDB movie ID 28 (does NOT blindly delete valid IDs).
 * - Excludes movie watch routes from sitemaps (pointing instead to authoritative /movie/:slug).
 * - Uses canonical kebab-case tag slugs (/tags/time-travel, /tags/coming-of-age, etc.).
 * - Includes populated /genre/:slug, /platform/:id, and /az/:letter pages only.
 * - Creates sitemap-episodes.xml ONLY for verified, content-rich TV episodes (isEpisodeSeoIndexable).
 * - Omits <lastmod> completely because catalog/TMDB records lack genuine per-URL modification timestamps.
 */

import fs from 'fs';
import path from 'path';
import { loadBuildEnv } from './loadEnv.mjs';
import {
  getMovieInventory,
  getTvInventory,
  getVerifiedEpisodeInventory,
  getTagInventory,
  getGenreInventory,
  getPlatformInventory,
  getAzInventory
} from './routeInventory.ts';

loadBuildEnv();

const DOMAIN = 'https://tstream.online';
const DEFAULT_PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DEFAULT_DIST_DIR = path.resolve(process.cwd(), 'dist');

export interface SitemapUrlEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

export interface SitemapGenerationResult {
  mainCount: number;
  moviesCount: number;
  tvCount: number;
  episodesCount: number;
  totalCount: number;
  sitemapIndexXml: string;
  mainXml: string;
  moviesXml: string;
  tvXml: string;
  episodesXml: string | null;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function buildXmlUrlset(entries: SitemapUrlEntry[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const entry of entries) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(entry.url)}</loc>\n`;
    if (entry.lastmod) {
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    }
    if (entry.changefreq) {
      xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    }
    if (entry.priority) {
      xml += `    <priority>${entry.priority}</priority>\n`;
    }
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

export function validateSitemapXml(
  xmlContent: string,
  sitemapName: string,
  options: { allowVerifiedLastmod?: boolean } = {}
): { valid: boolean; count: number; urls: string[] } {
  if (!xmlContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    throw new Error(`[Sitemap Validator] ${sitemapName} is missing valid XML declaration`);
  }

  // Priority 3: Fake/unverified <lastmod> (releaseDate, firstAirDate, or build timestamp) must never be emitted
  if (!options.allowVerifiedLastmod && /<lastmod>/i.test(xmlContent)) {
    throw new Error(
      `[Sitemap Validator] ${sitemapName} contains unverified <lastmod> tag; omit <lastmod> unless genuine modification timestamps exist.`
    );
  }

  const locRegex = /<loc>([^<]+)<\/loc>/g;
  const urls: string[] = [];
  let match;
  while ((match = locRegex.exec(xmlContent)) !== null) {
    const url = match[1];
    if (!url.startsWith('https://tstream.online/')) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains non-canonical or non-HTTPS URL: ${url}`);
    }
    if (url.includes('undefined') || url.includes('null') || url.includes('NaN')) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains corrupted URL: ${url}`);
    }
    // Reject non-kebab / space-encoded tag URLs (e.g. /tags/time%20travel)
    if (url.includes('/tags/') && (url.includes('%20') || /\s/.test(url) || /[A-Z]/.test(url.split('/tags/')[1] || ''))) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains non-canonical tag slug: ${url}`);
    }
    // Never allow corrupted spider-man-homecoming-28
    if (url.includes('spider-man-homecoming-28')) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains corrupted spider-man-homecoming-28!`);
    }
    // Never allow watch movie URLs in sitemaps
    if (url.includes('/watch/movie/')) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains duplicate watch movie URL: ${url}`);
    }
    urls.push(url);
  }

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) {
      duplicates.push(u);
    }
    seen.add(u);
  }

  if (duplicates.length > 0) {
    throw new Error(`[Sitemap Validator] ${sitemapName} contains ${duplicates.length} duplicate URLs (e.g. ${duplicates[0]})`);
  }

  return { valid: true, count: urls.length, urls };
}

export async function generateSitemaps(
  isDryRun = false,
  publicDir: string = DEFAULT_PUBLIC_DIR,
  distDir: string = DEFAULT_DIST_DIR
): Promise<SitemapGenerationResult> {
  console.log('Generating production sitemaps from authoritative routeInventory...');

  // 1. Movies from authoritative inventory (no fake releaseDate lastmod)
  const movies = getMovieInventory();
  const movieEntries: SitemapUrlEntry[] = movies.map(m => ({
    url: m.canonicalUrl,
    changefreq: 'weekly',
    priority: '0.9'
  }));

  // 2. TV Series from authoritative inventory (no fake firstAirDate lastmod)
  const tvShows = getTvInventory();
  const tvEntries: SitemapUrlEntry[] = tvShows.map(t => ({
    url: t.canonicalUrl,
    changefreq: 'weekly',
    priority: '0.9'
  }));

  // 3. Verified, content-rich TV Episodes only
  const verifiedEpisodes = getVerifiedEpisodeInventory();
  const episodeEntries: SitemapUrlEntry[] = verifiedEpisodes.map(ep => ({
    url: ep.canonicalUrl,
    changefreq: 'weekly',
    priority: '0.7'
  }));

  // 4. Main Pages (Hubs + Canonical Kebab Tags + Populated Genres + Populated Platforms + Populated A-Z)
  const mainEntries: SitemapUrlEntry[] = [
    { url: `${DOMAIN}/`, changefreq: 'daily', priority: '1.0' },
    { url: `${DOMAIN}/movies`, changefreq: 'daily', priority: '0.9' },
    { url: `${DOMAIN}/tv-shows`, changefreq: 'daily', priority: '0.9' },
    { url: `${DOMAIN}/trending`, changefreq: 'daily', priority: '0.9' },
    { url: `${DOMAIN}/top-rated`, changefreq: 'weekly', priority: '0.8' },
    { url: `${DOMAIN}/collections`, changefreq: 'weekly', priority: '0.8' },
    { url: `${DOMAIN}/tags`, changefreq: 'weekly', priority: '0.7' }
  ];

  // Canonical kebab-case tags with verified catalog matches
  for (const tagEntry of getTagInventory()) {
    mainEntries.push({
      url: tagEntry.canonicalUrl,
      changefreq: 'weekly',
      priority: '0.7'
    });
  }

  // Real Genre landing pages (indexable only when populated)
  const genreInventory = await getGenreInventory();
  for (const genreEntry of genreInventory) {
    if (genreEntry.indexable) {
      mainEntries.push({
        url: genreEntry.canonicalUrl,
        changefreq: 'weekly',
        priority: '0.8'
      });
    }
  }

  // OTT Platform Hubs: only include platforms with verified or live titles
  const platformInventory = await getPlatformInventory();
  for (const platEntry of platformInventory) {
    if (platEntry.indexable) {
      mainEntries.push({
        url: platEntry.canonicalUrl,
        changefreq: 'weekly',
        priority: '0.7'
      });
    }
  }

  // A-Z Directory: Only include letters that actually have catalog entries
  for (const azEntry of getAzInventory()) {
    mainEntries.push({
      url: azEntry.canonicalUrl,
      changefreq: 'monthly',
      priority: '0.6'
    });
  }

  // 5. Build XML Strings (omit empty sitemap-episodes.xml if 0 indexable episodes exist)
  const hasEpisodes = episodeEntries.length > 0;
  const sitemapEntriesXml = [
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-main.xml</loc>\n  </sitemap>`,
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-movies.xml</loc>\n  </sitemap>`,
    `  <sitemap>\n    <loc>${DOMAIN}/sitemap-tv.xml</loc>\n  </sitemap>`,
    ...(hasEpisodes ? [`  <sitemap>\n    <loc>${DOMAIN}/sitemap-episodes.xml</loc>\n  </sitemap>`] : [])
  ].join('\n');

  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntriesXml}\n</sitemapindex>\n`;

  const mainXml = buildXmlUrlset(mainEntries);
  const moviesXml = buildXmlUrlset(movieEntries);
  const tvXml = buildXmlUrlset(tvEntries);
  const episodesXml = hasEpisodes ? buildXmlUrlset(episodeEntries) : null;

  // 6. Validation Step
  const mainVal = validateSitemapXml(mainXml, 'sitemap-main.xml');
  const moviesVal = validateSitemapXml(moviesXml, 'sitemap-movies.xml');
  const tvVal = validateSitemapXml(tvXml, 'sitemap-tv.xml');
  const epVal = episodesXml ? validateSitemapXml(episodesXml, 'sitemap-episodes.xml') : { valid: true, count: 0, urls: [] };

  console.log(`[Validation PASSED]`);
  console.log(`- sitemap-main.xml: ${mainVal.count} valid URLs`);
  console.log(`- sitemap-movies.xml: ${moviesVal.count} valid movie URLs`);
  console.log(`- sitemap-tv.xml: ${tvVal.count} valid TV series URLs`);
  if (hasEpisodes) {
    console.log(`- sitemap-episodes.xml: ${epVal.count} verified episode URLs`);
  }

  const summary: SitemapGenerationResult = {
    mainCount: mainVal.count,
    moviesCount: moviesVal.count,
    tvCount: tvVal.count,
    episodesCount: epVal.count,
    totalCount: mainVal.count + moviesVal.count + tvVal.count + epVal.count,
    sitemapIndexXml,
    mainXml,
    moviesXml,
    tvXml,
    episodesXml
  };

  if (isDryRun) {
    console.log('[DRY RUN] Finished without writing files.');
    return summary;
  }

  const writeSitemapsToDir = (targetDir: string) => {
    fs.writeFileSync(path.join(targetDir, 'sitemap.xml'), sitemapIndexXml, 'utf8');
    fs.writeFileSync(path.join(targetDir, 'sitemap-main.xml'), mainXml, 'utf8');
    fs.writeFileSync(path.join(targetDir, 'sitemap-movies.xml'), moviesXml, 'utf8');
    fs.writeFileSync(path.join(targetDir, 'sitemap-tv.xml'), tvXml, 'utf8');
    const epPath = path.join(targetDir, 'sitemap-episodes.xml');
    if (episodesXml) {
      fs.writeFileSync(epPath, episodesXml, 'utf8');
    } else if (fs.existsSync(epPath)) {
      fs.unlinkSync(epPath);
    }
  };

  // 7. Write Sitemaps to public/
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  writeSitemapsToDir(publicDir);
  console.log(`Wrote sitemaps to ${publicDir}`);

  // 8. Write Sitemaps to dist/ if it exists
  if (fs.existsSync(distDir)) {
    writeSitemapsToDir(distDir);
    console.log(`Wrote sitemaps to ${distDir}`);
  }

  return summary;
}

// Run if executed directly
const isMainModule = Boolean(
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
);
if (isMainModule) {
  generateSitemaps().catch(err => {
    console.error('Sitemap generation failed:', err);
    process.exit(1);
  });
}
