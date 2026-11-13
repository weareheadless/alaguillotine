/**
 * Surnames into people.
 *
 * The clerk's roll call prints "Rogers (AL)" — a surname, a state, and an ID.
 * A ledger cannot charge a surname, and a language model must not be asked to
 * guess which Rogers voted. The public legislators dataset carries the bioguide
 * ID against a full name, so the roll's own ID is the join: no inference, no
 * model, no ambiguity.
 */

export interface Member {
  name: string;
  state: string;
  party: string;
  district: string;
}

const SOURCE =
  "https://unitedstates.github.io/congress-legislators/legislators-current.json";

interface RawLegislator {
  id?: { bioguide?: string };
  name?: { official_full?: string; first?: string; last?: string };
  terms?: Array<{ type?: string; state?: string; party?: string; district?: number }>;
}

export async function loadMembers(): Promise<Map<string, Member>> {
  const out = new Map<string, Member>();
  try {
    const res = await fetch(SOURCE, { redirect: "follow" });
    if (!res.ok) return out;
    const rows = (await res.json()) as RawLegislator[];
    for (const row of rows) {
      const id = row.id?.bioguide;
      if (!id) continue;
      const term = row.terms?.[row.terms.length - 1] ?? {};
      // The official name is the canonical one: "C. Scott Franklin" is a
      // person, "C. Franklin" is a data artefact. Middle initials cost nothing
      // in the name, and the slug falls back to first-and-last for the URL.
      const name =
        row.name?.official_full ||
        [row.name?.first, row.name?.last].filter(Boolean).join(" ").trim();
      if (!name) continue;
      out.set(id, {
        name,
        state: String(term.state ?? ""),
        party: String(term.party ?? ""),
        district: term.district ? String(term.district) : "",
      });
    }
  } catch {
    /* an empty map means no names this run, not a wrong name */
  }
  return out;
}
