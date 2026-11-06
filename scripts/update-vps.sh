#!/usr/bin/env bash
# ========================================================
# TStream VPS One-Click Update Script
# Usage: ./scripts/update-vps.sh
# ========================================================

set -e

echo "🚀 [1/5] Pulling latest updates from GitHub..."
git pull origin main

echo "📦 [2/5] Installing dependencies..."
npm install --prefer-offline --no-audit

echo "🗺️  [3/5] Generating fresh XML sitemaps & building production bundle..."
npm run build

echo "🔄 [4/5] Reloading PM2 process (if running)..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload tstream || pm2 restart tstream || true
fi

echo "🌐 [5/5] Testing and reloading Nginx..."
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx || true
fi

echo "✅ TStream update completed successfully!"
echo "👉 Live site: https://tstream.online"
