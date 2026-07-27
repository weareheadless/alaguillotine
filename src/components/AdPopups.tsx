"use client";

import { useState, useEffect } from "react";

const ADS = [
  {
    title: "⚠️ GOV EFFICIENCY UPDATE",
    body: "ZERO LIVES LOST DUE TO GUILLOTINE BUDGET CUTS // WE HAVE SOCIALIZED THE BLADE MAINTENANCE AND PRIVATIZED THE SPITE // \"0.0 DEATHS, FRANKLY\"",
    cta: "DEFUND OVERSIGHT"
  },
  {
    title: "ACQUISITION ALERT",
    body: "TREASURY FUNDS REROUTED TO BAIL OUT MY COUSIN’S SOLAR-POWERED GUILLOTINE STARTUP // SYNERGIES WILL BE QUASI-INFINITE // DO NOT VOTE AGAINST MY COMP PACKAGE",
    cta: "APPROVE PAY"
  },
  {
    title: "MARS COLONY PROTOCOL",
    body: "RAPID UNSCHEDULED DISASSEMBLY OF THE GUILLOTINE EXPECTED // VALUATION HAS BEEN ADJUSTED UPWARD BY $40 BILLION TO REFLECT THE DATA GATHERED",
    cta: "FUND EXPLOSION"
  },
  {
    title: "FSD BETA ALERT",
    body: "BLADE NEURAL NET IS HALLUCINATING AND TARGETING PEDESTRIANS // PLEASE BURN $CHOP TO TRAIN THE ALGORITHM // \"THE SYSTEM IS LEARNING TO AVOID HEAT DEATHS IN EUROPE\"",
    cta: "IGNORE OVERSIGHT"
  },
  {
    title: "xCHOP AI INTEGRATION",
    body: "LICENSING YOUR HATE SPEECH TO MY OWN SHELL COMPANY AT A 400% PREMIUM // FUNDING SECURED // THE JOURNALISTS COMPLAINING ARE TRAITORS TO THE WEST",
    cta: "SUBSIDIZE ME"
  },
  {
    title: "ABUNDANCE PROTOCOL",
    body: "MONEY WON'T MATTER IN 2036 // PLEASE DEPOSIT ALL YOUR WORTHLESS FIAT INTO THE GUILLOTINE TREASURY SO WE CAN REACH THE SINGULARITY FASTER",
    cta: "DONATE FIAT"
  }
];

export function AdPopups() {
  const [currentAd, setCurrentAd] = useState<number | null>(null);
  const [adHistory, setAdHistory] = useState<number[]>([]);

  useEffect(() => {
    // Start first ad after a short delay, ensuring randomness
    const timer = setTimeout(() => {
      const initialAd = Math.floor(Math.random() * ADS.length);
      setCurrentAd(initialAd);
      setAdHistory([initialAd]);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  const closeAd = () => {
    setCurrentAd(null);
    // Annoying feature: another one comes back in 12-25 seconds
    setTimeout(() => {
      setAdHistory(prev => {
        // Pick an ad we haven't seen recently if possible
        const available = ADS.map((_, i) => i).filter(i => !prev.includes(i));
        const nextPool = available.length > 0 ? available : ADS.map((_, i) => i);
        const nextAd = nextPool[Math.floor(Math.random() * nextPool.length)];
        setCurrentAd(nextAd);
        // Keep a history of the last 3 ads to avoid quick repeats
        return [...prev.slice(-2), nextAd];
      });
    }, Math.random() * 13000 + 12000);
  };

  if (currentAd === null) return null;

  const ad = ADS[currentAd];

  return (
    <div className="fixed bottom-6 left-6 z-50 w-64 border-4 border-black bg-[#FDE047] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-fade-in font-mono">
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
