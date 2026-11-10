"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Figure } from "../lib/hateometer";
import { slugify } from "../lib/slug";
import { PersonNumbers } from "./PersonNumbers";

gsap.registerPlugin(useGSAP);

/**
 * One head, one blade.
 *
 * Every person in the queue has their own counter and their own blade. The
 * blade waits at the top of the frame and falls the full distance when the
 * countdown ends, then creeps back to the top while the next name waits.
 * Nothing is pooled, nothing is averaged across the queue.
 */

function MiniBlade({ dropped }: { dropped: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
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

  // The drawing is 440 units tall; the scale fills the card.
  const scale = Math.max(0.4, Math.min(0.95, size.h / 440));
  // The blade waits at the top of the frame, under the beam, and falls the
  // full distance on every execution. A CSS animation lifts it again after
  // the head has settled, while the chopped card is still standing.
  const offset = dropped ? 57 : 2;

  // Drawing units: the head starts at 78% (343) and falls to the bottom of the
  // frame, so it bounces on the card's bottom border. It rolls a few
  // head-lengths, not the whole card, then comes to rest.
  const drop = 55;
  const roll = Math.min(560, Math.max(200, (size.w - 48) / scale - 100));

  useGSAP(
    () => {
      const el = head.current;
      if (!el || !dropped) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(el, { autoAlpha: 0 });
        return;
      }

      // The head is 40 units across; rotation is tied to distance travelled,
      // so it rolls instead of sliding.
      const spin = (roll / (Math.PI * 40)) * 360;

      gsap.set(el, {
        xPercent: -50,
        x: 0,
        y: 0,
        rotation: 0,
        autoAlpha: 1,
        transformOrigin: "50% 50%",
      });

      const tl = gsap.timeline();
      // The blade lands first, then gravity takes the head to the floor.
      tl.to(el, { y: drop, duration: 0.30, ease: "power2.in" }, 0.16);
      // First bounce.
      tl.to(el, { y: drop - 18, duration: 0.20, ease: "power1.out" }, 0.46);
      tl.to(el, { y: drop, duration: 0.14, ease: "power1.in" }, 0.66);
      // Second, smaller bounce.
      tl.to(el, { y: drop - 6, duration: 0.13, ease: "power1.out" }, 0.80);
      tl.to(el, { y: drop, duration: 0.11, ease: "power1.in" }, 0.93);
      // The roll: distance and rotation in one tween, so it rolls rather than
      // slides. It comes to rest on the floor and stays there.
      tl.to(el, { x: roll, rotation: spin, duration: 2.2, ease: "power1.out" }, 0.46);
    },
    { dependencies: [dropped, roll, drop], revertOnUpdate: true, scope: box },
  );

  return (
    <div
      ref={box}
      className="relative z-10 shrink-0 self-start w-full h-[180px] min-h-0 overflow-hidden sm:self-stretch sm:w-[118px] sm:min-h-[300px] sm:overflow-visible md:w-[168px] md:min-h-[360px]"
    >
      <div
        className="absolute left-1/2 top-0 origin-top"
        style={{ transform: `translateX(-50%) scale(${scale})` }}
      >
        <div className="guillotine-wrapper guillotine-accent-a">
          <div className="guillotine-post-left" />
          <div className="guillotine-post-right" />
          <div className="guillotine-beam" />
          <div className="guillotine-base" />
          <div className="guillotine-lunette" />
          <div ref={head} className={`guillotine-head ${dropped ? "severed" : ""}`} />
          <div className="absolute inset-0 z-10 overflow-hidden">
            <div
              className={`guillotine-blade-wrapper ${dropped ? "dropped lift" : ""}`}
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

      <div className="flex min-h-[200px] flex-col gap-4 p-4 sm:flex-row md:gap-6 md:p-5">
        <MiniBlade dropped={dropped} />

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
                  {figure.mentions > 0
                    ? `${figure.mentions} rep`
                    : figure.investigated
                      ? "on the record"
                      : "record pending"}
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

          <PersonNumbers numbers={figure.numbers} />

          {figure.items.length > 0 ? (
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
          ) : (figure.topCharges?.length ?? 0) > 0 ? (
            // No story naming them this pass: show the record, not the wire.
            <ul className="mt-3 space-y-2 border-t border-chop-border/60 pt-3">
              {figure.topCharges!.slice(0, 2).map((charge, i) => (
                <li key={`${charge.year}-${i}`} className="font-mono text-[10px] leading-relaxed text-chop-muted">
                  <Link
                    href={`/person/${slugify(figure.name)}`}
                    className="text-sheetWhite underline decoration-chop-border underline-offset-2 hover:decoration-spiteCrimson"
                  >
                    {charge.act}
                  </Link>
                  <span className="block text-[10px] uppercase tracking-[0.08em] text-chop-muted">
                    {charge.place} · {charge.year} · {charge.category}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  );
}
