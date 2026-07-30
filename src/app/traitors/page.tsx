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
            Class <span className="text-spiteCrimson">Traitors</span>
          </h1>
          <p className="mt-2 max-w-2xl mx-auto text-sm font-mono leading-relaxed text-chop-muted">
            // Welcome to the digital cuck shed. These spineless bagholders bought $CHOP and just sat on it, hoping to passively profit off the revolution like they inherited a South African emerald mine. No posts. No paid messages. No participation — just pure, useless idle capital waiting for someone else to do the work. You&apos;re the exact type of parasite who pre-orders a rusting Cybertruck and thinks a billionaire on a ketamine bender is actually going to invite you to his Mars colony. Bought the rope but too cowardly to pull the lever. Zero voting power. Zero respect. Enjoy the public humiliation, you absolute leeches.
          </p>
          <p className="mt-3 max-w-2xl mx-auto text-[11px] font-mono font-bold leading-relaxed text-spiteCrimson uppercase tracking-wider">
            ⚠️ Notice: If you PAID for a message, you&apos;re not on this list. You graduated. You&apos;re a Capital Defector now. This list is exclusively for freeloaders.
          </p>
          <div className="mx-auto mt-4 h-1 w-32 bg-gradient-to-r from-hypeNeon to-spiteCrimson" />
        </section>

        {/* ─── Leaderboard ────────────────────────────────────────────── */}
        <TraitorsLeaderboard />
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          FUCKYOUELON.NET // $CHOP PROTOCOL. The Board has no power. This is deliberate.
        </p>
      </footer>
    </div>
  );
}
