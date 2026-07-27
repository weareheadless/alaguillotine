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
  const sideRef = useRef<HTMLVideoElement>(null);

  const handleSuccess = useCallback(() => {}, []);

  // After first user interaction, try to enable sound
  useEffect(() => {
    const enable = () => {
      setSoundOn(true);
      // Only unmute the side video so the background doesn't create an echo/overlap
      const v = sideRef.current;
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
    const v = sideRef.current;
    if (v) {
      v.muted = soundOn; // soundOn is current state, so we are flipping it
    }
    setSoundOn(!soundOn);
  };

  // Video Glitch / Weird Loop Effect
  useEffect(() => {
    const video = sideRef.current;
    if (!video) return;

    let timeoutId: NodeJS.Timeout;

    const doGlitch = () => {
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
            <div className="w-full lg:w-80 xl:w-96 lg:flex-shrink-0 relative">
              <div className="h-full overflow-hidden border-4 border-black bg-canvasBlack shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative">
                {subliminal && (
                  <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-sheetWhite p-4 text-center mix-blend-exclusion">
                    <span className="text-4xl font-black uppercase leading-none tracking-tighter text-black">
                      {subliminal}
                    </span>
                  </div>
                )}
                <video
                  ref={sideRef}
                  className="h-full w-full object-cover opacity-50 transition-all duration-75"
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
