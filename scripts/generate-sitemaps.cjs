/**
 * Automated Google SEO Sitemap Generator for TStream.online
 * Generates valid Google-compliant XML sitemaps:
 *   1. /public/sitemap.xml (Sitemap Index)
 *   2. /public/sitemap-main.xml (Main pages, genres, platforms, tags, people)
 *   3. /public/sitemap-movies.xml (All blockbuster & popular movies)
 *   4. /public/sitemap-tv.xml (All popular TV series)
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://tstream.online';
const TODAY = new Date().toISOString().split('T')[0];

function slugifyTitle(title) {
  if (!title) return 'stream';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'media';
}

function createMediaSlug(title, id) {
  const baseSlug = slugifyTitle(title || '');
  return `${baseSlug}-${id}`;
}

// 1. Core main pages
const MAIN_PAGES = [
  { url: '/', priority: '1.0', changefreq: 'daily' },
  { url: '/movies', priority: '0.9', changefreq: 'daily' },
  { url: '/tv-shows', priority: '0.9', changefreq: 'daily' },
  { url: '/trending', priority: '0.9', changefreq: 'daily' },
  { url: '/top-rated', priority: '0.8', changefreq: 'weekly' },
  { url: '/collections', priority: '0.8', changefreq: 'weekly' },
  { url: '/people', priority: '0.8', changefreq: 'weekly' },
  { url: '/random', priority: '0.7', changefreq: 'weekly' },
  { url: '/tags', priority: '0.7', changefreq: 'weekly' }
];

// OTT Platform Hubs
const PLATFORMS = ['netflix', 'disney', 'prime', 'apple', 'hbo', 'hulu', 'paramount'];

// A-Z Directory
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Read catalog data to extract movies and tv shows
const catalogPath = path.join(__dirname, '../src/services/catalogData.ts');
let catalogContent = '';
try {
  catalogContent = fs.readFileSync(catalogPath, 'utf8');
} catch (e) {
  console.warn('Could not read catalogData.ts directly:', e);
}

// Extract movie objects from catalogData
const moviesList = [];
const tvList = [];

// Regular expression to extract id, title, and mediaType
const itemRegex = /\{\s*id:\s*(\d+)[\s\S]*?title:\s*['"]([^'"]+)['"][\s\S]*?mediaType:\s*['"]([^'"]+)['"]/g;
let match;
while ((match = itemRegex.exec(catalogContent)) !== null) {
  const id = parseInt(match[1], 10);
  const title = match[2];
  const mediaType = match[3];
  if (mediaType === 'tv') {
    if (!tvList.some(item => item.id === id)) {
      tvList.push({ id, title });
    }
  } else {
    if (!moviesList.some(item => item.id === id)) {
      moviesList.push({ id, title });
    }
  }
}

// Default popular titles if needed
const DEFAULT_MOVIES = [
  { id: 969681, title: 'Spider-Man: Brand New Day' },
  { id: 533535, title: 'Deadpool & Wolverine' },
  { id: 693134, title: 'Dune: Part Two' },
  { id: 1022789, title: 'Inside Out 2' },
  { id: 157336, title: 'Interstellar' },
  { id: 155, title: 'The Dark Knight' },
  { id: 872585, title: 'Oppenheimer' },
  { id: 76600, title: 'Avatar: The Way of Water' },
  { id: 933260, title: 'Gladiator II' },
  { id: 573435, title: 'Bad Boys: Ride or Die' },
  { id: 519182, title: 'Despicable Me 4' },
  { id: 653346, title: 'Kingdom of the Planet of the Apes' },
  { id: 823464, title: 'Godzilla x Kong: The New Empire' },
  { id: 1011985, title: 'Kung Fu Panda 4' },
  { id: 315635, title: 'Spider-Man: Homecoming' },
  { id: 429617, title: 'Spider-Man: Far From Home' },
  { id: 634649, title: 'Spider-Man: No Way Home' },
  { id: 559, title: 'Spider-Man 3' },
  { id: 1930, title: 'The Amazing Spider-Man' },
  { id: 102382, title: 'The Amazing Spider-Man 2' },
  { id: 324857, title: 'Spider-Man: Into the Spider-Verse' },
  { id: 569094, title: 'Spider-Man: Across the Spider-Verse' },
  { id: 299534, title: 'Avengers: Endgame' },
  { id: 299536, title: 'Avengers: Infinity War' },
  { id: 284054, title: 'Black Panther' },
  { id: 284053, title: 'Thor: Ragnarok' }
];

DEFAULT_MOVIES.forEach(m => {
  if (!moviesList.some(item => item.id === m.id)) {
    moviesList.push(m);
  }
});

const DEFAULT_TV = [
  { id: 66732, title: 'Stranger Things' },
  { id: 1399, title: 'Game of Thrones' },
  { id: 1396, title: 'Breaking Bad' },
  { id: 100088, title: 'The Last of Us' },
  { id: 94997, title: 'House of the Dragon' },
  { id: 84958, title: 'Loki' },
  { id: 76479, title: 'The Boys' },
  { id: 119051, title: 'Wednesday' },
  { id: 93405, title: 'Squid Game' },
  { id: 60059, title: 'Better Call Saul' },
  { id: 71446, title: 'Money Heist' },
  { id: 63174, title: 'Lucifer' }
];

DEFAULT_TV.forEach(t => {
  if (!tvList.some(item => item.id === t.id)) {
    tvList.push(t);
  }
});

// Write Sitemap Index: /public/sitemap.xml
const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${DOMAIN}/sitemap-main.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${DOMAIN}/sitemap-movies.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${DOMAIN}/sitemap-tv.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
</sitemapindex>
`;

// Write /public/sitemap-main.xml
let mainXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

MAIN_PAGES.forEach(page => {
  mainXml += `  <url>
    <loc>${DOMAIN}${page.url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
});

PLATFORMS.forEach(plat => {
  mainXml += `  <url>
    <loc>${DOMAIN}/platform/${plat}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
});

ALPHABET.forEach(letter => {
  mainXml += `  <url>
    <loc>${DOMAIN}/az/${letter}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
});

mainXml += `</urlset>\n`;

// Write /public/sitemap-movies.xml
let moviesXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

moviesList.forEach(m => {
  const slug = createMediaSlug(m.title, m.id);
  moviesXml += `  <url>
    <loc>${DOMAIN}/watch/movie/${slug}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
});

moviesXml += `</urlset>\n`;

// Write /public/sitemap-tv.xml
let tvXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

tvList.forEach(t => {
  const slug = createMediaSlug(t.title, t.id);
  tvXml += `  <url>
    <loc>${DOMAIN}/watch/tv/${slug}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
});

tvXml += `</urlset>\n`;

const publicDir = path.join(__dirname, '../public');
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapIndexXml, 'utf8');
fs.writeFileSync(path.join(publicDir, 'sitemap-main.xml'), mainXml, 'utf8');
fs.writeFileSync(path.join(publicDir, 'sitemap-movies.xml'), moviesXml, 'utf8');
fs.writeFileSync(path.join(publicDir, 'sitemap-tv.xml'), tvXml, 'utf8');

console.log(`Generated Google XML Sitemaps:`);
console.log(`- sitemap.xml (Index)`);
console.log(`- sitemap-main.xml (${MAIN_PAGES.length + PLATFORMS.length + ALPHABET.length} URLs)`);
console.log(`- sitemap-movies.xml (${moviesList.length} movies)`);
console.log(`- sitemap-tv.xml (${tvList.length} TV shows)`);
