"use client";

import { useAdaVoice } from "../lib/use-ada-voice";

/**
 * The market tape.
 *
 * A financial newswire for a coin that has no revenue, no product and no
 * future: fake ticker moves for the futuristic machinery the fund is supposedly
 * building. Ada writes the headlines with the voice; this only gives them the
 * shape of a terminal.
 */
export function MarketTicker() {
  const ada = useAdaVoice();
  const items = ada.ticker ?? [];
  if (!items.length) return null;

  const row = (hidden = false) => (
    <div
      className="animate-marquee-infinite flex whitespace-nowrap py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
      aria-hidden={hidden}
    >
      {items.map((text, i) => (
        <span key={i} className="mx-6 inline-flex items-center gap-2">
          <span className={i % 2 ? "text-spiteCrimson" : "text-hypeNeon"}>
            {i % 2 ? "▼" : "▲"}
          </span>
          <span className="text-sheetWhite/85">{text}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="flex w-full overflow-hidden border-y border-chop-border bg-black">
      <span className="z-10 flex shrink-0 items-center bg-hypeNeon px-2 font-mono text-[9px] font-black uppercase tracking-[0.15em] text-black">
        live
      </span>
      {row()}
      {row(true)}
    </div>
  );
}
