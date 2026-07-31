"use client";

export function AngerFlywheel() {
  const steps = [
    {
      emoji: "😡",
      label: "ANGER",
      detail: "Billionaire does something infuriating. You feel rage. The algorithm amplifies it.",
      color: "border-[#ef4444]/40 bg-[#ef4444]/10",
      textColor: "text-[#ef4444]",
    },
    {
      emoji: "🛒",
      label: "BUY $CHOP",
      detail: "You acquire $CHOP on the market. Every buy creates upward price pressure. Anger = demand.",
      color: "border-[#f59e0b]/40 bg-[#f59e0b]/10",
      textColor: "text-[#f59e0b]",
    },
    {
      emoji: "🔥",
      label: "BURN TO POST",
      detail: "You burn $CHOP to immortalize your hate. Tokens leave circulation. Supply drops. Your bag appreciates.",
      color: "border-[#E11D48]/40 bg-[#E11D48]/10",
      textColor: "text-[#E11D48]",
    },
    {
      emoji: "🐳",
      label: "TREASURY FUNDED",
      detail: "Your burn also funds the Treasury. Free users' messages now burn tokens too. You're a patron.",
      color: "border-[#8b5cf6]/40 bg-[#8b5cf6]/10",
      textColor: "text-[#8b5cf6]",
    },
    {
      emoji: "📊",
      label: "COUNTER RISES",
      detail: "Every burn advances the blade. The guillotine inches closer. Progress is visible. FOMO builds.",
      color: "border-[#3b82f6]/40 bg-[#3b82f6]/10",
      textColor: "text-[#3b82f6]",
    },
    {
      emoji: "🎲",
      label: "BET ON DROP",
      detail: "Prediction market opens. People buy $CHOP to bet YES/NO. More demand. More deflation.",
      color: "border-[#22c55e]/40 bg-[#22c55e]/10",
      textColor: "text-[#22c55e]",
    },
    {
      emoji: "⚔️",
      label: "BLADE DROPS",
      detail: "Threshold reached. YES bets win. Winners profit in $CHOP. Losers get angrier. Cycle accelerates.",
      color: "border-[#ec4899]/40 bg-[#ec4899]/10",
      textColor: "text-[#ec4899]",
    },
    {
      emoji: "💀",
      label: "LOSERS GET ANGRIER",
      detail: "Bets lost. Bag dumped. Rage renewed. They buy more $CHOP to scream louder. The wheel spins.",
      color: "border-[#ef4444]/40 bg-[#ef4444]/10",
      textColor: "text-[#ef4444]",
    },
  ];

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
          {steps.map((step, i) => (
            <div
              key={i}
              className={`relative rounded-lg border ${step.color} p-3 transition-all hover:scale-[1.02]`}
            >
              {/* Step number badge */}
              <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1A1A1B] text-[9px] font-bold text-[#818384] ring-1 ring-[#343536]">
                {i + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg">{step.emoji}</span>
                <span className={`text-[10px] font-black uppercase tracking-wider ${step.textColor}`}>
                  {step.label}
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#818384]">
                {step.detail}
              </p>

              {/* Arrow to next step (except last → first handled by circular layout) */}
              {i < steps.length - 1 && (
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
