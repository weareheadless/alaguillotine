/**
 * Board Discovery Script
 *
 * Queries the Solana RPC for all $CHOP token holders, sorts by balance,
 * and writes the top 7 to the current active epoch in Appwrite.
 *
 * Usage: npx tsx scripts/discover-board.cjs
 *
 * Run this once per epoch transition (or on a cron).
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const { TOKEN_2022_PROGRAM_ID } = require("@solana/spl-token");
const Database = require("better-sqlite3");
const path = require("path");

// ─── Config ─────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const CHOP_MINT = process.env.NEXT_PUBLIC_CHOP_MINT || "DTPZyd2HnDmLQfCGkFJ7ajVbw77maUVT7QVLE7Ltpump";
const CHOP_DECIMALS = parseInt(process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6", 10);

const DB_PATH = path.join(__dirname, "..", "data", "local.db");

const BOARD_SIZE = 7;
const CHOP_UNIT = Math.pow(10, CHOP_DECIMALS);

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Discovering CHOP token holders...\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const mint = new PublicKey(CHOP_MINT);

  // Fetch all token accounts for this mint
  // Filter by Token 2022 program since CHOP is on pump.fun (Token 2022)
  console.log("Fetching token accounts (this may take a moment)...");

  const accounts = await connection.getProgramAccounts(
    new PublicKey(TOKEN_2022_PROGRAM_ID.toString()),
    {
      filters: [
        { memcmp: { offset: 0, bytes: mint.toBase58() } },
      ],
      encoding: "base64",
    }
  );

  console.log(`Found ${accounts.length} token accounts.\n`);

  // Parse balances
  const holders = [];

  for (const { pubkey, account } of accounts) {
    try {
      // Token account data layout:
      // bytes 0-31: mint
      // bytes 32-63: owner
      // bytes 64-71: amount (u64 LE)
      const data = Buffer.from(account.data);
      const owner = new PublicKey(data.slice(32, 64));
      const amount = data.readBigUInt64LE(64);

      // Skip zero-balance accounts
      if (amount > 0n) {
        holders.push({ wallet: owner.toBase58(), rawAmount: amount });
      }
    } catch {
      // Skip malformed accounts
    }
  }

  // Sort by balance descending
  holders.sort((a, b) => Number(b.rawAmount - a.rawAmount));

  // Top N
  const topHolders = holders.slice(0, BOARD_SIZE);

  console.log("🏆 Top 7 CHOP Holders:\n");
  for (let i = 0; i < topHolders.length; i++) {
    const h = topHolders[i];
    const balance = Number(h.rawAmount) / CHOP_UNIT;
    console.log(`  ${i + 1}. ${h.wallet.slice(0, 6)}...${h.wallet.slice(-4)} — ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} CHOP`);
  }

  // Write to local SQLite DB
  console.log("\nWriting to local DB...");

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Find current active epoch
  const active = db.prepare("SELECT * FROM epochs WHERE status = ? ORDER BY started_at DESC LIMIT 1").get("active");

  if (!active) {
    console.log("⚠️  No active epoch found. Run ensureEpoch first.");
    db.close();
    return;
  }

  const epoch = active;
  const boardMembers = topHolders.map((h, i) => ({
    wallet: h.wallet,
    balance: Number(h.rawAmount) / CHOP_UNIT,
    voted: false,
    vote: null,
    rank: i + 1,
  }));

  db.prepare("UPDATE epochs SET board_members = ? WHERE id = ?").run(JSON.stringify(boardMembers), epoch.id);

  console.log(`✅ Board members written to Epoch #${epoch.epoch_number}.`);
  db.close();
  console.log("Done.");
}

main().catch(console.error);
