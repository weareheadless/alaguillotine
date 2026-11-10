"use client";

import Link from "next/link";
import type { Figure } from "../lib/hateometer";
import { slugify } from "../lib/slug";
import { PersonNumbers } from "./PersonNumbers";

/**
 * One name in the line.
 *
 * A card, not a table row: the score, the charge, the satirical note, and an
 * unmissable door into the ledger. The whole card is the link — there is no
 * doubt that there is something behind the name.
 */

export function LineRow({ figure, promoted }: { figure: Figure; promoted?: boolean }) {
  const charges = figure.ledgerCount ?? 0;
  const latest = figure.items[0];

  return (
    <Link
      href={`/person/${slugify(figure.name)}`}
      className={`group block border-2 bg-white/[0.03] p-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:bg-white/[0.06] ${
        promoted
          ? "border-spiteCrimson/70 shadow-[0_0_24px_rgba(225,29,72,0.12)]"
          : "border-chop-border hover:border-spiteCrimson"
      }`}
    >
      <div className="grid gap-4 sm:grid-cols-[3.25rem_1.5fr_5rem] sm:items-start">
        <div className="font-mono text-2xl font-black leading-none text-spiteCrimson/70">
          {String(figure.rank).padStart(2, "0")}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-lg font-black uppercase leading-tight tracking-tight text-sheetWhite group-hover:text-spiteCrimson md:text-xl">
              {figure.name}
            </h3>
            {figure.delta !== null && figure.delta !== 0 && (
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  figure.delta > 0 ? "text-spiteCrimson" : "text-hypeNeon"
                }`}
              >
                {figure.delta > 0 ? "▲" : "▼"}
                {Math.abs(figure.delta)}
              </span>
            )}
            {figure.delta === null && (
              <span className="animate-pulse font-mono text-[9px] uppercase tracking-widest text-hypeNeon">
                new
              </span>
            )}
          </div>

          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
            {figure.role}
            {figure.country ? ` · ${figure.country}` : ""}
          </p>

          <p className="mt-2 font-mono text-[11px] leading-relaxed text-chop-muted">
            {figure.reason}
          </p>

          <PersonNumbers numbers={figure.numbers} />

          {latest && (
            <div className="mt-2 border-l-2 border-spiteCrimson/60 pl-3">
              <p className="truncate font-mono text-[10px] text-sheetWhite/80">{latest.headline}</p>
              <p className="mt-0.5 font-mono text-[10px] leading-snug text-spiteCrimson/90">
                {latest.quip}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em]">
            <span className={charges > 0 ? "text-hypeNeon" : "text-chop-muted"}>
              {charges > 0 ? `${charges} charge${charges === 1 ? "" : "s"} on record` : "record open"}
            </span>
            <span className="text-chop-muted">·</span>
            <span className="text-sheetWhite/70 transition-colors group-hover:text-spiteCrimson">
              open the ledger →
            </span>
            <span className="text-chop-muted">·</span>
            <span className="text-chop-muted">
              {figure.mentions > 0
                ? `${figure.mentions} reports`
                : figure.investigated
                  ? "no current reports"
                  : "first look pending"}
            </span>
            {(figure.timesChopped ?? 0) > 0 && (
              <>
                <span className="text-chop-muted">·</span>
                <span className="flex items-center gap-1 text-spiteCrimson" title={`${figure.timesChopped} chops`}>
                  <span aria-hidden>
                    {Array.from({ length: Math.min(figure.timesChopped ?? 0, 5) }, (_, k) => (
                      <span key={k}>✝</span>
                    ))}
                  </span>
                  {(figure.timesChopped ?? 0) > 5 ? `+${(figure.timesChopped ?? 0) - 5}` : ""}
                  <span className="text-chop-muted">
                    {figure.timesChopped ?? 0} chop{(figure.timesChopped ?? 0) === 1 ? "" : "s"}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-3xl font-black leading-none tabular-nums text-spiteCrimson">
            {Math.round(figure.score)}
          </div>
          <div className="mt-2 h-1 w-full bg-chop-border">
            <div
              className="h-full bg-spiteCrimson transition-[width] duration-1000 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, figure.score))}%` }}
            />
          </div>
          {(figure.recordBonus ?? 0) > 0 && (
            <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-chop-muted">
              +{Math.round(figure.recordBonus ?? 0)} record
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
