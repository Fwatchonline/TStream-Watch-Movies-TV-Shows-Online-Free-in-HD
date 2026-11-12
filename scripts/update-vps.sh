#!/usr/bin/env bash
# ========================================================
# TStream VPS Production Deployment Script (Hardened)
# Usage: ./scripts/update-vps.sh
# ========================================================

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PM2_APP_NAME="${PM2_APP_NAME:-tstream}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tstream}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

cd "$APP_DIR"

echo "=== [1/8] Pre-flight checks ==="
for cmd in git node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Required command '$cmd' not found." >&2
    exit 1
  fi
done

if [ ! -f ".env" ]; then
  echo "ERROR: .env file missing in $APP_DIR. Create it from .env.example before deploying." >&2
  exit 1
fi

AVAIL_KB="$(df -Pk "$APP_DIR" | awk 'NR==2 {print $4}')"
if [ "${AVAIL_KB:-0}" -lt 1048576 ]; then
  echo "ERROR: Less than 1GB free disk space available (${AVAIL_KB:-0} KB)." >&2
  exit 1
fi

echo "=== [2/8] Backing up current dist/ & .env ==="
mkdir -p "$BACKUP_DIR"
PREV_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
echo "Previous commit: $PREV_COMMIT"
if [ -d "dist" ]; then
  tar -czf "$BACKUP_DIR/dist-$TIMESTAMP.tar.gz" dist .env
  ls -1t "$BACKUP_DIR"/dist-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
fi

echo "=== [3/8] Pulling latest changes from origin/main (fast-forward only) ==="
git fetch origin main --prune
git reset --hard origin/main
# Never overwrite untracked .env or local uploads

echo "=== [4/8] Installing dependencies via npm ci ==="
npm ci --no-audit --no-fund

echo "=== [5/8] Running tests & TypeScript type check ==="
npm test
npm run lint

echo "=== [6/8] Building sitemaps, Vite bundle, prerendered HTML & dist/server.mjs ==="
npm run build

if [ ! -f "dist/server.mjs" ] || [ ! -f "dist/index.html" ]; then
  echo "ERROR: Build artifacts missing (dist/server.mjs or dist/index.html)." >&2
  exit 1
fi

echo "=== [7/8] Reloading PM2 process '$PM2_APP_NAME' ==="
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 is required in production." >&2
  exit 1
fi

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  # Ensure PM2 runs dist/server.mjs rather than legacy vite preview
  CURRENT_EXEC="$(pm2 jlist | node -e "const a=JSON.parse(require('fs').readFileSync(0,'utf8')).find(p=>p.name==='$PM2_APP_NAME'); console.log(a?.pm2_env?.pm_exec_path||'');")"
  if [[ "$CURRENT_EXEC" != *"dist/server.mjs"* ]]; then
    pm2 delete "$PM2_APP_NAME"
    pm2 start dist/server.mjs --name "$PM2_APP_NAME" --cwd "$APP_DIR"
  else
    pm2 reload "$PM2_APP_NAME" --update-env
  fi
else
  pm2 start dist/server.mjs --name "$PM2_APP_NAME" --cwd "$APP_DIR"
fi
pm2 save

echo "=== [8/8] Verifying /api/health & Nginx ==="
HEALTH_OK=0
for i in $(seq 1 15); do
  if curl -fsS --max-time 3 "$HEALTH_URL" | grep -q '"status":"ok"'; then
    HEALTH_OK=1
    break
  fi
  sleep 1
done

if [ "$HEALTH_OK" -ne 1 ]; then
  echo "ERROR: Health check failed at $HEALTH_URL!" >&2
  echo "Rollback command: cd $APP_DIR && tar -xzf $BACKUP_DIR/dist-$TIMESTAMP.tar.gz && git checkout $PREV_COMMIT && pm2 reload $PM2_APP_NAME" >&2
  exit 1
fi

if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "Deploy succeeded at $(date -u +%Y-%m-%dT%H:%M:%SZ). Live: https://tstream.online"
