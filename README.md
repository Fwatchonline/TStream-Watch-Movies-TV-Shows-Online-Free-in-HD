# TStream — Watch Movies & TV Shows Online in HD & 4K

[![Production](https://img.shields.io/badge/PRODUCTION-tstream.online-F5C400?style=for-the-badge&logo=google-chrome&logoColor=black)](https://tstream.online)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-24.12%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A production React 19, TypeScript, Vite, and Node.js/Hono streaming discovery & playback web application featuring server-side SEO rendering, pre-rendered HTML routes, XML sitemaps, multi-server HLS + web embed playback, multilingual subtitles, Firebase user accounts, and an Admin Console.

- **Canonical Production Origin:** `https://tstream.online`
- **Supported Runtime:** **Node.js `>= 24.12.0` (24 LTS)**

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Target VPS Directory Layout](#2-target-vps-directory-layout)
3. [Environment Variables & Secret Hygiene](#3-environment-variables--secret-hygiene)
4. [PM2 Process Management (`ecosystem.config.cjs`)](#4-pm2-process-management-ecosystemconfigcjs)
5. [Atomic Release Switching, Health `commitSha` & Rollback](#5-atomic-release-switching-health-commitsha--rollback)
6. [Migrating a Legacy PM2 Process Safely](#6-migrating-a-legacy-pm2-process-safely)
7. [Nginx Reverse Proxy & TLS Setup](#7-nginx-reverse-proxy--tls-setup)
8. [GitHub Actions CI & Approval-Gated Deploy](#8-github-actions-ci--approval-gated-deploy)
9. [TMDB Proxy Security, Rate Limits & CORS](#9-tmdb-proxy-security-rate-limits--cors)
10. [Platform Regions & Top-Rated Discovery](#10-platform-regions--top-rated-discovery)
11. [Local Development & Verification Commands](#11-local-development--verification-commands)

---

## 1. Architecture Overview

- **Frontend:** React 19 SPA built with Vite + Tailwind CSS 4 into `dist/assets/`.
- **Production Runtime (`dist/server.mjs`):** Node.js HTTP server (`server.ts`) combining Hono API routes (`/api/tmdb/*`, `/api/stream/*`, `/api/proxy`, `/api/subtitle-proxy`), legacy stream handlers (`/api/stream-resolve`, `/api/stream-proxy`), pre-rendered static HTML delivery, and runtime SSR SEO rendering (`scripts/seoHtmlPlugin.ts`).
- **Build & Prerender Pipeline (`scripts/run-build.mjs`):**
  1. Loads `.env` safely via `scripts/loadEnv.mjs` (`dotenv` with `override: false`, preserving CI environment variables).
  2. Generates XML sitemaps (`scripts/generate-sitemaps.ts`).
  3. Builds Vite frontend bundle into `dist/`.
  4. Prerenders and validates indexable HTML routes (`scripts/prerender.ts`) into `dist/` and writes `dist/prerender-report.json`.
  5. Compiles `server.ts` into `dist/server.mjs` and scans built JS/CSS/HTML/sitemaps/reports to ensure zero `TMDB_API_KEY` secret leakage.

---

## 2. Target VPS Directory Layout

Production deployments must use isolated timestamped releases under an explicit `<APP_DIR>` (never guessed and never overwritten in-place):

```text
<APP_DIR>/
├── repo/                  # Clean Git mirror (origin/main)
├── shared/
│   └── .env               # Authoritative production environment file (0600, never committed)
├── releases/
│   ├── 20261110-120000/   # Previous built release (preserved as rollback target)
│   └── 20261112-190000/   # New built release (contains dist/, node_modules/, .env -> shared/.env)
├── current -> <APP_DIR>/releases/20261112-190000
└── backups/               # Manual pre-migration snapshots
```

### Initial VPS Setup (Clean Directory Layout)

1. Install **Node.js `>= 24.12.0`**, **git**, **nginx**, **curl**, and **pm2**:
   ```bash
   node -v   # Must be >= v24.12.0
   npm install -g pm2
   ```
2. Create the directory structure and clone the repository into `<APP_DIR>/repo`:
   ```bash
   export APP_DIR=/opt/tstream   # Example: use your verified server path
   mkdir -p "$APP_DIR"/{releases,shared,backups}
   git clone https://github.com/Fwatchonline/TStream-Watch-Movies-TV-Shows-Online-Free-in-HD.git "$APP_DIR/repo"
   ```
3. Create `$APP_DIR/shared/.env` (`chmod 600 "$APP_DIR/shared/.env"`) from `.env.example`.

---

## 3. Environment Variables & Secret Hygiene

Copy `.env.example` to `<APP_DIR>/shared/.env`:

```dotenv
TMDB_API_KEY=your_tmdb_api_key_here
PORT=3000
HOST=0.0.0.0
APP_URL=https://tstream.online
DEFAULT_WATCH_REGION=US
TMDB_RATE_LIMIT_MAX=120
TMDB_RATE_LIMIT_WINDOW_MS=60000
TRUST_PROXY=true
CORS_ALLOWED_ORIGINS=https://tstream.online
```

- **Build-Time & Runtime Loading:** Both `scripts/run-build.mjs`, `scripts/prerender.ts`, `scripts/generate-sitemaps.ts`, and `server.ts` load `.env` via `dotenv` with `override: false`. Pre-existing CI/shell variables (such as GitHub Secrets) take precedence over `.env` without clobbering.
- **Zero Client Exposure:** `TMDB_API_KEY` is strictly server-side (`process.env.TMDB_API_KEY`). `VITE_TMDB_API_KEY` must never be set or referenced; frontend builds validate that `TMDB_API_KEY` never appears in `dist/assets/`, HTML files, sitemaps, or `dist/prerender-report.json`.

---

## 4. PM2 Process Management (`ecosystem.config.cjs`)

PM2 is controlled explicitly by `/ecosystem.config.cjs`, which rejects missing configuration rather than guessing paths:

- Required environment variables:
  - `APP_DIR` (or `TSTREAM_APP_DIR`)
  - `PM2_APP_NAME` (or `TSTREAM_PM2_APP_NAME`)
- Entrypoint & Working Directory:
  - `script`: `<APP_DIR>/current/dist/server.mjs`
  - `cwd`: `<APP_DIR>/current`
  - `APP_COMMIT_SHA`: read from `APP_COMMIT_SHA` env or `<APP_DIR>/current/.release-commit`

---

## 5. Atomic Release Switching, Health `commitSha` & Rollback

`scripts/update-vps.sh` performs zero-guesswork atomic releases:

1. **Pre-Flight Checks:** Verifies `APP_DIR`, `PM2_APP_NAME`, Node `>= 24.12.0`, `<APP_DIR>/repo/.git`, `<APP_DIR>/shared/.env` (with `TMDB_API_KEY=`), and >= 1 GB free disk space.
2. **PM2 Ownership Verification:** If `$PM2_APP_NAME` exists, confirms both `pm_cwd` and `pm_exec_path` resolve cleanly inside verified `<APP_DIR>` / `<APP_DIR>/current` / non-empty previous release paths. Refuses to alter unrelated processes.
3. **Isolated Release Build:** Extracts target commit into `<APP_DIR>/releases/<timestamp>`, writes `.release-commit`, symlinks `.env -> <APP_DIR>/shared/.env`, and runs `npm ci`, `npm test`, `npm run lint`, and `npm run build` (`APP_COMMIT_SHA="$COMMIT_SHA"`).
4. **Atomic Symlink Switch:** Updates `<APP_DIR>/current` via `ln -sfn` + `mv -Tf`.
5. **PM2 Switch:** Starts or reloads `$PM2_APP_NAME` using `<APP_DIR>/current/ecosystem.config.cjs --update-env`.
6. **Strict Verification Gate (BEFORE `pm2 save`):**
   - Verifies `readlink -f <APP_DIR>/current` matches the new release directory.
   - Verifies PM2 status is `online` and `pm_exec_path` points to the active release `dist/server.mjs`.
   - Polls `GET /api/health` and requires `status === "ok"` AND `commitSha === "<TARGET_COMMIT_SHA>"`.
   - Executes `npx --no-install tsx scripts/verify-production.ts --base-url=http://127.0.0.1:${PORT} --expected-commit=${COMMIT_SHA}`.
   - Runs `sudo nginx -t && sudo systemctl reload nginx` (when Nginx is installed).
7. **Automatic Rollback:** If any verification check fails, switches `<APP_DIR>/current` back to `$PREV_RELEASE`, reloads PM2 with `PREV_COMMIT_SHA`, verifies `/api/health` matches `PREV_COMMIT_SHA`, persists PM2 state for the restored release, preserves failing logs, and exits non-zero.
8. **Safe Persistence & Cleanup:** Runs `pm2 save` ONLY after all checks succeed, then prunes releases older than 5 while explicitly excluding both the active release and the immediate previous rollback release.

---

## 6. Migrating a Legacy PM2 Process Safely

If an older deployment started `pm2` directly from a legacy path (for example via `pm2 start npm -- start` in an older directory):
- `scripts/update-vps.sh` will intentionally **refuse** to modify that process because its `pm_cwd` / `pm_exec_path` lies outside `<APP_DIR>`.
- **Manual one-time cutover procedure:**
  1. Verify `<APP_DIR>/repo`, `<APP_DIR>/shared/.env`, and build the first release directory via `scripts/update-vps.sh` with a temporary/verified setup or inspect `pm2 describe <name>`.
  2. Manually stop and delete the legacy process once ready for cutover: `pm2 delete <legacy-name>`.
  3. Run `APP_DIR=<APP_DIR> PM2_APP_NAME=<name> PORT=3000 bash <APP_DIR>/repo/scripts/update-vps.sh`.
  4. Verify `https://tstream.online/api/health` returns `{ "status": "ok", "commitSha": "..." }`.

---

## 7. Nginx Reverse Proxy & TLS Setup

Refer to [`nginx.conf.example`](./nginx.conf.example):
- Update `root /var/www/tstream/current/dist;` (or replace `/var/www/tstream` with your verified `<APP_DIR>/current/dist`).
- Preserves genuine upstream `404` and `503` responses (`proxy_intercept_errors off`, never `error_page 404 /index.html`).
- Forwards `/api/*`, query-string requests (`$is_args = "?"`), and non-prerendered routes to Node runtime (`http://127.0.0.1:3000`).
- Test and reload before serving traffic:
  ```bash
  sudo nginx -t && sudo systemctl reload nginx
  ```
- Obtain/renew TLS via Let's Encrypt Certbot (`certbot --nginx -d tstream.online -d www.tstream.online`).

---

## 8. GitHub Actions CI & Approval-Gated Deploy

Defined in [`.github/workflows/deploy-tstream.yml`](./.github/workflows/deploy-tstream.yml):

- **`ci` job** (runs on push to `main`, PRs targeting `main`, and `workflow_dispatch`):
  - Node.js `24.12.0` -> `npm ci` -> `npm test` -> `npm run lint` -> `npm run build`
  - Secret-leak guard across `dist/assets/` and `dist/`
  - Starts `PORT=3099 APP_COMMIT_SHA=${{ github.sha }} node dist/server.mjs` and runs `verify-production.ts`
- **`deploy` job** (`workflow_dispatch` on `main` only, `environment: production` manual approval required):
  - **Required Repository Secrets:** `TMDB_API_KEY`, `VPS_SSH_KEY_B64`, `VPS_SSH_HOST_KEY`, `VPS_HOST`, `VPS_USER`, `VPS_PORT`
  - **Required Repository Variables:** `TSTREAM_APP_DIR`, `TSTREAM_PM2_APP_NAME`
  - **Optional Repository Variables:** `TSTREAM_PORT` (default `3000`), `TSTREAM_NODE_BIN` (default `node`)

---

## 9. TMDB Proxy Security, Rate Limits & CORS

`src/server/api/tmdb.ts` secures `/api/tmdb/*`:
- **Endpoint & Query Allowlist:** Only public read-only catalog/detail/top-rated endpoints are forwarded; client `api_key` params are stripped and server `TMDB_API_KEY` is never logged or returned.
- **Process-Local Sliding-Window Rate Limiting:** Enforces `TMDB_RATE_LIMIT_MAX` (default `120` requests) per `TMDB_RATE_LIMIT_WINDOW_MS` (default `60000` ms) per verified client IP using a bounded LRU map (`MAX 2000` client buckets), returning `429` + `Retry-After` + `X-RateLimit-*` headers. Because this store is process-local in memory, keep single-process PM2 or pair it with Nginx `limit_req_zone` if horizontally scaled.
- **Client IP Safety:** Ignores raw spoofed `X-Forwarded-For` headers unless `TRUST_PROXY=true` (reading validated IP hops from the trusted proxy boundary), and prefers Node's verified socket address.
- **CORS Policy:** Wildcard `*` is disabled. Only `https://tstream.online`, configured `APP_URL` / `CORS_ALLOWED_ORIGINS` (plus `http://localhost:3000` / `127.0.0.1:3000` outside production), or same-origin `Host` requests are allowed; untrusted `Origin` headers receive HTTP `403`.

---

## 10. Platform Regions & Top-Rated Discovery

- **Streaming Platform Hubs (`/platform/:id`):** Uses a shared query specification (`src/services/platformDiscovery.ts`) across browser (`src/services/tmdb.ts`) and SSR (`scripts/seoHtmlPlugin.ts`) querying TMDB `with_watch_providers` + `watch_region`. Default region is **`US`** (`DEFAULT_WATCH_REGION`), shown in the UI and SSR metadata, and selectable per user in the Catalog page.
- **Balanced `/top-rated` Discovery:** Combines top-rated movies (`/movie/top_rated`) and top-rated TV series (`/tv/top_rated`) with deterministic zero-skip balanced pagination (6 movies + 6 series per 12-card page) across both server SSR and browser pagination.

---

## 11. Local Development & Verification Commands

```bash
# 1. Install dependencies cleanly (requires Node.js >= 24.12.0)
npm ci --no-audit --no-fund

# 2. Local development server (port 3000)
npm run dev

# 3. Run full automated regression suite & TypeScript check
npm test
npm run lint

# 4. Run full production build (loads .env, sitemaps, Vite, prerender, server bundle)
npm run build

# 5. Direct prerender check
npm run prerender

# 6. Verify built production server & SEO routes on isolated port
APP_COMMIT_SHA=local-verify PORT=3099 node dist/server.mjs &
SERVER_PID=$!
npx --no-install tsx scripts/verify-production.ts --base-url=http://127.0.0.1:3099 --expected-commit=local-verify
kill "$SERVER_PID"
```
