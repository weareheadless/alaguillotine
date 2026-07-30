"use client";

import { NavBar } from "@/components/NavBar";
import { BenefactorsLeaderboard } from "@/components/BenefactorsLeaderboard";

export default function BenefactorsPage() {
  return (
    <div className="relative min-h-screen bg-canvasBlack">
      {/* ─── Navigation ───────────────────────────────────────────────── */}
      <NavBar />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-8">
        {/* ─── Hero ────────────────────────────────────────────────────── */}
        <section className="py-8 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-sheetWhite sm:text-4xl">
            Capital <span className="text-hypeNeon">Defectors</span>
          </h1>
          <p className="mt-2 max-w-2xl mx-auto text-sm font-mono leading-relaxed text-chop-muted">
            // These renegades looked at their bags, looked at the revolution, and chose violence. Instead of hoarding wealth like the parasites on the Class Traitors page, they opened their wallets and funded the guillotine. Every $CHOP they paid goes straight to the treasury — keeping the servers on, the blade dropping, and Elon&apos;s mentions absolutely cooked. They defected from the idle capital class. They became something better. Salute these magnificent bastards.
          </p>
          <div className="mx-auto mt-4 h-1 w-32 bg-gradient-to-r from-hypeNeon via-yellow-400 to-hypeNeon animate-pulse" />
        </section>

        {/* ─── Leaderboard ────────────────────────────────────────────── */}
        <BenefactorsLeaderboard />
      </main>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          FUCKYOUELON.NET // $CHOP PROTOCOL. Funded by spite. Powered by rage. Kept online by these people.
        </p>
      </footer>
    </div>
  );
}
