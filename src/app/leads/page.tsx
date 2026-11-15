import { NavBar } from "@/components/NavBar";
import { readLeads } from "@/lib/register/leads";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leads — a committee seat and a disclosure",
  description:
    "Every member whose disclosed trades or registered interests touch a business their committee oversees, with the rule that connects them and both citations.",
  alternates: { canonical: "/leads" },
};

const num = (n: number): string => n.toLocaleString("en-US");

const TYPE_LABEL: Record<string, string> = {
  P: "bought",
  S: "sold",
  E: "exchanged",
  G: "received",
};

function place(party: string, state: string, district: string): string {
  const seat = state ? `${state}${district ? `-${district}` : ""}` : "";
  return [party, seat].filter(Boolean).join(" · ");
}

export default async function LeadsPage() {
  const reports = await readLeads(40);

  if (!reports) {
    return (
      <div className="min-h-screen bg-canvasBlack text-sheetWhite">
        <NavBar />
        <main className="mx-auto max-w-[1000px] px-5 pb-24 pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
            the register is not answering
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[1000px] px-5 pb-24 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">leads</p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
          A seat and a <span className="text-spiteCrimson">stake.</span>
        </h1>
        <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
          Two facts on the record: what a member&rsquo;s committee has jurisdiction
          over, and what they disclosed — a trade in the US House, a registered
          interest in the UK Commons. The connection between them is our rule,
          printed below and beside every row, because{" "}
          <span className="text-sheetWhite">
            &ldquo;Armed Services oversees defence procurement&rdquo;
          </span>{" "}
          is an argument, not a data point. A lead is not a finding. It says these
          two things are on the record together and leaves the question where it
          belongs.
        </p>
        <p className="mt-3 max-w-2xl border-l-2 border-chop-border pl-3 font-mono text-[10px] leading-relaxed text-chop-muted">
          One rule book per body. A US committee rule is never applied to a UK
          interest, and the totals below are never added together: a member of one
          parliament is not a member of the other, so a combined count would
          describe nobody.
        </p>

        {reports.map((report) => {
          const { members, totals } = report;
          const trades = report.sources.includes("trade");

          return (
            <section key={report.body} className="mt-14 border-t border-chop-border pt-8">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-xl font-black uppercase tracking-tight text-sheetWhite">
                  {report.label}
                </h2>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                  {report.country} · {report.body}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                <span className="text-sheetWhite">{num(totals.membersWithLeads)} members</span>
                <span>·</span>
                <span>{num(totals.leads)} leads</span>
                <span>·</span>
                <span>
                  {num(totals.disclosures)} {trades ? "disclosed trades parsed" : "registered interests read"}
                </span>
                <span>·</span>
                <span>{num(totals.membersSeated)} seats</span>
              </div>

              <p className="mt-3 border-l-2 border-chop-border pl-3 font-mono text-[10px] leading-relaxed text-chop-muted">
                {trades
                  ? "Only filings whose PDF has been read are counted. A trade that is not here may simply not have been parsed yet; an empty row is not an absence of trading."
                  : "Every current register entry published in bulk is counted. An interest that is not here was not on the member’s register at the date shown; an empty row is not an absence of interests."}
              </p>

              {members.length === 0 ? (
                <p className="mt-8 border border-chop-border p-4 font-mono text-[11px] text-chop-muted">
                  No member with both a mapped committee seat and a parsed disclosure yet.
                </p>
              ) : (
                <ol className="mt-6 divide-y divide-chop-border/70">
                  {members.map((member) => (
                    <li key={member.id} className="py-5">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-[15px] font-bold text-sheetWhite">{member.name}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
                          {place(member.party, member.state, member.district)}
                        </span>
                        <span className="ml-auto font-mono text-[10px] tabular-nums text-spiteCrimson">
                          {num(member.leads.length)} lead{member.leads.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
                        {member.committees.slice(0, 3).join(" · ")}
                        {member.committees.length > 3 ? ` +${member.committees.length - 3}` : ""}
                      </div>

                      <ul className="mt-2 space-y-1.5">
                        {member.leads.slice(0, 3).map((lead, index) => (
                          <li
                            key={`${lead.citation}-${index}`}
                            className="font-mono text-[11px] leading-relaxed"
                          >
                            {lead.source === "trade" ? (
                              <span className="text-chop-muted">
                                {TYPE_LABEL[lead.kind] ?? lead.kind.toLowerCase()}{" "}
                              </span>
                            ) : (
                              <span className="text-chop-muted">{lead.kind} · </span>
                            )}
                            <span className="text-sheetWhite">{lead.description}</span>
                            {lead.ticker ? (
                              <span className="text-chop-muted"> ({lead.ticker})</span>
                            ) : null}
                            <span className="text-chop-muted">
                              {lead.amount && !lead.description.includes(lead.amount)
                                ? ` · ${lead.amount}`
                                : ""}
                              {lead.date ? ` · ${lead.date}` : ""}
                            </span>
                            <span className="text-chop-muted"> · </span>
                            <span className="text-sheetWhite/80">{lead.committeeName}</span>
                            <span className="text-chop-muted"> oversees {lead.oversees} · </span>
                            <a
                              href={lead.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-hypeNeon underline-offset-2 hover:underline"
                            >
                              {lead.citation}
                            </a>
                          </li>
                        ))}
                        {member.leads.length > 3 ? (
                          <li className="font-mono text-[10px] text-chop-muted">
                            +{member.leads.length - 3} more in the same disclosures
                          </li>
                        ) : null}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-10 border-t border-chop-border/70 pt-5">
                <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                  the rules used for {report.label}
                </h3>
                <ul className="mt-3 space-y-2">
                  {report.rules.map((entry) => (
                    <li
                      key={entry.code}
                      className="font-mono text-[10px] leading-relaxed text-chop-muted"
                    >
                      <span className="text-sheetWhite">
                        {entry.name} — {entry.oversees}
                      </span>
                      <br />
                      matched: {entry.matched.join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 font-mono text-[10px] leading-relaxed text-chop-muted">
                  These lists are short and specific on purpose. A missed disclosure
                  costs nothing; a wrong match costs the site its credibility. Every
                  lead above can be checked against two public documents: the
                  committee roster for the seat, and the{" "}
                  {trades ? "filing for the trade" : "register entry for the interest"}.
                </p>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
