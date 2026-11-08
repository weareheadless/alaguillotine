"use client";

import { useState } from "react";

/**
 * The forum, framed beside the fund.
 *
 * Tabs switch community without reloading the page. Deep links arrive as
 * `?to=/post/12` or `?c=mutual_aid` and are honoured on first load.
 */

const ORIGIN = "https://forum.alaguillotine.com";

const TABS = [
  { id: "the_fund", label: "The Fund", path: "/c/the_fund" },
  { id: "mutual_aid", label: "Mutual Aid", path: "/c/mutual_aid" },
  { id: "evidence", label: "Evidence", path: "/c/evidence" },
  { id: "meta", label: "Meta", path: "/c/meta" },
] as const;

export function ForumFrame({
  initialPath,
  full = false,
}: {
  initialPath?: string;
  full?: boolean;
}) {
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
    <section id="forum" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const isActive = tab.id === active?.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => choose(tab)}
                aria-pressed={isActive}
                className={`border-2 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  isActive
                    ? "border-black bg-spiteCrimson text-sheetWhite shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "border-chop-border bg-canvasBlack text-chop-muted hover:border-sheetWhite hover:text-sheetWhite"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <a
          href={`${ORIGIN}${path}`}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-hypeNeon underline decoration-hypeNeon/40 hover:decoration-hypeNeon"
        >
          open full screen ↗
        </a>
      </div>

      <div className="mt-3 border-2 border-black bg-canvasBlack shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <iframe
          src={`${ORIGIN}${path}`}
          title="A LA GUILLOTINE forum"
          className={`block w-full border-0 bg-canvasBlack ${
            full
              ? "h-[72vh] min-h-[560px] lg:h-[calc(100dvh-190px)]"
              : "h-[68vh] min-h-[520px] lg:h-[calc(100dvh-330px)]"
          }`}
          allow="clipboard-write"
        />
      </div>

      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
        no email · accounts approved by hand · money buys no weight
      </p>
    </section>
  );
}