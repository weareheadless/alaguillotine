"use client";

import { useEffect, useState } from "react";
import { DOOM_RATES as RATES } from "@/lib/doom-rates";

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
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="border-y-2 border-black bg-canvasBlack">
      <div className="doom-pocket" aria-label="Session estimates">
        <span>{clock(elapsed)} HERE</span>
        <b>+${num(elapsed * RATES.wealth)}</b><span>wealth</span>
        <b>{num(elapsed * RATES.co2)} t</b><span>CO₂</span>
        <a href="#doom-method">Estimates ↗</a>
      </div>
      <div className="mx-auto max-w-3xl px-4 pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
          <span className="font-mono text-[9px] font-black uppercase tracking-[0.3em] text-spiteCrimson">
            while you’re here · estimated at historical rates
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
          label="deforestation"
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
      <div id="doom-method" className="mx-auto max-w-3xl px-4 pb-3 pt-2 scroll-mt-36">
        <p className="font-mono text-[8.5px] leading-relaxed text-chop-muted">
          <span className="font-black uppercase tracking-[0.18em] text-sheetWhite">
            wildlife:
          </span>{" "}
          The 2024 Living Planet Index reports a 73% average decline in monitored
          vertebrate population sizes between 1970 and 2020—not 73% of animals or
          species extinct. No extinction ticker. The
          record: {stats.receipts.toLocaleString()} receipts ·{" "}
          {stats.names.toLocaleString()} names · {stats.dispatches.toLocaleString()}{" "}
          dispatches.
        </p>
        <details className="mt-2 text-[10px] text-chop-muted">
          <summary className="cursor-pointer">Sources & what these counters mean</summary>
          <p className="mt-2">Annual estimates divided by time, not live measurements or deaths verified during your visit. Wealth uses Oxfam’s rounded daily rate; emissions use the 2025 projection; deforestation is a 2015–2025 average. Air-pollution mortality is attributable premature mortality, not a count of murders.</p>
          <ul className="mt-2 space-y-2 underline">
            <li><a href="https://www.oxfam.org/en/press-releases/billionaire-wealth-surges-2-trillion-2024-three-times-faster-year-while-number" target="_blank" rel="noreferrer">Oxfam · 2024 wealth growth</a></li>
            <li><a href="https://globalcarbonbudget.org/fossil-fuel-co2-emissions-hit-record-high-in-2025/" target="_blank" rel="noreferrer">Global Carbon Budget · 2025 projection</a></li>
            <li><a href="https://www.fao.org/forest-resources-assessment/en/" target="_blank" rel="noreferrer">FAO · Forest Resources Assessment 2025</a></li>
            <li><a href="https://www.stateofglobalair.org/" target="_blank" rel="noreferrer">State of Global Air · 2025 report, 2023 mortality</a></li>
            <li><a href="https://livingplanet.panda.org/" target="_blank" rel="noreferrer">WWF · Living Planet Report 2024</a></li>
          </ul>
        </details>
      </div>
    </section>
  );
}
