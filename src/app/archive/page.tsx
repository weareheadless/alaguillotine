import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import {
  bodyLabel,
  documentLabel,
  readArchive,
  statusLabel,
  type ArchiveQuery,
  type ArchiveRow,
} from "@/lib/register/dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Record — every claim and the passage behind it",
  description:
    "A queryable database of documented acts: search a name, a company, a vote or a year, and read the passage each claim came from.",
  alternates: { canonical: "/archive" },
};

type Params = {
  q?: string;
  body?: string;
  kind?: string;
  category?: string;
  status?: string;
  year?: string;
  entity?: string;
  sort?: string;
  page?: string | number;
};

const num = (n: number): string => n.toLocaleString("en-US");

const KINDS = [
  { key: "", label: "Latest" },
  { key: "finding", label: "Findings" },
  { key: "trade", label: "Trades" },
  { key: "declaration", label: "Declarations" },
  { key: "report", label: "Reports" },
  { key: "vote", label: "Votes" },
  { key: "unverified", label: "Unverified" },
];

const KIND_TONE: Record<string, string> = {
  trade: "border-hypeNeon/40 text-hypeNeon",
  declaration: "border-sheetWhite/30 text-sheetWhite/80",
  report: "border-spiteCrimson/50 text-spiteCrimson",
  vote: "border-chop-border text-chop-muted",
  "": "border-chop-border text-chop-muted",
};

const STATUS_TONE: Record<string, string> = {
  recorded: "text-hypeNeon",
  matched: "text-amber-300",
  alleged: "text-spiteCrimson",
  legacy: "text-chop-muted",
};

function href(base: Params, next: Params): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...base, ...next })) {
    if (value !== undefined && value !== null && String(value).length > 0) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `/archive?${qs}` : "/archive";
}

function money(row: ArchiveRow): string {
  if (row.amount === null || Number.isNaN(row.amount) || row.amount <= 0) return "";
  const symbol = row.currency === "GBP" ? "£" : "$";
  return `${symbol}${Number(row.amount).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

function day(value: string): string {
  return value ? value.slice(0, 10) : "";
}

export default async function ArchivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const entity = (params.entity ?? "").trim();
  const sort = (params.sort ?? "").trim();
  const body = (params.body ?? "").trim();
  const kind = (params.kind ?? "").trim();
  const category = (params.category ?? "").trim();
  const status = (params.status ?? "").trim();
  const year = (params.year ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);

  const query: ArchiveQuery = { q, entity, body, kind, category, status, year, sort, page };
  const result = await readArchive(query);

  if (!result) {
    return (
      <div className="min-h-screen bg-canvasBlack text-sheetWhite">
        <NavBar />
        <main className="mx-auto max-w-[1100px] px-5 pb-24 pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
            the register is not answering
          </p>
        </main>
      </div>
    );
  }

  const { rows, total, pages, facets, person } = result;
  const base: Params = {
    q: q || undefined,
    entity: entity || undefined,
    sort: sort || undefined,
    body: body || undefined,
    kind: kind || undefined,
    category: category || undefined,
    status: status || undefined,
    year: year || undefined,
  };
  const filtered = Boolean(q || entity || body || kind || category || status || year);
  const latest = !filtered && !sort;

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[1100px] px-5 pb-24 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
          the record
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
          Everything we can <span className="text-spiteCrimson">prove.</span>
        </h1>
        <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
          One database of documented acts. Every row carries the document it came
          from and the passage that states it. Search a name, a company, a vote or
          a year.
        </p>

        {person ? (
          <div className="mt-5 border border-chop-border bg-chop-card/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-2xl font-black uppercase tracking-tight text-sheetWhite">
                {person.name}
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
                {[person.affiliation, person.country, bodyLabel(person.bodyKey)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <Link
                href="/archive"
                className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted underline-offset-2 hover:text-sheetWhite hover:underline"
              >
                ← everyone
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
              <span className="text-sheetWhite">{num(person.claims)} claims</span>
              <span>·</span>
              <span>{num(person.passages)} passages</span>
              <span>·</span>
              <span className={person.findings ? "text-spiteCrimson" : ""}>
                {num(person.findings)} findings
              </span>
              <span>·</span>
              <span>{num(person.documents)} documents</span>
            </div>
          </div>
        ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["claims", facets.claims],
            ["findings", facets.findings],
            ["documents", facets.documents],
            ["people", facets.people],
            ["passages", facets.passages],
          ].map(([label, value]) => (
            <div key={label as string} className="border border-chop-border bg-chop-card/40 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                {label}
              </div>
              <div className="mt-1 font-mono text-lg tabular-nums text-sheetWhite">
                {num(value as number)}
              </div>
            </div>
          ))}
        </div>
        )}

        <form action="/archive" method="get" className="mt-6 flex flex-wrap gap-2">
          {body ? <input type="hidden" name="body" value={body} /> : null}
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          {category ? <input type="hidden" name="category" value={category} /> : null}
          {sort ? <input type="hidden" name="sort" value={sort} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="a name, a company, part of a sentence"
            className="min-w-[240px] flex-1 border border-chop-border bg-transparent px-3 py-2.5 font-mono text-[13px] text-sheetWhite placeholder:text-chop-muted/60 focus:border-spiteCrimson focus:outline-none"
          />
          <select
            name="year"
            defaultValue={year}
            className="border border-chop-border bg-canvasBlack px-2.5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-chop-muted focus:border-spiteCrimson focus:outline-none"
          >
            <option value="">any year</option>
            {Array.from({ length: 12 }, (_, i) => 2026 - i).map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="border-2 border-black bg-spiteCrimson px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            Search
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <Link
            href={href(base, { body: undefined, page: undefined })}
            className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
              body ? "border-chop-border text-chop-muted hover:text-sheetWhite" : "border-sheetWhite bg-sheetWhite text-canvasBlack"
            }`}
          >
            All bodies
          </Link>
          {facets.bodies.map((entry) => {
              const key = entry.key || "unlisted";
              return (
                <Link
                  key={key}
                  href={href(base, { body: key, page: undefined })}
                  className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
                    body === key
                      ? "border-sheetWhite bg-sheetWhite text-canvasBlack"
                      : "border-chop-border text-chop-muted hover:text-sheetWhite"
                  }`}
                >
                  {entry.label} <span className="opacity-60">{num(entry.n)}</span>
                </Link>
              );
            })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {KINDS.map((entry) => (
            <Link
              key={entry.key || "latest"}
              href={href(base, { kind: entry.key || undefined, page: undefined })}
              className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
                kind === entry.key
                  ? "border-spiteCrimson bg-spiteCrimson/15 text-spiteCrimson"
                  : "border-chop-border text-chop-muted hover:text-sheetWhite"
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </div>

        {facets.categories.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted/60">
              topics
            </span>
            {facets.categories
              .filter((entry) => entry.key !== "vote")
              .slice(0, 8)
              .map((entry) => (
              <Link
                key={entry.key}
                href={href(base, { category: category === entry.key ? undefined : entry.key, page: undefined })}
                className={`border px-2 py-0.5 font-mono text-[9px] lowercase tracking-[0.08em] ${
                  category === entry.key
                    ? "border-hypeNeon/60 text-hypeNeon"
                    : "border-transparent text-chop-muted hover:text-sheetWhite"
                }`}
              >
                {entry.label}
              </Link>
              ))}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-chop-border pb-3">
          <h2 className="text-lg font-black uppercase tracking-tight text-sheetWhite">
            {person ? "Their record" : latest ? "Latest" : "Results"}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-chop-muted">
            {num(total)} {total === 1 ? "claim" : "claims"}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </span>
          {latest ? (
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
              votes and unverified rows are in their own tabs
            </span>
          ) : (
            <Link
              href={entity ? href({}, { entity, sort }) : "/archive"}
              className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted underline-offset-2 hover:text-sheetWhite hover:underline"
            >
              clear filters
            </Link>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
          <span className="text-chop-muted/60">sort</span>
          {[
            { key: "", label: "newest" },
            { key: "confidence", label: "confidence" },
            { key: "amount", label: "largest amount" },
          ].map((option) => (
            <Link
              key={option.key || "date"}
              href={href(base, { sort: option.key || undefined, page: undefined })}
              className={
                sort === option.key
                  ? "border-b border-spiteCrimson pb-0.5 text-spiteCrimson"
                  : "hover:text-sheetWhite"
              }
            >
              {option.label}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="mt-8 border border-chop-border p-6">
            <p className="font-mono text-[12px] text-chop-muted">
              {kind === "finding"
                ? "No feed has yet produced a passage that reports a misdeed. Unverified accusations from the old archive are in Reports, without a passage, and score nothing."
                : "Nothing matches those filters. The register only holds what a document states; an empty result is not an absence of the act."}
            </p>
            <Link href="/archive" className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-hypeNeon hover:underline">
              back to the latest →
            </Link>
          </div>
        ) : (
          <ol className="divide-y divide-chop-border/70">
            {rows.map((row) => {
              const kindLabel = documentLabel(row.documentKind);
              const amount = money(row);
              return (
                <li key={row.claimId} className="py-5">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
                    <span className="border border-chop-border px-1.5 py-0.5 text-sheetWhite/80">
                      {bodyLabel(row.bodyKey)}
                    </span>
                    <span className={`border px-1.5 py-0.5 ${KIND_TONE[row.documentKind] ?? KIND_TONE[""]}`}>
                      {kindLabel}
                    </span>
                    <span className={`${STATUS_TONE[row.status] ?? "text-chop-muted"}`}>
                      {statusLabel(row.status)}
                    </span>
                    {row.finding !== "none" ? (
                      <span className="border border-spiteCrimson/60 px-1.5 py-0.5 text-spiteCrimson">
                        finding
                      </span>
                    ) : null}
                    <span className="ml-auto tabular-nums">{day(row.date)}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <Link
                      href={href({}, { entity: row.entityId })}
                      className="text-[15px] font-bold leading-tight text-sheetWhite underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.affiliation || row.country ? (
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
                        {[row.affiliation, row.country].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {amount ? (
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-hypeNeon">
                        {amount}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-sheetWhite/90">
                    {row.act}
                  </p>

                  <details className="group mt-2">
                    <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.14em] text-chop-muted transition-colors hover:text-sheetWhite">
                      <span className="group-open:hidden">the passage →</span>
                      <span className="hidden group-open:inline">hide the passage</span>
                    </summary>
                    {row.quote ? (
                      <blockquote className="mt-2 whitespace-pre-line border-l-2 border-spiteCrimson/60 pl-3 font-mono text-[11px] leading-relaxed text-chop-muted">
                        {row.quote}
                      </blockquote>
                    ) : (
                      <p className="mt-2 border-l-2 border-chop-border pl-3 font-mono text-[11px] leading-relaxed text-chop-muted">
                        Filed before the register: no passage was stored, so this
                        row is labelled unverified and scores nothing.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
                      <span>{row.issuer || "source"}</span>
                      {row.number ? <span>{row.number}</span> : null}
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-hypeNeon underline-offset-2 hover:underline"
                        >
                          open the document ↗
                        </a>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}

        {pages > 1 ? (
          <nav className="mt-8 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-chop-muted">
            {page > 1 ? (
              <Link href={href(base, { page: page - 1 })} className="hover:text-sheetWhite">
                ← previous
              </Link>
            ) : (
              <span />
            )}
            <span>
              {page} / {pages}
            </span>
            {page < pages ? (
              <Link href={href(base, { page: page + 1 })} className="hover:text-sheetWhite">
                next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}

        <p className="mt-10 border-t border-chop-border pt-4 font-mono text-[10px] leading-relaxed text-chop-muted">
          A claim is not a verdict. &ldquo;Recorded&rdquo; means the document states
          the act; &ldquo;alleged&rdquo; means the passage reports a misdeed without an
          official finding; &ldquo;unverified&rdquo; means it was carried in from the
          old archive and has no passage yet. A <span className="text-spiteCrimson">finding</span>{" "}
          is the narrower thing: a passage that reports a misdeed, or one a court,
          regulator or admission established. Everything else is an act, not
          wrongdoing. The passage is always the proof, and the document is one
          click away.
        </p>
      </main>
    </div>
  );
}
