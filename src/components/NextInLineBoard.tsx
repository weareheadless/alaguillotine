"use client";

import type { Figure } from "../lib/hateometer";
import { safeHref } from "@/lib/url";

/**
 * The queue.
 *
 * A ranking, not a verdict. Each entry says how much documented harm is being
 * reported in that person's name this week, how many separate reports back it,
 * and which way they moved since the last pass. The reason line is the report's
 * claim, not ours.
 */

function Delta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-widest text-hypeNeon">
        new
      </span>
    );
  }
  if (delta === 0) {
    return <span className="font-mono text-[9px] text-chop-muted">—</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={`font-mono text-[10px] tabular-nums ${up ? "text-spiteCrimson" : "text-hypeNeon"}`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

export function NextInLineBoard({ figures }: { figures: Figure[] }) {
  if (!figures.length) {
    return (
      <div className="border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
        no reading yet — the machine is still looking
      </div>
    );
  }

  return (
    <div className="border border-chop-border">
      <div className="grid grid-cols-[36px_1fr_56px_40px] items-center gap-2 border-b border-chop-border bg-chop-card px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted md:grid-cols-[44px_1fr_90px_60px_44px]">
        <span>#</span>
        <span>name</span>
        <span className="hidden md:block">role</span>
        <span className="text-right">harm</span>
        <span className="text-right">move</span>
      </div>

      {figures.map((f) => (
        <article
          key={`${f.name}-${f.rank}`}
          className="grid grid-cols-[36px_1fr_56px_40px] items-start gap-2 border-b border-chop-border/60 px-3 py-3 last:border-b-0 hover:bg-chop-card/60 md:grid-cols-[44px_1fr_90px_60px_44px]"
        >
          <span className="font-mono text-[11px] tabular-nums text-chop-muted">
            {String(f.rank).padStart(2, "0")}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className="text-[14px] font-bold leading-tight text-sheetWhite">
                {f.name}
              </h3>
              <span className="font-mono text-[9px] uppercase tracking-widest text-chop-muted md:hidden">
                {f.role}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-chop-muted">
              {f.reason}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-chop-muted">
              {f.mentions > 0
                ? `${f.mentions} report${f.mentions === 1 ? "" : "s"}`
                : f.investigated
                  ? "no current reports"
                  : "first look pending"}{" "}
              ·{" "}
              <a
                href={safeHref(f.sourceUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
              >
                {f.source}
              </a>
            </p>
          </div>

          <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-chop-muted md:block">
            {f.role}
            {f.country ? <span className="block text-[9px]">{f.country}</span> : null}
          </span>

          <span className="text-right font-mono text-base font-black tabular-nums text-spiteCrimson">
            {Math.round(f.score)}
          </span>

          <span className="text-right">
            <Delta delta={f.delta} />
          </span>
        </article>
      ))}
    </div>
  );
}
