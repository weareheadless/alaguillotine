"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { useHateometer } from "@/components/Hateometer";
import { ChargesRail } from "@/components/ChargesRail";
import { LineRow } from "@/components/LineRow";
import { COOLDOWN_DAYS } from "@/lib/evidence";
import { useDrawer } from "@/components/drawers";

/**
 * The line.
 *
 * A ranked card index, not a table: colour, movement, the charge, the latest
 * satirical note, and a door into the ledger behind every name.
 */
export default function NextInLinePage() {
  const { state: hate } = useHateometer();
  const { show } = useDrawer();
  const [query, setQuery] = useState("");

  // Everyone is in the line: a chop is a tally, the record stays, and the name
  // sits out a cooldown. There is no separate "chopped" list to fall off.
  const standing = hate.figures;
  const chops = hate.figures.reduce((n, f) => n + (f.timesChopped ?? 0), 0);
  // The whole ledger, not the queue's share: this card counts the record.
  const charges =
    hate.ledgerTotal ?? hate.figures.reduce((n, f) => n + (f.ledgerCount ?? 0), 0);

  // A ranked list of names with no charge reads as "least harmful", which is
  // the opposite of what a zero means: nothing proven inside the window. They
  // keep their pages and their record; they leave the ranking.
  const charged = useMemo(() => standing.filter((f) => f.score > 0), [standing]);
  const uncharged = useMemo(() => standing.filter((f) => f.score <= 0), [standing]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return charged;
    return charged.filter((f) =>
      `${f.name} ${f.role} ${f.country} ${f.reason}`.toLowerCase().includes(needle),
    );
  }, [charged, query]);

  // Where the cooling block starts. The line is sorted so names serving their
  // three days sit at the foot of it; the divider is what tells a reader that
  // the numbers did not fall, the slot did.
  const coolingFrom = useMemo(() => {
    const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    return filtered.findIndex((f) => {
      const at = Date.parse(String(f.lastChoppedAt ?? ""));
      return Number.isFinite(at) && at >= cutoff;
    });
  }, [filtered]);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
        <section className="border-b-4 border-spiteCrimson pb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
            the line
          </p>
          <h1 className="mt-2 text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em] sm:text-5xl">
            Next <span className="text-spiteCrimson">in line.</span>
          </h1>
          <p className="mt-3 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
            Every name is scored on what the record documents inside the last
            180 days. No floor for old fame, no points for having been chopped:
            a name with nothing recent cannot be sentenced. The blade takes the
            worst name that is not cooling from its last chop. Click a name for its charges and
            sources.
          </p>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_270px] xl:items-start">
          <div className="order-2 min-w-0 xl:order-1">
            <section className="grid gap-3 pb-6 sm:grid-cols-3">
              <div className="border-2 border-black bg-sheetWhite p-3.5 text-canvasBlack">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-spiteCrimson">
                  in the line
                </p>
                <p className="mt-1 text-3xl font-black tracking-tighter">{standing.length}</p>
                <p className="mt-1 font-mono text-[9px] text-black/60">names still standing</p>
              </div>
              <div className="border-2 border-spiteCrimson bg-spiteCrimson p-3.5 text-sheetWhite">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest">blade falls</p>
                <p className="mt-1 text-3xl font-black tracking-tighter">{chops}</p>
                <p className="mt-1 font-mono text-[9px] text-white/70">crosses on the wall</p>
              </div>
              <div className="border-2 border-hypeNeon bg-hypeNeon p-3.5 text-canvasBlack">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest">
                  charges on record
                </p>
                <p className="mt-1 text-3xl font-black tracking-tighter">{charges}</p>
                <p className="mt-1 font-mono text-[9px] text-black/60">
                  ledger entries, sourced
                  {hate.ledgerToday ? ` · ${hate.ledgerToday} filed in 24h` : ""}
                </p>
              </div>
            </section>

            <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
              score = documented harm, last 180 days · the blade takes the worst name not cooling
            </p>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">
                {filtered.length} names · click any card for the record
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a name or country"
                  className="w-full border-2 border-chop-border bg-white/5 px-3 py-2 font-mono text-xs text-sheetWhite outline-none placeholder:text-chop-muted focus:border-hypeNeon sm:w-72"
                />
                <button
                  type="button"
                  onClick={() => show("propose")}
                  className="whitespace-nowrap border-2 border-black bg-spiteCrimson px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                >
                  + Propose a name
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="border-2 border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
                  the line is empty — the machine is still reading
                </div>
              ) : (
                filtered.map((figure, i) => (
                  <div key={`${figure.name}-${figure.rank}`}>
                    {i === coolingFrom && (
                      <div className="mb-3 flex items-center gap-3 pt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
                        <span className="h-px flex-1 bg-chop-border" />
                        <span className="text-center">
                          serving their {COOLDOWN_DAYS} days · score unchanged
                        </span>
                        <span className="h-px flex-1 bg-chop-border" />
                      </div>
                    )}
                    <LineRow figure={figure} promoted={i === 0} />
                  </div>
                ))
              )}
            </div>

            {uncharged.length > 0 && (
              <section className="mt-6 border-t border-chop-border pt-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
                  on the record, no charge in the last 180 days · {uncharged.length}
                </p>
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-chop-muted/80">
                  Nothing here is proven inside the window, so nothing here can be
                  sentenced. They keep their pages and their receipts, and a zero
                  is not an acquittal — it is the absence of a recent receipt.
                </p>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {uncharged.map((f) => (
                    <li key={f.name}>
                      <Link
                        href={`/person/${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                        className="font-mono text-[11px] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                      >
                        {f.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* The work arriving. Research files batches; this is the batch, so a
              score that moved overnight has a visible reason next to it. */}
          <div className="order-1 xl:order-2 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain">
            <ChargesRail limit={8} title="new charges" />
          </div>
        </div>
      </main>
    </div>
  );
}
