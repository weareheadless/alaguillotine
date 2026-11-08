"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ h: 220, w: 640 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const card = el.closest("article");
    const measure = () => {
      setSize({
        h: el.clientHeight || 220,
        w: card?.clientWidth || 640,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (card) ro.observe(card);
    return () => ro.disconnect();
  }, []);

  // The guillotine is 440 units tall. Fill the card: the old blade was 132px
  // tall; now it is the height of the container, never smaller.
  const scale = Math.max(0.4, Math.min(0.95, size.h / 440));
  const offset = dropped ? 74 : 10 + (Math.min(100, Math.max(0, score)) / 100) * 40;

  // The head leaves the neck and rolls to the right along the card floor.
  const roll = Math.max(180, (size.w - 170) / scale);
  const drop = Math.max(18, size.h / scale - 410);

  return (
    <div
      ref={box}
      className="relative z-10 shrink-0 self-stretch w-[118px] md:w-[168px]"
    >
      <div
        className="absolute left-1/2 top-0 origin-top"
        style={
          {
            transform: `translateX(-50%) scale(${scale})`,
            "--roll-1": `${roll * 0.55}px`,
            "--roll-2": `${roll * 0.8}px`,
            "--roll-3": `${roll * 0.9}px`,
            "--roll-4": `${roll}px`,
            "--head-drop": `${drop}px`,
          } as React.CSSProperties
        }
      >
        <div className="guillotine-wrapper guillotine-accent-a">
          <div className="guillotine-post-left" />
          <div className="guillotine-post-right" />
          <div className="guillotine-beam" />
          <div className="guillotine-base" />
          <div className="guillotine-lunette" />
          <div className={`guillotine-head ${dropped ? "severed" : ""}`} />
          <div className="absolute inset-0 z-10 overflow-hidden">
            <div
              className={`guillotine-blade-wrapper ${dropped ? "dropped" : ""}`}
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

export function QueueCard({
  figure,
  dropped = false,
}: {
  figure: Figure;
  dropped?: boolean;
}) {
  return (
    <article
      className={`group relative border border-chop-border bg-chop-card/40 transition-colors hover:bg-chop-card ${
        dropped ? "chopping" : ""
      }`}
    >
      <div
        className="absolute left-0 top-0 h-full bg-spiteCrimson"
        style={{ width: 2 }}
        aria-hidden
      />

      <div className="flex min-h-[200px] gap-4 p-4 md:gap-6 md:p-5">
        <MiniBlade score={figure.score} dropped={dropped} />

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
              {(figure.recordBonus ?? 0) > 0 && (
                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-chop-muted">
                  +{Math.round(figure.recordBonus ?? 0)} record
                </div>
              )}
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
