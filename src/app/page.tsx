"use client";

import { FsdBanner } from "../components/FsdBanner";
import { AdPopups } from "../components/AdPopups";
import { NavBar } from "../components/NavBar";
import { useDrawer } from "../components/drawers";
import { RulesBanner } from "../components/RulesBanner";
import { useClock } from "../components/DoomsdayClock";
import { useCallback, useEffect, useState } from "react";
import { useHateometer } from "../components/Hateometer";
import { BladeClock, queueNote } from "../components/StatusToolbar";
import { slugify } from "../lib/slug";
import { QueueCard } from "../components/QueueCard";
import type { Figure } from "../lib/hateometer";
import { CrossesWall } from "../components/CrossesWall";
import { RageStack } from "../components/RageStack";
import { SubliminalVideo } from "../components/SubliminalVideo";
import { NewsReel, type CutIn } from "../components/NewsReel";
import { LiveWire } from "../components/LiveWire";
import { useSiteContent } from "../lib/use-site-content";
import { ControlDeck } from "../components/ControlDeck";
import { MarketTicker } from "../components/MarketTicker";

/**
 * The archive cut-in. The gesture and the words are both on the record, so the
 * frame is shown with the words he said next to it — the viewer gets the
 * argument, not a planted impression.
 */
const CUT_IN: CutIn = {
  src: "/static/musknazi-cut.webp",
  quote: "My heart goes out to you",
  who: "Elon Musk · 20 Jan 2025 · Capital One Arena",
  href: "https://apnews.com/article/musk-gesture-salute-antisemitism-0070dae53c7a73397b104ae645877535",
};

/**
 * The installation.
 *
 * Ada's mood, the gauge, and the blades. The queue is the page: everyone
 * standing under their own blade, each counter built from the reports that name
 * them. The stack underneath is the evidence.
 */
export default function HomePage() {
  const { content } = useSiteContent();
  const { show } = useDrawer();
  const { state, pulls, pull } = useClock();
  // Ada rewrites the front page when she has something to say; otherwise the
  // standing copy holds.
  const heroHeadline = state.voice.headline || content.hero.headline;
  const heroSubheadline = state.voice.subheadline || content.hero.subheadline;
  const { state: hate, pull: pullHate } = useHateometer();
  // Once a name is chopped it stays chopped until the card is replaced. The
  // poll can take a moment, and the head must not reappear in the gap.
  const [chopped, setChopped] = useState<string | null>(null);
  // Hold the card on the chopped figure while the head falls, so a poll cannot
  // swap it out mid-animation.
  const [frozen, setFrozen] = useState<Figure | null>(null);
  // Nobody leaves the line: a chop is a tally, and the counter resets so the
  // name climbs back. The wall below is where the executions accumulate.
  const standing = hate.figures;
  const atTheBlock = frozen ?? standing[0];

  // The countdown reaches zero: drop the blade, let the head roll, then ask
  // the server for the line after the chop.
  const onZero = useCallback(
    (slug: string) => {
      const victim = standing.find((f) => slugify(f.name) === slug) ?? standing[0] ?? null;
      setFrozen(victim);
      setChopped(slug);
      // The head settles at ~2.7s, the blade climbs for six seconds, then the
      // next name is promoted. Head roll, blade up, new head, in that order.
      window.setTimeout(async () => {
        const next = await pullHate();
        setFrozen(null);
        // The client can reach zero a fraction before the server's clock.
        // If the sentence is still standing, ask again a moment later.
        if (next?.execution && next.execution.secondsLeft <= 0) {
          window.setTimeout(() => pullHate(), 1500);
        }
      }, 9100);
    },
    [pullHate, standing],
  );

  // A name that leaves the block takes its chop with it: when it climbs back
  // later, it arrives with a head on.
  useEffect(() => {
    if (chopped && atTheBlock && slugify(atTheBlock.name) !== chopped) setChopped(null);
  }, [atTheBlock, chopped]);

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
        {/* ── The front page: the argument, and the set ───────────────── */}
        <div className="mx-auto mt-8 grid max-w-6xl items-center gap-6 px-4 md:px-6 lg:grid-cols-[1fr_420px]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
              {content.hero.badge}
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase leading-[0.95] tracking-tighter text-sheetWhite md:text-5xl">
              {heroHeadline}
            </h1>
            <p className="mt-5 hidden max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted md:block md:text-[13px]">
              {heroSubheadline}
            </p>
            <p className="mt-4 max-w-2xl font-mono text-[11px] leading-snug text-chop-muted md:hidden">
              Ada reads the record. At ninety, the blade falls. Every claim links
              to its source.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => show("propose")}
                className="border-2 border-black bg-spiteCrimson px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                Propose a name
              </button>
              <button
                type="button"
                onClick={() => show("fund")}
                className="border-2 border-chop-border px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-sheetWhite transition-colors hover:border-hypeNeon hover:text-hypeNeon"
              >
                The fund
              </button>
              <button
                type="button"
                onClick={() => show("fund")}
                className="border-2 border-hypeNeon px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-hypeNeon transition-colors hover:bg-hypeNeon hover:text-canvasBlack"
              >
                Buy $CHOP
              </button>
            </div>
          </div>
          <NewsReel
            cutIn={CUT_IN}
            messages={
              state.voice.subliminal.length ? state.voice.subliminal : content.subliminalMessages
            }
          />
        </div>

        {/* ── The blade: full width, the main piece ───────────────────── */}
        <div className="mx-auto mt-8 max-w-6xl px-4 md:px-6">
          <section id="queue">
            <div className="flex items-end justify-between gap-4 border-b border-chop-border pb-2">
              <div>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite">
                  on the block
                </h2>
                <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                  {standing.length} waiting
                  {queueNote(standing) ? ` · ${queueNote(standing)}` : ""}
                </span>
              </div>
              <BladeClock
                execution={hate.execution}
                nextRunAt={hate.nextRunAt}
                onZero={onZero}
                compact
              />
            </div>

            {atTheBlock && (
              <div className="mt-4">
                <div className="mb-2 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
                  <span>{hate.execution ? "next to be executed" : "top of the line"}</span>
                  <span>promoted from the line</span>
                </div>
                <QueueCard
                  figure={atTheBlock}
                  dropped={chopped === slugify(atTheBlock.name)}
                />
              </div>
            )}
          </section>
        </div>

        {/* ── The tape: fake technology, real ticker ──────────────────── */}
        <div className="mx-auto mt-6 max-w-6xl px-4 md:px-6">
          <MarketTicker />
        </div>

        {/* ── The control deck: three different shapes, one row ───────── */}
        <div className="mx-auto mt-6 max-w-6xl px-4 md:px-6">
          <ControlDeck
            mood={state.voice.mood}
            line={state.voice.line}
            items={state.items}
          />
        </div>

        {/* ── The crosses ─────────────────────────────────────────────── */}
        <div className="mx-auto mt-10 max-w-6xl px-4 md:px-6">
          <section>
            <div className="flex items-baseline justify-between border-b border-chop-border pb-2">
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
