"use client";

import { useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { useHateometer } from "@/components/Hateometer";
import { LineRow } from "@/components/LineRow";

/**
 * The line.
 *
 * A ranked card index, not a table: colour, movement, the charge, the latest
 * satirical note, and a door into the ledger behind every name.
 */
export default function NextInLinePage() {
  const { state: hate } = useHateometer();
  const [query, setQuery] = useState("");

  // Everyone is in the line: a chop resets the counter and sends the name back
  // up the queue, so there is no separate "chopped" list to fall off.
  const standing = hate.figures;
  const chops = hate.figures.reduce((n, f) => n + (f.timesChopped ?? 0), 0);
  const charges = hate.figures.reduce((n, f) => n + (f.ledgerCount ?? 0), 0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return standing;
    return standing.filter((f) =>
      `${f.name} ${f.role} ${f.country} ${f.reason}`.toLowerCase().includes(needle),
    );
  }, [standing, query]);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
        <section className="border-b-4 border-spiteCrimson pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
            the line
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-7xl">
            Next <span className="text-spiteCrimson">in line.</span>
          </h1>
          <p className="mt-5 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
            Ada ranks the people the record keeps returning to. The top of this
            line is promoted to the front page and executed — then the counter
            resets, a cross goes on the wall, and the name climbs back. Every
            score is Ada&apos;s reading of the week plus a bonus for the charges
            already on record. Every name opens its own ledger: the charges, the
            places, the years, the sources.
          </p>
        </section>

        <section className="grid gap-3 py-8 sm:grid-cols-3">
          <div className="border-2 border-black bg-sheetWhite p-4 text-canvasBlack">
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-spiteCrimson">
              in the line
            </p>
            <p className="mt-1 text-4xl font-black tracking-tighter">{standing.length}</p>
            <p className="mt-1 font-mono text-[9px] text-black/60">names still standing</p>
          </div>
          <div className="border-2 border-spiteCrimson bg-spiteCrimson p-4 text-sheetWhite">
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest">blade falls</p>
            <p className="mt-1 text-4xl font-black tracking-tighter">{chops}</p>
            <p className="mt-1 font-mono text-[9px] text-white/70">crosses on the wall</p>
          </div>
          <div className="border-2 border-hypeNeon bg-hypeNeon p-4 text-canvasBlack">
            <p className="font-mono text-[9px] font-bold uppercase tracking-widest">
              charges on record
            </p>
            <p className="mt-1 text-4xl font-black tracking-tighter">{charges}</p>
            <p className="mt-1 font-mono text-[9px] text-black/60">ledger entries, sourced</p>
          </div>
        </section>

        <p className="-mt-4 mb-4 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
          score = ada&apos;s reading of the week + up to 22 points for the ledger on record
        </p>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">
            {filtered.length} names · click any card for the record
          </p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a name or a country"
            className="border-2 border-chop-border bg-white/5 px-3 py-2 font-mono text-xs text-sheetWhite outline-none placeholder:text-chop-muted focus:border-hypeNeon"
          />
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="border-2 border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
              the line is empty — the machine is still reading
            </div>
          ) : (
            filtered.map((figure, i) => (
              <LineRow key={`${figure.name}-${figure.rank}`} figure={figure} promoted={i === 0} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
