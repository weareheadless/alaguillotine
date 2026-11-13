"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * The charge rail.
 *
 * Research files batches into the ledger, and the ledger is the site's real
 * content: a dated act, a named person, a confidence. The page already shows
 * the consequence (a score, a rank); this shows the work arriving, so the line
 * is not a number that changed for no visible reason.
 */

interface Charge {
  person: string;
  slug: string;
  act: string;
  place: string;
  year: number;
  category: string;
  confidence: number;
  date: string | null;
  createdAt: string;
}

interface Payload {
  charges: Charge[];
  total: number;
  last24h: number;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dateLabel(charge: Charge): string {
  if (charge.date) {
    const d = new Date(`${charge.date}T00:00:00Z`);
    return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return charge.year ? String(charge.year) : "undated";
}

export function ChargesRail({
  limit = 9,
  title = "fresh charges",
  className = "",
}: {
  limit?: number;
  title?: string;
  className?: string;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/charges?limit=${limit}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Payload);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [limit]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const charges = data?.charges ?? [];

  return (
    <aside
      aria-label="Charges recently added to the record"
      className={`border-2 border-chop-border bg-white/[0.03] ${className}`}
    >
      <header className="flex items-baseline justify-between gap-2 border-b-2 border-chop-border px-3 py-2">
        <h2 className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-spiteCrimson">
          {title}
        </h2>
        {data && (
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-chop-muted">
            {data.last24h} in 24h
          </span>
        )}
      </header>

      {failed && charges.length === 0 && (
        <p className="px-3 py-4 font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
          the rail is quiet — no answer from the record
        </p>
      )}

      {!failed && charges.length === 0 && (
        <div className="space-y-2 px-3 py-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse bg-white/[0.04]" />
          ))}
        </div>
      )}

      <ol className="divide-y divide-chop-border/70 [&>li:nth-child(n+3)]:hidden xl:[&>li:nth-child(n+3)]:block">
        {charges.map((charge) => (
          <li key={`${charge.slug}-${charge.createdAt}-${charge.act.slice(0, 12)}`} className="px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/person/${charge.slug}`}
                className="min-w-0 truncate font-mono text-[10px] font-black uppercase tracking-[0.08em] text-sheetWhite hover:text-spiteCrimson"
              >
                {charge.person}
              </Link>
              <span className="shrink-0 font-mono text-[8px] tabular-nums text-hypeNeon">
                {dateLabel(charge)}
              </span>
            </div>
            <p className="mt-1 line-clamp-3 font-mono text-[10px] leading-snug text-chop-muted">
              {charge.act}
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-chop-muted/80">
              <span className="text-spiteCrimson/80">{charge.category}</span>
              <span aria-hidden>·</span>
              <span>conf {Math.round(charge.confidence)}</span>
              {charge.place && (
                <>
                  <span aria-hidden>·</span>
                  <span className="min-w-0 truncate">{charge.place}</span>
                </>
              )}
            </p>
          </li>
        ))}
      </ol>

      <footer className="border-t-2 border-chop-border px-3 py-2">
        <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-chop-muted">
          each charge dated, placed and sourced
        </p>
      </footer>
    </aside>
  );
}
