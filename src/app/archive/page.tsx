import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { readFindings } from "@/lib/findings-query";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Findings — named, quoted, sourced",
  description:
    "A searchable record of people named in reports of wrongdoing, with the sentence that states the finding and a link to the source.",
  alternates: { canonical: "/archive" },
};

type Params = {
  q?: string;
  entity?: string;
  finding?: string;
  source?: string;
  page?: string | number;
};

const num = (n: number): string => n.toLocaleString("en-US");

const FINDING_LABEL: Record<string, string> = {
  found: "convicted",
  alleged: "charged",
  admitted: "admitted",
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

export default async function FindingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const entity = (params.entity ?? "").trim();
  const finding = (params.finding ?? "").trim();
  const source = (params.source ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);

  const result = await readFindings({ q, entity, finding, source, page });
  if (!result) {
    return (
      <div className="min-h-screen bg-canvasBlack text-sheetWhite">
        <NavBar />
        <main className="mx-auto max-w-[1000px] px-5 pb-24 pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
            the record is not answering
          </p>
        </main>
      </div>
    );
  }

  const { rows, total, pages, counts, byFinding, bySource, person } = result;
  const base: Params = {
    q: q || undefined,
    entity: entity || undefined,
    finding: finding || undefined,
    source: source || undefined,
  };
  const filtered = Boolean(q || entity || finding || source);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[1000px] px-5 pb-24 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
          the findings
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
          Who did it, and <span className="text-spiteCrimson">where it is written.</span>
        </h1>
        <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
          Every row is a finding: a named person, an act, and the sentence that
          states it. The name came from the report, not from a seat, a register
          or a filing. Search a name or an act.
        </p>

        {person ? (
          <div className="mt-5 border border-chop-border bg-chop-card/40 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-2xl font-black uppercase tracking-tight text-sheetWhite">
                {person.name}
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
                {[person.affiliation, person.country].filter(Boolean).join(" · ")}
              </span>
              <Link
                href="/archive"
                className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted hover:text-sheetWhite"
              >
                ← everyone
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
              <span className="text-sheetWhite">{num(person.findings)} findings</span>
              <span>·</span>
              <span>{num(person.sources)} sources</span>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["findings", counts.findings],
              ["people", counts.people],
              ["sources", counts.sources],
            ].map(([label, value]) => (
              <div key={label as string} className="border border-chop-border px-3 py-2">
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
          {finding ? <input type="hidden" name="finding" value={finding} /> : null}
          {source ? <input type="hidden" name="source" value={source} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="a name, or an act"
            className="min-w-[240px] flex-1 border border-chop-border bg-transparent px-3 py-2.5 font-mono text-[13px] text-sheetWhite placeholder:text-chop-muted/60 focus:border-spiteCrimson focus:outline-none"
          />
          <button
            type="submit"
            className="border-2 border-black bg-spiteCrimson px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-hypeNeon"
          >
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Link
            href={href(base, { finding: undefined, page: undefined })}
            className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
              finding ? "border-chop-border text-chop-muted" : "border-sheetWhite bg-sheetWhite text-canvasBlack"
            }`}
          >
            All
          </Link>
          {byFinding.map((entry) => (
            <Link
              key={entry.key}
              href={href(base, { finding: entry.key, page: undefined })}
              className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
                finding === entry.key
                  ? "border-spiteCrimson bg-spiteCrimson/15 text-spiteCrimson"
                  : "border-chop-border text-chop-muted hover:text-sheetWhite"
              }`}
            >
              {FINDING_LABEL[entry.key] ?? entry.key} {num(entry.n)}
            </Link>
          ))}
          {bySource.slice(0, 6).map((entry) => (
            <Link
              key={entry.name}
              href={href(base, { source: source === entry.name ? undefined : entry.name, page: undefined })}
              className={`border px-2 py-0.5 font-mono text-[9px] ${
                source === entry.name
                  ? "border-hypeNeon/60 text-hypeNeon"
                  : "border-transparent text-chop-muted hover:text-sheetWhite"
              }`}
            >
              {entry.name}
            </Link>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-baseline gap-x-3 border-b border-chop-border pb-3">
          <h2 className="text-lg font-black uppercase tracking-tight text-sheetWhite">
            {person ? "Their record" : filtered ? "Results" : "Latest findings"}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-chop-muted">
            {num(total)} {total === 1 ? "finding" : "findings"}
            {pages > 1 ? ` · page ${page} of ${pages}` : ""}
          </span>
          {filtered ? (
            <Link
              href="/archive"
              className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted hover:text-sheetWhite"
            >
              clear filters
            </Link>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="mt-8 border border-chop-border p-6">
            <p className="font-mono text-[12px] leading-relaxed text-chop-muted">
              Nothing matches. The record only holds findings a report states, with
              the sentence; an empty result is not an absence of the act.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-chop-border/70">
            {rows.map((row) => (
              <li key={row.claimId} className="py-6">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em]">
                  <span
                    className={`border px-1.5 py-0.5 ${
                      row.finding === "found"
                        ? "border-spiteCrimson bg-spiteCrimson/10 text-spiteCrimson"
                        : "border-chop-border text-chop-muted"
                    }`}
                  >
                    {FINDING_LABEL[row.finding] ?? row.finding}
                  </span>
                  <span className="text-chop-muted">{row.issuer} reports</span>
                  <span className="ml-auto tabular-nums text-chop-muted">
                    {row.dateKind === "act"
                      ? row.datePrecision === "year"
                        ? row.date.slice(0, 4)
                        : row.date
                      : `reported ${row.date}`}
                  </span>
                </div>

                <div className="mt-2">
                  <Link
                    href={href({}, { entity: row.entityId })}
                    className="text-[17px] font-bold leading-tight text-sheetWhite underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                  {row.affiliation || row.country ? (
                    <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
                      {[row.affiliation, row.country].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-sheetWhite/90">
                  {row.act}
                </p>

                <details className="group mt-2">
                  <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.14em] text-chop-muted hover:text-sheetWhite">
                    <span className="group-open:hidden">the sentence →</span>
                    <span className="hidden group-open:inline">hide the sentence</span>
                  </summary>
                  <blockquote className="mt-2 border-l-2 border-spiteCrimson/60 pl-3 font-mono text-[11px] leading-relaxed text-chop-muted">
                    {row.quote}
                  </blockquote>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-hypeNeon underline-offset-2 hover:underline"
                    >
                      {row.title || row.issuer} ↗
                    </a>
                    <span>
                      {row.stance === "reports" ? "reported, not a verdict" : row.stance}
                    </span>
                  </div>
                </details>
              </li>
            ))}
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
          A charge is not a conviction, and a report is not a verdict. Each row
          says only what the sentence says; the source is one click away, and the
          reader is the judge.
        </p>
      </main>
    </div>
  );
}
