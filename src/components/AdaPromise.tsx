"use client";

import { useEffect, useState } from "react";
import { promiseOfTheDay, type DailyPromise } from "@/lib/promises";

/**
 * Ada's false promise, renewed at midnight UTC.
 *
 * Rendered after mount so the server and the browser never disagree about which
 * day it is. `inline` is the single line in the hero; `block` is the card in
 * the fund panel.
 */
export function AdaPromise({ variant = "block" }: { variant?: "block" | "inline" }) {
  const [promise, setPromise] = useState<DailyPromise | null>(null);

  useEffect(() => {
    setPromise(promiseOfTheDay());
  }, []);

  if (variant === "inline") {
    return (
      <span className="text-sheetWhite">
        {promise ? `“${promise.text}”` : "…"}
      </span>
    );
  }

  return (
    <section className="mt-4 border-2 border-spiteCrimson bg-spiteCrimson/[0.07] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-spiteCrimson">
          ada promises
        </h3>
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-chop-muted">
          #{promise?.number ?? "—"} · false
        </span>
      </div>
      <p className="mt-2 text-[15px] font-black uppercase leading-tight tracking-tight text-sheetWhite">
        {promise ? `“${promise.text}”` : "Loading the promise…"}
      </p>
      <p className="mt-3 border-t border-spiteCrimson/30 pt-2 font-mono text-[9px] leading-relaxed text-chop-muted">
        A false promise, renewed at midnight UTC. She will deny saying it. Not a
        guarantee, not financial advice.
      </p>
    </section>
  );
}
