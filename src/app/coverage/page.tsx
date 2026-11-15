import { NavBar } from "@/components/NavBar";
import { bodyLabel, partyLabel, readCoverage } from "@/lib/register/coverage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Coverage — what the record actually covers",
  description:
    "Every declared population, counted separately: how many of them appear in a document we have read, how many have a stored passage about an act, and how many about a misdeed.",
  alternates: { canonical: "/coverage" },
  openGraph: {
    title: "Coverage — what the record actually covers",
    description:
      "A denominator written down before the counting, for each body separately, and the three ratios against it.",
    url: "https://alaguillotine.com/coverage",
    siteName: "A LA GUILLOTINE",
  },
};

const num = (n: number): string => n.toLocaleString("en-US");
const pct = (part: number, whole: number): string =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";

const STATUS_LABEL: Record<string, string> = {
  recorded: "recorded",
  matched: "passage located",
  legacy: "filed before the register",
  refuted: "contradicted by the record",
  alleged: "alleged",
  reported: "reported",
  found: "found",
  admitted: "admitted",
  superseded: "superseded",
};

export default async function CoveragePage() {
  const report = await readCoverage();

  if (!report) {
    return (
      <div className="min-h-screen bg-canvasBlack text-sheetWhite">
        <NavBar />
        <main className="mx-auto max-w-[900px] px-5 pb-24 pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
            the register is not answering
          </p>
        </main>
      </div>
    );
  }

  const record = report.record;

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[1000px] px-5 pb-24 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
          coverage
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
          What we can <span className="text-spiteCrimson">prove.</span>
        </h1>
        <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
          A site that accuses people has to publish its own denominator. There is
          no single one: a member of the US House and a Member of the European
          Parliament belong to different populations, with different documents and
          different gaps. Each is declared first, then counted against, and the
          numbers are never added together. Three per body, kept apart on purpose.{" "}
          <span className="text-sheetWhite">Read</span>: a document naming them has
          been read and a passage stored, usually a vote.{" "}
          <span className="text-sheetWhite">Documented</span>: the passage is about
          an act, not a vote — a trade, a filing, a story.{" "}
          <span className="text-sheetWhite">Accused</span>: the passage is about a
          misdeed, from journalism or a register, not from their own paperwork. A
          vote is a fact about the chamber. A portfolio is a fact about a
          portfolio. Neither is evidence of wrongdoing on its own, which is why
          only the last number answers the question the site exists to ask.
        </p>

        {report.universes.length === 0 ? (
          <p className="mt-8 border border-chop-border p-4 font-mono text-[11px] text-chop-muted">
            No population has been declared yet, so there is no ratio to state.
          </p>
        ) : (
          report.universes.map((universe) => (
            <section key={universe.id} className="mt-12 border-t border-chop-border pt-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-spiteCrimson">
                  {bodyLabel(universe)}
                </p>
                <h2 className="text-xl font-black uppercase tracking-tight text-sheetWhite">
                  {universe.name}
                </h2>
                <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
                  declared {universe.declaredAt.slice(0, 10)}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="border border-chop-border p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                    seats declared
                  </div>
                  <div className="mt-1 text-3xl font-black tabular-nums text-sheetWhite">
                    {num(universe.expected)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-chop-muted">
                    {num(universe.listed)} people listed
                  </div>
                </div>
                <div className="border border-chop-border p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                    read
                  </div>
                  <div className="mt-1 text-3xl font-black tabular-nums text-sheetWhite">
                    {num(universe.read)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-chop-muted">
                    {pct(universe.read, universe.listed)} with a passage stored
                  </div>
                </div>
                <div className="border border-chop-border p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                    documented
                  </div>
                  <div className="mt-1 text-3xl font-black tabular-nums text-sheetWhite">
                    {num(universe.documented)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-chop-muted">
                    {pct(universe.documented, universe.listed)} with a passage about an act
                  </div>
                </div>
                <div className="border border-spiteCrimson/50 p-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                    accused
                  </div>
                  <div className="mt-1 text-3xl font-black tabular-nums text-spiteCrimson">
                    {num(universe.accused)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-chop-muted">
                    {pct(universe.accused, universe.listed)} with a passage about a misdeed
                  </div>
                </div>
              </div>

              <p className="mt-4 border-l-2 border-spiteCrimson/60 pl-3 font-mono text-[11px] leading-relaxed text-chop-muted">
                {universe.description}
              </p>

              {universe.read === 0 ? (
                <p className="mt-3 border-l-2 border-chop-border pl-3 font-mono text-[10px] leading-relaxed text-chop-muted">
                  This population is declared, not read. No document connector
                  exists for {universe.body} yet, so zero here means zero
                  documents, not zero wrongdoing. The denominator is real; the
                  numerator has not been earned.
                </p>
              ) : null}

              {universe.parties.length > 0 ? (
                <>
                  <div className="mt-8 border-b border-chop-border pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                    by affiliation
                  </div>
                  <div className="oc-table mt-3 overflow-x-auto">
                    <table className="w-full font-mono text-[11px]">
                      <thead>
                        <tr className="text-left text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                          <th className="py-2 pr-4 font-normal">affiliation</th>
                          <th className="py-2 pr-4 text-right font-normal">listed</th>
                          <th className="py-2 pr-4 text-right font-normal">read</th>
                          <th className="py-2 pr-4 text-right font-normal">documented</th>
                          <th className="py-2 text-right font-normal">accused</th>
                        </tr>
                      </thead>
                      <tbody>
                        {universe.parties.map((row) => (
                          <tr key={row.party} className="border-t border-chop-border/60">
                            <td className="py-2 pr-4 text-sheetWhite">{partyLabel(row.party)}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-chop-muted">
                              {num(row.listed)}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums text-sheetWhite/80">
                              {num(row.read)}{" "}
                              <span className="text-chop-muted">({pct(row.read, row.listed)})</span>
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums text-sheetWhite/80">
                              {num(row.documented)}
                            </td>
                            <td className="py-2 text-right tabular-nums text-spiteCrimson">
                              {num(row.accused)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 font-mono text-[10px] leading-relaxed text-chop-muted">
                    The same measure applied to every affiliation. A gap here is a
                    gap in what has been read, not a finding about anyone — and a
                    group with more disclosures or more votes is a group with more
                    paperwork, nothing more.
                  </p>
                </>
              ) : null}

              {universe.sourceUrl ? (
                <p className="mt-4 font-mono text-[9px] leading-relaxed text-chop-muted">
                  Population enumerated from{" "}
                  <a
                    href={universe.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-hypeNeon underline-offset-2 hover:underline"
                  >
                    {universe.sourceUrl}
                  </a>
                </p>
              ) : null}
            </section>
          ))
        )}

        {record ? (
          <>
            <div className="mt-14 border-b border-chop-border pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              the record behind every ratio
            </div>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-chop-muted">
              This part is shared: one register holds the documents and claims for
              every body, but the counts above are always per population.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                  claims by status
                </div>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  {record.byStatus.map((row) => (
                    <li key={row.status} className="flex justify-between border-b border-chop-border/40 pb-1">
                      <span className="text-sheetWhite/80">
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                      <span className="tabular-nums text-chop-muted">{num(row.n)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                  documents we hold
                </div>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  {record.documents.map((row) => (
                    <li key={row.kind} className="flex justify-between border-b border-chop-border/40 pb-1">
                      <span className="text-sheetWhite/80">{row.kind.replace("_", " ")}</span>
                      <span className="tabular-nums text-chop-muted">
                        {num(row.n)}{" "}
                        <span className="text-chop-muted/60">· {num(row.withText)} read</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-6 font-mono text-[10px] leading-relaxed text-chop-muted">
              {num(record.groundedClaims)} claims carry a passage stored from the
              document, across {num(record.peopleWithPassage)} of the{" "}
              {num(record.people)} people on file. What has no passage is labelled
              as such wherever it appears; nothing is upgraded by being repeated.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
