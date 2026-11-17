import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { readArchive } from "@/lib/findings-query";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Record — who did it, and where it is written",
  description:
    "The record behind the line: the powerful, the acts the reporting states, and the source. Most will never be convicted; they own the system. The record is what they did anyway.",
  alternates: { canonical: "/archive" },
};

type Params = {
  q?: string;
  entity?: string;
  finding?: string;
  source?: string;
  line?: string;
  focus?: string;
  fresh?: string;
  page?: string | number;
};

const num = (n: number): string => n.toLocaleString("en-US");

const FINDING_LABEL: Record<string, string> = {
  found: "convicted",
  alleged: "charged",
  admitted: "admitted",
  none: "act",
};

const FINDING_ORDER = ["found", "alleged", "admitted", "none"];

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

export default async function ArchivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const entity = (params.entity ?? "").trim();
  const finding = (params.finding ?? "").trim();
  const source = (params.source ?? "").trim();
  const focus = (params.focus ?? "").trim();
  const fresh = params.fresh === "1";
  // The archive opens on the line, because the line is the site. A search or a
  // finding filter opens it to everyone; "everyone" is explicit from there on.
  const searched = Boolean(q || entity || finding || source);
  const line = !fresh && (params.line === "1" || (params.line !== "0" && !searched));
  const page = Math.max(1, Number(params.page) || 1);

  const result = await readArchive({
    q,
    entity,
    finding,
    source,
    line: line ? "1" : "",
    focus,
    fresh: fresh ? "1" : "",
    page,
  });
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

  const { rows, total, pages, counts, byFinding, byCategory, bySource, person } = result;
  const base: Params = {
    q: q || undefined,
    entity: entity || undefined,
    finding: finding || undefined,
    source: source || undefined,
    line: line ? "1" : undefined,
    focus: focus || undefined,
    fresh: fresh ? "1" : undefined,
  };
  const filtered = Boolean(q || entity || finding || source || line || focus || fresh);
  const findings = byFinding.filter((entry) => entry.key !== "none");
  const acts = byFinding.find((entry) => entry.key === "none");

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[1000px] px-5 pb-24 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
          the record
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
          Who did it, and <span className="text-spiteCrimson">where it is written.</span>
        </h1>
        <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
          Most of the names in line will never be convicted. They own the courts,
          the parties, the platforms and the ports. This is the record of what
          they did anyway — the contracts, the crackdowns, the wars, the
          extraction — with the reporting that states it. A conviction or a charge
          is marked; the absence of one is the point. Search a name, or the line
          itself.
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
              {person.inLine ? (
                <Link
                  href={`/person/${person.slug || slugify(person.name)}`}
                  className="font-mono text-[9px] uppercase tracking-[0.14em] text-hypeNeon underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                >
                  their page →
                </Link>
              ) : null}
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
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["acts on record", counts.acts],
              ["people", counts.people],
              ["in line", counts.line],
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
          {line ? <input type="hidden" name="line" value="1" /> : null}
          {focus ? <input type="hidden" name="focus" value={focus} /> : null}
          {fresh ? <input type="hidden" name="fresh" value="1" /> : null}
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
            href={href(base, { line: "1", finding: undefined, page: undefined })}
            className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
              line
                ? "border-hypeNeon bg-hypeNeon/10 text-hypeNeon"
                : "border-chop-border text-chop-muted hover:text-sheetWhite"
            }`}
          >
            The line {num(counts.line)}
          </Link>
          <Link
            href={href(base, { line: "0", finding: undefined, page: undefined })}
            className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
              !line
                ? "border-sheetWhite bg-sheetWhite text-canvasBlack"
                : "border-chop-border text-chop-muted hover:text-sheetWhite"
            }`}
          >
            Everyone
          </Link>
          <Link
            href={href(base, {
              fresh: fresh ? undefined : "1",
              line: fresh ? "1" : "0",
              page: undefined,
            })}
            className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
              fresh
                ? "border-spiteCrimson bg-spiteCrimson/15 text-spiteCrimson"
                : "border-chop-border text-chop-muted hover:text-sheetWhite"
            }`}
          >
            New names {num(counts.fresh)}
          </Link>
          {[
            ["money", "Money", ["finance", "extraction", "labour", "climate"]],
            ["influence", "Influence", ["impunity", "media"]],
            ["war", "War", ["war", "arms", "genocide"]],
            ["repression", "Repression", ["repression", "migration"]],
          ].map(([key, label, cats]) => {
            const n = byCategory
              .filter((entry) => (cats as string[]).includes(entry.key))
              .reduce((sum, entry) => sum + entry.n, 0);
            if (!n) return null;
            return (
              <Link
                key={key as string}
                href={href(base, {
                  focus: focus === key ? undefined : (key as string),
                  page: undefined,
                })}
                className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
                  focus === key
                    ? "border-sheetWhite bg-sheetWhite text-canvasBlack"
                    : "border-chop-border text-chop-muted hover:text-sheetWhite"
                }`}
              >
                {label} {num(n)}
              </Link>
            );
          })}
          {findings.map((entry) => (
            <Link
              key={entry.key}
              href={href(base, { finding: entry.key, line: "0", page: undefined })}
              className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
                finding === entry.key
                  ? "border-spiteCrimson bg-spiteCrimson/15 text-spiteCrimson"
                  : "border-chop-border text-chop-muted hover:text-sheetWhite"
              }`}
            >
              {FINDING_LABEL[entry.key] ?? entry.key} {num(entry.n)}
            </Link>
          ))}
          {acts ? (
            <Link
              href={href(base, { finding: "act", line: "0", page: undefined })}
              className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
                finding === "act"
                  ? "border-chop-border bg-chop-muted/15 text-sheetWhite"
                  : "border-chop-border text-chop-muted hover:text-sheetWhite"
              }`}
            >
              acts {num(acts.n)}
            </Link>
          ) : null}
          {bySource.slice(0, 5).map((entry) => (
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
            {person ? "Their record" : fresh ? "New names" : line ? "The line" : filtered ? "Results" : "Everyone"}
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-chop-muted">
            {num(total)} {total === 1 ? "act" : "acts"}
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
              Nothing matches. The record only holds what a source states; an
              empty result is not an absence of the act.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-chop-border/70">
            {rows.map((row) => (
              <li key={`${row.claimId}:${row.finding}`} className="py-6">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em]">
                  <span
                    className={`border px-1.5 py-0.5 ${
                      row.finding === "found"
                        ? "border-spiteCrimson bg-spiteCrimson/10 text-spiteCrimson"
                        : row.finding === "none"
                          ? "border-chop-border/70 text-chop-muted"
                          : "border-chop-border text-chop-muted"
                    }`}
                  >
                    {FINDING_LABEL[row.finding] ?? row.finding}
                  </span>
                  {row.inLine ? (
                    <span className="border border-hypeNeon/40 px-1.5 py-0.5 text-hypeNeon">
                      in line
                    </span>
                  ) : null}
                  {row.category && row.category !== "other" ? (
                    <span className="text-chop-muted">{row.category}</span>
                  ) : null}
                  {row.issuer ? (
                    <span className="text-chop-muted">{row.issuer} reports</span>
                  ) : null}
                  <span className="ml-auto tabular-nums text-chop-muted">
                    {row.dateKind === "act"
                      ? row.datePrecision === "year"
                        ? row.date.slice(0, 4)
                        : row.date
                      : row.dateKind === "reported"
                        ? `reported ${row.date}`
                        : "undated"}
                  </span>
                </div>

                <div className="mt-2">
                  <Link
                    href={
                      row.inLine && row.lineSlug
                        ? `/person/${row.lineSlug}`
                        : href({}, { entity: row.entityId })
                    }
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
                    {row.quote ? (
                      <>
                        <span className="group-open:hidden">the sentence →</span>
                        <span className="hidden group-open:inline">hide the sentence</span>
                      </>
                    ) : (
                      <span>the source →</span>
                    )}
                  </summary>
                  {row.quote ? (
                    <blockquote className="mt-2 border-l-2 border-spiteCrimson/60 pl-3 font-mono text-[11px] leading-relaxed text-chop-muted">
                      {row.quote}
                    </blockquote>
                  ) : (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-chop-muted">
                      no stored passage for this act; the source is the record.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
                    {row.url ? (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-hypeNeon underline-offset-2 hover:underline"
                      >
                        {row.title || row.issuer || "the source"} ↗
                      </a>
                    ) : (
                      <span className="text-spiteCrimson">no source attached</span>
                    )}
                    <span>
                      {row.finding === "none"
                        ? "act on the record"
                        : row.stance === "reports"
                          ? "reported, not a verdict"
                          : row.stance}
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
          A charge is not a conviction, and a report is not a verdict. An act
          without a finding is on the record because a source states it, not
          because a court proved it. The source is one click away, and the reader
          is the judge.
        </p>
      </main>
    </div>
  );
}
