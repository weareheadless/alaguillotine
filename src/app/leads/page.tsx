import { NavBar } from "@/components/NavBar";
import { readLeads } from "@/lib/register/leads";
import { HOUSE_BODY, jurisdictionsFor } from "@/lib/register/sectors";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leads — a committee seat and a disclosed trade",
  description:
    "Every member whose disclosed trades touch a business their committee oversees, with the rule that connects them and both citations.",
  alternates: { canonical: "/leads" },
};

const num = (n: number): string => n.toLocaleString("en-US");
const money = (value: string): string => value.replace("$", "");

const TYPE_LABEL: Record<string, string> = {
  P: "bought",
  S: "sold",
  E: "exchanged",
  G: "received",
};

export default async function LeadsPage() {
  const report = await readLeads(40);

  if (!report) {
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

  const { members, totals } = report;

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[1000px] px-5 pb-24 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">leads</p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
          A seat and a <span className="text-spiteCrimson">trade.</span>
        </h1>
        <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
          Two facts on the record: what a member&rsquo;s committee has jurisdiction
          over, and what they disclosed trading. The connection between them is
          our rule, printed below and beside every row, because{" "}
          <span className="text-sheetWhite">
            &ldquo;Armed Services oversees defence procurement&rdquo;
          </span>{" "}
          is an argument, not a data point. A lead is not a finding. It says these
          two things are on the record together and leaves the question where it
          belongs.
        </p>
        <p className="mt-3 max-w-2xl border-l-2 border-chop-border pl-3 font-mono text-[10px] leading-relaxed text-chop-muted">
          One body so far. These are the US House&rsquo;s committee rules, applied
          to the US House&rsquo;s disclosures; the register is not US-only, and
          coverage lists every declared population, but a rule written for one
          parliament is never applied to another.
        </p>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
          <span className="text-sheetWhite">{num(totals.membersWithLeads)} members</span>
          <span>·</span>
          <span>{num(totals.leads)} leads</span>
          <span>·</span>
          <span>{num(totals.trades)} disclosed trades parsed</span>
          <span>·</span>
          <span>{num(totals.membersSeated)} seats</span>
        </div>

        <p className="mt-3 border-l-2 border-chop-border pl-3 font-mono text-[10px] leading-relaxed text-chop-muted">
          Only filings whose PDF has been read are counted. A trade that is not
          here may simply not have been parsed yet; an empty row is not an
          absence of trading.
        </p>

        {members.length === 0 ? (
          <p className="mt-10 border border-chop-border p-4 font-mono text-[11px] text-chop-muted">
            No member with both a mapped committee seat and a parsed trade yet.
          </p>
        ) : (
          <ol className="mt-8 divide-y divide-chop-border/70">
            {members.map((member) => (
              <li key={member.id} className="py-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[15px] font-bold text-sheetWhite">{member.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
                    {member.party} · {member.state}
                    {member.district ? `-${member.district}` : ""}
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
                    <li key={`${lead.filing}-${index}`} className="font-mono text-[11px] leading-relaxed">
                      <span className="text-chop-muted">
                        {TYPE_LABEL[lead.type] ?? lead.type.toLowerCase()}{" "}
                      </span>
                      <span className="text-sheetWhite">{lead.asset}</span>
                      {lead.ticker ? <span className="text-chop-muted"> ({lead.ticker})</span> : null}
                      <span className="text-chop-muted"> · {money(lead.amount)} · {lead.date}</span>
                      <span className="text-chop-muted"> · </span>
                      <span className="text-sheetWhite/80">{lead.committeeName}</span>
                      <span className="text-chop-muted"> oversees {lead.oversees} · </span>
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-hypeNeon underline-offset-2 hover:underline"
                      >
                        filing {lead.filing}
                      </a>
                    </li>
                  ))}
                  {member.leads.length > 3 ? (
                    <li className="font-mono text-[10px] text-chop-muted">
                      +{member.leads.length - 3} more in the same filings
                    </li>
                  ) : null}
                </ul>
              </li>
            ))}
          </ol>
        )}

        <section className="mt-14 border-t border-chop-border pt-6">
          <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
            the rules used
          </h2>
          <ul className="mt-3 space-y-2">
            {jurisdictionsFor(HOUSE_BODY).map((entry) => (
              <li key={entry.committee} className="font-mono text-[10px] leading-relaxed text-chop-muted">
                <span className="text-sheetWhite">
                  {entry.committee} — {entry.oversees}
                </span>
                <br />
                matched: {entry.names.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-[10px] leading-relaxed text-chop-muted">
            These lists are short and specific on purpose. A missed trade costs
            nothing; a wrong match costs the site its credibility. Every lead
            above can be checked against two public documents: the Clerk&rsquo;s
            roster for the seat, and the filing for the trade.
          </p>
        </section>
      </main>
    </div>
  );
}
