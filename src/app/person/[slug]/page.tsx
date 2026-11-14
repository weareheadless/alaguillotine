import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLedgerFor, getPositionsFor, type LedgerEntry } from "@/lib/archive-store";
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

const OUTCOME: Record<string, string> = {
  charged: "charged",
  convicted: "convicted",
  investigated: "investigated",
  settled: "settled",
  sanctioned: "sanctioned",
  no_action: "no action taken",
  blocked: "proceedings blocked",
  unknown: "no proceeding recorded",
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
/** A date as a fraction of the year, so a band can be placed on an axis. */
function yearFrac(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return (y || 0) + (((m || 1) - 1) / 12);
}

function stampOf(at: string | null, year: number): string {
  if (!at) return year ? String(year) : "undated";
  return new Date(`${at}T00:00:00Z`).toUTCString().slice(5, 16);
}

export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = await getPersonBySlug(slug);
  if (!person) notFound();

  const ledger = await getLedgerFor(person.name);
  const positions = await getPositionsFor(slug);
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
  // The reading is a count, not a judgement. Every clause here can be checked
  // against the rows below it: how many acts, how many are thin, what the
  // system did about them, and what the record does not contain.
  const acts = ledger.length;
  const thin = ledger.filter((e) => e.grade === "D").length;
  const pendingReview = ledger.filter((e) => e.status === "pending").length;
  const proceeding = ledger.filter((e) =>
    ["charged", "convicted", "settled", "sanctioned"].includes(e.outcome),
  ).length;
  const investigated = ledger.filter((e) => e.outcome === "investigated").length;
  const untouched = acts - proceeding - investigated;
  const moneyYears = numbers
    .map((n) => n.actDate?.slice(0, 4) ?? (n.year ? String(n.year) : ""))
    .filter(Boolean)
    .sort();
  const fromOffice = numbers.filter((n) => n.inOffice).length;
  const spanStart = positions.length
    ? Math.floor(Math.min(...positions.map((p) => yearFrac(p.fromDate))))
    : 0;
  const thisYear = new Date().getUTCFullYear();
  const spanEnd = positions.length
    ? Math.max(
        thisYear,
        ...positions.map((p) => Number((p.toDate ?? String(thisYear)).slice(0, 4))),
      )
    : 0;
  // The scale runs to the end of the last year, so an event in November of it
  // still has somewhere to sit. The ticks stop at the year itself.
  const scaleEnd = spanEnd + 1;
  const step = spanEnd - spanStart > 8 ? 3 : 1;
  const ticks: number[] = [];
  for (let y = spanStart; y <= spanEnd; y += step) ticks.push(y);
  const moneySpan = moneyYears.length
    ? `${moneyYears[0]}–${moneyYears[moneyYears.length - 1]}`
    : "";

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

      {positions.length > 0 ? (
        <section className="mt-8 border border-chop-border bg-white/[0.02] p-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
              positions on the clock
            </p>
            <p className="font-mono text-[9px] tabular-nums text-chop-muted">
              {spanStart}–{spanEnd}
            </p>
          </div>
          <ul className="mt-2.5 space-y-2">
            {positions.map((p) => {
              const from = yearFrac(p.fromDate);
              const to = p.toDate ? yearFrac(p.toDate) : yearFrac(new Date().toISOString().slice(0, 10));
              const left = ((from - spanStart) / Math.max(1, scaleEnd - spanStart)) * 100;
              const width = Math.max(1.5, ((to - from) / Math.max(1, scaleEnd - spanStart)) * 100);
              return (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-2 font-mono text-[10px]">
                    <span className="truncate text-sheetWhite/85">
                      {p.role}
                      <span className="text-chop-muted"> · {p.org}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-chop-muted">
                      {p.fromDate.slice(0, 4)}–{p.toDate ? p.toDate.slice(0, 4) : "now"}
                    </span>
                  </div>
                  <div className="mt-1 h-[6px] w-full bg-white/5">
                    <div
                      className={`h-full ${
                        p.kind === "firm"
                          ? "bg-sheetWhite/25"
                          : p.kind === "fund"
                            ? "bg-hypeNeon/45"
                            : "bg-hypeNeon/70"
                      }`}
                      style={{
                        marginLeft: `${Math.max(0, Math.min(100, left))}%`,
                        width: `${Math.min(100 - Math.max(0, left), width)}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="relative mt-1.5 h-3">
            {ticks.map((y) => (
              <span
                key={y}
                style={{ left: `${((y - spanStart) / Math.max(1, scaleEnd - spanStart)) * 100}%` }}
                className="absolute -translate-x-1/2 tabular-nums font-mono text-[8px] text-chop-muted"
              >
                {y}
              </span>
            ))}
          </div>
          <p className="mt-1 font-mono text-[9px] leading-relaxed text-chop-muted">
            Bands are terms, not conduct. A role known only by its year is drawn at the year,
            not at a date the source never gave. Whether a payment falls inside a band is
            arithmetic; what it means is the claim.
          </p>
        </section>
      ) : null}

      <h2 className="mt-10 border-b border-chop-border pb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
        the record
      </h2>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
        conduct and money, in the order it happened
      </p>

      {acts > 0 ? (
        <div className="mt-4 border border-chop-border bg-white/[0.02] p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
            what this page says, in counts
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-sheetWhite/85">
            <span className="tabular-nums text-sheetWhite">{acts}</span> act
            {acts === 1 ? "" : "s"} on the record
            {thin ? (
              <>
                , <span className="tabular-nums text-spiteCrimson">{thin}</span> of them a single
                unverified allegation
              </>
            ) : null}
            .{" "}
            {untouched > 0 ? (
              <>
                <span className="tabular-nums text-spiteCrimson">{untouched}</span> carry no recorded
                proceeding
              </>
            ) : (
              <>every act carries a recorded proceeding</>
            )}
            {investigated ? (
              <>
                , <span className="tabular-nums">{investigated}</span> were investigated without a
                charge
              </>
            ) : null}
            {proceeding ? (
              <>
                , <span className="tabular-nums">{proceeding}</span> reached a charge, settlement or
                sanction
              </>
            ) : null}
            .
          </p>
          {numbers.length > 0 ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-chop-muted">
              <span className="tabular-nums text-sheetWhite">{numbers.length}</span> money entr
              {numbers.length === 1 ? "y" : "ies"}
              {moneySpan ? `, ${moneySpan}` : ""}: what arrived, through what, from whom, and whether
              anyone was told.
            </p>
          ) : null}
          {fromOffice > 0 ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-chop-muted">
              <span className="tabular-nums text-sheetWhite">{fromOffice}</span> of them are dated to
              a time when an office or an official role was held.
            </p>
          ) : null}
          {pendingReview ? (
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-hypeNeon/80">
              {pendingReview} awaiting review — filed, not yet accepted
            </p>
          ) : null}
          <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-chop-muted">
            grades: A document or admission · B several investigations · C one investigation ·
            D a single allegation, which scores nothing
          </p>
        </div>
      ) : null}

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
                {item.n.capacity ? (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]">
                    <span className="text-chop-muted">as </span>
                    <span className={item.n.inOffice ? "text-hypeNeon" : "text-sheetWhite/70"}>
                      {item.n.capacity}
                    </span>
                  </p>
                ) : null}
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
                  <span
                    className={
                      item.e.outcome === "unknown" || item.e.outcome === "no_action"
                        ? "text-spiteCrimson/80"
                        : "text-hypeNeon/80"
                    }
                  >
                    {OUTCOME[item.e.outcome] ?? item.e.outcome}
                  </span>
                  {item.e.status === "pending" ? (
                    <span className="border border-hypeNeon/40 px-1 text-hypeNeon/80">
                      awaiting review
                    </span>
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
