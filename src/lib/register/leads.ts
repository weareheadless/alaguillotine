import { getDb } from "@/lib/clock-store";
import { HOUSE_BODY, jurisdictionFor, matches } from "@/lib/register/sectors";

/**
 * Leads, for the whole House at once.
 *
 * Two facts joined by a published rule: a committee seat, and a disclosed trade
 * in a business that committee plainly oversees. The join is done here rather
 * than in SQL because the rule is prose — a list of companies and the reason
 * they are before the committee — and it should be readable, not hidden in a
 * `LIKE` clause.
 *
 * A lead is not a finding. It says these are on the record together; it says
 * nothing about why, and nothing about whether the trade was known to anyone at
 * the time it was made.
 */

export interface Lead {
  asset: string;
  ticker: string;
  type: string;
  date: string;
  amount: string;
  filing: string;
  url: string;
  committee: string;
  committeeName: string;
  oversees: string;
}

export interface MemberLeads {
  id: string;
  name: string;
  party: string;
  state: string;
  district: string;
  committees: string[];
  leads: Lead[];
}

export interface LeadsReport {
  body: string;
  members: MemberLeads[];
  totals: {
    membersWithLeads: number;
    leads: number;
    trades: number;
    membersSeated: number;
    committeesMapped: number;
  };
}

export async function readLeads(limit = 40): Promise<LeadsReport | null> {
  const db = await getDb();
  if (!db) return null;

  const assignments = await db
    .prepare(
      `SELECT a.entity_id, a.committee_code, a.committee_name,
              e.name, e.affiliation, e.state, e.district
         FROM committee_assignments a
         JOIN entities e ON e.id = a.entity_id
        WHERE a.body_key = ?`,
    )
    .bind(HOUSE_BODY)
    .all();

  const trades = await db
    .prepare(
      `SELECT t.entity_id, t.asset, t.ticker, t.txn_type, t.txn_date, t.amount_label,
              f.doc_id, d.url
         FROM ptr_transactions t
         JOIN ptr_filings f ON f.document_id = t.document_id
         JOIN documents d ON d.id = t.document_id
        WHERE t.entity_id != ''`,
    )
    .all();

  interface Person {
    id: string;
    name: string;
    party: string;
    state: string;
    district: string;
    committees: Map<string, string>;
  }
  const people = new Map<string, Person>();
  for (const row of assignments.results ?? []) {
    const id = String(row.entity_id ?? "");
    if (!id) continue;
    const person =
      people.get(id) ??
      ({
        id,
        name: String(row.name ?? ""),
        party: String(row.affiliation ?? ""),
        state: String(row.state ?? ""),
        district: String(row.district ?? ""),
        committees: new Map<string, string>(),
      } satisfies Person);
    const code = String(row.committee_code ?? "");
    if (jurisdictionFor(code, HOUSE_BODY)) {
      person.committees.set(code, String(row.committee_name ?? code));
    }
    people.set(id, person);
  }

  const byPerson = new Map<string, Lead[]>();
  let tradeCount = 0;
  for (const row of trades.results ?? []) {
    tradeCount += 1;
    const person = people.get(String(row.entity_id ?? ""));
    if (!person?.committees.size) continue;
    for (const [code, name] of person.committees) {
      const jurisdiction = jurisdictionFor(code, HOUSE_BODY);
      if (!jurisdiction) continue;
      if (!matches(String(row.asset ?? ""), String(row.ticker ?? ""), jurisdiction)) continue;
      const lead: Lead = {
        asset: String(row.asset ?? ""),
        ticker: String(row.ticker ?? ""),
        type: String(row.txn_type ?? ""),
        date: String(row.txn_date ?? ""),
        amount: String(row.amount_label ?? ""),
        filing: String(row.doc_id ?? ""),
        url: String(row.url ?? ""),
        committee: code,
        committeeName: name,
        oversees: jurisdiction.oversees,
      };
      byPerson.set(person.id, [...(byPerson.get(person.id) ?? []), lead]);
    }
  }

  const members: MemberLeads[] = [...byPerson.entries()]
    .map(([id, leads]) => {
      const person = people.get(id) as Person;
      return {
        id,
        name: person.name,
        party: person.party,
        state: person.state,
        district: person.district,
        committees: [...person.committees.values()],
        leads,
      };
    })
    .sort((a, b) => b.leads.length - a.leads.length)
    .slice(0, limit);

  const seated = await db
    .prepare("SELECT COUNT(*) AS n FROM universe_members WHERE universe_id = 'house-119'")
    .first<{ n: number }>();

  return {
    body: HOUSE_BODY,
    members,
    totals: {
      membersWithLeads: byPerson.size,
      leads: [...byPerson.values()].reduce((sum, list) => sum + list.length, 0),
      trades: tradeCount,
      membersSeated: Number(seated?.n ?? 0),
      committeesMapped: new Set(
        [...people.values()].flatMap((person) => [...person.committees.keys()]),
      ).size,
    },
  };
}
