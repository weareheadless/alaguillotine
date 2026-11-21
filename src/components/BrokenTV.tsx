"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * THE BROKEN SIGNAL.
 *
 * The page is normal most of the time. Then, at no fixed interval, the picture
 * loses hold: scanlines, grain, a rolling band, torn strips that invert, a jolt
 * of the whole page, and — sometimes, partway into the break — one line of the
 * transmission, printed through the same glass for a tenth of a second.
 *
 * The break is the event, not the default. Between breaks the page is exactly
 * itself and the text is clean. The switch turns it all off, and reduced motion
 * means it never starts.
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
  const [broken, setBroken] = useState(false);
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

  // The break: a stretch of broken picture, at a random interval, for a random
  // length. Sometimes a line is printed inside it; most of the time it is only
  // the picture failing.
  useEffect(() => {
    if (!on || reduced) {
      setBroken(false);
      setFlash(null);
      return;
    }

    let alive = true;
    const timers: number[] = [];
    const at = (fn: () => void, ms: number) => {
      const timer = window.setTimeout(() => {
        if (alive) fn();
      }, ms);
      timers.push(timer);
      return timer;
    };

    const burn = () => {
      if (messages.length === 0) return;
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
      at(() => setFlash(null), 85 + Math.random() * 55);
    };

    const schedule = (first: boolean) => {
      // Nothing is on a timer a reader can learn. The first wait is a little
      // shorter so a visitor who stays sees one; after that the gaps run long.
      const wait = first
        ? 4_500 + Math.random() * 6_000
        : 7_000 + Math.random() * 15_000;
      at(() => {
        setBroken(true);
        const duration = 900 + Math.random() * 2_400;
        // The line comes partway into the break, if it comes at all.
        if (Math.random() < 0.62) {
          at(burn, 140 + Math.random() * Math.max(120, duration - 360));
        }
        at(() => {
          setFlash(null);
          setBroken(false);
          schedule(false);
        }, duration);
      }, wait);
    };

    schedule(true);
    return () => {
      alive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [on, reduced, messages]);

  // While the picture is broken, the tears keep coming.
  useEffect(() => {
    if (!broken) {
      setTears([]);
      document.documentElement.classList.remove("crt-jolt");
      return;
    }

    let alive = true;
    let timer: number;
    const cut = () => {
      const count = 1 + Math.floor(Math.random() * 3);
      setTears(
        Array.from({ length: count }, () => ({
          id: id.current++,
          top: 4 + Math.random() * 90,
          height: 5 + Math.random() * 26,
          hue: Math.random() < 0.6,
        })),
      );
      if (Math.random() < 0.5) document.documentElement.classList.add("crt-jolt");
      timer = window.setTimeout(() => {
        if (!alive) return;
        document.documentElement.classList.remove("crt-jolt");
        setTears([]);
        timer = window.setTimeout(cut, 170 + Math.random() * 420);
      }, 70 + Math.random() * 120);
    };

    timer = window.setTimeout(cut, 40);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.documentElement.classList.remove("crt-jolt");
    };
  }, [broken]);

  // The page carries the treatment only while it is breaking.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("crt-on", on && !reduced && broken);
    return () => root.classList.remove("crt-on");
  }, [on, reduced, broken]);

  return (
    <div className={`broken-tv ${on ? "is-on" : "is-off"} ${broken ? "is-broken" : ""}`}>
      {broken ? (
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

          {tears.map((tear) => (
            <div
              key={tear.id}
              className={`bt-tear ${tear.hue ? "is-hue" : ""}`}
              style={{ top: `${tear.top}%`, height: `${tear.height}px` }}
            />
          ))}
        </div>
      ) : null}

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
