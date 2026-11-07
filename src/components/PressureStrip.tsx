"use client";

import { useEffect, useState } from "react";
import type { ClockState } from "../lib/clock";

/**
 * The pressure strip.
 *
 * The blade only moves once every four hours, but the gap between what the last
 * reading measured and where the blade actually sits is real, and it is the
 * thing that decides the next move. This shows that gap, the headlines that
 * created it, and how long until it is spent.
 */

function until(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return "due";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}

export function PressureStrip({ state }: { state: ClockState }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const level = Math.max(0, Math.min(100, state.level));
  const target = Math.max(0, Math.min(100, state.composite));
  const delta = Math.round((state.composite - state.level) * 10) / 10;
  const direction = delta > 1 ? "falling" : delta < -1 ? "recovering" : "holding";
  const drivers = [...state.items].sort((a, b) => b.rage - a.rage).slice(0, 3);

  return (
    <section className="border border-chop-border bg-chop-card/40 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
        <span>
          pressure <span className="text-sheetWhite">·</span>{" "}
          <span className={delta > 1 ? "text-spiteCrimson" : delta < -1 ? "text-hypeNeon" : "text-sheetWhite"}>
            {direction}
          </span>
        </span>
        <span>
          next reading in <span className="text-sheetWhite">{until(state.nextRunAt)}</span>
        </span>
      </div>

      <div className="relative mt-3 h-2 bg-chop-border">
        <div
          className="absolute inset-y-0 left-0 bg-sheetWhite/25"
          style={{ width: `${level}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-spiteCrimson"
          style={{
            width: `${Math.min(level, target)}%`,
            transition: "width 2s cubic-bezier(.22,1,.36,1)",
          }}
        />
        <div
          className="absolute -top-1 h-4 w-0.5 bg-sheetWhite"
          style={{ left: `${target}%`, transition: "left 2s cubic-bezier(.22,1,.36,1)" }}
          aria-hidden
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
        <span>
          blade <span className="text-sheetWhite tabular-nums">{Math.round(level)}</span>
        </span>
        <span className={delta > 1 ? "text-spiteCrimson" : delta < -1 ? "text-hypeNeon" : ""}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
        <span>
          reading <span className="text-sheetWhite tabular-nums">{Math.round(target)}</span>
        </span>
      </div>

      {drivers.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-chop-border pt-3">
          {drivers.map((item) => (
            <li key={item.id} className="flex items-baseline gap-2 font-mono text-[10px]">
              <span className="w-6 shrink-0 tabular-nums text-spiteCrimson">{item.rage}</span>
              <span className="truncate text-chop-muted">
                <span className="text-sheetWhite/70">{item.source}</span> · {item.headline}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
