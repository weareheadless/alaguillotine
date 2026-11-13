"use client";

import { useEffect, useState } from "react";
import { DOOM_RATES as RATES } from "@/lib/doom-rates";

/**
 * The accumulating rail.
 *
 * The feed's meter scrolls away with the header; this one stays next to the
 * stream, so the numbers keep moving while you read. Each is an annual figure
 * with a named source divided by the seconds in a year — an extrapolation, not
 * a live measurement, and labelled as one.
 *
 * The start time is kept in sessionStorage so the totals survive navigation
 * and reloads within the tab: the session is the unit, not the page view.
 */

const KEY = "doom-session-start";

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function num(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

function Row({
  label,
  value,
  source,
  tone,
}: {
  label: string;
  value: string;
  source: string;
  tone: string;
}) {
  return (
    <div className="border-b border-chop-border/70 px-3 py-2.5 last:border-b-0">
      <div className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-chop-muted">
        {label}
      </div>
      <div
        className="mt-0.5 font-mono text-lg font-black tabular-nums leading-none"
        style={{ color: tone }}
      >
        {value}
      </div>
      <div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-chop-muted/60">
        {source}
      </div>
    </div>
  );
}

export function DoomRail({ className = "" }: { className?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let start = Number(sessionStorage.getItem(KEY));
    if (!Number.isFinite(start) || start <= 0 || start > Date.now()) {
      start = Date.now();
      try {
        sessionStorage.setItem(KEY, String(start));
      } catch {
        /* private mode: the session starts with the mount */
      }
    }
    const tick = () => setElapsed(Math.max(0, (Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside
      aria-label="Session estimates at historical rates"
      className={`border-2 border-chop-border bg-white/[0.03] ${className}`}
    >
      <header className="border-b-2 border-chop-border px-3 py-2">
        <h2 className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-hypeNeon">
          still accumulating
        </h2>
        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-chop-muted">
          {clock(elapsed)} in this session
        </p>
      </header>

      <Row
        label="billionaire wealth"
        value={`$${num(elapsed * RATES.wealth)}`}
        source="+$5.7B/day · Oxfam 2025"
        tone="#E11D48"
      />
      <Row
        label="fossil CO₂"
        value={`${num(elapsed * RATES.co2)} t`}
        source="38.1 Gt/yr · Global Carbon Budget"
        tone="#F4F4F5"
      />
      <Row
        label="deforestation"
        value={`${num(elapsed * RATES.forest)} m²`}
        source="10.9 Mha/yr · FAO 2025"
        tone="#22C55E"
      />
      <Row
        label="air-pollution deaths"
        value={(elapsed * RATES.deaths).toFixed(1)}
        source="7.9M/yr · State of Global Air"
        tone="#60A5FA"
      />

      <footer className="px-3 py-2">
        <a
          href="#doom-method"
          className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
        >
          an extrapolation, not a live count · sources ↑
        </a>
      </footer>
    </aside>
  );
}
