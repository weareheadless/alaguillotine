#\!/bin/bash
# Re-runs the Oracle script for testing.
# It deletes current proposals for the active epoch and forces the Oracle to run.

cd "$(dirname "$0")/.."

echo "Deleting current proposals for active epoch..."
EPOCH=$(sqlite3 data/local.db "SELECT epoch_number FROM epochs WHERE status = 'voting' ORDER BY epoch_number DESC LIMIT 1")

if [ -z "$EPOCH" ]; then
  echo "No active voting epoch found\!"
else
  echo "Deleting proposals for epoch $EPOCH..."
  sqlite3 data/local.db "DELETE FROM oracle_proposals WHERE epoch_number=$EPOCH"
fi

echo "Triggering the AI Oracle..."
# Using the vscode bundled node since system node is too old for better-sqlite3 native bindings
/home/admin/.vscode-server/cli/servers/Stable-8a7abeba6e03ea3af87bfbce9a1b7e48fed567b8/server/node scripts/oracle.cjs

echo "Done\! The new proposals are:"
if [ -n "$EPOCH" ]; then
  sqlite3 data/local.db "SELECT title FROM oracle_proposals WHERE epoch_number=$EPOCH AND is_none_option=0"
fi
