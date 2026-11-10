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

/**
 * A cut-in: the archive frame, on screen long enough to read, with the words
 * that came with it and a link to the reporting. Not a hidden frame — the
 * timing is random, the content is not.
 */
export interface CutIn {
  src: string;
  quote: string;
  who: string;
  href: string;
}

const FALLBACK: Clip[] = [
  { src: "/static/musk_is_presented_with_the_reality.mp4", caption: "archive", kind: "file" },
];

/** What this browser has already been shown, so a return visit is not a rerun. */
const SEEN_KEY = "fye:reel:seen:v1";
const SEEN_TTL = 30 * 24 * 60 * 60 * 1000;

type Seen = Record<string, number>;

function loadSeen(): Seen {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Seen;
    const cutoff = Date.now() - SEEN_TTL;
    const fresh: Seen = {};
    for (const [src, at] of Object.entries(parsed)) {
      if (typeof at === "number" && at > cutoff) fresh[src] = at;
    }
    return fresh;
  } catch {
    return {};
  }
}

function saveSeen(seen: Seen): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* private mode, quota, or storage disabled: the bag still works per visit */
  }
}

/**
 * The stream is a shuffle bag, not a die roll.
 *
 * Random picks from a pool this small keep landing on the same cluster — four
 * protests, three floods, then a Reuters clip you have already seen. Each cycle
 * now plays every clip once, and the picker refuses the same source or the same
 * kind of story twice in a row while it still has an alternative.
 */
const TOPIC_RULES: Array<[string, RegExp]> = [
  ["labour", /workers?|union|walkout|wage|job|strike over|pay dispute|layoff/i],
  ["war", /airstrike|missile|troops|army|military|gaza|ukraine|israel|war|bomb|ceasefire|refugee camp/i],
  ["climate", /flood|storm|heatwave|heat wave|drought|wildfire|climate|torrential|rain|disaster area/i],
  ["migration", /migrant|border|asylum|refugee|deport|detention|ceuta/i],
  ["unrest", /protest|clash|crackdown|demonstrat|police|riot|arrest/i],
  ["courts", /court|trial|verdict|judge|indict|sentence|lawsuit|ruling|convict/i],
  ["corruption", /corruption|bribe|graft|fraud|scandal|sleaze|embezzl/i],
  ["economy", /inflation|price|interest rate|econom|recession|bank|market|cost of living|rent|housing|budget/i],
  ["health", /nhs|hospital|health|vaccine|drug|medic|waiting list/i],
  ["tech", /artificial intelligence|\bai\b|tech|google|meta|apple|amazon|musk|tesla|spacex|chip|data privacy|monopol/i],
  ["politics", /election|vote|parliament|president|prime minister|minister|party|congress|senate/i],
  ["arms", /arms|weapons|defence|defense|military aid|missile sale/i],
  ["food", /food|famine|hunger|agricultur|crop|harvest/i],
];

function topicOf(caption: string): string {
  for (const [topic, pattern] of TOPIC_RULES) {
    if (pattern.test(caption)) return topic;
  }
  return "other";
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Recent {
  sources: string[];
  topics: string[];
}

function chooseNext(
  clips: Clip[],
  current: number,
  bag: number[],
  recent: Recent,
  seen: Seen,
): number {
  if (clips.length < 2) return current;

  if (!bag.length) {
    bag.push(...shuffle(clips.map((_, i) => i).filter((i) => i !== current)));
  }

  const now = clips[current];
  const currentSource = now?.source ?? "";
  const currentTopic = topicOf(now?.caption ?? "");
  const lastSource = recent.sources[recent.sources.length - 1] ?? "";
  const lastTopic = recent.topics[recent.topics.length - 1] ?? "";

  const pools = [
    bag.filter(
      (i) =>
        i !== current &&
        (clips[i].source ?? "") !== currentSource &&
        (clips[i].source ?? "") !== lastSource &&
        topicOf(clips[i].caption) !== currentTopic &&
        topicOf(clips[i].caption) !== lastTopic,
    ),
    bag.filter((i) => i !== current && (clips[i].source ?? "") !== currentSource),
    bag.filter((i) => i !== current && topicOf(clips[i].caption) !== currentTopic),
    bag.filter((i) => i !== current),
  ];

  // A clip this browser has not been shown wins over one it has. Only when
  // the fresh side of the pool is empty do we replay the oldest memory.
  const unseen = (i: number) => !seen[clips[i].src];
  const pool =
    pools.find((p) => p.some(unseen)) ?? pools.find((p) => p.length > 0) ?? [current];
  const fresh = pool.filter(unseen);
  const next = fresh.length
    ? fresh[Math.floor(Math.random() * fresh.length)]
    : pool.reduce((a, b) => ((seen[clips[a].src] ?? 0) <= (seen[clips[b].src] ?? 0) ? a : b));
  const at = bag.indexOf(next);
  if (at >= 0) bag.splice(at, 1);

  recent.sources.push(clips[next]?.source ?? "");
  recent.topics.push(topicOf(clips[next]?.caption ?? ""));
  if (recent.sources.length > 4) recent.sources.shift();
  if (recent.topics.length > 3) recent.topics.shift();
  return next;
}

export function NewsReel({ messages, cutIn }: { messages: string[]; cutIn?: CutIn }) {
  const [clips, setClips] = useState<Clip[]>(FALLBACK);
  const [index, setIndex] = useState(0);
  const [sound, setSound] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [torn, setTorn] = useState(false);
  const [cut, setCut] = useState(false);
  const [cutBroken, setCutBroken] = useState(false);
  const [reduced, setReduced] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const indexRef = useRef(0);
  const bag = useRef<number[]>([]);
  const recent = useRef<Recent>({ sources: [], topics: [] });
  const seen = useRef<Seen>({});

  useEffect(() => {
    seen.current = loadSeen();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Fetch the frame before the first cut so it does not arrive blank.
  useEffect(() => {
    if (!cutIn) return;
    const img = new Image();
    img.onerror = () => setCutBroken(true);
    img.src = cutIn.src;
  }, [cutIn]);

  // The cut-in keeps its own clock: not at the start, never the same length
  // twice, and sometimes it sits out a whole cycle.
  useEffect(() => {
    if (!cutIn || cutBroken || reduced) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (!alive) return;
        setCut(true);
        timer = setTimeout(() => {
          if (!alive) return;
          setCut(false);
          const skip = Math.random() < 0.3;
          schedule(
            skip ? 120_000 + Math.random() * 120_000 : 25_000 + Math.random() * 45_000,
          );
        }, 1200 + Math.random() * 2200);
      }, delay);
    };

    schedule(14_000 + Math.random() * 36_000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [cutIn, cutBroken, reduced]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/reel", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const live = Array.isArray(data?.clips) ? data.clips : [];
        if (!cancelled && live.length) {
          const list: Clip[] = live.map(
            (c: { url: string; caption: string; source: string; kind: string }) => ({
              src: c.url,
              caption: c.caption || c.source || "news",
              source: c.source,
              kind: c.kind === "youtube" ? "youtube" : "file",
            }),
          );
          const freshStarts = list
            .map((_, i) => i)
            .filter((i) => !seen.current[list[i].src]);
          const start = freshStarts.length
            ? freshStarts[Math.floor(Math.random() * freshStarts.length)]
            : Math.floor(Math.random() * list.length);
          setClips(list);
          // Start somewhere else every visit: a stream, not a front page.
          indexRef.current = start;
          setIndex(start);
          bag.current = [];
          recent.current = {
            sources: [list[start]?.source ?? ""],
            topics: [topicOf(list[start]?.caption ?? "")],
          };
          if (list[start]?.src) {
            seen.current[list[start].src] = Date.now();
            saveSeen(seen.current);
          }
          return;
        }
        return fetch("/static/reel/reel.json", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((fallback) => {
            if (!cancelled && Array.isArray(fallback?.clips) && fallback.clips.length) {
              setClips(fallback.clips);
              indexRef.current = 0;
              setIndex(0);
              bag.current = [];
              recent.current = {
                sources: [fallback.clips[0]?.source ?? ""],
                topics: [topicOf(fallback.clips[0]?.caption ?? "")],
              };
            }
          });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Channel surfing: hold a shot, or cut away almost immediately. The next clip
  // comes from the shuffle bag, so the whole pool is played before a repeat.
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
        const next = chooseNext(
          clips,
          indexRef.current,
          bag.current,
          recent.current,
          seen.current,
        );
        indexRef.current = next;
        // A two-second cut-away is not "seen"; only a held shot counts, so a
        // clip that flashed past still gets a proper showing later.
        if (!cut && clips[next]?.src) {
          seen.current[clips[next].src] = Date.now();
          saveSeen(seen.current);
        }
        setIndex(next);
        step();
      }, hold);
    };

    step();
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(glitch);
    };
  }, [clips]);

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
    <figure className="relative min-w-0 w-full">
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

          {cut && cutIn && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[70] overflow-hidden bg-black"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cutIn.src}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setCutBroken(true)}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-6 pt-10">
                <p className="text-[13px] font-black uppercase leading-none tracking-tight text-sheetWhite md:text-base">
                  &ldquo;{cutIn.quote}&rdquo;
                </p>
                <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-sheetWhite/65">
                  {cutIn.who}
                  {" · "}
                  <a
                    href={cutIn.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="pointer-events-auto underline decoration-sheetWhite/40 hover:text-hypeNeon"
                  >
                    the reporting ↗
                  </a>
                </p>
              </div>
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
