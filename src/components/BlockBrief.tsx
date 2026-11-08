"use client";

import Link from "next/link";
import type { Figure } from "../lib/hateometer";
import { slugify } from "../lib/slug";

/**
 * Ada explains the block.
 *
 * The pressure strip measured the gap between the reading and the blade; nobody
 * needed a second gauge. What is actually useful is the case: why this name, on
 * this pass, with this record, is the one under the blade. Ada makes it in her
 * own voice, out loud, with the receipts attached.
 */

const KICKERS = [
  "That is not a close call. That is a filing error with a body count.",
  "The blade is a metaphor. The sleep loss is not.",
  "The record is doing the heavy lifting, which is what records are for.",
  "A quiet week would not save them. A quiet decade would not save them.",
  "The counter is not angry. The counter is thorough.",
  "Somewhere a communications team is drafting the word 'complex'.",
  "They will call this unfair. They called the last one unfair too.",
  "The number is not a verdict. It is a receipt.",
];

const pick = (list: string[], seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length];
};

export function BlockBrief({ figure }: { figure: Figure | undefined }) {
  if (!figure) {
    return (
      <section className="border-y-2 border-chop-border bg-white/[0.02] px-4 py-6 md:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-chop-muted">
          the block · ada explains
        </p>
        <p className="mt-3 font-mono text-[12px] leading-relaxed text-chop-muted">
          Nobody is on the block. The machine is still reading, which is either a
          relief or a delay, depending on who you are.
        </p>
      </section>
    );
  }

  const score = Math.round(figure.score);
  const bonus = Math.round(figure.recordBonus ?? 0);
  const report = Math.max(0, score - bonus);
  const charges = figure.topCharges ?? [];
  const count = figure.ledgerCount ?? charges.length;
  const latest = figure.items[0];
  const top = charges[0];
  const kicker = pick(KICKERS, figure.name);

  const recordLine = top
    ? `The ledger holds ${count} charge${count === 1 ? "" : "s"}. The one that should keep them up at night: ${top.act} (${top.place}, ${top.year}).`
    : "The ledger is empty, which is not the same as innocent — it means nobody has finished the paperwork.";

  return (
    <section className="border-y-2 border-spiteCrimson bg-spiteCrimson/[0.05] px-4 py-5 md:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
        <span>
          the block <span className="text-spiteCrimson">·</span> ada explains
        </span>
        <span>
          {count} charge{count === 1 ? "" : "s"} on record
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-2xl font-black uppercase leading-none tracking-tighter text-sheetWhite md:text-3xl">
          {figure.name}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">
          {figure.role}
          {figure.country ? ` · ${figure.country}` : ""}
        </span>
        <span className="ml-auto font-mono text-3xl font-black leading-none tabular-nums text-spiteCrimson">
          {score}
        </span>
      </div>

      <div className="mt-4 max-w-3xl space-y-3 font-mono text-[12px] leading-relaxed text-sheetWhite/80 md:text-[13px]">
        <p>
          The counter says <span className="text-sheetWhite">{score}</span>.{" "}
          {bonus > 0 ? (
            <>
              {report} of that is this week&apos;s reporting; {bonus} is the record.
            </>
          ) : (
            <>all of it is this week&apos;s reporting, which is a fragile thing to build a case on.</>
          )}{" "}
          <span className="text-sheetWhite">{figure.name}</span> is on the block.
        </p>

        <p>
          <span className="text-spiteCrimson">The charge:</span>{" "}
          {figure.reason || "the reporting has not produced a clean sentence yet, which is its own kind of indictment."}
        </p>

        {latest && (
          <p>
            <span className="text-spiteCrimson">This week&apos;s evidence:</span>{" "}
            <span className="text-sheetWhite">&ldquo;{latest.headline}&rdquo;</span>.{" "}
            {latest.quip}
          </p>
        )}

        <p>
          <span className="text-spiteCrimson">The record:</span> {recordLine}
        </p>

        {(figure.timesChopped ?? 0) > 0 && (
          <p>
            <span className="text-spiteCrimson">The blade:</span> it has already fallen on this
            name {figure.timesChopped} time{(figure.timesChopped ?? 0) === 1 ? "" : "s"}. The
            cooldown is the only thing between them and the next one.
          </p>
        )}

        <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-spiteCrimson">
          {kicker}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em]">
        <Link
          href={`/person/${slugify(figure.name)}`}
          className="text-sheetWhite transition-colors hover:text-spiteCrimson"
        >
          read the whole record →
        </Link>
        <span className="text-chop-muted">·</span>
        <span className="text-chop-muted">
          {report} report + {bonus} record
        </span>
      </div>
    </section>
  );
}
