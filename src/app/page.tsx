"use client";

import { FsdBanner } from "../components/FsdBanner";
import { AdPopups } from "../components/AdPopups";
import { NavBar } from "../components/NavBar";
import { RulesBanner } from "../components/RulesBanner";
import { DoomsdayClock } from "../components/DoomsdayClock";
import { Hateometer, useHateometer } from "../components/Hateometer";
import { QueueCard } from "../components/QueueCard";
import { RageStack } from "../components/RageStack";
import { SubliminalVideo } from "../components/SubliminalVideo";
import { useClock } from "../components/DoomsdayClock";
import { useSiteContent } from "../lib/use-site-content";

/**
 * The installation.
 *
 * One page, two instruments and a queue. The clock counts what is being taken;
 * the hateometer measures what is being done about it; the queue names the
 * people the reporting keeps returning to, each under their own blade. The
 * stack is the raw material for all three.
 */
export default function HomePage() {
  const { content } = useSiteContent();
  const { state, pulls, pull } = useClock();
  const hate = useHateometer();

  return (
    <div className="relative min-h-screen bg-canvasBlack">
      <FsdBanner />

      <SubliminalVideo
        src="/static/musk_is_presented_with_the_reality.mp4"
        poster="/appwrite-icon.svg"
        messages={content.subliminalMessages}
      />

      <NavBar />

      <main className="relative z-10 pb-16 md:pb-8">
        <div className="mx-auto mt-8 max-w-6xl px-4 md:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
            {content.hero.badge}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black uppercase leading-[0.95] tracking-tighter text-sheetWhite md:text-5xl">
            {content.hero.headline}
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[11px] leading-relaxed text-chop-muted md:text-sm">
            {content.hero.subheadline}
          </p>
        </div>

        {/* ── The two instruments ─────────────────────────────────────── */}
        <div className="mx-auto mt-6 grid max-w-6xl gap-4 px-4 md:px-6 lg:grid-cols-[1fr_320px]">
          <DoomsdayClock state={state} pulls={pulls} />
          <Hateometer state={hate} />
        </div>

        {/* ── The queue ───────────────────────────────────────────────── */}
        <section id="queue" className="mx-auto mt-12 max-w-6xl px-4 md:px-6">
          <div className="flex items-baseline justify-between border-b border-chop-border pb-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite">
              the queue
            </h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              {hate.figures.length} standing · each with their own blade
            </span>
          </div>

          <p className="mt-3 max-w-2xl font-mono text-[11px] leading-relaxed text-chop-muted">
            Ada puts names here herself, from the reporting, and updates every
            counter on each pass. Nobody is dropped for a quiet week — the counter
            decays, the blade rises, the name stays.
          </p>

          <div className="mt-5 space-y-3">
            {hate.figures.length === 0 ? (
              <div className="border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
                the block is empty — the machine is still reading
              </div>
            ) : (
              hate.figures.map((figure) => (
                <QueueCard key={`${figure.name}-${figure.rank}`} figure={figure} />
              ))
            )}
          </div>
        </section>

        {/* ── The stack ───────────────────────────────────────────────── */}
        <section className="mx-auto mt-12 max-w-6xl px-4 md:px-6">
          <div className="flex items-baseline justify-between border-b border-chop-border pb-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite">
              the stack
            </h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              what the numbers are made of
            </span>
          </div>
          <div className="mt-5">
            <RageStack items={state.items} onPull={pull} bare />
          </div>
        </section>

        <div className="mx-auto mt-10 max-w-6xl px-4 md:px-6">
          <RulesBanner />
        </div>
      </main>

      <AdPopups />

      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          {content.footer}
        </p>
      </footer>
    </div>
  );
}
