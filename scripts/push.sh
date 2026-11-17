#!/bin/bash
# Push main to weareheadless/alaguillotine with the token on this box.
#
#   bash scripts/push.sh              # push HEAD to main
#   bash scripts/push.sh <branch>     # push HEAD somewhere else
#
# A push does not deploy. Run scripts/deploy.sh too (see DEPLOY.md).

set -euo pipefail
cd /FYE

BRANCH="${1:-main}"
TOKEN_FILE="/home/admin/.config/opencode/github-pat"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "✗ no GitHub token at $TOKEN_FILE" >&2
  exit 1
fi
TOKEN=$(tr -d '\n' < "$TOKEN_FILE")

if [ -n "$(git status --porcelain)" ]; then
  echo "⚠ uncommitted changes will NOT be pushed:" >&2
  git status --short >&2
fi

set +e
OUT=$(git push "https://x-access-token:${TOKEN}@github.com/weareheadless/alaguillotine.git" "HEAD:${BRANCH}" 2>&1)
STATUS=$?
set -e
echo "$OUT" | sed "s|${TOKEN}|<token>|g"
exit "$STATUS"
