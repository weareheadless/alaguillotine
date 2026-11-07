"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The broken television.
 *
 * A small screen in the corner of the installation showing news footage that
 * stutters, tears and occasionally forgets where it is. Ada writes the single
 * frames that cut through it — short, true, and gone before you are sure.
 *
 * Clips come from /static/reel/reel.json. Each entry may be a local file or a
 * remote news clip URL.
 */

interface Clip {
  src: string;
  caption: string;
  source?: string;
  kind?: "file" | "youtube";
}

const FALLBACK: Clip[] = [
  { src: "/static/musk_is_presented_with_the_reality.mp4", caption: "archive" },
];

export function NewsReel({ messages }: { messages: string[] }) {
  const [clips, setClips] = useState<Clip[]>(FALLBACK);
  const [index, setIndex] = useState(0);
  const [frame, setFrame] = useState<string | null>(null);
  const [torn, setTorn] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    let cancelled = false;

    // News video first, static clips as the floor.
    fetch("/api/reel", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const live = Array.isArray(data?.clips) ? data.clips : [];
        if (!cancelled && live.length) {
          setClips(
            live.map((c: { url: string; caption: string; source: string; kind: string }) => ({
              src: c.url,
              caption: c.caption || c.source || "news",
              source: c.source,
              kind: c.kind === "youtube" ? "youtube" : "file",
            })),
          );
          return;
        }
        return fetch("/static/reel/reel.json", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((fallback) => {
            if (!cancelled && Array.isArray(fallback?.clips) && fallback.clips.length) {
              setClips(fallback.clips);
            }
          });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (clips.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % clips.length), 22_000);
    return () => clearInterval(id);
  }, [clips.length]);

  // The stutter: pause, jump back a few frames, tear the picture, resume.
  useEffect(() => {
    const el = video.current;
    if (!el || clip.kind === "youtube") return;
    let alive = true;

    const schedule = () => {
      if (!alive) return;
      const delay = 1200 + Math.random() * 4200;
      const t = setTimeout(() => {
        if (!alive || !el) return;
        try {
          el.pause();
          const jitter = 0.04 + Math.random() * 0.18;
          el.currentTime = Math.max(0, el.currentTime - jitter);
          setTorn(true);
          setTimeout(() => {
            if (!alive) return;
            el.play().catch(() => {});
            setTorn(false);
          }, 70 + Math.random() * 120);
        } catch {
          /* ignore */
        }
        schedule();
      }, delay);
      timers.current.push(t);
    };

    schedule();
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [index]);

  // The single frame.
  useEffect(() => {
    if (!messages.length) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setFrame(messages[Math.floor(Math.random() * messages.length)]);
      const t = setTimeout(() => {
        if (!alive) return;
        setFrame(null);
        const next = setTimeout(tick, 5200 + Math.random() * 7000);
        timers.current.push(next);
      }, 90 + Math.random() * 90);
      timers.current.push(t);
    };
    const first = setTimeout(tick, 2400);
    timers.current.push(first);
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [messages]);

  const clip = clips[index] ?? FALLBACK[0];

  return (
    <aside
      aria-label="news feed"
      className="pointer-events-none fixed bottom-4 right-4 z-30 hidden w-[196px] select-none sm:block md:w-[232px]"
    >
      <div className={`reel-set ${torn ? "reel-torn" : ""}`}>
        <div className="reel-glass">
          {clip.kind === "youtube" ? (
            <iframe
              key={clip.src}
              title={clip.caption}
              src={`https://www.youtube-nocookie.com/embed/${clip.src}?autoplay=1&mute=1&loop=1&playlist=${clip.src}&controls=0&modestbranding=1&playsinline=1&rel=0`}
              allow="autoplay; encrypted-media; picture-in-picture"
              className="reel-video absolute inset-0 h-full w-full"
              frameBorder="0"
            />
          ) : (
            <video
              key={clip.src}
              ref={video}
              autoPlay
              muted
              loop
              playsInline
              className="reel-video absolute inset-0 h-full w-full object-cover"
            >
              <source src={clip.src} type="video/mp4" />
            </video>
          )}

          <div className="reel-scanlines pointer-events-none absolute inset-0" aria-hidden />
          <div className="reel-vignette pointer-events-none absolute inset-0" aria-hidden />

          {frame && (
            <span
              aria-hidden
              className="reel-frame absolute inset-x-1 top-1/2 -translate-y-1/2 text-center font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.12em] text-sheetWhite"
            >
              {frame}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-1.5 py-1 font-mono text-[7px] uppercase tracking-[0.2em] text-sheetWhite/45">
            <span className="h-1 w-1 animate-pulse bg-spiteCrimson" />
            <span className="truncate">{clip.caption}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
