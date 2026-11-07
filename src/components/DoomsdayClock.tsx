"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLOCK_REFRESH_MS,
  emptyClock,
  type ClockState,
} from "../lib/clock";

/**
 * The blade.
 *
 * One guillotine, one number. The blade descends as the index rises and never
 * quite reaches the bottom — the installation is a pressure gauge, not a
 * promise. Pulls (expanding an item in the stack) nudge it a little further,
 * for the duration of the session only.
 */

const TRAVEL = 250; // px of blade travel inside the 420-unit viewBox

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function DoomsdayClock({
  state,
  pulls,
}: {
  state: ClockState;
  pulls: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Session pulls can push the blade a little further, capped at +4%.
  const displayPct = Math.min(99, state.bladePct + Math.min(pulls * 0.4, 4));
  const travel = (displayPct / 100) * TRAVEL;
  const shown = mounted ? travel : 0;

  const label = state.stale ? "AWAITING FIRST READING" : "LIVE";
  const dot = state.stale ? "bg-chop-muted" : "bg-hypeNeon";

  return (
    <section className="mx-auto mt-6 w-full max-w-5xl px-4 md:px-6">
      <div className="relative grid grid-cols-1 gap-6 border border-chop-border bg-chop-card/60 p-4 md:grid-cols-[300px_1fr] md:gap-10 md:p-8">
        {/* ── The machine ───────────────────────────────────────────── */}
        <div className="flex items-center justify-center">
          <svg
            viewBox="0 0 300 420"
            className="h-[300px] w-[214px] md:h-[380px] md:w-[272px]"
            role="img"
            aria-label={`Blade at ${Math.round(displayPct)} percent`}
          >
            <defs>
              <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E4E4E7" />
                <stop offset="45%" stopColor="#A1A1AA" />
                <stop offset="55%" stopColor="#52525B" />
                <stop offset="100%" stopColor="#27272A" />
              </linearGradient>
              <filter id="bladeGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* frame */}
            <rect x="18" y="16" width="264" height="16" fill="#18181B" stroke="#27272A" />
            <rect x="30" y="16" width="14" height="392" fill="#141416" stroke="#27272A" />
            <rect x="256" y="16" width="14" height="392" fill="#141416" stroke="#27272A" />

            {/* rope */}
            <line
              x1="150"
              y1="32"
              x2="150"
              y2={60 + shown}
              stroke="#3F3F46"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* blade */}
            <g
              style={{
                transform: `translateY(${shown}px)`,
                transition: "transform 1.4s cubic-bezier(.22,1,.36,1)",
              }}
              filter="url(#bladeGlow)"
            >
              <rect x="44" y="60" width="212" height="24" fill="url(#steel)" />
              <path d="M44 84 L256 84 L150 116 Z" fill="#7F1D1D" />
              <path d="M44 84 L256 84 L150 116 Z" fill="url(#steel)" opacity="0.35" />
              <line x1="44" y1="84" x2="256" y2="84" stroke="#F4F4F5" strokeWidth="1.5" opacity="0.8" />
            </g>

            {/* the line it is aiming at */}
            <line
              x1="44"
              y1="330"
              x2="256"
              y2="330"
              stroke="#E11D48"
              strokeWidth="2"
              strokeDasharray="10 6"
              opacity="0.5"
            />
            <text
              x="150"
              y="352"
              textAnchor="middle"
              fill="#71717A"
              fontSize="9"
              letterSpacing="3"
              fontFamily="monospace"
            >
              THE LINE
            </text>
          </svg>
        </div>

        {/* ── The readout ───────────────────────────────────────────── */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-chop-muted">
            <span className={`h-1.5 w-1.5 ${dot} ${state.stale ? "" : "animate-pulse"}`} />
            {label}
            <span className="ml-auto hidden sm:inline">
              {state.computedAt
                ? `read ${new Date(state.computedAt).toUTCString().slice(17, 22)} UTC`
                : "no reading"}
            </span>
          </div>

          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-chop-muted">
            T&nbsp;–&nbsp;MINUS
          </div>
          <div className="font-mono text-6xl font-black leading-none tracking-tighter text-sheetWhite md:text-8xl">
            {state.tMinus}
          </div>

          <div className="mt-5 flex items-end gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">
                blade
              </div>
              <div className="font-mono text-2xl font-black text-spiteCrimson">
                {Math.round(displayPct)}%
              </div>
            </div>
            <div className="h-10 w-px bg-chop-border" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">
                readings
              </div>
              <div className="font-mono text-2xl font-black text-sheetWhite">
                {state.items.length}
              </div>
            </div>
            <div className="h-10 w-px bg-chop-border" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">
                pulls
              </div>
              <div className="font-mono text-2xl font-black text-hypeNeon">{pulls}</div>
            </div>
          </div>

          <p className="mt-5 max-w-md font-mono text-[11px] leading-relaxed text-chop-muted">
            The blade is a weighted average of what the world did in the last four
            hours. It is not a metaphor you can vote on. Pull an item below and it
            moves.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Fetches the reading and keeps it fresh. Data changes every four hours; the
 * poll only exists so the dial is correct when someone leaves a tab open.
 */
export function useClock() {
  const [state, setState] = useState<ClockState>(emptyClock);
  const [pulls, setPulls] = useState(0);
  const seen = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/clock", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as ClockState;
        if (!cancelled) {
          setState(next);
          seen.current = true;
        }
      } catch {
        /* keep the last good reading */
      }
    };

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const nextRun = useMemo(() => {
    if (!state.computedAt) return null;
    return new Date(Date.parse(state.computedAt) + CLOCK_REFRESH_MS);
  }, [state.computedAt]);

  return { state, pulls, pull: () => setPulls((n) => n + 1), nextRun };
}
