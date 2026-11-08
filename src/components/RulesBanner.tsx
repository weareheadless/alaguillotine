"use client";

import { useSiteContent } from "../lib/use-site-content";

export function RulesBanner() {
  const { content } = useSiteContent();

  return (
    <div className="mx-auto w-full">
      <div className="border-2 border-spiteCrimson/30 bg-spiteCrimson/5 px-4 py-3 font-mono">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg">⚠️</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-spiteCrimson">
              // HOW THE LEDGER WORKS
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-chop-muted">
              {content.rules.howItWorks}
            </p>
            <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-spiteCrimson">
              // THE LIMITS
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-chop-muted">
              {content.rules.rules}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
