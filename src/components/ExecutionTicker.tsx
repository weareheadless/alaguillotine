"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { countdown, executionNotice } from "@/lib/execution-notice";
import { useExecutionReading } from "@/lib/hateometer-client";
import { usePromise } from "@/lib/use-promise";
import { useDrawer } from "./drawers";

const DISMISS_KEY = "ala:execution-ticker:dismissed";

/**
 * The announcement strip.
 *
 * A temporary hack on the navbar: the blade is the only thing on this site
 * with a published time, so it gets a breaking-news bar. It names the person,
 * the date, the hour and the charge, and it counts down in public. Dismissing
 * it lasts for the tab, not forever.
 */
export function ExecutionTicker() {
  // The appointment, from the page's own reading when there is one and from
  // the lean endpoint otherwise. The strip used to fetch the whole record for
  // every page on the site, only to read one name and one time out of it.
  const state = useExecutionReading();
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [promo, setPromo] = useState(false);
  const { text: promise } = usePromise();
  const { show } = useDrawer();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // The sponsor gets the same strip as the execution, but only every other
  // half-minute. The countdown never moves.
  useEffect(() => {
    const id = setInterval(() => setPromo((value) => !value), 30_000);
    return () => clearInterval(id);
  }, []);

  const notice = useMemo(
    () => (state ? executionNotice(state, now) : null),
    [state, now],
  );

  if (!notice || dismissed) return null;

  const seconds = Math.max(0, Math.round((Date.parse(notice.at) - now) / 1000));
  const close = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
  };

  if (promo && promise) {
    return (
      <div
        role="note"
        aria-label="Ada’s financial advice"
        className="border-t-2 border-black bg-spiteCrimson text-sheetWhite"
      >
        <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-1.5 font-mono md:px-6 md:py-2">
          <span className="mt-0.5 shrink-0 bg-black px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.15em] text-hypeNeon">
            <span className="md:hidden">advice</span>
            <span className="hidden md:inline">ada’s financial advice</span>
          </span>
          <button
            type="button"
            onClick={() => show("fund")}
            className="min-w-0 flex-1 text-left text-[9px] normal-case leading-snug tracking-[0.02em] text-sheetWhite hover:underline md:text-[10px]"
          >
            “{promise}” <span className="whitespace-nowrap text-[9px] uppercase tracking-[0.15em] text-sheetWhite/80 underline decoration-sheetWhite/50 underline-offset-2">invest →</span>
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss financial advice"
            className="shrink-0 px-1 text-sheetWhite/70 hover:text-sheetWhite"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="note"
      aria-label="Next public execution"
      className="border-t-2 border-black bg-spiteCrimson text-sheetWhite"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] md:px-6">
        <span className="flex items-center gap-1.5 font-black">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sheetWhite" />
          {notice.confirmed ? "execution confirmed" : "next execution"}
        </span>

        <Link
          href={`/person/${notice.slug}`}
          className="font-black underline decoration-sheetWhite/50 underline-offset-2 hover:decoration-sheetWhite"
        >
          {notice.name}
        </Link>

        <span className="text-sheetWhite/85">
          {notice.dateLabel} · {notice.timeLabel}
        </span>

        <span className="hidden min-w-0 flex-1 truncate text-sheetWhite/70 lg:inline">
          — {notice.reason}
        </span>

        <span className="ml-auto flex items-center gap-2 tabular-nums">
          <span className="text-sheetWhite/70">blade in</span>
          <span className="font-black">{countdown(seconds)}</span>
        </span>

        <Link
          href="/next-in-line"
          className="hidden border border-sheetWhite/40 px-1.5 py-0.5 font-bold hover:bg-sheetWhite hover:text-spiteCrimson sm:inline"
        >
          the line
        </Link>

        <button
          type="button"
          onClick={close}
          aria-label="Dismiss execution announcement"
          className="px-1 text-sheetWhite/70 hover:text-sheetWhite"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
