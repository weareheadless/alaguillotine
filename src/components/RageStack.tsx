"use client";

import { useState } from "react";
import type { RageItem } from "../lib/clock";

/**
 * The stack.
 *
 * Not a feed. A stack of pressure: every item is a fact with a number in it,
 * a source you can check, and one line of contempt. Opening an item pulls the
 * blade. Nothing here is interactive in the way a message board is — you cannot
 * post, vote, or reply. You can only look and feel it land.
 */

function heat(rage: number) {
  if (rage >= 75) return "bg-spiteCrimson";
  if (rage >= 50) return "bg-[#A16207]";
  return "bg-hypeNeon";
}

function ago(iso: string | null) {
  if (!iso) return "undated";
  const h = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 3_600_000));
  if (h < 1) return "this hour";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function RageStack({
  items,
  onPull,
  bare = false,
}: {
  items: RageItem[];
  onPull: () => void;
  /** Rendered inside another section: no wrapper, no heading. */
  bare?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (!items.length) {
    return (
      <div className="border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
        no reading yet — the machine is still looking
      </div>
    );
  }

  return (
    <div className={bare ? "" : "mx-auto mt-6 w-full max-w-5xl px-4 md:px-6"}>
      {!bare && (
        <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-chop-muted">
          <span>the stack</span>
          <span>sorted by rage · {items.length} items</span>
        </div>
      )}

      <div className="divide-y divide-chop-border border border-chop-border bg-chop-card/40">
        {items.map((item, i) => {
          const isOpen = open === item.id;
          return (
            <article
              key={item.id}
              className={`group relative transition-colors ${
                isOpen ? "bg-chop-card" : "hover:bg-chop-card/70"
              }`}
            >
              {/* pressure bar */}
              <div
                className={`absolute left-0 top-0 h-full ${heat(item.rage)} opacity-70 transition-all`}
                style={{ width: isOpen ? 4 : 2 }}
                aria-hidden
              />

              <button
                type="button"
                onClick={() => {
                  const next = isOpen ? null : item.id;
                  setOpen(next);
                  if (next) onPull();
                }}
                aria-expanded={isOpen}
                className="block w-full px-4 py-4 text-left md:px-6"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 shrink-0 font-mono text-[10px] tabular-nums text-chop-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                      <span>{item.topic}</span>
                      <span>·</span>
                      <span>{ago(item.publishedAt)}</span>
                      <span>·</span>
                      <span className="text-sheetWhite">{item.source}</span>
                    </div>

                    <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-sheetWhite md:text-base">
                      {item.headline}
                    </h3>

                    {isOpen && (
                      <div className="mt-3 space-y-3">
                        <p className="font-mono text-[12px] leading-relaxed text-chop-muted">
                          {item.fact}
                        </p>
                        <p className="border-l-2 border-spiteCrimson pl-3 text-[13px] font-semibold leading-snug text-spiteCrimson">
                          {item.quip}
                        </p>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted underline decoration-chop-border underline-offset-4 hover:text-sheetWhite"
                        >
                          source ↗
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`font-mono text-lg font-black tabular-nums leading-none ${
                        item.rage >= 75
                          ? "text-spiteCrimson"
                          : item.rage >= 50
                            ? "text-[#D97706]"
                            : "text-hypeNeon"
                      }`}
                    >
                      {item.rage}
                    </span>
                    <div className="h-8 w-1 bg-chop-border">
                      <div
                        className={`w-full ${heat(item.rage)}`}
                        style={{ height: `${item.rage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            </article>
          );
        })}
      </div>

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-chop-muted">
        Every item is a real report, linked. The scores are the machine&apos;s; the
        arithmetic is public.
      </p>
    </div>
  );
}
