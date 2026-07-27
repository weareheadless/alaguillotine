"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { databases, DATABASE_ID, MESSAGES_COLLECTION_ID } from "../lib/appwrite";
import { useExecution } from "../lib/execution-context";
import { Query } from "appwrite";
import { getDemoMessages } from "../lib/mock-data";

import { EXECUTION_THRESHOLD } from "../lib/constants";

export function HeroCounter({ children }: { children?: React.ReactNode }) {
  const [total, setTotal] = useState<number | null>(null);
  const [dropped, setDropped] = useState(false);
  const [bumping, setBumping] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [flashCount, setFlashCount] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugSlider, setDebugSlider] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; authorName: string; amount: number; ts: number }[]>([]);
  const { setExecuted, setTotalMessages } = useExecution();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const bladeRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef(0);

  // Enable debug mode via ?debug=true or Ctrl+Shift+G
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "true") {
        setDebugMode(true);
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "G") {
        e.preventDefault();
        setDebugMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fetchCount = async () => {
    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        [Query.equal("is_shadowbanned", false), Query.limit(1)]
      );
      const count = res.total;
      setTotal(count);
      setTotalMessages(count);
    } catch {
      // Fall back to demo data if DB not configured
      if (total === null) {
        const demo = getDemoMessages();
        const count = demo.filter((m) => !m.is_shadowbanned).length;
        setTotal(count);
        setTotalMessages(count);
      }
    }
  };

  useEffect(() => {
    fetchCount();
    intervalRef.current = setInterval(fetchCount, 4_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // In debug mode, use local state; otherwise use fetched count
  const displayTotal = debugMode ? debugSlider : (total ?? 0);

  // Detect new messages & trigger bump + pulse
  useEffect(() => {
    if (debugMode) return;
    const prev = prevCountRef.current;
    if (displayTotal > prev && prev > 0) {
      const diff = displayTotal - prev;
      setBumping(true);
      setPulsing(true);
      setFlashCount(true);
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
      bumpTimerRef.current = setTimeout(() => {
        setBumping(false);
        setPulsing(false);
        setFlashCount(false);
      }, 1500);
      // Show a generic toast for new messages detected by polling
      const id = ++toastIdRef.current;
      setToasts((t) => [...t.slice(-2), { id, authorName: "", amount: -diff, ts: Date.now() }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    }
    prevCountRef.current = displayTotal;
  }, [displayTotal, debugMode]);

  // ─── Listen for new-message events (fired by SubmitForm) ─────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { authorName: string; amount: number };
      const id = ++toastIdRef.current;

      // Bump count immediately
      setTotal((prev) => (prev ?? 0) + 1);

      // Trigger animations
      setBumping(true);
      setPulsing(true);
      setFlashCount(true);
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
      bumpTimerRef.current = setTimeout(() => {
        setBumping(false);
        setPulsing(false);
        setFlashCount(false);
      }, 1500);

      // Add toast
      setToasts((prev) => [...prev.slice(-2), { id, authorName: detail.authorName, amount: detail.amount, ts: Date.now() }]);

      // Remove toast after 5s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    };

    window.addEventListener("new-message", handler);
    return () => window.removeEventListener("new-message", handler);
  }, []);

  // Calculate progress percentage, clamped 0-100
  const progress = useMemo(() => {
    if (displayTotal === 0) return 0;
    const pct = (displayTotal / EXECUTION_THRESHOLD) * 100;
    return Math.min(pct, 100);
  }, [displayTotal]);

  // Milestone class based on progress
  const milestoneClass = useMemo(() => {
    if (progress >= 99) return "milestone-99";
    if (progress >= 95) return "milestone-95";
    if (progress >= 90) return "milestone-90";
    if (progress >= 75) return "milestone-75";
    if (progress >= 50) return "milestone-50";
    if (progress >= 25) return "milestone-25";
    return "";
  }, [progress]);

  // Check if threshold reached
  useEffect(() => {
    if (displayTotal >= EXECUTION_THRESHOLD && !dropped) {
      setDropped(true);
      setExecuted(true);
      if (mainRef.current) {
        mainRef.current.classList.add("animate-shake");
        setTimeout(() => {
          mainRef.current?.classList.remove("animate-shake");
        }, 400);
      }
    }
    // In debug mode, allow resetting the blade below threshold
    if (debugMode && displayTotal < EXECUTION_THRESHOLD && dropped) {
      setDropped(false);
      setExecuted(false);
    }
  }, [displayTotal, dropped, setExecuted, debugMode]);

  // Blade translation:
  //   translateY(%) in CSS is relative to the ELEMENT's own height.
  //   Blade is 26% of wrapper height, so wrapper = blade × (100/26) ≈ 3.85×.
  //   At 0%   → translateY(0%)     → blade just below top beam
  //   At 100% → translateY(242%)   → blade approaches head (~69% of wrapper)
  //   Dropped → translateY(265%)   → blade slams past the head (~76%)
  const BLADE_HEIGHT_PCT = 26;
  const scale = 100 / BLADE_HEIGHT_PCT; // ~3.846
  const travelStart = 0;
  const travelEnd = Math.round(63 * scale);   // ~242
  const travelRange = travelEnd - travelStart;
  const bladeOffset = dropped
    ? Math.round(69 * scale)   // ~265
    : travelStart + (progress / 100) * travelRange;

  // Debug: add fake messages
  const addDebugMessages = useCallback((n: number) => {
    setDebugSlider((prev) => Math.min(prev + n, EXECUTION_THRESHOLD + 1000));
  }, []);

  // Debug: jump to specific progress
  const jumpToProgress = useCallback((pct: number) => {
    setDebugSlider(Math.floor((pct / 100) * EXECUTION_THRESHOLD));
  }, []);

  // Debug: force drop
  const forceDrop = useCallback(() => {
    setDebugSlider(EXECUTION_THRESHOLD);
  }, []);

  return (
    <section
      ref={mainRef}
      className="relative mx-auto mt-4 w-full px-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        {/* ─── Left: Sticky Guillotine Sidebar ──────────────────────── */}
        <div className="flex flex-col items-center md:sticky md:top-20 md:w-auto md:flex-shrink-0 md:self-start">
          <div className="guillotine-wrapper">
            {/* Track */}
            <div className="guillotine-track" />

            {/* Frame posts */}
            <div className="guillotine-post-left" />
            <div className="guillotine-post-right" />

            {/* Top beam */}
            <div className="guillotine-beam" />

            {/* Base */}
            <div className="guillotine-base" />

            {/* Lunette (stock with neck notch) */}
            <div className="guillotine-lunette" />

            {/* Head in the lunette */}
            <div className={`guillotine-head ${dropped ? "severed" : ""}`} />

            {/* Blade assembly */}
            <div
              className="guillotine-blade-wrapper"
              style={{ transform: `translateX(-50%) translateY(${bladeOffset}%)` }}
            >
              <div
                ref={bladeRef}
                className={`guillotine-blade ${dropped ? "dropped" : ""} ${bumping ? "bump" : ""} ${milestoneClass}`}
              />
            </div>

            {/* Side progress bar — left side, gamified */}
            <div className="guillotine-progress">
              <div
                className={`guillotine-progress-fill ${pulsing ? "progress-pulse" : ""}`}
                style={{ height: `${progress}%` }}
              />
              {/* Milestone markers */}
              <div className="guillotine-progress-mark" style={{ bottom: '25%' }} />
              <div className="guillotine-progress-mark" style={{ bottom: '50%' }} />
              <div className="guillotine-progress-mark" style={{ bottom: '75%' }} />
            </div>
            <span className="absolute -left-7 top-[4%] text-[7px] font-bold text-[#666]">
              100%
            </span>
            <span className="absolute -left-7 bottom-[4%] text-[7px] font-bold text-[#666]">
              0%
            </span>
          </div>

          {/* Status + compact stats below guillotine */}
          <div className="mt-2 w-full text-center">
            {dropped ? (
              <p className="animate-fade-in text-xs font-black uppercase tracking-widest text-[#FF4500]">
                ⚔️ The blade has fallen ⚔️
              </p>
            ) : (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#818384]">
                Progress toward judgment
              </p>
            )}
            {/* Compact inline stats */}
            <div className="mt-1 flex items-center justify-center gap-3 text-[9px] tabular-nums text-[#666]">
              <span className={`${flashCount ? "animate-counter-pulse text-[#FF4500]" : ""}`}>{displayTotal.toLocaleString()}</span>
              <span className="text-[#818384]">msgs</span>
              <span className="text-[#444]">/</span>
              <span className="text-[#FF4500]">{EXECUTION_THRESHOLD.toLocaleString()}</span>
              <span className="text-[#444]">·</span>
              <span className={`text-[#FF4500] ${flashCount ? "animate-counter-pulse" : ""}`}>{progress.toFixed(1)}%</span>
            </div>
            {/* Mini progress bar */}
            <div className="mx-auto mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-[#1A1A1B]">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  dropped ? "bg-[#FF4500]" : "bg-gradient-to-r from-[#FF4500] to-[#D93A00]"
                } ${pulsing ? "progress-bar-pulse" : ""}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* ─── Live Event Toasts ──────────────────────────────────────── */}
          {toasts.length > 0 && (
            <div className="toast-container mt-3">
              {toasts.map((t) => (
                <div key={t.id} className={`toast-item ${t.amount > 0 ? "paid-toast" : ""}`}>
                  <span>
                    {t.amount < 0 ? (
                      <>⚡ <span className="toast-author">{Math.abs(t.amount)} new message{Math.abs(t.amount) > 1 ? "s" : ""}</span> — blade just moved!</>
                    ) : t.amount > 0 ? (
                      <>💎 <span className="toast-author">{t.authorName || "Anon"}</span>{" "}
                        paid <span className="toast-amount">${t.amount.toFixed(2)}</span>{" "}
                        — blade drops <span className="toast-amount">{(t.amount / 1000).toFixed(3)}%</span></>
                    ) : (
                      <>⚔️ <span className="toast-author">{t.authorName || "Anon"}</span>{" "}
                        moved the blade <span className="toast-amount">{(1 / EXECUTION_THRESHOLD * 100).toFixed(4)}%</span> closer</>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ─── Debug Panel ──────────────────────────────────────────── */}
          {debugMode && (
            <div className="mt-3 w-full rounded-lg border border-[#FF4500]/30 bg-[#1A1A1B] p-3 animate-fade-in">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#FF4500]">
                🛠 Debug Panel
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 10, 100, 1000, 10000, 100000].map((n) => (
                  <button
                    key={n}
                    onClick={() => addDebugMessages(n)}
                    className="rounded border border-[#333] bg-[#1A1A1B] px-2 py-0.5 text-[10px] text-[#ccc] hover:border-[#FF4500] hover:text-[#FF4500] transition-colors"
                  >
                    +{n.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[10, 25, 50, 75, 90, 95, 99].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => jumpToProgress(pct)}
                    className="rounded border border-[#333] bg-[#1A1A1B] px-2 py-0.5 text-[10px] text-[#FF4500] hover:border-[#FF4500] transition-colors"
                  >
                    {pct}%
                  </button>
                ))}
                <button
                  onClick={forceDrop}
                  className="rounded border border-[#FF4500] bg-[#1A1A1B] px-2 py-0.5 text-[10px] font-bold text-[#FF4500] hover:bg-[#FF4500] hover:text-white transition-colors"
                >
                  ⚔️ DROP
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={EXECUTION_THRESHOLD}
                  value={debugSlider}
                  onChange={(e) => setDebugSlider(Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer accent-[#FF4500]"
                />
                <span className="text-[9px] tabular-nums text-[#818384] w-16 text-right">
                  {debugSlider.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ─── Right: Content ──────────────────────────────────────── */}
        <div className="flex w-full min-w-0 flex-1 flex-col">
          {/* Messages, rules, submit — everything flows here */}
          {children}
        </div>
      </div>
    </section>
  );
}
