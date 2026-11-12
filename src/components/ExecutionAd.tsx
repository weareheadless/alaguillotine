"use client";

import Link from "next/link";
import type { ExecutionNotice } from "@/lib/execution-notice";
import { ReserveSeat } from "./ReserveSeat";

/**
 * The sponsor slot.
 *
 * The blade has a timetable, so it gets sold like a product: a yellow
 * brand-commercial panel beside the guillotine, with the next performance,
 * the headliner, the charge and the small print. It is an ad for an execution,
 * which is the most honest ad on the site.
 */
export function ExecutionAd({ notice, compact = false }: { notice: ExecutionNotice | null; compact?: boolean }) {
  if (!notice) return null;

  if (compact) return (
    <aside aria-label="Next public execution, presented by $CHOP" className="mt-4 grid min-w-0 border-2 border-black bg-hypeNeon text-canvasBlack shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:grid-cols-[minmax(150px,0.8fr)_minmax(0,2fr)_minmax(190px,1fr)]">
      <div className="p-5 md:border-r-2 md:border-black">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-black/70">Presented by $CHOP</p>
        <p className="mt-2 text-4xl font-black uppercase leading-[0.85] tracking-tighter">The Blade</p>
        <p className="mt-4 font-mono text-[9px] font-bold uppercase tracking-widest">Next performance</p>
        <p className="mt-1 text-5xl font-black leading-none tabular-nums tracking-tighter">{notice.timeLabel.replace(" UTC", "")}</p>
        <p className="mt-2 font-mono text-[10px] font-bold uppercase">{notice.dateLabel} · UTC</p>
      </div>
      <div className="min-w-0 border-t-2 border-black p-5 md:border-t-0">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-black/70">Featuring</p>
        <Link href={`/person/${notice.slug}`} className="mt-2 block break-words text-3xl font-black uppercase leading-none tracking-tighter underline decoration-black/30 underline-offset-4 lg:text-4xl">{notice.name}</Link>
        <p className="mt-3 max-w-3xl font-mono text-[12px] leading-relaxed text-black">{notice.reason}.</p>
        {notice.following && <p className="mt-4 border-t-2 border-black/25 pt-3 font-mono text-[10px] font-bold uppercase">Then · {notice.following.timeLabel} · {notice.following.name}</p>}
      </div>
      <div className="flex min-w-0 flex-col justify-between gap-4 border-t-2 border-dashed border-black/50 p-5 md:border-l-2 md:border-t-0">
        <p className="text-xl font-black uppercase leading-tight tracking-tight">Arrive early.<br />Leave vertically.</p>
        <ReserveSeat at={notice.at} name={notice.name} slug={notice.slug} />
        <div>
          <div aria-hidden className="h-7 w-full" style={{ backgroundImage: "repeating-linear-gradient(90deg,#000 0 2px,transparent 2px 4px,#000 4px 5px,transparent 5px 9px,#000 9px 12px,transparent 12px 14px)" }} />
          <p className="mt-2 font-mono text-[8px] uppercase leading-relaxed text-black/70">Tickets free · standing room only<br />No refunds · no survivors</p>
        </div>
      </div>
    </aside>
  );

  return (
    <aside
      aria-label="Next public execution, presented by $CHOP"
      className="relative flex flex-col justify-between overflow-hidden border-2 border-black bg-hypeNeon p-4 text-canvasBlack shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
    >
      {/* The ticket stub's perforation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[86px] border-t-2 border-dashed border-black/30"
      />

      <div>
        <p className="font-mono text-[8px] font-bold uppercase tracking-[0.32em] text-black/60">
          a word from the fund
        </p>
        <p className="mt-1 text-3xl font-black uppercase leading-[0.85] tracking-[-0.06em]">
          The
          <br />
          Blade
        </p>
        <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-black/70">
          presented by $CHOP
        </p>
      </div>

      <div className="mt-5 border-y-2 border-black py-3">
        <p className="font-mono text-[8px] font-bold uppercase tracking-[0.28em] text-black/60">
          next performance
        </p>
        <p className="mt-1 text-4xl font-black leading-none tabular-nums tracking-[-0.05em]">
          {notice.timeLabel.replace(" UTC", "")}
        </p>
        <p className="mt-1 font-mono text-[10px] font-black uppercase tracking-[0.18em]">
          {notice.dateLabel} · UTC
        </p>
      </div>

      <div className="mt-4">
        <p className="font-mono text-[8px] font-bold uppercase tracking-[0.28em] text-black/60">
          featuring
        </p>
        <Link
          href={`/person/${notice.slug}`}
          className="mt-1 block text-lg font-black uppercase leading-[0.95] tracking-[-0.03em] underline decoration-black/30 underline-offset-2 hover:decoration-black"
        >
          {notice.name}
        </Link>
        <p className="mt-2 font-mono text-[10px] leading-snug text-black/80">
          {notice.reason}.
        </p>
      </div>

      {notice.following && (
        <div className="mt-3 border-t-2 border-black/20 pt-2">
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.28em] text-black/60">
            then
          </p>
          <p className="mt-0.5 font-mono text-[10px] font-black uppercase leading-tight tracking-[0.1em]">
            {notice.following.timeLabel.replace(" UTC", "")} · {notice.following.name}
          </p>
        </div>
      )}

      <div className="mt-5">
        <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-black/60">
          arrive early. leave vertically.
        </p>
        <Link
          href="/next-in-line"
          className="mt-2 block border-2 border-black bg-canvasBlack px-3 py-2 text-center font-mono text-[9px] font-black uppercase tracking-[0.22em] text-hypeNeon transition-colors hover:bg-spiteCrimson hover:text-sheetWhite"
        >
          reserve a seat
        </Link>
        <p className="mt-2 font-mono text-[7px] uppercase leading-relaxed tracking-[0.14em] text-black/50">
          tickets free · standing room only · no refunds · no survivors
        </p>
      </div>

      {/* A barcode, because every brand has one. */}
      <div
        aria-hidden
        className="mt-3 h-6 w-full opacity-70"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #000 0 2px, transparent 2px 4px, #000 4px 5px, transparent 5px 9px, #000 9px 12px, transparent 12px 14px)",
        }}
      />
    </aside>
  );
}
