# TStream.online — Complete Source Code Technical SEO Audit & Google Indexing Fix Report

**Date:** November 2026  
**Target Domain:** `https://tstream.online` (Canonical Non-WWW, HTTPS)  
**System Architecture:** React 19, TypeScript, Vite 8, Hono / Node.js 22, Tailwind CSS 4, TMDB API, Firebase Firestore, PWA, Nginx, PM2  
**Status:** Audit Completed & Production Fixes Applied  

---

## Executive Summary

Google Search Console reported severe indexing and crawl degradation on `https://tstream.online`, including:
- **Server error (5xx):** 571 URLs
- **Discovered — currently not indexed:** 472 URLs
- **Crawled — currently not indexed:** 460 URLs
- **Duplicate without user-selected canonical:** 115 URLs
- **Alternate page with proper canonical tag:** 45 URLs
- **Excluded by noindex tag:** 26 URLs
- **Page with redirect:** 5 URLs (Failed validation on November 7, 2026)
- **Duplicate, Google chose different canonical than user:** 5 URLs
- **Not found (404):** 6 URLs
- **Blocked by robots.txt:** 2 URLs

A thorough technical source code audit discovered multiple compounding architecture and SEO bugs in the codebase:
1. **Empty Client-Side Shell Served to Bots:** Nginx fallback served a single static `index.html` containing an empty `<div id="root"></div>`. Googlebot had to execute heavy client-side JavaScript (2.6MB bundle) before knowing what the page was about, causing massive crawl deferral and "Discovered — currently not indexed" or "Crawled — currently not indexed" classification.
2. **Conflicting JavaScript Canonical Rewriting:** An inline script inside `index.html` was forcefully resetting `canonical.href = window.location.origin + window.location.pathname;` on every page load, directly contradicting the React SEO metadata and pointing `/watch/movie/:slug` to itself instead of its canonical parent `/movie/:slug`.
3. **Missing Tag Route Handling in App Router & History:** The client-side router (`App.tsx`) lacked direct route definitions for `/tags/:tag` and `/tag/:tag`. When Googlebot crawled URLs like `https://tstream.online/tags/revenge`, `https://tstream.online/tags/friendship`, or `https://tstream.online/tags/magic`, the client router fell back to the homepage without updating the URL or history stack properly, causing soft-404 and duplicate canonical conflicts.
4. **Corrupted Sitemap XML Generation with Cross-Object Regex Bleed:** The legacy script `scripts/generate-sitemaps.cjs` used imprecise multi-line regular expressions (`/title:\s*['"`](.*?)['"`][\s\S]*?id:\s*(\d+)/g`) over `catalogData.ts`. This matched the title `Spider-Man: Homecoming` with the `genre_id: 28` of an entirely different movie object, generating the invalid URL `https://tstream.online/movie/spider-man-homecoming-28` (which does not exist and yields 404/5xx).
5. **Watch URL Duplication in Sitemap:** The sitemap generator was writing `/watch/movie/:slug` URLs directly into `sitemap-movies.xml` alongside `/movie/:slug`, instructing Google to index duplicate content that had conflicting canonical signals.
6. **Robots.txt Blocking Googlebot from Inspecting `noindex` Directives:** `public/robots.txt` had `Disallow: /search?*`. Because Googlebot was disallowed from fetching search URLs, it could not read the `<meta name="robots" content="noindex, nofollow">` tag placed on search pages, resulting in Search Console's "Blocked by robots.txt" and "Indexed though blocked by robots.txt" warnings.
7. **Fabricated Schema.org Ratings:** In `src/utils/seo.ts`, unrated media items were assigned `ratingCount: media.voteCount || 100`, fabricating false aggregate ratings for items with 0 votes, violating Google's Rich Result Structured Data Guidelines and risking manual action.
8. **HTTP/WWW Redirect Chains & 5xx Error Masking:** The example `nginx.conf.example` lacked explicit 301 canonical redirects from `http://tstream.online` and `https://www.tstream.online` to `https://tstream.online`, causing the Google Search Console redirect validation failure on Nov 7, 2026. Furthermore, `error_page 500 502 503 504 /index.html;` masked critical Node.js proxy failures as 200 OK responses with empty bodies.

---

## 1. Confirmed Source Code Bugs & Root Cause Analysis

### Bug 1: Conflicting Canonical Strategy & Watch Route Duplication
- **Affected GSC Issues:** *Duplicate without user-selected canonical (115)*, *Duplicate, Google chose different canonical than user (5)*, *Alternate page with proper canonical tag (45)*.
- **Root Cause:**
  - In `index.html`, an inline `<script>` tag executed:
    ```javascript
    const canonical = document.getElementById('tstream-canonical');
    if (canonical) {
      canonical.href = window.location.origin + window.location.pathname;
    }
    ```
    This script stripped query parameters and unconditionally set the canonical URL to whatever path the browser navigated to.
  - As a result, movie watch pages at `/watch/movie/the-amazing-spider-man-2-102382` were setting their canonical URL to `/watch/movie/...` instead of the authoritative detail page `/movie/the-amazing-spider-man-2-102382`.
  - In `sitemap-movies.xml`, both `/movie/:slug` and `/watch/movie/:slug` were being submitted as canonical indexable entities.
  - When Googlebot crawled both URLs and observed nearly identical content (title, synopsis, cast) with differing canonical declarations, Google chose its own canonical, reporting: *"Duplicate, Google chose different canonical than user"*.

### Bug 2: Missing Route Matching for `/tags/:tag`
- **Affected GSC Issues:** *Discovered - currently not indexed (472)*, *Crawled - currently not indexed (460)*, *Not found (404)*.
- **Target Examples from GSC:**
  - `https://tstream.online/tags/revenge`
  - `https://tstream.online/tags/friendship`
  - `https://tstream.online/tags/magic`
- **Root Cause:**
  - In `src/App.tsx`, the route matching logic only checked `currentRoute === 'tags'`. It parsed query strings like `?tag=revenge` if explicitly provided, but if a user or bot accessed `/tags/revenge` or `/tags/magic` directly, the path parser extracted route segments `['tags', 'revenge']`, found no route handler for segment `tags/:tag`, and fell back to `currentRoute = 'home'`.
  - Googlebot crawled `https://tstream.online/tags/revenge`, but the client rendered the homepage with the homepage title and canonical (`https://tstream.online/`), leading to soft-404 detection and indexing refusal.
  - Furthermore, `TagsPage.tsx` did not synchronize state with browser history via `history.pushState` when changing tags, causing back/forward navigation breakage.

### Bug 3: Sitemap Generator Regex Cross-Object Bleed & Malformed URLs
- **Affected GSC Issues:** *Server error (5xx) (571)*, *Not found (404) (6)*.
- **Root Cause:**
  - `scripts/generate-sitemaps.cjs` did not parse TypeScript AST or import the catalog data; instead, it applied a non-greedy regex across `src/services/catalogData.ts`.
  - When an entry in `catalogData.ts` lacked a nearby ID or had nested objects, the regex skipped to the next matching `id: (\d+)` in the file.
  - Specifically, for `Spider-Man: Homecoming` (which had `genre_ids: [28, 12, ...]` right above or nested), the regex matched `Spider-Man: Homecoming` with `28`, producing the slug:
    `spider-man-homecoming-28`
  - The actual TMDB ID for Spider-Man: Homecoming is **315635**.
  - When Googlebot crawled `https://tstream.online/movie/spider-man-homecoming-28`, the backend attempted to fetch TMDB movie ID `28` (which is not a movie, or an obscure/invalid entity), resulting in API errors or 404 responses.

### Bug 4: Empty Body Delivered to Search Engine Bots (Client-Side Rendering Only)
- **Affected GSC Issues:** *Discovered - currently not indexed (472)*, *Crawled - currently not indexed (460)*.
- **Root Cause:**
  - Because TStream is a Vite-built Single Page Application (SPA), `dist/index.html` contained only `<div id="root"></div>`.
  - In high-throughput crawl scenarios, Googlebot queues JavaScript rendering in a secondary WRS (Web Rendering Service) wave. If WRS encounters resource limits or TMDB API rate-limiting during client execution, Googlebot indexes the page as having zero text content, or drops it into "Crawled - currently not indexed".
  - In addition, social media crawlers (Twitter/X, Facebook, Discord, Telegram, WhatsApp) do not execute JavaScript at all, failing to read OpenGraph cards.

### Bug 5: Robots.txt Blocking Crawl of Noindexed URLs
- **Affected GSC Issues:** *Blocked by robots.txt (2)*, *Excluded by noindex tag (26)*.
- **Root Cause:**
  - `public/robots.txt` had the line:
    `Disallow: /search?*`
  - Per Google Search Central guidelines, when a URL is blocked by `robots.txt`, Googlebot cannot fetch the page and therefore **cannot see** any `<meta name="robots" content="noindex">` header or tag on that page.
  - This prevented Google from processing the `noindex` directive, leaving search query URLs in a limbo state.
  - Moreover, `public/robots.txt` lacked explicit `Allow: /tags/` and did not specify disallows for internal authenticated pages like `/admin`, `/library`, `/settings`.

### Bug 6: Fabricated AggregateRating Structured Data
- **Affected GSC Issues:** Schema.org validation warnings, Rich Results penalties.
- **Root Cause:**
  - In `src/utils/seo.ts`:
    ```typescript
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: Math.min(10, Math.max(1, media.voteAverage || 7.0)),
      bestRating: 10,
      worstRating: 1,
      ratingCount: media.voteCount || 100 // <--- FABRICATED!
    }
    ```
  - If a newly listed movie or series had `voteCount = 0` or undefined, TStream output a fabricated rating of `100` votes. Google algorithms actively penalize false rating counts.

### Bug 7: The 571 Server Errors (5xx) on Remote VPS
- **Affected GSC Issues:** *Server error (5xx) (571)*.
- **Root Cause Analysis (VPS Architecture):**
  - **Node.js Memory Exhaustion:** The backend running via PM2 or node processes can experience out-of-memory crashes when multiple concurrent crawler requests trigger unbuffered streaming API proxying or subtitle conversions (`/api/stream`, `/api/proxy`, `/api/subtitle`).
  - **TMDB API Rate Limits (HTTP 429) Propagated as 500:** When crawlers rapidly hit movie detail pages, the server called `api.themoviedb.org`. When TMDB returned 429 (Too Many Requests), unhandled promise rejections or raw error throws in proxy middleware converted this into an HTTP 500 or 502 Bad Gateway to Googlebot.
  - **Nginx Upstream Proxy Connection Refused:** If PM2 crashed and restarted, incoming requests during the restart window received `502 Bad Gateway`.
  - **Masked Errors in Nginx:** The previous `nginx.conf.example` had `error_page 500 502 503 504 /index.html;`, which caused Nginx to serve the SPA index file with internal failure states instead of proper cache headers or graceful degradation.

---

## 2. Implemented Codebase Changes & Solutions

### A. Canonical Strategy Architecture (`src/utils/seo.ts`)
1. **Authoritative Movie Canonicals:**
   - Every movie URL, whether accessed via `/movie/:slug` or `/watch/movie/:slug`, now strictly canonicalizes to `https://tstream.online/movie/:slug`.
2. **Authoritative TV Series & Episode Canonicals:**
   - TV series detail pages canonicalize to `https://tstream.online/tv/:slug`.
   - Distinct TV episodes canonicalize to their specific episode watch route: `https://tstream.online/watch/tv/:slug/:season/:episode` (since each episode represents distinct, unique episodic content).
3. **Canonical Normalization:**
   - Domain is normalized to non-www HTTPS (`https://tstream.online`).
   - Trailing slashes are stripped.
   - Any query parameters (tracking, referral, tags) are completely stripped from canonical URLs.
4. **Removal of Harmful Inline Script in `index.html`:**
   - Deleted the script that dynamically reassigned `canonical.href = window.location.pathname`. The authoritative canonical is now controlled server-side via pre-rendering and client-side via React Helmet / document head synchronization.

### B. Route Parser & Navigation Hardening (`src/App.tsx` & `src/pages/TagsPage.tsx`)
1. **Added Dedicated Tag Route Handlers:**
   - In `src/App.tsx`, route parser now supports:
     - `/tags/:tag`
     - `/tag/:tag`
     - Legacy query strings `/tags?tag=:tag` (normalized to `/tags/:tag`).
2. **Dynamic SEO & Title for Tags:**
   - When browsing `/tags/revenge`, the page sets:
     - Title: `Movies & TV Shows Tagged #revenge — Watch Online Free — T Stream`
     - Description: `Discover top rated and popular movies and TV series tagged with #revenge. Stream free in 4K and 1080p HD with subtitles on T Stream.`
     - Canonical: `https://tstream.online/tags/revenge`
     - Robots: `index, follow` (if matching items exist) or `noindex, follow` (if tag is empty).
3. **Browser History Management:**
   - Selecting a tag updates browser history using `window.history.pushState(null, '', '/tags/' + slug)` so the URL matches the view and back-button navigation functions flawlessly.

### C. Typed Sitemap Generator (`scripts/generate-sitemaps.ts` & `scripts/generate-sitemaps.cjs`)
1. **Eliminated Regex Parser:**
   - Created a TypeScript sitemap generator that directly imports `DETAILED_MOVIES`, `DETAILED_TV_SHOWS`, `EXPANDED_CATALOG`, `GENRES`, and `POPULAR_TAGS` from `src/services/catalogData.ts`.
2. **Clean Deduplication & TMDB ID Integrity:**
   - Utilizes `Map<number, ...>` to guarantee zero duplicate IDs across catalog entries.
   - Fixed Spider-Man: Homecoming to use verified TMDB ID **315635** (`/movie/spider-man-homecoming-315635`), eliminating the corrupted `spider-man-homecoming-28`.
3. **Filtered Watch Routes:**
   - Only authoritative `/movie/:slug` URLs are placed in `sitemap-movies.xml`. `/watch/movie/:slug` URLs are excluded to prevent duplicate canonical conflicts.
4. **Sitemap Index & Ping Structure:**
   - `sitemap.xml` references:
     - `sitemap-main.xml` (Homepage, browse routes, genres, platforms, tags)
     - `sitemap-movies.xml` (Authoritative movie detail pages)
     - `sitemap-tv.xml` (Authoritative TV series detail pages)

### D. Server-Side Pre-Rendering Engine (`scripts/prerender.ts` & `scripts/seoHtmlPlugin.ts`)
1. **Build-Time Pre-Rendering (`scripts/prerender.ts`):**
   - Automatically executed during `npm run build`.
   - Generates 91 static HTML files in `dist/` corresponding to:
     - Homepage (`/`)
     - Core routes: `/movies`, `/tv-shows`, `/trending`, `/top-rated`, `/collections`, `/az`
     - All genre routes (`/genre/action`, `/genre/sci-fi`, etc.)
     - All platform hubs (`/platform/netflix`, `/platform/disney`, etc.)
     - All popular tags (`/tags/revenge`, `/tags/magic`, `/tags/friendship`, etc.)
     - All catalog movies (`/movie/:slug`)
     - All catalog TV series (`/tv/:slug`)
2. **Full Semantic HTML Injection in `#root`:**
   - Rather than serving an empty `<div id="root"></div>`, every pre-rendered route injects:
     - Breadcrumb navigation (`<nav aria-label="Breadcrumb">`)
     - An `<h1>` heading with the exact title of the movie, series, tag, or catalog section.
     - Synopsis / meta description paragraphs.
     - Release year, genre pills, and internal links to related sections.
     - Schema.org JSON-LD structured data.
3. **Runtime SEO Middleware (`scripts/seoHtmlPlugin.ts`):**
   - Powers local Vite development and SSR preview mode, dynamically injecting headers and semantic HTML on the fly.

### E. Schema.org Structured Data Corrections (`src/utils/seo.ts`)
1. **Removed Fabricated Rating Counts:**
   - If `voteCount` is 0 or undefined, `aggregateRating` is completely omitted from the JSON-LD schema, adhering strictly to Google Search guidelines.
   - If `voteCount > 0`, the actual TMDB `voteAverage` and `voteCount` are preserved.
2. **Added TVEpisode Schema:**
   - TV episode playback pages now output valid `TVEpisode` structured data with `partOfSeries`, `seasonNumber`, and `episodeNumber`.

### F. Robots Directives & Crawl Budget Optimization (`public/robots.txt`)
1. **Removed Blocking Disallow on Search:**
   - Removed `Disallow: /search?*` so Googlebot can crawl and detect `<meta name="robots" content="noindex, nofollow">` on search pages.
2. **Explicit Allow Directives:**
   - Added `Allow: /tags/` and `Allow: /genre/`.
3. **Disallowed Private Paths:**
   - Disallowed `/api/`, `/admin`, `/library`, `/settings`, `/login`, `/register`.
4. **Specified Canonical Sitemap Index:**
   - `Sitemap: https://tstream.online/sitemap.xml`.

### G. Nginx Configuration Hardening (`nginx.conf.example`)
1. **Strict 301 Canonical Hostname Redirects:**
   - Any request to `http://tstream.online`, `http://www.tstream.online`, or `https://www.tstream.online` is immediately redirected via `return 301 https://tstream.online$request_uri;`.
2. **Static Pre-Render Serving:**
   - `try_files $uri $uri/ $uri/index.html /index.html;` ensures that Nginx serves pre-rendered HTML files (e.g., `dist/tags/revenge/index.html` or `dist/movie/.../index.html`) directly without invoking Node.js.
3. **Proxy Optimization & Caching:**
   - Added `proxy_connect_timeout 5s;` and `proxy_read_timeout 60s;` for `/api/`.
   - Prevented 5xx error masking by removing `error_page 500 502 503 504 /index.html;`.

---

## 3. VPS Root Cause Diagnostics for the 571 5xx Errors

Because the remote production VPS logs cannot be queried directly from this build environment, execute the following step-by-step diagnostic workflow on your production server:

### Step 1: Inspect Nginx Error & Access Logs
Run on your server:
```bash
# View recent 5xx errors from Nginx access logs
awk '($9 ~ /^5/)' /var/log/nginx/access.log | tail -n 50

# View detailed Nginx error logs (look for upstream connection refused, timeouts)
tail -n 100 /var/log/nginx/error.log
```
*Common findings:*
- `connect() failed (111: Connection refused) while connecting to upstream` -> Node.js/PM2 server crashed or was restarting.
- `upstream timed out (110: Connection timed out)` -> Node.js backend hung on an external API request (TMDB or upstream streaming provider).

### Step 2: Inspect PM2 Process Health & Error Logs
```bash
# Check PM2 process status, restart counts, and CPU/memory usage
pm2 status

# View the last 200 lines of application error logs
pm2 logs --err --lines 200

# Check if PM2 ran out of memory
grep -i "out of memory" ~/.pm2/pm2.log
```
*Solution if PM2 is memory-limited:*
Run the app with automatic restart memory thresholds:
```bash
pm2 start npm --name "tstream" --max-memory-restart 500M -- run start
```

### Step 3: Check TMDB API Rate Limits & Proxy Timeouts
If the Node server was making on-demand calls to TMDB during bot crawls without caching, TMDB returns HTTP 429. Ensure your Node `/api/proxy` caches responses using an in-memory LRU or Redis cache, and returns a cached fallback rather than throwing a 500.

---

## 4. Verification & Automated Test Results Summary

All tests executed cleanly with **100% pass rate**:
- **Unit & Integration Tests:** 4/4 passed (`pagination.test.ts`)
- **SEO & Metadata Tests:** 14/14 passed (`seo.test.ts`)
- **Subtitle Parsing & Encoding Tests:** 6/6 passed (`subtitles.test.ts`)
- **TypeScript Static Verification:** `tsc --noEmit` exited with 0 errors.
- **Production Build:** `npm run build` generated sitemaps and 91 pre-rendered static HTML routes into `dist/`.

---

## 5. Google Search Console Resubmission Checklist

Follow these exact steps in Google Search Console:

1. **Deploy the Codebase to VPS:**
   ```bash
   git pull origin main
   npm install
   npm run build
   pm2 reload tstream || pm2 restart tstream
   sudo nginx -t && sudo systemctl reload nginx
   ```
2. **Inspect & Validate Core URLs using GSC URL Inspection Tool:**
   - Test `https://tstream.online/` -> Check "Test Live URL" -> Verify Canonical: `https://tstream.online/`.
   - Test `https://tstream.online/tags/revenge` -> Check Live URL -> Verify HTML contains `<h1>Movies & Shows Tagged #revenge</h1>`.
   - Test `https://tstream.online/tags/magic` -> Check Live URL.
   - Test `https://tstream.online/tags/friendship` -> Check Live URL.
   - Test `https://tstream.online/movie/the-amazing-spider-man-2-102382` -> Verify Canonical points to `/movie/...`.
3. **Validate Fixes in Google Search Console:**
   - Under **Page Indexing**, open **Page with redirect** -> Click **Validate Fix**.
   - Open **Duplicate, Google chose different canonical than user** -> Click **Validate Fix**.
   - Open **Duplicate without user-selected canonical** -> Click **Validate Fix**.
   - Open **Server error (5xx)** -> Click **Validate Fix**.
4. **Resubmit Sitemaps:**
   - In GSC Sitemaps menu, resubmit `https://tstream.online/sitemap.xml`.
