"use client";

import { NavBar } from "@/components/NavBar";
import { useHateometer } from "@/components/Hateometer";
import { LineRow } from "@/components/LineRow";

/**
 * The full queue.
 *
 * Everyone standing, in order, each under their own blade. The front page shows
 * the one on the block and the first few behind them; this is the whole line,
 * plus the archive of everyone already chopped.
 */
export default function NextInLinePage() {
  const hate = useHateometer();
  const standing = hate.figures.filter((f) => !f.droppedAt);
  const chopped = hate.figures.filter((f) => f.droppedAt);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-10 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
          the line
        </p>
        <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-7xl">
          Next <span className="text-spiteCrimson">in line.</span>
        </h1>
        <p className="mt-5 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
          Ada reads the week and ranks who deserves the blade most. The top of
          this line is promoted to the front page, where it is executed; then the
          next name takes its place. The ranking is her judgement, not a formula.
        </p>

        <div className="mt-8 border-t border-chop-border">
          {standing.length === 0 ? (
            <div className="border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
              the line is empty — the machine is still reading
            </div>
          ) : (
            standing.map((figure, i) => (
              <div key={`${figure.name}-${figure.rank}`}>
                {i === 0 && (
                  <div className="mb-2 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-spiteCrimson">
                    <span>next to be promoted</span>
                    <span className="text-chop-muted">highest score in the line</span>
                  </div>
                )}
                <LineRow figure={figure} promoted={i === 0} />
              </div>
            ))
          )}
        </div>

        {chopped.length > 0 && (
          <section className="mt-12 border-t border-chop-border pt-6">
            <div className="mb-3 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
              <span>the chopped</span>
              <span>{chopped.length} on record</span>
            </div>
            <ul className="divide-y divide-chop-border/60">
              {chopped.map((person) => (
                <li
                  key={person.name}
                  className="flex items-baseline justify-between gap-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em]"
                >
                  <span className="text-sheetWhite/70">{person.name}</span>
                  <span className="text-chop-muted">
                    {person.droppedAt
                      ? new Date(person.droppedAt).toUTCString().slice(5, 16)
                      : ""}{" "}
                    · {Math.round(person.score)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
