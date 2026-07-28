"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchTraitors } from "../app/actions/submit";
import type { TraitorEntry } from "../lib/types";

const POLL_INTERVAL = 10_000; // 10s

export function TraitorsLeaderboard() {
  const [entries, setEntries] = useState<TraitorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const PER_PAGE = 20;

  const loadData = useCallback(async () => {
    try {
      const data = await fetchTraitors();
      setEntries(data);
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
          <span className="w-36 text-right text-hypeNeon">$CHOP Held</span>
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
                      <p className="text-sm font-bold font-mono tracking-wider truncate">
                        {entry.author_name.slice(0, 8)}...{entry.author_name.slice(-6)}
                      </p>
                      <p className="text-[10px] text-chop-muted mt-0.5">
                        Bought in. Did nothing. Peak class betrayal.
                      </p>
                    </div>

                    {/* CHOP Balance */}
                    <div className="w-36 flex-shrink-0 text-right">
                      <span className="text-xs font-mono font-bold text-hypeNeon">
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
