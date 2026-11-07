"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchTopBounties } from "../app/actions/feed";
import type { FeedMessage } from "../lib/types";
import { useSiteContent } from "../lib/use-site-content";
import { useAdaVoice } from "../lib/use-ada-voice";
import type { AdContent } from "../lib/content";

export function AdPopups() {
  const { content } = useSiteContent();
  const [currentAd, setCurrentAd] = useState<{ isSystem: boolean, data: any } | null>(null);
  const [adHistory, setAdHistory] = useState<number[]>([]);
  const [bounties, setBounties] = useState<FeedMessage[]>([]);

  // Periodically fetch top bounties to inject as ads
  useEffect(() => {
    const loadBounties = async () => {
      try {
        const docs = await fetchTopBounties();
        setBounties(docs);
      } catch (e) {
        console.error("Failed to load bounties for ads", e);
      }
    };
    loadBounties();
    const interval = setInterval(loadBounties, 30_000); // Check every 30s
    const paidMessageHandler = async (event: Event) => {
      const detail = (event as CustomEvent).detail as FeedMessage;
      setCurrentAd({ isSystem: false, data: detail });
      try {
        setBounties(await fetchTopBounties());
      } catch {
        /* The paid message is already available locally for the popup. */
      }
    };
    window.addEventListener("paid-message", paidMessageHandler);
    return () => {
      clearInterval(interval);
      window.removeEventListener("paid-message", paidMessageHandler);
    };
  }, []);

  const ada = useAdaVoice();
  const ads = ada.ads.length ? ada.ads : content.ads;

  const triggerNextAd = useCallback((history: number[], currentBounties: FeedMessage[]) => {
    // 50% chance to show a user-paid bounty if we have any
    if (currentBounties.length > 0 && Math.random() > 0.5) {
      // Pick a random top bounty (weighted by chance or just random among top 5)
      const randomBounty = currentBounties[Math.floor(Math.random() * currentBounties.length)];
      setCurrentAd({ isSystem: false, data: randomBounty });
    } else {
      // Pick a system ad we haven't seen recently
      const available = ads.map((_, i) => i).filter(i => !history.includes(i));
      const nextPool = available.length > 0 ? available : ads.map((_, i) => i);
      const nextAdIdx = nextPool[Math.floor(Math.random() * nextPool.length)];
      setCurrentAd({ isSystem: true, data: ads[nextAdIdx] });
      setAdHistory(prev => [...prev.slice(-2), nextAdIdx]);
    }
  }, [ads]);

  useEffect(() => {
    // Start first ad after a short delay
    const timer = setTimeout(() => triggerNextAd([], bounties), 8000);
    return () => clearTimeout(timer);
  }, [triggerNextAd, bounties]);

  const closeAd = () => {
    setCurrentAd(null);
    // Annoying feature: another one comes back in 12-25 seconds
    setTimeout(() => {
      triggerNextAd(adHistory, bounties);
    }, Math.random() * 13000 + 12000);
  };

  if (currentAd === null) return null;

  const isSystem = currentAd.isSystem;
  
  if (!isSystem) {
    // USER PAID BOUNTY AD
    const msg = currentAd.data as FeedMessage;
    return (
      <div className="fixed top-24 md:top-[unset] md:bottom-24 right-4 md:right-10 z-50 w-72 md:w-80 border-4 border-spiteCrimson bg-canvasBlack shadow-[8px_8px_0px_0px_#E11D48] animate-screen-shake font-mono group">
        <div className="flex items-center justify-between border-b-4 border-spiteCrimson bg-spiteCrimson px-2 py-1 text-white">
          <span className="text-[10px] md:text-xs font-black tracking-widest animate-pulse text-black uppercase">⚠️ PAID OVERRIDE</span>
          <button onClick={closeAd} className="text-sm font-black hover:text-black focus:outline-none">X</button>
        </div>
        <div className="p-4 grid-overlay">
          <div className="mb-2 inline-block border-2 border-hypeNeon bg-hypeNeon/10 px-2 py-0.5 text-[10px] font-bold text-hypeNeon">
            SPONSORED: ${msg.amount_paid.toFixed(2)} CHOP
          </div>
          <h4 className="mb-3 text-xs md:text-sm font-black text-sheetWhite leading-tight">
            "{msg.text}"
          </h4>
          <p className="mb-4 text-[10px] text-chop-muted text-right">
            — {msg.author_name}
          </p>
          <button 
            onClick={closeAd} 
            className="w-full border-2 border-spiteCrimson bg-black py-1.5 text-[10px] font-bold tracking-widest text-spiteCrimson hover:bg-spiteCrimson hover:text-black transition-all"
          >
            DISMISS OBLIGATION
          </button>
        </div>
      </div>
    );
  }

  // SYSTEM AD
  const ad = currentAd.data as AdContent;

  return (
    <div className="fixed bottom-24 md:bottom-6 left-4 md:left-6 z-50 w-64 md:w-72 border-4 border-black bg-[#FDE047] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-fade-in font-mono">
      <div className="flex items-center justify-between border-b-4 border-black bg-spiteCrimson px-2 py-1 text-white">
        <span className="text-[10px] font-bold tracking-widest animate-pulse">SYSTEM_AD_</span>
        <button onClick={closeAd} className="text-sm font-black hover:text-black focus:outline-none">X</button>
      </div>
      <div className="p-3">
        <h4 className="mb-2 text-xs font-black uppercase text-canvasBlack leading-tight">{ad.title}</h4>
        <p className="mb-4 text-[10px] text-canvasBlack/90 leading-tight">{ad.body}</p>
        <button 
          onClick={closeAd} 
          className="w-full border-2 border-black bg-hypeNeon py-1.5 text-[10px] font-bold tracking-widest text-canvasBlack shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          {ad.cta}
        </button>
      </div>
    </div>
  );
}
