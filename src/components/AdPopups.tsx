"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSiteContent } from "../lib/use-site-content";
import { useAdaVoice } from "../lib/use-ada-voice";
import { useDrawer } from "./drawers";
import { COIN_ADS } from "@/lib/coin-ads";
import { executionAds, type RuntimeAd } from "@/lib/execution-ads";
import type { ExecutionNotice } from "@/lib/execution-notice";

/**
 * The ad stack.
 *
 * Five different kinds of interruption, piled on top of each other with a tilt:
 * a yellow system card, a browser notification, a cookie banner, a crypto
 * ticker, a breaking-news alert. They arrive on their own and they leave on
 * their own. Closing one only makes room for the next.
 *
 * The paid-override popup is gone with the paid messages: there is no token
 * gate on speech any more.
 */

const MAX_POPUPS = 4;
const FORMATS = ["card", "notify", "cookie", "crypto", "breaking"] as const;
type Format = (typeof FORMATS)[number];

type Placed = {
  id: number;
  side: "left" | "right";
  format: Format;
  data: RuntimeAd;
  rot: number;
};

const pick = <T,>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)];

export function AdPopups({ notice }: { notice?: ExecutionNotice | null }) {
  const { content } = useSiteContent();
  const ada = useAdaVoice();
  const editorial = ada.ads.length ? ada.ads : content.ads;
  // Coin ads always rotate in, whatever Ada wrote this reading. The blade
  // schedule gets its own notices, so the interruption is also the reminder.
  const ads = useMemo<RuntimeAd[]>(
    () => [...editorial, ...executionAds(Date.now(), notice), ...COIN_ADS],
    [editorial, notice],
  );

  const [stack, setStack] = useState<Placed[]>([]);
  const [leaving, setLeaving] = useState<number[]>([]);
  const nextId = useRef(0);
  const history = useRef<number[]>([]);

  const close = useCallback((id: number) => {
    setLeaving((prev) => (prev.includes(id) ? prev : [...prev, id]));
    window.setTimeout(() => {
      setStack((prev) => prev.filter((p) => p.id !== id));
      setLeaving((prev) => prev.filter((x) => x !== id));
    }, 260);
  }, []);

  const spawn = useCallback(() => {
    const id = nextId.current++;

    setStack((prev) => {
      if (prev.length >= MAX_POPUPS) return prev;

      const available = ads
        .map((_, i) => i)
        .filter((i) => !history.current.includes(i));
      const pool = available.length ? available : ads.map((_, i) => i);
      const idx = pick(pool);
      history.current = [...history.current.slice(-3), idx];
      const data = ads[idx];

      // Coin ads belong in the ad-shaped formats, not the privacy notice.
      // Execution notices are announcements, not product pitches.
      const format = data.openFund
        ? pick(["crypto", "card", "breaking"] as const)
        : data.notice
          ? pick(["breaking", "notify", "card"] as const)
          : pick(FORMATS);
      const side: "left" | "right" =
        format === "notify" || format === "crypto" ? "right" : "left";
      const rot =
        side === "left"
          ? -2.4 + Math.random() * 3.6
          : 2.4 - Math.random() * 3.6;

      return [...prev, { id, side, format, data, rot }];
    });

    // It leaves on its own. The page should never be fully clean.
    window.setTimeout(() => close(id), 8000 + Math.random() * 9000);
  }, [ads, close]);

  useEffect(() => {
    const first = setTimeout(() => spawn(), 5000);
    const id = setInterval(() => {
      if (Math.random() > 0.2) spawn();
    }, 9500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [spawn]);

  if (!stack.length) return null;

  return (
    <>
      {stack.map((ad, i) => {
        const shift = i * 22;
        const bottom = (ad.side === "right" ? 96 : 20) + i * 16;
        const style =
          ad.side === "left"
            ? {
                left: `calc(1rem + ${shift}px)`,
                bottom: `${bottom}px`,
                transform: `rotate(${ad.rot}deg)`,
              }
            : {
                right: `calc(1rem + ${shift}px)`,
                bottom: `${bottom}px`,
                transform: `rotate(${ad.rot}deg)`,
              };

        const isLeaving = leaving.includes(ad.id);

        return (
          <div
            key={ad.id}
            style={{ ...style, zIndex: 50 + i }}
            className={`fixed font-mono transition-all duration-300 ${
              isLeaving
                ? "pointer-events-none scale-95 opacity-0"
                : "animate-fade-in opacity-100"
            }`}
          >
            <Popup ad={ad} onClose={() => close(ad.id)} />
          </div>
        );
      })}
    </>
  );
}

function Popup({ ad, onClose }: { ad: Placed; onClose: () => void }) {
  const copy = ad.data;
  const { show } = useDrawer();

  // The CTA on a coin ad opens the fund panel; the pump link is in there.
  const act = () => {
    if (copy.href) {
      window.location.assign(copy.href);
      onClose();
      return;
    }
    if (copy.openFund) show("fund");
    onClose();
  };

  if (ad.format === "notify") {
    return (
      <div className="w-72 border border-white/15 bg-[#111113]/95 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur md:w-80">
        <div className="flex items-start gap-2 px-3 py-2">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-spiteCrimson bg-spiteCrimson text-[11px] font-black text-black">
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[9px] font-bold uppercase tracking-[0.15em] text-sheetWhite">
                alaguillotine.com
              </span>
              <span className="shrink-0 text-[8px] uppercase tracking-widest text-chop-muted">
                now
              </span>
            </div>
            <h4 className="mt-1 text-[11px] font-black uppercase leading-tight text-sheetWhite">
              {copy.title}
            </h4>
            <p className="mt-1 text-[10px] leading-snug text-chop-muted">
              {copy.body}
            </p>
            <button
              onClick={act}
              className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-spiteCrimson hover:text-sheetWhite"
            >
              {copy.cta} →
            </button>
          </div>
          <button
            onClick={onClose}
            aria-label="dismiss"
            className="shrink-0 text-[11px] font-black text-chop-muted hover:text-sheetWhite"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (ad.format === "cookie") {
    return (
      <div className="w-72 border-2 border-black bg-sheetWhite text-canvasBlack shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:w-80">
        <div className="flex items-center justify-between border-b-2 border-black px-3 py-1.5">
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">
            privacy notice
          </span>
          <button
            onClick={onClose}
            className="text-xs font-black hover:text-spiteCrimson"
          >
            ×
          </button>
        </div>
        <div className="p-3">
          <h4 className="text-[11px] font-black uppercase leading-tight">
            {copy.title}
          </h4>
          <p className="mt-1 text-[10px] leading-snug text-black/70">
            {copy.body}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={act}
              className="border-2 border-black bg-black px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-sheetWhite"
            >
              {copy.cta}
            </button>
            <button
              onClick={onClose}
              className="text-[9px] font-bold uppercase tracking-widest underline decoration-black/40 underline-offset-2"
            >
              reject all
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (ad.format === "crypto") {
    return (
      <div className="w-64 border-2 border-hypeNeon bg-black shadow-[0_0_24px_rgba(0,255,128,0.18)] md:w-72">
        <div className="flex items-center justify-between border-b-2 border-hypeNeon/60 px-2 py-1">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-hypeNeon">
            $CHOP / USD ▲ 400%
          </span>
          <button
            onClick={onClose}
            className="text-xs font-black text-hypeNeon/70 hover:text-hypeNeon"
          >
            ×
          </button>
        </div>
        <div className="p-3">
          <h4 className="text-[11px] font-black uppercase leading-tight text-hypeNeon">
            {copy.title}
          </h4>
          <p className="mt-1 text-[10px] leading-snug text-hypeNeon/70">
            {copy.body}
          </p>
          <button
            onClick={act}
            className="mt-3 w-full border border-hypeNeon bg-hypeNeon py-1 text-[9px] font-black uppercase tracking-widest text-black hover:bg-transparent hover:text-hypeNeon"
          >
            {copy.cta}
          </button>
        </div>
      </div>
    );
  }

  if (ad.format === "breaking") {
    return (
      <div className="w-72 border-2 border-spiteCrimson bg-[#160507] shadow-[8px_8px_0px_0px_#E11D48] md:w-80">
        <div className="flex items-center gap-2 border-b-2 border-spiteCrimson bg-spiteCrimson px-2 py-1">
          <span className="h-2 w-2 animate-pulse bg-black" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-black">
            breaking
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-sm font-black text-black hover:text-white"
          >
            X
          </button>
        </div>
        <div className="p-3">
          <h4 className="text-sm font-black uppercase leading-tight text-sheetWhite">
            {copy.title}
          </h4>
          <p className="mt-1.5 text-[10px] leading-snug text-sheetWhite/70">
            {copy.body}
          </p>
          <button
            onClick={act}
            className="mt-3 w-full border border-spiteCrimson py-1 text-[9px] font-black uppercase tracking-widest text-spiteCrimson hover:bg-spiteCrimson hover:text-black"
          >
            {copy.cta}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-4 border-black bg-[#FDE047] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:w-72">
      <div className="flex items-center justify-between border-b-4 border-black bg-spiteCrimson px-2 py-1 text-white">
        <span className="animate-pulse text-[10px] font-bold tracking-widest">
          SYSTEM_AD_
        </span>
        <button
          onClick={onClose}
          className="text-sm font-black hover:text-black focus:outline-none"
        >
          X
        </button>
      </div>
      <div className="p-3">
        <h4 className="mb-2 text-xs font-black uppercase leading-tight text-canvasBlack">
          {copy.title}
        </h4>
        <p className="mb-4 text-[10px] leading-tight text-canvasBlack/90">
          {copy.body}
        </p>
        <button
          onClick={act}
          className="w-full border-2 border-black bg-hypeNeon py-1.5 text-[10px] font-bold tracking-widest text-canvasBlack shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          {copy.cta}
        </button>
      </div>
    </div>
  );
}