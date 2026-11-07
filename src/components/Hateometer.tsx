"use client";

import { useEffect, useState } from "react";
import { emptyHate, type HateState } from "../lib/hateometer";

/**
 * The second instrument: an arc gauge, not a blade. The clock counts what is
 * being taken; this measures what is being done about it, by force.
 */

export function useHateometer() {
  const [state, setState] = useState<HateState>(emptyHate);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/hateometer", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as HateState;
        if (!cancelled) setState(next);
      } catch {
        /* keep the last good reading */
      }
    };
    load();
    const id = setInterval(load, 90 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}

function needleAngle(level: number) {
  return -90 + (Math.max(0, Math.min(100, level)) / 100) * 180;
}

export function Hateometer({ state }: { state: HateState }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const angle = mounted ? needleAngle(state.level) : -90;

  return (
    <section className="border border-chop-border bg-chop-card/60 p-5">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-chop-muted">
        <span>hateometer</span>
        <span className={state.stale ? "text-chop-muted" : "text-spiteCrimson"}>
          {state.stale ? "no reading" : "live"}
        </span>
      </div>

      <div className="relative mt-4 flex justify-center">
        <svg viewBox="0 0 240 140" className="w-full max-w-[280px]" role="img" aria-label={`Hateometer ${state.level}`}>
          <path
            d="M20 120 A100 100 0 0 1 220 120"
            fill="none"
            stroke="#27272A"
            strokeWidth="10"
          />
          <path
            d="M20 120 A100 100 0 0 1 220 120"
            fill="none"
            stroke="#E11D48"
            strokeWidth="10"
            strokeDasharray={`${(state.level / 100) * 314} 314`}
            opacity="0.9"
          />
          {[0, 25, 50, 75, 100].map((t) => {
            const a = ((180 - (t / 100) * 180) * Math.PI) / 180;
            const x1 = 120 + Math.cos(a) * 86;
            const y1 = 120 - Math.sin(a) * 86;
            const x2 = 120 + Math.cos(a) * 76;
            const y2 = 120 - Math.sin(a) * 76;
            return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#52525B" strokeWidth="1.5" />;
          })}
          <g
            style={{
              transform: `rotate(${angle}deg)`,
              transformOrigin: "120px 120px",
              transition: "transform 1.6s cubic-bezier(.22,1,.36,1)",
            }}
          >
            <line x1="120" y1="120" x2="120" y2="38" stroke="#F4F4F5" strokeWidth="2.5" />
          </g>
          <circle cx="120" cy="120" r="6" fill="#E11D48" />
        </svg>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <div className="font-mono text-4xl font-black leading-none text-sheetWhite">
            {Math.round(state.level)}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-chop-muted">
            {state.pressure > 1 ? "rising" : state.pressure < -1 ? "easing" : "holding"}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {state.dimensions.map((d) => (
          <div key={d.key}>
            <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
              <span>{d.label}</span>
              <span className="tabular-nums text-sheetWhite">{Math.round(d.score)}</span>
            </div>
            <div className="mt-1 h-1 bg-chop-border">
              <div
                className="h-full bg-spiteCrimson transition-all duration-1000"
                style={{ width: `${d.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 font-mono text-[10px] leading-relaxed text-chop-muted">
        Weighted average of what is being reported, shrunk toward neutral until the
        evidence accumulates. Same maths as the clock, opposite subject.
      </p>
    </section>
  );
}
