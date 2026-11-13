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
- **Zero Fake `<lastmod>` & Verified `sitemap-episodes.xml`:** Removed fabricated `releaseDate` / `firstAirDate` `<lastmod>` tags from all XML sitemaps and enforced rejection of unverified `<lastmod>` inside `validateSitemapXml()`. Added `sitemap-episodes.xml` exclusively for verified, content-rich TV episodes (`11` URLs), bringing total validated offline sitemap URLs to **98** (`51` main + `29` movie + `7` TV + `11` episodes).
- **Strict Episode Indexability, Verification & Schema Isolation:** Added `isGenuineEpisodeName()`, `validateVerifiedEpisodeRecord()`, and strengthened `isEpisodeSeoIndexable()` (`src/utils/seo.ts`, `scripts/routeInventory.ts`, `scripts/seoHtmlPlugin.ts`, `src/pages/WatchPage.tsx`) to require explicit verification, positive integer `seriesId` & `episodeId`, valid season/episode bounds, non-generic episode titles (rejecting `"Episode 1"`, `"Ep. 2"`, `"Season 1 Episode 1"`, `"TBD"`), and `>=15`-char overviews distinct from both series and season synopses. Unverified or thin episodes within season bounds emit `200 + noindex`, out-of-bounds seasons/episodes return HTTP `404`, upstream `429`/5xx returns HTTP `503`, and `TVEpisode` JSON-LD never inherits parent `TVSeries` ratings.
- **Public Asset Hygiene & Internal Artifact Blocking:** Removed internal AI Studio prompt files (`Paste_November_*`), dev video (`AwesomeScreenshot-*.mp4`), and scratch screenshots (`Spider-Man_Streaming_Watch_Page_*.png`, `image_*.png`) from `public/assets/aistudio/` while preserving the legitimate website logo (`tstream-logo-yellow-transparent_1__d41aea4b.png`), added `.gitignore` rules, and exported `verifyNoInternalArtifacts()` in `scripts/run-build.mjs` scanning `public/` pre-build and `dist/` post-build.
- **Strict Cross-Media Genre Isolation (Movies vs. TV Series):** Fixed `src/utils/genres.ts` (`GENRE_META_OVERRIDES`, `GENRE_LANDINGS`, `itemMatchesGenre`), `src/services/catalogData.ts` (`Severance` TV genre `10765`), and `src/services/tmdb.ts` (`fetchCatalog`) so TMDB movie IDs (`28`, `878`, `27`, `53`) and TV IDs (`10759`, `10765`) never cross-contaminate. Removing bogus `tmdbTvGenreId: 9648` from `/genre/horror` eliminates Mystery (`9648`) TV contamination; with zero offline Horror catalog titles, `/genre/horror` emits `200 + noindex` offline (excluded from offline `sitemap-main.xml`) and queries `/discover/movie?with_genres=27` cleanly when live `TMDB_API_KEY` is configured.
- **Accurate Prerender Reporting:** `dist/prerender-report.json` separates `indexableSucceeded` (**127**) from `noindexSucceeded` (**15**), totaling **142** validated static HTML artifacts (**0** failures).
- **Six-Suite Automated Verification:** All **6** configured test suites (`172/172` assertions across `pagination.test.ts`, `seo.test.ts`, `subtitles.test.ts`, `server.test.ts`, `retries.test.ts`, `deploy.test.ts`), `npm run lint` (`tsc --noEmit`, `0` errors), `npm run build`, and **104/104** live HTTP/SEO checks (`scripts/verify-production.ts` against `dist/server.mjs`) passed.

---

## 2. Confirmed Source-Code Bugs Discovered & Fixed

| # | Bug Discovered | Root Cause | Implemented Fix |
|---|---|---|---|
| 1 | **Tag URL vs Prerender Filesystem Mismatch** | Multiword tags (e.g., `"time travel"`, `"based on novel or book"`, `"coming of age"`) produced URL-encoded paths (`/tags/time%20travel`) that did not match prerender paths (`dist/tags/time-travel/index.html`) or lacked reverse TMDB keyword mapping. | Created `src/utils/tags.ts` (`tagToSlug`, `slugToTag`, `normalizeTag`, `getCanonicalTagUrl`, `isValidTagSlug`). Updated `src/App.tsx`, `src/pages/TagsPage.tsx`, `src/utils/seo.ts`, `scripts/seoHtmlPlugin.ts`, `scripts/routeInventory.ts`, `scripts/generate-sitemaps.ts`, and `src/services/tmdb.ts` (`fetchByTag`) to use kebab-case canonical URLs while passing `"time travel"` spacing to TMDB keyword lookup; legacy `/tag/*` and `%20` URLs emit `200 + noindex` canonicalizing to kebab-case URLs. |
| 2 | **Incomplete Genre Landing Pages & Cross-Media ID Contamination** | `/genre/:slug` lacked strict movie vs. TV taxonomy isolation: `GENRE_META_OVERRIDES` mapped TV Mystery (`9648`) onto Horror (`27`), TV Crime (`80`) onto Thriller (`53`), movie IDs (`28`/`878`) leaked into TV-only `action-adventure`/`sci-fi-fantasy` via `GENRE_LANDINGS` fallback, `itemMatchesGenre()` merged movie+TV IDs into a single array, and `Severance` (`95396`, TV) carried movie-only `878`. | Rewrote `itemMatchesGenre()` (`src/utils/genres.ts`) to resolve media type (`isTv`) before matching strictly against `tmdbTvGenreId` or `tmdbMovieGenreId`, cleaned `GENRE_META_OVERRIDES` & `GENRE_LANDINGS`, updated `Severance` (`src/services/catalogData.ts`) to TV `10765`, and updated `fetchCatalog()` (`src/services/tmdb.ts`) to separate movie/TV genre filters cleanly. |
| 3 | **Fake `<lastmod>` Timestamps in XML Sitemaps** | `scripts/generate-sitemaps.ts` emitted `releaseDate` and `firstAirDate` as `<lastmod>`, which represent original media release dates rather than webpage modification dates. | Removed `lastmod` emission from `sitemap-main.xml`, `sitemap-movies.xml`, `sitemap-tv.xml`, and `sitemap-episodes.xml`. Updated `validateSitemapXml()` to throw if unverified `<lastmod>` tags appear (`allowVerifiedLastmod` defaults to `false`). |
| 4 | **Weak / Unverified Episode Indexing & Overview Duplication** | Generic titles (`"Episode 1"`), missing episode IDs, season-overview duplicates, or parent-show/season mismatches needed strict rejection before indexing or sitemap inclusion. | Added `isGenuineEpisodeName()` and `validateVerifiedEpisodeRecord()` in `src/utils/seo.ts`, strengthened `isEpisodeSeoIndexable()`, updated `getVerifiedEpisodeInventory()` (`scripts/routeInventory.ts`), hardened `fetchServerEpisode()` (`scripts/seoHtmlPlugin.ts`), and passed complete episode/season validation fields from `src/pages/WatchPage.tsx`. |
| 5 | **Parent Rating Leakage into `TVEpisode` JSON-LD** | Episode structured data could inherit parent `TVSeries` `voteAverage` and `voteCount` (or fall back when episode-level ratings did not exist), attributing series-wide ratings to individual episodes. | Separated `TVEpisode` schema generation in `src/utils/seo.ts` so `aggregateRating` is omitted unless genuine episode-specific rating/voteCount fields exist, while preserving accurate `partOfSeason`, `partOfSeries`, `episodeNumber`, `datePublished`, and canonical URL. |
| 6 | **Route Inventory Drift & Inflated Report Counts** | `prerender.ts`, `generate-sitemaps.ts`, and audit docs used separate route lists, counting `noindex` / utility / error pages alongside indexable pages. | Created `scripts/routeInventory.ts` as the single shared inventory. Updated `scripts/prerender.ts` to validate every artifact on disk and record `indexableSucceeded` (127) separately from `noindexSucceeded` (15) in `dist/prerender-report.json`. |
| 7 | **SSR vs CSR Tie-Break & Partial Failure Divergence** | `normalizeServerTmdbListItem()` in `scripts/seoHtmlPlugin.ts` kept unrounded `vote_average` floats while client `normalizeTMDBItem()` rounded to `toFixed(1)`. Platform parallel `Promise.all` fetches in `src/services/tmdb.ts` could mask transient 429/5xx errors on one media type. | Rounded `voteAverage` to 1 decimal place in `normalizeServerTmdbListItem()`. Updated `fetchCatalog('platform', ...)` in `src/services/tmdb.ts` to rethrow transient `429`/`5xx`/`503` when `requestOpts.throwOnError` is enabled. |
| 8 | **CI Failing Node `<24.12.0` Test, Env Loading & Retry Safety** | `deploy.test.ts` used `node -e '...' -- "$@"` to simulate legacy Node `< 24.12.0`, failing argument forwarding on GitHub Actions `ubuntu-latest`; `run-build.mjs` needed deterministic `.env` loading and internal artifact checks; UI retry locks blocked retries. | Fixed `src/services/__tests__/deploy.test.ts` with dedicated `legacy-node22-preload.cjs` + `exec "${process.execPath}" --require "${legacyPreloadPath}" "$@"` running deterministically on both Node 22 and Node 24; added `scripts/loadEnv.mjs` + `verifyNoInternalArtifacts()` & secret-leak scan in `scripts/run-build.mjs`; deleted internal prompt/video/screenshot files from `public/assets/aistudio/`; replaced retry locks with `src/utils/retryState.ts`. |
| 9 | **Outdated Documentation & Node Version Discrepancy** | Previous reports referenced legacy counts and omitted deterministic preload simulation details. | Aligned documentation (`TSTREAM_SEO_AUDIT_REPORT.md`, `TSTREAM_SEO_TEST_RESULTS.md`) with verified codebase outputs while transparently noting sandbox container limitations. |

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
| `/genre/:slug` (populated genre) | `200` | `index, follow` | `https://tstream.online/genre/:slug` | `sitemap-main.xml` (`14` offline / live varies) |
| `/genre/:slug` (valid but 0 offline/TMDB matches, e.g. `/genre/western`, offline `/genre/horror`) | `200` | `noindex, follow` | `https://tstream.online/genre/:slug` | No |
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
  - **`sitemap-main.xml`:** **51** valid URLs (`7` hubs incl. `/`, `12` canonical kebab-case tags, `14` offline-populated genres, `4` populated platforms, `13` populated A-Z letters + `1` `/` root = 51)
  - **`sitemap-movies.xml`:** **29** valid authoritative `/movie/:slug` URLs (including verified `/movie/spider-man-homecoming-315635`; zero `/watch/movie/`; zero corrupted `-28` Homecoming)
  - **`sitemap-tv.xml`:** **7** valid `/tv/:slug` series URLs
  - **`sitemap-episodes.xml`:** **11** verified content-rich TV episode URLs (`Breaking Bad` S1E1–E4, S2E1, S3E1, S4E1, S5E1; `The Last of Us` S1E1–E2; `Shogun` S1E1)
- **Total Sitemap URLs (Offline Build):** **98** valid, canonical, indexable HTTPS non-www URLs.

### Static Prerendered Artifacts (`dist/prerender-report.json`)
- **Attempted routes:** **142**
- **Succeeded total:** **142** (**0** failed)
  - **Indexable HTML (`index, follow`):** **127** (root, 6 indexable hubs, 12 tags, 14 populated genres, 4 populated platforms, 13 populated A-Z letters, 29 movie detail + 29 movie watch pages, 7 TV series, 11 verified episodes)
  - **Non-indexable / Utility / Error HTML:** **15** (`dist/404.html`, `/new-episodes`, `/people`, `/random`, 7 offline-empty genres incl. `/genre/horror`, 5 offline-empty platforms)

---

## 5. Server 5xx Resilience, Environment & Deployment Hardening

- **Server Error Handling (`server.ts`, `src/server/app.ts`, `scripts/seoHtmlPlugin.ts`):**
  - Unknown `/api/*` routes return JSON `404`, never SPA `200` HTML.
  - Missing static assets return HTTP `404`, never SPA `200` HTML.
  - SSR TMDB proxy calls deduplicate in-flight requests, cache positive responses with bounded LRU memory limits, fall back to stale cache when safe, and return explicit HTTP `503` (not silent `200` or unhandled `500`) on unrecoverable upstream TMDB `429`/5xx/timeouts.
  - Per-client sliding-window rate limiting enforces `429` + `Retry-After` even on cached endpoints and ignores spoofed `X-Forwarded-For` unless `TRUST_PROXY=true`.
- **Build Environment Loading & Asset Hygiene (`scripts/loadEnv.mjs`, `scripts/run-build.mjs`):**
  - Loads `.env` / shared release `.env` via `dotenv` without overwriting pre-existing CI environment variables, runs `verifyNoInternalArtifacts()` on `public/` pre-build and `dist/` post-build (ensuring zero internal prompt/video/screenshot artifacts ship while preserving `tstream-logo-yellow-transparent_1__d41aea4b.png`), and scans `dist/` (`assets/`, HTML, JSON reports, sitemaps) to ensure secrets (`TMDB_API_KEY`, `VITE_TMDB_API_KEY`) never leak into client artifacts.
- **Nginx (`nginx.conf.example`):**
  - Enforces HTTP -> HTTPS and `www.tstream.online` -> `tstream.online` 301 canonical redirects.
  - Sets `proxy_intercept_errors off` so upstream Node `404` and `503` status codes are never masked as `200`.
  - Routes query-string requests (`$is_args = "?"`) through `@seo_runtime` for dynamic pagination/filter `noindex`, serves query-less prerendered files cleanly via `try_files $uri $uri/index.html @seo_runtime`, and disables proxy buffering on `/api/(stream-proxy|stream-resolve|proxy|stream/|subtitle-proxy)` with `Range`/`If-Range` forwarding.

---

## 6. Environment Caveats, Limitations & Required VPS Checks

### Sandbox Environment Notes (Transparent Audit Disclosure)
1. **Node.js Version:** Project configuration (`.nvmrc`, `package.json`, `.github/workflows/deploy-tstream.yml`, `scripts/update-vps.sh`) consistently enforces **Node.js `>=24.12.0`**. This build container runs **Node.js `v22.23.2`**. In `src/services/__tests__/deploy.test.ts`, both an explicit `< 24.12.0` rejection test (`legacy-node22-preload.cjs` simulating `22.23.2` via `--require`) against the unmodified `scripts/update-vps.sh` gate AND a `node-24` (`24.12.0`) preload wrapper execute deterministically regardless of host Node runtime without weakening production Node `>=24.12.0` checks. Actual execution on the GitHub Actions `ubuntu-latest` Node `24.12.0` runner must be confirmed after pushing to GitHub.
2. **Git History & Lockfile:** This AI Studio workspace does not contain a `.git` directory or `package-lock.json`. Therefore, `npm ci`, `git diff`, branch creation, and commit pushing could not be executed inside this sandbox and must be performed in the checked-out Git repository containing `package-lock.json`.
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
