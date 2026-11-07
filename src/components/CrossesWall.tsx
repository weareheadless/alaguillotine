"use client";

import Link from "next/link";
import type { Figure, HateState } from "../lib/hateometer";
import { slugify } from "../lib/slug";

/**
 * The crosses wall.
 *
 * Every time the blade falls, a cross is nailed up against the name. The score
 * resets and the person returns to the line, so the wall is the only place the
 * executions accumulate — the tally of how many times the record has been
 * answered. One cross per chop, no asterisks.
 */

function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toUTCString().slice(5, 16);
}

export function CrossesWall({
  chops,
  figures,
}: {
  chops: HateState["chops"];
  figures: Figure[];
}) {
  const bySlug = new Map(figures.map((f) => [slugify(f.name), f]));
  const total = chops.reduce((n, c) => n + c.count, 0);
  const recent = Date.now() - 24 * 60 * 60 * 1000;

  if (chops.length === 0) {
    return (
      <div className="mt-4 border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
        no cross has been nailed up yet — the machine is still reading
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-chop-border pb-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-chop-muted">
          <span className="text-3xl font-black tabular-nums text-spiteCrimson">{total}</span>{" "}
          blade{total === 1 ? "" : "s"} fallen
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
          {chops.length} name{chops.length === 1 ? "" : "s"} on the wall · click a name for the record
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {chops.map((chop) => {
          const figure = bySlug.get(chop.slug);
          const isRecent = Date.parse(chop.lastAt) > recent;
          const crosses = Math.min(chop.count, 40);

          return (
            <Link
              key={chop.slug}
              href={`/person/${chop.slug}`}
              className={`group relative flex items-start justify-between gap-3 border-2 p-3 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-spiteCrimson ${
                isRecent
                  ? "border-spiteCrimson/70 bg-spiteCrimson/[0.07] shadow-[0_0_22px_rgba(225,29,72,0.14)]"
                  : "border-chop-border bg-white/[0.02]"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="truncate text-[13px] font-black uppercase leading-tight tracking-tight text-sheetWhite group-hover:text-spiteCrimson">
                    {chop.person}
                  </h3>
                  {isRecent && (
                    <span className="animate-pulse font-mono text-[8px] uppercase tracking-[0.2em] text-hypeNeon">
                      fresh
                    </span>
                  )}
                </div>

                <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
                  {figure?.role ?? "on the record"}
                  {figure?.country ? ` · ${figure.country}` : ""}
                </p>

                <div
                  className="mt-1.5 flex flex-wrap gap-x-0.5 text-[13px] leading-none text-spiteCrimson"
                  aria-label={`${chop.count} chops`}
                >
                  {Array.from({ length: crosses }, (_, i) => (
                    <span
                      key={i}
                      className={isRecent ? "animate-[crossDrop_420ms_ease-out_both]" : ""}
                      style={isRecent ? { animationDelay: `${Math.min(i, 12) * 45}ms` } : undefined}
                    >
                      ✝
                    </span>
                  ))}
                  {chop.count > crosses && (
                    <span className="ml-1 font-mono text-[9px] text-chop-muted">
                      +{chop.count - crosses}
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="font-mono text-2xl font-black leading-none tabular-nums text-spiteCrimson">
                  {chop.count}
                </div>
                <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.15em] text-chop-muted">
                  last
                </div>
                <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-chop-muted">
                  {shortDate(chop.lastAt)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
