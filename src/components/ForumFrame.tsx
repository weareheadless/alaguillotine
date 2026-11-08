"use client";

import { useState } from "react";

/**
 * The forum, framed under the fund.
 *
 * The tabs switch community without reloading the page. Deep links come in as
 * `?to=/post/12` or `?c=mutual_aid` and are honoured on first load.
 */

const ORIGIN = "https://forum.alaguillotine.com";

const TABS = [
  {
    id: "the_fund",
    label: "The Fund",
    path: "/c/the_fund",
    blurb: "proposals, votes, receipts",
  },
  {
    id: "mutual_aid",
    label: "Mutual Aid",
    path: "/c/mutual_aid",
    blurb: "food, legal, medical, shelter",
  },
  {
    id: "evidence",
    label: "Evidence",
    path: "/c/evidence",
    blurb: "sources that survive a reading",
  },
  {
    id: "meta",
    label: "Meta",
    path: "/c/meta",
    blurb: "rules, moderation, bans",
  },
] as const;

export function ForumFrame({ initialPath }: { initialPath?: string }) {
  const start =
    initialPath && initialPath.startsWith("/") ? initialPath : "/c/the_fund";
  const [path, setPath] = useState(start);
  const active = TABS.find((tab) => tab.path === path);

  function choose(tab: (typeof TABS)[number]) {
    setPath(tab.path);
    const url = new URL(window.location.href);
    url.searchParams.set("c", tab.id);
    url.searchParams.delete("to");
    window.history.replaceState(null, "", url);
  }

  return (
    <section id="floor" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-spiteCrimson">
            the forum
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase leading-none tracking-tighter sm:text-4xl">
            Argue the fund<span className="text-spiteCrimson">.</span>
          </h2>
          <p className="mt-2 max-w-xl font-mono text-[12px] leading-relaxed text-chop-muted">
            Proposals, votes and receipts. No email. One person, one voice —
            money buys no weight.
          </p>
        </div>
        <a
          href={`${ORIGIN}${path}`}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-hypeNeon underline decoration-hypeNeon/40 hover:decoration-hypeNeon"
        >
          open full screen ↗
        </a>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => choose(tab)}
              aria-pressed={isActive}
              className={`group border-2 px-3 py-2 text-left transition-colors ${
                isActive
                  ? "border-black bg-spiteCrimson text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  : "border-chop-border bg-canvasBlack text-chop-muted hover:border-sheetWhite hover:text-sheetWhite"
              }`}
            >
              <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.15em]">
                {tab.label}
              </span>
              <span
                className={`hidden font-mono text-[8px] uppercase tracking-[0.12em] sm:block ${
                  isActive ? "text-white/70" : "text-chop-muted/70"
                }`}
              >
                {tab.blurb}
              </span>
            </button>
          );
        })}
        {!active && (
          <span className="self-center border-2 border-chop-border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
            thread
          </span>
        )}
      </div>

      <div className="mt-4 border-2 border-black bg-canvasBlack shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <iframe
          src={`${ORIGIN}${path}`}
          title="A LA GUILLOTINE forum"
          className="block h-[70vh] min-h-[560px] w-full border-0 bg-canvasBlack md:h-[720px]"
          allow="clipboard-write"
        />
      </div>

      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
        no email · accounts approved by hand · the thread is the record
      </p>
    </section>
  );
}