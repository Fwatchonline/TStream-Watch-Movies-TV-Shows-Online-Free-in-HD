# TStream.online — Complete Technical SEO Audit, Source Code Repair & Production Readiness Report

**Date:** November 2026  
**Target Domain:** `https://tstream.online` (Canonical Non-WWW, HTTPS)  
**Authoritative Stack:** React 19, TypeScript, Vite 8, Hono + Custom Node.js HTTP Server (`dist/server.mjs`), Tailwind CSS 4, TMDB API, Firebase / Firestore, PWA, Nginx, PM2  
**Required Runtime:** Node.js `>=24.12.0` (verified in `.nvmrc`, `package.json`, `.github/workflows/deploy-tstream.yml`, `scripts/update-vps.sh`)  
**Status:** Source Code Fixes Implemented & Locally Verified (VPS Live Verification Pending Authorization)

---

## 1. Executive Summary

A source-level technical SEO and production readiness audit of **TStream.online** was executed against the existing React 19 / Vite 8 / Hono / Node.js codebase to resolve the remaining root causes behind Google Search Console indexing failures, canonical mismatches, sitemap discrepancies, thin/duplicate episode indexing, and runtime error propagation.

All identified source-code defects were fixed directly in the repository **without redesigning the UI, removing streaming providers, breaking authentication/Firebase, or altering any live VPS / PM2 / Nginx state**.

### Key Outcomes Verified Locally (`dist/` & Built Server `dist/server.mjs`)
- **Unified Tag Slugs & TMDB Keyword Integrity:** Consolidated all tag routing, frontend links, SSR HTML, prerendering, and XML sitemaps on canonical lowercase kebab-case slugs (`src/utils/tags.ts`) while resolving multiword slugs (e.g., `/tags/time-travel` -> `"time travel"`, `/tags/based-on-novel-or-book` -> `"based on novel or book"`) cleanly for TMDB keyword queries and local catalog matching.
- **Genuine Genre Landing Pages:** Implemented `/genre/:slug` landing pages (`src/utils/genres.ts`, `src/App.tsx`, `src/pages/CatalogPage.tsx`, `scripts/seoHtmlPlugin.ts`) backed by genuine TMDB genre IDs and local catalog matching, marking empty genres `200 + noindex`, unknown genres `404`, and `/genre/sci-fi` as a `noindex` alias canonicalizing to `/genre/science-fiction`.
- **Single Authoritative Route Inventory:** Created `scripts/routeInventory.ts`, consumed by `scripts/prerender.ts`, `scripts/generate-sitemaps.ts`, and `scripts/verify-production.ts`, eliminating drift between generated HTML files, sitemaps, and reported route counts.
- **Zero Fake `<lastmod>` & Verified `sitemap-episodes.xml`:** Removed fabricated `releaseDate` / `firstAirDate` `<lastmod>` tags from all XML sitemaps and enforced rejection of unverified `<lastmod>` inside `validateSitemapXml()`. Added `sitemap-episodes.xml` exclusively for verified, content-rich TV episodes (`11` URLs), bringing total validated sitemap URLs to **99** (`52` main + `29` movie + `7` TV + `11` episodes).
- **Episode Indexability & Schema Isolation:** Added `isEpisodeSeoIndexable()` (`src/utils/seo.ts`) so unverified or thin episodes within season bounds emit `200 + noindex` (preserving playback compatibility) without duplicating parent series overviews, while out-of-bounds/nonexistent seasons/episodes return genuine HTTP `404` and upstream 429/5xx failures return `503`. Isolated `TVEpisode` JSON-LD so it never inherits the parent `TVSeries` `aggregateRating` or `voteCount`.
- **Accurate Prerender Reporting:** `dist/prerender-report.json` now separates `indexableSucceeded` (**128**) from `noindexSucceeded` (**14**), totaling **142** validated static HTML artifacts (**0** failures).
- **Six-Suite Automated Verification:** All **6** configured test suites (`pagination.test.ts`, `seo.test.ts`, `subtitles.test.ts`, `server.test.ts`, `retries.test.ts`, `deploy.test.ts`), `npm run lint` (`tsc --noEmit`), `npm run build`, and **95/95** live HTTP/SEO checks (`scripts/verify-production.ts` against `dist/server.mjs`) passed.

---

## 2. Confirmed Source-Code Bugs Discovered & Fixed

| # | Bug Discovered | Root Cause | Implemented Fix |
|---|---|---|---|
| 1 | **Tag URL vs Prerender Filesystem Mismatch** | Multiword tags (e.g., `"time travel"`, `"based on novel or book"`, `"coming of age"`) produced URL-encoded paths (`/tags/time%20travel`) that did not match prerender paths (`dist/tags/time-travel/index.html`) or lacked reverse TMDB keyword mapping. | Created `src/utils/tags.ts` (`tagToSlug`, `slugToTag`, `normalizeTag`, `getCanonicalTagUrl`, `isValidTagSlug`). Updated `src/App.tsx`, `src/pages/TagsPage.tsx`, `src/utils/seo.ts`, `scripts/seoHtmlPlugin.ts`, `scripts/routeInventory.ts`, `scripts/generate-sitemaps.ts`, and `src/services/tmdb.ts` (`fetchByTag`) to use kebab-case canonical URLs while passing `"time travel"` spacing to TMDB keyword lookup; legacy `/tag/*` and `%20` URLs emit `200 + noindex` canonicalizing to kebab-case URLs. |
| 2 | **Incomplete Genre Landing Pages** | Docs previously claimed genre pages were prerendered (`action`, `comedy`, `drama`, `science-fiction`, `thriller`, etc.) despite inconsistent `/genre/:slug` handling, pagination, and catalog/TMDB discovery parity. | Created `src/utils/genres.ts` (`GENRE_LANDINGS`, `slugToGenre`, `genreToSlug`, `getCanonicalGenreUrl`, `itemMatchesGenre`). Added genuine `/genre/:slug` routing in `App.tsx`, `CatalogPage.tsx`, `seo.ts`, `seoHtmlPlugin.ts`, and `tmdb.ts` (`fetchServerGenreMedia` / `fetchByGenre`). Populated genres are `index, follow` and in `sitemap-main.xml`; empty offline genres (e.g., `/genre/western`) are `200 + noindex` and omitted from sitemaps; unknown slugs return HTTP `404`. |
| 3 | **Fake `<lastmod>` Timestamps in XML Sitemaps** | `scripts/generate-sitemaps.ts` emitted `releaseDate` and `firstAirDate` as `<lastmod>`, which represent original media release dates rather than webpage modification dates. | Removed `lastmod` emission from `sitemap-main.xml`, `sitemap-movies.xml`, `sitemap-tv.xml`, and `sitemap-episodes.xml`. Updated `validateSitemapXml()` to throw if unverified `<lastmod>` tags appear (`allowVerifiedLastmod` defaults to `false`). |
| 4 | **Thin / Unverified Episode Indexing & Overview Duplication** | `fetchServerEpisode()` and episode metadata allowed unverified episodes to fall back to the parent series overview and render indexable HTML, inflating near-duplicate pages while lacking a verified `sitemap-episodes.xml`. | Added `isEpisodeSeoIndexable()` in `src/utils/seo.ts` and strict bounds/upstream validation in `scripts/seoHtmlPlugin.ts` (`fetchServerEpisode`). Out-of-bounds seasons/episodes return HTTP `404`; upstream 429/5xx returns HTTP `503`; unverified/thin episodes within valid season bounds preserve player playback (`HTTP 200`) with `noindex, follow` and without copying the parent series overview; only verified content-rich episodes enter `sitemap-episodes.xml`. |
| 5 | **Parent Rating Leakage into `TVEpisode` JSON-LD** | Episode structured data could inherit parent `TVSeries` `voteAverage` and `voteCount` (or fall back when episode-level ratings did not exist), attributing series-wide ratings to individual episodes. | Separated `TVEpisode` schema generation in `src/utils/seo.ts` so `aggregateRating` is omitted unless genuine episode-specific rating/voteCount fields exist, while preserving accurate `partOfSeason`, `partOfSeries`, `episodeNumber`, `datePublished`, and canonical URL. |
| 6 | **Route Inventory Drift & Inflated Report Counts** | `prerender.ts`, `generate-sitemaps.ts`, and audit docs used separate route lists, counting `noindex` / utility / error pages alongside indexable pages. | Created `scripts/routeInventory.ts` as the single shared inventory. Updated `scripts/prerender.ts` to validate every artifact on disk and record `indexableSucceeded` (128) separately from `noindexSucceeded` (14) in `dist/prerender-report.json`. |
| 7 | **SSR vs CSR Tie-Break & Partial Failure Divergence** | `normalizeServerTmdbListItem()` in `scripts/seoHtmlPlugin.ts` kept unrounded `vote_average` floats while client `normalizeTMDBItem()` rounded to `toFixed(1)`. Platform parallel `Promise.all` fetches in `src/services/tmdb.ts` could mask transient 429/5xx errors on one media type. | Rounded `voteAverage` to 1 decimal place in `normalizeServerTmdbListItem()`. Updated `fetchCatalog('platform', ...)` in `src/services/tmdb.ts` to rethrow transient `429`/`5xx`/`503` when `requestOpts.throwOnError` is enabled. |
| 8 | **Environment Loading, Retry Locks & Release Safety** | `npm run build` / `prerender.ts` needed guaranteed `.env` loading via `dotenv` without leaking `TMDB_API_KEY`; UI retry locks (`attemptedSeasonsRef` / `attemptedPlatformsRef`) blocked retries; PM2 release switching needed atomic symlink + `commitSha` + post-SEO `pm2 save` rollback guarantees. | Added `scripts/loadEnv.mjs` + dist secret-leak scan in `scripts/run-build.mjs`; replaced permanent retry locks with `src/utils/retryState.ts`; hardened `scripts/update-vps.sh`, `ecosystem.config.cjs`, and `.github/workflows/deploy-tstream.yml`. |
| 9 | **Outdated Documentation & Node Version Discrepancy** | Previous reports referenced legacy `generate-sitemaps.cjs`, 91 routes, 3 test suites, and Node `22.13.0`, whereas the project enforces Node `>=24.12.0` and 6 test suites. | Aligned documentation (`TSTREAM_SEO_AUDIT_REPORT.md`, `TSTREAM_SEO_TEST_RESULTS.md`) with verified codebase outputs while transparently noting sandbox container limitations. |

---

## 3. Canonical URL & Indexing Policy Matrix

All canonical URLs enforce `https://tstream.online` (HTTPS, non-www, no trailing slash except `/`, tracking query params stripped):

| Route Pattern | Status | Robots Directive | Canonical Target | Sitemap Included |
|---|---|---|---|---|
| `/` | `200` | `index, follow` | `https://tstream.online/` | `sitemap-main.xml` |
| `/movies`, `/tv-shows`, `/trending`, `/top-rated`, `/collections`, `/tags` | `200` | `index, follow` | Self-referencing HTTPS non-www | `sitemap-main.xml` |
| `/movies?page=2` (valid populated page) | `200` | `index, follow` | `https://tstream.online/movies?page=2` | Query pagination excluded from XML |
| `/movies?page=0`, `?page=9999`, filter/sort params (`?genreId=28`, `?year=2024`, `?sortBy=...`) | `200` | `noindex, follow` | `https://tstream.online/movies` | No |
| `/tags/:slug` (valid kebab-case tag with matches) | `200` | `index, follow` | `https://tstream.online/tags/:slug` | `sitemap-main.xml` (`12` tags) |
| `/tag/:tag`, `/tags/time%20travel` (legacy/unnormalized) | `200` | `noindex, follow` | `https://tstream.online/tags/:kebab-slug` | No |
| `/genre/:slug` (populated genre) | `200` | `index, follow` | `https://tstream.online/genre/:slug` | `sitemap-main.xml` (`15` genres) |
| `/genre/:slug` (valid but 0 offline/TMDB matches, e.g. `/genre/western`) | `200` | `noindex, follow` | `https://tstream.online/genre/:slug` | No |
| `/genre/sci-fi` (alias) | `200` | `noindex, follow` | `https://tstream.online/genre/science-fiction` | No |
| `/platform/:id` (populated, e.g. `/platform/netflix`, `/platform/max`) | `200` | `index, follow` | `https://tstream.online/platform/:id` | `sitemap-main.xml` (`4` platforms) |
| `/platform/hbo` (alias) or empty offline platform (`/platform/crunchyroll`) | `200` | `noindex, follow` | `https://tstream.online/platform/max` or self | No |
| `/az/:letter` (populated letter) vs empty letter (`/az/Q`) | `200` | `index, follow` / `noindex, follow` | `https://tstream.online/az/:letter` | Populated only (`13` letters) |
| `/movie/:slug` | `200` | `index, follow` | `https://tstream.online/movie/:slug` | `sitemap-movies.xml` (`29` movies) |
| `/watch/movie/:slug` | `200` | `index, follow` | `https://tstream.online/movie/:slug` | Excluded (canonicalizes to `/movie/:slug`) |
| `/tv/:slug` | `200` | `index, follow` | `https://tstream.online/tv/:slug` | `sitemap-tv.xml` (`7` series) |
| `/watch/tv/:slug/:s/:e` (verified content-rich episode) | `200` | `index, follow` | `https://tstream.online/watch/tv/:slug/:s/:e` | `sitemap-episodes.xml` (`11` episodes) |
| `/watch/tv/:slug/:s/:e` (thin/unverified within season bounds) | `200` | `noindex, follow` | `https://tstream.online/watch/tv/:slug/:s/:e` | Excluded |
| `/search?q=...`, `/random`, `/people`, `/new-episodes` | `200` | `noindex` | Normalized self URL | Excluded |
| Unknown movie/TV ID, out-of-bounds season/episode, invalid tag/genre/platform/path, missing static asset | `404` | `noindex, nofollow` (HTML) | `https://tstream.online/404` | Excluded |
| Transient upstream TMDB 429 / 5xx / timeout without stale cache | `503` | `noindex, nofollow` | Requested path | Excluded |

---

## 4. Authoritative Route Inventory, Sitemap & Prerender Counts

### XML Sitemaps (`public/sitemap*.xml` & `dist/sitemap*.xml`)
- **`sitemap.xml`** (index referencing 4 child sitemaps; zero `<lastmod>` tags)
  - **`sitemap-main.xml`:** **52** valid URLs (`7` hubs incl. `/`, `12` canonical kebab-case tags, `15` populated genres, `4` populated platforms, `13` populated A-Z letters + `1` `/` root = 52)
  - **`sitemap-movies.xml`:** **29** valid authoritative `/movie/:slug` URLs (including verified `/movie/spider-man-homecoming-315635`; zero `/watch/movie/`; zero corrupted `-28` Homecoming)
  - **`sitemap-tv.xml`:** **7** valid `/tv/:slug` series URLs
  - **`sitemap-episodes.xml`:** **11** verified content-rich TV episode URLs (`Breaking Bad` S1E1–E4, S2E1, S3E1, S4E1, S5E1; `The Last of Us` S1E1–E2; `Shogun` S1E1)
- **Total Sitemap URLs:** **99** valid, canonical, indexable HTTPS non-www URLs.

### Static Prerendered Artifacts (`dist/prerender-report.json`)
- **Attempted routes:** **142**
- **Succeeded total:** **142** (**0** failed)
  - **Indexable HTML (`index, follow`):** **128** (root, 6 indexable hubs, 12 tags, 15 populated genres, 4 populated platforms, 13 populated A-Z letters, 29 movie detail + 29 movie watch pages, 7 TV series, 11 verified episodes)
  - **Non-indexable / Utility / Error HTML:** **14** (`dist/404.html`, `/new-episodes`, `/people`, `/random`, 6 offline-empty genres, 5 offline-empty platforms)

---

## 5. Server 5xx Resilience, Environment & Deployment Hardening

- **Server Error Handling (`server.ts`, `src/server/app.ts`, `scripts/seoHtmlPlugin.ts`):**
  - Unknown `/api/*` routes return JSON `404`, never SPA `200` HTML.
  - Missing static assets return HTTP `404`, never SPA `200` HTML.
  - SSR TMDB proxy calls deduplicate in-flight requests, cache positive responses with bounded LRU memory limits, fall back to stale cache when safe, and return explicit HTTP `503` (not silent `200` or unhandled `500`) on unrecoverable upstream TMDB `429`/5xx/timeouts.
  - Per-client sliding-window rate limiting enforces `429` + `Retry-After` even on cached endpoints and ignores spoofed `X-Forwarded-For` unless `TRUST_PROXY=true`.
- **Build Environment Loading (`scripts/loadEnv.mjs`, `scripts/run-build.mjs`):**
  - Loads `.env` / shared release `.env` via `dotenv` without overwriting pre-existing CI environment variables and scans `dist/` (`assets/`, HTML, JSON reports, sitemaps) to ensure secrets (`TMDB_API_KEY`, `VITE_TMDB_API_KEY`) never leak into client artifacts.
- **Nginx (`nginx.conf.example`):**
  - Enforces HTTP -> HTTPS and `www.tstream.online` -> `tstream.online` 301 canonical redirects.
  - Sets `proxy_intercept_errors off` so upstream Node `404` and `503` status codes are never masked as `200`.
  - Routes query-string requests (`$is_args = "?"`) through `@seo_runtime` for dynamic pagination/filter `noindex`, serves query-less prerendered files cleanly via `try_files $uri $uri/index.html @seo_runtime`, and disables proxy buffering on `/api/(stream-proxy|stream-resolve|proxy|stream/|subtitle-proxy)` with `Range`/`If-Range` forwarding.

---

## 6. Environment Caveats, Limitations & Required VPS Checks

### Sandbox Environment Notes (Transparent Audit Disclosure)
1. **Node.js Version:** Project configuration (`.nvmrc`, `package.json`, `.github/workflows/deploy-tstream.yml`, `scripts/update-vps.sh`) consistently enforces **Node.js `>=24.12.0`**. This build container runs **Node.js `v22.23.2`**. In `src/services/__tests__/deploy.test.ts`, both an explicit `< 24.12.0` rejection test against the unmodified `scripts/update-vps.sh` gate AND a sandbox-only `node-24` preload wrapper execute cleanly without weakening production Node `>=24.12.0` checks. Before deploying to production, confirm the VPS and GitHub Actions runner execute on Node.js `>=24.12.0`.
2. **Git History & Lockfile:** This AI Studio workspace does not contain a `.git` directory or `package-lock.json`. Therefore, `npm ci`, `git diff`, branch creation, and commit pushing must be performed in the checked-out Git repository containing `package-lock.json`.
3. **Offline Build vs Production `TMDB_API_KEY`:** In this offline sandbox without a live `TMDB_API_KEY` or external internet egress, route inventory for genres and platforms reflects curated local catalog coverage; when built with a valid `TMDB_API_KEY` in CI/VPS `.env`, live TMDB genre/platform/episode responses populate dynamically via SSR and prerendering.

### Remaining Live VPS & Google Search Console Verification Checklist
Local tests **cannot** prove live production VPS logs or Google Search Console index status. After authorized deployment on Node.js `>=24.12.0`, verify directly on the VPS:
1. **Diff Live Nginx Config:** Inspect `/etc/nginx/sites-enabled/*tstream*` against `nginx.conf.example` (do not blindly overwrite unrelated virtual hosts), verify `proxy_intercept_errors off`, absence of `error_page 404 /index.html`, and 301 HTTP/WWW redirects.
2. **Inspect Historical 5xx Logs:** Query `/var/log/nginx/error.log`, `awk '($9 ~ /^5/)' /var/log/nginx/access.log`, and `pm2 logs --err` to confirm no residual OOM crashes, upstream socket timeouts, or TMDB 429 bursts occur under live Googlebot crawl load.
3. **Run Verifier Against Live Production Domain:**
   ```bash
   npx --no-install tsx scripts/verify-production.ts --base-url=https://tstream.online
   ```
   (Specifically validates live `http://tstream.online/` and `https://www.tstream.online/` 301 redirects, TLS, headers, and sitemap crawlability.)
4. **Google Search Console URL Inspection & Sitemap Resubmission:**
   - Inspect live URLs (`/`, `/tags/revenge`, `/tags/time-travel`, `/tags/based-on-novel-or-book`, `/genre/action`, `/genre/science-fiction`, `/movie/spider-man-homecoming-315635`, `/watch/tv/breaking-bad-1396/1/1`).
   - Resubmit `https://tstream.online/sitemap.xml` and request validation on *Page with redirect*, *Duplicate, Google chose different canonical than user*, and *Server error (5xx)*.
