"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { HeroCounter } from "../components/HeroCounter";
import { RulesBanner } from "../components/RulesBanner";
import { SubmitForm } from "../components/SubmitForm";
import { MessageFeed } from "../components/MessageFeed";
import { NavBar } from "../components/NavBar";

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
    <div className="relative min-h-screen">
      {/* ─── Atmospheric Video Background ──────────────────────────────── */}
      <div className="video-bg">
        <video ref={bgRef} autoPlay muted loop playsInline poster="/appwrite-icon.svg">
          <source src="/static/musk_is_presented_with_the_reality.mp4" type="video/mp4" />
        </video>
      </div>

      {/* ─── Header / Nav ──────────────────────────────────────────────── */}
      <NavBar />

      <main className="relative z-10 mx-auto px-6 pb-8">
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
              <div className="h-full overflow-hidden rounded-lg border border-[#343536] bg-black">
                <video
                  ref={sideRef}
                  className="h-full w-full object-cover opacity-60"
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
          <div className="mt-4">
            <MessageFeed />
          </div>
        </HeroCounter>
      </main>

      {/* ─── Sound Toggle ─────────────────────────────────────────────── */}
      <button
        onClick={toggleSound}
        className="fixed bottom-6 right-6 z-50 rounded-full border border-[#343536] bg-[#1A1A1B]/90 p-3 text-lg backdrop-blur transition-colors hover:border-[#FF4500]"
        title={soundOn ? "Mute" : "Unmute"}
      >
        {soundOn ? "🔊" : "🔇"}
      </button>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[#343536] py-4 text-center">
        <p className="text-xs text-[#818384]">
          FuckYouElon — A public message board. All messages are user-generated.
        </p>
      </footer>
    </div>
  );
}
