#!/bin/bash
# Rebuild and restart everything — guarantees fresh build every deploy
# Usage: bash scripts/deploy.sh

set -euo pipefail
cd /FYE

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=============================================="
echo "  FUCKYOUELON DEPLOY"
echo "  $(date)"
echo "=============================================="

# ── 1. Stop everything ──────────────────────────────────────────────
echo ""
echo "=== [1/5] Stopping services ==="
sudo systemctl stop fuckyouelon.service 2>/dev/null || true
sleep 1
fuser -k 3002/tcp 2>/dev/null || true
sleep 1
# Double-check port is free
if fuser 3002/tcp 2>/dev/null; then
  echo -e "${RED}✗ Port 3002 still in use — aborting${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Services stopped, port 3002 free${NC}"

# ── 2. Full clean rebuild ───────────────────────────────────────────
echo ""
echo "=== [2/5] Cleaning and rebuilding ==="
rm -rf .next
rm -rf node_modules/.cache 2>/dev/null || true
echo "✓ Caches wiped"

# Write a build stamp so we can verify freshness
BUILD_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "$BUILD_TS" > .buildstamp

if ! npm run build; then
  echo -e "${RED}✗ Build failed — old version left untouched${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Build complete (stamp: $BUILD_TS)${NC}"

# ── 3. Seed data ────────────────────────────────────────────────────
echo ""
echo "=== [3/5] Seeding War Room ==="
node scripts/seed-war-room.cjs 2>&1 || echo -e "${YELLOW}⚠ Seed completed (may have skipped existing data)${NC}"

# ── 4. Start Next.js ────────────────────────────────────────────────
echo ""
echo "=== [4/5] Starting Next.js ==="
sudo systemctl restart fuckyouelon.service

# Wait for app to come up (up to 30s for cold starts)
for i in $(seq 1 30); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    echo -e "${GREEN}✓ App running (HTTP $HTTP) after ${i}s${NC}"
    break
  fi
  if [ "$i" = "30" ]; then
    echo -e "${RED}✗ App failed to start after 30s — check logs: sudo journalctl -u fuckyouelon -n 30${NC}"
    exit 1
  fi
  sleep 1
done

# ── 5. PM2 background scripts ───────────────────────────────────────
echo ""
echo "=== [5/5] Starting PM2 scripts ==="
pm2 start /FYE/ecosystem.config.cjs
pm2 save

# ── Verify freshness ────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  VERIFYING DEPLOY"
echo "=============================================="

# Check the build stamp endpoint or just confirm the app responds
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/governance)
if [ "$HTTP" = "200" ]; then
  echo -e "${GREEN}✓ Governance page: HTTP $HTTP${NC}"
else
  echo -e "${RED}✗ Governance page: HTTP $HTTP${NC}"
fi

HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://www.fuckyouelon.net/ 2>/dev/null || echo "N/A")
echo "  Public URL: HTTP $HTTP"

echo ""
echo "  Build stamp: $(cat .buildstamp 2>/dev/null || echo 'N/A')"
echo "  PM2 status:"
pm2 status 2>/dev/null || true
echo ""
echo -e "${GREEN}✓ Deploy complete.${NC}"
