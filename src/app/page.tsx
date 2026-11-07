"use client";

import { FsdBanner } from "../components/FsdBanner";
import { AdPopups } from "../components/AdPopups";
import { NavBar } from "../components/NavBar";
import { RulesBanner } from "../components/RulesBanner";
import { useClock } from "../components/DoomsdayClock";
import { Hateometer, useHateometer } from "../components/Hateometer";
import { QueueCard } from "../components/QueueCard";
import { RageStack } from "../components/RageStack";
import { SubliminalVideo } from "../components/SubliminalVideo";
import { NewsReel } from "../components/NewsReel";
import { LiveWire } from "../components/LiveWire";
import { PressureStrip } from "../components/PressureStrip";
import { useSiteContent } from "../lib/use-site-content";

/**
 * The installation.
 *
 * Ada's mood, the gauge, and the blades. The queue is the page: everyone
 * standing under their own blade, each counter built from the reports that name
 * them. The stack underneath is the evidence.
 */
export default function HomePage() {
  const { content } = useSiteContent();
  const { state, pulls, pull } = useClock();
  const hate = useHateometer();
  const standing = hate.figures.filter((f) => !f.droppedAt);
  const chopped = hate.figures.filter((f) => f.droppedAt);
  // The executioners: the last two whose blades fell. The homepage shows the
  // deaths, not the queue — the queue lives on /next-in-line.
  // The homepage shows deaths, never the queue. Everyone still waiting belongs
  // on /next-in-line, so nobody appears in two places.
  const executing = chopped.slice(0, 2);
  const atTheBlock = standing[0];
  // The next one is brought up to the block, not left in the line.
  const promoted = standing[0];

  return (
    <div className="relative min-h-screen bg-canvasBlack">
      <FsdBanner />

      <SubliminalVideo
        src="/static/musk_is_presented_with_the_reality.mp4"
        poster="/appwrite-icon.svg"
        messages={content.subliminalMessages}
      />

      <NavBar />

      <main className="relative z-10 pb-20 md:pb-8">
        <div className="mx-auto mt-8 grid max-w-6xl items-start gap-6 px-4 md:px-6 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
              {content.hero.badge}
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase leading-[0.95] tracking-tighter text-sheetWhite md:text-5xl">
              {content.hero.headline}
            </h1>
            <p className="mt-5 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted md:text-[13px]">
              {content.hero.subheadline}
            </p>
          </div>

          <NewsReel
            messages={
              state.voice.subliminal.length ? state.voice.subliminal : content.subliminalMessages
            }
          />
        </div>

        {/* ── The wire: between readings, the page still moves ─────────── */}
        <div className="mt-6">
          <LiveWire items={state.items} />
        </div>

        <div className="mx-auto mt-6 max-w-6xl px-4 md:px-6">
          <PressureStrip state={state} />
        </div>

        {/* ── Ada, in her own voice ───────────────────────────────────── */}
        <section className="mx-auto mt-6 max-w-6xl px-4 md:px-6">
          <div className="flex flex-col gap-3 border-y-2 border-spiteCrimson bg-spiteCrimson/[0.07] px-4 py-4 md:flex-row md:items-center md:gap-6 md:px-6">
            <div className="flex shrink-0 items-baseline gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-chop-muted">
                ada is
              </span>
              <span className="font-mono text-2xl font-black uppercase tracking-tight text-spiteCrimson md:text-3xl">
                {state.voice.mood || "reading"}
              </span>
            </div>
            <p className="font-mono text-[12px] leading-relaxed text-sheetWhite md:text-[13px]">
              {state.voice.line || "No reading yet. The machine is still looking."}
            </p>
          </div>
        </section>

        {/* ── The gauge and the blades ────────────────────────────────── */}
        <div className="mx-auto mt-8 grid max-w-6xl gap-6 px-4 md:px-6 lg:grid-cols-[300px_1fr]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Hateometer state={hate} />
          </div>

          <section id="queue">
            <div className="flex items-baseline justify-between border-b border-chop-border pb-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite">
                on the block
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                {standing.length} waiting in the line
              </span>
            </div>

            {atTheBlock && (
              <div className="mt-4">
                <div className="mb-2 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
                  <span>next to be executed</span>
                  <span>promoted from the line</span>
                </div>
                <QueueCard figure={atTheBlock} />
              </div>
            )}

            <div className="mt-10 flex items-baseline justify-between border-b border-chop-border pb-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite">
                executions
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                {chopped.length} on record
              </span>
            </div>

            {executing.length > 0 ? (
              <div className="mt-4 space-y-3">
                {executing.map((person) => (
                  <QueueCard key={person.name} figure={person} />
                ))}
              </div>
            ) : (
              <div className="mt-4 border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
                no blade has fallen yet — the machine is still reading
              </div>
            )}

          </section>
        </div>

        {/* ── The evidence ────────────────────────────────────────────── */}
        <section className="mx-auto mt-12 max-w-6xl px-4 md:px-6">
          <div className="flex items-baseline justify-between border-b border-chop-border pb-2">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite">
              the stack
            </h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              what the counters are made of
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
