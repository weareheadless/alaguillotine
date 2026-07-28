"use client";

import { NavBar } from "@/components/NavBar";
import { Leaderboard } from "@/components/Leaderboard";

export default function LeaderboardPage() {
  return (
    <div className="relative min-h-screen bg-canvasBlack">
      {/* ─── Navigation ───────────────────────────────────────────────── */}
      <NavBar />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-8">
        {/* ─── Hero ────────────────────────────────────────────────────── */}
        <section className="py-8 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-sheetWhite sm:text-4xl">
            Next in <span className="text-spiteCrimson">Line</span>
          </h1>
          <p className="mt-2 max-w-2xl mx-auto text-sm font-mono leading-relaxed text-chop-muted">
            // Who gets promoted to the basket next? The people are actively restructuring the executive board. Nominate the next corporate overlord, ketamine casualty, or venture capitalist who desperately needs to be separated from their earthly assets. The blade always resets, and we have a lot of wealth to redistribute.
          </p>
          <div className="mx-auto mt-4 h-1 w-32 bg-gradient-to-r from-spiteCrimson to-hypeNeon" />
        </section>

        {/* ─── Leaderboard ────────────────────────────────────────────── */}
        <Leaderboard />
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          FUCKYOUELON.NET // $CHOP PROTOCOL. All nominations are user-generated.
        </p>
      </footer>
    </div>
  );
}
