"use client";

import { NavBar } from "@/components/NavBar";
import { TraitorsLeaderboard } from "@/components/TraitorsLeaderboard";

export default function TraitorsPage() {
  return (
    <div className="relative min-h-screen bg-canvasBlack">
      {/* ─── Navigation ───────────────────────────────────────────────── */}
      <NavBar />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-8">
        {/* ─── Hero ────────────────────────────────────────────────────── */}
        <section className="py-8 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-sheetWhite sm:text-4xl">
            Class <span className="text-hypeNeon">Traitors</span>
          </h1>
          <p className="mt-2 text-sm font-mono text-chop-muted">
            // They paid real money to fund the machine. Bless their liquidity.
          </p>
          <div className="mx-auto mt-4 h-1 w-32 bg-gradient-to-r from-hypeNeon to-spiteCrimson" />
        </section>

        {/* ─── Leaderboard ────────────────────────────────────────────── */}
        <TraitorsLeaderboard />
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          FUCKYOUELON.NET // $CHOP PROTOCOL. All data is verified on-chain.
        </p>
      </footer>
    </div>
  );
}
