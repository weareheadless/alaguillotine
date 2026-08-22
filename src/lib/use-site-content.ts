"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CONTENT, type SiteContent } from "./content";

/**
 * useSiteContent — the client-side reader for Ada Guillotine's editable copy.
 *
 * Fetches /api/content (which serves data/site-content.json merged over the
 * bundled DEFAULT_CONTENT and never fails), so components can render the
 * latest copy immediately on load. `content` is always a valid SiteContent:
 * it starts as DEFAULT_CONTENT and is replaced when the fetch resolves.
 * `ready` flips to true once the fetch settles (success or fallback), which
 * lets effects that shuffle/rotate copy re-run with the live values.
 */
export function useSiteContent(): { content: SiteContent; ready: boolean } {
  const [content, setContent] = useState<SiteContent>(DEFAULT_CONTENT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content")
      .then((res) => res.json())
      .then((data: SiteContent) => {
        if (!cancelled) {
          setContent(data);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { content, ready };
}
