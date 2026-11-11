"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HateState } from "@/lib/hateometer";
import { countdown, executionNotice } from "@/lib/execution-notice";

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
  const [state, setState] = useState<HateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/hateometer", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as HateState;
        if (!cancelled) setState(next);
      } catch {
        /* keep the last reading */
      }
    };
    pull();
    const id = setInterval(pull, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
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
