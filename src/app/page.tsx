"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { HeroCounter } from "../components/HeroCounter";
import { RulesBanner } from "../components/RulesBanner";
import { SubmitForm } from "../components/SubmitForm";
import { MessageFeed } from "../components/MessageFeed";
import { NavBar } from "../components/NavBar";
import { FsdBanner } from "../components/FsdBanner";

export default function HomePage() {
  const [soundOn, setSoundOn] = useState(false);
  const bgRef = useRef<HTMLVideoElement>(null);
  const sideRef = useRef<HTMLVideoElement>(null);

  const handleSuccess = useCallback(() => {}, []);

  // After first user interaction, try to enable sound
  useEffect(() => {
    const enable = () => {
      setSoundOn(true);
      const vids = [bgRef.current, sideRef.current];
      vids.forEach((v) => { if (v) { v.muted = false; v.play().catch(() => {}); } });
    };
    const events = ["click", "keydown", "touchstart"];
    events.forEach((e) => document.addEventListener(e, enable, { once: true }));
    return () => events.forEach((e) => document.removeEventListener(e, enable));
  }, []);

  const toggleSound = () => {
    const vids = [bgRef.current, sideRef.current];
    vids.forEach((v) => { if (v) v.muted = !soundOn; });
    setSoundOn(!soundOn);
  };

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

      <main className="relative z-10 mx-auto pb-8">
        {/* ─── Sticky Guillotine + Everything Else ────────────────────── */}
        <HeroCounter>
          {/* Rules — at the top */}
          <div className="mt-3">
            <RulesBanner />
          </div>
          {/* Submit box + Video side by side */}
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="flex-1">
              <SubmitForm onSuccess={handleSuccess} />
            </div>
            <div className="w-full lg:w-80 xl:w-96 lg:flex-shrink-0">
              <div className="h-full overflow-hidden border-4 border-black bg-canvasBlack shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <video
                  ref={sideRef}
                  className="h-full w-full object-cover opacity-50"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/appwrite-icon.svg"
                >
                  <source src="/static/musk_is_presented_with_the_reality.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>
          {/* Unified message feed below */}
          <div className="mt-6">
            <MessageFeed />
          </div>
        </HeroCounter>
      </main>

      {/* ─── Sound Toggle ─────────────────────────────────────────────── */}
      <button
        onClick={toggleSound}
        className="fixed bottom-6 right-6 z-50 border-2 border-black bg-glitchGray p-3 text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:border-spiteCrimson active:translate-x-1 active:translate-y-1 active:shadow-none"
        title={soundOn ? "Mute" : "Unmute"}
      >
        {soundOn ? "🔊" : "🔇"}
      </button>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          FUCKYOUELON.NET // $CHOP PROTOCOL. All messages are user-generated.
        </p>
      </footer>
    </div>
  );
}
