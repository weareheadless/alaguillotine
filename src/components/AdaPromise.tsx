"use client";

import { useEffect, useState } from "react";
import { promiseOfTheReading, readingNumber, type PromiseEntry } from "@/lib/promises";
import { useAdaVoice } from "../lib/use-ada-voice";

/**
 * Ada's false promise, renewed with each reading.
 *
 * Rendered after mount so the server and the browser never disagree about which
 * reading it is. `inline` is the single line in the hero; `block` is the card
 * in the fund panel.
 */
export function AdaPromise({ variant = "block" }: { variant?: "block" | "inline" }) {
  const [fallback, setFallback] = useState<PromiseEntry | null>(null);
  const ada = useAdaVoice();

  useEffect(() => {
    setFallback(promiseOfTheReading());
  }, []);

  // Ada writes the promise. The list is only the fallback for a reading that
  // has not landed yet, or a voice old enough to predate the field.
  const text = ada.promise || fallback?.text || "";
  const number = ada.promise
    ? readingNumber(new Date(ada.promiseAt || Date.now()))
    : fallback?.number;

  if (variant === "inline") {
    return (
      <span className="text-sheetWhite">
        {text ? `“${text}”` : "…"}
      </span>
    );
  }

  return (
    <section className="mt-4 border-2 border-spiteCrimson bg-spiteCrimson/[0.07] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-spiteCrimson">
          ada&apos;s financial advice
        </h3>
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-chop-muted">
          #{number ?? "—"} · false
        </span>
      </div>
      <p className="mt-2 text-[15px] font-black uppercase leading-tight tracking-tight text-sheetWhite">
        {text ? `“${text}”` : "Loading the promise…"}
      </p>
      <p className="mt-3 border-t border-spiteCrimson/30 pt-2 font-mono text-[9px] leading-relaxed text-chop-muted">
        A false promise, renewed with each reading. She will deny saying it. Not
        a guarantee, not financial advice.
      </p>
    </section>
  );
}
