import { extractText, getDocumentProxy } from "unpdf";

/**
 * The engine for state and local money.
 *
 * Federal awards are one API. State subsidies are fifty websites, and the only
 * way this stays honest is to make the source list data rather than a habit:
 * each source is fetched, parsed, matched to a person and written with its
 * instrument and the exact line the figure came from. Adding a state means
 * adding a source, not editing a page.
 *
 * Two distinctions the engine refuses to blur:
 *
 *   money      what the state paid or forgave, in dollars, for a period
 *   approved   a ceiling the state approved, not cash received — it is listed
 *              and never added to the money bars
 *   agreement  a register entry with no figure in it. Recorded as found, and
 *              never turned into a number by inference.
 */

export interface SubsidyHit {
  /** Stable identity of the row within its source. */
  key: string;
  slug: string;
  person: string;
  company: string;
  jurisdiction: string;
  program: string;
  instrument: string;
  /** money | approved | agreement */
  amountKind: "money" | "approved" | "agreement";
  value: number | null;
  display: string;
  year: number | null;
  date: string | null;
  counterparty: string;
  sourceUrl: string;
  quote: string;
}

export interface SubsidySource {
  id: string;
  label: string;
  jurisdiction: string;
  url: string;
  mode: "socrata" | "table" | "pdf-register";
  enabled: boolean;
  /** Why a source is off, shown in the desk rather than hidden. */
  note?: string;
}

/**
 * The company-to-person map is the only place a firm is attached to a name.
 * A company's money is the company's; it is drawn for the person who runs it
 * because that is who the page is about, and it is drawn paler for the same
 * reason.
 */
export const COMPANY_PEOPLE: Array<{ pattern: RegExp; slug: string; person: string; company: string }> = [
  { pattern: /tesla/i, slug: "elon-musk", person: "Elon Musk", company: "Tesla" },
  { pattern: /space\s*exploration|spacex/i, slug: "elon-musk", person: "Elon Musk", company: "SpaceX" },
  { pattern: /palantir/i, slug: "alex-karp", person: "Alex Karp", company: "Palantir" },
  { pattern: /anduril/i, slug: "palmer-luckey", person: "Palmer Luckey", company: "Anduril" },
  { pattern: /bae\s*systems/i, slug: "charles-woodburn", person: "Charles Woodburn", company: "BAE Systems" },
  { pattern: /oracle/i, slug: "larry-ellison", person: "Larry Ellison", company: "Oracle" },
  { pattern: /exxon/i, slug: "darren-woods", person: "Darren Woods", company: "ExxonMobil" },
  { pattern: /occidental\s+petroleum|\boxy\b/i, slug: "vicki-hollub", person: "Vicki Hollub", company: "Occidental" },
];

export const CODES: Record<string, string> = { "nv-goed-abatements": "NV", "ny-esd-approvals": "NY", "tx-ch313-agreements": "TX" };

export function personForCompany(name: string): { slug: string; person: string; company: string } | null {
  for (const m of COMPANY_PEOPLE) if (m.pattern.test(name)) return m;
  return null;
}

export const SOURCES: SubsidySource[] = [
  {
    id: "nv-goed-abatements",
    label: "Nevada GOED — abatements from taxation (NRS 231.0685)",
    jurisdiction: "Nevada",
    url: "https://goed.nv.gov/wp-content/uploads/2025/01/NRS-231.0685-GOED-Biennial-Report-2023-24.pdf",
    mode: "pdf-register",
    enabled: true,
  },
  {
    id: "ny-esd-approvals",
    label: "New York ESD — director approvals, 2012–2017",
    jurisdiction: "New York",
    url: "https://data.ny.gov/resource/ukw4-nsjd.json",
    mode: "socrata",
    enabled: true,
  },
  {
    id: "tx-ch313-agreements",
    label: "Texas Comptroller — Chapter 313 agreements",
    jurisdiction: "Texas",
    url: "https://comptroller.texas.gov/economy/development/prop-tax/ch313/agreement-docs.php",
    mode: "table",
    enabled: true,
    note:
      "The register lists the agreement and the district, not the money. The figure sits in a scanned PDF the comptroller publishes, which is not machine-readable, so the engine records the agreement and says no figure was stated.",
  },
];

const UA = { "User-Agent": "alaguillotine/1.0 (public-record research)" };

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

function money(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${Math.round(amount / 1e3)}K`;
  return `$${Math.round(amount)}`;
}

/**
 * Nevada publishes one line per abatement package, with four abatement columns
 * in a fixed order. A line with all four is fully specified and can be split
 * into four named rows. A line with fewer has had its blanks dropped by the
 * PDF, so the columns it does show cannot be identified — those are counted and
 * refused rather than guessed at.
 */
const NV_COLUMNS = [
  "sales and use tax",
  "modified business tax",
  "personal property tax",
  "real property tax",
];

function parseNevada(text: string): { hits: SubsidyHit[]; refused: number } {
  const hits: SubsidyHit[] = [];
  let refused = 0;
  const line =
    /^(\d{1,4}) ([A-Z][a-z]{2})-(\d{2}) (.+?) ([A-Z]{1,3}) ([NE]) ([A-Za-z .]+?) ([\d,]+)\$ ([\d,]+) ([\d.]+)\$ ([\d,]+)\$(.*)$/gm;
  for (const m of text.matchAll(line)) {
    const [, , mon, yy, companyRaw, , , county, , , , , tail] = m;
    const match = personForCompany(companyRaw);
    if (!match) continue;
    const amounts = [...tail.matchAll(/([\d,]+)\$/g)].map((a) => Number(a[1].replace(/,/g, "")));
    if (amounts.length !== 4) {
      refused += 1;
      continue;
    }
    const year = 2000 + Number(yy);
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(mon) + 1;
    const date = month > 0 ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-01-01`;
    const quote = m[0].replace(/\s+/g, " ").slice(0, 300);
    amounts.forEach((amount, i) => {
      hits.push({
        key: `nv:${year}:${match.company}:${NV_COLUMNS[i]}`,
        slug: match.slug,
        person: match.person,
        company: match.company,
        jurisdiction: `Nevada · ${county.trim()}`,
        program: NV_COLUMNS[i],
        instrument: "abatement",
        amountKind: "approved",
        value: amount,
        display: money(amount),
        year,
        date,
        counterparty: "Nevada Governor's Office of Economic Development",
        sourceUrl: SOURCES[0].url,
        quote,
      });
    });
  }
  return { hits, refused };
}

interface SocrataRow {
  [k: string]: unknown;
}

async function scanSocrata(source: SubsidySource): Promise<SubsidyHit[]> {
  const res = await fetch(`${source.url}?$limit=50000`, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const rows = (await res.json()) as SocrataRow[];
  const hits: SubsidyHit[] = [];
  for (const r of rows) {
    const name = String(r.project_name ?? "");
    const match = personForCompany(name);
    if (!match) continue;
    const value = Number(r.approved_funding ?? 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    const year = Number(r.fiscal_year ?? 0) || null;
    hits.push({
      key: `ny:${r.fiscal_year}:${name}:${r.program}`,
      slug: match.slug,
      person: match.person,
      company: name,
      jurisdiction: `New York · ${String(r.region ?? "")}`.trim(),
      program: String(r.program ?? "ESD approval"),
      instrument: "subsidy",
      amountKind: "money",
      value,
      display: money(value),
      year,
      date: year ? `${year}-06-30` : null,
      counterparty: "Empire State Development",
      sourceUrl: "https://data.ny.gov/d/ukw4-nsjd",
      quote: `${String(r.region ?? "")} · ${name} · ${String(r.program ?? "")} · approved funding ${value} · fiscal year ${String(r.fiscal_year ?? "")}`,
    });
  }
  return hits;
}

/**
 * The Texas register is an index: company, district, application date, first
 * tax year. It holds no figure, so the engine records the agreement with
 * value null and the writer keeps it out of the money rows instead of
 * inventing a number.
 */
async function scanTexas313(source: SubsidySource): Promise<SubsidyHit[]> {
  const html = await getText(source.url);
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const hits: SubsidyHit[] = [];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (cells.length < 6) continue;
    const [district, appNo, entity, appDate, firstYear] = cells;
    const match = personForCompany(entity);
    if (!match) continue;
    const y = Number(firstYear);
    hits.push({
      key: `tx313:${appNo}`,
      slug: match.slug,
      person: match.person,
      company: match.company,
      jurisdiction: `Texas · ${district}`,
      program: `Chapter 313 value limitation, application ${appNo}`,
      instrument: "tax limitation",
      amountKind: "agreement",
      value: null,
      display: "no figure stated",
      year: Number.isFinite(y) ? y : null,
      date: /^\d{2}\/\d{2}\/\d{4}$/.test(appDate)
        ? `${appDate.slice(6)}-${appDate.slice(0, 2)}-${appDate.slice(3, 5)}`
        : null,
      counterparty: district,
      sourceUrl: `${source.url}`,
      quote: `${district} · application ${appNo} · ${entity} · applied ${appDate} · first full tax year ${firstYear}`,
    });
  }
  return hits;
}

export interface SourceReport {
  id: string;
  label: string;
  jurisdiction: string;
  ok: boolean;
  found: number;
  refused: number;
  written: number;
  note: string;
}

export function sourceFor(id: string): SubsidySource | null {
  return SOURCES.find((s) => s.id === id) ?? null;
}

export async function scanSource(source: SubsidySource): Promise<{ hits: SubsidyHit[]; refused: number }> {
  if (source.mode === "socrata") return { hits: await scanSocrata(source), refused: 0 };
  if (source.mode === "table") return { hits: await scanTexas313(source), refused: 0 };
  if (source.mode === "pdf-register") {
    const res = await fetch(source.url, { headers: UA });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return parseNevada(text);
  }
  throw new Error(`unknown mode ${source.mode}`);
}
