"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyHate, type HateState } from "../lib/hateometer";
import { ALPHA, LEVEL_CEIL, LEVEL_FLOOR, MAX_STEP, SHRINK_M } from "../lib/clock";

/**
 * The second instrument: an arc gauge, not a blade.
 *
 * The clock counts what is being taken. This measures how unstable the ground
 * under it has become — war, civilian harm, repression, arms, incitement. The
 * arithmetic is on the instrument, not in a whitepaper: weights, evidence and
 * the exact step are all visible, because a number nobody can recompute is a
 * decoration.
 */

export function useHateometer() {
  const [state, setState] = useState<HateState>(emptyHate);

  const pull = useCallback(async (): Promise<HateState | null> => {
    try {
      const res = await fetch("/api/hateometer", { cache: "no-store" });
      if (!res.ok) return null;
      const next = (await res.json()) as HateState;
      setState(next);
      return next;
    } catch {
      /* keep the last good reading */
      return null;
    }
  }, []);

  useEffect(() => {
    pull();
    const id = setInterval(pull, 90 * 1000);
    return () => clearInterval(id);
  }, [pull]);

  return { state, pull };
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
  const evidence = state.dimensions.reduce((n, d) => n + d.evidence, 0);

  return (
    <section className="border border-chop-border bg-chop-card/60 p-5">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-chop-muted">
        <span>hateometer</span>
        <span className={state.stale ? "text-chop-muted" : "text-spiteCrimson"}>
          {state.stale ? "no reading" : "live"}
        </span>
      </div>
      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.22em] text-chop-muted/70">
        an instability index · {evidence} report{evidence === 1 ? "" : "s"} this pass
      </p>

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

      <div className="mt-5 space-y-3">
        {state.dimensions.map((d) => (
          <div key={d.key}>
            <div className="flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
              <span>
                {d.label}{" "}
                <span className="text-chop-muted/60">×{d.weight.toFixed(2)}</span>
              </span>
              <span className="tabular-nums text-sheetWhite">{Math.round(d.score)}</span>
            </div>
            <div className="mt-1 h-1 bg-chop-border">
              <div
                className="h-full bg-spiteCrimson transition-all duration-1000"
                style={{ width: `${d.score}%` }}
              />
            </div>
            <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.15em] text-chop-muted/60">
              {d.evidence} report{d.evidence === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </div>

      <details className="group mt-5 border-t border-chop-border pt-3">
        <summary className="cursor-pointer list-none font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted hover:text-sheetWhite">
          how this number is made <span className="text-spiteCrimson group-open:hidden">+</span>
          <span className="hidden text-spiteCrimson group-open:inline">−</span>
        </summary>

        <div className="mt-3 space-y-2 font-mono text-[9px] leading-relaxed text-chop-muted">
          <p>
            <span className="text-sheetWhite">1.</span> Each report is scored 0–100 and filed
            under one dimension.
          </p>
          <p>
            <span className="text-sheetWhite">2.</span> A dimension is the mean of its reports,
            pulled toward 50 until the evidence accumulates:{" "}
            <span className="text-sheetWhite">
              (n·mean + {SHRINK_M}·50) / (n + {SHRINK_M})
            </span>
            .
          </p>
          <p>
            <span className="text-sheetWhite">3.</span> Composite = Σ weight × dimension. This
            pass:{" "}
            <span className="text-sheetWhite tabular-nums">
              {state.composite.toFixed(1)}
            </span>
            .
          </p>
          <p>
            <span className="text-sheetWhite">4.</span> The reading moves{" "}
            {Math.round(ALPHA * 100)}% of the way to the composite, at most {MAX_STEP} points per
            pass, held between {LEVEL_FLOOR} and {LEVEL_CEIL}. This pass:{" "}
            <span className="text-sheetWhite tabular-nums">{state.level.toFixed(1)}</span>
            {" "}
            <span className={state.pressure >= 0 ? "text-spiteCrimson" : "text-hypeNeon"}>
              ({state.pressure >= 0 ? "+" : ""}
              {state.pressure.toFixed(1)})
            </span>
            .
          </p>
          <p className="pt-1 text-chop-muted/70">
            Same maths as the clock, opposite subject. It measures instability in the reporting,
            not guilt — the blade is Ada&apos;s judgement, and this is only the weather.
          </p>
        </div>
      </details>
    </section>
  );
}
