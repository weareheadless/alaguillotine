"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchBenefactors } from "../app/actions/submit";
import type { BenefactorEntry } from "../lib/types";

const POLL_INTERVAL = 10_000; // 10s

const PRAISE_LINES = [
  "Dropped a bag and asked for nothing in return. Chad behavior.",
  "Literally paying to shitpost. This is what freedom looks like.",
  "Funded the guillotine. The blade thanks you.",
  "Put their money where their mouth is. Rare W.",
  "Bought premium spite. Elite-tier hater.",
  "Single-handedly keeping the servers on. MVP.",
  "This wallet fucks. Hard.",
  "Proof that not all capital is evil — just most of it.",
  "Donated to the revolution like it's a charity. Based.",
  "Paid to call Elon a clown. Money well spent.",
  "The treasury salutes this absolute unit.",
  "Capital defector. Come to the right side of history.",
  "Actually putting skin in the game. Respect.",
  "Bought a ticket to the revolution. Front row.",
  "This is what 'voting with your wallet' actually means.",
];

const getRandomPraise = () => PRAISE_LINES[Math.floor(Math.random() * PRAISE_LINES.length)];

export function BenefactorsLeaderboard() {
  const [entries, setEntries] = useState<BenefactorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [praiseMap, setPraiseMap] = useState<Record<string, string>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const PER_PAGE = 20;

  const loadData = useCallback(async () => {
    try {
      const data = await fetchBenefactors();
      setEntries(data);
      // Assign random praise lines to new entries
      setPraiseMap((prev) => {
        const next = { ...prev };
        for (const e of data) {
          if (!next[e.author_name]) {
            next[e.author_name] = getRandomPraise();
          }
        }
        return next;
      });
    } catch (err) {
      console.error("Benefactors fetch error:", err);
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

  const totalRaised = entries.reduce((sum, e) => sum + e.total_paid, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-sm border-3 border-hypeNeon border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="w-full">
      {/* ─── War Chest Ticker ──────────────────────────────────────────── */}
      <div className="mb-4 overflow-hidden border-4 border-hypeNeon bg-canvasBlack p-3 shadow-[6px_6px_0px_0px_rgba(0,255,65,0.3)]">
        <div className="flex items-center gap-3">
          <span className="animate-pulse text-2xl">💰</span>
          <div className="flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-hypeNeon">
              War Chest Funded By
            </p>
            <p className="text-xl font-black text-sheetWhite">
              {entries.length} <span className="text-hypeNeon">Revolution Bankrollers</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-chop-muted">
              Total Raised
            </p>
            <p className="text-lg font-black text-hypeNeon">
              {totalRaised.toLocaleString()} <span className="text-sm">CHOP</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2 border-b-4 border-hypeNeon pb-2">
        <span className="text-lg">🏦</span>
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-sheetWhite">
          Capital Defectors
        </h2>
        <span className="border-2 border-hypeNeon bg-hypeNeon/10 px-2 py-0.5 text-[10px] font-bold text-hypeNeon">
          {entries.length}
        </span>
      </div>

      {/* ─── Leaderboard Table ─────────────────────────────────────────── */}
      <div className="overflow-hidden border-4 border-canvasBlack shadow-[8px_8px_0px_0px_rgba(0,255,65,0.5)]">
        {/* Table header */}
        <div className="flex border-b-4 border-canvasBlack bg-canvasBlack px-3 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-sheetWhite">
          <span className="w-10">#</span>
          <span className="flex-1">Revolution Bankroller</span>
          <span className="w-28 text-right hidden sm:block text-hypeNeon">Messages</span>
          <span className="w-36 text-right text-hypeNeon">$CHOP Contributed</span>
        </div>

        {/* Table body */}
        <div className="divide-y-2 divide-canvasBlack">
          {pageEntries.length === 0 ? (
            <div className="bg-sheetWhite px-3 py-12 text-center">
              <p className="text-sm uppercase tracking-wider text-chop-muted">
                // No one has funded the revolution yet. Be the first to drop a bag.
              </p>
            </div>
          ) : (
            pageEntries.map((entry, idx) => {
              const globalIdx = safePage * PER_PAGE + idx + 1;
              const isDark = idx % 2 !== 0;
              const rowBg = isDark
                ? "bg-glitchGray text-sheetWhite"
                : "bg-sheetWhite text-canvasBlack";
              const isTop3 = globalIdx <= 3;

              return (
                <div key={entry.author_name} className={rowBg}>
                  <div className="flex items-center px-3 py-3">
                    {/* Rank */}
                    <span
                      className={`w-10 flex-shrink-0 text-sm font-black ${
                        isTop3 ? "text-hypeNeon" : "opacity-60"
                      }`}
                    >
                      {globalIdx === 1
                        ? "👑"
                        : globalIdx === 2
                          ? "💎"
                          : globalIdx === 3
                            ? "🏆"
                            : String(globalIdx).padStart(2, "0")}
                    </span>

                    {/* Wallet */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold font-mono tracking-wider break-all">
                        {entry.author_name}
                      </p>
                      <p className="text-[10px] text-chop-muted mt-0.5 italic">
                        &ldquo;{praiseMap[entry.author_name] || getRandomPraise()}&rdquo;
                      </p>
                    </div>

                    {/* Message Count */}
                    <div className="w-28 flex-shrink-0 text-right hidden sm:block">
                      <span className="text-xs font-mono font-bold">
                        {entry.message_count} {entry.message_count === 1 ? "msg" : "msgs"}
                      </span>
                    </div>

                    {/* CHOP Contributed */}
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
            className="border-2 border-hypeNeon bg-sheetWhite px-4 py-1 font-bold text-canvasBlack disabled:opacity-30 shadow-[4px_4px_0px_0px_rgba(0,255,65,0.5)] hover:bg-canvasBlack hover:text-hypeNeon hover:border-hypeNeon transition-all disabled:hover:bg-sheetWhite disabled:hover:text-canvasBlack disabled:hover:border-hypeNeon"
          >
            ← Prev
          </button>
          <span className="text-sheetWhite font-bold">
            Page {safePage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="border-2 border-hypeNeon bg-sheetWhite px-4 py-1 font-bold text-canvasBlack disabled:opacity-30 shadow-[4px_4px_0px_0px_rgba(0,255,65,0.5)] hover:bg-canvasBlack hover:text-hypeNeon hover:border-hypeNeon transition-all disabled:hover:bg-sheetWhite disabled:hover:text-canvasBlack disabled:hover:border-hypeNeon"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
