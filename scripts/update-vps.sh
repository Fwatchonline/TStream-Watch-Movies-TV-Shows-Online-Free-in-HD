#!/usr/bin/env bash
# ========================================================
# TStream VPS Production Deployment Script (Atomic & Verified)
#
# Explicit required configuration (never guessed):
#   APP_DIR       - Base deployment root on VPS (contains repo/, releases/, shared/, current/)
#   PM2_APP_NAME  - Exact PM2 process name serving TStream
#
# Optional configuration:
#   RELEASES_DIR     (default: "$APP_DIR/releases")
#   CURRENT_LINK     (default: "$APP_DIR/current")
#   SHARED_ENV_FILE  (default: "$APP_DIR/shared/.env")
#   REPO_DIR         (default: "$APP_DIR/repo")
#   BACKUP_DIR       (default: "$APP_DIR/backups")
#   PORT             (default: "3000")
#   HOST             (default: "0.0.0.0")
#   NODE_BIN         (default: "node")
#   HEALTH_URL       (default: "http://127.0.0.1:${PORT}/api/health")
#   DEPLOY_REF       (default: "origin/main")
#   SKIP_NGINX_CHECK (default: "0"; set "1" in non-nginx sandbox tests)
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
HOST="${HOST:-0.0.0.0}"
NODE_BIN="${NODE_BIN:-node}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/health}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"
SKIP_NGINX_CHECK="${SKIP_NGINX_CHECK:-0}"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"

echo "=== [1/9] Pre-flight runtime & directory validation ==="
for cmd in git "$NODE_BIN" npm pm2 curl tar; do
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

CANON_APP_DIR="$(readlink -f "$APP_DIR")"
PREV_RELEASE=""
PREV_COMMIT_SHA=""
if [ -L "$CURRENT_LINK" ] || [ -e "$CURRENT_LINK" ]; then
  PREV_RELEASE="$(readlink -f "$CURRENT_LINK" || true)"
  if [ -n "$PREV_RELEASE" ] && [ -f "$PREV_RELEASE/.release-commit" ]; then
    PREV_COMMIT_SHA="$(tr -d '[:space:]' < "$PREV_RELEASE/.release-commit" || true)"
  fi
fi
echo "Current active release: ${PREV_RELEASE:-<none>} (${PREV_COMMIT_SHA:-none})"

echo "=== [2/9] Verifying existing PM2 process ownership ==="
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  PM2_JLIST="$(pm2 jlist)"
  "$NODE_BIN" -e '
    const fs = require("fs");
    const path = require("path");
    const list = JSON.parse(process.argv[1] || "[]");
    const appName = process.argv[2];
    const allowedBases = [process.argv[3], process.argv[4], process.argv[5]].filter(Boolean).map(p => {
      try { return fs.realpathSync(p); } catch { return path.resolve(p); }
    });
    const proc = list.find(item => item.name === appName);
    if (!proc) process.exit(0);

    const resolveTarget = (p) => {
      if (!p) return "";
      try { return fs.realpathSync(p); } catch { return path.resolve(p); }
    };
    const isWithinBase = (target) =>
      Boolean(target) && allowedBases.some(base => target === base || target.startsWith(base + "/"));

    const curCwd = resolveTarget(proc?.pm2_env?.pm_cwd || "");
    const curExec = resolveTarget(proc?.pm2_env?.pm_exec_path || "");
    if (!isWithinBase(curCwd) || (curExec && !isWithinBase(curExec))) {
      console.error(`ERROR: PM2 process '\''${appName}'\'' runs cwd='\''${curCwd}'\'' exec='\''${curExec}'\'', outside verified roots [${allowedBases.join(", ")}].`);
      console.error("Refusing to terminate or alter an unrelated PM2 process automatically.");
      process.exit(1);
    }
  ' "$PM2_JLIST" "$PM2_APP_NAME" "$CANON_APP_DIR" "$CURRENT_LINK" "$PREV_RELEASE"
fi

echo "=== [3/9] Preparing clean isolated release directory $RELEASE_DIR ==="
git -C "$REPO_DIR" fetch origin --prune
COMMIT_SHA="$(git -C "$REPO_DIR" rev-parse "$DEPLOY_REF")"
echo "Target release commit: $COMMIT_SHA"

mkdir -p "$RELEASE_DIR"
git -C "$REPO_DIR" archive "$COMMIT_SHA" | tar -x -C "$RELEASE_DIR"
printf '%s\n' "$COMMIT_SHA" > "$RELEASE_DIR/.release-commit"
ln -sfn "$SHARED_ENV_FILE" "$RELEASE_DIR/.env"

echo "=== [4/9] Installing dependencies inside isolated release ==="
cd "$RELEASE_DIR"
npm ci --no-audit --no-fund

echo "=== [5/9] Running tests & TypeScript type check ==="
npm test
npm run lint

echo "=== [6/9] Building authoritative dist/ inside isolated release ==="
APP_COMMIT_SHA="$COMMIT_SHA" npm run build

for req_file in dist/index.html dist/server.mjs dist/robots.txt dist/sitemap.xml dist/prerender-report.json; do
  if [ ! -s "$RELEASE_DIR/$req_file" ]; then
    echo "ERROR: Required build artifact missing or empty: $RELEASE_DIR/$req_file" >&2
    exit 1
  fi
done
cp "$RELEASE_DIR/.release-commit" "$RELEASE_DIR/dist/.release-commit"

apply_pm2_release() {
  local target_commit="$1"
  export APP_DIR="$CANON_APP_DIR"
  export PM2_APP_NAME
  export PORT
  export HOST
  export NODE_BIN
  export APP_COMMIT_SHA="$target_commit"

  if [ ! -f "$CURRENT_LINK/ecosystem.config.cjs" ]; then
    echo "ERROR: Missing $CURRENT_LINK/ecosystem.config.cjs" >&2
    return 1
  fi

  local need_fresh_start=0
  if ! pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    need_fresh_start=1
  else
    local jlist
    jlist="$(pm2 jlist)"
    if ! "$NODE_BIN" -e '
      const list = JSON.parse(process.argv[1] || "[]");
      const p = list.find(item => item.name === process.argv[2]);
      const execPath = p?.pm2_env?.pm_exec_path || "";
      if (!execPath.endsWith("/dist/server.mjs")) process.exit(1);
    ' "$jlist" "$PM2_APP_NAME"; then
      need_fresh_start=1
    fi
  fi

  if [ "$need_fresh_start" -eq 1 ]; then
    pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
    pm2 start "$CURRENT_LINK/ecosystem.config.cjs" --only "$PM2_APP_NAME" --update-env
  else
    pm2 reload "$CURRENT_LINK/ecosystem.config.cjs" --only "$PM2_APP_NAME" --update-env
  fi
}

verify_health_commit() {
  local expected_sha="$1"
  local attempt
  for attempt in $(seq 1 20); do
    local payload
    if payload="$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null)"; then
      if "$NODE_BIN" -e '
        const data = JSON.parse(process.argv[1]);
        const expected = process.argv[2];
        if (data.status !== "ok") process.exit(1);
        if (expected && data.commitSha !== expected) process.exit(1);
      ' "$payload" "$expected_sha" 2>/dev/null; then
        return 0
      fi
    fi
    sleep 1
  done
  return 1
}

rollback_release() {
  echo "CRITICAL: Deployment verification failed! Initiating automatic rollback..." >&2
  pm2 logs "$PM2_APP_NAME" --lines 30 --nostream >&2 || true

  if [ -n "$PREV_RELEASE" ] && [ -d "$PREV_RELEASE" ]; then
    ln -sfn "$PREV_RELEASE" "${CURRENT_LINK}.rollback"
    mv -Tf "${CURRENT_LINK}.rollback" "$CURRENT_LINK"

    if apply_pm2_release "$PREV_COMMIT_SHA" && verify_health_commit "$PREV_COMMIT_SHA"; then
      pm2 save || true
      echo "Rollback succeeded on $PREV_RELEASE (${PREV_COMMIT_SHA:-unknown})." >&2
      exit 1
    fi
    echo "ERROR: Rollback health verification failed after restoring $PREV_RELEASE!" >&2
  else
    echo "ERROR: No previous release directory available for automatic rollback." >&2
  fi
  exit 1
}

echo "=== [7/9] Switching current release symlink atomically ==="
ln -sfn "$RELEASE_DIR" "${CURRENT_LINK}.next"
mv -Tf "${CURRENT_LINK}.next" "$CURRENT_LINK"

RESOLVED_CURRENT="$(readlink -f "$CURRENT_LINK" || true)"
RESOLVED_TARGET="$(readlink -f "$RELEASE_DIR" || true)"
if [ "$RESOLVED_CURRENT" != "$RESOLVED_TARGET" ]; then
  echo "ERROR: Current symlink '$RESOLVED_CURRENT' does not match target '$RESOLVED_TARGET'." >&2
  rollback_release
fi

echo "=== [8/9] Starting/reloading PM2 process '$PM2_APP_NAME' via ecosystem.config.cjs ==="
if ! apply_pm2_release "$COMMIT_SHA"; then
  rollback_release
fi

# Verify PM2 process metadata reports online & authoritative server.mjs entry
PM2_POST_JLIST="$(pm2 jlist)"
if ! "$NODE_BIN" -e '
  const fs = require("fs");
  const list = JSON.parse(process.argv[1] || "[]");
  const appName = process.argv[2];
  const expectedTarget = process.argv[3];
  const p = list.find(item => item.name === appName);
  if (!p) process.exit(1);
  const status = p?.pm2_env?.status;
  const cwd = p?.pm2_env?.pm_cwd || "";
  const execPath = p?.pm2_env?.pm_exec_path || "";
  let realCwd = cwd;
  try { realCwd = fs.realpathSync(cwd); } catch {}
  let realExec = execPath;
  try { realExec = fs.realpathSync(execPath); } catch {}
  if (status !== "online") process.exit(1);
  if (realCwd !== expectedTarget) process.exit(1);
  if (realExec !== expectedTarget + "/dist/server.mjs") process.exit(1);
' "$PM2_POST_JLIST" "$PM2_APP_NAME" "$RESOLVED_TARGET"; then
  echo "ERROR: PM2 process '$PM2_APP_NAME' failed runtime target/status verification." >&2
  rollback_release
fi

echo "=== [9/9] Verifying HTTP health commitSha, SEO suite & Nginx config ==="
if ! verify_health_commit "$COMMIT_SHA"; then
  echo "ERROR: /api/health failed status/commitSha check for $COMMIT_SHA." >&2
  rollback_release
fi

cd "$CURRENT_LINK"
if ! npx --no-install tsx "$CURRENT_LINK/scripts/verify-production.ts" --base-url="http://127.0.0.1:${PORT}" --expected-commit="$COMMIT_SHA"; then
  echo "ERROR: Production SEO/HTTP verification failed for $COMMIT_SHA." >&2
  rollback_release
fi

if [ "$SKIP_NGINX_CHECK" != "1" ] && command -v nginx >/dev/null 2>&1; then
  if ! sudo nginx -t; then
    rollback_release
  fi
  sudo systemctl reload nginx || rollback_release
fi

# Persist PM2 dump ONLY after full health + SEO + Nginx verification succeeds
pm2 save

# Prune older releases (>5), while NEVER deleting active release or immediate rollback target
mapfile -t ALL_RELEASES < <(ls -1dt "$RELEASES_DIR"/* 2>/dev/null || true)
KEEP_COUNT=5
if [ "${#ALL_RELEASES[@]}" -gt "$KEEP_COUNT" ]; then
  for idx in $(seq "$KEEP_COUNT" $((${#ALL_RELEASES[@]} - 1))); do
    candidate="${ALL_RELEASES[$idx]}"
    canon_cand="$(readlink -f "$candidate" || echo "$candidate")"
    if [ "$canon_cand" = "$RESOLVED_TARGET" ] || { [ -n "$PREV_RELEASE" ] && [ "$canon_cand" = "$PREV_RELEASE" ]; }; then
      continue
    fi
    rm -rf "$candidate"
  done
fi

echo "Deploy succeeded at $(date -u +%Y-%m-%dT%H:%M:%SZ). Release: $RELEASE_DIR ($COMMIT_SHA)"
