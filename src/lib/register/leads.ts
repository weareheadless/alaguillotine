import { getDb } from "@/lib/clock-store";
import {
  HOUSE_BODY,
  UK_COMMONS_BODY,
  jurisdictionFor,
  jurisdictionsFor,
  matches,
  type Jurisdiction,
} from "@/lib/register/sectors";

/**
 * Leads, per body, never pooled.
 *
 * Two facts joined by a published rule: a committee seat, and a disclosure that
 * touches a business that committee plainly oversees. In the US House the
 * disclosure is a trade from a financial filing; in the UK Commons it is a
 * registered interest — a shareholding, a directorship, employment, a donation,
 * a gift, or property. The rule is prose, written in `register/sectors.ts` and
 * scoped to one body, and it is printed beside every row it produces.
 *
 * A lead is not a finding. It says these two things are on the record together;
 * it says nothing about why, and nothing about whether anyone knew.
 */

export type LeadSource = "trade" | "interest";

export interface Lead {
  source: LeadSource;
  /** The asset (a trade) or the member's own register summary (an interest). */
  description: string;
  ticker: string;
  /** Transaction type, or the register category. */
  kind: string;
  date: string;
  amount: string;
  /** "filing 20012345" or "interest 17479". */
  citation: string;
  url: string;
  quote: string;
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

export interface BodyLeads {
  body: string;
  label: string;
  country: string;
  universeId: string;
  sources: LeadSource[];
  /** Every rule for this body, with the committee's published name. */
  rules: Array<{ code: string; name: string; oversees: string; matched: string[] }>;
  members: MemberLeads[];
  totals: {
    membersWithLeads: number;
    leads: number;
    /** Trades parsed, or registered interests read. */
    disclosures: number;
    membersSeated: number;
    committeesMapped: number;
  };
}

interface BodyConfig {
  body: string;
  label: string;
  country: string;
  universeId: string;
  sources: LeadSource[];
}

const BODIES: BodyConfig[] = [
  {
    body: HOUSE_BODY,
    label: "US House of Representatives",
    country: "US",
    universeId: "house-119",
    sources: ["trade"],
  },
  {
    body: UK_COMMONS_BODY,
    label: "UK House of Commons",
    country: "UK",
    universeId: "uk-commons-59",
    sources: ["interest"],
  },
];

interface Seat {
  committee: string;
  name: string;
  rule: Jurisdiction;
}

interface Person {
  id: string;
  name: string;
  party: string;
  state: string;
  district: string;
  seats: Map<string, Seat>;
}

interface Disclosure {
  entityId: string;
  description: string;
  ticker: string;
  kind: string;
  date: string;
  amount: string;
  citation: string;
  url: string;
  quote: string;
  /** What the rule is matched against: an asset name, or a register passage. */
  haystack: string;
  source: LeadSource;
}

function money(value: unknown, currency: string): string {
  const amount = Number(value ?? Number.NaN);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `${currency === "GBP" ? "£" : "$"}${amount.toLocaleString("en-GB", {
    maximumFractionDigits: 2,
  })}`;
}

function ukSummary(quote: string, act: string): string {
  const line = /^Summary:\s*(.+)$/m.exec(quote)?.[1]?.trim();
  if (line) return line;
  // Fall back to the act's middle clause rather than dropping the row.
  const parts = act.split(" — ");
  return parts.length >= 3 ? parts[1] : act;
}

function tradeDisclosure(row: Record<string, unknown>): Disclosure {
  return {
    entityId: String(row.entity_id ?? ""),
    description: String(row.asset ?? ""),
    ticker: String(row.ticker ?? ""),
    kind: String(row.txn_type ?? ""),
    date: String(row.txn_date ?? ""),
    amount: String(row.amount_label ?? ""),
    citation: `filing ${String(row.doc_id ?? "")}`,
    url: String(row.url ?? ""),
    quote: String(row.quote ?? ""),
    haystack: `${String(row.asset ?? "")} ${String(row.ticker ?? "")}`,
    source: "trade",
  };
}

function interestDisclosure(row: Record<string, unknown>): Disclosure {
  const claimId = String(row.claim_id ?? "");
  const interestId = claimId.slice(claimId.lastIndexOf(":") + 1);
  const quote = String(row.quote ?? "");
  const act = String(row.act ?? "");
  return {
    entityId: String(row.entity_id ?? ""),
    description: ukSummary(quote, act),
    ticker: "",
    kind: String(row.mechanism ?? ""),
    date: String(row.act_date ?? ""),
    amount: money(row.amount, String(row.currency ?? "GBP")),
    citation: `interest ${interestId}`,
    url: `https://interests-api.parliament.uk/api/v1/Interests/${interestId}`,
    quote,
    // The register's named fields carry the payer, employer and company; the
    // summary alone would miss a directorship listed only under PayerName.
    haystack: `${act} ${quote}`,
    source: "interest",
  };
}

const TRADES = `SELECT t.entity_id, t.asset, t.ticker, t.txn_type, t.txn_date, t.amount_label,
              f.doc_id, d.url, cd.quote
         FROM ptr_transactions t
         JOIN ptr_filings f ON f.document_id = t.document_id
         JOIN documents d ON d.id = t.document_id
         LEFT JOIN claims c ON c.id = t.claim_id
         LEFT JOIN claim_documents cd ON cd.claim_id = c.id AND cd.document_id = t.document_id
        WHERE t.entity_id != ''`;

const INTERESTS = `SELECT c.id AS claim_id, c.entity_id, c.act, c.mechanism, c.amount,
              c.currency, c.act_date, cd.quote, d.url
         FROM claims c
         JOIN claim_documents cd ON cd.claim_id = c.id
         JOIN documents d ON d.id = cd.document_id
        WHERE c.id LIKE 'claim:uk-%:interest:%'`;

export async function readLeads(limit = 40): Promise<BodyLeads[] | null> {
  const db = await getDb();
  if (!db) return null;

  const assignments = await db
    .prepare(
      `SELECT a.body_key, a.entity_id, a.committee_code, a.committee_name,
              COALESCE(NULLIF(c.parent_code, ''), a.committee_code) AS rule_code,
              e.name, e.affiliation, e.state, e.district
         FROM committee_assignments a
         JOIN entities e ON e.id = a.entity_id
         LEFT JOIN committees c ON c.code = a.committee_code
        WHERE a.body_key IN (?, ?)`,
    )
    .bind(HOUSE_BODY, UK_COMMONS_BODY)
    .all();

  const peopleByBody = new Map<string, Map<string, Person>>();
  for (const config of BODIES) peopleByBody.set(config.body, new Map());

  for (const row of assignments.results ?? []) {
    const body = String(row.body_key ?? "");
    const people = peopleByBody.get(body);
    if (!people) continue;
    const id = String(row.entity_id ?? "");
    if (!id) continue;
    const rule = jurisdictionFor(String(row.rule_code ?? ""), body);
    if (!rule) continue;
    const person =
      people.get(id) ??
      ({
        id,
        name: String(row.name ?? ""),
        party: String(row.affiliation ?? ""),
        state: String(row.state ?? ""),
        district: String(row.district ?? ""),
        seats: new Map<string, Seat>(),
      } satisfies Person);
    person.seats.set(String(row.committee_code ?? ""), {
      committee: String(row.committee_code ?? ""),
      name: String(row.committee_name ?? row.committee_code ?? ""),
      rule,
    });
    people.set(id, person);
  }

  const trades = await db.prepare(TRADES).all();
  const interests = await db.prepare(INTERESTS).all();

  const disclosures = new Map<string, Disclosure[]>();
  for (const config of BODIES) disclosures.set(config.body, []);
  for (const row of trades.results ?? []) {
    disclosures.get(HOUSE_BODY)?.push(tradeDisclosure(row));
  }
  for (const row of interests.results ?? []) {
    disclosures.get(UK_COMMONS_BODY)?.push(interestDisclosure(row));
  }

  const reports: BodyLeads[] = [];
  for (const config of BODIES) {
    const people = peopleByBody.get(config.body) ?? new Map<string, Person>();
    const rows = disclosures.get(config.body) ?? [];
    const byPerson = new Map<string, Lead[]>();

    for (const disclosure of rows) {
      const person = people.get(disclosure.entityId);
      if (!person?.seats.size) continue;
      for (const seat of person.seats.values()) {
        if (!matches(disclosure.haystack, disclosure.ticker, seat.rule)) continue;
        byPerson.set(person.id, [
          ...(byPerson.get(person.id) ?? []),
          {
            source: disclosure.source,
            description: disclosure.description,
            ticker: disclosure.ticker,
            kind: disclosure.kind,
            date: disclosure.date,
            amount: disclosure.amount,
            citation: disclosure.citation,
            url: disclosure.url,
            quote: disclosure.quote,
            committee: seat.committee,
            committeeName: seat.name,
            oversees: seat.rule.oversees,
          },
        ]);
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
          committees: [...new Set([...person.seats.values()].map((seat) => seat.name))],
          leads,
        };
      })
      .sort((a, b) => b.leads.length - a.leads.length)
      .slice(0, limit);

    const seated = await db
      .prepare("SELECT COUNT(*) AS n FROM universe_members WHERE universe_id = ?")
      .bind(config.universeId)
      .first<{ n: number }>();

    const committeeRows = await db
      .prepare("SELECT code, name FROM committees WHERE body_key = ?")
      .bind(config.body)
      .all();
    const committeeNames = new Map<string, string>();
    for (const row of committeeRows.results ?? []) {
      committeeNames.set(String(row.code ?? ""), String(row.name ?? ""));
    }

    reports.push({
      body: config.body,
      label: config.label,
      country: config.country,
      universeId: config.universeId,
      sources: config.sources,
      rules: jurisdictionsFor(config.body).map((rule) => ({
        code: rule.committee,
        name: committeeNames.get(rule.committee) ?? rule.committee,
        oversees: rule.oversees,
        matched: rule.names,
      })),
      members,
      totals: {
        membersWithLeads: byPerson.size,
        leads: [...byPerson.values()].reduce((sum, list) => sum + list.length, 0),
        disclosures: rows.length,
        membersSeated: Number(seated?.n ?? 0),
        committeesMapped: new Set(
          [...people.values()].flatMap((person) => [...person.seats.values()].map((seat) => seat.committee)),
        ).size,
      },
    });
  }

  return reports;
}

export interface EntityLeadReport {
  body: string;
  assignments: Array<{
    committee: string;
    name: string;
    subcommittee: string;
    leadership: string;
    oversees: string;
  }>;
  leads: Lead[];
}

/**
 * The same join for one member, so the per-entity check cannot drift from the
 * page: both call `matches` with the same rules and the same haystack.
 */
export async function readEntityLeads(
  entityId: string,
  body: string,
): Promise<EntityLeadReport | null> {
  const db = await getDb();
  if (!db) return null;

  const assignments = await db
    .prepare(
      `SELECT a.committee_code, a.committee_name, a.subcommittee_code,
              a.subcommittee_name, a.leadership,
              COALESCE(NULLIF(c.parent_code, ''), a.committee_code) AS rule_code
         FROM committee_assignments a
         LEFT JOIN committees c ON c.code = a.committee_code
        WHERE a.entity_id = ? AND a.body_key = ?
        ORDER BY a.committee_name, a.subcommittee_name`,
    )
    .bind(entityId, body)
    .all();

  const seats: Seat[] = [];
  const listed: EntityLeadReport["assignments"] = [];
  for (const row of assignments.results ?? []) {
    const code = String(row.committee_code ?? "");
    const rule = jurisdictionFor(String(row.rule_code ?? code), body);
    listed.push({
      committee: code,
      name: String(row.committee_name ?? code),
      subcommittee: String(row.subcommittee_name ?? ""),
      leadership: String(row.leadership ?? ""),
      oversees: rule?.oversees ?? "",
    });
    if (rule) seats.push({ committee: code, name: String(row.committee_name ?? code), rule });
  }

  let rows: Array<Record<string, unknown>> = [];
  if (body === UK_COMMONS_BODY) {
    const result = await db.prepare(`${INTERESTS} AND c.entity_id = ?`).bind(entityId).all();
    rows = (result.results ?? []) as unknown as Array<Record<string, unknown>>;
  } else if (body === HOUSE_BODY) {
    const result = await db.prepare(`${TRADES} AND t.entity_id = ?`).bind(entityId).all();
    rows = (result.results ?? []) as unknown as Array<Record<string, unknown>>;
  }

  const leads: Lead[] = [];
  for (const row of rows) {
    const disclosure = body === UK_COMMONS_BODY ? interestDisclosure(row) : tradeDisclosure(row);
    for (const seat of seats) {
      if (!matches(disclosure.haystack, disclosure.ticker, seat.rule)) continue;
      leads.push({
        source: disclosure.source,
        description: disclosure.description,
        ticker: disclosure.ticker,
        kind: disclosure.kind,
        date: disclosure.date,
        amount: disclosure.amount,
        citation: disclosure.citation,
        url: disclosure.url,
        quote: disclosure.quote,
        committee: seat.committee,
        committeeName: seat.name,
        oversees: seat.rule.oversees,
      });
    }
  }

  return { body, assignments: listed, leads };
}
