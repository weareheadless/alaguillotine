"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchLeaderboard } from "../app/actions/submit";
import type { NominationEntry } from "../lib/types";

const POLL_INTERVAL = 10_000; // 10s

export function Leaderboard() {
  const [entries, setEntries] = useState<NominationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const PER_PAGE = 20;

  const loadData = useCallback(async () => {
    try {
      const data = await fetchLeaderboard();
      setEntries(data);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
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
        <span className="text-lg">🔪</span>
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-sheetWhite">
          Most Wanted — Leaderboard
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
          <span className="flex-1">Target</span>
          <span className="w-24 text-right">Votes</span>
          <span className="w-28 text-right">Weight</span>
          <span className="w-28 text-right hidden sm:block">$CHOP Paid</span>
        </div>

        {/* Table body */}
        <div className="divide-y-2 divide-canvasBlack">
          {pageEntries.length === 0 ? (
            <div className="bg-sheetWhite px-3 py-12 text-center">
              <p className="text-sm uppercase tracking-wider text-chop-muted">
                // No nominations yet. Be the first to name a target.
              </p>
            </div>
          ) : (
            pageEntries.map((entry, idx) => {
              const globalIdx = safePage * PER_PAGE + idx + 1;
              const isDark = idx % 2 !== 0;
              const rowBg = isDark ? "bg-glitchGray text-sheetWhite" : "bg-sheetWhite text-canvasBlack";
              const isTop3 = globalIdx <= 3;

              return (
                <div key={entry.target_name} className={rowBg}>
                  <div className="flex items-center px-3 py-3">
                    {/* Rank */}
                    <span className={`w-10 flex-shrink-0 text-sm font-black ${
                      isTop3 ? "text-spiteCrimson" : "opacity-60"
                    }`}>
                      {globalIdx === 1 ? "☠️" : globalIdx === 2 ? "💀" : globalIdx === 3 ? "⚰️" : String(globalIdx).padStart(2, "0")}
                    </span>

                    {/* Target name */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold uppercase tracking-wider ${
                        isTop3 ? "text-spiteCrimson" : ""
                      }`}>
                        {entry.target_name}
                      </p>
                      {entry.total_paid > 0 && (
                        <p className="mt-0.5 text-[10px] opacity-60">
                          ◎{entry.total_paid.toFixed(2)} in paid nominations
                        </p>
                      )}
                    </div>

                    {/* Vote count */}
                    <span className="w-24 flex-shrink-0 text-right text-xs font-bold">
                      {entry.total_votes}
                    </span>

                    {/* Weight */}
                    <span className={`w-28 flex-shrink-0 text-right text-sm font-black ${
                      isTop3 ? "text-spiteCrimson" : ""
                    }`}>
                      {entry.total_weight.toLocaleString()}
                    </span>

                    {/* Paid amount */}
                    <span className="w-28 flex-shrink-0 text-right hidden sm:block">
                      {entry.total_paid > 0 ? (
                        <span className="inline-block border-2 border-hypeNeon bg-hypeNeon/10 px-2 py-0.5 text-xs font-bold text-hypeNeon">
                          ◎{entry.total_paid.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[10px] opacity-40">—</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Pagination ──────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t-4 border-canvasBlack bg-canvasBlack px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.2em]">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="cursor-pointer text-sheetWhite transition-colors hover:text-hypeNeon disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [ PREV ]
            </button>
            <span className="text-chop-muted">
              PAGE {String(safePage + 1).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="cursor-pointer text-sheetWhite transition-colors hover:text-hypeNeon disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [ NEXT ]
            </button>
          </div>
        )}
      </div>

      {/* ─── Legend ────────────────────────────────────────────────────── */}
      <div className="mt-4 border-2 border-dashed border-glitchGray p-3 text-[10px] text-chop-muted">
        <p className="font-bold uppercase tracking-wider">// How It Works</p>
        <ul className="mt-1 space-y-0.5">
          <li>• Each message can nominate one target for the guillotine</li>
          <li>• Free users: <strong className="text-sheetWhite">1 vote weight</strong></li>
          <li>• Paid users: <strong className="text-sheetWhite">weight = ◎amount × 100</strong> (&ge;1)</li>
          <li>• The leaderboard updates in real-time as new nominations come in</li>
          <li>• Top 3 most nominated wear the crown of shame ☠️</li>
        </ul>
      </div>
    </section>
  );
}
