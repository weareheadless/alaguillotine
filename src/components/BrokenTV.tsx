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
  rotate: number;
  scale: number;
  x: number;
  y: number;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export function BrokenTV({ messages }: { messages: string[] }) {
  const [on, setOn] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [tears, setTears] = useState<Tear[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const id = useRef(0);

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
      timer = setTimeout(() => {
        if (!alive) return;
        setTears([]);
        timer = setTimeout(cut, 900 + Math.random() * 2600);
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
      setFlash({
        id: id.current++,
        text: pick(messages),
        rotate: (Math.random() * 2 - 1) * 2.2,
        scale: 0.9 + Math.random() * 0.22,
        x: (Math.random() * 2 - 1) * 4,
        y: (Math.random() * 2 - 1) * 4,
      });
      const hold = 90 + Math.random() * 60;
      timer = setTimeout(() => {
        if (!alive) return;
        setFlash(null);
        timer = setTimeout(burn, 2800 + Math.random() * 3800);
      }, hold);
    };

    timer = setTimeout(burn, 1400 + Math.random() * 1800);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rolling, messages]);

  return (
    <div className={`broken-tv ${on ? "is-on" : "is-off"} ${reduced ? "is-calm" : ""}`}>
      <div className="bt-layer" aria-hidden>
        <div className="bt-scan" />
        <div className="bt-grain" />
        <div className="bt-hue" />
        <div className="bt-roll" />
        <div className="bt-flicker" />
        <div className="bt-blink" />
        <div className="bt-edge" />
        <div className="bt-vignette" />

        {on
          ? tears.map((tear) => (
              <div
                key={tear.id}
                className={`bt-tear ${tear.hue ? "is-hue" : ""}`}
                style={{ top: `${tear.top}%`, height: `${tear.height}px` }}
              />
            ))
          : null}

        {flash ? (
          <div
            key={flash.id}
            className="bt-flash"
            style={{
              transform: `translate(${flash.x}vw, ${flash.y}vh) rotate(${flash.rotate}deg) scale(${flash.scale})`,
            }}
          >
            <span>{flash.text}</span>
          </div>
        ) : null}
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
