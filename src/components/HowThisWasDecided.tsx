import Link from "next/link";
import type { LedgerEntry } from "@/lib/archive-store";

/**
 * How this name was decided.
 *
 * A site that names people has to show its work. This says who made the
 * decision (a model, from published sentences), what it kept and on what test,
 * where the model's own words are on record, and — just as important — what it
 * did not decide: nobody's guilt, no threat, no call for violence.
 *
 * Facts only, from the rows on this page. No claim about what a person
 * "deserves"; the ranking is an argument about public conduct and the reader
 * is told so.
 */
export function HowThisWasDecided({
  name,
  entries,
  verdicts,
}: {
  name: string;
  entries: LedgerEntry[];
  verdicts: Array<{ category: string; why: string }>;
}) {
  const sources = new Set(entries.flatMap((entry) => entry.sources)).size;
  const quoted = entries.filter((entry) => entry.quote).length;

  return (
    <section
      aria-labelledby="how-decided"
      className="mt-6 border border-chop-border bg-white/[0.02] p-3.5"
    >
      <h2
        id="how-decided"
        className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted"
      >
        how this name was decided
      </h2>

      <p className="mt-2 max-w-3xl font-mono text-[11.5px] leading-relaxed text-sheetWhite/85">
        A model reads sentences published by newsrooms that name {name}. It keeps
        one only when {name} is the actor and the conduct is the harm this record
        covers — war, weapons, repression, extraction, impunity, self-dealing, or
        money used as leverage over politics. Ordinary politics, opposition to
        harm, and someone else&rsquo;s conduct are dropped. It is a reading of
        published reporting, not an investigation, and it can be wrong.
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-chop-muted">
        <div className="flex items-baseline gap-1.5">
          <dt>sentences on the record</dt>
          <dd className="font-black tabular-nums text-sheetWhite">{entries.length}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>with a stored passage</dt>
          <dd className="font-black tabular-nums text-sheetWhite">{quoted}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>sources</dt>
          <dd className="font-black tabular-nums text-sheetWhite">{sources}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>window</dt>
          <dd className="font-black tabular-nums text-sheetWhite">180 days</dd>
        </div>
      </dl>

      {verdicts.length ? (
        <div className="mt-3 border-t border-chop-border pt-2.5">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-chop-muted">
            the model&rsquo;s reason, in its own words
          </p>
          <ul className="mt-1.5 space-y-1">
            {verdicts.map((verdict, i) => (
              <li
                key={`${verdict.category}-${i}`}
                className="font-mono text-[10.5px] leading-relaxed text-sheetWhite/80"
              >
                <span className="text-hypeNeon">{verdict.category || "act"}</span>
                {" — "}
                {verdict.why || "kept as an act by this person."}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 max-w-3xl font-mono text-[10.5px] leading-relaxed text-chop-muted">
        It did not decide that anyone committed a crime. Each sentence is printed
        with the article it came from, and a quote that is not found in the
        stored text is not on this page.
      </p>

      <p className="mt-2 max-w-3xl font-mono text-[10.5px] leading-relaxed text-chop-muted">
        This is satire: the blade is a metaphor, and no name here is a threat or
        a call for violence. If a sentence is wrong or misattributed,{" "}
        <Link
          href="/submit"
          className="text-spiteCrimson underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
        >
          challenge it
        </Link>
        {" "}— a retracted act leaves this page and the score.{" "}
        <Link
          href="/whitepaper"
          className="text-sheetWhite/80 underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
        >
          The method is public.
        </Link>
      </p>
    </section>
  );
}
