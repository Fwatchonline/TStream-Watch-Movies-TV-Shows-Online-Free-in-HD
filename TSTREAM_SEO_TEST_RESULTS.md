# TStream.online — SEO, Build & Production Server Test Verification Results

**Verification Date:** November 2026  
**Target Domain:** `https://tstream.online`  
**Configured Target Runtime:** Node.js `>=24.12.0` (`.nvmrc`, `package.json`, `.github/workflows/deploy-tstream.yml`, `scripts/update-vps.sh`)  
**Actual Execution Container Runtime:** Node.js `v22.23.2` (container limitation — see Section 6), TypeScript `7.0.2`, Vite `8.3.4`, React `19.3.1`  
**Commands Executed:** `npm test && npm run lint && npm run build` and `tsx scripts/verify-production.ts --base-url=http://127.0.0.1:3099` against `node dist/server.mjs`  
**Overall Status:** PASSED (`6/6` test suites — `150/150` assertions, `0` TypeScript errors, `142/142` prerendered HTML routes, `99` sitemap URLs, `95/95` live HTTP verification checks)

---

## 1. Execution Summary Table

| Verification Suite | Scope | Passed | Failed | Status |
|---|---|---:|---:|---|
| `src/services/__tests__/pagination.test.ts` | Pagination, clamping, media-type filters, subtitle language codes | 5 | 0 | **PASS** |
| `src/services/__tests__/seo.test.ts` | Canonicals, kebab tags, TMDB keyword spaces, `/genre/:slug`, zero `<lastmod>`, episode bounds/noindex/ratings, dotenv/build parity, SSR/CSR parity | 85 | 0 | **PASS** |
| `src/services/__tests__/subtitles.test.ts` | VTT/SRT cue parsing, BOM, Windows-1250 Ex-Yu encoding, ISO-639 normalization | 6 | 0 | **PASS** |
| `src/services/__tests__/server.test.ts` | Zero `VITE_TMDB_API_KEY` exposure, TMDB proxy allowlist/coalescing/cache, SSRF/CORS blocks, sliding rate limiter, 400/403/404/405/503 | 37 | 0 | **PASS** |
| `src/services/__tests__/retries.test.ts` | Season & platform failure recovery, concurrent request coalescing, rapid tab switching, unmount safety | 10 | 0 | **PASS** |
| `src/services/__tests__/deploy.test.ts` | `ecosystem.config.cjs`, Node `<24.12.0` gate rejection, PM2 ownership guard, atomic symlink switch, `commitSha` & SEO auto-rollback | 7 | 0 | **PASS** |
| **Static Type Check (`npm run lint`)** | `tsc --noEmit` across client, server, scripts, and tests | 0 errors | 0 | **PASS** |
| **Production Build (`npm run build`)** | Sitemaps + Vite PWA bundle + `prerender.ts` + `dist/server.mjs` + secret leak scan | 142 HTML + 4 XML | 0 | **PASS** |
| **Live Production Server HTTP Verification** | `node dist/server.mjs` (port `3099`) tested by `scripts/verify-production.ts` (including 99-URL sitemap crawl) | 95 | 0 | **PASS** |

---

## 2. Suite Breakdown & Key Verified Behaviors

### Suite 1: Pagination & Routing Integration (`pagination.test.ts` — 5/5 PASS)
- Page 1 and Page 2 return distinct offset records (`offset`).
- Negative page numbers clamp to `1`; out-of-range page numbers clamp cleanly to `totalPages`.
- `mediaType` filter preserves state across pages; subtitle codes normalize cleanly (`sr`, `hr`, `bs`, `en`).

### Suite 2: Technical SEO, Tags, Genres, Sitemaps & Episodes (`seo.test.ts` — 85/85 PASS)
- **Kebab-Case Tag Parity (`12/12` `POPULAR_TAGS`):** Every entry (`witch`, `magic`, `time travel`, `based on novel or book`, `friendship`, `school friend`, `sequel`, `space`, `revenge`, `superhero`, `based on comic book`, `coming of age`) resolves identically across `tagToSlug`, `slugToTag`, React router (`parseAppLocation`), SSR (`renderSeoHtml`), `dist/tags/<slug>/index.html`, and `sitemap-main.xml`.
- **Multiword TMDB Keyword Search:** `/tags/time-travel` -> `"time travel"`, `/tags/based-on-novel-or-book` -> `"based on novel or book"`, `/tags/coming-of-age` -> `"coming of age"`, `/tags/school-friend` -> `"school friend"`, `/tags/based-on-comic-book` -> `"based on comic book"`.
- **Legacy Tag Handling:** `/tag/*` and `%20`-encoded URLs return `200 + noindex, follow` pointing canonical to the kebab-case URL.
- **Genre Landing Pages:** `/genre/action` renders `200`, `CollectionPage` JSON-LD, matching movie/TV cards; `/genre/sci-fi` emits `noindex` pointing canonical to `/genre/science-fiction`; unpopulated offline `/genre/western` emits `200 + noindex` without fabricating titles; `/genre/nonexistent-genre` returns genuine HTTP `404 + noindex`; out-of-range `/genre/action?page=999` emits `noindex` canonicalizing to `/genre/action`.
- **Zero Fake `<lastmod>`:** Generated `sitemap-main.xml`, `sitemap-movies.xml`, `sitemap-tv.xml`, `sitemap-episodes.xml`, and `sitemap.xml` omit `<lastmod>`; `validateSitemapXml()` throws explicitly if unverified `<lastmod>` tags are injected.
- **Spider-Man Homecoming Integrity:** Authoritative ID `315635` preserved; corrupted `spider-man-homecoming-28` rejected while preserving legitimate unrelated TMDB ID `28`. Zero `/watch/movie/` entries in sitemaps.
- **Episode Bounds, Indexability & Rating Isolation:**
  - Episodes exceeding `episodeCount` return `null` -> HTTP `404` (never fabricated up to `<= 25`).
  - TMDB `429`/`5xx` upstream failures propagate as HTTP `503` (never masked as `200`).
  - Unverified/thin episodes within valid season bounds return `200 + noindex, follow` preserving player compatibility without copying the parent series overview or rating.
  - `TVEpisode` JSON-LD omits `aggregateRating` when no genuine episode rating exists (never inherits `TVSeries` rating).
  - Verified episode inventory (`11`) matches `sitemap-episodes.xml` URL count (`11`).
- **SSR / CSR Parity & Build Security:** Server `normalizeServerTmdbListItem` rounds `voteAverage` to 1 decimal (`toFixed(1)`) matching browser `normalizeTMDBItem` (`balanced top-rated` parity). `loadBuildEnv()` loads `.env` prior to build/prerender while preserving CI env vars and preventing `TMDB_API_KEY` leakage into `dist/`.

### Suite 3: Subtitle Parsing & Encoding (`subtitles.test.ts` — 6/6 PASS)
- WebVTT cue settings/multiline, SRT HTML tag stripping, compact OpenSubtitles cue spacing, UTF-8 BOM, Windows-1250 diacritics (`čćšžđ`), and 3-letter OpenSubtitles code normalization (`srp->sr`, `hrv->hr`, `bos->bs`, `eng->en`).

### Suite 4: Server Security, Proxy, Rate Limiter & CORS (`server.test.ts` — 37/37 PASS)
- Browser `getTmdbApiKey()` always returns empty string; zero `VITE_TMDB_API_KEY` references in source or CI env.
- `/api/tmdb/*` proxy enforces endpoint allowlist, strips client `api_key`, returns `503` + `Cache-Control: no-store` if unconfigured, coalesces concurrent requests, handles `HEAD`, rejects `POST` (`405`).
- `/api/stream`, `/api/proxy`, `/api/subtitle-proxy`, and legacy routes enforce numeric ID / URL validation (`400`), method restrictions (`405`), and SSRF blocking (`127.0.0.1`, `169.254.169.254`, RFC1918 private LAN -> `403`).
- Sliding-window rate limiter enforces `429` + `Retry-After` even on cache hits and ignores spoofed `X-Forwarded-For` when `TRUST_PROXY` is false; CORS rejects untrusted origins with `403`.

### Suite 5: Retry, Concurrency & Component Unmount Safety (`retries.test.ts` — 10/10 PASS)
- Season/platform transient `500`/`429` failures clear permanently stuck ref locks (`src/utils/retryState.ts`), support clean manual retry, coalesce concurrent fetches, discard stale responses after rapid tab/season switching, and guard unmounted components.

### Suite 6: Deployment Safety & Rollback (`deploy.test.ts` — 7/7 PASS)
- `ecosystem.config.cjs` requires explicit `APP_DIR` & `PM2_APP_NAME` and targets `<APP_DIR>/current/dist/server.mjs`.
- `scripts/update-vps.sh` explicitly rejects Node `< 24.12.0` (`asserts exit != 0` against container `v22.23.2`), refuses unrelated PM2 processes, runs atomic symlink switches + health `commitSha` checks + post-SEO `pm2 save`, and rolls back automatically on commitSha mismatch or failed SEO verification (covered in isolated sandbox via a preload `node-24` shim wrapping Node `<24.12.0` checks after verifying the strict `<24.12.0` gate).

---

## 3. Production Build & Static Prerender Output (`npm run build`)

- **XML Sitemaps (`public/` & `dist/`):**
  - `sitemap-main.xml`: **52** valid URLs
  - `sitemap-movies.xml`: **29** valid movie URLs
  - `sitemap-tv.xml`: **7** valid TV series URLs
  - `sitemap-episodes.xml`: **11** verified episode URLs
  - **Total Sitemap URLs:** **99** (zero `<lastmod>`, zero duplicates, zero `/watch/movie/`, zero corrupt IDs)
- **Vite Client Bundle (`dist/`):**
  - `dist/index.html` (prerendered root `12.87 kB` after Step 3), `dist/assets/index-OeUlhS1c.css` (`143.80 kB`), `dist/assets/index-BXivQMcN.js` (`2,674.39 kB`), `dist/manifest.webmanifest`, `dist/sw.js` (PWA precache: `64` entries).
- **Prerender Report (`dist/prerender-report.json`):**
  - **Attempted routes:** **142**
  - **Succeeded total:** **142** (`0` failed)
    - **Indexable HTML (`200`, `index, follow`):** **128** (Homepage, `6` indexable hubs, `12` kebab tags, `15` populated genres, `4` populated platforms, `13` populated A-Z letters, `29` movie details, `29` movie watch routes canonicalizing to `/movie/:slug`, `7` TV series, `11` verified TV episodes)
    - **Non-indexable / Utility / Error HTML:** **14** (`dist/404.html`, `/new-episodes`, `/people`, `/random`, `6` offline-empty genres, `5` offline-empty platforms)
- **Server Bundle:** `dist/server.mjs` (`264.7 kb`), verified zero secret leaks across `dist/assets/`, HTML files, reports, and sitemaps.

---

## 4. Live Local Production Server Verification (`verify-production.ts`)

Executed against `PORT=3099 HOST=127.0.0.1 NODE_ENV=production node dist/server.mjs`:
- **Result:** **95/95 checks passed** (`exit code 0`).
- **API & Security:** `/api/health` (`200`), invalid `/api/stream*` & `/api/proxy` & `/api/tmdb` (`400`), SSRF `127.0.0.1` (`403`), untrusted CORS (`403`), unknown `/api/nonexistent-endpoint` (`404`).
- **Robots & Sitemaps:** `/robots.txt` (`200`), `/sitemap.xml` (`4` children), all `4` child XML sitemaps valid with zero `<lastmod>`.
- **Indexable Routes & Googlebot/Browser Parity:** `/`, `/movies`, `/movies?page=2`, `/tv-shows`, `/trending`, `/top-rated` (balanced Movie + TV links), `/collections` (`4` franchise cards, `13` movie links), `/tags`, all verified multiword & core tags (`/tags/revenge`, `/tags/friendship`, `/tags/magic`, `/tags/time-travel`, `/tags/based-on-novel-or-book`, `/tags/coming-of-age`, `/tags/school-friend`, `/tags/based-on-comic-book`), genres (`/genre/action`, `/genre/comedy`, `/genre/drama`, `/genre/science-fiction`, `/genre/thriller`), platforms (`/platform/netflix` US region scoped, `/platform/max`), `/az/S`, `/movie/spider-man-homecoming-315635`, `/watch/movie/spider-man-homecoming-315635`, `/tv/breaking-bad-1396`, `/watch/tv/breaking-bad-1396/1/1` (`TVEpisode` schema with zero parent `aggregateRating` leakage).
- **Disk Parity (`dist/`):** Verified `tags/*/index.html`, `genre/*/index.html`, `collections/index.html` match HTTP canonicals.
- **Query Policy, Aliases & Parity (`200 + noindex`):** Filtered `/movies?...`, out-of-range `?page=0` / `?page=9999`, `/tag/revenge`, `/tags/time%20travel`, `/genre/sci-fi`, `/platform/hbo`, `/search?q=batman`, `/random`, `/az/Q`, `/platform/crunchyroll` (excluded + noindex), `/genre/western` (excluded + noindex).
- **Genuine `404` Checks (`10/10`):** Nonexistent movie/TV IDs, invalid tag/genre/platform slugs, out-of-bounds TV seasons/episodes (`99/99`, `2/99`, `1/999`), nonexistent path, missing `/assets/*.js` chunk.
- **Bounded-Concurrency Sitemap Crawl:** Checked all **99** sitemap URLs with concurrency `4` -> `checked=99, 5xx=0, failures=0`.

---

## 5. Known Environment Limitations & Pending Production Verification

1. **Container Node Version:** Container runs **Node.js `v22.23.2`**. Target production runtime **Node.js `>=24.12.0`** remains strictly enforced across `.nvmrc`, `package.json`, CI, and `scripts/update-vps.sh`. Confirm CI and VPS run on Node `>=24.12.0` prior to deploying.
2. **Workspace Git & Lockfile State:** `.git/` and `package-lock.json` are absent in this sandbox directory; `npm ci` lockfile installation and clean git branching/PR review must run in the full cloned Git repository.
3. **Live VPS Checks Excluded by Safety Policy:** No live deployment, PM2 restart, or Nginx edit was performed. Historical VPS `5xx` resolution and external HTTP->HTTPS / `www` -> non-`www` 301 redirects must be verified against `https://tstream.online` after authorized deployment.
