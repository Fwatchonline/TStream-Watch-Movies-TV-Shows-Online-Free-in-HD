#!/usr/bin/env bash
# ========================================================
# TStream VPS Production Deployment Script (Atomic & Verified)
#
# Explicit required configuration (never guessed):
#   APP_DIR       - Base deployment root on VPS (contains repo/, releases/, shared/, current/)
#   PM2_APP_NAME  - Exact PM2 process name serving TStream
#
# Optional configuration:
#   RELEASES_DIR    (default: "$APP_DIR/releases")
#   CURRENT_LINK    (default: "$APP_DIR/current")
#   SHARED_ENV_FILE (default: "$APP_DIR/shared/.env")
#   REPO_DIR        (default: "$APP_DIR/repo")
#   BACKUP_DIR      (default: "$APP_DIR/backups")
#   PORT            (default: "3000")
#   NODE_BIN        (default: "node")
#   HEALTH_URL      (default: "http://127.0.0.1:${PORT}/api/health")
#   DEPLOY_REF      (default: "origin/main")
# ========================================================

set -euo pipefail

: "${APP_DIR:?ERROR: APP_DIR must be explicitly set to the verified production application root (do not guess).}"
: "${PM2_APP_NAME:?ERROR: PM2_APP_NAME must be explicitly set to the verified PM2 process name.}"

RELEASES_DIR="${RELEASES_DIR:-$APP_DIR/releases}"
CURRENT_LINK="${CURRENT_LINK:-$APP_DIR/current}"
SHARED_ENV_FILE="${SHARED_ENV_FILE:-$APP_DIR/shared/.env}"
REPO_DIR="${REPO_DIR:-$APP_DIR/repo}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
PORT="${PORT:-3000}"
NODE_BIN="${NODE_BIN:-node}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/health}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"

echo "=== [1/9] Pre-flight runtime & directory validation ==="
for cmd in git "$NODE_BIN" npm pm2 curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Required command '$cmd' not found in PATH." >&2
    exit 1
  fi
done

# Enforce Node.js >= 24.12.0 required by package.json & lockfile
"$NODE_BIN" -e '
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj < 24 || (maj === 24 && min < 12)) {
    console.error(`ERROR: Unsupported Node.js ${process.versions.node}. Required >= 24.12.0.`);
    process.exit(1);
  }
'

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "ERROR: Git repository missing at REPO_DIR=$REPO_DIR." >&2
  exit 1
fi

if [ ! -f "$SHARED_ENV_FILE" ]; then
  echo "ERROR: Shared production .env missing at SHARED_ENV_FILE=$SHARED_ENV_FILE." >&2
  exit 1
fi

if ! grep -q '^TMDB_API_KEY=' "$SHARED_ENV_FILE"; then
  echo "ERROR: TMDB_API_KEY entry missing in $SHARED_ENV_FILE." >&2
  exit 1
fi

AVAIL_KB="$(df -Pk "$APP_DIR" | awk 'NR==2 {print $4}')"
if [ "${AVAIL_KB:-0}" -lt 1048576 ]; then
  echo "ERROR: Less than 1GB free disk space available under $APP_DIR (${AVAIL_KB:-0} KB)." >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR" "$BACKUP_DIR"

PREV_RELEASE=""
if [ -L "$CURRENT_LINK" ] || [ -e "$CURRENT_LINK" ]; then
  PREV_RELEASE="$(readlink -f "$CURRENT_LINK" || true)"
fi
echo "Current active release: ${PREV_RELEASE:-<none>}"

echo "=== [2/9] Verifying existing PM2 process ownership ==="
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  PM2_INFO="$("$NODE_BIN" -e '
    const fs = require("fs");
    const list = JSON.parse(fs.readFileSync(0, "utf8"));
    const p = list.find(item => item.name === process.argv[1]);
    console.log(JSON.stringify({ exec: p?.pm2_env?.pm_exec_path || "", cwd: p?.pm2_env?.pm_cwd || "" }));
  ' "$PM2_APP_NAME" < <(pm2 jlist))"
  CUR_EXEC="$("$NODE_BIN" -e 'console.log(JSON.parse(process.argv[1]).exec)' "$PM2_INFO")"
  CUR_CWD="$("$NODE_BIN" -e 'console.log(JSON.parse(process.argv[1]).cwd)' "$PM2_INFO")"
  if [[ "$CUR_CWD" != "$APP_DIR"* ]] && [[ "$CUR_CWD" != "$CURRENT_LINK"* ]] && [[ "$CUR_CWD" != "$PREV_RELEASE"* ]]; then
    echo "ERROR: PM2 process '$PM2_APP_NAME' runs from '$CUR_CWD' ($CUR_EXEC), outside $APP_DIR." >&2
    echo "Refusing to terminate or alter an unrelated/different PM2 process automatically. Perform manual migration first." >&2
    exit 1
  fi
fi

echo "=== [3/9] Preparing clean isolated release directory $RELEASE_DIR ==="
git -C "$REPO_DIR" fetch origin main --prune
COMMIT_SHA="$(git -C "$REPO_DIR" rev-parse "$DEPLOY_REF")"
echo "Target release commit: $COMMIT_SHA"

mkdir -p "$RELEASE_DIR"
git -C "$REPO_DIR" archive "$COMMIT_SHA" | tar -x -C "$RELEASE_DIR"
ln -sfn "$SHARED_ENV_FILE" "$RELEASE_DIR/.env"

echo "=== [4/9] Installing dependencies inside isolated release ==="
cd "$RELEASE_DIR"
npm ci --no-audit --no-fund

echo "=== [5/9] Running tests & TypeScript type check ==="
npm test
npm run lint

echo "=== [6/9] Building authoritative dist/ inside isolated release ==="
npm run build

for req_file in dist/index.html dist/server.mjs dist/robots.txt dist/sitemap.xml dist/prerender-report.json; do
  if [ ! -s "$RELEASE_DIR/$req_file" ]; then
    echo "ERROR: Required build artifact missing or empty: $RELEASE_DIR/$req_file" >&2
    exit 1
  fi
done

echo "=== [7/9] Switching current release symlink atomically ==="
ln -sfn "$RELEASE_DIR" "${CURRENT_LINK}.next"
mv -Tf "${CURRENT_LINK}.next" "$CURRENT_LINK"

rollback_release() {
  echo "CRITICAL: Deployment verification failed! Initiating automatic rollback..." >&2
  if [ -n "$PREV_RELEASE" ] && [ -d "$PREV_RELEASE" ]; then
    ln -sfn "$PREV_RELEASE" "${CURRENT_LINK}.rollback"
    mv -Tf "${CURRENT_LINK}.rollback" "$CURRENT_LINK"
    PORT="$PORT" pm2 reload "$PM2_APP_NAME" --update-env
    for _ in $(seq 1 15); do
      if curl -fsS --max-time 3 "$HEALTH_URL" | grep -q '"status":"ok"'; then
        echo "Rollback completed and health check passed on $PREV_RELEASE." >&2
        exit 1
      fi
      sleep 1
    done
    echo "ERROR: Rollback health check failed after restoring $PREV_RELEASE!" >&2
  else
    echo "ERROR: No previous release directory available for automatic rollback." >&2
  fi
  exit 1
}

echo "=== [8/9] Starting/reloading PM2 process '$PM2_APP_NAME' ==="
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  PORT="$PORT" pm2 reload "$PM2_APP_NAME" --cwd "$CURRENT_LINK" --update-env || rollback_release
else
  PORT="$PORT" pm2 start "$CURRENT_LINK/dist/server.mjs" --name "$PM2_APP_NAME" --cwd "$CURRENT_LINK" --update-env || rollback_release
fi
pm2 save

echo "=== [9/9] Verifying HTTP health, SEO suite & Nginx config ==="
HEALTH_OK=0
for _ in $(seq 1 15); do
  if curl -fsS --max-time 3 "$HEALTH_URL" | grep -q '"status":"ok"'; then
    HEALTH_OK=1
    break
  fi
  sleep 1
done

if [ "$HEALTH_OK" -ne 1 ]; then
  rollback_release
fi

cd "$CURRENT_LINK"
if ! npx --no-install tsx "$CURRENT_LINK/scripts/verify-production.ts" --base-url="http://127.0.0.1:${PORT}"; then
  rollback_release
fi

if command -v nginx >/dev/null 2>&1; then
  if ! sudo nginx -t; then
    rollback_release
  fi
  sudo systemctl reload nginx || rollback_release
fi

# Prune older releases, keeping 5 most recent
ls -1dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "Deploy succeeded at $(date -u +%Y-%m-%dT%H:%M:%SZ). Release: $RELEASE_DIR ($COMMIT_SHA)"
