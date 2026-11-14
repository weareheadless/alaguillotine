import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeclarationsFor, getLedgerFor, getPositionsFor } from "@/lib/archive-store";
import { getDb, getPersonBySlug } from "@/lib/hate-store";
import { readNumbersFor } from "@/lib/numbers";
import { safeHref } from "@/lib/url";
import { PromiseAd } from "@/components/PromiseAd";
import { evidenceFor } from "@/lib/evidence";
import { RecordReport } from "@/components/RecordReport";
import { chargeFor } from "@/lib/charge";

export const dynamic = "force-dynamic";

function metaDescription(text: string, limit = 155): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const person = await getPersonBySlug(slug);
  if (!person) return { title: "Name not found — A LA GUILLOTINE" };
  const description = metaDescription(person.reason);
  return {
    title: `${person.name} — the record`,
    description,
    alternates: { canonical: `/person/${slug}` },
    openGraph: {
      title: `${person.name} — the record`,
      description,
      url: `https://alaguillotine.com/person/${slug}`,
      siteName: "A LA GUILLOTINE",
    },
  };
}

/**
 * One name, all of it.
 *
 * The ledger is not a tab — it is attached to the person. This is where the
 * record lives: every charge with its place, year, confidence and sources, and
 * whether the blade has already fallen.
 */
export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = await getPersonBySlug(slug);
  if (!person) notFound();

  const ledger = await getLedgerFor(person.name);
  const positions = await getPositionsFor(slug);
  const declarations = await getDeclarationsFor(slug);

  // The same function the blade uses, so the sentence under the name and the
  // number beside it cannot disagree.
  const today = Date.now();
  const scoredClaims = ledger.filter((e) => {
    if (!e.actDate) return e.year === new Date(today).getUTCFullYear();
    const at = new Date(`${e.actDate}T00:00:00Z`).getTime();
    return today - at <= 180 * 86400000 && at - today <= 7 * 86400000;
  }).length;

  const counted = evidenceFor(
    ledger.map((e) => ({
      act: e.act,
      year: e.year,
      category: e.category,
      confidence: e.confidence,
      actDate: e.actDate,
      grade: e.grade,
    })),
  );
  const db = await getDb();
  const numbers = db ? await readNumbersFor(db, slug) : [];

  // The receipt the charge rests on, or the sentence that clears the name.
  const charge = chargeFor({ name: person.name, numbers, positions });
  const chopped = (person.timesChopped ?? 0) > 0;
  const crosses = Math.min(person.timesChopped ?? 0, 40);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 pt-12">
      <Link
        href="/next-in-line"
        className="font-mono text-[10px] uppercase tracking-[0.25em] text-chop-muted hover:text-sheetWhite"
      >
        ← the line
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase leading-none tracking-tighter text-sheetWhite md:text-5xl">
            {person.name}
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">
            {person.role}
            {person.country ? ` · ${person.country}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl font-black tabular-nums text-spiteCrimson">
            {Math.round(person.score)}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
            {person.rank > 0 ? `rank ${person.rank}` : "on the record"}
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-chop-muted">
            {person.windowActs ? `${Math.round(person.windowActs)} acts / 180d` : "no open acts"}
          </div>
        </div>
      </div>

      {chopped && (
        <div className="mt-4 border-l-2 border-spiteCrimson pl-3">
          <div className="flex flex-wrap gap-x-0.5 text-[15px] leading-none text-spiteCrimson">
            {Array.from({ length: crosses }, (_, i) => (
              <span key={i}>✝</span>
            ))}
            {(person.timesChopped ?? 0) > crosses && (
              <span className="ml-1 font-mono text-[10px] text-chop-muted">
                +{(person.timesChopped ?? 0) - crosses}
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-spiteCrimson">
            chopped {person.timesChopped} time{person.timesChopped === 1 ? "" : "s"}
            {person.lastChoppedAt
              ? ` · last ${new Date(person.lastChoppedAt).toUTCString().slice(5, 16)}`
              : ""}{" "}
            · back in the line
          </p>
        </div>
      )}

      <section className="mt-6 border border-chop-border bg-white/[0.02] p-3.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">the charge</p>
        <p className="mt-1 max-w-3xl text-[14px] font-semibold leading-snug text-sheetWhite">
          {person.reason}
        </p>

        <p className="mt-2.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-chop-muted">
          the receipt behind it
        </p>
        <p className="mt-1 max-w-3xl font-mono text-[11.5px] leading-relaxed text-sheetWhite/85">
          {charge.headline}
        </p>
        <p className="mt-1 max-w-3xl font-mono text-[10px] leading-relaxed text-chop-muted">
          {charge.support}
        </p>

        <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-chop-muted/70">
          Each clause below carries its date, its grade and its source. Where the record is thin,
          it says so.
        </p>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] text-chop-muted">
          <span className="uppercase tracking-[0.18em] text-chop-muted">why this name is on the line</span>
          {counted.acts > 0 ? (
            <span>
              {scoredClaims} claim{scoredClaims === 1 ? "" : "s"} in the last 180 days · weight{" "}
              {counted.total} · score{" "}
              <span className="font-black text-sheetWhite">{counted.score}</span> = 100 × (1 − e
              <sup>−{counted.total}/2.5</sup>)
            </span>
          ) : (
            <span>
              nothing inside the 180-day window, so this name cannot be sentenced. It keeps its page
              and its receipts.
            </span>
          )}
        </div>
      </section>

      {/* The number is the window. The newest credible act is the receipt, so
          the page cannot show a 2018 charge under a 2026 score without saying
          what the recent record actually is. */}
      <div className="mt-5 border-l-2 border-hypeNeon/60 pl-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
          newest act in the window
        </p>
        {person.latestAct ? (
          <p className="mt-1 font-mono text-[12px] leading-relaxed text-sheetWhite/85">
            <span className="text-hypeNeon">
              {person.latestAct.date
                ? new Date(`${person.latestAct.date}T00:00:00Z`).toUTCString().slice(5, 16)
                : person.latestAct.year}
            </span>
            {person.latestAct.place ? ` · ${person.latestAct.place}` : ""}
            {" — "}
            {person.latestAct.act}
            <span className="text-chop-muted">
              {" "}
              [{Math.round(person.latestAct.confidence)} · {person.latestAct.category}]
            </span>
          </p>
        ) : (
          <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-chop-muted">
            nothing on record inside 180 days — this name cannot be sentenced
          </p>
        )}
      </div>

      <RecordReport
        ledger={ledger}
        numbers={numbers}
        positions={positions}
        declarations={declarations}
        now={new Date()}
      />

      <PromiseAd variant="panel" />

      {person.items.length > 0 && (
        <>
          <h2 className="mt-10 border-b border-chop-border pb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
            named in
          </h2>
          <ul className="mt-4 space-y-3">
            {person.items.map((item, i) => (
              <li key={i}>
                <a
                  href={safeHref(item.sourceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-sheetWhite hover:text-spiteCrimson"
                >
                  {item.headline}
                </a>
                <p className="font-mono text-[10px] text-chop-muted">{item.source}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
