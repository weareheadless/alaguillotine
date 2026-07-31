#!/bin/bash
# Restart Next.js app without rebuilding
# Usage: bash scripts/restart.sh

set -e
cd /FYE

echo "=== Restarting Next.js via systemd ==="
sudo systemctl restart fuckyouelon.service

sleep 3
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/)
if [ "$HTTP" = "200" ]; then
  echo "✓ App running (HTTP $HTTP)"
else
  echo "✗ App returned HTTP $HTTP — check: sudo journalctl -u fuckyouelon -n 20"
fi
