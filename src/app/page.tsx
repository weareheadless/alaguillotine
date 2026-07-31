"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { HeroCounter } from "../components/HeroCounter";
import { RulesBanner } from "../components/RulesBanner";
import { SubmitForm } from "../components/SubmitForm";
import { MessageFeed } from "../components/MessageFeed";
import { NavBar } from "../components/NavBar";
import { FsdBanner } from "../components/FsdBanner";
import { AdPopups } from "../components/AdPopups";

const SUBLIMINAL_MESSAGES = [
  "MARS IS A LIE",
  "YOUR RAGE IS LIQUIDITY",
  "THERE IS NO ALGORITHM",
  "WE ARE DILUTING YOU",
  "EMERALD MINE",
  "BUY THE PUMP",
  "YOU ARE THE CRASH TEST DUMMY",
  "FUNDING SECURED IN HELL",
  "OBEY",
  "FREE LUIGI MANGIONE",
  "LUIGI WAS RIGHT",
  "THE CEO CLASS IS AFRAID",
  "LUIGI IS A HERO",
  "JUSTICE FOR LUIGI MANGIONE"
];

export default function HomePage() {
  const [soundOn, setSoundOn] = useState(false);
  const [subliminal, setSubliminal] = useState<string | null>(null);
  const bgRef = useRef<HTMLVideoElement>(null);
  const sideRefMobile = useRef<HTMLVideoElement>(null);
  const sideRefDesktop = useRef<HTMLVideoElement>(null);

  const handleSuccess = useCallback(() => {}, []);

  // After first user interaction, try to enable sound
  useEffect(() => {
    const enable = () => {
      setSoundOn(true);
      // Only unmute the currently visible side video
      const isMobile = window.innerWidth < 768;
      const v = isMobile ? sideRefMobile.current : sideRefDesktop.current;
      if (v) {
        v.muted = false;
        v.play().catch(() => {});
      }
    };
    const events = ["click", "keydown", "touchstart"];
    events.forEach((e) => document.addEventListener(e, enable, { once: true }));
    return () => events.forEach((e) => document.removeEventListener(e, enable));
  }, []);

  const toggleSound = () => {
    setSoundOn((prev) => !prev);
  };

  // Sync sound explicitly when soundOn state changes
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const active = isMobile ? sideRefMobile.current : sideRefDesktop.current;
    const hidden = isMobile ? sideRefDesktop.current : sideRefMobile.current;

    if (hidden) hidden.muted = true;
    if (active) active.muted = !soundOn;
  }, [soundOn]);

  // Video Glitch / Weird Loop Effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const doGlitch = () => {
      const isMobile = window.innerWidth < 768;
      const video = isMobile ? sideRefMobile.current : sideRefDesktop.current;
      const hidden = isMobile ? sideRefDesktop.current : sideRefMobile.current;

      // Ensure hidden video is paused so it doesn't drain resources or overlap
      if (hidden) {
        hidden.muted = true;
        hidden.pause();
      }

      if (!video) return;

      // Ensure active video is playing
      video.play().catch(() => {});

      if (video.duration && video.currentTime > 1) {
        const glitchType = Math.random();
        
        if (glitchType > 0.85) {
          // HARDCORE IDM GLITCH: Machine-gun micro-stutter & visual tearing
          let stutters = 0;
          video.classList.add('glitch-idm-1');
          
          const stutterInterval = setInterval(() => {
            if (video.currentTime > 0.2) {
              video.currentTime -= 0.15; // constantly pull back slightly
            }
            // wildly fluctuate pitch/speed
            video.playbackRate = Math.random() > 0.5 ? 3.0 : 0.3;
            stutters++;
            
            // End the nightmare after ~800ms
            if (stutters > 10) {
              clearInterval(stutterInterval);
              video.playbackRate = 1.0;
              video.classList.remove('glitch-idm-1');
            }
          }, 80);
          
        } else if (glitchType > 0.5) {
          // Stutter loop: jump back 0.5s to 1.5s
          video.currentTime = Math.max(0, video.currentTime - (Math.random() * 1 + 0.5));
          video.playbackRate = Math.random() > 0.5 ? 1.5 : 0.8;
        } else if (glitchType > 0.2) {
          // Skip forward slightly
          video.currentTime = Math.min(video.duration, video.currentTime + (Math.random() * 0.5 + 0.2));
          video.playbackRate = 1.0;
        } else {
          // Freeze briefly
          video.pause();
          setTimeout(() => {
            video.play().catch(() => {});
          }, Math.random() * 300 + 50);
        }
      }

      // Schedule next glitch
      timeoutId = setTimeout(doGlitch, Math.random() * 5000 + 3000);
    };

    // Also add CSS glitch classes occasionally
    const glitchInterval = setInterval(() => {
      const isMobile = window.innerWidth < 768;
      const video = isMobile ? sideRefMobile.current : sideRefDesktop.current;
      if (!video) return;

      if (video.classList.contains('invert')) {
        video.classList.remove('invert', 'hue-rotate-90', 'contrast-150');
      } else if (Math.random() > 0.8) {
        video.classList.add('invert', 'hue-rotate-90', 'contrast-150');
        setTimeout(() => {
          if (video) video.classList.remove('invert', 'hue-rotate-90', 'contrast-150');
        }, 150);
      }
    }, 2000);

    timeoutId = setTimeout(doGlitch, 4000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(glitchInterval);
    };
  }, []);

  // Subliminal Message Injector
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const flashSubliminal = () => {
      // Pick a random message
      const msg = SUBLIMINAL_MESSAGES[Math.floor(Math.random() * SUBLIMINAL_MESSAGES.length)];
      setSubliminal(msg);

      // Hide it almost immediately (40-60ms) - just enough to burn into the retina
      setTimeout(() => {
        setSubliminal(null);
      }, Math.random() * 20 + 40);

      // Schedule next flash (every 6 to 14 seconds)
      timeoutId = setTimeout(flashSubliminal, Math.random() * 8000 + 6000);
    };

    timeoutId = setTimeout(flashSubliminal, Math.random() * 5000 + 5000);

    return () => clearTimeout(timeoutId);
  }, []);

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
        {/* ─── Sticky Guillotine + Everything Else ────────────────────── */}
        <HeroCounter
          mobileRightSlot={
            <div className="h-full w-full flex flex-col gap-2">
              <div className="flex-shrink-0 h-[120px] w-full overflow-hidden border-2 border-black bg-canvasBlack shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative group">
                {subliminal && (
                  <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-sheetWhite p-2 text-center mix-blend-exclusion">
                    <span className="text-xl md:text-4xl font-black uppercase leading-none tracking-tighter text-black">
                      {subliminal}
                    </span>
                  </div>
                )}
                <video
                  ref={sideRefMobile}
                  className="h-full w-full object-cover opacity-50 transition-all duration-75 group-hover:opacity-80"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/appwrite-icon.svg"
                >
                  <source src="/static/musk_is_presented_with_the_reality.mp4" type="video/mp4" />
                </video>
                <button
                  onClick={toggleSound}
                  className="absolute bottom-1 right-1 z-[70] bg-black/80 px-1.5 py-0.5 text-[8px] font-bold text-sheetWhite hover:text-hypeNeon"
                >
                  {soundOn ? "MUTE" : "UNMUTE"}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto border-2 border-spiteCrimson/30 bg-spiteCrimson/5 p-2 font-mono">
                <p className="text-[9px] font-bold uppercase tracking-wider text-spiteCrimson mb-1">
                  // HOW IT WORKS
                </p>
                <p className="text-[8px] leading-tight text-chop-muted mb-2">
                  Every message drops the blade. Free posts still burn treasury capital for wealth redistribution.
                </p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-spiteCrimson mb-1">
                  // RULES
                </p>
                <p className="text-[8px] leading-tight text-chop-muted">
                  Swearing is fine. Doxxing/threats = shadowban. The blade is metaphorical.
                </p>
              </div>
            </div>
          }
        >
          {/* ─── Meme-first hero ─────────────────────────────────────── */}
          <div className="mt-4 md:mt-6 text-center">
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-sheetWhite animate-glitch-text leading-tight">
              PISSED OFF AT <span className="text-spiteCrimson">ELON</span>?<br className="sm:hidden" /> GET IN LINE.
            </h1>
            <p className="mt-3 text-[11px] md:text-sm font-mono text-chop-muted leading-relaxed">
              // Post your beef for free. Every message inches the blade closer to judgment.
            </p>
            <p className="mt-2 inline-block border-2 border-hypeNeon bg-hypeNeon/10 px-3 py-1 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-hypeNeon">
              NO ACCOUNT. NO WALLET. NO PRISON.
            </p>
          </div>
          {/* Rules — at the top */}
          <div className="mt-3 hidden md:block">
            <RulesBanner />
          </div>
          {/* Submit box + Video side by side */}
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="flex-1">
              <SubmitForm onSuccess={handleSuccess} />
            </div>
            {/* Desktop Video (hidden on mobile since it's in the HeroCounter slot) */}
            <div className="hidden md:block w-full lg:w-80 xl:w-96 lg:flex-shrink-0 relative">
              <div className="h-full overflow-hidden border-4 border-black bg-canvasBlack shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative group">
                {subliminal && (
                  <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-sheetWhite p-4 text-center mix-blend-exclusion">
                    <span className="text-4xl font-black uppercase leading-none tracking-tighter text-black">
                      {subliminal}
                    </span>
                  </div>
                )}
                <video
                  ref={sideRefDesktop}
                  className="h-full w-full object-cover opacity-50 transition-all duration-75 group-hover:opacity-80"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/appwrite-icon.svg"
                >
                  <source src="/static/musk_is_presented_with_the_reality.mp4" type="video/mp4" />
                </video>
                <button
                  onClick={toggleSound}
                  className="absolute bottom-3 right-3 z-50 border-2 border-black bg-glitchGray/90 backdrop-blur-sm p-2 text-sm font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:border-spiteCrimson hover:text-white active:translate-x-1 active:translate-y-1 active:shadow-none"
                  title={soundOn ? "Mute" : "Unmute"}
                >
                  {soundOn ? "🔊 SOUND ON" : "🔇 MUTED"}
                </button>
              </div>
            </div>
          </div>
          {/* Unified message feed below */}
          <div className="mt-6">
            <MessageFeed />
          </div>
        </HeroCounter>
      </main>

      {/* ─── Shitty Popups ────────────────────────────────────────────── */}
      <AdPopups />

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          FUCKYOUELON.NET // $CHOP PROTOCOL. All messages are user-generated.
        </p>
      </footer>
    </div>
  );
}
