"use client";

import { NavBar } from "@/components/NavBar";
import { Hateometer, useHateometer } from "@/components/Hateometer";
import { QueueCard } from "@/components/QueueCard";
import { SubliminalVideo } from "@/components/SubliminalVideo";

/**
 * The queue.
 *
 * Not a leaderboard — a holding pen. Each person stands under their own blade,
 * with their own counter, fed by the reports that named them this pass. The
 * video is the news reel: the same clip treatment as the front page, because
 * this is an installation, not a dashboard.
 */

const REEL_MESSAGES = [
  "THIS IS NOT A VERDICT",
  "IT IS A COUNTER",
  "THE BLADE IS A METAPHOR",
  "FOR NOW",
  "CHECK THE SOURCE",
  "NOBODY IS ABOVE THE LEDGER",
  "THE QUEUE MOVES",
];

export default function NextInLinePage() {
  const hate = useHateometer();

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-10">
        <section className="grid gap-8 border-b-4 border-spiteCrimson pb-8 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <p className="mb-3 inline-flex border border-hypeNeon/60 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-hypeNeon">
              queue rebuilt every 12 hours
            </p>
            <h1 className="max-w-3xl text-5xl font-black uppercase leading-[0.86] tracking-[-0.06em] text-sheetWhite sm:text-7xl">
              Next <span className="text-spiteCrimson">in line.</span>
            </h1>
            <p className="mt-5 max-w-xl font-mono text-sm leading-relaxed text-chop-muted">
              Everyone standing here has their own blade and their own counter.
              The counter is the shrunk mean of the harm reported in their name
              this pass; the blade sits at the counter. Open a name and you get
              the reports, with links.
            </p>
          </div>

          <div className="border border-chop-border bg-chop-card/40">
            <SubliminalVideo
              src="/static/musk_is_presented_with_the_reality.mp4"
              messages={REEL_MESSAGES}
              variant="inline"
            />
            <p className="border-t border-chop-border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              news reel · overlay treatment
            </p>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Hateometer state={hate} />
          </div>

          <div className="space-y-3">
            {hate.figures.length === 0 ? (
              <div className="border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
                the block is empty — the machine is still reading
              </div>
            ) : (
              hate.figures.map((figure) => <QueueCard key={`${figure.name}-${figure.rank}`} figure={figure} />)
            )}

            <div className="mt-6 border-l-2 border-chop-border pl-4 font-mono text-[10px] leading-relaxed text-chop-muted">
              <p className="text-hypeNeon">// HOW THE COUNTER WORKS</p>
              <p className="mt-2">
                Each report is scored for harm, then the person&apos;s counter is
                the mean of the reports naming them, shrunk toward neutral until
                enough of them accumulate. One bad headline cannot move a blade
                far. Only public officials, commanders and arms executives named
                in the source text appear; critics, investigators, mediators and
                victims are excluded by rule. Movement is against the previous
                pass.
              </p>
              <p className="mt-2">
                This is not a legal finding, a prediction, or a call to anything.
                The blade is a metaphor. If a name is wrong, the source link is
                the appeal.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
