/**
 * Production Google SEO Sitemap Generator for TStream.online
 *
 * Imports directly from typed TypeScript catalog data to guarantee 100%
 * authentic TMDB IDs, zero regex parsing bleed, and fully canonical URLs.
 *
 * Generates:
 * 1. public/sitemap.xml (Sitemap Index)
 * 2. public/sitemap-main.xml (Main pages, platform hubs, A-Z directory, valuable tags)
 * 3. public/sitemap-movies.xml (All canonical movie detail pages: /movie/:slug)
 * 4. public/sitemap-tv.xml (All canonical TV series detail pages: /tv/:slug)
 */

import fs from 'fs';
import path from 'path';
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

const DOMAIN = 'https://tstream.online';
const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

interface SitemapUrlEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

function isValidDate(dateStr?: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  // Must match YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function formatDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  if (isValidDate(dateStr)) return dateStr;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }
  return undefined;
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

function validateSitemapXml(xmlContent: string, sitemapName: string): { valid: boolean; count: number; urls: string[] } {
  // Check basic XML header and root tag
  if (!xmlContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    throw new Error(`[Sitemap Validator] ${sitemapName} is missing valid XML declaration`);
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
    urls.push(url);
  }

  // Check URL uniqueness
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

export async function generateSitemaps() {
  console.log('Generating production sitemaps from structured catalog data...');

  // 1. Gather Movies from structured data
  const movieMap = new Map<number, { id: number; title: string; releaseDate?: string }>();

  // Add from DETAILED_MOVIES
  for (const movie of DETAILED_MOVIES) {
    if (movie.id && movie.title) {
      movieMap.set(movie.id, {
        id: movie.id,
        title: movie.title,
        releaseDate: movie.releaseDate
      });
    }
  }

  // Add from collections
  const collections = [SPIDERMAN_COLLECTION, AVENGERS_COLLECTION, HARRY_POTTER_COLLECTION, PIRATES_COLLECTION];
  for (const col of collections) {
    for (const part of col.parts) {
      const id = part.id || (part as any).tmdbId;
      if (id && part.title && !movieMap.has(id)) {
        movieMap.set(id, {
          id,
          title: part.title,
          releaseDate: part.releaseDate
        });
      }
    }
  }

  // Add from EXPANDED_CATALOG
  for (const item of EXPANDED_CATALOG) {
    if (item.mediaType !== 'tv' && item.id && item.title) {
      if (!movieMap.has(item.id)) {
        movieMap.set(item.id, {
          id: item.id,
          title: item.title,
          releaseDate: item.releaseDate
        });
      }
    }
  }

  // Verified Spider-Man: Homecoming check to ensure ID is 315635, not 28!
  const spiderman = movieMap.get(315635);
  if (!spiderman || spiderman.title !== 'Spider-Man: Homecoming') {
    movieMap.set(315635, {
      id: 315635,
      title: 'Spider-Man: Homecoming',
      releaseDate: '2017-07-05'
    });
  }
  // Ensure bad ID 28 is never in movies
  if (movieMap.has(28)) {
    movieMap.delete(28);
  }

  const movieEntries: SitemapUrlEntry[] = Array.from(movieMap.values()).map(m => {
    const slug = createMediaSlug(m.title, m.id);
    const lastmod = formatDate(m.releaseDate);
    return {
      url: `${DOMAIN}/movie/${slug}`,
      ...(lastmod ? { lastmod } : {}),
      changefreq: 'weekly',
      priority: '0.9'
    };
  });

  // 2. Gather TV Shows from structured data
  const tvMap = new Map<number, { id: number; title: string; firstAirDate?: string }>();

  // Add from DETAILED_TV_SHOWS
  for (const show of DETAILED_TV_SHOWS) {
    const title = (show as any).name || show.title;
    if (show.id && title) {
      tvMap.set(show.id, {
        id: show.id,
        title,
        firstAirDate: (show as any).firstAirDate || show.releaseDate
      });
    }
  }

  // Add from EXPANDED_CATALOG
  for (const item of EXPANDED_CATALOG) {
    if (item.mediaType === 'tv' && item.id) {
      const title = item.title || (item as any).name;
      if (title && !tvMap.has(item.id)) {
        tvMap.set(item.id, {
          id: item.id,
          title,
          firstAirDate: item.releaseDate || (item as any).firstAirDate
        });
      }
    }
  }

  const tvEntries: SitemapUrlEntry[] = Array.from(tvMap.values()).map(t => {
    const slug = createMediaSlug(t.title, t.id);
    const lastmod = formatDate(t.firstAirDate);
    return {
      url: `${DOMAIN}/tv/${slug}`,
      ...(lastmod ? { lastmod } : {}),
      changefreq: 'weekly',
      priority: '0.9'
    };
  });

  // 3. Main Pages
  const mainEntries: SitemapUrlEntry[] = [
    { url: `${DOMAIN}/`, changefreq: 'daily', priority: '1.0' },
    { url: `${DOMAIN}/movies`, changefreq: 'daily', priority: '0.9' },
    { url: `${DOMAIN}/tv-shows`, changefreq: 'daily', priority: '0.9' },
    { url: `${DOMAIN}/trending`, changefreq: 'daily', priority: '0.9' },
    { url: `${DOMAIN}/top-rated`, changefreq: 'weekly', priority: '0.8' },
    { url: `${DOMAIN}/collections`, changefreq: 'weekly', priority: '0.8' },
    { url: `${DOMAIN}/new-episodes`, changefreq: 'daily', priority: '0.8' },
    { url: `${DOMAIN}/people`, changefreq: 'weekly', priority: '0.7' },
    { url: `${DOMAIN}/random`, changefreq: 'weekly', priority: '0.6' },
    { url: `${DOMAIN}/tags`, changefreq: 'weekly', priority: '0.7' }
  ];

  // Valuable tag pages with matching content
  for (const tag of POPULAR_TAGS) {
    if (tag.name) {
      const clean = tag.name.toLowerCase().trim();
      mainEntries.push({
        url: `${DOMAIN}/tags/${encodeURIComponent(clean)}`,
        changefreq: 'weekly',
        priority: '0.7'
      });
    }
  }

  // OTT Platform Hubs
  const platforms = ['netflix', 'disney', 'prime', 'apple', 'hbo', 'hulu', 'paramount'];
  for (const plat of platforms) {
    mainEntries.push({
      url: `${DOMAIN}/platform/${plat}`,
      changefreq: 'weekly',
      priority: '0.7'
    });
  }

  // A-Z Directory
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const letter of alphabet) {
    mainEntries.push({
      url: `${DOMAIN}/az/${letter}`,
      changefreq: 'monthly',
      priority: '0.6'
    });
  }

  // 4. Build XML Strings
  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${DOMAIN}/sitemap-main.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${DOMAIN}/sitemap-movies.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${DOMAIN}/sitemap-tv.xml</loc>
  </sitemap>
</sitemapindex>
`;

  const mainXml = buildXmlUrlset(mainEntries);
  const moviesXml = buildXmlUrlset(movieEntries);
  const tvXml = buildXmlUrlset(tvEntries);

  // 5. Validation Step
  const mainVal = validateSitemapXml(mainXml, 'sitemap-main.xml');
  const moviesVal = validateSitemapXml(moviesXml, 'sitemap-movies.xml');
  const tvVal = validateSitemapXml(tvXml, 'sitemap-tv.xml');

  console.log(`[Validation PASSED]`);
  console.log(`- sitemap-main.xml: ${mainVal.count} valid URLs`);
  console.log(`- sitemap-movies.xml: ${moviesVal.count} valid movie URLs`);
  console.log(`- sitemap-tv.xml: ${tvVal.count} valid TV series URLs`);

  if (isDryRun) {
    console.log('[DRY RUN] Finished without writing files.');
    return;
  }

  // 6. Write to disk
  const targets = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'dist')
  ];

  for (const targetDir of targets) {
    if (fs.existsSync(targetDir)) {
      fs.writeFileSync(path.join(targetDir, 'sitemap.xml'), sitemapIndexXml, 'utf8');
      fs.writeFileSync(path.join(targetDir, 'sitemap-main.xml'), mainXml, 'utf8');
      fs.writeFileSync(path.join(targetDir, 'sitemap-movies.xml'), moviesXml, 'utf8');
      fs.writeFileSync(path.join(targetDir, 'sitemap-tv.xml'), tvXml, 'utf8');
      console.log(`Wrote sitemaps to ${targetDir}`);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSitemaps().catch(err => {
    console.error('Sitemap generator error:', err);
    process.exit(1);
  });
}
