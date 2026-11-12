"use client";

import { useDrawer } from "./drawers";
import { usePromise } from "@/lib/use-promise";

/**
 * The same promise, in the formats an ad buy would use.
 *
 * `line` sits in the ticker, `popup` in the coin interruptions, `panel` on a
 * person page, and `footer` across the bottom of every page. The text is not
 * regenerated per placement: repetition is the joke.
 */
export function PromiseAd({
  variant,
}: {
  variant: "line" | "popup" | "panel" | "footer";
}) {
  const { text, number } = usePromise();
  const { show } = useDrawer();

  if (!text) return null;

  if (variant === "line") {
    return <span className="text-hypeNeon">“{text}”</span>;
  }

  if (variant === "popup") {
    return (
      <div className="border-t border-hypeNeon/40 bg-hypeNeon/[0.06] px-3 py-2">
        <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-hypeNeon">
          ada&apos;s financial advice
        </p>
        <p className="mt-1 line-clamp-3 font-mono text-[9px] leading-snug text-sheetWhite/85">
          “{text}”
        </p>
        <button
          type="button"
          onClick={() => show("fund")}
          className="mt-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-hypeNeon underline decoration-hypeNeon/40 underline-offset-2 hover:decoration-hypeNeon"
        >
          invest with us →
        </button>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <section className="mt-8 border-2 border-hypeNeon/60 bg-hypeNeon/[0.04] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-hypeNeon">
            ada&apos;s financial advice
          </h2>
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-chop-muted">
            #{number ?? "—"} · false
          </span>
        </div>
        <p className="mt-2 text-[15px] font-black uppercase leading-tight tracking-tight text-sheetWhite">
          “{text}”
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-hypeNeon/30 pt-2">
          <p className="font-mono text-[9px] leading-relaxed text-chop-muted">
            A false promise, renewed every four hours. Not financial advice.
          </p>
          <button
            type="button"
            onClick={() => show("fund")}
            className="shrink-0 border border-hypeNeon px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.15em] text-hypeNeon transition-colors hover:bg-hypeNeon hover:text-canvasBlack"
          >
            invest with us →
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="border-y-2 border-hypeNeon/40 bg-hypeNeon/[0.04] px-6 py-5">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-hypeNeon">
            ada&apos;s financial advice · #{number ?? "—"}
          </p>
          <p className="mt-1 text-[14px] font-black uppercase leading-tight tracking-tight text-sheetWhite">
            “{text}”
          </p>
        </div>
        <button
          type="button"
          onClick={() => show("fund")}
          className="shrink-0 border-2 border-hypeNeon px-4 py-2 font-mono text-[10px] font-black uppercase tracking-widest text-hypeNeon transition-colors hover:bg-hypeNeon hover:text-canvasBlack"
        >
          invest with us →
        </button>
      </div>
    </section>
  );
}
