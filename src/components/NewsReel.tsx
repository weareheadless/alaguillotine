"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The reel.
 *
 * Raw footage — speeches, crackdowns, the machinery — dimmed and cut through
 * with single frames of text. This is the cyberpunk part: the feed is always
 * running, the message is always one frame away, and you are never quite sure
 * you saw it.
 *
 * Clips come from /static/reel/reel.json so footage can be dropped in without
 * touching code.
 */

interface Clip {
  src: string;
  caption: string;
  source?: string;
}

const FALLBACK: Clip[] = [
  { src: "/static/musk_is_presented_with_the_reality.mp4", caption: "the presentation" },
];

export function NewsReel({
  messages,
  className = "",
}: {
  messages: string[];
  className?: string;
}) {
  const [clips, setClips] = useState<Clip[]>(FALLBACK);
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState<{ text: string; top: number; left: number; size: number } | null>(
    null,
  );
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/static/reel/reel.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.clips) && data.clips.length) {
          setClips(data.clips);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (clips.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % clips.length), 14_000);
    return () => clearInterval(id);
  }, [clips.length]);

  useEffect(() => {
    if (reduced || !messages.length) return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      setFlash({
        text: messages[Math.floor(Math.random() * messages.length)],
        top: 10 + Math.random() * 62,
        left: 6 + Math.random() * 52,
        size: 22 + Math.random() * 26,
      });
      timer.current = setTimeout(() => {
        setFlash(null);
        if (!cancelled) timer.current = setTimeout(tick, 2600 + Math.random() * 4200);
      }, 240);
    };

    timer.current = setTimeout(tick, 1800);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [messages, reduced]);

  const clip = clips[index] ?? FALLBACK[0];

  return (
    <figure className={`relative overflow-hidden border border-chop-border bg-black ${className}`}>
      <div className="relative aspect-video w-full overflow-hidden">
        <video
          key={clip.src}
          autoPlay
          muted
          loop
          playsInline
          className="reel-video absolute inset-0 h-full w-full object-cover"
        >
          <source src={clip.src} type="video/mp4" />
        </video>

        {/* scanlines + vignette */}
        <div className="reel-scanlines pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#0B0B0C_100%)]" aria-hidden />

        {/* the frame that is only there for a quarter second */}
        {flash && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-20 select-none font-mono font-black uppercase leading-none tracking-tighter text-sheetWhite"
            style={{
              top: `${flash.top}%`,
              left: `${flash.left}%`,
              fontSize: `${flash.size}px`,
              mixBlendMode: "difference",
              textShadow: "0 0 18px rgba(225,29,72,0.8)",
            }}
          >
            {flash.text}
          </div>
        )}

        {/* status strip */}
        <div className="absolute left-0 top-0 z-10 flex w-full items-center gap-2 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.25em] text-sheetWhite/70">
          <span className="h-1.5 w-1.5 animate-pulse bg-spiteCrimson" />
          <span>feed</span>
          <span className="text-sheetWhite/30">/</span>
          <span className="truncate">{clip.caption}</span>
          <span className="ml-auto tabular-nums text-sheetWhite/40">
            {String(index + 1).padStart(2, "0")}/{String(clips.length).padStart(2, "0")}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 z-10 w-full px-3 py-2 font-mono text-[9px] uppercase tracking-[0.25em] text-sheetWhite/40">
          {clip.source ?? "unverified · raw"} — the frame is not the story
        </div>
      </div>
    </figure>
  );
}
