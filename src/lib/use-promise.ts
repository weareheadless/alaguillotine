"use client";

import { useEffect, useState } from "react";
import { promiseOfTheReading, readingNumber, type PromiseEntry } from "./promises";
import { useAdaVoice } from "./use-ada-voice";

/**
 * The one line, wherever it is sold.
 *
 * Ada's live promise wins. The local list is only a fallback for the moment
 * before the reading lands, or an older voice that predates the field.
 */
export function usePromise(): { text: string; number: number | null } {
  const [fallback, setFallback] = useState<PromiseEntry | null>(null);
  const ada = useAdaVoice();

  useEffect(() => {
    setFallback(promiseOfTheReading());
  }, []);

  return {
    text: ada.promise || fallback?.text || "",
    number: ada.promise
      ? readingNumber(new Date(ada.promiseAt || Date.now()))
      : fallback?.number ?? null,
  };
}
