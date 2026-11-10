"use client";

import { useEffect, useMemo, useState } from "react";
import { useSiteContent } from "../lib/use-site-content";
import { useAdaVoice } from "../lib/use-ada-voice";
import { EXECUTION_HOURS, nextExecutionSlot } from "../lib/schedule";

/**
 * The ticker. It used to be hijackable by paid messages; there is no paid
 * message any more, so it just runs the copy — Ada's lines when she has them,
 * the standing banner otherwise.
 */
export function FsdBanner() {
  const { content, ready } = useSiteContent();
  const ada = useAdaVoice();
  const [spam, setSpam] = useState<string[]>([]);

  // The blade gets advertised like everything else on the site. Rebuilt when
  // the next slot rolls over so a tab left open overnight is still correct.
  useEffect(() => {
    const build = () => {
      const slot = nextExecutionSlot();
      const time = new Date(slot).toISOString().slice(11, 16);
      const hours = EXECUTION_HOURS.map((h) => `${String(h).padStart(2, "0")}:00`).join(" / ");
      const next = [
        `NEXT PUBLIC EXECUTION ${time} UTC — THE FRONT ROW IS STANDING ONLY`,
        `BLADE SCHEDULED ${time} UTC. LATE ARRIVALS WILL BE TREATED AS VOLUNTEERS.`,
        `PUBLIC EXECUTIONS ${hours} UTC. THE ONLY PUBLIC SERVICE STILL RUNNING.`,
        "REMINDER: THE BLADE IS CARBON NEUTRAL. THE CONDEMNED IS NOT.",
        "THE GUILLOTINE IS ON TIME. YOUR TRAIN IS NOT.",
      ];
      setSpam((prev) => (prev[0] === next[0] ? prev : next));
    };
    build();
    const id = setInterval(build, 60_000);
    return () => clearInterval(id);
  }, []);

  const texts = useMemo(
    () => [...spam, ...(ada.banner.length ? ada.banner : content.bannerTexts)],
    [spam, ada.banner, content.bannerTexts],
  );
  const [shuffledTexts, setShuffledTexts] = useState<string[]>([]);

  useEffect(() => {
    setShuffledTexts([...texts].sort(() => 0.5 - Math.random()));
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ada's banner arrives after mount; reshuffle once it does.
  useEffect(() => {
    setShuffledTexts([...texts].sort(() => 0.5 - Math.random()));
  }, [texts]);

  if (shuffledTexts.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex w-full overflow-hidden border-t-4 border-black bg-hypeNeon hover:[&>div]:[animation-play-state:paused] md:relative md:border-b-4 md:border-t-0 transition-colors duration-200">
      <div className="animate-marquee-infinite flex whitespace-nowrap py-1.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-canvasBlack">
        {shuffledTexts.map((text, i) => (
          <span key={i} className={`mr-16 ${i % 3 === 0 ? "animate-glitch-text inline-block" : ""}`}>
            [ {text} ]
          </span>
        ))}
      </div>
      <div
        className="animate-marquee-infinite flex whitespace-nowrap py-1.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] text-canvasBlack"
        aria-hidden="true"
      >
        {shuffledTexts.map((text, i) => (
          <span key={i + "dup"} className={`mr-16 ${i % 3 === 0 ? "animate-glitch-text inline-block" : ""}`}>
            [ {text} ]
          </span>
        ))}
      </div>
    </div>
  );
}