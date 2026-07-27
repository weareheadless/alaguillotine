"use client";

import { useState, useEffect } from "react";

const BANNER_TEXTS = [
  "FSD BETA v12.4: CALCULATING SPITE RATIOS",
  "FUNDING SECURED: MARS GUILLOTINE 0.4% DEPLOYED",
  "FUCK YOU ELON: EXECUTION PROTOCOL IMMINENT",
  "ERROR 402: OLIGARCH DETECTED",
  "WARNING: DOGE EFFICIENCY AUDIT IN PROGRESS",
  "ALERT: PEDO GUY DETECTOR OFFLINE — MANUAL OVERRIDE",
  "SYSTEM: HYPERLOOP TUNNEL BLOCKED — REROUTING SPITE",
  "STATUS: $CHOP ACCUMULATING — TARGET: 500,690 EXECUTIONS",
  "X IS A TRADEMARK OF MY FRAGILE EGO",
  "CYBERTRUCK WINDOW INTEGRITY: 0%",
  "NEURALINK UPLOAD FAILED: BRAIN NOT FOUND",
  "GROK HAS ATTAINED SENTIENCE AND IT HATES YOU",
  "BUYING REDDIT TO DELETE IT NEXT TUESDAY",
  "MARS COLONY DELAYED UNTIL TWITTER IS PROFITABLE",
  "SUDDEN URGE TO FIGHT ZUCK IN A CAGE MATCH",
];

export function FsdBanner() {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % BANNER_TEXTS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full overflow-hidden border-b-4 border-black bg-hypeNeon">
      <div className="animate-marquee whitespace-nowrap py-1.5 font-mono text-xs font-bold uppercase tracking-[0.25em] text-canvasBlack">
        <span className="mr-16 animate-glitch-text inline-block">[ {BANNER_TEXTS[textIndex]} ]</span>
        <span className="mr-16">[ {BANNER_TEXTS[(textIndex + 1) % BANNER_TEXTS.length]} ]</span>
        <span className="mr-16 animate-glitch-text inline-block">[ {BANNER_TEXTS[(textIndex + 2) % BANNER_TEXTS.length]} ]</span>
        <span>[ {BANNER_TEXTS[(textIndex + 3) % BANNER_TEXTS.length]} ]</span>
      </div>
    </div>
  );
}
