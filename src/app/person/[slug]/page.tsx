import Link from "next/link";
import { notFound } from "next/navigation";
import { getLedgerFor } from "@/lib/archive-store";
import { getPersonBySlug } from "@/lib/hate-store";

export const dynamic = "force-dynamic";

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
  const chopped = (person.timesChopped ?? 0) > 0;
  const crosses = Math.min(person.timesChopped ?? 0, 40);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
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
            rank {person.rank}
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

      <p className="mt-6 font-mono text-[12px] leading-relaxed text-chop-muted">{person.reason}</p>

      <h2 className="mt-10 border-b border-chop-border pb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
        the record
      </h2>

      {ledger.length === 0 ? (
        <p className="mt-4 font-mono text-[11px] leading-relaxed text-chop-muted">
          No ledger entries yet. The charge above comes from the current reporting;
          the deeper record is still being researched.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-chop-border">
          {ledger.map((entry, i) => (
            <li key={i} className="py-4">
              <div className="flex items-baseline gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                <span className="tabular-nums text-spiteCrimson">{Math.round(entry.confidence)}</span>
                <span>{entry.category}</span>
                <span>·</span>
                <span>{entry.place}</span>
                <span>·</span>
                <span>{entry.year}</span>
              </div>
              <p className="mt-1.5 text-[14px] leading-snug text-sheetWhite">{entry.act}</p>
              <div className="mt-1 flex flex-wrap gap-3">
                {entry.sources.slice(0, 3).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                  >
                    source ↗
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {person.items.length > 0 && (
        <>
          <h2 className="mt-10 border-b border-chop-border pb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
            named in
          </h2>
          <ul className="mt-4 space-y-3">
            {person.items.map((item, i) => (
              <li key={i}>
                <a
                  href={item.sourceUrl}
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
