import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeclarationsFor, getLedgerFor, getPositionsFor } from "@/lib/archive-store";
import { getDb, getPersonBySlug } from "@/lib/hate-store";
import { readNumbersFor } from "@/lib/numbers";
import { safeHref } from "@/lib/url";
import { PromiseAd } from "@/components/PromiseAd";
import { RecordReport } from "@/components/RecordReport";

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
  const db = await getDb();
  const numbers = db ? await readNumbersFor(db, slug) : [];
  const chopped = (person.timesChopped ?? 0) > 0;
  const crosses = Math.min(person.timesChopped ?? 0, 40);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-12">
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

      <section className="mt-6">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">the charge</p>
        <p className="mt-1 font-mono text-[12px] leading-relaxed text-chop-muted">{person.reason}</p>
        <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-chop-muted/70">
          Each clause below carries its date, its grade and its source. Where the record is thin,
          it says so.
        </p>
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
