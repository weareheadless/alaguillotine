"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchTraitors } from "../app/actions/submit";
import type { TraitorEntry } from "../lib/types";

const POLL_INTERVAL = 10_000; // 10s

const INSULT_LINES = [
  "Bought in. Did nothing. Peak class betrayal.",
  "Holding a bag and a prayer. Contributed zero.",
  "The human equivalent of a passive index fund. Worthless.",
  "Sat on their CHOP like it's a La-Z-Boy. Lazy parasite.",
  "Peak freeloader energy. Embarrassing to witness.",
  "All bag, no bite. Coward.",
  "Thinks HODLing makes them a revolutionary. It doesn't.",
  "Dead weight with a wallet. The worst kind of investor.",
  "Zero messages. Zero votes. Zero spine.",
  "Bought the revolution like an NFT. Just here to flip.",
  "The only thing they've exercised is their right to do nothing.",
  "Capital without conviction. Money without meaning.",
  "A warm body with cold hands. Let go of the bag or do something.",
  "Furniture with a Solana address. Useless.",
  "This wallet has never known the touch of a Submit button.",
];

const getRandomInsult = () => INSULT_LINES[Math.floor(Math.random() * INSULT_LINES.length)];

export function TraitorsLeaderboard() {
  const [entries, setEntries] = useState<TraitorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [insultMap, setInsultMap] = useState<Record<string, string>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const PER_PAGE = 20;

  const loadData = useCallback(async () => {
    try {
      const data = await fetchTraitors();
      setEntries(data);
      setInsultMap((prev) => {
        const next = { ...prev };
        for (const e of data) {
          if (!next[e.author_name]) {
            next[e.author_name] = getRandomInsult();
          }
        }
        return next;
      });
    } catch (err) {
      console.error("Traitors fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadData, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = entries.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-sm border-2 border-spiteCrimson border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="w-full">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2 border-b-4 border-black pb-2">
        <span className="text-lg">🐀</span>
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-sheetWhite">
          On-Chain Holders
        </h2>
        <span className="border-2 border-black bg-canvasBlack px-2 py-0.5 text-[10px] font-bold text-hypeNeon">
          {entries.length}
        </span>
      </div>

      {/* ─── Leaderboard Table ─────────────────────────────────────────── */}
      <div className="overflow-hidden border-4 border-canvasBlack shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Table header */}
        <div className="flex border-b-4 border-canvasBlack bg-canvasBlack px-3 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-sheetWhite">
          <span className="w-10">#</span>
          <span className="flex-1">Wallet</span>
          <span className="w-20 text-right hidden sm:block">Free Msgs</span>
          <span className="w-36 text-right text-spiteCrimson">$CHOP Leeching</span>
        </div>

        {/* Table body */}
        <div className="divide-y-2 divide-canvasBlack">
          {pageEntries.length === 0 ? (
            <div className="bg-sheetWhite px-3 py-12 text-center">
              <p className="text-sm uppercase tracking-wider text-chop-muted">
                // No holders discovered yet. Run the discovery script.
              </p>
            </div>
          ) : (
            pageEntries.map((entry, idx) => {
              const globalIdx = safePage * PER_PAGE + idx + 1;
              const isDark = idx % 2 !== 0;
              const rowBg = isDark ? "bg-glitchGray text-sheetWhite" : "bg-sheetWhite text-canvasBlack";
              const isTop3 = globalIdx <= 3;

              return (
                <div key={entry.author_name} className={rowBg}>
                  <div className="flex items-center px-3 py-3">
                    {/* Rank */}
                    <span className={`w-10 flex-shrink-0 text-sm font-black ${
                      isTop3 ? "text-spiteCrimson" : "opacity-60"
                    }`}>
                      {globalIdx === 1 ? "🐀" : globalIdx === 2 ? "🐁" : globalIdx === 3 ? "🐭" : String(globalIdx).padStart(2, "0")}
                    </span>

                    {/* Wallet */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold font-mono tracking-wider break-all">
                        {entry.author_name}
                      </p>
                      <p className="text-[10px] text-chop-muted mt-0.5 italic">
                        &ldquo;{insultMap[entry.author_name] || getRandomInsult()}&rdquo;
                      </p>
                    </div>

                    {/* Free Message Count */}
                    <div className="w-20 flex-shrink-0 text-right hidden sm:block">
                      <span className="text-xs font-mono font-bold opacity-60">
                        {entry.total_messages > 0 ? entry.total_messages : "—"}
                      </span>
                    </div>

                    {/* CHOP Balance */}
                    <div className="w-36 flex-shrink-0 text-right">
                      <span className="text-xs font-mono font-bold text-spiteCrimson">
                        {entry.total_paid.toLocaleString(undefined, { maximumFractionDigits: 0 })} CHOP
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between font-mono text-xs uppercase tracking-wider">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="border-2 border-black bg-sheetWhite px-4 py-1 font-bold text-canvasBlack disabled:opacity-30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-canvasBlack hover:text-sheetWhite hover:border-sheetWhite transition-all disabled:hover:bg-sheetWhite disabled:hover:text-canvasBlack disabled:hover:border-black"
          >
            ← Prev
          </button>
          <span className="text-sheetWhite font-bold">
            Page {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="border-2 border-black bg-sheetWhite px-4 py-1 font-bold text-canvasBlack disabled:opacity-30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-canvasBlack hover:text-sheetWhite hover:border-sheetWhite transition-all disabled:hover:bg-sheetWhite disabled:hover:text-canvasBlack disabled:hover:border-black"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
