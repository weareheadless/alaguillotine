#!/bin/bash
# Forces epoch transition + oracle run — for development/testing.
# Usage: bash scripts/trigger-oracle.sh

set -e
cd "$(dirname "$0")/.."

NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

echo "=== Trigger Oracle ==="

# ─── Step 1: Find or create a voting epoch ────────────────────────────────────

# Priority: active → transition it. voting (any) → reuse it. none → create new.

ACTIVE=$(sqlite3 data/local.db "SELECT epoch_number FROM epochs WHERE status='active' ORDER BY epoch_number DESC LIMIT 1")
VOTING=$(sqlite3 data/local.db "SELECT epoch_number FROM epochs WHERE status='voting' ORDER BY epoch_number DESC LIMIT 1")

if [ -n "$ACTIVE" ]; then
  # Transition active epoch to voting
  echo "Transitioning epoch $ACTIVE from active → voting..."
  sqlite3 data/local.db "UPDATE epochs SET status='voting', voting_started_at='$NOW' WHERE epoch_number=$ACTIVE AND status='active'"
  EPOCH=$ACTIVE
elif [ -n "$VOTING" ]; then
  # Reuse existing voting epoch — just regenerate its proposals
  echo "Reusing existing voting epoch $VOTING..."
  EPOCH=$VOTING
else
  # No epoch exists at all — create one
  echo "No epoch exists — creating new one..."
  LAST_NUM=$(sqlite3 data/local.db "SELECT COALESCE(MAX(epoch_number), 0) FROM epochs")
  NEW_NUM=$((LAST_NUM + 1))

  MSG_COUNT=$(sqlite3 data/local.db "SELECT COUNT(*) FROM messages WHERE is_shadowbanned=0")
  THRESHOLD=$(node -e "console.log(Math.floor(1000 * Math.pow(1.5, $NEW_NUM - 1)))")
  END_COUNT=$((MSG_COUNT + THRESHOLD))

  ID="epoch-${NEW_NUM}-$(date +%s)"
  sqlite3 data/local.db "INSERT INTO epochs (id, epoch_number, status, start_msg_count, end_msg_count, treasury_amount, unique_senders, started_at, voting_started_at, created_at) VALUES ('$ID', $NEW_NUM, 'voting', $MSG_COUNT, $END_COUNT, 0, 0, '$NOW', '$NOW', '$NOW')"
  echo "Created epoch $NEW_NUM (threshold: $THRESHOLD messages, starts at $MSG_COUNT → ends at $END_COUNT)"
  EPOCH=$NEW_NUM
fi

# ─── Step 2: Clean stale proposals ─────────────────────────────────────────────

echo "Cleaning stale proposals for epoch $EPOCH..."
sqlite3 data/local.db "DELETE FROM war_room_posts WHERE proposal_id IN (SELECT id FROM oracle_proposals WHERE epoch_number=$EPOCH)"
sqlite3 data/local.db "DELETE FROM oracle_proposals WHERE epoch_number=$EPOCH"

# ─── Step 3: Run the oracle ────────────────────────────────────────────────────

echo "Running AI Oracle..."
node scripts/oracle.cjs

# ─── Step 4: Show results ──────────────────────────────────────────────────────

echo ""
echo "=== Proposals for epoch $EPOCH ==="
sqlite3 -header -column data/local.db "SELECT title, burn_pct || '%' as burn, bounty_pct || '%' as bounty, infra_pct || '%' as infra, marketing_pct || '%' as marketing FROM oracle_proposals WHERE epoch_number=$EPOCH AND is_none_option=0"
