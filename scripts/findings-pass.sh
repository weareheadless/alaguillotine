#!/bin/bash
# One findings pass: search each investigative archive for finding words, and
# let the articles name the people. No roster, no manual row.
#
# Usage: bash scripts/findings-pass.sh
#   BASE=https://alaguillotine.com  (default)
#   PER=15                          (posts per outlet/query)
set -uo pipefail
cd /FYE

BASE=${BASE:-https://alaguillotine.com}
PER=${PER:-15}
KEY=$(grep '^ADMIN_KEY=' .env.local | cut -d= -f2-)
if [ -z "$KEY" ]; then
  echo "ADMIN_KEY missing from .env.local" >&2
  exit 1
fi

OUTLETS=(
  premiumtimes balkaninsight propublica rollingstone pcij reveal hkfp
  injusticewatch trace thecity bylinetimes motherjones intercept icij
  insightcrime
)
QUERIES=("convicted" "sentenced" "charged" "pleaded guilty")

total=0
for outlet in "${OUTLETS[@]}"; do
  for query in "${QUERIES[@]}"; do
    response=$(curl -sS -m 150 -X POST \
      -H "x-admin-key: $KEY" \
      -G \
      --data-urlencode "outlet=$outlet" \
      --data-urlencode "query=$query" \
      --data-urlencode "per=$PER" \
      "$BASE/api/findings/ingest")
    line=$(printf '%s' "$response" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("invalid response")
    raise SystemExit(0)
if d.get("error"):
    print("ERR " + str(d["error"])[:120])
else:
    print("posts=%s articles=%s findings=%s dup=%s skipped=%s errors=%s" % (
        d.get("posts"), d.get("articles"), d.get("findings"),
        d.get("duplicates"), d.get("skipped"), len(d.get("errors") or [])))
')
    printf '%-16s %-15s %s\n' "$outlet" "$query" "$line"
    total=$(( total + $(printf '%s' "$response" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("findings") or 0)
except Exception:
    print(0)
') ))
    sleep 1
  done
done
echo "PASS COMPLETE: findings written this run = $total"
