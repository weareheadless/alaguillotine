"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The sentence, in public.
 *
 * Ada sets the score; the site turns the score into a ritual. A name that
 * reaches the threshold is sentenced, the clock counts down in front of
 * everyone, and when it reaches zero the blade falls. The countdown is local
 * so it ticks every second; the server owns the actual execution.
 */
export interface ExecutionInfo {
  person: string;
  slug: string;
  score: number;
  sentencedAt: string;
  executeAt: string;
  secondsLeft: number;
}

const fmt = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export function ExecutionCountdown({
  execution,
  onZero,
}: {
  execution: ExecutionInfo;
  onZero: (slug: string) => void;
}) {
  const total = Math.max(
    1,
    Math.round((Date.parse(execution.executeAt) - Date.parse(execution.sentencedAt)) / 1000),
  );
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.ceil((Date.parse(execution.executeAt) - Date.now()) / 1000)),
  );
  const fired = useRef(false);
  const zero = useRef(onZero);

  useEffect(() => {
    zero.current = onZero;
  }, [onZero]);

  useEffect(() => {
    fired.current = false;
    const tick = () => {
      const next = Math.max(
        0,
        Math.ceil((Date.parse(execution.executeAt) - Date.now()) / 1000),
      );
      setLeft(next);
      if (next <= 0 && !fired.current) {
        fired.current = true;
        zero.current(execution.slug);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [execution.executeAt, execution.slug]);

  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  const falling = left <= 0;

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4 md:px-6">
      <div className="relative overflow-hidden border-2 border-spiteCrimson bg-spiteCrimson/[0.08] px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-spiteCrimson">
              sentenced
            </div>
            <div className="mt-0.5 truncate text-xl font-black uppercase leading-none tracking-tight text-sheetWhite md:text-2xl">
              {execution.person}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-black tabular-nums leading-none text-spiteCrimson md:text-4xl">
              {falling ? "—" : fmt(left)}
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              {falling ? "the blade is falling" : "until the blade"}
            </div>
          </div>
        </div>
        <div className="mt-3 h-1 w-full bg-chop-border">
          <div
            className="h-full bg-spiteCrimson transition-[width] duration-300 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
