import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLedgerFor, type LedgerEntry } from "@/lib/archive-store";
import { getDb, getPersonBySlug } from "@/lib/hate-store";
import { readNumbersFor, type NumberKind, type PersonNumber } from "@/lib/numbers";
import { safeHref } from "@/lib/url";
import { PromiseAd } from "@/components/PromiseAd";

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
const GRADE_CHIP: Record<string, string> = {
  A: "border-hypeNeon/60 text-hypeNeon",
  B: "border-sheetWhite/40 text-sheetWhite/80",
  C: "border-chop-border text-chop-muted",
  D: "border-spiteCrimson/60 text-spiteCrimson",
};

const DECLARED: Record<string, string> = {
  disclosed: "disclosed",
  exempt: "no disclosure duty",
  no_filing: "no filing made",
  withheld: "refused",
};

/**
 * The date a reader can place an item by: the reviewer's date when there is
 * one, otherwise the year alone. The page sorts on it, so a 2018 bailout sits
 * beside the 2018 policy it was arranged around rather than in a separate box
 * labelled "numbers".
 */
function stampOf(at: string | null, year: number): string {
  if (!at) return year ? String(year) : "undated";
  return new Date(`${at}T00:00:00Z`).toUTCString().slice(5, 16);
}

export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = await getPersonBySlug(slug);
  if (!person) notFound();

  const ledger = await getLedgerFor(person.name);
  const db = await getDb();
  const numbers = db ? await readNumbersFor(db, slug) : [];
  const chopped = (person.timesChopped ?? 0) > 0;
  const crosses = Math.min(person.timesChopped ?? 0, 40);

  // Conduct and money on one clock. They were two lists, and two lists cannot
  // show that the fee, the bailout and the policy belong to the same years.
  const timeline: Array<
    | { type: "money"; at: string | null; year: number; n: PersonNumber }
    | { type: "conduct"; at: string | null; year: number; e: LedgerEntry }
  > = [
    ...numbers.map((n) => ({ type: "money" as const, at: n.actDate ?? null, year: n.year ?? 0, n })),
    ...ledger.map((e) => ({ type: "conduct" as const, at: e.actDate, year: e.year, e })),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "") || b.year - a.year);

  const moneyKinds = new Set<string>(numbers.map((n) => n.kind));
  const missing = (
    [
      ["tax", "a tax figure"],
      ["wealth", "a stated net worth"],
      ["fees", "fees received"],
      ["public_money", "public money"],
      ["fines", "fines or settlements"],
      ["donations", "political money"],
    ] as Array<[NumberKind, string]>
  )
    .filter(([k]) => !moneyKinds.has(k))
    .map(([, label]) => label);
  const absence = [
    missing.length ? `Not on this record: ${missing.join(", ")}.` : "",
    numbers.some((n) => n.declared === "disclosed")
      ? ""
      : "No flow here is marked as disclosed.",
    "Absence is not innocence — it is what the record does not contain.",
  ]
    .filter(Boolean)
    .join(" ");

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

      <p className="mt-6 font-mono text-[12px] leading-relaxed text-chop-muted">{person.reason}</p>

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

      <PromiseAd variant="panel" />

      <h2 className="mt-10 border-b border-chop-border pb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
        the record
      </h2>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
        conduct and money, in the order it happened
      </p>

      {timeline.length === 0 ? (
        <p className="mt-4 font-mono text-[11px] leading-relaxed text-chop-muted">
          No ledger entries yet. The charge above comes from the current reporting;
          the deeper record is still being researched.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-chop-border">
          {timeline.map((item, i) =>
            item.type === "money" ? (
              <li key={`m-${item.n.kind}-${item.n.label}-${i}`} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                  <span className="text-sheetWhite/70">{stampOf(item.at, item.year)}</span>
                  <span className="border border-hypeNeon/50 px-1 text-hypeNeon">money</span>
                  {item.n.grade ? (
                    <span className={`border px-1 ${GRADE_CHIP[item.n.grade] ?? GRADE_CHIP.C}`}>
                      {item.n.grade}
                    </span>
                  ) : null}
                  <span>{item.n.direction === "out" ? "paid out" : "came in"}</span>
                  {item.n.instrument ? (
                    <>
                      <span>·</span>
                      <span>{item.n.instrument}</span>
                    </>
                  ) : null}
                  {item.n.declared && DECLARED[item.n.declared] ? (
                    <>
                      <span>·</span>
                      <span className="text-spiteCrimson/80">{DECLARED[item.n.declared]}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-[19px] font-black tabular-nums text-spiteCrimson">
                    {item.n.display}
                  </span>
                  <span className="text-[13px] leading-snug text-sheetWhite/85">
                    {item.n.counterparty || item.n.label}
                  </span>
                  {item.n.counterparty ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-chop-muted">
                      {item.n.label}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-chop-muted">{item.n.evidenceQuote}</p>
                <a
                  href={safeHref(item.n.sourceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                >
                  source ↗
                </a>
              </li>
            ) : (
              <li key={`c-${item.e.id || i}`} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                  <span className="text-sheetWhite/70">{stampOf(item.at, item.year)}</span>
                  {item.e.grade ? (
                    <span className={`border px-1 ${GRADE_CHIP[item.e.grade] ?? GRADE_CHIP.C}`}>
                      {item.e.grade}
                    </span>
                  ) : null}
                  <span>{item.e.category}</span>
                  {item.e.place ? (
                    <>
                      <span>·</span>
                      <span>{item.e.place}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[14px] leading-snug text-sheetWhite">{item.e.act}</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {item.e.id ? (
                    <Link
                      href={`/archive/claim/${encodeURIComponent(item.e.id)}`}
                      className="font-mono text-[9px] uppercase tracking-[0.15em] text-spiteCrimson/90 underline decoration-chop-border underline-offset-2 hover:text-spiteCrimson"
                    >
                      evidence ↗
                    </Link>
                  ) : null}
                  {item.e.sources.slice(0, 3).map((url) => (
                    <a
                      key={url}
                      href={safeHref(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                    >
                      source ↗
                    </a>
                  ))}
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {timeline.length > 0 ? (
        <p className="mt-6 border-t border-chop-border pt-3 font-mono text-[10px] leading-relaxed text-chop-muted">
          {absence}
        </p>
      ) : null}

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
