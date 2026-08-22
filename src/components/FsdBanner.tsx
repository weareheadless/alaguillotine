"use client";

import { useState, useEffect } from "react";
import { fetchTopBounties } from "../app/actions/feed";
import type { FeedMessage } from "../lib/types";
import { useSiteContent } from "../lib/use-site-content";

export function FsdBanner() {
  const { content, ready } = useSiteContent();
  const [shuffledTexts, setShuffledTexts] = useState<string[]>([]);
  const [hackedMessage, setHackedMessage] = useState<FeedMessage | null>(null);

  useEffect(() => {
    // Shuffle the array on mount so new items can appear immediately
    const shuffled = [...content.bannerTexts].sort(() => 0.5 - Math.random());
    setShuffledTexts(shuffled);

    // Periodically hack the banner with top bounties
    const checkHacks = async () => {
      try {
        const bounties = await fetchTopBounties();
        if (bounties.length > 0) {
          // 50% chance to hack the banner if bounties exist (max 2 per min)
          if (Math.random() > 0.5) {
            const randomBounty = bounties[Math.floor(Math.random() * bounties.length)];
            setHackedMessage(randomBounty);
            
            // Release hack after exactly 12 seconds to match the animation duration
            setTimeout(() => setHackedMessage(null), 12000);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    // Check every 30 seconds (ensures max 2 hacks per minute)
    const interval = setInterval(checkHacks, 30_000);
    // Initial check after a brief delay
    const initTimer = setTimeout(checkHacks, 8000);

    const paidMessageHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { text: string; author_name: string; amount_paid: number; created_at: string };
      const message = {
        $id: `paid-${Date.now()}`,
        id: `paid-${Date.now()}`,
        text: detail.text,
        author_name: detail.author_name,
        amount_paid: detail.amount_paid,
        created_at: detail.created_at,
        author_id: null,
        is_shadowbanned: false,
        parent_id: null,
      } as FeedMessage;
      setHackedMessage(message);
      window.setTimeout(() => setHackedMessage((current) => current?.$id === message.$id ? null : current), 12000);
    };
    window.addEventListener("paid-message", paidMessageHandler);
    
    return () => {
      clearInterval(interval);
      clearTimeout(initTimer);
      window.removeEventListener("paid-message", paidMessageHandler);
    };
  }, [ready]);

  if (shuffledTexts.length === 0) return null;

  const isHacked = hackedMessage !== null;
  const bannerBg = isHacked ? "bg-spiteCrimson" : "bg-hypeNeon";
  const textColor = isHacked ? "text-sheetWhite" : "text-canvasBlack";
  
  if (isHacked) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 flex w-full overflow-hidden border-t-4 border-black ${bannerBg} md:relative md:border-b-4 md:border-t-0 transition-colors duration-200`}>
        <div className={`animate-marquee-hack flex whitespace-nowrap py-1.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] ${textColor}`}>
          <span className="animate-glitch-text inline-block px-8">
            ⚠️ OVERRIDE BY {hackedMessage.author_name}: "{hackedMessage.text}" ⚠️
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 flex w-full overflow-hidden border-t-4 border-black ${bannerBg} hover:[&>div]:[animation-play-state:paused] md:relative md:border-b-4 md:border-t-0 transition-colors duration-200`}>
      <div className={`animate-marquee-infinite flex whitespace-nowrap py-1.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] ${textColor}`}>
        {shuffledTexts.map((text, i) => (
          <span key={i} className={`mr-16 ${i % 3 === 0 ? "animate-glitch-text inline-block" : ""}`}>
            [ {text} ]
          </span>
        ))}
      </div>
      <div className={`animate-marquee-infinite flex whitespace-nowrap py-1.5 font-mono text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] ${textColor}`} aria-hidden="true">
        {shuffledTexts.map((text, i) => (
          <span key={i + 'dup'} className={`mr-16 ${i % 3 === 0 ? "animate-glitch-text inline-block" : ""}`}>
            [ {text} ]
          </span>
        ))}
      </div>
    </div>
  );
}
