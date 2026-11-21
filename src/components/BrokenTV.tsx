"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * THE BROKEN SIGNAL.
 *
 * A fixed layer over the whole page: scanlines, grain, a rolling band, torn
 * strips where the picture inverts, and a line of the transmission burned
 * across the frame for a moment before it is gone. The page underneath is
 * unchanged; this is the set it is being watched on.
 *
 * Nothing strobes. The overlay moves continuously and the subliminal line
 * appears once every few seconds for about a tenth of a second; the bar in the
 * hero holds the same line, so the content is not hidden. The switch turns the
 * whole treatment off, motion sensitivity is honoured, and the layer never
 * takes a click away from the page.
 */

const OFF_KEY = "fye:signal:off:v1";

interface Tear {
  id: number;
  top: number;
  height: number;
  hue: boolean;
}

interface Flash {
  id: number;
  text: string;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export function BrokenTV({ messages }: { messages: string[] }) {
  const [on, setOn] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [tears, setTears] = useState<Tear[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const id = useRef(0);
  const lastLine = useRef("");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(OFF_KEY) === "1") setOn(false);
    } catch {
      /* the switch still works for this visit */
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setOn((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(OFF_KEY, next ? "0" : "1");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const rolling = on && !reduced;

  // The page itself is part of the set: the signal can knock it a pixel or two
  // off hold. The class goes on the root so the rules can reach the content
  // without wrapping it in another element.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("crt-on", on && !reduced);
    return () => root.classList.remove("crt-on");
  }, [on, reduced]);

  // The tear: the picture loses hold for a frame or two, at random heights.
  useEffect(() => {
    if (!rolling) {
      setTears([]);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const cut = () => {
      const count = 1 + Math.floor(Math.random() * 3);
      setTears(
        Array.from({ length: count }, () => ({
          id: id.current++,
          top: 4 + Math.random() * 90,
          height: 5 + Math.random() * 24,
          hue: Math.random() < 0.6,
        })),
      );
      const hold = 80 + Math.random() * 120;
      if (Math.random() < 0.55) {
        document.documentElement.classList.add("crt-jolt");
      }
      timer = setTimeout(() => {
        if (!alive) return;
        document.documentElement.classList.remove("crt-jolt");
        setTears([]);
        timer = setTimeout(cut, 900 + Math.random() * 2400);
      }, hold);
    };

    timer = setTimeout(cut, 1400 + Math.random() * 2400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rolling]);

  // The line: full frame, one tenth of a second, then gone.
  useEffect(() => {
    if (!rolling || messages.length === 0) {
      setFlash(null);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const burn = () => {
      // Random every time, and never the line that was just on screen.
      let text = pick(messages);
      if (messages.length > 1) {
        let guard = 0;
        while (text === lastLine.current && guard < 8) {
          text = pick(messages);
          guard += 1;
        }
      }
      lastLine.current = text;
      setFlash({ id: id.current++, text });
      const hold = 80 + Math.random() * 50;
      timer = setTimeout(() => {
        if (!alive) return;
        setFlash(null);
        // Most gaps are long; some are very long. A flash that can be timed is
        // not a subliminal, it is a slideshow.
        const roll = Math.random();
        const gap =
          roll < 0.3
            ? 18_000 + Math.random() * 14_000
            : roll < 0.65
              ? 10_000 + Math.random() * 7_000
              : 6_500 + Math.random() * 4_000;
        timer = setTimeout(burn, gap);
      }, hold);
    };

    timer = setTimeout(burn, 5_500 + Math.random() * 7_500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rolling, messages]);

  return (
    <div className={`broken-tv ${on ? "is-on" : "is-off"} ${reduced ? "is-calm" : ""}`}>
      <div className="bt-layer" aria-hidden>
        {flash ? (
          <div key={flash.id} className="bt-flash">
            <span className="bt-flash-main">{flash.text}</span>
            <span className="bt-flash-band band-a">{flash.text}</span>
            <span className="bt-flash-band band-b">{flash.text}</span>
          </div>
        ) : null}

        <div className="bt-scan" />
        <div className="bt-grain" />
        <div className="bt-hue" />
        <div className="bt-roll" />
        <div className="bt-flicker" />
        <div className="bt-blink" />
        <div className="bt-edge" />
        <div className="bt-vignette" />
        <div className="bt-bezel" />

        {on
          ? tears.map((tear) => (
              <div
                key={tear.id}
                className={`bt-tear ${tear.hue ? "is-hue" : ""}`}
                style={{ top: `${tear.top}%`, height: `${tear.height}px` }}
              />
            ))
          : null}
      </div>

      <button
        type="button"
        className="bt-switch"
        onClick={toggle}
        aria-pressed={!on}
        aria-label={on ? "turn the screen treatment off" : "turn the screen treatment on"}
      >
        {on ? "TV OFF" : "TV ON"}
      </button>
    </div>
  );
}
