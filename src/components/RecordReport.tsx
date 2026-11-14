import Link from "next/link";
import type { DeclarationRow, LedgerEntry, PositionRow } from "@/lib/archive-store";
import type { PersonNumber } from "@/lib/numbers";
import { safeHref } from "@/lib/url";
import { dominantCurrency, formatMoney, moneyOf } from "@/lib/money";

/**
 * The report: one person, read top to bottom.
 *
 * The first version of this was a scatter of dots on a timeline and a list of
 * charges sorted by confidence. Both were unreadable, for the same reason: a
 * reader cannot follow either one. What can be followed is a year — so the
 * money is drawn as bars by year, the office as a tint behind them, and the
 * claims filed under the year they happened.
 *
 * Three quantities stay on three axes. Wealth is a stock, receipts are a flow,
 * a death toll is neither; stacking them is honest, overlaying them is the
 * oldest lie in the form.
 */

const TOLL_KINDS = new Set(["deaths", "displacement", "workers", "layoffs", "emissions"]);

const OUTCOME: Record<string, string> = {
  charged: "charged",
  convicted: "convicted",
  investigated: "investigated",
  settled: "settled",
  sanctioned: "sanctioned",
  no_action: "no action taken",
  blocked: "proceedings blocked",
  unknown: "no proceeding recorded",
};

const GRADE_CHIP: Record<string, string> = {
  A: "border-hypeNeon/60 text-hypeNeon",
  B: "border-sheetWhite/40 text-sheetWhite/80",
  C: "border-chop-border text-chop-muted",
  D: "border-spiteCrimson/60 text-spiteCrimson",
};


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A year with eighteen claims is a wall. Past six, split it by month so the
 * page reads as a sequence rather than a dump; below that, a month heading is
 * just noise on a year that has three items in it.
 */
function groupClaims(claims: LedgerEntry[]): Array<{ label: string; items: LedgerEntry[] }> {
  const sorted = [...claims].sort((a, b) =>
    (b.actDate ?? "").localeCompare(a.actDate ?? ""),
  );
  if (sorted.length <= 6) return [{ label: "", items: sorted }];

  const map = new Map<string, LedgerEntry[]>();
  for (const e of sorted) {
    const key = e.actDate ? e.actDate.slice(0, 7) : "undated";
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()].map(([key, items]) => {
    if (key === "undated") return { label: "no date", items };
    const month = Number(key.slice(5, 7));
    return { label: `${MONTHS[month - 1] ?? key} ${key.slice(0, 4)}`, items };
  });
}

const valueOf = (n: PersonNumber): number => {
  const m = moneyOf(n.value, n.unit);
  if (m) return m.amount;
  const parsed = Number(String(n.display).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** The bars carry what the desk stands behind: a document, or several inquiries. */
const RECEIPT_GRADES = new Set(["A", "B"]);

const yearOf = (n: { actDate?: string | null; year?: number | null }): number | null => {
  if (n.actDate) {
    const y = Number(n.actDate.slice(0, 4));
    if (y) return y;
  }
  return n.year && n.year > 1900 ? n.year : null;
};

export function RecordReport({
  ledger,
  numbers,
  positions,
  declarations,
  now,
}: {
  ledger: LedgerEntry[];
  numbers: PersonNumber[];
  positions: PositionRow[];
  declarations: DeclarationRow[];
  now: Date;
}) {
  const thisYear = now.getUTCFullYear();

  const flows = numbers.filter((n) => !TOLL_KINDS.has(n.kind) && n.kind !== "wealth");
  const tolls = numbers.filter((n) => TOLL_KINDS.has(n.kind));
  const wealth = numbers.filter((n) => n.kind === "wealth");

  // A bar has to be money the desk would defend. Grade C is one investigation
  // and grade D is one allegation; both stay in the list and out of the
  // column. Currencies are never added together, so the chart draws the one
  // most of the entries use and says how many it left out.
  const backed = flows.filter((n) => RECEIPT_GRADES.has(String(n.grade ?? "")));
  const chartCurrency = dominantCurrency(backed.map((n) => n.unit)) ?? "USD";
  const charted = backed.filter((n) => moneyOf(n.value, n.unit)?.currency === chartCurrency);
  const otherCurrency = backed.length - charted.length;
  const money = (v: number): string => formatMoney(v, chartCurrency);
  const wealthCurrency = dominantCurrency(wealth.map((n) => n.unit)) ?? "USD";

  const yearsOfItems = [
    ...ledger.map((e) => yearOf({ actDate: e.actDate, year: e.year })),
    ...flows.map((n) => yearOf(n)),
  ].filter((y): y is number => y != null);

  const firstYear = yearsOfItems.length ? Math.min(...yearsOfItems) : thisYear - 5;
  // The axis is drawn from what the record holds, not from when a job began: a
  // role held since 2002 does not justify twenty-four empty columns.
  const startYear = firstYear;
  const endYear = Math.max(thisYear, ...yearsOfItems);

  const yearList: number[] = [];
  for (let y = startYear; y <= endYear; y += 1) yearList.push(y);

  const heldIn = (year: number): PositionRow[] =>
    positions.filter((p) => {
      const a = Number(p.fromDate.slice(0, 4));
      const b = p.toDate ? Number(p.toDate.slice(0, 4)) : 9999;
      return year >= a && year <= b;
    });

  // Money documented per year. A holding is not a receipt, so wealth rows are
  // left out of the bars and shown on their own.
  const flowByYear = new Map<number, number>();
  for (const n of charted) {
    const y = yearOf(n);
    if (y == null) continue;
    // The bars answer one question: what arrived. A fine is money leaving, a
    // donation is campaign money, and a company's profit is not the person's.
    // Adding any of them produced a column that meant nothing.
    if (n.direction === "out") continue;
    if (n.kind === "fines" || n.kind === "donations") continue;
    if (n.whose === "campaign" || n.whose === "firm" || n.whose === "fund") continue;
    flowByYear.set(y, (flowByYear.get(y) ?? 0) + valueOf(n));
  }
  // Money to a company or fund the person controls is drawn in the same bar,
  // in a paler shade: it is the same year and the same question, and hiding it
  // left the columns empty for exactly the people whose money arrives that way.
  const firmByYear = new Map<number, number>();
  for (const n of charted) {
    const y = yearOf(n);
    if (y == null) continue;
    if (n.direction === "out" || n.kind === "fines" || n.kind === "donations") continue;
    if (n.whose !== "firm" && n.whose !== "fund") continue;
    firmByYear.set(y, (firmByYear.get(y) ?? 0) + valueOf(n));
  }

  const maxFlow = Math.max(
    1,
    ...yearList.map((y) => (flowByYear.get(y) ?? 0) + (firmByYear.get(y) ?? 0)),
  );
  const hasMoney = [...flowByYear.values(), ...firmByYear.values()].some((v) => v > 0);

  const tollByYear = new Map<number, PersonNumber>();
  for (const n of tolls) {
    const y = yearOf(n);
    if (y == null) continue;
    const prev = tollByYear.get(y);
    if (!prev || valueOf(n) > valueOf(prev)) tollByYear.set(y, n);
  }

  // Claims filed by year, and what the state did about them.
  const claimsByYear = new Map<number, LedgerEntry[]>();
  for (const e of ledger) {
    const y = yearOf({ actDate: e.actDate, year: e.year });
    if (y == null) continue;
    const list = claimsByYear.get(y) ?? [];
    list.push(e);
    claimsByYear.set(y, list);
  }

  const maxClaims = Math.max(1, ...yearList.map((y) => claimsByYear.get(y)?.length ?? 0));

  const undated = ledger.filter((e) => yearOf({ actDate: e.actDate, year: e.year }) == null);
  const undatedMoney = flows.filter((n) => yearOf(n) == null);

  const thin = ledger.filter((e) => e.grade === "D").length;
  const pending = ledger.filter((e) => e.status === "pending").length;
  const practised = ledger.filter((e) =>
    ["charged", "convicted", "settled", "sanctioned"].includes(e.outcome),
  ).length;
  const investigated = ledger.filter((e) => e.outcome === "investigated").length;
  const untouched = ledger.length - practised - investigated;

  const wealthPoints = wealth
    .map((n) => ({ n, y: yearOf(n), v: valueOf(n) }))
    .filter((p): p is { n: PersonNumber; y: number; v: number } => p.y != null && p.v > 0)
    .sort((a, b) => a.y - b.y);

  const maxWealth = Math.max(1, ...wealthPoints.map((p) => p.v));
  const tollTotal = tolls.length;

  // What the page could not previously say: the receipts that landed while the
  // office was held, and those that landed just after it ended. These are
  // counts, not a verdict — but they are the reason the page exists, and
  // leaving them to be reassembled from a list was the failure.
  const statePositions = positions.filter((p) => p.kind !== "firm");
  const withinTerm = (p: PositionRow, iso: string): boolean => {
    const a = p.fromDate;
    const b = p.toDate ?? "9999-12-31";
    return iso >= a && iso <= b;
  };
  const dateOf = (n: PersonNumber): string | null =>
    n.actDate ?? (n.year ? `${n.year}-07-01` : null);

  const isReceipt = (n: PersonNumber): boolean =>
    n.direction !== "out" &&
    n.kind !== "fines" &&
    n.kind !== "donations" &&
    n.whose !== "campaign" &&
    n.whose !== "firm" &&
    n.whose !== "fund";

  const duringOffice = charted.filter((n) => {
    const at = dateOf(n);
    if (!at || !isReceipt(n)) return false;
    return statePositions.some((p) => withinTerm(p, at));
  });
  const shortlyAfter = charted.filter((n) => {
    const at = dateOf(n);
    if (!at || !isReceipt(n)) return false;
    return statePositions.some((p) => {
      if (!p.toDate) return false;
      if (at <= p.toDate) return false;
      const years = (Number(at.slice(0, 4)) - Number(p.toDate.slice(0, 4))) + 0;
      return years >= 0 && years <= 2;
    });
  });
  const sumOf = (rows: PersonNumber[]): number => rows.reduce((t, n) => t + valueOf(n), 0);

  const assetStatements = declarations
    .filter((d) => d.kind === "assets" && d.net != null)
    .sort((a, b) => (a.periodTo ?? "").localeCompare(b.periodTo ?? ""));
  const incomeStatements = declarations.filter((d) => d.kind === "income" && d.income != null);
  const declaredIncome = incomeStatements.reduce((t, d) => t + (d.income ?? 0), 0);
  const firstStatement = assetStatements[0];
  const lastStatement = assetStatements[assetStatements.length - 1];

  const moneyIn = (v: number, currency: string): string => {
    const sign = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
    if (Math.abs(v) >= 1e6) return `${sign}${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}m`;
    if (Math.abs(v) >= 1e3) return `${sign}${Math.round(v / 1e3)}k`;
    return `${sign}${Math.round(v)}`;
  };

  const activeYears = yearList.filter(
    (y) => (claimsByYear.get(y)?.length ?? 0) > 0 || flowByYear.has(y) || heldIn(y).length > 0,
  );

  return (
    <>
    {statePositions.length > 0 ? (
      <section className="mt-8 border border-chop-border bg-white/[0.02] p-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
            the pattern
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
            counts, not a verdict
          </span>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-hypeNeon/80">
              while in office
            </p>
            <p className="mt-0.5 font-mono text-[19px] font-black tabular-nums text-sheetWhite">
              {duringOffice.length ? money(sumOf(duringOffice)) : "none"}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
              {duringOffice.length
                ? `${duringOffice.length} payment${duringOffice.length === 1 ? "" : "s"} on the record`
                : "no payment on this record"}
            </p>
            <ul className="mt-1 space-y-0.5">
              {duringOffice.slice(0, 3).map((n, i) => (
                <li key={`d-${n.label}-${i}`} className="text-[11px] leading-snug text-sheetWhite/80">
                  <span className="font-mono font-bold text-spiteCrimson">{n.display}</span>{" "}
                  {n.counterparty || n.label}
                  {n.actDate ? (
                    <span className="text-chop-muted"> · {n.actDate}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
              within two years after
            </p>
            <p className="mt-0.5 font-mono text-[19px] font-black tabular-nums text-sheetWhite">
              {shortlyAfter.length ? money(sumOf(shortlyAfter)) : "none"}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
              {shortlyAfter.length
                ? `${shortlyAfter.length} payment${shortlyAfter.length === 1 ? "" : "s"} on the record`
                : "no payment on this record"}
            </p>
            <ul className="mt-1 space-y-0.5">
              {shortlyAfter.slice(0, 3).map((n, i) => (
                <li key={`a-${n.label}-${i}`} className="text-[11px] leading-snug text-sheetWhite/80">
                  <span className="font-mono font-bold text-spiteCrimson">{n.display}</span>{" "}
                  {n.counterparty || n.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
              what was done about it
            </p>
            <p className="mt-0.5 font-mono text-[19px] font-black tabular-nums text-spiteCrimson">
              {practised}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
              charged, convicted or settled of {ledger.length} claims
            </p>
            <p className="mt-1 text-[11px] leading-snug text-chop-muted">
              {investigated} investigated without a charge · {untouched} with no proceeding
              recorded
            </p>
          </div>
        </div>

        <p className="mt-3 border-t border-chop-border pt-2 font-mono text-[9px] leading-relaxed text-chop-muted">
          The coincidence is the record&apos;s; the meaning is yours. Where this page can name the
          decision a payer got for its money, it does, in the claim beside it — and where it cannot,
          it says the payment arrived and stops there.
        </p>
      </section>
    ) : null}

    <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-8">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="border border-chop-border bg-white/[0.02] p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
            what this page says, in counts
          </p>
          <dl className="mt-2 space-y-1.5">
            {[
              [ledger.length, "claims on the record"],
              [thin, "are a single unverified allegation"],
              [untouched, "carry no recorded proceeding"],
              [flows.length, flows.length === 1 ? "money entry" : "money entries"],
              [tollTotal, "tolls attributed"],
            ].map(([n, label]) => (
              <div key={String(label)} className="flex items-baseline gap-2">
                <dt className="w-7 shrink-0 text-right font-mono text-[13px] font-black tabular-nums text-sheetWhite">
                  {n}
                </dt>
                <dd className="font-mono text-[10px] leading-snug text-chop-muted">{label}</dd>
              </div>
            ))}
          </dl>
          {pending > 0 ? (
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-hypeNeon/80">
              {pending} filed, awaiting review
            </p>
          ) : null}
        </div>

        {assetStatements.length > 0 ? (
          <div className="border border-chop-border bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
              declared net assets
            </p>
            <ul className="mt-1.5 space-y-1">
              {assetStatements.map((d, i) => (
                <li key={d.id} className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[14px] font-black tabular-nums text-spiteCrimson">
                    {moneyIn(d.net ?? 0, d.currency)}
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-chop-muted">
                    {d.periodTo?.slice(0, 4)}
                    {i === 0 ? " · entering" : i === assetStatements.length - 1 ? " · leaving" : ""}
                  </span>
                </li>
              ))}
            </ul>
            {firstStatement && lastStatement && firstStatement.id !== lastStatement.id ? (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-sheetWhite/85">
                {moneyIn((lastStatement.net ?? 0) - (firstStatement.net ?? 0), lastStatement.currency)}{" "}
                over the period
              </p>
            ) : null}
            {declaredIncome > 0 ? (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
                {moneyIn(declaredIncome, incomeStatements[0].currency)} income declared
              </p>
            ) : null}
            <a
              href={safeHref(assetStatements[0].sourceUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-mono text-[8.5px] uppercase tracking-[0.14em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
            >
              the filing ↗
            </a>
            <p className="mt-1.5 font-mono text-[8.5px] leading-relaxed text-chop-muted">
              Filed with the state at entry and at exit. A figure is a figure here, not an estimate.
            </p>
          </div>
        ) : null}

        {wealthPoints.length > 0 ? (
          <div className="border border-chop-border bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
              reported wealth
            </p>
            {wealthPoints.length > 1 && wealthPoints[wealthPoints.length - 1].y > wealthPoints[0].y ? (
              <>
                <WealthStrip points={wealthPoints} max={maxWealth} />
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-sheetWhite/80">
                  {formatMoney(wealthPoints[wealthPoints.length - 1].v - wealthPoints[0].v, wealthCurrency)} between{" "}
                  {wealthPoints[0].y} and {wealthPoints[wealthPoints.length - 1].y}
                </p>
              </>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {wealthPoints.map((p) => (
                  <li key={`${p.y}-${p.v}`} className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[13px] font-black tabular-nums text-spiteCrimson">
                      {p.n.display}
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-chop-muted">
                      {p.y}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 font-mono text-[8.5px] leading-relaxed text-chop-muted">
              {wealthPoints.length > 1 && wealthPoints[wealthPoints.length - 1].y > wealthPoints[0].y
                ? "A step, not a slope: the last published figure holds until the next one, and the shaded band is the path nobody published."
                : "Published estimates, not a series. Two figures in one year are two facts, not a trend."}
            </p>
          </div>
        ) : null}

        <div className="border border-chop-border bg-white/[0.02] p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
            grades
          </p>
          <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-chop-muted">
            A document or admission · B several investigations · C one investigation · D a single
            allegation, which scores nothing.
          </p>
        </div>
      </aside>

      <div>
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
              the record, by year
            </h2>
            <span className="font-mono text-[9px] tabular-nums text-chop-muted">
              {startYear}–{endYear}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-chop-border/70 py-2 font-mono text-chop-muted sm:grid-cols-3">
            {hasMoney ? (
              <div>
                <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-sheetWhite/85">
                  <span className="h-2 w-2 shrink-0 bg-spiteCrimson/75" />
                  money
                </p>
                <p className="mt-0.5 text-[9px] tabular-nums">full column = {money(maxFlow)}</p>
                <p className="mt-0.5 text-[8px] leading-snug">
                  solid: paid to him · pale: paid to a company he runs · grade A or B only
                  {otherCurrency > 0
                    ? ` · ${otherCurrency} entr${otherCurrency === 1 ? "y" : "ies"} in another currency are listed, not drawn`
                    : ""}
                </p>
              </div>
            ) : null}
            <div>
              <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-sheetWhite/85">
                <span className="h-2 w-2 shrink-0 bg-sheetWhite/30" />
                claims
              </p>
              <p className="mt-0.5 text-[9px] tabular-nums">full column = {maxClaims}</p>
              <p className="mt-0.5 text-[8px] leading-snug">filed against him that year</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-sheetWhite/85">
                <span className="h-2 w-2 shrink-0 bg-hypeNeon/25" />
                office
              </p>
              <p className="mt-0.5 text-[9px]">tinted column = a term held</p>
              <p className="mt-0.5 text-[8px] leading-snug">the bar is the year, not the term</p>
            </div>
          </div>

          <div className="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-[3px]">
            {yearList.map((y) => {
              const v = flowByYear.get(y) ?? 0;
              const claims = claimsByYear.get(y)?.length ?? 0;
              const held = heldIn(y);
              const state = held.some((p) => p.kind !== "firm");
              const f = firmByYear.get(y) ?? 0;
              const total = v + f;
              const mh = total > 0 ? Math.max(4, (total / maxFlow) * 100) : 0;
              const ch = claims > 0 ? Math.max(4, (claims / maxClaims) * 100) : 0;
              return (
                <div key={y} className="relative flex flex-col">
                  {held.length > 0 ? (
                    <div
                      className={`absolute inset-0 ${
                        state
                          ? "bg-hypeNeon/[0.07] border-t border-hypeNeon/40"
                          : "bg-sheetWhite/[0.04] border-t border-sheetWhite/20"
                      }`}
                    />
                  ) : null}

                  {hasMoney ? (
                    <div className="relative flex h-24 items-end justify-center pt-4">
                      {total > 0 ? (
                        <>
                          <div
                            className="flex w-[62%] flex-col justify-end"
                            style={{ height: `${mh}%` }}
                            title={`${money(v)} to him, ${money(f)} to a company or fund he controls, ${y}`}
                          >
                            {f > 0 ? (
                              <div className="w-full bg-spiteCrimson/30" style={{ height: `${(f / total) * 100}%` }} />
                            ) : null}
                            {v > 0 ? (
                              <div className="w-full bg-spiteCrimson/80" style={{ height: `${(v / total) * 100}%` }} />
                            ) : null}
                          </div>
                          <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] tabular-nums text-sheetWhite/90">
                            {money(total)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="relative flex h-16 items-end justify-center border-t border-chop-border/70 pt-3.5">
                    {claims > 0 ? (
                      <>
                        <div
                          className="w-[62%] bg-sheetWhite/30"
                          style={{ height: `${ch}%` }}
                          title={`${claims} claims filed for ${y}`}
                        />
                        <span className="absolute left-1/2 top-0 -translate-x-1/2 font-mono text-[8px] tabular-nums text-chop-muted">
                          {claims}
                        </span>
                      </>
                    ) : null}
                    {tollByYear.has(y) ? (
                      <span
                        className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-warning"
                        title={`${tollByYear.get(y)?.display} — ${tollByYear.get(y)?.label}`}
                      />
                    ) : null}
                  </div>

                  <span className="mt-1 text-center font-mono text-[8px] tabular-nums text-chop-muted">
                    {String(y).slice(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-1 font-mono text-[8.5px] leading-relaxed text-chop-muted">
            A quiet column means nothing was collected for that year, not that nothing happened:
            the passes look at recent coverage, and history has to be asked for by name. Amber dot
            = a toll attributed that year, on its own scale, never the money axis.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="border-b border-chop-border pb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
            the record, year by year
          </h2>

          <ol className="mt-2">
            {activeYears
              .slice()
              .reverse()
              .map((y) => {
                const claims = claimsByYear.get(y) ?? [];
                const held = heldIn(y);
                const yearFlows = flows.filter((n) => yearOf(n) === y);
                const yearTolls = tolls.filter((n) => yearOf(n) === y);
                const touch = claims.filter((e) =>
                  ["charged", "convicted", "settled", "sanctioned", "investigated"].includes(
                    e.outcome,
                  ),
                ).length;
                return (
                  <li key={y} className="border-b border-chop-border py-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-[15px] font-black tabular-nums text-sheetWhite">
                        {y}
                      </span>
                      {held.length > 0 ? (
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-hypeNeon/80">
                          {held.map((p) => p.role).join(" · ")}
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
                          no office held
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
                        {claims.length} claim{claims.length === 1 ? "" : "s"} · {touch} proceeding
                        {touch === 1 ? "" : "s"}
                      </span>
                    </div>

                    {yearFlows.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {yearFlows.map((n, i) => (
                          <li
                            key={`f-${n.kind}-${n.label}-${i}`}
                            className="flex flex-wrap items-baseline gap-x-2"
                          >
                            <span className="font-mono text-[13px] font-black tabular-nums text-spiteCrimson">
                              {n.display}
                            </span>
                            <span className="text-[12px] leading-snug text-sheetWhite/85">
                              {n.label}
                              {n.counterparty ? (
                                <span className="text-chop-muted"> · {n.counterparty}</span>
                              ) : null}
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
                              {n.instrument || n.kind}
                              {n.capacity ? ` · as ${n.capacity}` : ""}
                              {n.grade ? ` · ${n.grade}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {yearTolls.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {yearTolls.map((n, i) => (
                          <li
                            key={`t-${n.kind}-${n.label}-${i}`}
                            className="flex flex-wrap items-baseline gap-x-2"
                          >
                            <span className="font-mono text-[12px] font-bold tabular-nums text-warning">
                              {n.display}
                            </span>
                            <span className="text-[11px] leading-snug text-chop-muted">
                              {n.label}
                              {n.qualifier ? ` · ${n.qualifier}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {claims.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {groupClaims(claims).map((group) => (
                          <li key={group.label || "all"} className="list-none">
                            {group.label ? (
                              <p className="mb-1 font-mono text-[8.5px] uppercase tracking-[0.2em] text-chop-muted/80">
                                {group.label} · {group.items.length}
                              </p>
                            ) : null}
                            <ul className="space-y-2">
                              {group.items.map((e) => (
                          <li key={e.id || e.act} className="border-l border-chop-border pl-2.5">
                            <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[8.5px] uppercase tracking-[0.15em] text-chop-muted">
                              {e.grade ? (
                                <span className={`border px-1 ${GRADE_CHIP[e.grade] ?? GRADE_CHIP.C}`}>
                                  {e.grade}
                                </span>
                              ) : null}
                              <span>{e.category}</span>
                              {e.place ? <span>· {e.place}</span> : null}
                              <span
                                className={
                                  e.outcome === "unknown" || e.outcome === "no_action"
                                    ? "text-spiteCrimson/80"
                                    : "text-hypeNeon/80"
                                }
                              >
                                {OUTCOME[e.outcome] ?? e.outcome}
                              </span>
                              {e.status === "pending" ? (
                                <span className="border border-hypeNeon/40 px-1 text-hypeNeon/80">
                                  awaiting review
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[12.5px] leading-snug text-sheetWhite/90">
                              {e.act}
                            </p>
                            <div className="mt-0.5 flex flex-wrap gap-2.5">
                              {e.id ? (
                                <Link
                                  href={`/archive/claim/${encodeURIComponent(e.id)}`}
                                  className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-spiteCrimson/90 underline decoration-chop-border underline-offset-2 hover:text-spiteCrimson"
                                >
                                  evidence ↗
                                </Link>
                              ) : null}
                              {e.sources.slice(0, 2).map((url) => (
                                <a
                                  key={url}
                                  href={safeHref(url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                                >
                                  source ↗
                                </a>
                              ))}
                            </div>
                          </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
          </ol>

          {undated.length > 0 || undatedMoney.length > 0 ? (
            <div className="mt-4 border border-chop-border bg-white/[0.02] p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
                no date to place {undated.length + undatedMoney.length} entry
                {undated.length + undatedMoney.length === 1 ? "" : "s"} on
              </p>
              <p className="mt-1 font-mono text-[9px] leading-relaxed text-chop-muted">
                Only the year is known, or less. They stay on the page and out of the chart,
                because a mark needs a position in time.
              </p>
              <ul className="mt-2 space-y-1">
                {undated.map((e) => (
                  <li key={e.id || e.act} className="flex items-baseline gap-2">
                    <span className="font-mono text-[9px] tabular-nums text-chop-muted">
                      {e.year || "—"}
                    </span>
                    <span className="text-[11.5px] leading-snug text-sheetWhite/80">{e.act}</span>
                  </li>
                ))}
                {undatedMoney.map((n, i) => (
                  <li key={`um-${n.label}-${i}`} className="flex items-baseline gap-2">
                    <span className="font-mono text-[9px] tabular-nums text-chop-muted">
                      {n.year || "—"}
                    </span>
                    <span className="text-[11.5px] leading-snug text-sheetWhite/80">
                      <span className="font-mono font-bold text-spiteCrimson">{n.display}</span>{" "}
                      {n.counterparty || n.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
    </>
  );
}

/** Wealth as a step with the unpublished path shaded underneath. */
function WealthStrip({
  points,
  max,
}: {
  points: Array<{ y: number; v: number; n: PersonNumber }>;
  max: number;
}) {
  const first = points[0].y;
  const last = points[points.length - 1].y;
  const span = Math.max(1, last - first);
  const W = 240;
  const H = 64;
  const x = (y: number) => 6 + ((y - first) / span) * (W - 12);
  const y = (v: number) => H - 8 - (v / max) * (H - 20);

  const path = points
    .map((p, i) => {
      if (i === 0) return `M${x(p.y)} ${y(p.v)}`;
      const prev = points[i - 1];
      return `H${x(p.y)} V${y(p.v)}`;
    })
    .join(" ");

  const band = `${path} L${x(last)} ${H - 8} L${x(first)} ${H - 8} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mt-1.5 block" role="img" aria-label="Reported wealth, published points joined as steps">
      <path d={band} fill="color-mix(in srgb, var(--spiteCrimson, #e0344b) 12%, transparent)" />
      <path d={path} fill="none" stroke="#e0344b" strokeWidth="1.4" strokeDasharray="4 2.5" />
      {points.map((p) => (
        <circle key={p.y} cx={x(p.y)} cy={y(p.v)} r="2.6" fill="#e0344b" />
      ))}
      {points.map((p, i) => (
        <text
          key={`l-${p.y}`}
          x={x(p.y)}
          y={i % 2 === 0 ? y(p.v) - 5 : y(p.v) + 10}
          textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
          fontFamily="var(--font-mono, monospace)"
          fontSize="7"
          fill="var(--muted-foreground, #8a8a8a)"
        >
          {p.y}
        </text>
      ))}
    </svg>
  );
}
