/**
 * Background Watcher — runs on a 60s interval inside PM2.
 *
 * Responsibilities:
 *   1. Discover top CHOP holders → update current epoch's board
 *   2. Check if epoch message threshold is crossed → transition to voting
 *   3. Sync on-chain treasury balance to DB
 *   4. Check if voting period expired → auto-tally
 *
 * Usage:
 *   node scripts/watcher.cjs                    # foreground, interval
 *   pm2 start ecosystem.config.cjs              # managed by PM2
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const {
  CHOP_MINT, CHOP_MINT_ADDRESS, CHOP_UNIT,
  RPC_URL, TREASURY_ADDRESS, TOKEN_2022_PROGRAM_ID,
  fetchTreasuryBalance, getEpochThreshold,
} = require("./solana-helpers.cjs");

// ─── Local Config ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 300_000; // every 5 minutes
const BOARD_SIZE = 7;
const DB_PATH = path.join(__dirname, "..", "data", "local.db");
const VOTING_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 hours

// ─── Helpers ────────────────────────────────────────────────────────────────────

function openDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

// ─── Task 1: Discover Top CHOP Holders ────────────────────────────────────────

async function discoverBoard(db) {
  const active = db.prepare(
    "SELECT * FROM epochs WHERE status = ? OR status = ? ORDER BY started_at DESC LIMIT 1"
  ).get("active", "voting");

  if (!active) {
    log("[discover] No active or voting epoch found. Skipping board discovery.");
    return;
  }

  const connection = new Connection(RPC_URL, "confirmed");

  log("[discover] Fetching CHOP token holders from RPC...");

  const accounts = await connection.getProgramAccounts(
    new PublicKey(TOKEN_2022_PROGRAM_ID.toString()),
    {
      filters: [
        { memcmp: { offset: 0, bytes: CHOP_MINT.toBase58() } },
      ],
      encoding: "base64",
    }
  );

  const holders = [];

  for (const { pubkey, account } of accounts) {
    try {
      const data = Buffer.from(account.data);
      const owner = new PublicKey(data.slice(32, 64));
      const amount = data.readBigUInt64LE(64);
      if (amount > 0n) {
        holders.push({ wallet: owner.toBase58(), rawAmount: amount });
      }
    } catch {
      // skip malformed
    }
  }

  // Sort descending, take top N
  holders.sort((a, b) => Number(b.rawAmount - a.rawAmount));
  const topHolders = holders.slice(0, BOARD_SIZE);

  const boardMembers = topHolders.map((h, i) => {
    // Preserve existing votes if board member hasn't changed
    let existingVote = null;
    let existingVoted = false;
    try {
      const existing = JSON.parse(active.board_members || "[]");
      const found = existing.find(
        (m) => m.wallet.toLowerCase() === h.wallet.toLowerCase()
      );
      if (found) {
        existingVoted = found.voted || false;
        existingVote = found.vote || null;
      }
    } catch {}

    return {
      wallet: h.wallet,
      balance: Number(h.rawAmount) / CHOP_UNIT,
      voted: existingVoted,
      vote: existingVote,
      rank: i + 1,
    };
  });

  db.prepare("UPDATE epochs SET board_members = ? WHERE id = ?").run(
    JSON.stringify(boardMembers),
    active.id
  );

  log(`[discover] Board updated for Epoch #${active.epoch_number}: ${boardMembers.map(m => m.wallet.slice(0,4)+'..'+m.wallet.slice(-4)).join(", ")}`);
}

// ─── Task 2: Check Epoch Transition ──────────────────────────────────────────

async function checkEpochTransition(db) {
  const active = db.prepare(
    "SELECT * FROM epochs WHERE status = ? LIMIT 1"
  ).get("active");

  if (!active) {
    return; // nothing to transition
  }

  // Count visible (non-shadowbanned) messages
  const countRow = db.prepare(
    "SELECT COUNT(*) AS total FROM messages WHERE is_shadowbanned = 0"
  ).get();

  const msgCount = countRow.total;

  if (msgCount >= active.end_msg_count) {
    // Count unique senders in this epoch
    const uniqueRow = db.prepare(
      "SELECT COUNT(DISTINCT author_id) AS count FROM messages WHERE is_shadowbanned = 0 AND created_at >= ?"
    ).get(active.started_at);

    log(`[epoch] Epoch #${active.epoch_number} hit threshold (${msgCount} >= ${active.end_msg_count}). Transitioning to voting...`);

    db.prepare(`
      UPDATE epochs SET
        status = 'voting',
        voting_started_at = ?,
        unique_senders = ?
      WHERE id = ?
    `).run(new Date().toISOString(), uniqueRow.count || 0, active.id);

    log(`[epoch] Epoch #${active.epoch_number} is now VOTING. ${uniqueRow.count || 0} unique senders.`);
  }
}

// ─── Task 3: Sync Treasury Balance ───────────────────────────────────────────

async function syncTreasury(db) {
  const total = await fetchTreasuryBalance();

  if (total > 0) {
    const current = db.prepare(
      "SELECT * FROM epochs WHERE status IN ('active', 'voting') ORDER BY started_at DESC LIMIT 1"
    ).get();

    if (current) {
      db.prepare("UPDATE epochs SET treasury_amount = ? WHERE id = ?").run(Math.floor(total), current.id);
      log(`[treasury] Synced balance: ${Math.floor(total).toLocaleString()} CHOP`);
    }
  }
}


// ─── Task 4: Check Voting Period Expiry ──────────────────────────────────────

async function checkVotingExpiry(db) {
  const voting = db.prepare(
    "SELECT * FROM epochs WHERE status = ? LIMIT 1"
  ).get("voting");

  if (!voting) return;

  const votingStarted = new Date(voting.voting_started_at || voting.started_at).getTime();
  const elapsed = Date.now() - votingStarted;

  if (elapsed >= VOTING_PERIOD_MS) {
    log(`[vote] Voting period expired for Epoch #${voting.epoch_number}. Auto-tallying...`);
    await tallyEpoch(db, voting);
  }
}

// ─── Tally Votes (mirrors epoch.ts tallyEpoch) ──────────────────────────────

async function tallyEpoch(db, epoch) {
  if (epoch.status !== "voting") return;

  const votes = db.prepare(
    "SELECT * FROM votes WHERE epoch_id = ?"
  ).all(epoch.id);

  let burn, lottery, dev, board, revolution;

  if (votes.length === 0) {
    // No votes cast — default allocation
    burn = 20; lottery = 15; dev = 25; board = 20; revolution = 20;
    log(`[tally] No votes for Epoch #${epoch.epoch_number}. Using defaults.`);
  } else {
    // Average the votes
    const sumRates = votes.reduce(
      (acc, v) => ({
        burn: acc.burn + v.burn_rate,
        lottery: acc.lottery + v.lottery_rate,
        dev: acc.dev + v.dev_rate,
        board: acc.board + v.board_rate,
        revolution: acc.revolution + v.revolution_rate,
      }),
      { burn: 0, lottery: 0, dev: 0, board: 0, revolution: 0 }
    );

    const n = votes.length;
    const avg = {
      burn: sumRates.burn / n,
      lottery: sumRates.lottery / n,
      dev: sumRates.dev / n,
      board: sumRates.board / n,
      revolution: sumRates.revolution / n,
    };

    // Normalize to sum 100
    const total = avg.burn + avg.lottery + avg.dev + avg.board + avg.revolution;
    burn = Math.round(avg.burn / total * 100);
    lottery = Math.round(avg.lottery / total * 100);
    board = Math.round(avg.board / total * 100);
    revolution = Math.round(avg.revolution / total * 100);
    dev = 100 - burn - lottery - board - revolution;

    log(`[tally] Epoch #${epoch.epoch_number}: ${votes.length} votes averaged → B:${burn} L:${lottery} D:${dev} Bd:${board} R:${revolution}`);
  }

  // Determine hypothesis
  let hypothesisWinner;
  if (burn > 50) {
    hypothesisWinner = "H1"; // Plutocracy
  } else if (lottery + dev >= 30 && lottery >= 10 && dev >= 10) {
    hypothesisWinner = "H2"; // Class Traitor
  } else if (board > 50) {
    hypothesisWinner = "H4"; // Kleptocracy
  } else {
    hypothesisWinner = "H3"; // Deadlock
  }

  db.prepare(`
    UPDATE epochs SET
      status = 'executed',
      executed_at = ?,
      final_burn = ?,
      final_lottery = ?,
      final_dev = ?,
      final_board = ?,
      final_revolution = ?,
      hypothesis_winner = ?
    WHERE id = ?
  `).run(
    new Date().toISOString(),
    burn, lottery, dev, board, revolution,
    hypothesisWinner,
    epoch.id
  );

  log(`[tally] Epoch #${epoch.epoch_number} executed. Winner: ${hypothesisWinner}`);

  // ─── Create next epoch automatically ──────────────────────────────────
  const nextEpochNum = epoch.epoch_number + 1;
  const threshold = getEpochThreshold(nextEpochNum);

  db.prepare(`
    INSERT INTO epochs (id, epoch_number, status, start_msg_count, end_msg_count, board_members, treasury_amount, unique_senders, started_at, final_burn, final_lottery, final_dev, final_board, final_revolution, director_fees, created_at)
    VALUES (?, ?, 'active', ?, ?, '[]', 0, 0, ?, 0, 0, 0, 0, 0, '{}', ?)
  `).run(
    `epoch_${nextEpochNum}_${Date.now()}`,
    nextEpochNum,
    epoch.end_msg_count,
    epoch.end_msg_count + threshold,
    new Date().toISOString(),
    new Date().toISOString()
  );

  log(`[epoch] Epoch #${nextEpochNum} created (active). Threshold: ${threshold} messages.`);

  // Discover board for the new epoch immediately
  try {
    await discoverBoard(db);
  } catch (err) {
    log(`[epoch] Board discovery for new epoch failed: ${err.message}`);
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function runCycle() {
  const db = openDb();
  try {
    log("── Cycle start ──");
    await discoverBoard(db);
    await checkEpochTransition(db);
    await syncTreasury(db);
    await checkVotingExpiry(db);
    log("── Cycle complete ──");
  } catch (err) {
    log(`❌ Cycle error: ${err.message}`);
    console.error(err);
  } finally {
    db.close();
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  log("📡 CHOP Watcher started. Polling every ${POLL_INTERVAL_MS / 1000}s.");
  log(`   RPC: ${RPC_URL}`);
  log(`   Mint: ${CHOP_MINT_ADDRESS}`);
  log(`   Treasury: ${TREASURY_ADDRESS || "not configured"}`);
  log("");

  // Run immediately on start
  await runCycle();

  // Then on interval
  setInterval(runCycle, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal watcher error:", err);
  process.exit(1);
});
