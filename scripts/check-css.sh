#!/bin/bash
# Health check: verify the served stylesheet isn't empty/truncated.
#
# Why: the CSS is served with `Cache-Control: immutable`, so if the server
# ever hands out a truncated response (e.g. under memory pressure / swap
# thrash), every visitor's browser caches the broken file and the site stays
# "fucked" until the process is restarted. This catches it and self-heals.
#
# Restart mechanism: the production `next start` runs as User=admin (not root),
# so this script (also run as admin) can signal it. Next.js rewrites its own
# argv to "next-server (v15.4.8)", so we target the PID that holds :3002 via
# `fuser -TERM -k`; systemd's Restart=always brings it back with fresh memory.
# No sudo needed.
#
# Usage: bash scripts/check-css.sh        (idempotent, cron-friendly)
# Env overrides: BASE_URL, MIN_CSS_BYTES, RESTART=0 to only log, not restart.

set -u

BASE_URL="${BASE_URL:-http://localhost:3002}"
MIN_CSS_BYTES="${MIN_CSS_BYTES:-90000}"
RESTART="${RESTART:-1}"
LOG="${LOG:-/FYE/logs/check-css.log}"
LOCK="/tmp/fye-css-restart.lock"
COOLDOWN=60

# Absolute paths: cron runs with a minimal PATH.
CURL=/usr/bin/curl
GREP=/bin/grep
WC=/usr/bin/wc
DATE=/bin/date
FUSER=/usr/bin/fuser

ts() { "$DATE" -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { echo "$(ts) $*" >> "$LOG"; }

home=$("$CURL" -s --max-time 15 "$BASE_URL/") || {
  log "WARN homepage unreachable (server may already be restarting) — skipping"
  exit 0
}

css=$(printf '%s' "$home" | "$GREP" -oE '/_next/static/[^"]+\.css' | head -n1)
if [ -z "$css" ]; then
  log "WARN no CSS <link> found in homepage — skipping"
  exit 0
fi

out="/tmp/fye-css-check.out"
http_code=$("$CURL" -s --max-time 30 -o "$out" -w "%{http_code}" "$BASE_URL$css")
bytes=$("$WC" -c < "$out" 2>/dev/null || echo 0)

if [ "$http_code" != "200" ] || [ "$bytes" -lt "$MIN_CSS_BYTES" ]; then
  log "FAIL $css -> HTTP $http_code, $bytes bytes (min $MIN_CSS_BYTES)"
  if [ "$RESTART" = "1" ]; then
    if [ -f "$LOCK" ]; then
      last=$("$DATE" +%s -r "$LOCK" 2>/dev/null || echo 0)
      now=$("$DATE" +%s)
      if [ $((now - last)) -lt "$COOLDOWN" ]; then
        log "restart skipped (cooldown — last restart < ${COOLDOWN}s ago)"
        exit 2
      fi
    fi
    touch "$LOCK"
    log "restarting next start (fuser -TERM on :3002; systemd Restart=always will relaunch)"
    "$FUSER" -TERM -k 3002/tcp 2>/dev/null || true
  else
    log "restart disabled (RESTART=0)"
  fi
  exit 2
fi

log "OK $css -> $bytes bytes"
exit 0
