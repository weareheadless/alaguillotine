"use client";

import { useEffect, useState } from "react";
import { DROP_THRESHOLD, type Figure } from "@/lib/hateometer";

/**
 * The long clock.
 *
 * The blade clock is ten minutes and only exists once a name is already
 * sentenced. This one is always there: the countdown to the next reading, when
 * the scores move and the next names can be sentenced. It is an estimate — the
 * pass can slip, and nobody may be past ninety when it lands — so it says so.
 */
export interface NextReadingProps {
  nextRunAt: string | null;
  lastReadingAt?: string | null;
  figures: Figure[];
  lastExecution?: { person: string; executedAt: string } | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/** Next 00:30 or 12:30 UTC, used only if the server has no reading time yet. */
function fallbackNextRun(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const candidates = [
    Date.UTC(y, m, d, 0, 30),
    Date.UTC(y, m, d, 12, 30),
    Date.UTC(y, m, d + 1, 0, 30),
  ];
  const next = candidates.find((t) => t > now.getTime()) ?? candidates[2];
  return new Date(next).toISOString();
}

function forecast(figures: Figure[]): string {
  const top = figures[0];
  if (!top) return "No queue yet. The reading will build one.";
  const ready = figures.filter((f) => f.score >= DROP_THRESHOLD).length;
  if (ready > 0) {
    return `${ready} ${ready === 1 ? "name is" : "names are"} already past ${DROP_THRESHOLD}. The blade starts its clock when the reading lands.`;
  }
  const gap = Math.ceil(DROP_THRESHOLD - top.score);
  if (gap <= 5) {
    return `${top.name} leads at ${top.score} — ${gap} ${gap === 1 ? "point" : "points"} from the block. The reading decides.`;
  }
  return `${top.name} leads at ${top.score}. Nobody is within five points of the block.`;
}

export function NextReading({
  nextRunAt,
  lastReadingAt,
  figures,
  lastExecution,
}: NextReadingProps) {
  const target = (() => {
    if (nextRunAt) {
      const parsed = Date.parse(nextRunAt);
      if (Number.isFinite(parsed)) return parsed;
    }
    return Date.parse(fallbackNextRun(new Date()));
  })();

  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [target]);

  const running = left != null && left <= 0;
  const span = 12 * 60 * 60;
  const pct = left == null ? 0 : Math.max(0, Math.min(100, 100 - (left / span) * 100));

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4 md:px-6">
      <div className="border-2 border-chop-border bg-sheetWhite/[0.02] px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-hypeNeon">
              next reading · estimated
            </div>
            <div className="mt-0.5 text-sm font-black uppercase leading-tight tracking-tight text-sheetWhite md:text-base">
              {running ? "The queue is being rescored." : "The line gets rewritten twice a day."}
            </div>
            <p className="mt-1 max-w-xl font-mono text-[10px] leading-relaxed text-chop-muted">
              {forecast(figures)}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-black tabular-nums leading-none text-hypeNeon md:text-4xl">
              {left == null ? "--:--" : running ? "—" : clock(left)}
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              {running ? "reading now" : "until the next sentencing window"}
            </div>
          </div>
        </div>

        <div className="mt-3 h-1 w-full bg-chop-border">
          <div
            className="h-full bg-hypeNeon transition-[width] duration-500 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.15em] text-chop-muted">
          <span>
            {lastExecution
              ? `last blade: ${lastExecution.person}`
              : lastReadingAt
                ? `last reading ${new Date(lastReadingAt).toISOString().slice(11, 16)} UTC`
                : "no reading yet"}
          </span>
          <span>00:30 and 12:30 UTC · readings can slip</span>
        </div>
      </div>
    </section>
  );
}
