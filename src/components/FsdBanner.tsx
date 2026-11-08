"use client";

import { useState, useEffect } from "react";
import { useSiteContent } from "../lib/use-site-content";
import { useAdaVoice } from "../lib/use-ada-voice";

/**
 * The ticker. It used to be hijackable by paid messages; there is no paid
 * message any more, so it just runs the copy — Ada's lines when she has them,
 * the standing banner otherwise.
 */
export function FsdBanner() {
  const { content, ready } = useSiteContent();
  const ada = useAdaVoice();
  const texts = ada.banner.length ? ada.banner : content.bannerTexts;
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