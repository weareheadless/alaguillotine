/**
 * Single source of truth for all Solana / CHOP token interactions.
 *
 * Every on-chain operation (burn, balance check, token account lookup)
 * is defined HERE and used by the rest of the codebase. No duplicate
 * RPC calls, no copy-pasted constants.
 *
 * Used by:
 *   - submit.ts      → burnForFreeMessage()
 *   - epoch.ts       → getTreasuryBalance(), getBurnPerMessage()
 *   - metrics.ts     → fetchSidebarMetrics()
 *   - watcher.cjs    → treasury sync
 *   - oracle.cjs     → treasury balance for AI input
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createBurnInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

// ─── Constants ──────────────────────────────────────────────────────────────────

/** CHOP token mint address (pump.fun = Token 2022) */
export const CHOP_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_CHOP_MINT || "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump"
);

/** CHOP token decimals */
export const CHOP_DECIMALS = parseInt(process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6", 10);

/** 1 CHOP in raw units (10^decimals) */
export const CHOP_UNIT = Math.pow(10, CHOP_DECIMALS);

/** Treasury wallet public address */
export function getTreasuryAddress(): PublicKey | null {
  const addr = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET;
  return addr ? new PublicKey(addr) : null;
}

/** Default Solana RPC URL */
export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

// ─── Treasury Wallet ────────────────────────────────────────────────────────────

/** Load the treasury wallet keypair from env var (base58-encoded secret key). */
export function getTreasuryWallet(): Keypair | null {
  const secret = process.env.CHOP_TREASURY_SECRET_KEY;
  if (!secret) return null;
  try {
    const decoded = bs58.decode(secret);
    return Keypair.fromSecretKey(decoded);
  } catch {
    console.error("[CHOP] Failed to decode treasury secret key");
    return null;
  }
}

// ─── CHOP Token Account ─────────────────────────────────────────────────────────

/**
 * Get (or create) the treasury's Associated Token Account for CHOP.
 * CHOP is a pump.fun token → Token 2022 program.
 */
export async function getCHOPTreasuryAccount(connection: Connection): Promise<{
  address: PublicKey;
  balance: number; // raw units (BigInt-compatible via Number)
} | null> {
  const treasury = getTreasuryWallet();
  const treasuryAddr = getTreasuryAddress();
  if (!treasury || !treasuryAddr) return null;

  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    CHOP_MINT,
    treasuryAddr,
    false,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  return {
    address: ata.address,
    balance: Number(ata.amount),
  };
}

// ─── Burn CHOP ──────────────────────────────────────────────────────────────────

/**
 * Burn CHOP tokens from the treasury.
 *
 * Uses the SPL Token 2022 Burn instruction — reduces total supply.
 * This is the ONLY function that performs on-chain burns.
 *
 * @param connection  Solana RPC connection
 * @param amountRaw   Amount in raw units (CHOP × 10^decimals)
 * @returns           Transaction signature, or null if burn was skipped
 */
export async function burnCHOP(
  connection: Connection,
  amountRaw: bigint
): Promise<string | null> {
  const treasury = getTreasuryWallet();
  if (!treasury) {
    console.warn("[CHOP] No treasury wallet — skipping burn");
    return null;
  }

  if (amountRaw <= BigInt(0)) return null;

  const acct = await getCHOPTreasuryAccount(connection);
  if (!acct) return null;

  if (acct.balance < Number(amountRaw)) {
    console.warn(
      `[CHOP] Balance ${(acct.balance / CHOP_UNIT).toFixed(2)} < need ${(Number(amountRaw) / CHOP_UNIT).toFixed(6)} — skipping burn`
    );
    return null;
  }

  const ix = createBurnInstruction(
    acct.address,
    CHOP_MINT,
    treasury.publicKey,
    amountRaw,
    [],
    TOKEN_2022_PROGRAM_ID,
  );

  const { sendAndConfirmTransaction, Transaction } = await import("@solana/web3.js");
  const tx = new Transaction().add(ix);

  const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
  console.log(`[CHOP] Burned ${(Number(amountRaw) / CHOP_UNIT).toFixed(6)} CHOP — tx: ${sig}`);
  return sig;
}

// ─── Treasury Balance ───────────────────────────────────────────────────────────

/** Fetch the live on-chain CHOP balance of the treasury wallet. */
export async function fetchTreasuryBalance(connection?: Connection): Promise<number> {
  const treasuryAddr = getTreasuryAddress();
  if (!treasuryAddr) return 0;

  const conn = connection || new Connection(getRpcUrl());

  try {
    const accounts = await conn.getTokenAccountsByOwner(treasuryAddr, { mint: CHOP_MINT });

    let total = 0;
    for (const { account } of accounts.value) {
      const data = account.data;
      // Token account data layout: mint(32) + owner(32) + amount(8)
      const amount = Number(data.readBigUInt64LE(64));
      total += amount / CHOP_UNIT;
    }

    return total;
  } catch {
    return 0;
  }
}

// ─── Payment Verification ───────────────────────────────────────────────────────

/**
 * Verify an incoming CHOP payment transaction on-chain.
 *
 * Two approaches:
 * 1. Parsed instructions (jsonParsed) — clean, may not parse Token-2022
 * 2. pre/postTokenBalances net change — always works, runtime-enforced
 *
 * @returns The transferred amount in CHOP and the sender address.
 * @throws  If the transaction is invalid, not found, or contains no CHOP transfer to treasury.
 */
export async function verifyChopPayment(
  txSignature: string,
): Promise<{ amount: number; sender: string }> {
  const receiverStr = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET;
  if (!receiverStr) throw new Error("Treasury wallet not configured.");

  const rpcUrl = getRpcUrl();
  const CHOP_MINT_STR = CHOP_MINT.toBase58();

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getTransaction",
      params: [txSignature, {
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      }],
    }),
  });

  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  const tx = body.result;
  if (!tx) throw new Error("Tx not found on-chain yet.");
  if (tx.meta?.err) throw new Error(`Tx failed: ${JSON.stringify(tx.meta.err)}`);

  // Approach 1: parsed instructions
  const ixs: any[] = tx.transaction?.message?.instructions ?? [];
  for (const ix of ixs) {
    const info = ix.parsed?.info;
    if (!info) continue;
    const type = ix.parsed?.type;
    if (type !== "transfer" && type !== "transferChecked") continue;
    if (info.mint !== CHOP_MINT_STR) continue;
    if (info.destination !== receiverStr) continue;

    const amount = info.tokenAmount?.uiAmount ?? Number(info.amount ?? 0) / 1_000_000;
    const sender = info.authority || info.source || "";
    return { amount, sender };
  }

  // Approach 2: balance diff fallback
  const preBals: any[] = tx.meta?.preTokenBalances ?? [];
  const postBals: any[] = tx.meta?.postTokenBalances ?? [];
  const preMap = new Map<number, number>();
  for (const b of preBals) {
    if (b.mint === CHOP_MINT_STR && b.owner === receiverStr) {
      preMap.set(b.accountIndex, Number(b.uiTokenAmount?.uiAmount ?? 0));
    }
  }
  let net = 0;
  for (const b of postBals) {
    if (b.mint === CHOP_MINT_STR && b.owner === receiverStr) {
      net += Number(b.uiTokenAmount?.uiAmount ?? 0) - (preMap.get(b.accountIndex) ?? 0);
    }
  }
  if (net > 0) return { amount: net, sender: "" };

  throw new Error(`No CHOP transfer to treasury.`);
}
