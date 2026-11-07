"use client";

import Link from "next/link";
import type { Figure } from "../lib/hateometer";
import { slugify } from "../lib/slug";

/**
 * One head, one blade.
 *
 * Every person in the queue has their own counter and their own blade. The blade
 * sits at that person's score: the shrunk mean of the harm reported in their
 * name this pass. Nothing is pooled, nothing is averaged across the queue.
 */

function MiniBlade({ score, dropped }: { score: number; dropped: boolean }) {
  const scale = 0.3;
  const offset = dropped ? 74 : 10 + (Math.min(100, Math.max(0, score)) / 100) * 40;

  return (
    <div className="relative shrink-0" style={{ width: 200 * scale, height: 440 * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        <div className="guillotine-wrapper guillotine-accent-a">
          <div className="guillotine-post-left" />
          <div className="guillotine-post-right" />
          <div className="guillotine-beam" />
          <div className="guillotine-base" />
          <div className="guillotine-lunette" />
          <div className={`guillotine-head ${dropped ? "severed" : ""}`} />
          <div className="absolute inset-0 z-10 overflow-hidden">
            <div
              className="guillotine-blade-wrapper"
              style={{ transform: `translateX(-50%) translateY(${offset}%)` }}
            >
              <div className={`guillotine-blade ${dropped ? "dropped" : ""}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

export function QueueCard({ figure }: { figure: Figure }) {
  return (
    <article className="group relative border border-chop-border bg-chop-card/40 transition-colors hover:bg-chop-card">
      <div
        className="absolute left-0 top-0 h-full bg-spiteCrimson"
        style={{ width: 2 }}
        aria-hidden
      />

      <div className="flex gap-4 p-4 md:gap-6 md:p-5">
        <MiniBlade score={figure.score} dropped={false} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] tabular-nums text-chop-muted">
                  {String(figure.rank).padStart(2, "0")}
                </span>
                <Link
                  href={`/person/${slugify(figure.name)}`}
                  className="text-[17px] font-black leading-tight text-sheetWhite hover:text-spiteCrimson md:text-xl"
                >
                  {figure.name}
                </Link>
              </div>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                {figure.role}
                {figure.country ? ` · ${figure.country}` : ""}
              </p>
              {(figure.timesChopped ?? 0) > 0 && (
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-spiteCrimson">
                  ✝ chopped {figure.timesChopped}× · back in the line
                </p>
              )}
            </div>

            <div className="text-right">
              <div className="font-mono text-2xl font-black leading-none tabular-nums text-spiteCrimson md:text-3xl">
                {Math.round(figure.score)}
              </div>
              <div className="mt-1 flex items-center justify-end gap-2">
                <span className="font-mono text-[9px] uppercase tracking-widest text-chop-muted">
                  {figure.mentions} rep
                </span>
                <Move delta={figure.delta} />
              </div>
            </div>
          </div>

          <p className="mt-3 font-mono text-[11px] leading-relaxed text-chop-muted">
            {figure.reason}
          </p>

          {figure.items.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-chop-border/60 pt-3">
              {figure.items.slice(0, 2).map((item, i) => (
                <li key={i} className="font-mono text-[10px] leading-relaxed text-chop-muted">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sheetWhite underline decoration-chop-border underline-offset-2 hover:decoration-spiteCrimson"
                  >
                    {item.headline}
                  </a>
                  <span className="block text-[10px] text-spiteCrimson/80">{item.quip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
