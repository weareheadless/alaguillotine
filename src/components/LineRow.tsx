"use client";

import Link from "next/link";
import type { Figure } from "../lib/hateometer";

/**
 * A row in the line.
 *
 * No blade. Nobody in the line is in a guillotine — the guillotine is the
 * homepage, where the executions happen. Here there is only a name, what they
 * are accused of, and the score that decides whether they get promoted.
 */

function Move({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="font-mono text-[9px] uppercase tracking-widest text-hypeNeon">new</span>;
  }
  if (delta === 0) return <span className="font-mono text-[9px] text-chop-muted">—</span>;
  const up = delta > 0;
  return (
    <span className={`font-mono text-[10px] tabular-nums ${up ? "text-spiteCrimson" : "text-hypeNeon"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

export function LineRow({ figure, promoted }: { figure: Figure; promoted?: boolean }) {
  return (
    <article
      className={`border-b border-chop-border/60 px-1 py-4 transition-colors hover:bg-chop-card/50 ${
        promoted ? "border-l-2 border-l-spiteCrimson bg-spiteCrimson/[0.05] pl-3" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <span className="mt-1 w-6 shrink-0 font-mono text-[11px] tabular-nums text-chop-muted">
          {String(figure.rank).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link href={`/person/${figure.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="text-[16px] font-black leading-tight text-sheetWhite hover:text-spiteCrimson">{figure.name}</Link>
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
              {figure.role}
              {figure.country ? ` · ${figure.country}` : ""}
            </span>
          </div>

          <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-chop-muted">
            {figure.reason}
          </p>

          {figure.items[0] && (
            <a
              href={figure.items[0].sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
            >
              {figure.source} ↗
            </a>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="font-mono text-2xl font-black leading-none tabular-nums text-spiteCrimson">
            {Math.round(figure.score)}
          </div>
          <div className="mt-1 flex items-center justify-end">
            <Move delta={figure.delta} />
          </div>
        </div>
      </div>
    </article>
  );
}
