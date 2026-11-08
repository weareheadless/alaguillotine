"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTopBounties } from "../app/actions/feed";
import type { FeedMessage } from "../lib/types";
import { useSiteContent } from "../lib/use-site-content";
import { useAdaVoice } from "../lib/use-ada-voice";
import type { AdContent } from "../lib/content";

/**
 * The ad stack.
 *
 * Not one popup at a time — a pile. They spawn on top of each other with a
 * slight offset and tilt, so the corner of the page fills up like a browser
 * that lost an argument with a toolbar. Closing one only makes room for the
 * next; the point is the pressure, not the message.
 */

const MAX_POPUPS = 4;

type Placed =
  | { id: number; side: "left" | "right"; isSystem: true; data: AdContent; rot: number }
  | { id: number; side: "left" | "right"; isSystem: false; data: FeedMessage; rot: number };

export function AdPopups() {
  const { content } = useSiteContent();
  const ada = useAdaVoice();
  const ads = ada.ads.length ? ada.ads : content.ads;

  const [stack, setStack] = useState<Placed[]>([]);
  const [bounties, setBounties] = useState<FeedMessage[]>([]);
  const nextId = useRef(0);
  const history = useRef<number[]>([]);

  // Keep the bounty pool fresh; it is one of the two ad sources.
  useEffect(() => {
    const load = async () => {
      try {
        setBounties(await fetchTopBounties());
      } catch {
        /* keep the last pool */
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const spawn = useCallback(
    (forced?: { isSystem: boolean; data: unknown }) => {
      setStack((prev) => {
        if (prev.length >= MAX_POPUPS) return prev;

        let isSystem: boolean;
        let data: unknown;
        if (forced) {
          isSystem = forced.isSystem;
          data = forced.data;
        } else if (bounties.length > 0 && Math.random() > 0.5) {
          isSystem = false;
          data = bounties[Math.floor(Math.random() * bounties.length)];
        } else {
          isSystem = true;
          const available = ads.map((_, i) => i).filter((i) => !history.current.includes(i));
          const pool = available.length ? available : ads.map((_, i) => i);
          const idx = pool[Math.floor(Math.random() * pool.length)];
          history.current = [...history.current.slice(-2), idx];
          data = ads[idx];
        }

        const side: "left" | "right" = isSystem ? "left" : "right";
        const rot =
          side === "left" ? -2.4 + Math.random() * 3.6 : 2.4 - Math.random() * 3.6;

        return [
          ...prev,
          { id: nextId.current++, side, isSystem, data, rot } as Placed,
        ];
      });
    },
    [ads, bounties],
  );

  useEffect(() => {
    const first = setTimeout(() => spawn(), 6000);
    const id = setInterval(() => {
      if (Math.random() > 0.25) spawn();
    }, 11_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [spawn]);

  useEffect(() => {
    const onPaid = (event: Event) => {
      const detail = (event as CustomEvent).detail as FeedMessage;
      spawn({ isSystem: false, data: detail });
      fetchTopBounties().then(setBounties).catch(() => {});
    };
    window.addEventListener("paid-message", onPaid);
    return () => window.removeEventListener("paid-message", onPaid);
  }, [spawn]);

  const close = (id: number) => setStack((prev) => prev.filter((p) => p.id !== id));

  if (!stack.length) return null;

  return (
    <>
      {stack.map((ad, i) => {
        const shift = i * 22;
        // Paid popups sit above the chat button so the site stays usable.
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

        if (!ad.isSystem) {
          const msg = ad.data as FeedMessage;
          return (
            <div
              key={ad.id}
              style={{ ...style, zIndex: 50 + i }}
              className="fixed w-72 border-4 border-spiteCrimson bg-canvasBlack shadow-[8px_8px_0px_0px_#E11D48] animate-fade-in font-mono group md:w-80"
            >
              <div className="flex items-center justify-between border-b-4 border-spiteCrimson bg-spiteCrimson px-2 py-1 text-white">
                <span className="animate-pulse text-[10px] font-black uppercase tracking-widest text-black md:text-xs">
                  ⚠️ PAID OVERRIDE
                </span>
                <button
                  onClick={() => close(ad.id)}
                  className="text-sm font-black hover:text-black focus:outline-none"
                >
                  X
                </button>
              </div>
              <div className="p-4 grid-overlay">
                <div className="mb-2 inline-block border-2 border-hypeNeon bg-hypeNeon/10 px-2 py-0.5 text-[10px] font-bold text-hypeNeon">
                  SPONSORED: ${msg.amount_paid.toFixed(2)} CHOP
                </div>
                <h4 className="mb-3 text-xs font-black leading-tight text-sheetWhite md:text-sm">
                  &quot;{msg.text}&quot;
                </h4>
                <p className="mb-4 text-right text-[10px] text-chop-muted">
                  — {msg.author_name}
                </p>
                <button
                  onClick={() => close(ad.id)}
                  className="w-full border-2 border-spiteCrimson bg-black py-1.5 text-[10px] font-bold tracking-widest text-spiteCrimson transition-all hover:bg-spiteCrimson hover:text-black"
                >
                  DISMISS OBLIGATION
                </button>
              </div>
            </div>
          );
        }

        const copy = ad.data as AdContent;
        return (
          <div
            key={ad.id}
            style={{ ...style, zIndex: 50 + i }}
            className="fixed w-64 border-4 border-black bg-[#FDE047] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-fade-in font-mono md:w-72"
          >
            <div className="flex items-center justify-between border-b-4 border-black bg-spiteCrimson px-2 py-1 text-white">
              <span className="animate-pulse text-[10px] font-bold tracking-widest">
                SYSTEM_AD_
              </span>
              <button
                onClick={() => close(ad.id)}
                className="text-sm font-black hover:text-black focus:outline-none"
              >
                X
              </button>
            </div>
            <div className="p-3">
              <h4 className="mb-2 text-xs font-black uppercase leading-tight text-canvasBlack">
                {copy.title}
              </h4>
              <p className="mb-4 text-[10px] leading-tight text-canvasBlack/90">{copy.body}</p>
              <button
                onClick={() => close(ad.id)}
                className="w-full border-2 border-black bg-hypeNeon py-1.5 text-[10px] font-bold tracking-widest text-canvasBlack shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {copy.cta}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
