# TStream.online — SEO, Build & Production Server Test Verification Results

**Verification Date:** November 2026  
**Target Domain:** `https://tstream.online`  
**Configured Target Runtime:** Node.js `>=24.12.0` (`.nvmrc`, `package.json`, `.github/workflows/deploy-tstream.yml`, `scripts/update-vps.sh`)  
**Actual Execution Container Runtime:** Node.js `v22.23.2` (container limitation — see Section 6), TypeScript `7.0.2`, Vite `8.3.4`, React `19.3.1`  
**Commands Executed:** `npm test && npm run lint && npm run build` and `tsx scripts/verify-production.ts --base-url=http://127.0.0.1:3099` against `node dist/server.mjs`  
**Overall Status:** PASSED (`6/6` test suites — `179/179` assertions, `0` TypeScript errors, `142/142` prerendered HTML routes, `98` sitemap URLs, `104/104` live HTTP verification checks)

---

## 1. Execution Summary Table

| Verification Suite | Scope | Passed | Failed | Status |
|---|---|---:|---:|---|
| `src/services/__tests__/pagination.test.ts` | Pagination, clamping, media-type filters, subtitle language codes | 5 | 0 | **PASS** |
| `src/services/__tests__/seo.test.ts` | Canonicals, kebab tags, TMDB keyword spaces, cross-media `/genre/:slug`, zero `<lastmod>`, strict episode validation/bounds/noindex/ratings, `verifyNoInternalArtifacts`, dotenv/build parity, SSR/CSR parity | 107 | 0 | **PASS** |
| `src/services/__tests__/subtitles.test.ts` | VTT/SRT cue parsing, BOM, Windows-1250 Ex-Yu encoding, ISO-639 normalization | 6 | 0 | **PASS** |
| `src/services/__tests__/server.test.ts` | Zero `VITE_TMDB_API_KEY` exposure, TMDB proxy allowlist/coalescing/cache, SSRF/CORS blocks, sliding rate limiter, 8-provider fastest-first orchestrator, VidRock AES-GCM, `validateSourceUrl` | 44 | 0 | **PASS** |
| `src/services/__tests__/retries.test.ts` | Season & platform failure recovery, concurrent request coalescing, rapid tab switching, unmount safety | 10 | 0 | **PASS** |
| `src/services/__tests__/deploy.test.ts` | `ecosystem.config.cjs`, deterministic Node `<24.12.0` (`22.23.2` preload) gate rejection, PM2 ownership guard, atomic symlink switch, `commitSha` & SEO auto-rollback | 7 | 0 | **PASS** |
| **Static Type Check (`npm run lint`)** | `tsc --noEmit` across client, server, scripts, and tests | 0 errors | 0 | **PASS** |
| **Production Build (`npm run build`)** | Sitemaps + Vite PWA bundle + `prerender.ts` + `dist/server.mjs` + internal artifact & secret leak scans | 142 HTML + 4 XML | 0 | **PASS** |
| **Live Production Server HTTP Verification** | `node dist/server.mjs` (port `3099`) tested by `scripts/verify-production.ts` (including 98-URL sitemap crawl) | 104 | 0 | **PASS** |

---

## 2. Suite Breakdown & Key Verified Behaviors

### Suite 1: Pagination & Routing Integration (`pagination.test.ts` — 5/5 PASS)
- Page 1 and Page 2 return distinct offset records (`offset`).
- Negative page numbers clamp to `1`; out-of-range page numbers clamp cleanly to `totalPages`.
- `mediaType` filter preserves state across pages; subtitle codes normalize cleanly (`sr`, `hr`, `bs`, `en`).

### Suite 2: Technical SEO, Tags, Genres, Sitemaps, Artifacts & Episodes (`seo.test.ts` — 107/107 PASS)
- **Kebab-Case Tag Parity (`12/12` `POPULAR_TAGS`):** Every entry (`witch`, `magic`, `time travel`, `based on novel or book`, `friendship`, `school friend`, `sequel`, `space`, `revenge`, `superhero`, `based on comic book`, `coming of age`) resolves identically across `tagToSlug`, `slugToTag`, React router (`parseAppLocation`), SSR (`renderSeoHtml`), `dist/tags/<slug>/index.html`, and `sitemap-main.xml`.
- **Multiword TMDB Keyword Search:** `/tags/time-travel` -> `"time travel"`, `/tags/based-on-novel-or-book` -> `"based on novel or book"`, `/tags/coming-of-age` -> `"coming of age"`, `/tags/school-friend` -> `"school friend"`, `/tags/based-on-comic-book` -> `"based on comic book"`.
- **Legacy Tag Handling:** `/tag/*` and `%20`-encoded URLs return `200 + noindex, follow` pointing canonical to the kebab-case URL.
- **Cross-Media Genre Landing Pages (`src/utils/genres.ts`, `src/services/tmdb.ts`):**
  - `/genre/action` renders `200`, `CollectionPage` JSON-LD, matching movie/TV cards; `/genre/sci-fi` emits `noindex` canonicalizing to `/genre/science-fiction`; unpopulated offline `/genre/western` and `/genre/horror` emit `200 + noindex` with zero fabricated Mystery (`9648`) or TV cards; `/genre/nonexistent-genre` returns HTTP `404 + noindex`; `/genre/action?page=999` emits `noindex` canonicalizing to `/genre/action`.
  - Live TMDB `/genre/horror` queries `/discover/movie?with_genres=27` only (no `/discover/tv`) and excludes Mystery (`9648`) titles; offline `/genre/action-adventure` returns TV series only without leaking Action (`28`) movies; `fetchCatalog('movies', 1, { mediaType: 'movie', genreId: 10759 })` returns empty rather than cross-matching TV-only genre onto movies.
- **Zero Fake `<lastmod>`:** Generated `sitemap-main.xml`, `sitemap-movies.xml`, `sitemap-tv.xml`, `sitemap-episodes.xml`, and `sitemap.xml` omit `<lastmod>`; `validateSitemapXml()` throws explicitly if unverified `<lastmod>` tags are injected.
- **Spider-Man Homecoming Integrity:** Authoritative ID `315635` preserved; corrupted `spider-man-homecoming-28` rejected while preserving legitimate unrelated TMDB ID `28`. Zero `/watch/movie/` entries in sitemaps.
- **Strict Episode Bounds, Verification, Indexability & Rating Isolation:**
  - `isGenuineEpisodeName()`, `isEpisodeSeoIndexable()`, and `validateVerifiedEpisodeRecord()` reject missing titles, generic titles (`"Episode 1"`, `"Ep. 2"`, `"Season 1 Episode 1"`, `"TBD"`), empty overviews, overviews matching parent series or season overview, non-positive episode IDs, mismatched parent `showId`/`seasonNumber`, and out-of-bounds season/episode numbers.
  - Genuine verified live TMDB episodes with positive ID, unique synopsis, and episode ratings render indexable `TVEpisode` with `aggregateRating` from episode votes only.
  - TMDB `429`/`5xx` (`502`, `503`) upstream failures propagate as HTTP `503`; verified episode inventory (`11`) matches `sitemap-episodes.xml` URL count (`11`) with zero generic-title/unverified episodes (`S1E6`) leaked.
- **Public Artifact Safety:** `verifyNoInternalArtifacts()` passes on `public/` and preserves `public/assets/aistudio/tstream-logo-yellow-transparent_1__d41aea4b.png`, while failing builds in an isolated sandbox containing `Paste_*` prompt artifacts.
- **SSR / CSR Parity & Build Security:** Server `normalizeServerTmdbListItem` rounds `voteAverage` to 1 decimal (`toFixed(1)`) matching browser `normalizeTMDBItem` (`balanced top-rated` parity). `loadBuildEnv()` loads `.env` prior to build/prerender while preserving CI env vars and preventing `TMDB_API_KEY` leakage into `dist/`.

### Suite 3: Subtitle Parsing & Encoding (`subtitles.test.ts` — 6/6 PASS)
- WebVTT cue settings/multiline, SRT HTML tag stripping, compact OpenSubtitles cue spacing, UTF-8 BOM, Windows-1250 diacritics (`čćšžđ`), and 3-letter OpenSubtitles code normalization (`srp->sr`, `hrv->hr`, `bos->bs`, `eng->en`).

### Suite 4: Server Security, Proxy, Rate Limiter & Streaming Orchestrator (`server.test.ts` — 44/44 PASS)
- Browser `getTmdbApiKey()` always returns empty string; zero `VITE_TMDB_API_KEY` references in source or CI env.
- `/api/tmdb/*` proxy enforces endpoint allowlist, strips client `api_key`, returns `503` + `Cache-Control: no-store` if unconfigured, coalesces concurrent requests, handles `HEAD`, rejects `POST` (`405`).
- `/api/stream`, `/api/proxy`, `/api/subtitle-proxy`, and legacy routes enforce numeric ID / URL validation (`400`), method restrictions (`405`), and SSRF blocking (`127.0.0.1`, `169.254.169.254`, RFC1918 private LAN -> `403`).
- Sliding-window rate limiter enforces `429` + `Retry-After` even on cache hits and ignores spoofed `X-Forwarded-For` when `TRUST_PROXY` is false; CORS rejects untrusted origins with `403`.
- All 8 streaming providers (`Vector/vidapi`, `Eclipse/eclipse`, `BoxMovie/boxmovie`, `Core/vidrock`, `Orion/vidrift`, `Pulse/vidlink`, `Valence/lmscript`, `Apex/meowtv`) verified in lowest-RTT order, with dynamic fastest-first sorting, rolling latency promotion, `?provider=` preference override, VidRock AES-GCM decryption, and SSRF-safe `validateSourceUrl`.

### Suite 5: Retry, Concurrency & Component Unmount Safety (`retries.test.ts` — 10/10 PASS)
- Season/platform transient `500`/`429` failures clear permanently stuck ref locks (`src/utils/retryState.ts`), support clean manual retry, coalesce concurrent fetches, discard stale responses after rapid tab/season switching, and guard unmounted components.

### Suite 6: Deployment Safety & Rollback (`deploy.test.ts` — 7/7 PASS)
- `ecosystem.config.cjs` requires explicit `APP_DIR` & `PM2_APP_NAME` and targets `<APP_DIR>/current/dist/server.mjs`.
- `scripts/update-vps.sh` deterministically rejects simulated Node `< 24.12.0` (`legacy-node22-preload.cjs` setting `process.versions.node = "22.23.2"` via `--require` wrapper regardless of whether CI/host uses Node 22 or 24), exits non-zero with `"Required >= 24.12.0"`, stops in preflight before `[2/9]`, leaves `pm2-actions.log` empty, leaves `pm2-state.json` and release/current symlinks untouched, and leaves repo `HEAD` unchanged. Subsequent tests verify PM2 ownership guard, atomic symlink switch + health `commitSha` + post-SEO `pm2 save`, and automatic rollback on commitSha mismatch or failed SEO verification via a `node-24` preload wrapper.

---

## 3. Production Build & Static Prerender Output (`npm run build`)

- **XML Sitemaps (`public/` & `dist/`):**
  - `sitemap-main.xml`: **51** valid URLs
  - `sitemap-movies.xml`: **29** valid movie URLs
  - `sitemap-tv.xml`: **7** valid TV series URLs
  - `sitemap-episodes.xml`: **11** verified episode URLs
  - **Total Sitemap URLs:** **98** (zero `<lastmod>`, zero duplicates, zero `/watch/movie/`, zero corrupt IDs)
- **Vite Client Bundle (`dist/`):**
  - `dist/index.html` (prerendered root `12.87 kB` after Step 3), `dist/assets/index-BqEKF9pp.css` (`143.67 kB`), `dist/assets/index-C4yxEme6.js` (`2,676.30 kB`), `dist/manifest.webmanifest`, `dist/sw.js` (PWA precache: `27` entries).
  - `public/assets/aistudio/` & `dist/assets/aistudio/` contain **only** `tstream-logo-yellow-transparent_1__d41aea4b.png` (`21,988` bytes); zero internal `Paste_*`, `AwesomeScreenshot-*`, or `Spider-Man_Streaming_Watch_Page_*` files remain.
- **Prerender Report (`dist/prerender-report.json`):**
  - **Attempted routes:** **142**
  - **Succeeded total:** **142** (`0` failed)
    - **Indexable HTML (`200`, `index, follow`):** **127** (Homepage, `6` indexable hubs, `12` kebab tags, `14` offline-populated genres, `4` populated platforms, `13` populated A-Z letters, `29` movie details, `29` movie watch routes canonicalizing to `/movie/:slug`, `7` TV series, `11` verified TV episodes)
    - **Non-indexable / Utility / Error HTML:** **15** (`dist/404.html`, `/new-episodes`, `/people`, `/random`, `7` offline-empty genres incl. `/genre/horror`, `5` offline-empty platforms)
- **Server Bundle:** `dist/server.mjs` (`285.0 kb`), verified zero secret leaks and zero internal artifacts across `public/` & `dist/`.

---

## 4. Live Local Production Server Verification (`verify-production.ts`)

Executed against `PORT=3099 HOST=127.0.0.1 NODE_ENV=production node dist/server.mjs`:
- **Result:** **104/104 checks passed** (`exit code 0`).
- **API & Security:** `/api/health` (`200`), invalid `/api/stream*` & `/api/proxy` & `/api/tmdb` (`400`), SSRF `127.0.0.1` (`403`), untrusted CORS (`403`), unknown `/api/nonexistent-endpoint` (`404`).
- **Robots & Sitemaps:** `/robots.txt` (`200`), `/sitemap.xml` (`4` children), all `4` child XML sitemaps valid with zero `<lastmod>`.
- **Indexable Routes & Googlebot/Browser Parity:** `/`, `/movies`, `/movies?page=2`, `/tv-shows`, `/trending`, `/top-rated` (balanced Movie + TV links), `/collections` (`4` franchise cards, `13` movie links), `/tags`, all verified multiword & core tags (`/tags/revenge`, `/tags/friendship`, `/tags/magic`, `/tags/time-travel`, `/tags/based-on-novel-or-book`, `/tags/coming-of-age`, `/tags/school-friend`, `/tags/based-on-comic-book`), genres (`/genre/action`, `/genre/comedy`, `/genre/drama`, `/genre/mystery`, `/genre/science-fiction`, `/genre/thriller`, `/genre/action-adventure` TV-only, `/genre/sci-fi-fantasy`), platforms (`/platform/netflix` US region scoped, `/platform/max`), `/az/S`, `/movie/spider-man-homecoming-315635`, `/watch/movie/spider-man-homecoming-315635`, `/tv/breaking-bad-1396`, `/watch/tv/breaking-bad-1396/1/1` (`TVEpisode` schema with zero parent `aggregateRating` leakage).
- **Disk Parity (`dist/`):** Verified `tags/*/index.html`, `genre/*/index.html`, `collections/index.html` match HTTP canonicals.
- **Query Policy, Aliases & Parity (`200 + noindex`):** Filtered `/movies?...`, out-of-range `?page=0` / `?page=9999`, `/tag/revenge`, `/tags/time%20travel`, `/genre/sci-fi`, `/platform/hbo`, `/search?q=batman`, `/random`, `/az/Q`, `/platform/crunchyroll` (excluded + noindex), `/genre/western` (excluded + noindex), `/genre/horror` (excluded + noindex offline with `0` Mystery `9648` cards).
- **Genuine `404` Checks (`10/10`):** Nonexistent movie/TV IDs, invalid tag/genre/platform slugs, out-of-bounds TV seasons/episodes (`99/99`, `2/99`, `1/999`), nonexistent path, missing `/assets/*.js` chunk.
- **Bounded-Concurrency Sitemap Crawl:** Checked all **98** sitemap URLs with concurrency `4` -> `checked=98, 5xx=0, failures=0`.

---

## 5. Known Environment Limitations & Pending Production Verification

1. **Container Node Version:** Container runs **Node.js `v22.23.2`**. Target production runtime **Node.js `>=24.12.0`** remains strictly enforced across `.nvmrc`, `package.json`, CI, and `scripts/update-vps.sh`. While `deploy.test.ts` uses `--require` preloads (`legacy-node22-preload.cjs` simulating `22.23.2` and `node-24` preload simulating `24.12.0`), actual execution on the GitHub Actions `ubuntu-latest` Node `24.12.0` runner must be confirmed after pushing to GitHub.
2. **Workspace Git & Lockfile State:** `.git/` and `package-lock.json` are absent in this sandbox directory; `npm ci` lockfile installation and clean git branching/PR review could not run inside this sandbox and must run in the full cloned Git repository.
3. **Live VPS Checks Excluded by Safety Policy:** No live deployment, PM2 restart, or Nginx edit was performed. Historical VPS `5xx` resolution and external HTTP->HTTPS / `www` -> non-`www` 301 redirects must be verified against `https://tstream.online` after authorized deployment.
