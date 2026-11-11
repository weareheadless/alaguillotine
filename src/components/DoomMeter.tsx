"use client";

import { useEffect, useState } from "react";

/**
 * The doom meter.
 *
 * Four numbers, all derived from an annual figure with a named source, divided
 * by the seconds in a year. They tick because the year is always happening.
 *
 * Species loss is deliberately not one of them. There is no honest per-second
 * extinction count; the best measure is a fifty-year percentage, and a ticker
 * would be a lie. The refusal is part of the meter.
 */

const YEAR = 31_557_600;

const RATES = {
  // Oxfam 2025: billionaire wealth +$2T in 2024 ≈ $5.7B a day.
  wealth: 5.7e9 / 86_400,
  // Global Carbon Budget 2025: 38.1 Gt of fossil CO2 in 2025.
  co2: 38.1e9 / YEAR,
  // FAO 2025: 10.9 Mha of deforestation a year, 2015–2025.
  forest: (10.9e6 * 10_000) / YEAR,
  // State of Global Air 2025: 7.9M deaths from air pollution in 2023.
  deaths: 7.9e6 / YEAR,
};

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function num(value: number): string {
  return Math.floor(value).toLocaleString("en-US");
}

function Cell({
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
    <div className="bg-canvasBlack px-3 py-2.5">
      <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-chop-muted">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-lg font-black tabular-nums leading-none md:text-xl"
        style={{ color: tone }}
      >
        {value}
      </div>
      <div className="mt-1 text-[7px] uppercase tracking-[0.12em] text-chop-muted/70">
        {source}
      </div>
    </div>
  );
}

export function DoomMeter({
  stats,
}: {
  stats: { wire: number; names: number; receipts: number; dispatches: number };
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="border-y-2 border-black bg-canvasBlack">
      <div className="mx-auto max-w-3xl px-4 pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.3em] text-spiteCrimson">
            doom · since you arrived
          </span>
          <span className="font-mono text-[10px] font-bold tabular-nums text-sheetWhite">
            {clock(elapsed)}
          </span>
        </div>
      </div>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-px bg-chop-border md:grid-cols-4">
        <Cell
          label="billionaire wealth"
          value={`$${num(elapsed * RATES.wealth)}`}
          source="+$5.7B/day · Oxfam 2025"
          tone="#E11D48"
        />
        <Cell
          label="fossil CO₂"
          value={`${num(elapsed * RATES.co2)} t`}
          source="38.1 Gt/yr · Global Carbon Budget"
          tone="#F4F4F5"
        />
        <Cell
          label="forest"
          value={`${num(elapsed * RATES.forest)} m²`}
          source="10.9 Mha/yr · FAO 2025"
          tone="#22C55E"
        />
        <Cell
          label="air-pollution deaths"
          value={(elapsed * RATES.deaths).toFixed(1)}
          source="7.9M/yr · State of Global Air"
          tone="#60A5FA"
        />
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-3 pt-2">
        <p className="font-mono text-[8.5px] leading-relaxed text-chop-muted">
          <span className="font-black uppercase tracking-[0.18em] text-sheetWhite">
            species lost:
          </span>{" "}
          no per-second number. The Living Planet Index is −73% since 1970, and
          anyone selling you an extinction ticker is selling something. The
          record: {stats.receipts.toLocaleString()} receipts ·{" "}
          {stats.names.toLocaleString()} names · {stats.dispatches.toLocaleString()}{" "}
          dispatches.
        </p>
      </div>
    </section>
  );
}
