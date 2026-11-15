import { NavBar } from "@/components/NavBar";
import { partyLabel, readCoverage } from "@/lib/register/coverage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Coverage — what the record actually covers",
  description:
    "The declared population, how many of them appear in a document we have read, and how many have a stored passage about conduct rather than a vote.",
  alternates: { canonical: "/coverage" },
  openGraph: {
    title: "Coverage — what the record actually covers",
    description:
      "A denominator written down before the counting, and the two ratios against it.",
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

  const house = report.universes[0];
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
          A site that accuses people has to publish its own denominator. The
          population is declared first — every voting seat in the House, taken
          from the Clerk&rsquo;s roster — and then counted against. Two ratios,
          kept apart on purpose: a member we have <span className="text-sheetWhite">read</span>{" "}
          appears in a document with a passage stored, usually a vote; a member we
          have <span className="text-sheetWhite">covered</span> has a stored
          passage about conduct, from something other than a roll call — a trade
          in a filing counts, a vote does not. A vote is a fact about the
          chamber. It is not evidence of anything on its own.
        </p>

        {house ? (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="border border-chop-border p-4">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                  seats declared
                </div>
                <div className="mt-1 text-3xl font-black tabular-nums text-sheetWhite">
                  {num(house.expected)}
                </div>
                <div className="mt-1 font-mono text-[10px] text-chop-muted">
                  {num(house.listed)} members listed on the roster
                </div>
              </div>
              <div className="border border-chop-border p-4">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                  read
                </div>
                <div className="mt-1 text-3xl font-black tabular-nums text-sheetWhite">
                  {num(house.read)}
                </div>
                <div className="mt-1 font-mono text-[10px] text-chop-muted">
                  {pct(house.read, house.listed)} of those listed
                </div>
              </div>
              <div className="border border-spiteCrimson/50 p-4">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                  covered
                </div>
                <div className="mt-1 text-3xl font-black tabular-nums text-spiteCrimson">
                  {num(house.covered)}
                </div>
                <div className="mt-1 font-mono text-[10px] text-chop-muted">
                  {pct(house.covered, house.listed)} with a passage about conduct
                </div>
              </div>
            </div>

            <p className="mt-4 border-l-2 border-spiteCrimson/60 pl-3 font-mono text-[11px] leading-relaxed text-chop-muted">
              {house.description}
            </p>

            <div className="mt-10 border-b border-chop-border pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              by party
            </div>
            <div className="oc-table mt-3 overflow-x-auto">
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                    <th className="py-2 pr-4 font-normal">party</th>
                    <th className="py-2 pr-4 text-right font-normal">listed</th>
                    <th className="py-2 pr-4 text-right font-normal">read</th>
                    <th className="py-2 text-right font-normal">covered</th>
                  </tr>
                </thead>
                <tbody>
                  {report.parties.map((row) => (
                    <tr key={row.party} className="border-t border-chop-border/60">
                      <td className="py-2 pr-4 text-sheetWhite">{partyLabel(row.party)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-chop-muted">
                        {num(row.listed)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-sheetWhite/80">
                        {num(row.read)}{" "}
                        <span className="text-chop-muted">({pct(row.read, row.listed)})</span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-spiteCrimson">
                        {num(row.covered)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-chop-muted">
              The same measure applied to both parties. A gap here is a gap in
              what has been read, not a finding about anyone.
            </p>
          </>
        ) : (
          <p className="mt-8 border border-chop-border p-4 font-mono text-[11px] text-chop-muted">
            No population has been declared yet, so there is no ratio to state.
          </p>
        )}

        {record ? (
          <>
            <div className="mt-12 border-b border-chop-border pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              the record behind the ratio
            </div>
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
