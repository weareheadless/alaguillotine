"use client";

export function RulesBanner() {
  return (
    <div className="mx-auto w-full">
      <div className="border-2 border-spiteCrimson/30 bg-spiteCrimson/5 px-4 py-3 font-mono">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg">⚠️</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-spiteCrimson">
              // Community Rules & Legal Notice
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-chop-muted">
              This site is a work of political satire and artistic symbolism. Metaphorical imagery (e.g., guillotines) represents systemic power structures, not literal threats. Swearing is fine. Doxxing, credible threats of real-world violence, and illegal content are strictly prohibited. Violators will be silently shadowbanned by an AI moderator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
