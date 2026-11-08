"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Figure } from "../lib/hateometer";
import { slugify } from "../lib/slug";

gsap.registerPlugin(useGSAP);

/**
 * One head, one blade.
 *
 * Every person in the queue has their own counter and their own blade. The
 * blade waits at the top of the frame and falls the full distance when the
 * countdown ends, then the hauler walks it back up. Nothing is pooled, nothing
 * is averaged across the queue.
 */

function MiniBlade({ dropped }: { dropped: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ h: 220, w: 640 });
  // The hauler walks in after the head has settled, throws the rope, and
  // hauls the blade back up. The blade is up before the next card arrives.
  const [haulerOn, setHaulerOn] = useState(false);
  const [bladeUp, setBladeUp] = useState(false);
  const hauler = useRef<HTMLDivElement>(null);
  const rope = useRef<HTMLSpanElement>(null);
  const hook = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!dropped) {
      setHaulerOn(false);
      setBladeUp(false);
      return;
    }
    setBladeUp(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setBladeUp(true);
      return;
    }
    // The head finishes its roll at ~2.7s; he steps in just after.
    const t = window.setTimeout(() => setHaulerOn(true), 2800);
    return () => window.clearTimeout(t);
  }, [dropped]);

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
  // full distance on every execution. It stays down until the hauler lifts it.
  const offset = dropped && !bladeUp ? 57 : 2;

  // Drawing units: the head starts at 78% (343) and falls to the bottom of the
  // frame, so it bounces on the card's bottom border. It rolls a few
  // head-lengths, not the whole card, then comes to rest.
  const drop = 55;
  const roll = Math.min(560, Math.max(200, (size.w - 48) / scale - 100));

  // The haul: walk in from where the head lies, throw the rope, pull the
  // blade up, walk out.
  useGSAP(
    () => {
      const el = hauler.current;
      const line = rope.current;
      const ring = hook.current;
      if (!el || !line || !ring || !haulerOn) return;

      const startX = size.w / scale + 80;
      const stopX = 150;
      const beamY = 18;
      const handY = 170; // raised hands, in wrapper units

      const legL = el.querySelector(".hauler-leg-l");
      const legR = el.querySelector(".hauler-leg-r");
      const armL = el.querySelector(".hauler-arm-l");
      const armR = el.querySelector(".hauler-arm-r");

      gsap.set(el, { x: startX, y: 0, autoAlpha: 1 });
      gsap.set(line, { height: 0 });
      gsap.set(ring, { opacity: 0, scale: 0.3 });

      const tl = gsap.timeline();
      // Walk in, legs and arms swinging.
      tl.to(el, { x: stopX, duration: 1.2, ease: "none" }, 0);
      tl.to(legL, { rotation: 24, duration: 0.2, yoyo: true, repeat: 5, ease: "sine.inOut" }, 0);
      tl.to(legR, { rotation: -24, duration: 0.2, yoyo: true, repeat: 5, ease: "sine.inOut" }, 0);
      tl.to(armL, { rotation: -18, duration: 0.2, yoyo: true, repeat: 5, ease: "sine.inOut" }, 0);
      tl.to(armR, { rotation: 18, duration: 0.2, yoyo: true, repeat: 5, ease: "sine.inOut" }, 0);

      // Stop, reach up, throw the rope to the beam.
      tl.to([legL, legR, armL, armR], { rotation: 0, duration: 0.14, overwrite: "auto" }, 1.2);
      tl.to(armL, { rotation: 168, duration: 0.18, ease: "power2.out", overwrite: "auto" }, 1.32);
      tl.to(armR, { rotation: -168, duration: 0.18, ease: "power2.out", overwrite: "auto" }, 1.32);
      tl.to(line, { height: handY - beamY, duration: 0.22, ease: "power2.out" }, 1.38);
      tl.to(ring, { opacity: 1, scale: 1, duration: 0.16, ease: "back.out(2.4)" }, 1.56);

      // Pull twice; the first pull raises the blade.
      tl.call(() => setBladeUp(true), [], 1.62);
      tl.to(armL, { rotation: 16, duration: 0.38, ease: "power1.inOut", overwrite: "auto" }, 1.62);
      tl.to(armR, { rotation: -16, duration: 0.38, ease: "power1.inOut", overwrite: "auto" }, 1.62);
      tl.to(armL, { rotation: 168, duration: 0.34, ease: "power1.inOut", overwrite: "auto" }, 2.0);
      tl.to(armR, { rotation: -168, duration: 0.34, ease: "power1.inOut", overwrite: "auto" }, 2.0);

      // Let the rope go and walk back out.
      tl.to([line, ring], { height: 0, opacity: 0, duration: 0.18, ease: "power1.in" }, 2.34);
      tl.to([armL, armR], { rotation: 0, duration: 0.2, overwrite: "auto" }, 2.34);
      tl.to(el, { x: startX, duration: 0.9, ease: "none" }, 2.42);
      tl.to(legL, { rotation: 24, duration: 0.2, yoyo: true, repeat: 3, ease: "sine.inOut", overwrite: "auto" }, 2.42);
      tl.to(legR, { rotation: -24, duration: 0.2, yoyo: true, repeat: 3, ease: "sine.inOut", overwrite: "auto" }, 2.42);
      tl.to(el, { autoAlpha: 0, duration: 0.2 }, 3.3);
    },
    { dependencies: [haulerOn, size.w, scale], revertOnUpdate: true, scope: box },
  );

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
      className="relative z-10 shrink-0 self-stretch w-[118px] min-h-[300px] md:w-[168px] md:min-h-[360px]"
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
          {haulerOn && (
            <div ref={hauler} className="hauler" aria-hidden>
              <span ref={rope} className="hauler-rope" />
              <span ref={hook} className="hauler-hook" />
              <div className="hauler-head" />
              <div className="hauler-torso" />
              <div className="hauler-arm hauler-arm-l" />
              <div className="hauler-arm hauler-arm-r" />
              <div className="hauler-leg hauler-leg-l" />
              <div className="hauler-leg hauler-leg-r" />
            </div>
          )}
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
