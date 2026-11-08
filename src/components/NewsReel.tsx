"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The television.
 *
 * A pool of news clips accumulated across passes, played like a set nobody is
 * watching: sometimes it holds a shot, sometimes it cuts away after two seconds
 * because the hand on the dial is bored. Sound is off until you ask for it.
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

export function NewsReel({ messages }: { messages: string[] }) {
  const [clips, setClips] = useState<Clip[]>(FALLBACK);
  const [index, setIndex] = useState(0);
  const [sound, setSound] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [torn, setTorn] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/reel", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const live = Array.isArray(data?.clips) ? data.clips : [];
        if (!cancelled && live.length) {
          const list = live.map(
            (c: { url: string; caption: string; source: string; kind: string }) => ({
              src: c.url,
              caption: c.caption || c.source || "news",
              source: c.source,
              kind: c.kind === "youtube" ? "youtube" : "file",
            }),
          );
          setClips(list);
          // Start somewhere else every visit: a stream, not a front page.
          setIndex(Math.floor(Math.random() * list.length));
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

  // Channel surfing: hold a shot, or cut away almost immediately. The next clip
  // is drawn at random, never the one already playing.
  useEffect(() => {
    if (clips.length < 2) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let glitch: ReturnType<typeof setTimeout>;

    const step = () => {
      const cut = Math.random() < 0.38;
      const hold = cut ? 2400 + Math.random() * 2400 : 11_000 + Math.random() * 9000;
      timer = setTimeout(() => {
        if (!alive) return;
        setTorn(true);
        glitch = setTimeout(() => {
          if (alive) setTorn(false);
        }, 90 + Math.random() * 130);
        setIndex((i) => {
          if (clips.length < 2) return i;
          let n = Math.floor(Math.random() * clips.length);
          if (n === i) n = (n + 1) % clips.length;
          return n;
        });
        step();
      }, hold);
    };

    step();
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(glitch);
    };
  }, [clips.length]);

  const clip = clips[index] ?? FALLBACK[0];

  // Stutter: pause, jump back, tear, resume. File clips only.
  useEffect(() => {
    const el = video.current;
    if (!el || clip.kind === "youtube") return;
    let alive = true;
    const local: Array<ReturnType<typeof setTimeout>> = [];

    const schedule = () => {
      if (!alive) return;
      const t = setTimeout(() => {
        if (!alive || !el) return;
        try {
          el.pause();
          el.currentTime = Math.max(0, el.currentTime - (0.04 + Math.random() * 0.18));
          setTorn(true);
          const back = setTimeout(() => {
            if (!alive) return;
            el.play().catch(() => {});
            setTorn(false);
          }, 70 + Math.random() * 120);
          local.push(back);
        } catch {
          /* ignore */
        }
        schedule();
      }, 1200 + Math.random() * 4200);
      local.push(t);
    };

    schedule();
    return () => {
      alive = false;
      local.forEach(clearTimeout);
    };
  }, [index, clip.kind]);

  // The single frame.
  useEffect(() => {
    if (!messages.length) return;
    let alive = true;
    const local: Array<ReturnType<typeof setTimeout>> = [];

    const tick = () => {
      if (!alive) return;
      setFrame(messages[Math.floor(Math.random() * messages.length)]);
      // Hide it almost immediately: 40-65ms, just enough to burn in.
      const off = setTimeout(() => {
        if (!alive) return;
        setFrame(null);
        const next = setTimeout(tick, 5000 + Math.random() * 7000);
        local.push(next);
      }, 40 + Math.random() * 25);
      local.push(off);
    };

    const first = setTimeout(tick, 4500 + Math.random() * 4500);
    local.push(first);
    return () => {
      alive = false;
      local.forEach(clearTimeout);
    };
  }, [messages]);

  const embed = useCallback((id: string, withSound: boolean) => {
    const origin =
      typeof window === "undefined" ? "" : `&origin=${encodeURIComponent(window.location.origin)}`;
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${withSound ? 0 : 1}&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1&rel=0&enablejsapi=0${origin}`;
  }, []);

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
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-sheetWhite p-3 text-center mix-blend-exclusion"
            >
              <span className="text-2xl font-black uppercase leading-none tracking-tighter text-black md:text-4xl">
                {frame}
              </span>
            </div>
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
