#!/bin/bash
# Build and restart the site.
# Usage: bash scripts/deploy.sh

set -euo pipefail
cd /FYE

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Pin Node. Next 15 needs Node >= 18, but this box has three nodes:
#   /home/admin/.local/bin/node  -> v22 (correct)
#   /usr/local/bin/node          -> v20 (works, but not this deploy path)
#   /usr/bin/node                -> v12 (CANNOT run Next 15)
# A build that accidentally resolves to v12 fails with "SyntaxError:
# Unexpected token '?'" (seen in logs/build.log). Force the known-good one.
export PATH="/home/admin/.local/bin:$PATH"
export NODE_ENV="production"
NODE_BIN="/home/admin/.local/bin/node"
if [ ! -x "$NODE_BIN" ]; then
  echo -e "${RED}✗ $NODE_BIN not found — refusing to build with an unknown node${NC}" >&2
  exit 1
fi
NODE_MAJOR=$("$NODE_BIN" -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo -e "${RED}✗ Node $NODE_MAJOR too old — need >= 18 (got $NODE_BIN)${NC}" >&2
  exit 1
fi
echo "✓ Node $("$NODE_BIN" --version) ($NODE_BIN)"

echo "=============================================="
echo "  FUCKYOUELON DEPLOY"
echo "  $(date)"
echo "=============================================="

# ── 1. Build in isolation while the current site stays online ────────
echo ""
echo "=== [1/5] Building ==="
BUILD_DIR=".next-dev"
rm -rf "$BUILD_DIR"
if ! NEXT_DIST_DIR="$BUILD_DIR" npm run build; then
  echo -e "${RED}✗ Build failed — the current service was left running${NC}"
  rm -rf "$BUILD_DIR"
  exit 1
fi
if [ ! -f "$BUILD_DIR/BUILD_ID" ]; then
  echo -e "${RED}✗ Production build did not create $BUILD_DIR/BUILD_ID — the current service was left running${NC}"
  rm -rf "$BUILD_DIR"
  exit 1
fi
BUILD_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "$BUILD_TS" > .buildstamp
echo -e "${GREEN}✓ Build complete (stamp: $BUILD_TS)${NC}"

# ── 2. Stop the old process after a successful build ─────────────────
echo ""
echo "=== [2/5] Stopping services ==="
sudo systemctl stop fuckyouelon.service 2>/dev/null || true
sleep 1
fuser -k 3002/tcp 2>/dev/null || true
sleep 1
if fuser 3002/tcp 2>/dev/null; then
  echo -e "${RED}✗ Port 3002 still in use — aborting${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Services stopped, port 3002 free${NC}"

rm -rf .next-previous
mv .next .next-previous
mv "$BUILD_DIR" .next

# ── 3. Seed data ────────────────────────────────────────────────────
echo ""
echo "=== [3/5] Seeding War Room ==="
node scripts/seed-war-room.cjs 2>&1 || echo -e "${YELLOW}⚠ Seed completed (may have skipped existing data)${NC}"

# ── 4. Start Next.js ────────────────────────────────────────────────
echo ""
echo "=== [4/5] Starting Next.js ==="
sudo systemctl restart fuckyouelon.service

# Wait for app to come up. Cold starts on this box routinely take 60s+,
# so allow up to 90s before giving up.
APP_UP=0
for i in $(seq 1 90); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    echo -e "${GREEN}✓ App running (HTTP $HTTP) after ${i}s${NC}"
    APP_UP=1
    break
  fi
  sleep 1
done

if [ "$APP_UP" != "1" ]; then
  echo -e "${RED}✗ App did not respond with HTTP 200 within 90s${NC}"
  echo -e "${YELLOW}  Build: $([ -f .next/BUILD_ID ] && echo 'valid (BUILD_ID present)' || echo 'MISSING BUILD_ID')${NC}"
  echo -e "${YELLOW}  Service: $(systemctl is-active fuckyouelon 2>/dev/null || echo 'unknown')${NC}"
  echo -e "${YELLOW}  Port 3002: $(fuser 3002/tcp >/dev/null 2>&1 && echo 'in use' || echo 'free')${NC}"
  echo -e "${YELLOW}  Recent service error: $(sudo journalctl -u fuckyouelon -n 1 --no-pager -o cat 2>/dev/null || echo 'unknown')${NC}"
  sudo systemctl stop fuckyouelon.service 2>/dev/null || true
  rm -rf .next
  mv .next-previous .next
  sudo systemctl restart fuckyouelon.service 2>/dev/null || true
  exit 1
fi
rm -rf .next-previous

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
