"use client";

import { useSiteContent } from "../lib/use-site-content";
import type { FlywheelTone } from "../lib/content";

const FLYWHEEL_TONE_CLASSES: Record<FlywheelTone, { color: string; textColor: string }> = {
  red: { color: "border-[#ef4444]/40 bg-[#ef4444]/10", textColor: "text-[#ef4444]" },
  amber: { color: "border-[#f59e0b]/40 bg-[#f59e0b]/10", textColor: "text-[#f59e0b]" },
  crimson: { color: "border-[#E11D48]/40 bg-[#E11D48]/10", textColor: "text-[#E11D48]" },
  violet: { color: "border-[#8b5cf6]/40 bg-[#8b5cf6]/10", textColor: "text-[#8b5cf6]" },
  blue: { color: "border-[#3b82f6]/40 bg-[#3b82f6]/10", textColor: "text-[#3b82f6]" },
  green: { color: "border-[#22c55e]/40 bg-[#22c55e]/10", textColor: "text-[#22c55e]" },
  pink: { color: "border-[#ec4899]/40 bg-[#ec4899]/10", textColor: "text-[#ec4899]" },
};

export function AngerFlywheel() {
  const { content } = useSiteContent();

  return (
    <div className="my-8">
      {/* Title */}
      <div className="mb-6 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#E11D48]">
          The Anger-to-Money Flywheel
        </p>
        <p className="mt-1 text-xs text-[#818384]">
          How your emotional instability generates actual financial returns
        </p>
      </div>

      {/* Circular flow */}
      <div className="relative mx-auto max-w-2xl">
        {/* Center label */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#E11D48]/50 bg-[#1A1A1B] shadow-[0_0_20px_rgba(225,29,72,0.15)]">
            <span className="text-xs font-black uppercase tracking-wider text-[#E11D48]">
              $CHOP
            </span>
          </div>
        </div>

        {/* Steps positioned in a circle */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {content.flywheel.map((step, i) => (
            <div
              key={i}
              className={`relative rounded-lg border ${FLYWHEEL_TONE_CLASSES[step.tone].color} p-3 transition-all hover:scale-[1.02]`}
            >
              {/* Step number badge */}
              <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1B] text-[9px] font-bold text-[#818384] ring-1 ring-[#343536]">
                {i + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg">{step.emoji}</span>
                <span className={`text-[10px] font-black uppercase tracking-wider ${FLYWHEEL_TONE_CLASSES[step.tone].textColor}`}>
                  {step.label}
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#818384]">
                {step.detail}
              </p>

              {/* Arrow to next step (except last → first handled by circular layout) */}
              {i < content.flywheel.length - 1 && (
                <div className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 sm:block">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8h8M10 4l4 4-4 4" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom: loop back arrow */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <svg width="80" height="24" viewBox="0 0 80 24" fill="none" className="opacity-50">
            <path
              d="M2 12h60c8 0 12-8 0-8"
              stroke="#E11D48"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
            />
            <path d="M56 4l4 4-4 4" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#E11D48]">
            Anger Renewed — Repeat Forever
          </span>
          <svg width="80" height="24" viewBox="0 0 80 24" fill="none" className="rotate-180 opacity-50">
            <path
              d="M2 12h60c8 0 12-8 0-8"
              stroke="#E11D48"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
            />
            <path d="M56 4l4 4-4 4" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* The math */}
      <div className="mt-6 rounded-lg border border-[#343536] bg-[#343536]/30 p-4 text-center">
        <p className="text-[11px] leading-relaxed text-[#818384]">
          <span className="font-bold text-[#D7DADC]">The Equation:</span>{" "}
          <span className="text-[#ef4444]">Anger</span> →{" "}
          <span className="text-[#f59e0b]">Buy $CHOP</span> →{" "}
          <span className="text-[#E11D48]">Burn</span> →{" "}
          <span className="text-[#22c55e]">Supply ↓</span> →{" "}
          <span className="text-[#3b82f6]">Price ↑</span> →{" "}
          <span className="text-[#ec4899]">More attention</span> →{" "}
          <span className="text-[#ef4444]">More anger</span> →{" "}
          <span className="font-black text-[#D7DADC]">∞</span>
        </p>
        <p className="mt-1 text-[10px] italic text-[#666]">
          This is not financial advice. This is emotional arbitrage.
        </p>
      </div>
    </div>
  );
}
