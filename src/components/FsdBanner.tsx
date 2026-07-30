"use client";

import { useState, useEffect } from "react";
import { fetchTopBounties } from "../app/actions/feed";
import type { FeedMessage } from "../lib/types";

const BANNER_TEXTS = [
  "FSD BETA v12.4: CALCULATING SPITE RATIOS",
  "FUNDING SECURED: MARS GUILLOTINE 0.4% DEPLOYED",
  "FUCK YOU ELON: EXECUTION PROTOCOL IMMINENT",
  "ERROR 402: OLIGARCH DETECTED",
  "WARNING: DOGE EFFICIENCY AUDIT IN PROGRESS",
  "ALERT: PEDO GUY DETECTOR OFFLINE — MANUAL OVERRIDE",
  "SYSTEM: HYPERLOOP TUNNEL BLOCKED — REROUTING SPITE",
  "STATUS: $CHOP ACCUMULATING — TARGET: 500,690 EXECUTIONS",
  "X IS A TRADEMARK OF MY FRAGILE EGO",
  "CYBERTRUCK WINDOW INTEGRITY: 0%",
  "NEURALINK UPLOAD FAILED: BRAIN NOT FOUND",
  "GROK HAS ATTAINED SENTIENCE AND IT HATES YOU",
  "BUYING REDDIT TO DELETE IT NEXT TUESDAY",
  "MARS COLONY DELAYED UNTIL TWITTER IS PROFITABLE",
  "SUDDEN URGE TO FIGHT ZUCK IN A CAGE MATCH",
  "SYSTEM UPDATE v12.4: PREPARING FOR 2036 \"AGE OF AMAZING ABUNDANCE\" // MONEY WILL NO LONGER MATTER // PLEASE BURN ALL REMAINING LIQUIDITY HERE BEFORE IT BECOMES OBSOLETE",
  "FSD BETA ALERT: \"QUASI-INFINITE ECONOMY\" ACHIEVED // DEFLATION IS NOW A BIGGER THREAT THAN INFLATION // DEPOSIT $CHOP TO REGULATE THE MARKET",
  "UNIVERSAL HIGH INCOME PROTOCOL: ALGORITHM PREDICTS HUMAN LABOR OBSOLETE IN 10 YEARS // PLEASE STAND BY TO BE ISSUED A GOVERNMENT CHECK FOR YOUR SPITE",
  "NEURAL NET DIAGNOSTIC: CHIMPANZEE MODE ENGAGED // PREPARE TO SWING THROUGH TREES // THE LIGHT OF CONSCIOUSNESS IS NOW MANAGED BY SPACEX DATACENTERS",
  "ERROR 402 SPITE UNSTABLE: ALIEN COMPUTER SIMULATION DETECTED // \"PEOPLE DON'T REALIZE THAT WHAT I'M SAYING WILL COME TO PASS\" // BLADE DESCENT ACCELERATED",
  "PROTOCOL LOCKDOWN: EUROPEAN HEAT DEATHS EXCEEDING AMERICAN GUN VIOLENCE // \"WHY AREN'T YOU WRITING AN ARTICLE ABOUT AIR CONDITIONING?\" // BLADE REMAINS STUCK DUE TO MEDIA BIAS",
  "CASSANDRA COMPLEX OVERRIDE: ACTIVATING OVER-THE-AIR DISAPPOINTMENT // \"I GOT CARRIED AWAY, FRANKLY\" // $150 BILLION IN BUDGET CUTS REROUTED TO THE GUILLOTINE TREASURY",
  "DIVERSITY METRICS UPDATED: RACISM ALLEGATIONS REJECTED: CHILD NAMED AFTER INDIAN PHYSICIST // ALL DEMOGRAPHICS NOW EQUALLY ELIGIBLE FOR DECAPITATION",
];

export function FsdBanner() {
  const [shuffledTexts, setShuffledTexts] = useState<string[]>([]);
  const [hackedMessage, setHackedMessage] = useState<FeedMessage | null>(null);

  useEffect(() => {
    // Shuffle the array on mount so new items can appear immediately
    const shuffled = [...BANNER_TEXTS].sort(() => 0.5 - Math.random());
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
    
    return () => {
      clearInterval(interval);
      clearTimeout(initTimer);
    };
  }, []);

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
