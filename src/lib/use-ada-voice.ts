"use client";

import { useEffect, useState } from "react";
import type { AdaVoice } from "./clock";

/**
 * Ada's current voice — the banner strings and popups she wrote for the latest
 * reading. Cached at module level so every component on the page shares one
 * request instead of one each.
 */

const TTL = 5 * 60 * 1000;
let cached: { voice: AdaVoice; at: number } | null = null;
let inflight: Promise<AdaVoice | null> | null = null;

async function load(): Promise<AdaVoice | null> {
  if (cached && Date.now() - cached.at < TTL) return cached.voice;
  if (inflight) return inflight;

  inflight = fetch("/api/clock", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const voice: AdaVoice | undefined = data?.voice;
      if (!voice || (!voice.banner?.length && !voice.ads?.length)) return null;
      cached = { voice, at: Date.now() };
      return voice;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

const EMPTY: AdaVoice = { mood: "numb", line: "", banner: [], ads: [], subliminal: [], updatedAt: null };

export function useAdaVoice(): AdaVoice {
  const [voice, setVoice] = useState<AdaVoice>(cached?.voice ?? EMPTY);

  useEffect(() => {
    let cancelled = false;
    load().then((next) => {
      if (!cancelled && next) setVoice(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return voice;
}
