"use client";

import { useCallback, useEffect, useState } from "react";
import { CHOP_ACCOUNT, CHOP_DECIMALS } from "@/lib/treasury";

/**
 * The fund's balances, read in the browser straight from a public node.
 *
 * Server-side reads are a dead end here: the official public RPC rejects
 * datacenter egress, and the free nodes that allow the balance call refuse the
 * indexed token lookup. A plain `getAccountInfo` on the fund's token account is
 * not indexed, so it works everywhere — and an honest "—" beats a number we
 * could not verify.
 */

const RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  for (const endpoint of RPCS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as {
        result?: T;
        error?: { message?: string };
      };
      if (data.result != null) return data.result;
    } catch {
      // next node
    }
  }
  return null;
}

/** Token-2022 account: mint (32) + owner (32) + amount (u64 LE). */
function decodeTokenAmount(base64: string): number {
  const binary = atob(base64);
  if (binary.length < 72) return 0;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const raw = new DataView(bytes.buffer).getBigUint64(64, true);
  return Number(raw) / 10 ** CHOP_DECIMALS;
}

const fmt = (value: number, digits: number) =>
  value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

interface Balances {
  sol: number | null;
  chop: number | null;
}

export function TreasuryStats({ wallet }: { wallet: string }) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [reading, setReading] = useState(true);

  const read = useCallback(async () => {
    setReading(true);
    const [solResult, tokenResult] = await Promise.all([
      rpc<{ value: number }>("getBalance", [wallet]),
      rpc<{
        value: { data?: [string, string]; owner?: string } | null;
      }>("getAccountInfo", [CHOP_ACCOUNT, { encoding: "base64" }]),
    ]);

    const sol = solResult == null ? null : Number(solResult.value) / 1e9;
    let chop: number | null = null;
    if (tokenResult != null) {
      const account = tokenResult.value;
      // No account is a real zero. A missing answer is not.
      chop = account?.data?.[0] ? decodeTokenAmount(account.data[0]) : 0;
    }

    setBalances({ sol, chop });
    setReading(false);
  }, [wallet]);

  useEffect(() => {
    read();
  }, [read]);

  const failed = balances != null && balances.sol == null && balances.chop == null;

  return (
    <div>
      <div className="mt-4 border-y border-chop-border">
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
            $CHOP in the fund
          </span>
          <span className="font-mono text-xl font-black tracking-tight text-sheetWhite">
            {balances?.chop == null ? "—" : fmt(balances.chop, 0)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-chop-border py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
            SOL in the fund
          </span>
          <span className="font-mono text-xl font-black tracking-tight text-sheetWhite">
            {balances?.sol == null ? "—" : fmt(balances.sol, 4)}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
        <span>
          {reading
            ? "reading the chain…"
            : failed
              ? "could not read the chain — no fake number"
              : "live from Solana"}
        </span>
        <button
          type="button"
          onClick={read}
          disabled={reading}
          className="underline decoration-chop-muted/40 hover:text-hypeNeon disabled:opacity-40"
        >
          refresh
        </button>
      </div>
    </div>
  );
}