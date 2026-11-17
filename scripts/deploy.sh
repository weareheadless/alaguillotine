#!/bin/bash
# Build and deploy the Cloudflare Worker. See DEPLOY.md.
#
#   bash scripts/deploy.sh                # refuse a dirty tree, build, deploy, verify
#   bash scripts/deploy.sh --allow-dirty  # only when the artifact is disposable
#
# The tree must be committed first: the repository has to describe what is
# live. If you are mid-change, commit it or move it out of the tree.

set -euo pipefail
cd /FYE

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ALLOW_DIRTY=0
if [ "${1:-}" = "--allow-dirty" ]; then ALLOW_DIRTY=1; fi

# The box has three nodes; two of them cannot build Next 15. Pin v22.
export PATH="/home/admin/.local/bin:$PATH"
NODE_BIN="/home/admin/.local/bin/node"
if [ ! -x "$NODE_BIN" ]; then
  echo -e "${RED}✗ $NODE_BIN not found — refusing to build with an unknown node${NC}" >&2
  exit 1
fi
NODE_MAJOR=$("$NODE_BIN" -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo -e "${RED}✗ Node $NODE_MAJOR too old — need 22 (got $NODE_BIN)${NC}" >&2
  exit 1
fi
echo -e "${GREEN}✓ Node $("$NODE_BIN" --version)${NC}"

# ── 1. The tree must describe production ─────────────────────────────
echo ""
echo "=== [1/5] Checking the tree ==="
if [ -n "$(git status --porcelain)" ]; then
  if [ "$ALLOW_DIRTY" = "1" ]; then
    echo -e "${YELLOW}⚠ uncommitted changes, shipping them anyway (--allow-dirty)${NC}"
    git status --short
  else
    echo -e "${RED}✗ working tree has uncommitted changes — commit or stash first${NC}" >&2
    git status --short >&2
    echo -e "${YELLOW}  The last live build stopped matching GitHub exactly this way.${NC}" >&2
    echo -e "${YELLOW}  Use --allow-dirty only if the artifact is disposable.${NC}" >&2
    exit 1
  fi
else
  echo -e "${GREEN}✓ tree clean at $(git rev-parse --short HEAD)${NC}"
fi

# ── 2. Types ─────────────────────────────────────────────────────────
echo ""
echo "=== [2/5] Typecheck ==="
npm run typecheck

# ── 3. Build ─────────────────────────────────────────────────────────
echo ""
echo "=== [3/5] Building the Worker ==="
set -a
# shellcheck disable=SC1091
source /SOCIAL/configs/cloudflare.env
set +a
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo -e "${RED}✗ CLOUDFLARE_API_TOKEN is empty — check /SOCIAL/configs/cloudflare.env${NC}" >&2
  exit 1
fi

rm -rf .open-next
# The installed Next is past OpenNext's support window; the flag is required
# until Next is upgraded or pinned (see DEPLOY.md).
TMPDIR=/var/tmp/opencode-build \
  npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion
if [ ! -f .open-next/worker.js ]; then
  echo -e "${RED}✗ build produced no .open-next/worker.js — nothing to deploy${NC}" >&2
  exit 1
fi
echo -e "${GREEN}✓ artifact built${NC}"

# ── 4. Deploy ────────────────────────────────────────────────────────
echo ""
echo "=== [4/5] Deploying ==="
npx wrangler deploy

# ── 5. Verify ────────────────────────────────────────────────────────
echo ""
echo "=== [5/5] Verifying ==="
FAILED=0
for path in "/" "/archive" "/api/hateometer?lean=1"; do
  CODE=$(curl -s -o /tmp/deploy-check.out -w '%{http_code}' -m 60 "https://alaguillotine.com${path}" || echo "000")
  printf '  %-28s %s\n' "$path" "$CODE"
  [ "$CODE" = "200" ] || FAILED=1
done

# The front page is server-rendered: a 200 that carries only the headline means
# the reading failed, not that the page is fine.
HTML=$(curl -s -m 60 https://alaguillotine.com/ || true)
if printf '%s' "$HTML" | grep -q "charges on record"; then
  echo "  homepage reading          present"
else
  echo -e "${YELLOW}  homepage reading          MISSING — check the D1 binding and the logs${NC}"
  FAILED=1
fi
rm -f /tmp/deploy-check.out

echo ""
if [ "$FAILED" = "0" ]; then
  echo -e "${GREEN}✓ deployed and verified at $(git rev-parse --short HEAD)${NC}"
  echo -e "${YELLOW}  push the same commit: bash scripts/push.sh${NC}"
else
  echo -e "${RED}✗ deployed but verification failed — inspect before announcing it${NC}" >&2
  exit 1
fi
