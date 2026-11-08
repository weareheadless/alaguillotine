"use client";

import { FsdBanner } from "../components/FsdBanner";
import { AdPopups } from "../components/AdPopups";
import { NavBar } from "../components/NavBar";
import { RulesBanner } from "../components/RulesBanner";
import { useClock } from "../components/DoomsdayClock";
import { useCallback, useState } from "react";
import { Hateometer, useHateometer } from "../components/Hateometer";
import { ExecutionCountdown } from "../components/ExecutionCountdown";
import { slugify } from "../lib/slug";
import { QueueCard } from "../components/QueueCard";
import { CrossesWall } from "../components/CrossesWall";
import { RageStack } from "../components/RageStack";
import { SubliminalVideo } from "../components/SubliminalVideo";
import { NewsReel } from "../components/NewsReel";
import { LiveWire } from "../components/LiveWire";
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
  // Ada rewrites the front page when she has something to say; otherwise the
  // standing copy holds.
  const heroHeadline = state.voice.headline || content.hero.headline;
  const heroSubheadline = state.voice.subheadline || content.hero.subheadline;
  const { state: hate, pull: pullHate } = useHateometer();
  const [dropping, setDropping] = useState<string | null>(null);
  // Nobody leaves the line: a chop is a tally, and the counter resets so the
  // name climbs back. The wall below is where the executions accumulate.
  const standing = hate.figures;
  const atTheBlock = standing[0];

  // The countdown reaches zero: drop the blade, let the head roll, then ask
  // the server for the line after the chop.
  const onZero = useCallback(
    (slug: string) => {
      setDropping(slug);
      window.setTimeout(async () => {
        setDropping(null);
        const next = await pullHate();
        // The client can reach zero a fraction before the server's clock.
        // If the sentence is still standing, ask again a moment later.
        if (next?.execution && next.execution.secondsLeft <= 0) {
          window.setTimeout(() => pullHate(), 1500);
        }
      }, 3400);
    },
    [pullHate],
  );

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
              {heroHeadline}
            </h1>
            <p className="mt-5 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted md:text-[13px]">
              {heroSubheadline}
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

        {hate.execution && (
          <ExecutionCountdown execution={hate.execution} onZero={onZero} />
        )}
        {!hate.execution && hate.lastExecution && (
          <section className="mx-auto mt-6 max-w-6xl px-4 md:px-6">
            <div className="border-l-2 border-spiteCrimson pl-3 font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">
              the blade fell on{" "}
              <span className="text-spiteCrimson">{hate.lastExecution.person}</span>
              {" · "}back in the line
            </div>
          </section>
        )}

        {/* ── The gauge and the blades ────────────────────────────────── */}
        <div className="mx-auto mt-8 grid max-w-6xl gap-6 px-4 md:px-6 lg:grid-cols-[300px_1fr]">
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
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
                <QueueCard
                  figure={atTheBlock}
                  dropped={dropping === slugify(atTheBlock.name)}
                />
              </div>
            )}

            <div className="mt-10 flex items-baseline justify-between border-b border-chop-border pb-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite">
                the crosses
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                every name, every time
              </span>
            </div>

            <CrossesWall chops={hate.chops} figures={hate.figures} />

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
