"use client";

import { useEffect, useRef, useState } from "react";
import { DROP_THRESHOLD, type Figure } from "@/lib/hateometer";

/**
 * One bar for the whole pulse: Ada's mood, her line, and the next event.
 *
 * When a name is sentenced it counts to the blade (crimson). Otherwise it
 * counts to the next reading (green), when the queue is rewritten. The old
 * two full-width bands said the same thing with more air.
 */
export interface StatusExecution {
  person: string;
  slug: string;
  score: number;
  sentencedAt: string;
  executeAt: string;
  secondsLeft: number;
}

export interface StatusToolbarProps {
  mood: string;
  line: string;
  execution?: StatusExecution | null;
  nextRunAt: string | null;
  figures: Figure[];
  onZero: (slug: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/** Next 00:30 or 12:30 UTC, if the server has not sent a reading time yet. */
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

/** The shortest line that still says where the queue stands. */
export function queueNote(figures: Figure[]): string {
  const top = figures[0];
  if (!top) return "";
  const ready = figures.filter((f) => f.score >= DROP_THRESHOLD).length;
  if (ready > 0) return `${ready} past ${DROP_THRESHOLD}`;
  const gap = Math.ceil(DROP_THRESHOLD - top.score);
  return `top ${top.name} ${top.score} · ${gap} from ${DROP_THRESHOLD}`;
}

export function StatusToolbar({
  mood,
  line,
  execution,
  nextRunAt,
  figures,
  onZero,
}: StatusToolbarProps) {
  const target = execution
    ? Date.parse(execution.executeAt)
    : (() => {
        if (nextRunAt) {
          const parsed = Date.parse(nextRunAt);
          if (Number.isFinite(parsed)) return parsed;
        }
        return Date.parse(fallbackNextRun(new Date()));
      })();

  const total = execution
    ? Math.max(
        1,
        Math.round(
          (Date.parse(execution.executeAt) - Date.parse(execution.sentencedAt)) / 1000,
        ),
      )
    : 12 * 60 * 60;

  const [left, setLeft] = useState<number | null>(null);
  const fired = useRef(false);
  const zero = useRef(onZero);

  useEffect(() => {
    zero.current = onZero;
  }, [onZero]);

  useEffect(() => {
    fired.current = false;
    const tick = () => {
      const next = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setLeft(next);
      if (next <= 0 && execution && !fired.current) {
        fired.current = true;
        zero.current(execution.slug);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [target, execution]);

  const running = left != null && left <= 0;
  const pct =
    left == null ? 0 : Math.max(0, Math.min(100, ((total - left) / total) * 100));
  const accent = execution ? "text-spiteCrimson" : "text-hypeNeon";
  const bar = execution ? "bg-spiteCrimson" : "bg-hypeNeon";
  const label = execution
    ? running
      ? "the blade is falling"
      : "until the blade"
    : running
      ? "reading now"
      : "until the next reading";

  const moodEl = () => (
    <div className="flex shrink-0 items-baseline gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
        ada is
      </span>
      <span className="font-mono text-lg font-black uppercase tracking-tight text-spiteCrimson md:text-xl">
        {mood || "reading"}
      </span>
    </div>
  );

  const clockEl = () => (
    <div className="shrink-0 text-right">
      <div
        className={`font-mono text-2xl font-black tabular-nums leading-none md:text-3xl ${accent}`}
      >
        {left == null ? "--:--" : running ? "—" : clock(left)}
      </div>
      <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-chop-muted">
        {label}
      </div>
    </div>
  );

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4 md:px-6">
      <div
        className="border-2 border-chop-border bg-sheetWhite/[0.02]"
        title={
          execution
            ? `${execution.person}, sentenced at ${new Date(execution.sentencedAt).toISOString().slice(11, 16)} UTC`
            : `Readings at 00:30 and 12:30 UTC; blades at 01:00 and 13:00 UTC. ${queueNote(figures) || "Estimates can slip."}`
        }
      >
        <div className="px-4 py-2.5 md:px-6">
          {/* Phone: mood and clock on one line, her sentence underneath. */}
          <div className="flex items-center justify-between gap-3 md:hidden">
            {moodEl()}
            {clockEl()}
          </div>
          <p className="mt-1.5 font-mono text-[11px] leading-snug text-sheetWhite/85 md:hidden">
            {line || "No reading yet. The machine is still looking."}
          </p>

          {/* Desktop: everything on one line. */}
          <div className="hidden items-center gap-4 md:flex">
            {moodEl()}
            <span className="h-5 w-px bg-chop-border" aria-hidden />
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] leading-snug text-sheetWhite/85">
              {line || "No reading yet. The machine is still looking."}
            </p>
            {clockEl()}
          </div>
        </div>

        <div className="h-1 w-full bg-chop-border">
          <div
            className={`h-full transition-[width] duration-500 ease-linear ${bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
