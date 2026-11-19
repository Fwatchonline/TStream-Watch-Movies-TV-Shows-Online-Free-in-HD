/**
 * Production TypeScript Dynamic XML Sitemap Generator for TStream.online
 *
 * Uses the single authoritative routeInventory.ts shared with prerender.ts and verify-production.ts:
 * - Expands Movies, TV Series, and Verified Episodes via curated collections + bounded paginated TMDB discovery.
 * - Positive integer TMDB IDs with strict movie vs TV separation & Spider-Man: Homecoming 315635 verification.
 * - Excludes movie watch routes, admin/auth/search/settings/noindex pages from sitemaps.
 * - Automatic URL (50,000) & byte-size (45 MB) splitting into chunked sitemaps + updated sitemap.xml index.
 * - Atomic staged file writes, XML validation before swap, and preservation of healthy existing sitemaps if live TMDB refresh fails completely.
 * - Omits fake <lastmod> timestamps completely.
 */

import fs from 'fs';
import path from 'path';
import { loadBuildEnv } from './loadEnv.mjs';
import {
  getAuthoritativeRouteInventory,
  getBuildInventorySnapshotPath,
  writeBuildInventorySnapshot,
  type AuthoritativeInventoryResult
} from './routeInventory.ts';
import type { TmdbDiscoveryOptions, TmdbDiscoveryStats } from './tmdbDiscovery.ts';

loadBuildEnv();

const DOMAIN = 'https://tstream.online';
const DEFAULT_PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DEFAULT_DIST_DIR = path.resolve(process.cwd(), 'dist');

export const MAX_URLS_PER_SITEMAP = 50000;
export const MAX_BYTES_PER_SITEMAP = 45 * 1024 * 1024; // 45 MB (protocol limit is 50 MB)

export interface SitemapUrlEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

export interface GenerateSitemapsOptions extends TmdbDiscoveryOptions {
  maxUrlsPerFile?: number;
  maxBytesPerFile?: number;
  preserveExistingOnTotalOutage?: boolean;
  preserveExistingOnOutage?: boolean;
  shrinkageThresholdRatio?: number;
  inventorySnapshotPath?: string | false;
  animeFetchImpl?: typeof fetch;
}

export interface SitemapGenerationResult {
  mainCount: number;
  moviesCount: number;
  tvCount: number;
  episodesCount: number;
  animeCount: number;
  totalCount: number;
  sitemapIndexXml: string;
  mainXml: string;
  moviesXml: string;
  tvXml: string;
  episodesXml: string | null;
  animeXml: string | null;
  files: Record<string, string>;
  chunkFiles: {
    main: string[];
    movies: string[];
    tv: string[];
    episodes: string[];
    anime: string[];
  };
  preservedExisting: boolean;
  mergedFromPreviousOnPartialOutage: boolean;
  preservedUrlsAddedCount: number;
  stats: TmdbDiscoveryStats;
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

function renderUrlEntryXml(entry: SitemapUrlEntry): string {
  let block = `  <url>\n    <loc>${escapeXml(entry.url)}</loc>\n`;
  if (entry.lastmod) {
    block += `    <lastmod>${entry.lastmod}</lastmod>\n`;
  }
  if (entry.changefreq) {
    block += `    <changefreq>${entry.changefreq}</changefreq>\n`;
  }
  if (entry.priority) {
    block += `    <priority>${entry.priority}</priority>\n`;
  }
  block += `  </url>\n`;
  return block;
}

export function buildXmlUrlset(entries: SitemapUrlEntry[]): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  const footer = `</urlset>\n`;
  const body = entries.map(renderUrlEntryXml).join('');
  return `${header}${body}${footer}`;
}

export function splitAndBuildUrlsetChunks(
  baseName: string,
  entries: SitemapUrlEntry[],
  maxUrlsPerFile: number = MAX_URLS_PER_SITEMAP,
  maxBytesPerFile: number = MAX_BYTES_PER_SITEMAP
): Array<{ filename: string; xml: string; entries: SitemapUrlEntry[] }> {
  const safeMaxUrls = Math.max(1, Math.floor(maxUrlsPerFile));
  const safeMaxBytes = Math.max(512, Math.floor(maxBytesPerFile));
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  const footer = `</urlset>\n`;
  const overheadBytes = Buffer.byteLength(header + footer, 'utf8');

  if (entries.length === 0) {
    return [{ filename: `${baseName}.xml`, xml: buildXmlUrlset([]), entries: [] }];
  }

  const chunks: Array<{ filename: string; xml: string; entries: SitemapUrlEntry[] }> = [];
  let currentEntries: SitemapUrlEntry[] = [];
  let currentBlocks: string[] = [];
  let currentBytes = overheadBytes;

  const flushChunk = () => {
    if (currentEntries.length === 0) return;
    const chunkNumber = chunks.length + 1;
    const filename = chunkNumber === 1 ? `${baseName}.xml` : `${baseName}-${chunkNumber}.xml`;
    chunks.push({
      filename,
      xml: `${header}${currentBlocks.join('')}${footer}`,
      entries: currentEntries
    });
    currentEntries = [];
    currentBlocks = [];
    currentBytes = overheadBytes;
  };

  for (const entry of entries) {
    const block = renderUrlEntryXml(entry);
    const blockBytes = Buffer.byteLength(block, 'utf8');

    const exceedsUrls = currentEntries.length >= safeMaxUrls;
    const exceedsBytes = currentEntries.length > 0 && currentBytes + blockBytes > safeMaxBytes;
    if (exceedsUrls || exceedsBytes) {
      flushChunk();
    }

    currentEntries.push(entry);
    currentBlocks.push(block);
    currentBytes += blockBytes;
  }

  flushChunk();
  return chunks;
}

export function validateSitemapXml(
  xmlContent: string,
  sitemapName: string,
  options: { allowVerifiedLastmod?: boolean; maxUrls?: number; maxBytes?: number } = {}
): { valid: boolean; count: number; urls: string[] } {
  if (!xmlContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    throw new Error(`[Sitemap Validator] ${sitemapName} is missing valid XML declaration`);
  }
  if (!xmlContent.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') || !xmlContent.trim().endsWith('</urlset>')) {
    throw new Error(`[Sitemap Validator] ${sitemapName} has malformed <urlset> wrapper`);
  }

  const maxBytes = options.maxBytes ?? MAX_BYTES_PER_SITEMAP;
  const maxUrls = options.maxUrls ?? MAX_URLS_PER_SITEMAP;
  const byteSize = Buffer.byteLength(xmlContent, 'utf8');
  if (byteSize > maxBytes) {
    throw new Error(`[Sitemap Validator] ${sitemapName} exceeds max byte size (${byteSize} > ${maxBytes})`);
  }

  // Fake/unverified <lastmod> (releaseDate, firstAirDate, or build timestamp) must never be emitted
  if (!options.allowVerifiedLastmod && /<lastmod>/i.test(xmlContent)) {
    throw new Error(
      `[Sitemap Validator] ${sitemapName} contains unverified <lastmod> tag; omit <lastmod> unless genuine modification timestamps exist.`
    );
  }

  const locRegex = /<loc>([^<]+)<\/loc>/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xmlContent)) !== null) {
    const url = match[1];
    if (!url.startsWith('https://tstream.online/')) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains non-canonical or non-HTTPS URL: ${url}`);
    }
    if (url.includes('undefined') || url.includes('null') || url.includes('NaN')) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains corrupted URL: ${url}`);
    }
    if (url.includes('/tags/') && (url.includes('%20') || /\s/.test(url) || /[A-Z]/.test(url.split('/tags/')[1] || ''))) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains non-canonical tag slug: ${url}`);
    }
    if (url.includes('spider-man-homecoming-28')) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains corrupted spider-man-homecoming-28!`);
    }
    if (url.includes('/watch/movie/')) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains duplicate watch movie URL: ${url}`);
    }
    if (/\/(admin|login|register|search|settings|player-settings|library|people|random|new-episodes)(\/|$|\?)/.test(new URL(url).pathname)) {
      throw new Error(`[Sitemap Validator] ${sitemapName} contains excluded/noindex URL: ${url}`);
    }
    urls.push(url);
  }

  if (urls.length > maxUrls) {
    throw new Error(`[Sitemap Validator] ${sitemapName} exceeds max URL limit (${urls.length} > ${maxUrls})`);
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

export function validateSitemapIndexXml(
  indexXml: string,
  childFilesMap?: Record<string, string>
): { valid: boolean; childFilenames: string[] } {
  if (!indexXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    throw new Error('[Sitemap Index Validator] sitemap.xml is missing valid XML declaration');
  }
  if (!indexXml.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') || !indexXml.trim().endsWith('</sitemapindex>')) {
    throw new Error('[Sitemap Index Validator] sitemap.xml has malformed <sitemapindex> wrapper');
  }

  const locs = Array.from(indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
  if (locs.length === 0) {
    throw new Error('[Sitemap Index Validator] sitemap.xml contains zero child sitemaps');
  }

  const childFilenames: string[] = [];
  const seen = new Set<string>();
  for (const loc of locs) {
    if (!loc.startsWith(`${DOMAIN}/`) || !loc.endsWith('.xml')) {
      throw new Error(`[Sitemap Index Validator] Invalid child sitemap URL: ${loc}`);
    }
    if (seen.has(loc)) {
      throw new Error(`[Sitemap Index Validator] Duplicate child sitemap URL in index: ${loc}`);
    }
    seen.add(loc);
    const filename = loc.slice(`${DOMAIN}/`.length);
    if (!filename || filename.includes('/')) {
      throw new Error(`[Sitemap Index Validator] Invalid child sitemap filename: ${filename}`);
    }
    if (childFilesMap && !Object.prototype.hasOwnProperty.call(childFilesMap, filename)) {
      throw new Error(`[Sitemap Index Validator] Referenced child sitemap "${filename}" missing from generated files`);
    }
    childFilenames.push(filename);
  }

  return { valid: true, childFilenames };
}

interface LoadedExistingSitemaps {
  files: Record<string, string>;
  mainCount: number;
  moviesCount: number;
  tvCount: number;
  episodesCount: number;
  animeCount: number;
  chunkFiles: { main: string[]; movies: string[]; tv: string[]; episodes: string[]; anime: string[] };
  existingUrls: { main: string[]; movies: string[]; tv: string[]; episodes: string[]; anime: string[] };
}

function tryLoadValidExistingSitemaps(dir: string): LoadedExistingSitemaps | null {
  const indexPath = path.join(dir, 'sitemap.xml');
  if (!fs.existsSync(indexPath)) return null;
  try {
    const indexXml = fs.readFileSync(indexPath, 'utf8');
    const idxCheck = validateSitemapIndexXml(indexXml);
    const files: Record<string, string> = { 'sitemap.xml': indexXml };
    const chunkFiles = {
      main: [] as string[],
      movies: [] as string[],
      tv: [] as string[],
      episodes: [] as string[],
      anime: [] as string[]
    };
    const existingUrls = {
      main: [] as string[],
      movies: [] as string[],
      tv: [] as string[],
      episodes: [] as string[],
      anime: [] as string[]
    };
    let mainCount = 0;
    let moviesCount = 0;
    let tvCount = 0;
    let episodesCount = 0;
    let animeCount = 0;

    for (const filename of idxCheck.childFilenames) {
      const childPath = path.join(dir, filename);
      if (!fs.existsSync(childPath)) return null;
      const xml = fs.readFileSync(childPath, 'utf8');
      const val = validateSitemapXml(xml, filename);
      if (val.count === 0) return null;
      files[filename] = xml;
      if (filename.startsWith('sitemap-main')) {
        chunkFiles.main.push(filename);
        existingUrls.main.push(...val.urls);
        mainCount += val.count;
      } else if (filename.startsWith('sitemap-movies')) {
        chunkFiles.movies.push(filename);
        existingUrls.movies.push(...val.urls);
        moviesCount += val.count;
      } else if (filename.startsWith('sitemap-tv')) {
        chunkFiles.tv.push(filename);
        existingUrls.tv.push(...val.urls);
        tvCount += val.count;
      } else if (filename.startsWith('sitemap-episodes')) {
        chunkFiles.episodes.push(filename);
        existingUrls.episodes.push(...val.urls);
        episodesCount += val.count;
      } else if (filename.startsWith('sitemap-anime')) {
        chunkFiles.anime.push(filename);
        existingUrls.anime.push(...val.urls);
        animeCount += val.count;
      }
    }

    if (moviesCount === 0 || tvCount === 0 || mainCount === 0) return null;
    return { files, mainCount, moviesCount, tvCount, episodesCount, animeCount, chunkFiles, existingUrls };
  } catch {
    return null;
  }
}

function mergeWithPreviousUrls(
  currentEntries: SitemapUrlEntry[],
  previousUrls: string[],
  defaultMeta: { changefreq: SitemapUrlEntry['changefreq']; priority: string }
): { entries: SitemapUrlEntry[]; addedCount: number } {
  if (!previousUrls || previousUrls.length === 0) {
    return { entries: currentEntries, addedCount: 0 };
  }
  const seen = new Set(currentEntries.map(e => e.url));
  const merged = [...currentEntries];
  let addedCount = 0;
  for (const prevUrl of previousUrls) {
    if (!prevUrl || seen.has(prevUrl)) continue;
    seen.add(prevUrl);
    merged.push({
      url: prevUrl,
      changefreq: defaultMeta.changefreq,
      priority: defaultMeta.priority
    });
    addedCount++;
  }
  return { entries: merged, addedCount };
}

function writeSitemapsAtomically(targetDir: string, files: Record<string, string>): void {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const stageDir = path.join(targetDir, `.sitemap-stage-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir, { recursive: true });

  try {
    // 1. Write all files into staging dir and re-validate from disk before touching live sitemaps
    for (const [filename, content] of Object.entries(files)) {
      const stagedPath = path.join(stageDir, filename);
      fs.writeFileSync(stagedPath, content, 'utf8');
      const verifyDisk = fs.readFileSync(stagedPath, 'utf8');
      if (filename === 'sitemap.xml') {
        validateSitemapIndexXml(verifyDisk, files);
      } else {
        validateSitemapXml(verifyDisk, filename);
      }
    }

    // 2. Remove stale legacy/chunk sitemap-*.xml files in targetDir not present in new build
    const nextFileSet = new Set(Object.keys(files));
    for (const existingName of fs.readdirSync(targetDir)) {
      if (/^sitemap(?:-[a-z0-9-]+)?\.xml$/i.test(existingName) && !nextFileSet.has(existingName)) {
        fs.unlinkSync(path.join(targetDir, existingName));
      }
    }

    // 3. Atomically promote staged files into targetDir
    for (const filename of Object.keys(files)) {
      fs.renameSync(path.join(stageDir, filename), path.join(targetDir, filename));
    }
  } finally {
    if (fs.existsSync(stageDir)) {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
  }
}

function deduplicateEntries(entries: SitemapUrlEntry[]): SitemapUrlEntry[] {
  const seen = new Set<string>();
  const unique: SitemapUrlEntry[] = [];
  for (const entry of entries) {
    if (!entry?.url || seen.has(entry.url)) continue;
    seen.add(entry.url);
    unique.push(entry);
  }
  return unique;
}

export async function generateSitemaps(
  isDryRun = false,
  publicDir: string = DEFAULT_PUBLIC_DIR,
  distDir: string = DEFAULT_DIST_DIR,
  options: GenerateSitemapsOptions = {}
): Promise<SitemapGenerationResult> {
  console.log('Generating production sitemaps from authoritative routeInventory...');

  const maxUrlsPerFile = Math.max(
    1,
    Number(options.maxUrlsPerFile ?? process.env.SITEMAP_MAX_URLS_PER_FILE ?? MAX_URLS_PER_SITEMAP) || MAX_URLS_PER_SITEMAP
  );
  const maxBytesPerFile = Math.max(
    512,
    Number(options.maxBytesPerFile ?? MAX_BYTES_PER_SITEMAP) || MAX_BYTES_PER_SITEMAP
  );
  const preserveExistingOnOutage =
    options.preserveExistingOnOutage ?? options.preserveExistingOnTotalOutage ?? true;
  const shrinkageThresholdRatio =
    Number.isFinite(options.shrinkageThresholdRatio) && Number(options.shrinkageThresholdRatio) > 0
      ? Math.min(1, Number(options.shrinkageThresholdRatio))
      : 0.85;

  const inventory: AuthoritativeInventoryResult = await getAuthoritativeRouteInventory(options);
  const { discoveryStats } = inventory;

  // Log safe discovery telemetry (no API keys!)
  console.log(
    `[Sitemap Discovery] live=${discoveryStats.liveEnabled}, maxPagesPerFeed=${discoveryStats.maxPagesPerFeed}, ` +
      `sources=${discoveryStats.sourcesUsed.length}, cachedHits=${discoveryStats.cachedHits}`
  );
  if (discoveryStats.liveEnabled) {
    console.log(`[Sitemap Discovery] pagesFetchedByFeed=${JSON.stringify(discoveryStats.pagesFetchedByFeed)}`);
    if (discoveryStats.failedFeeds.length > 0 || discoveryStats.hadPartialOutage) {
      console.warn(
        `[Sitemap Discovery] Partial upstream issues detected: failedFeeds=${JSON.stringify(discoveryStats.failedFeeds)}, ` +
          `movieDegraded=${discoveryStats.movieFeedsDegraded}, tvDegraded=${discoveryStats.tvFeedsDegraded}, ` +
          `episodeDegraded=${discoveryStats.episodeDiscoveryDegraded}, errors=${discoveryStats.errors.length}`
      );
    }
    console.log(
      `[Sitemap Discovery] rawMovies=${discoveryStats.rawMoviesCount}, uniqueLiveMovies=${discoveryStats.uniqueMoviesCount}, ` +
        `dupMoviesRemoved=${discoveryStats.duplicateMoviesRemoved}, invalidMoviesRejected=${discoveryStats.invalidMoviesRejected}`
    );
    console.log(
      `[Sitemap Discovery] rawTv=${discoveryStats.rawTvCount}, uniqueLiveTv=${discoveryStats.uniqueTvCount}, ` +
        `dupTvRemoved=${discoveryStats.duplicateTvRemoved}, invalidTvRejected=${discoveryStats.invalidTvRejected}`
    );
    console.log(
      `[Sitemap Discovery] showsForEpisodes=${discoveryStats.showsInspectedForEpisodes}, seasonsFetched=${discoveryStats.seasonsFetchedForEpisodes}, ` +
        `verifiedLiveEpisodes=${discoveryStats.verifiedEpisodesCount}, rejectedEpisodes=${discoveryStats.rejectedEpisodesCount}`
    );
  }

  // If live TMDB refresh suffered a total outage (every live call failed) AND valid existing sitemaps are present on disk,
  // preserve healthy existing sitemaps instead of clobbering production coverage with a small offline fallback.
  if (preserveExistingOnOutage && discoveryStats.hadTotalLiveOutage) {
    const existingPublic = tryLoadValidExistingSitemaps(publicDir);
    if (existingPublic) {
      console.warn(
        `[Sitemap Safety] Live TMDB refresh failed completely (${discoveryStats.errors.length} upstream errors). ` +
          `Preserving existing valid sitemaps in ${publicDir} (${existingPublic.moviesCount} movies, ${existingPublic.tvCount} TV, ${existingPublic.episodesCount} episodes).`
      );
      if (!isDryRun && fs.existsSync(distDir)) {
        writeSitemapsAtomically(distDir, existingPublic.files);
      }
      const firstMain = existingPublic.chunkFiles.main[0] || 'sitemap-main.xml';
      const firstMovies = existingPublic.chunkFiles.movies[0] || 'sitemap-movies.xml';
      const firstTv = existingPublic.chunkFiles.tv[0] || 'sitemap-tv.xml';
      const firstEp = existingPublic.chunkFiles.episodes[0];
      const firstAnime = existingPublic.chunkFiles.anime[0];
      return {
        mainCount: existingPublic.mainCount,
        moviesCount: existingPublic.moviesCount,
        tvCount: existingPublic.tvCount,
        episodesCount: existingPublic.episodesCount,
        animeCount: existingPublic.animeCount,
        totalCount:
          existingPublic.mainCount +
          existingPublic.moviesCount +
          existingPublic.tvCount +
          existingPublic.episodesCount +
          existingPublic.animeCount,
        sitemapIndexXml: existingPublic.files['sitemap.xml'],
        mainXml: existingPublic.files[firstMain],
        moviesXml: existingPublic.files[firstMovies],
        tvXml: existingPublic.files[firstTv],
        episodesXml: firstEp ? existingPublic.files[firstEp] : null,
        animeXml: firstAnime ? existingPublic.files[firstAnime] : null,
        files: existingPublic.files,
        chunkFiles: existingPublic.chunkFiles,
        preservedExisting: true,
        mergedFromPreviousOnPartialOutage: false,
        preservedUrlsAddedCount: 0,
        stats: discoveryStats
      };
    }
  }

  let movieEntries = deduplicateEntries(
    inventory.movies.map(m => ({
      url: m.canonicalUrl,
      changefreq: 'weekly',
      priority: '0.9'
    }))
  );

  // 2. TV Series from authoritative inventory
  let tvEntries = deduplicateEntries(
    inventory.tvShows.map(t => ({
      url: t.canonicalUrl,
      changefreq: 'weekly',
      priority: '0.9'
    }))
  );

  // 3. Verified, content-rich TV Episodes only
  let episodeEntries = deduplicateEntries(
    inventory.episodes.map(ep => ({
      url: ep.canonicalUrl,
      changefreq: 'weekly',
      priority: '0.7'
    }))
  );

  // 3B. First-class Anime series & films
  let animeEntries = deduplicateEntries(
    (inventory.anime || []).map(a => ({
      url: a.canonicalUrl,
      changefreq: 'weekly',
      priority: '0.85'
    }))
  );

  // 4. Main Pages (Indexable Hubs + Anime Hubs + Canonical Kebab Tags + Populated Genres + Populated Platforms + Populated A-Z)
  const rawMainEntries: SitemapUrlEntry[] = [
    { url: `${DOMAIN}/`, changefreq: 'daily', priority: '1.0' },
    ...inventory.hubs
      .filter(h => !h.noindex)
      .map(h => ({
        url: h.can,
        changefreq: (h.url === '/top-rated' || h.url === '/collections' || h.url === '/tags' ? 'weekly' : 'daily') as SitemapUrlEntry['changefreq'],
        priority: h.url === '/tags' ? '0.7' : h.url === '/top-rated' || h.url === '/collections' ? '0.8' : '0.9'
      })),
    ...(inventory.animeHubs || [])
      .filter(h => !h.noindex)
      .map(h => ({
        url: h.can,
        changefreq: 'daily' as const,
        priority: h.url === '/anime' || h.url === '/anime/trending' ? '0.9' : '0.8'
      })),
    ...inventory.tags.map(tagEntry => ({
      url: tagEntry.canonicalUrl,
      changefreq: 'weekly' as const,
      priority: '0.7'
    })),
    ...inventory.genres
      .filter(g => g.indexable)
      .map(genreEntry => ({
        url: genreEntry.canonicalUrl,
        changefreq: 'weekly' as const,
        priority: '0.8'
      })),
    ...inventory.platforms
      .filter(p => p.indexable)
      .map(platEntry => ({
        url: platEntry.canonicalUrl,
        changefreq: 'weekly' as const,
        priority: '0.7'
      })),
    ...inventory.az.map(azEntry => ({
      url: azEntry.canonicalUrl,
      changefreq: 'monthly' as const,
      priority: '0.6'
    }))
  ];
  let mainEntries = deduplicateEntries(rawMainEntries);

  // Partial outage & shrinkage protection: if live TMDB discovery had partial errors or failed feeds,
  // merge healthy previous snapshot URLs per degraded category so valid URLs are never discarded.
  let mergedFromPreviousOnPartialOutage = false;
  let preservedUrlsAddedCount = 0;

  if (
    preserveExistingOnOutage &&
    discoveryStats.liveEnabled &&
    (discoveryStats.hadPartialOutage || discoveryStats.hadUpstreamErrors)
  ) {
    const existingPublic = tryLoadValidExistingSitemaps(publicDir);
    if (existingPublic) {
      const movieShrinkage =
        existingPublic.moviesCount >= 50 &&
        movieEntries.length < Math.floor(existingPublic.moviesCount * shrinkageThresholdRatio);
      const tvShrinkage =
        existingPublic.tvCount >= 10 &&
        tvEntries.length < Math.floor(existingPublic.tvCount * shrinkageThresholdRatio);
      const episodeShrinkage =
        existingPublic.episodesCount >= 10 &&
        episodeEntries.length < Math.floor(existingPublic.episodesCount * shrinkageThresholdRatio);
      const animeShrinkage =
        existingPublic.animeCount >= 10 &&
        animeEntries.length < Math.floor(existingPublic.animeCount * shrinkageThresholdRatio);

      if (discoveryStats.hadPartialOutage || discoveryStats.movieFeedsDegraded || movieShrinkage) {
        const res = mergeWithPreviousUrls(movieEntries, existingPublic.existingUrls.movies, {
          changefreq: 'weekly',
          priority: '0.9'
        });
        movieEntries = res.entries;
        preservedUrlsAddedCount += res.addedCount;
      }

      if (discoveryStats.hadPartialOutage || discoveryStats.tvFeedsDegraded || tvShrinkage) {
        const res = mergeWithPreviousUrls(tvEntries, existingPublic.existingUrls.tv, {
          changefreq: 'weekly',
          priority: '0.9'
        });
        tvEntries = res.entries;
        preservedUrlsAddedCount += res.addedCount;
      }

      if (
        discoveryStats.hadPartialOutage ||
        discoveryStats.episodeDiscoveryDegraded ||
        discoveryStats.tvFeedsDegraded ||
        episodeShrinkage
      ) {
        const res = mergeWithPreviousUrls(episodeEntries, existingPublic.existingUrls.episodes, {
          changefreq: 'weekly',
          priority: '0.7'
        });
        episodeEntries = res.entries;
        preservedUrlsAddedCount += res.addedCount;
      }

      if (discoveryStats.hadPartialOutage || animeShrinkage) {
        const res = mergeWithPreviousUrls(animeEntries, existingPublic.existingUrls.anime, {
          changefreq: 'weekly',
          priority: '0.85'
        });
        animeEntries = res.entries;
        preservedUrlsAddedCount += res.addedCount;
      }

      if (discoveryStats.hadPartialOutage || movieShrinkage || tvShrinkage) {
        const res = mergeWithPreviousUrls(mainEntries, existingPublic.existingUrls.main, {
          changefreq: 'weekly',
          priority: '0.7'
        });
        mainEntries = res.entries;
        preservedUrlsAddedCount += res.addedCount;
      }

      if (preservedUrlsAddedCount > 0) {
        mergedFromPreviousOnPartialOutage = true;
        console.warn(
          `[Sitemap Safety] Partial TMDB outage merge active: preserved ${preservedUrlsAddedCount} valid previously discovered URL(s) from healthy snapshot in ${publicDir}.`
        );
      }
    }
  }

  // 5. Split oversized sitemaps automatically into protocol-compliant chunks
  const mainChunks = splitAndBuildUrlsetChunks('sitemap-main', mainEntries, maxUrlsPerFile, maxBytesPerFile);
  const movieChunks = splitAndBuildUrlsetChunks('sitemap-movies', movieEntries, maxUrlsPerFile, maxBytesPerFile);
  const tvChunks = splitAndBuildUrlsetChunks('sitemap-tv', tvEntries, maxUrlsPerFile, maxBytesPerFile);
  const hasEpisodes = episodeEntries.length > 0;
  const episodeChunks = hasEpisodes
    ? splitAndBuildUrlsetChunks('sitemap-episodes', episodeEntries, maxUrlsPerFile, maxBytesPerFile)
    : [];
  const hasAnime = animeEntries.length > 0;
  const animeChunks = hasAnime
    ? splitAndBuildUrlsetChunks('sitemap-anime', animeEntries, maxUrlsPerFile, maxBytesPerFile)
    : [];

  const allChildChunks = [...mainChunks, ...movieChunks, ...tvChunks, ...episodeChunks, ...animeChunks];
  const generatedFiles: Record<string, string> = {};

  // Cross-file deduplication & validation across ALL generated sitemaps
  const globalSeenUrls = new Set<string>();
  for (const chunk of allChildChunks) {
    const val = validateSitemapXml(chunk.xml, chunk.filename, {
      maxUrls: maxUrlsPerFile,
      maxBytes: maxBytesPerFile
    });
    for (const url of val.urls) {
      if (globalSeenUrls.has(url)) {
        throw new Error(`[Sitemap Validator] Cross-sitemap duplicate URL detected: ${url}`);
      }
      globalSeenUrls.add(url);
    }
    generatedFiles[chunk.filename] = chunk.xml;
  }

  const sitemapEntriesXml = allChildChunks
    .map(c => `  <sitemap>\n    <loc>${DOMAIN}/${escapeXml(c.filename)}</loc>\n  </sitemap>`)
    .join('\n');

  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntriesXml}\n</sitemapindex>\n`;
  validateSitemapIndexXml(sitemapIndexXml, generatedFiles);
  generatedFiles['sitemap.xml'] = sitemapIndexXml;

  console.log(`[Validation PASSED]`);
  console.log(`- sitemap-main:     ${mainEntries.length} URLs across ${mainChunks.length} file(s)`);
  console.log(`- sitemap-movies:   ${movieEntries.length} URLs across ${movieChunks.length} file(s)`);
  console.log(`- sitemap-tv:       ${tvEntries.length} URLs across ${tvChunks.length} file(s)`);
  if (hasEpisodes) {
    console.log(`- sitemap-episodes: ${episodeEntries.length} URLs across ${episodeChunks.length} file(s)`);
  }
  if (hasAnime) {
    console.log(`- sitemap-anime:    ${animeEntries.length} URLs across ${animeChunks.length} file(s)`);
  }

  const summary: SitemapGenerationResult = {
    mainCount: mainEntries.length,
    moviesCount: movieEntries.length,
    tvCount: tvEntries.length,
    episodesCount: episodeEntries.length,
    animeCount: animeEntries.length,
    totalCount:
      mainEntries.length +
      movieEntries.length +
      tvEntries.length +
      episodeEntries.length +
      animeEntries.length,
    sitemapIndexXml,
    mainXml: mainChunks[0].xml,
    moviesXml: movieChunks[0].xml,
    tvXml: tvChunks[0].xml,
    episodesXml: hasEpisodes ? episodeChunks[0].xml : null,
    animeXml: hasAnime ? animeChunks[0].xml : null,
    files: generatedFiles,
    chunkFiles: {
      main: mainChunks.map(c => c.filename),
      movies: movieChunks.map(c => c.filename),
      tv: tvChunks.map(c => c.filename),
      episodes: episodeChunks.map(c => c.filename),
      anime: animeChunks.map(c => c.filename)
    },
    preservedExisting: false,
    mergedFromPreviousOnPartialOutage,
    preservedUrlsAddedCount,
    stats: discoveryStats
  };

  if (isDryRun) {
    console.log('[DRY RUN] Finished without writing files.');
    return summary;
  }

  // 6. Atomically write validated sitemaps to public/ (and dist/ if present)
  writeSitemapsAtomically(publicDir, generatedFiles);
  console.log(`Wrote ${Object.keys(generatedFiles).length} validated sitemap files to ${publicDir}`);

  if (fs.existsSync(distDir)) {
    writeSitemapsAtomically(distDir, generatedFiles);
    console.log(`Wrote ${Object.keys(generatedFiles).length} validated sitemap files to ${distDir}`);
  }

  // 7. Save secret-free temporary build inventory snapshot for prerender.ts reuse within the same build
  if (options.inventorySnapshotPath !== false) {
    const snapshotTarget =
      typeof options.inventorySnapshotPath === 'string'
        ? options.inventorySnapshotPath
        : path.resolve(publicDir) === DEFAULT_PUBLIC_DIR
          ? getBuildInventorySnapshotPath()
          : null;
    if (snapshotTarget) {
      writeBuildInventorySnapshot(inventory, snapshotTarget);
    }
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
