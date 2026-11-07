"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The video treatment.
 *
 * A dimmed clip with single frames of text burned over it for a few hundred
 * milliseconds, at random intervals and positions. The original build kept the
 * message list in content.ts and never rendered it — this is the wiring.
 *
 * Reusable: pass a news clip and it gets the same treatment as the hero.
 */

export function SubliminalVideo({
  src,
  poster,
  messages,
  variant = "background",
}: {
  src: string;
  poster?: string;
  messages: string[];
  variant?: "background" | "inline";
}) {
  const [flash, setFlash] = useState<{ text: string; top: number; left: number } | null>(
    null,
  );
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced || !messages.length) return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const text = messages[Math.floor(Math.random() * messages.length)];
      setFlash({
        text,
        top: 12 + Math.random() * 70,
        left: 8 + Math.random() * 70,
      });
      timer.current = setTimeout(() => {
        setFlash(null);
        if (!cancelled) {
          timer.current = setTimeout(tick, 4000 + Math.random() * 6000);
        }
      }, 320);
    };

    timer.current = setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [messages, reduced]);

  return (
    <div className={variant === "background" ? "video-bg" : "relative overflow-hidden"}>
      <video
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
        className={
          variant === "background"
            ? "h-full w-full object-cover opacity-[0.06]"
            : "h-full w-full object-cover opacity-90"
        }
      >
        <source src={src} type="video/mp4" />
      </video>

      {variant === "background" && <div className="video-bg-vignette" aria-hidden />}

      {flash && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-[1] select-none font-mono font-black uppercase leading-none tracking-tighter text-sheetWhite"
          style={{
            top: `${flash.top}%`,
            left: `${flash.left}%`,
            fontSize: variant === "background" ? "clamp(18px, 4vw, 56px)" : "clamp(14px, 3vw, 32px)",
            opacity: 0.9,
            mixBlendMode: "difference",
            textShadow: "0 0 24px rgba(225,29,72,0.6)",
          }}
        >
          {flash.text}
        </div>
      )}
    </div>
  );
}
