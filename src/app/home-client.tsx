"use client";

import { FsdBanner } from "../components/FsdBanner";
import { AdPopups } from "../components/AdPopups";
import { NavBar } from "../components/NavBar";
import { useDrawer } from "../components/drawers";
import { RulesBanner } from "../components/RulesBanner";
import { useClock } from "../components/DoomsdayClock";
import { useCallback, useEffect, useState } from "react";
import { pullHate as pullHateReading } from "../lib/hateometer-client";
import { BladeClock, queueNote } from "../components/StatusToolbar";
import { slugify } from "../lib/slug";
import { QueueCard } from "../components/QueueCard";
import type { Figure, HateState } from "../lib/hateometer";
import { CrossesWall } from "../components/CrossesWall";
import { FeedMosaic } from "../components/FeedMosaic";
import { RecordStrip } from "../components/RecordStrip";
import { SubliminalVideo } from "../components/SubliminalVideo";
import { NewsReel, type CutIn } from "../components/NewsReel";
import { LiveWire } from "../components/LiveWire";
import { useSiteContent } from "../lib/use-site-content";
import { ControlDeck } from "../components/ControlDeck";
import { ExecutionAd } from "../components/ExecutionAd";
import { executionNotice } from "../lib/execution-notice";

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
 * them. The crosses hang beside the blade, so the record stays in view without
 * pushing the feed down the page.
 */
/** How long ago the feed last took something in, in the reader's units. */
function updatedAgo(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function HomePage({ initial }: { initial: HateState }) {
  const { content } = useSiteContent();
  const { show } = useDrawer();
  const { state } = useClock();
  // The front page says one thing, always. It used to take Ada's generated
  // headline when she offered one, which meant the site's main line changed
  // identity every four hours and drifted into the same two-beat slogan. The
  // standing line is the promise; the numbers under it are what move.
  const heroHeadline = content.hero.headline;
  const heroSubheadline = content.hero.subheadline;
  // The last beat is the accusation, so it is the one in red. Done by rule
  // rather than by markup in the copy, so a new headline gets the same
  // treatment without anyone having to remember the span.
  const heroEnds = heroHeadline.trim().split(/\s+/);
  const heroLast = heroEnds.length > 1 ? heroEnds[heroEnds.length - 1] : "";
  const heroLead = heroEnds.slice(0, -1).join(" ");
  // The first reading is in the HTML: the server built it before the page was
  // sent. The client only refreshes it, so the counts and the queue are on
  // screen with the copy rather than arriving after JavaScript and a fetch.
  const [hate, setHate] = useState<HateState>(initial);
  const pullHate = useCallback(async (): Promise<HateState | null> => {
    const next = await pullHateReading();
    if (next) setHate(next);
    return next;
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      void pullHate();
    }, 90_000);
    return () => clearInterval(id);
  }, [pullHate]);
  // Once a name is chopped it stays chopped until the card is replaced. The
  // poll can take a moment, and the head must not reappear in the gap.
  const [chopped, setChopped] = useState<string | null>(null);
  // Hold the card on the chopped figure while the head falls, so a poll cannot
  // swap it out mid-animation.
  const [frozen, setFrozen] = useState<Figure | null>(null);

  // The appointment's own explanation: the charge as it was written when the
  // sentence was made, and the acts it stood on, with their sources.
  const appointment = hate.execution ?? hate.lastExecution ?? null;
  const appointmentAt = appointment
    ? "executeAt" in appointment
      ? appointment.executeAt
      : appointment.executedAt
    : null;
  const stamp = (iso: string | null): string =>
    iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : "";
  const sentencedAt =
    appointment && "sentencedAt" in appointment ? appointment.sentencedAt : null;
  const appointmentLabel = hate.execution
    ? `sentenced ${stamp(sentencedAt)} · falls ${stamp(appointmentAt)}`
    : `executed ${stamp(appointmentAt)}`;
  const appointmentBasis = (() => {
    try {
      const parsed = JSON.parse(appointment?.basis ?? "{}") as {
        score?: number;
        acts?: Array<{
          act: string;
          take?: string;
          url: string;
          title?: string;
          at?: string | null;
          category?: string;
        }>;
      };
      return {
        score: Number(parsed.score ?? appointment?.score ?? 0),
        acts: Array.isArray(parsed.acts) ? parsed.acts.slice(0, 3) : [],
      };
    } catch {
      return { score: Number(appointment?.score ?? 0), acts: [] };
    }
  })();
  // Nobody leaves the line: a chop is a tally. The name keeps its record and
  // sits out a cooldown, then returns to the band. The wall beside the blade is
  // where executions accumulate.
  const standing = hate.figures;
  const chopTotal = hate.chops.reduce((n, c) => n + c.count, 0);
  // The card belongs to the name under the blade, not to whoever is first in
  // the line. When a sentence is waiting, that name is the appointment.
  const sentenced = hate.execution
    ? standing.find((f) => slugify(f.name) === hate.execution!.slug) ?? null
    : null;
  const atTheBlock = frozen ?? sentenced ?? standing[0];
  const notice = executionNotice(hate);

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

  // A name that leaves the block takes its chop with it: when it returns from
  // the cooldown later, it arrives with a head on.
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

      <main className="relative z-10 flex flex-col pb-20 md:pb-8">
        {/* ── The front page: the argument, and the set ───────────────── */}
        <div className="order-1 mt-5 grid items-center gap-6 px-[clamp(1rem,2vw,2rem)] lg:mt-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
              {content.hero.badge}
            </p>
            <h1 className="mt-3 text-3xl font-black uppercase leading-[0.95] tracking-tighter text-sheetWhite md:text-5xl">
              {heroLead}
              {heroLast && (
                <>
                  {" "}
                  <span className="text-spiteCrimson">{heroLast}</span>
                </>
              )}
            </h1>
            {(hate.wire?.count || typeof hate.ledgerTotal === "number") && (
              /* Two numbers, both checkable: how much record there is, and what
                 is on the wire right now. The second one lands on the feed, so
                 the line is a door rather than a slogan. */
              <p className="mt-3 flex flex-col items-start gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-chop-muted sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                {typeof hate.ledgerTotal === "number" && (
                  <>
                    <span>{hate.ledgerTotal.toLocaleString()} charges on record</span>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                  </>
                )}
                <a
                  href="#home-feed"
                  className="underline decoration-chop-border decoration-1 underline-offset-[3px] hover:text-sheetWhite hover:decoration-hypeNeon"
                >
                  {hate.wire?.count ? `${hate.wire.count} in the feed` : "the feed"}
                  {hate.wire?.newestAt ? `, newest ${updatedAgo(hate.wire.newestAt)}` : ""}
                  <span aria-hidden="true"> →</span>
                </a>
              </p>
            )}
            {/* One paragraph, both widths. The narrow screen used to get its own
                hand-written version of the intro, and the two drifted: the
                desktop copy explained the number and the phone copy did not. */}
            <p className="mt-5 max-w-2xl font-mono text-[11px] leading-relaxed text-chop-muted md:text-[13px]">
              {heroSubheadline}
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
                className="hidden border-2 border-chop-border px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-sheetWhite transition-colors hover:border-hypeNeon hover:text-hypeNeon sm:block"
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
          <div className="hidden lg:block">
            <NewsReel
              cutIn={CUT_IN}
              messages={
                state.voice.subliminal.length ? state.voice.subliminal : content.subliminalMessages
              }
            />
          </div>
        </div>

        {/* ── The blade: full width, the main piece ───────────────────── */}
        <div className="order-2 mt-6 px-[clamp(1rem,2vw,2rem)] lg:mt-8">
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

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
              {atTheBlock && (
                <div className="min-w-0">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
                      <span>{hate.execution ? "next to be executed" : "top of the line"}</span>
                      <span>promoted from the line</span>
                    </div>
                    <QueueCard
                      figure={atTheBlock}
                      dropped={chopped === slugify(atTheBlock.name)}
                    />

                    {appointment && appointment.slug === slugify(atTheBlock.name) ? (
                      <section
                        aria-labelledby="why-this-name"
                        className="mt-3 border border-chop-border bg-white/[0.02] p-3.5"
                      >
                        <h3
                          id="why-this-name"
                          className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted"
                        >
                          why this name, at this hour
                        </h3>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
                          {appointmentLabel}
                          {" · "}score {appointmentBasis.score.toFixed(1)} at the time
                          {" · "}
                          {hate.execution ? "top of the line" : "the appointment it fell on"}
                        </p>
                        <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-chop-muted">
                          the standing charge
                        </p>
                        <p className="mt-1 max-w-3xl text-[13px] font-semibold leading-snug text-sheetWhite">
                          {appointment.reason || atTheBlock.reason}
                        </p>
                        {appointmentBasis.acts.length ? (
                          <>
                            <p className="mt-2.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-chop-muted">
                              the acts it stands on, and why each one counts
                            </p>
                            <ul className="mt-1 space-y-2">
                              {appointmentBasis.acts.map((act, i) => (
                                <li
                                  key={`${appointment.slug}-why-${i}`}
                                  className="text-[11.5px] leading-snug text-chop-muted"
                                >
                                  <span className="text-sheetWhite/85">{act.act}</span>
                                  <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
                                    {" "}
                                    · {[act.category, act.at ? act.at.slice(0, 4) : ""]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                  {act.url ? (
                                    <>
                                      {" "}
                                      <a
                                        href={act.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-mono text-[9px] uppercase tracking-[0.12em] text-hypeNeon underline-offset-2 hover:underline"
                                      >
                                        source ↗
                                      </a>
                                    </>
                                  ) : null}
                                  {act.take ? (
                                    <p className="mt-1 max-w-3xl border-l-2 border-hypeNeon/40 pl-2 text-[11.5px] leading-snug text-sheetWhite/80">
                                      <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-hypeNeon/80">
                                        why it counts ·{" "}
                                      </span>
                                      {act.take}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        <a
                          href={`/person/${appointment.slug}`}
                          className="mt-2 inline-block font-mono text-[9px] uppercase tracking-[0.14em] text-spiteCrimson underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                        >
                          the full record and method ↗
                        </a>
                      </section>
                    ) : null}
                  </div>
                </div>
              )}

              {/* The record sits beside the blade instead of below it. Its own
                  scroll keeps every name reachable without stretching the page. */}
              <aside
                aria-labelledby="crosses-title"
                className="relative flex min-w-0 flex-col border border-chop-border lg:min-h-0"
              >
                <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-chop-border px-3 py-2">
                  <h2
                    id="crosses-title"
                    className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite"
                  >
                    the crosses
                  </h2>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                    {chopTotal} blade{chopTotal === 1 ? "" : "s"} · {hate.chops.length} name
                    {hate.chops.length === 1 ? "" : "s"}
                  </span>
                </div>
                <CrossesWall chops={hate.chops} figures={hate.figures} compact />
              </aside>
            </div>
            <ExecutionAd notice={notice} compact />
          </section>
        </div>

        {/* ── The control deck: three different shapes, one row ───────── */}
        <div className="order-4 mt-6 px-[clamp(1rem,2vw,2rem)] lg:order-3">
          <ControlDeck
            mood={state.voice.mood}
            line={state.voice.line}
            items={state.items}
          />
        </div>

        {/* ── The evidence ────────────────────────────────────────────── */}
        <div className="order-3 lg:order-4">
          <RecordStrip />
          <FeedMosaic />
        </div>

        {/* The method and the limits belong together at the bottom. A reader
            who has just met the blade gets the test it applies, in the same
            breath as what this is and is not. */}
        <div className="order-5 mt-10 px-[clamp(1rem,2vw,2rem)]">
          <section aria-labelledby="home-method" className="mb-5">
            <div className="border border-chop-border bg-white/[0.02] p-3.5">
              <h2
                id="home-method"
                className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted"
              >
                how the line is decided
              </h2>
              <p className="mt-2 max-w-4xl font-mono text-[11px] leading-relaxed text-chop-muted md:text-[12px]">
                A model reads sentences published by newsrooms. It keeps one only
                when the named person is the actor and the conduct is the harm this
                record covers — war, weapons, repression, extraction, impunity,
                self-dealing, or money used as leverage over politics. Ordinary
                politics, opposition to harm and someone else&rsquo;s conduct are
                dropped.
              </p>
              <p className="mt-1.5 max-w-4xl font-mono text-[11px] leading-relaxed text-chop-muted md:text-[12px]">
                Every kept sentence is printed with the article it came from, and a
                quote that is not found in the stored text is not on the record. It
                is a reading of published reporting, not an investigation, and it
                does not decide that anyone committed a crime.
              </p>
              <p className="mt-1.5 max-w-4xl font-mono text-[11px] leading-relaxed text-chop-muted md:text-[12px]">
                <span className="text-sheetWhite">The blade is a metaphor.</span>{" "}
                This is satire about public conduct: no threat, no call for
                violence, no finding of fact. Every name has the right of reply.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.16em]">
                <a
                  href="/whitepaper"
                  className="text-spiteCrimson underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                >
                  the method ↗
                </a>
                <button
                  type="button"
                  onClick={() => show("propose")}
                  className="text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                >
                  challenge or propose a name
                </button>
                <a
                  href="/archive"
                  className="text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                >
                  read the record ↗
                </a>
              </div>
            </div>
          </section>
          <RulesBanner />
        </div>
      </main>

      <AdPopups notice={notice} />

      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          {content.footer}
        </p>
      </footer>
    </div>
  );
}
