"use client";

import { useEffect, useState } from "react";
import type { RageItem } from "../lib/clock";

/**
 * The wire.
 *
 * One scrape every four hours, but the page should not feel like it. The wire
 * replays the whole pool, one headline at a time, so the installation is always
 * moving between readings without pretending the numbers changed.
 */

export function LiveWire({ items }: { items: RageItem[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 3800);
    return () => clearInterval(id);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="border-y border-chop-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-chop-muted md:px-6">
        the wire is quiet — waiting for the next reading
      </div>
    );
  }

  const item = items[index % items.length];

  return (
    <div className="border-y border-chop-border bg-chop-card/30">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 md:px-6">
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-spiteCrimson">
          <span className="h-1.5 w-1.5 animate-pulse bg-spiteCrimson" />
          wire
        </span>

        <div key={item.id} className="min-w-0 flex-1 overflow-hidden">
          <p className="wire-in truncate font-mono text-[11px] text-sheetWhite">
            <span className="text-chop-muted">{item.source}</span>
            <span className="mx-2 text-chop-muted">·</span>
            {item.headline}
          </p>
        </div>

        <span className="hidden shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted sm:inline">
          {item.rage}
        </span>
        <span className="shrink-0 font-mono text-[9px] tabular-nums text-chop-muted">
          {String(index + 1).padStart(2, "0")}/{String(items.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
