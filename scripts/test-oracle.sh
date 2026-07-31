#\!/bin/bash
# Re-runs the Oracle script for testing.
# It deletes current proposals for the active epoch and forces the Oracle to run.

cd "$(dirname "$0")/.."

echo "Deleting current proposals for active epoch..."
EPOCH=$(sqlite3 data/local.db "SELECT epoch_number FROM epochs WHERE status = 'voting' ORDER BY epoch_number DESC LIMIT 1")

if [ -z "$EPOCH" ]; then
  echo "No active voting epoch found\!"
else
  echo "Deleting proposals and war room posts for epoch $EPOCH..."
  sqlite3 data/local.db "DELETE FROM war_room_posts WHERE proposal_id IN (SELECT id FROM oracle_proposals WHERE epoch_number=$EPOCH)"
  sqlite3 data/local.db "DELETE FROM oracle_proposals WHERE epoch_number=$EPOCH"
fi

echo "Triggering the AI Oracle..."
node scripts/oracle.cjs

echo "Done\! The new proposals are:"
if [ -n "$EPOCH" ]; then
  sqlite3 data/local.db "SELECT title FROM oracle_proposals WHERE epoch_number=$EPOCH AND is_none_option=0"
fi
