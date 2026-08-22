"use client";

import { useEffect, useRef } from "react";
import { RulesBanner } from "../components/RulesBanner";
import { NavBar } from "../components/NavBar";
import { FsdBanner } from "../components/FsdBanner";
import { AdPopups } from "../components/AdPopups";
import { RaceBoard } from "../components/RaceBoard";
import { useSiteContent } from "../lib/use-site-content";

function splitHeadline(headline: string): { before: string; match: string; afterLine1: string; afterLine2: string } {
  const elonIdx = headline.search(/elon/i);
  let before = "";
  let match = "";
  let after = "";
  if (elonIdx === -1) {
    const lastSpace = headline.lastIndexOf(" ");
    before = lastSpace === -1 ? "" : headline.slice(0, lastSpace + 1);
    match = lastSpace === -1 ? headline : headline.slice(lastSpace + 1);
  } else {
    before = headline.slice(0, elonIdx);
    match = headline.slice(elonIdx, elonIdx + 4);
    after = headline.slice(elonIdx + 4);
  }
  const spaceIdx = after.indexOf(" ");
  return {
    before,
    match,
    afterLine1: spaceIdx === -1 ? after : after.slice(0, spaceIdx + 1),
    afterLine2: spaceIdx === -1 ? "" : after.slice(spaceIdx + 1),
  };
}

export default function HomePage() {
  const { content } = useSiteContent();
  const bgRef = useRef<HTMLVideoElement>(null);

  const headlineParts = splitHeadline(content.hero.headline);

  return (
    <div className="relative min-h-screen bg-canvasBlack">
      {/* ─── FSD Over-The-Air Banner ─────────────────────────────────── */}
      <FsdBanner />

      {/* ─── Atmospheric Video Background ──────────────────────────────── */}
      <div className="video-bg">
        <video ref={bgRef} autoPlay muted loop playsInline poster="/appwrite-icon.svg">
          <source src="/static/musk_is_presented_with_the_reality.mp4" type="video/mp4" />
        </video>
      </div>

      {/* ─── Header / Nav ──────────────────────────────────────────────── */}
      <NavBar />

      <main className="relative z-10 mx-auto pb-16 md:pb-8">
        {/* ─── the-guillotine v2: dynamic race board ─────────────────── */}
        <div className="mx-auto mt-6 max-w-5xl px-6 text-center">
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-sheetWhite animate-glitch-text leading-tight">
            {headlineParts.before}
            <span className="text-spiteCrimson">{headlineParts.match}</span>
            {headlineParts.afterLine1}
            {headlineParts.afterLine2 !== "" && <br className="sm:hidden" />}
            {headlineParts.afterLine2}
          </h1>
          <p className="mt-3 text-[11px] md:text-sm font-mono text-chop-muted leading-relaxed">
            {content.hero.subheadline}
          </p>
          <p className="mt-2 inline-block border-2 border-hypeNeon bg-hypeNeon/10 px-3 py-1 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-hypeNeon">
            {content.hero.badge}
          </p>
        </div>

        <RaceBoard />

        <div className="mx-auto mt-8 max-w-5xl px-6">
          <RulesBanner />
        </div>
      </main>

      {/* ─── Shitty Popups ────────────────────────────────────────────── */}
      <AdPopups />

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          {content.footer}
        </p>
      </footer>
    </div>
  );
}
