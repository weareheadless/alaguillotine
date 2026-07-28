"use client";

export function RulesBanner() {
  return (
    <div className="mx-auto w-full">
      <div className="border-2 border-spiteCrimson/30 bg-spiteCrimson/5 px-4 py-3 font-mono">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg">⚠️</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-spiteCrimson">
              // HOW IT WORKS
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-chop-muted">
              Interactive satirical class warfare. Every message inches the blade downward and votes for the next target. Even if you post for free, your message actively burns treasury capital and funds an ongoing economic experiment in wealth redistribution.
            </p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-spiteCrimson">
              // RULES
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-chop-muted">
              Swearing is fine. Doxxing, credible threats, and illegal content are not. Violators get shadowbanned. The blade is metaphorical. Always has been.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
