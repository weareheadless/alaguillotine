"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The television.
 *
 * A queue of news clips from the last pass, playing one after another with the
 * picture stuttering and tearing like a set that has been on too long. Sound is
 * off until you ask for it — browsers will not autoplay with audio, and neither
 * will this.
 */

interface Clip {
  src: string;
  caption: string;
  source?: string;
  kind?: "file" | "youtube";
}

const FALLBACK: Clip[] = [
  { src: "/static/musk_is_presented_with_the_reality.mp4", caption: "archive", kind: "file" },
];

const ROTATE_MS = 18_000;

export function NewsReel({ messages }: { messages: string[] }) {
  const [clips, setClips] = useState<Clip[]>(FALLBACK);
  const [index, setIndex] = useState(0);
  const [sound, setSound] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [torn, setTorn] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    let cancelled = false;

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
    const id = setInterval(() => setIndex((i) => (i + 1) % clips.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [clips.length]);

  const clip = clips[index] ?? FALLBACK[0];

  // Stutter: pause, jump back, tear, resume. File clips only.
  useEffect(() => {
    const el = video.current;
    if (!el || clip.kind === "youtube") return;
    let alive = true;

    const schedule = () => {
      if (!alive) return;
      const t = setTimeout(() => {
        if (!alive || !el) return;
        try {
          el.pause();
          el.currentTime = Math.max(0, el.currentTime - (0.04 + Math.random() * 0.18));
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
      }, 1200 + Math.random() * 4200);
      timers.current.push(t);
    };

    schedule();
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [index, clip.kind]);

  // The single frame.
  useEffect(() => {
    if (!messages.length) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setFrame(messages[Math.floor(Math.random() * messages.length)]);
      const off = setTimeout(() => {
        if (!alive) return;
        setFrame(null);
        const next = setTimeout(tick, 5200 + Math.random() * 7000);
        timers.current.push(next);
      }, 110 + Math.random() * 90);
      timers.current.push(off);
    };
    const first = setTimeout(tick, 2200);
    timers.current.push(first);
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [messages]);

  const embed = (id: string, withSound: boolean) =>
    `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${withSound ? 0 : 1}&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1&rel=0`;

  return (
    <figure className="relative">
      <div className={`reel-set ${torn ? "reel-torn" : ""}`}>
        <div className="reel-glass">
          {clip.kind === "youtube" ? (
            <iframe
              key={`${clip.src}-${sound}`}
              title={clip.caption}
              src={embed(clip.src, sound)}
              allow="autoplay; encrypted-media; picture-in-picture"
              className="reel-video absolute inset-0 h-full w-full"
              frameBorder="0"
            />
          ) : (
            <video
              key={clip.src}
              ref={video}
              autoPlay
              muted={!sound}
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
              className="reel-frame pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 text-center font-mono text-[11px] font-bold uppercase leading-tight tracking-[0.12em] text-sheetWhite"
            >
              {frame}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-sheetWhite/55">
            <span className="h-1 w-1 animate-pulse bg-spiteCrimson" />
            <span className="truncate">{clip.caption}</span>
            <span className="ml-auto shrink-0 tabular-nums text-sheetWhite/35">
              {String(index + 1).padStart(2, "0")}/{String(clips.length).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSound((s) => !s)}
        className="absolute -bottom-3 right-2 z-10 border border-chop-border bg-canvasBlack px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] text-chop-muted hover:border-spiteCrimson hover:text-spiteCrimson"
      >
        {sound ? "sound on" : "sound off"}
      </button>
    </figure>
  );
}
