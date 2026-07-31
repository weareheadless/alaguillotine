"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useExecution } from "../lib/execution-context";
import { getDemoMessages } from "../lib/mock-data";
import { fetchMessageCount } from "../app/actions/feed";

import { EXECUTION_THRESHOLD } from "../lib/constants";
import { fetchSidebarMetrics } from "../app/actions/metrics";
import type { SidebarMetrics } from "../app/actions/metrics";

export function HeroCounter({ children, mobileRightSlot }: { children?: React.ReactNode, mobileRightSlot?: React.ReactNode }) {
  const [total, setTotal] = useState<number | null>(null);
  const [dropped, setDropped] = useState(false);
  const [bumping, setBumping] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [flashCount, setFlashCount] = useState(false);
  const [metrics, setMetrics] = useState<SidebarMetrics | null>(null);
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
      const res = await fetchMessageCount();
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

  // Fetch sidebar metrics (tokens burnt, treasury, burn/message)
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const m = await fetchSidebarMetrics();
        setMetrics(m);
      } catch { /* silently fail */ }
    };
    fetchMetrics();
    const metricsInterval = setInterval(fetchMetrics, 15_000);
    return () => clearInterval(metricsInterval);
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
  // translateY(%) in CSS is relative to the wrapper's own height (100% of container = 440px).
  // We want the blade to travel from 0% down to ~64% of the container so its bottom hits the base.
  const travelStart = 0;
  const travelEnd = 64;
  const travelRange = travelEnd - travelStart;
  const bladeOffset = dropped
    ? 74 // slams all the way through
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
      <div className="flex flex-col gap-0 md:flex-row border-b-4 border-black md:border-b-0">
        {/* ─── Left: Sidebar (Horizontal on Mobile, Vertical on Desktop) ─ */}
        <div className="relative flex flex-col md:items-center bg-sheetWhite md:border-r-4 border-black md:sticky md:top-20 md:h-[calc(100vh-5rem)] md:min-w-[280px] md:max-w-[280px] md:flex-shrink-0 md:self-stretch">
          {/* Grid overlay */}
          <div className="absolute inset-0 z-0 grid-overlay pointer-events-none opacity-30" />

          <div className="relative z-10 flex w-full flex-row md:flex-col items-stretch md:items-center justify-between md:justify-start px-2 py-2 md:px-4 md:py-6 overflow-y-auto gap-2 md:gap-0">
            {/* ─── Mobile Left: Guillotine + Stats ──────────────────── */}
            <div className="flex flex-col items-center justify-center w-[40%] md:w-full flex-shrink-0">
              {/* ─── Guillotine ────────────────────────────────────────── */}
              <div className="relative w-[110px] h-[242px] md:w-[200px] md:h-[440px] flex-shrink-0">
                <div className="guillotine-wrapper flex-shrink-0 absolute top-0 left-0 origin-top-left scale-[0.55] md:scale-100">
                  {/* Frame posts */}
                <div className="guillotine-post-left" />
              <div className="guillotine-post-right" />

              {/* Top beam */}
              <div className="guillotine-beam" />

              {/* Base */}
              <div className="guillotine-base" />

              {/* Lunette */}
              <div className="guillotine-lunette" />

              {/* Head */}
              <div className={`guillotine-head ${dropped ? "severed" : ""}`} />

              {/* Inner clipping container for rope and blade */}
              <div className="absolute inset-0 overflow-hidden z-10">
                <div
                  className="guillotine-blade-wrapper"
                  style={{ transform: `translateX(-50%) translateY(${bladeOffset}%)` }}
                >
                  {/* Rope extending UP from the blade */}
                  <div className="absolute left-1/2 bottom-[93%] w-1.5 h-[1000px] -translate-x-1/2 bg-glitchGray border-x border-black/50" />
                  
                  {/* Digital Sparks / Artifacts around the blade */}
                  <div className="absolute top-[40%] left-[-10%] w-2 h-1 bg-spiteCrimson animate-pulse opacity-0 [animation:scanline-glitch_4s_infinite]" />
                  <div className="absolute top-[80%] right-[-5%] w-3 h-1 bg-hypeNeon animate-pulse opacity-0 [animation:scanline-glitch_6s_infinite_1s]" />
                  <div className="absolute top-[20%] left-[20%] w-1 h-3 bg-white opacity-0 [animation:scanline-glitch_5s_infinite_2.5s]" />

                  <div
                    ref={bladeRef}
                    className={`guillotine-blade ${dropped ? "dropped" : ""} ${bumping ? "bump" : ""} ${milestoneClass}`}
                  />
                </div>
              </div>

              {/* Side progress bar */}
              <div className="guillotine-progress">
                <div
                  className={`guillotine-progress-fill ${pulsing ? "progress-pulse" : ""}`}
                  style={{ height: `${progress}%` }}
                />
                <div className="guillotine-progress-mark" style={{ bottom: '25%' }} />
                <div className="guillotine-progress-mark" style={{ bottom: '50%' }} />
                <div className="guillotine-progress-mark" style={{ bottom: '75%' }} />
              </div>
              <span className="absolute -left-7 top-[4%] text-[7px] font-bold text-canvasBlack">
                100%
              </span>
              <span className="absolute -left-7 bottom-[4%] text-[7px] font-bold text-canvasBlack">
                0%
              </span>
            </div>
            </div>

            {/* ─── Status + Stats ────────────────────────────────────── */}
            <div className="md:mt-4 w-full md:w-full flex-1 md:flex-none text-center font-mono">
              {dropped ? (
                <p className="animate-fade-in text-[10px] md:text-sm font-black uppercase tracking-widest text-spiteCrimson animate-glitch-text">
                  ⚔️ The blade has fallen ⚔️
                </p>
              ) : (
                <p className="text-[9px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-chop-muted">
                  // Progress toward judgment
                </p>
              )}
              <div className="mt-1.5 flex items-center justify-center gap-1 md:gap-2 text-[11px] md:text-[13px] tabular-nums font-bold">
                <span className={`${flashCount ? "animate-counter-pulse text-hypeNeon" : "text-canvasBlack"}`}>
                  {displayTotal.toLocaleString()}
                </span>
                <span className="text-chop-muted">/</span>
                <span className="text-spiteCrimson">{EXECUTION_THRESHOLD.toLocaleString()}</span>
              </div>
              <div className="mt-0.5 text-[10px] md:text-[11px] tabular-nums font-bold">
                <span className={`${flashCount ? "animate-counter-pulse" : ""} ${progress >= 90 ? "text-spiteCrimson" : "text-hypeNeon"}`}>
                  {progress < 0.001 && progress > 0
                    ? progress.toFixed(4)
                    : progress.toFixed(2)}%
                </span>
              </div>
              {/* Mini progress bar */}
              <div className="mx-auto mt-2 h-2 w-[85%] md:w-44 overflow-hidden border-2 border-black bg-canvasBlack">
                <div
                  className={`h-full transition-all duration-1000 ${
                    dropped ? "bg-spiteCrimson" : "bg-gradient-to-r from-spiteCrimson via-hypeNeon to-spiteCrimson"
                  } ${pulsing ? "progress-bar-pulse" : ""}`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* ─── Treasury Metrics ─────────────────────────────────── */}
              {metrics && (
                <div className="mt-3 space-y-1.5 border-t-2 border-dashed border-black pt-3">
                  {/* Messages this epoch */}
                  <div className="flex justify-between items-center text-[9px] md:text-[10px]">
                    <span className="text-chop-muted uppercase tracking-wider">Epoch msgs</span>
                    <span className="tabular-nums font-bold text-canvasBlack">
                      {metrics.messagesThisEpoch.toLocaleString()}
                      {metrics.epochThreshold > 0 && (
                        <span className="text-chop-muted"> / {metrics.epochThreshold.toLocaleString()}</span>
                      )}
                    </span>
                  </div>
                  {/* Epoch progress bar */}
                  {metrics.epochThreshold > 0 && (
                    <div className="mx-auto h-1.5 w-full overflow-hidden border border-black bg-canvasBlack">
                      <div
                        className="h-full bg-gradient-to-r from-hypeNeon to-spiteCrimson transition-all duration-700"
                        style={{
                          width: `${Math.min((metrics.messagesThisEpoch / metrics.epochThreshold) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  {/* Tokens burnt (total) */}
                  <div className="flex justify-between items-center text-[9px] md:text-[10px]">
                    <span className="text-chop-muted uppercase tracking-wider">🔥 Burnt</span>
                    <span className="tabular-nums font-bold text-spiteCrimson">{metrics.totalBurnt.toLocaleString()} CHOP</span>
                  </div>
                  {/* CHOPS in treasury */}
                  <div className="flex justify-between items-center text-[9px] md:text-[10px]">
                    <span className="text-chop-muted uppercase tracking-wider">🏦 Treasury</span>
                    <span className="tabular-nums font-bold text-canvasBlack">{metrics.treasuryBalance.toLocaleString()} CHOP</span>
                  </div>
                  {/* Cost per free message */}
                  <div className="flex justify-between items-center text-[9px] md:text-[10px]">
                    <span className="text-chop-muted uppercase tracking-wider">💰 Burn/msg</span>
                    <span className="tabular-nums font-bold text-hypeNeon">
                      {metrics.burnPerMessage > 0
                        ? metrics.burnPerMessage < 0.01
                          ? metrics.burnPerMessage.toFixed(6)
                          : metrics.burnPerMessage.toFixed(2)
                        : "—"}{" "}
                      CHOP
                    </span>
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* ─── Mobile Right: Media Slot ───────────────────────────── */}
            {mobileRightSlot && (
              <div className="w-[60%] flex-shrink-0 md:hidden h-[242px]">
                {mobileRightSlot}
              </div>
            )}

            {/* ─── Live Event Toasts ──────────────────────────────────── */}
            {toasts.length > 0 && (
              <div className="toast-container mt-4 w-full max-w-none">
                {toasts.map((t) => (
                  <div key={t.id} className={`toast-item !text-canvasBlack ${t.amount > 0 ? "paid-toast" : ""}`}>
                    <span>
                      {t.amount < 0 ? (
                        <>⚡ <span className="toast-author">{Math.abs(t.amount)} new message{Math.abs(t.amount) > 1 ? "s" : ""}</span> — blade just moved!</>
                      ) : t.amount > 0 ? (
                        <>💎 <span className="toast-author">{t.authorName || "Anon"}</span>{" "}
                          paid <span className="toast-amount">${t.amount.toFixed(2)} CHOP</span>{" "}
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

            {/* ─── Debug Panel ────────────────────────────────────────── */}
            {debugMode && (
              <div className="mt-3 w-full border-2 border-spiteCrimson bg-glitchGray p-3 animate-fade-in font-mono">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-spiteCrimson">
                  [ DEBUG PANEL ]
                </p>
                <div className="flex flex-wrap gap-1">
                  {[1, 10, 100, 1000, 10000, 100000].map((n) => (
                    <button
                      key={n}
                      onClick={() => addDebugMessages(n)}
                      className="border-2 border-black bg-canvasBlack px-2 py-0.5 text-[10px] font-bold text-sheetWhite hover:border-spiteCrimson hover:text-hypeNeon transition-colors"
                    >
                      +{n.toLocaleString()}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {[10, 25, 50, 75, 90, 95, 99].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => jumpToProgress(pct)}
                      className="border-2 border-black bg-canvasBlack px-2 py-0.5 text-[10px] font-bold text-spiteCrimson hover:border-hypeNeon hover:text-hypeNeon transition-colors"
                    >
                      {pct}%
                    </button>
                  ))}
                  <button
                    onClick={forceDrop}
                    className="border-2 border-spiteCrimson bg-spiteCrimson px-2 py-0.5 text-[10px] font-bold text-sheetWhite hover:bg-black hover:text-hypeNeon transition-colors"
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
                    className="h-1 flex-1 cursor-pointer accent-spiteCrimson"
                  />
                  <span className="text-[10px] tabular-nums font-bold text-hypeNeon w-16 text-right">
                    {debugSlider.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: Content ──────────────────────────────────────── */}
        <div className="flex w-full min-w-0 flex-1 flex-col md:pl-6">
          {children}
        </div>
      </div>
    </section>
  );
}
