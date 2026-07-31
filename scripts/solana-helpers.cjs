/**
 * Shared Solana/CHOP helpers for CommonJS scripts (watcher.cjs, oracle.cjs).
 *
 * Mirrors src/lib/solana.ts — keep constants and logic in sync.
 * All blockchain interactions for scripts go through THIS module.
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const { TOKEN_2022_PROGRAM_ID } = require("@solana/spl-token");

// ─── Constants (mirrors src/lib/solana.ts) ────────────────────────────────────

const CHOP_MINT_ADDRESS = process.env.NEXT_PUBLIC_CHOP_MINT || "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump";
const CHOP_MINT = new PublicKey(CHOP_MINT_ADDRESS);
const CHOP_DECIMALS = parseInt(process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6", 10);
const CHOP_UNIT = Math.pow(10, CHOP_DECIMALS);
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET || "";

// ─── Treasury Balance ────────────────────────────────────────────────────────

/** Fetch the live on-chain CHOP balance of the treasury wallet. */
async function fetchTreasuryBalance(connection) {
  if (!TREASURY_ADDRESS) return 0;

  const conn = connection || new Connection(RPC_URL);
  const treasury = new PublicKey(TREASURY_ADDRESS);

  try {
    const accounts = await conn.getTokenAccountsByOwner(treasury, { mint: CHOP_MINT });

    let total = 0;
    for (const { account } of accounts.value) {
      const data = account.data;
      const amount = Number(data.readBigUInt64LE(64));
      total += amount / CHOP_UNIT;
    }
    return total;
  } catch {
    return 0;
  }
}

// ─── Epoch Threshold ─────────────────────────────────────────────────────────

/** Dynamic epoch threshold — matches src/lib/types.ts */
function getEpochThreshold(epochNumber) {
  return Math.floor(1000 * Math.pow(1.5, epochNumber - 1));
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  CHOP_MINT,
  CHOP_MINT_ADDRESS,
  CHOP_DECIMALS,
  CHOP_UNIT,
  RPC_URL,
  TREASURY_ADDRESS,
  TOKEN_2022_PROGRAM_ID,

  // Helpers
  fetchTreasuryBalance,
  getEpochThreshold,
};
