"use client";

import type { RageItem } from "@/lib/clock";
import { AdaPromise } from "./AdaPromise";
import { useDrawer } from "./drawers";
import { LiveWire } from "./LiveWire";

/**
 * The control deck.
 *
 * Three different things, three different shapes: her mood is typographic,
 * the wire is a moving headline, the fund line is a quote. They sit in one
 * full-width row under the blade instead of three identical bands above it.
 */
export function ControlDeck({
  mood,
  line,
  items,
}: {
  mood: string;
  line: string;
  items: RageItem[];
}) {
  const { show } = useDrawer();

  return (
    <section className="grid gap-5 border-y border-chop-border py-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] md:gap-0">
      <div className="min-w-0 md:border-l-2 md:border-spiteCrimson md:pl-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
          ada is
        </p>
        <p className="mt-1 font-mono text-2xl font-black uppercase leading-none tracking-tight text-spiteCrimson">
          {mood || "reading"}
        </p>
        <p className="mt-1.5 font-mono text-[11px] leading-snug text-sheetWhite/85">
          {line || "No reading yet. The machine is still looking."}
        </p>
      </div>

      <div className="min-w-0 md:border-l-2 md:border-chop-border md:pl-4">
        <LiveWire bare items={items} />
      </div>

      <div className="min-w-0 md:border-l-2 md:border-hypeNeon md:pl-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
          ada&apos;s financial advice
        </p>
        <p className="mt-1.5 font-mono text-[11px] leading-snug text-sheetWhite/85">
          <AdaPromise variant="inline" />
        </p>
        <button
          type="button"
          onClick={() => show("fund")}
          className="mt-1.5 whitespace-nowrap font-mono text-[10px] text-hypeNeon underline decoration-hypeNeon/40 hover:decoration-hypeNeon"
        >
          invest with us →
        </button>
      </div>
    </section>
  );
}
