"use client";

import { useEffect, useRef, useState } from "react";
import { DROP_THRESHOLD, type Figure } from "@/lib/hateometer";

/**
 * The blade clock.
 *
 * It sits in the queue header, above the card, so the countdown belongs to the
 * name it is counting down to. The old mood/line/clock strip is gone; the mood
 * lives in the control deck now.
 */
export interface StatusExecution {
  person: string;
  slug: string;
  score: number;
  sentencedAt: string;
  executeAt: string;
  secondsLeft: number;
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

export function BladeClock({
  execution,
  nextRunAt,
  onZero,
  compact = false,
}: {
  execution?: StatusExecution | null;
  nextRunAt: string | null;
  onZero: (slug: string) => void;
  compact?: boolean;
}) {
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

  return (
    <div className="shrink-0 text-right">
      <div
        className={`font-mono font-black tabular-nums leading-none ${accent} ${
          compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
        }`}
      >
        {left == null ? "--:--" : running ? "—" : clock(left)}
      </div>
      <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-chop-muted">
        {label}
      </div>
      <div className="mt-1 h-1 w-full bg-chop-border">
        <div
          className={`h-full transition-[width] duration-500 ease-linear ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
