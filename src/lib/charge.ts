import type { PositionRow } from "@/lib/archive-store";
import type { PersonNumber } from "@/lib/numbers";

/**
 * The charge, said in one sentence the reader can check.
 *
 * "Why is this name on the line" cannot be answered by a tagline from the
 * newest headline. It is answered by the largest dated payment on the record,
 * who paid it, and whether it landed while the office was held. When nothing
 * landed, the page says that too — a cleared name is a finding, not a gap.
 *
 * Nothing here is summed across currencies, and nothing here infers a motive.
 */

const TOLL_KINDS = new Set(["deaths", "displacement", "workers", "layoffs", "emissions"]);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Only a real date counts as dated. A figure that carries a year and nothing
 * else is not put on a day it never claimed: it is counted, and said to be
 * undated.
 */
function dateOf(n: PersonNumber): string | null {
  return n.actDate ?? null;
}

/**
 * Money the state does not buy a thing with: a grant, a subsidy, a credit the
 * law forces someone to buy, an abatement. It counts as a receipt and it is
 * not procurement, and the sentence says which is which.
 */
const SOFT_INSTRUMENTS = new Set(["subsidy", "grant", "credit", "abatement", "loan", "bailout"]);

/** Money arriving at the person, or at a company or fund they run. */
function isReceipt(n: PersonNumber): boolean {
  if (n.direction === "out") return false;
  if (TOLL_KINDS.has(n.kind) || n.kind === "wealth") return false;
  if (n.kind === "fines" || n.kind === "donations") return false;
  if (n.whose === "campaign" || n.whose === "state") return false;
  // An approved abatement is a ceiling, not a payment.
  if (n.qualifier === "approved") return false;
  return true;
}

function withinTerm(p: PositionRow, iso: string): boolean {
  const to = p.toDate ?? "9999-12-31";
  return iso >= p.fromDate && iso <= to;
}

function withinTwoYearsAfter(p: PositionRow, iso: string): boolean {
  if (!p.toDate) return false;
  if (iso <= p.toDate) return false;
  const gap = Number(iso.slice(0, 4)) - Number(p.toDate.slice(0, 4));
  return gap >= 0 && gap <= 2;
}

export interface Charge {
  /** The sentence a reader can verify, or the sentence that clears. */
  headline: string;
  /** What the count behind it is made of. */
  support: string;
}

export function chargeFor({
  name,
  numbers,
  positions,
}: {
  name: string;
  numbers: PersonNumber[];
  positions: PositionRow[];
}): Charge {
  const receipts = numbers.filter(isReceipt);
  const dated = receipts
    .map((n) => ({ n, at: dateOf(n) }))
    .filter((r): r is { n: PersonNumber; at: string } => r.at != null)
    .sort((a, b) => (b.n.value ?? 0) - (a.n.value ?? 0));

  if (dated.length === 0) {
    if (receipts.length > 0) {
      return {
        headline: `No payment with a date is on this record — ${receipts.length} figure${receipts.length === 1 ? "" : "s"} carr${receipts.length === 1 ? "ies" : "y"} only a year.`,
        support:
          "A year is not a date. Until each of those carries the day it happened, the page cannot say whether it landed in office, and it does not guess.",
      };
    }
    return {
      headline: `No payment to ${name}, or to a company or fund ${name} runs, is on this record.`,
      support:
        "The charge would be that the office paid. Nothing here shows a payment at all, so what this page holds is claims — and a claim is not a receipt.",
    };
  }

  const soft = receipts.filter((n) => SOFT_INSTRUMENTS.has(String(n.instrument ?? "").toLowerCase()));
  const softLine =
    soft.length === 0
      ? ""
      : ` ${soft.length} of ${receipts.length} ${soft.length === 1 ? "is" : "are"} subsidy, grant or a credit sale the law compels, not procurement.`;

  const top = dated[0];
  const payer = top.n.counterparty?.trim();
  const headline = `${top.n.display}${payer ? ` from ${payer}` : ""}, dated ${longDate(top.at)} — the largest payment this record holds.`;

  const statePositions = positions.filter((p) => p.kind !== "firm");
  const toFirm = receipts.filter((n) => n.whose === "firm" || n.whose === "fund").length;

  if (statePositions.length === 0) {
    return {
      headline,
      support: `${dated.length} dated payment${dated.length === 1 ? "" : "s"} ${dated.length === 1 ? "is" : "are"} on this record${
        receipts.length - dated.length > 0
          ? ` (${receipts.length - dated.length} more carr${receipts.length - dated.length === 1 ? "ies" : "y"} only a year)`
          : ""
      }. ${
        toFirm === 0
          ? "All of it went to the person named."
          : `${toFirm} of ${receipts.length} went to a company or fund ${name} runs, and ${toFirm === 1 ? "is" : "are"} drawn paler for that reason: that money is the company's, not ${name}'s.`
      }${softLine}`,
    };
  }

  const during = dated.filter((r) => statePositions.some((p) => withinTerm(p, r.at))).length;
  const after = dated.filter(
    (r) => !statePositions.some((p) => withinTerm(p, r.at)) && statePositions.some((p) => withinTwoYearsAfter(p, r.at)),
  ).length;
  const outside = dated.length - during - after;

  const count = `${dated.length} dated payment${dated.length === 1 ? "" : "s"} on this record`;
  let split: string;
  if (during > 0 && after > 0) {
    split = `${during} landed while the office was held, ${after} within two years of leaving`;
  } else if (during > 0) {
    split = `${during} landed while the office was held, ${after === 0 ? "none within two years of leaving" : `${after} within two years of leaving`}`;
  } else if (after > 0) {
    split = `none landed while the office was held; ${after} did within two years of leaving`;
  } else {
    split = `none landed while the office was held or within two years of leaving it — on this record the money came before the job, not after`;
  }

  return {
    headline,
    support: `${count}: ${split}, ${outside} outside both. ${
      toFirm === 0
        ? ""
        : `${toFirm} went to a company or fund ${name} runs; ${toFirm === 1 ? "it is" : "they are"} drawn paler, because that money is the company's, not ${name}'s.`
    }${softLine}`.trim(),
  };
}
