"use client";

import type { RageItem } from "@/lib/clock";
import type { Figure } from "@/lib/hateometer";
import { AdaPromise } from "./AdaPromise";
import { useDrawer } from "./drawers";
import { LiveWire } from "./LiveWire";
import { StatusToolbar, type StatusExecution } from "./StatusToolbar";

/**
 * The pulse, in one place.
 *
 * Mood, countdown, the wire and the fund line used to be three full-width
 * strips between the reader and the blade. They are one panel now: the clock
 * and her mood at the top, the moving wire underneath, the pitch at the
 * bottom. The guillotine stays the main piece.
 */
export function PulsePanel({
  mood,
  line,
  execution,
  nextRunAt,
  figures,
  onZero,
  items,
}: {
  mood: string;
  line: string;
  execution?: StatusExecution | null;
  nextRunAt: string | null;
  figures: Figure[];
  onZero: (slug: string) => void;
  items: RageItem[];
}) {
  const { show } = useDrawer();

  return (
    <section className="min-w-0 border-2 border-chop-border bg-sheetWhite/[0.02]">
      <div className="px-4 py-3 md:px-5">
        <StatusToolbar
          showClock={false}
          mood={mood}
          line={line}
          execution={execution}
          nextRunAt={nextRunAt}
          figures={figures}
          onZero={onZero}
        />
      </div>

      <div className="border-t border-chop-border px-4 py-2.5 md:px-5">
        <LiveWire bare items={items} />
      </div>

      <div className="break-words border-t border-chop-border px-4 py-2.5 font-mono text-[10px] leading-relaxed text-chop-muted md:px-5">
        <span className="font-bold uppercase tracking-[0.15em] text-spiteCrimson">
          ada&apos;s financial advice
        </span>{" "}
        <AdaPromise variant="inline" />{" "}
        <button
          type="button"
          onClick={() => show("fund")}
          className="whitespace-nowrap text-hypeNeon underline decoration-hypeNeon/40 hover:decoration-hypeNeon"
        >
          invest with us →
        </button>
      </div>
    </section>
  );
}
