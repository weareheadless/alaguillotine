"use client";

import { useEffect, useState } from "react";
import { DOOM_RATES as RATES } from "@/lib/doom-rates";

/**
 * The accumulating rail.
 *
 * The feed's meter used to sit above the stream and scroll away. This one stays
 * beside it, so the numbers keep moving while you read. Each is an annual figure
 * with a named source divided by the seconds in a year — an extrapolation, not
 * a live measurement, and labelled as one.
 *
 * The start time is kept in sessionStorage so the totals survive navigation and
 * reloads within the tab: the session is the unit, not the page view.
 *
 * There is deliberately no extinction ticker. A per-second extinction rate is
 * not measured by anyone; the honest figures are a fifty-year population decline
 * and a count of assessed species, both static.
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

export function DoomRail({
  stats,
  className = "",
}: {
  stats: { receipts: number; names: number; dispatches: number };
  className?: string;
}) {
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
    <>
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
        <Row
          label="military spending"
          value={`$${num(elapsed * RATES.military)}`}
          source="$2,887B in 2025 · SIPRI 2026"
          tone="#F59E0B"
        />
        <Row
          label="fossil-fuel subsidies"
          value={`$${num(elapsed * RATES.subsidies)}`}
          source="$7.4tn in 2024 · IMF 2025"
          tone="#FB7185"
        />

        <div id="doom-method" className="scroll-mt-28 border-t-2 border-chop-border px-3 py-2.5">
          <p className="font-mono text-[8px] leading-relaxed text-chop-muted">
            <span className="font-black uppercase tracking-[0.16em] text-sheetWhite">
              wildlife:
            </span>{" "}
            the 2024 Living Planet Index reports a 73% average decline in
            monitored vertebrate populations between 1970 and 2020 — not 73% of
            species extinct. 49,500+ species are assessed as threatened (IUCN
            Red List). No extinction ticker: nobody measures extinctions per
            second, and a number that ticked would be invented. The record:{" "}
            {stats.receipts.toLocaleString()} receipts ·{" "}
            {stats.names.toLocaleString()} names ·{" "}
            {stats.dispatches.toLocaleString()} dispatches.
          </p>
          <details className="mt-2 text-[10px] text-chop-muted">
            <summary className="cursor-pointer font-mono text-[8px] uppercase tracking-[0.14em]">
              sources &amp; what these counters mean
            </summary>
            <p className="mt-2 text-[9px] leading-relaxed">
              Annual estimates divided by time, not live measurements or deaths
              verified during your visit. Wealth uses Oxfam&rsquo;s rounded daily
              rate; emissions the 2025 projection; deforestation a 2015–2025
              average; air-pollution mortality attributable premature mortality,
              not a count of murders; military spending and subsidies the latest
              annual totals.
            </p>
            <ul className="mt-2 space-y-1.5 text-[9px] underline">
              <li>
                <a href="https://www.oxfam.org/en/press-releases/billionaire-wealth-surges-2-trillion-2024-three-times-faster-year-while-number" target="_blank" rel="noreferrer">
                  Oxfam · 2024 wealth growth
                </a>
              </li>
              <li>
                <a href="https://globalcarbonbudget.org/fossil-fuel-co2-emissions-hit-record-high-in-2025/" target="_blank" rel="noreferrer">
                  Global Carbon Budget · 2025 projection
                </a>
              </li>
              <li>
                <a href="https://www.fao.org/forest-resources-assessment/en/" target="_blank" rel="noreferrer">
                  FAO · Forest Resources Assessment 2025
                </a>
              </li>
              <li>
                <a href="https://www.stateofglobalair.org/" target="_blank" rel="noreferrer">
                  State of Global Air · 2025 report
                </a>
              </li>
              <li>
                <a href="https://www.sipri.org/publications/2026/sipri-fact-sheets/trends-world-military-expenditure-2025" target="_blank" rel="noreferrer">
                  SIPRI · world military expenditure 2025
                </a>
              </li>
              <li>
                <a href="https://www.imf.org/-/media/files/publications/wp/2025/english/wpiea2025270-source-pdf.pdf" target="_blank" rel="noreferrer">
                  IMF · fossil fuel subsidies, 2025 update
                </a>
              </li>
              <li>
                <a href="https://livingplanet.panda.org/" target="_blank" rel="noreferrer">
                  WWF · Living Planet Report 2024
                </a>
              </li>
              <li>
                <a href="https://www.iucnredlist.org/" target="_blank" rel="noreferrer">
                  IUCN · Red List of Threatened Species
                </a>
              </li>
            </ul>
          </details>
        </div>
      </aside>

      {/* The phone gets the numbers without the rail: a fixed strip, the same
          rates, so the data is still moving while the feed is scrolled. The
          wrapper hides it on desktop; `.doom-pocket` sets display itself, so
          the breakpoint belongs on the parent. */}
      <div className="xl:hidden">
        <div className="doom-pocket" aria-label="Session estimates">
          <span>{clock(elapsed)} HERE</span>
          <b>+${num(elapsed * RATES.wealth)}</b>
          <span>wealth</span>
          <b>{num(elapsed * RATES.co2)} t</b>
          <span>CO₂</span>
          <a href="#doom-method">Estimates ↗</a>
        </div>
      </div>
    </>
  );
}
