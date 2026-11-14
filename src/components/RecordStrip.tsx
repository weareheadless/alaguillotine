"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The newest claims, on the front page.
 *
 * Three cards, not a feed: the installation already has a wire and a mosaic,
 * and a claim is a different thing from both. Each card is the act, the name
 * and the grade, and it says whether a reader has passed it — because the
 * difference between "filed" and "reviewed" is the difference between a
 * question and a charge.
 */

interface Claim {
  id: string;
  url: string;
  title: string;
  gloss: string;
  take?: string;
  person: string;
  publishedAt: string;
  firstSeenAt: string;
}

const GRADE_TONE: Record<string, string> = {
  A: "text-hypeNeon border-hypeNeon/50",
  B: "text-sheetWhite border-sheetWhite/40",
  C: "text-chop-muted border-chop-border",
  D: "text-spiteCrimson border-spiteCrimson/50",
};

function gradeOf(gloss: string): string {
  const m = gloss.match(/grade ([A-D])/);
  return m?.[1] ?? "C";
}

function whenOf(iso: string): string {
  if (!iso) return "";
  const at = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function RecordStrip() {
  const [items, setItems] = useState<Claim[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/records/latest", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Claim[] }) => {
        if (live) {
          setItems((d.items ?? []).slice(0, 3));
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
    return () => {
      live = false;
    };
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mt-6 px-[clamp(1rem,2vw,2rem)]" aria-labelledby="record-strip-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-chop-border pb-2">
        <h2
          id="record-strip-title"
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite"
        >
          just entered the record
        </h2>
        <Link
          href="/feed"
          className="font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted hover:text-sheetWhite"
        >
          the whole record →
        </Link>
      </div>

      <ol className="mt-3 grid gap-px border border-chop-border bg-chop-border sm:grid-cols-3">
        {items.map((item) => {
          const grade = gradeOf(item.gloss);
          const awaiting = item.gloss.includes("awaiting review");
          const reviewed = item.gloss.includes("· reviewed");
          return (
            <li key={item.id} className="flex flex-col justify-between gap-3 bg-[#080808] p-3.5">
              <div>
                <div className="flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-[0.14em]">
                  <span className={`border px-1 ${GRADE_TONE[grade] ?? GRADE_TONE.C}`}>
                    {grade}
                  </span>
                  <span className="text-sheetWhite">{item.person}</span>
                  {awaiting ? (
                    <span className="text-hypeNeon/80">awaiting review</span>
                  ) : reviewed ? (
                    <span className="text-chop-muted">reviewed</span>
                  ) : (
                    <span className="text-chop-muted">on the record</span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-sheetWhite/90">
                  {item.title}
                </p>
                {item.take ? (
                  <p className="mt-2 line-clamp-4 border-l-2 border-hypeNeon/40 pl-2 text-[11px] leading-snug text-chop-muted">
                    <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-hypeNeon/60">
                      why this is on the record ·{" "}
                    </span>
                    {item.take}
                  </p>
                ) : null}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9px] tabular-nums text-chop-muted">
                  filed {whenOf(item.firstSeenAt)}
                </span>
                <Link
                  href={item.url}
                  className="font-mono text-[9px] uppercase tracking-[0.14em] text-spiteCrimson/90 hover:text-spiteCrimson"
                >
                  open the claim →
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
