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
  // An approved abatement is a ceiling the state granted, not cash received.
  // It is listed with its qualifier and kept off the money axis.
  const charted = backed.filter(
    (n) => moneyOf(n.value, n.unit)?.currency === chartCurrency && n.qualifier !== "approved",
  );
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

  // The same set the charge and the bars use: money that arrived, at the person
  // or at a company they run. Splitting the definition between the sentence at
  // the top and the count in the middle let them contradict each other on the
  // same screen.
  const isReceipt = (n: PersonNumber): boolean =>
    n.direction !== "out" &&
    n.kind !== "fines" &&
    n.kind !== "donations" &&
    n.whose !== "campaign";

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
                ? `${duringOffice.length} payment${duringOffice.length === 1 ? "" : "s"} on the record${
                    duringOffice.filter((n) => n.whose === "firm" || n.whose === "fund").length
                      ? ` · ${duringOffice.filter((n) => n.whose === "firm" || n.whose === "fund").length} to a company he runs`
                      : ""
                  }`
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
                ? `${shortlyAfter.length} payment${shortlyAfter.length === 1 ? "" : "s"} on the record${
                    shortlyAfter.filter((n) => n.whose === "firm" || n.whose === "fund").length
                      ? ` · ${shortlyAfter.filter((n) => n.whose === "firm" || n.whose === "fund").length} to a company he runs`
                      : ""
                  }`
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

    <section className="mt-8" id="chart">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
          the record, by year
        </h2>
        <span className="font-mono text-[10px] tabular-nums text-chop-muted">
          {startYear}–{endYear}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] text-chop-muted">
        {hasMoney ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 bg-spiteCrimson/80" />
            money to him
          </span>
        ) : null}
        {hasMoney ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 bg-spiteCrimson/30" />
            to a company he runs
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-sheetWhite/30" />
          claims filed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-hypeNeon/25" />
          office held
        </span>
        {hasMoney ? (
          <span className="ml-auto text-[9px] uppercase tracking-[0.12em]">
            grade A or B only
            <span className="hidden sm:inline"> · the figure is on every bar</span>
          </span>
        ) : (
          <span className="ml-auto text-[9px] uppercase tracking-[0.12em]">
            no money on this record that clears grade B
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <div className="w-12 shrink-0 font-mono text-[9px] tabular-nums text-chop-muted">
          <div className="relative" style={{ height: hasMoney ? 168 : 0 }}>
            {hasMoney ? (
              <>
                <span className="absolute right-0 top-0 -translate-y-1/3">{money(maxFlow)}</span>
                <span className="absolute right-0 top-1/2 -translate-y-1/2">
                  {money(maxFlow / 2)}
                </span>
              </>
            ) : null}
          </div>
          <div className="relative" style={{ height: 64 }}>
            <span className="absolute right-0 top-3">{maxClaims}</span>
            <span className="absolute bottom-0 right-0 -translate-y-1/3">0</span>
          </div>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: hasMoney ? 168 : 0 }}>
            <div className="absolute inset-x-0 top-0 border-t border-chop-border/50" />
            <div className="absolute inset-x-0 top-1/2 border-t border-chop-border/25" />
            <div className="absolute inset-x-0 bottom-0 border-t border-chop-border/50" />
          </div>

          <div className="relative grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-px sm:gap-[3px]">
            {yearList.map((y) => {
              const v = flowByYear.get(y) ?? 0;
              const claims = claimsByYear.get(y)?.length ?? 0;
              const held = heldIn(y);
              const state = held.some((p) => p.kind !== "firm");
              const f = firmByYear.get(y) ?? 0;
              const total = v + f;
              const mh = total > 0 ? Math.max(2, (total / maxFlow) * 100) : 0;
              const ch = claims > 0 ? Math.max(3, (claims / maxClaims) * 100) : 0;
              return (
                <div key={y} className="relative flex flex-col">
                  {state ? (
                    <div className="absolute inset-0 border-t border-hypeNeon/40 bg-hypeNeon/[0.07]" />
                  ) : null}

                  {hasMoney ? (
                    <div className="relative flex items-end justify-center pt-7" style={{ height: hasMoney ? 168 : 0 }}>
                      {total > 0 ? (
                        <>
                          <div
                            className="flex w-[68%] flex-col justify-end"
                            style={{ height: `${mh}%` }}
                            title={`${money(v)} to him, ${money(f)} to a company or fund he controls, ${y}`}
                          >
                            {f > 0 ? (
                              <div
                                className="w-full bg-spiteCrimson/30"
                                style={{ height: `${(f / total) * 100}%` }}
                              />
                            ) : null}
                            {v > 0 ? (
                              <div
                                className="w-full bg-spiteCrimson/80"
                                style={{ height: `${(v / total) * 100}%` }}
                              />
                            ) : null}
                          </div>
                          <span className="absolute left-1/2 top-2 hidden -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tabular-nums text-sheetWhite/90 sm:block">
                            {money(total)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    className="relative flex items-end justify-center border-t border-chop-border/70 pt-3.5"
                    style={{ height: 64 }}
                  >
                    {claims > 0 ? (
                      <>
                        <div
                          className="w-[68%] bg-sheetWhite/30"
                          style={{ height: `${ch}%` }}
                          title={`${claims} claims filed for ${y}`}
                        />
                        <span className="absolute left-1/2 top-0 -translate-x-1/2 font-mono text-[9px] tabular-nums text-chop-muted">
                          {claims}
                        </span>
                      </>
                    ) : null}
                    {tollByYear.has(y) ? (
                      <span
                        className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-warning"
                        title={`${tollByYear.get(y)?.display} — ${tollByYear.get(y)?.label}`}
                      />
                    ) : null}
                  </div>

                  <span className="mt-1.5 text-center font-mono text-[9px] tabular-nums text-chop-muted sm:text-[10px]">
                    <span className="sm:hidden">{String(y).slice(2)}</span>
                    <span className="hidden sm:inline">{y}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 max-w-3xl font-mono text-[10px] leading-relaxed text-chop-muted">
        A quiet column means nothing was collected for that year, not that nothing happened. The
        top row is money the record stands behind; the bottom row is claims filed. Amber dot = a
        toll attributed that year, on its own scale, never the money axis.
      </p>
    </section>

    <section className="mt-8 grid grid-cols-2 gap-px border border-chop-border bg-chop-border sm:grid-cols-3 lg:grid-cols-6">
      {[
        [ledger.length, "claims on the record"],
        [thin, "single unverified allegation"],
        [untouched, "no proceeding recorded"],
        [flows.length, flows.length === 1 ? "money entry" : "money entries"],
        [pending, "filed, awaiting review"],
        [tollTotal, "tolls attributed"],
      ].map(([n, label]) => (
        <div key={String(label)} className="bg-[#080808] px-3 py-2.5">
          <p className="font-mono text-[22px] font-black leading-none tabular-nums text-sheetWhite">
            {n}
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase leading-snug tracking-[0.12em] text-chop-muted">
            {label}
          </p>
        </div>
      ))}
    </section>

    {(assetStatements.length > 0 || wealthPoints.length > 0) ? (
      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        {assetStatements.length > 0 ? (
          <div className="border border-chop-border bg-white/[0.02] p-3.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
              declared net assets, filed with the state
            </p>
            <ul className="mt-2 space-y-1">
              {assetStatements.map((d, i) => (
                <li key={d.id} className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[18px] font-black tabular-nums text-spiteCrimson">
                    {moneyIn(d.net ?? 0, d.currency)}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-chop-muted">
                    {d.periodTo?.slice(0, 4)}
                    {i === 0 ? " · entering" : i === assetStatements.length - 1 ? " · leaving" : ""}
                  </span>
                </li>
              ))}
            </ul>
            {firstStatement && lastStatement && firstStatement.id !== lastStatement.id ? (
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-sheetWhite/85">
                {moneyIn((lastStatement.net ?? 0) - (firstStatement.net ?? 0), lastStatement.currency)}{" "}
                over the period
              </p>
            ) : null}
            {declaredIncome > 0 ? (
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-chop-muted">
                {moneyIn(declaredIncome, incomeStatements[0].currency)} income declared
              </p>
            ) : null}
            <a
              href={safeHref(assetStatements[0].sourceUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
            >
              the filing ↗
            </a>
          </div>
        ) : null}

        {wealthPoints.length > 0 ? (
          <div className="border border-chop-border bg-white/[0.02] p-3.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
              reported wealth
            </p>
            <ul className="mt-2 space-y-1">
              {wealthPoints.map((p, i) => (
                <li key={`w-${p.y}-${i}`} className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[18px] font-black tabular-nums text-spiteCrimson">
                    {formatMoney(p.v, wealthCurrency)}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-chop-muted">{p.y}</span>
                </li>
              ))}
            </ul>
            {wealthPoints.length > 1 && wealthPoints[wealthPoints.length - 1].y > wealthPoints[0].y ? (
              <>
                <WealthStrip points={wealthPoints} max={maxWealth} />
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-chop-muted">
                  {formatMoney(wealthPoints[wealthPoints.length - 1].v - wealthPoints[0].v, wealthCurrency)}{" "}
                  between the two published points · the shaded path is not published
                </p>
              </>
            ) : (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-chop-muted">
                One published point. Two figures in one year are two facts, not a trend.
              </p>
            )}
          </div>
        ) : null}
      </section>
    ) : null}

    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-chop-border pb-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.3em] text-sheetWhite">
          the record, year by year
        </h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted">
          {activeYears.length} year{activeYears.length === 1 ? "" : "s"} with something in them
        </span>
      </div>

      <ol>
        {activeYears
          .slice()
          .reverse()
          .map((y, idx) => {
            const claims = claimsByYear.get(y) ?? [];
            const held = heldIn(y);
            const yearFlows = flows.filter((n) => yearOf(n) === y);
            const yearTolls = tolls.filter((n) => yearOf(n) === y);
            const touch = claims.filter((e) =>
              ["charged", "convicted", "settled", "sanctioned", "investigated"].includes(e.outcome),
            ).length;
            const yearMoney = (flowByYear.get(y) ?? 0) + (firmByYear.get(y) ?? 0);
            const lead = claims.slice(0, 4);
            const rest = claims.slice(4);
            return (
              <li key={y} className="border-b border-chop-border">
                <details open={idx === 0} className="group">
                  <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="w-12 shrink-0 font-mono text-[18px] font-black leading-none tabular-nums text-sheetWhite">
                      {y}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-hypeNeon/80">
                      {held.length > 0
                        ? held.map((p) => p.role).join(" · ")
                        : "no office held"}
                    </span>
                    <span className="ml-auto font-mono text-[10px] tabular-nums text-chop-muted">
                      {yearMoney > 0 ? `${money(yearMoney)} · ` : ""}
                      {claims.length} claim{claims.length === 1 ? "" : "s"} · {touch} proceeding
                      {touch === 1 ? "" : "s"}
                    </span>
                    <span className="font-mono text-[11px] text-chop-muted group-open:hidden">+</span>
                    <span className="hidden font-mono text-[11px] text-chop-muted group-open:inline">−</span>
                  </summary>

                  <div className="pb-4 sm:pl-12">
                    {yearFlows.length > 0 ? (
                      <ul className="mb-3 space-y-1.5">
                        {yearFlows.map((n, i) => (
                          <li key={`f-${n.kind}-${n.label}-${i}`} className="flex gap-2.5">
                            <span
                              className={`w-16 shrink-0 text-right font-mono text-[14px] font-black leading-snug tabular-nums ${
                                n.qualifier === "approved" ||
                                n.kind === "fines" ||
                                n.kind === "donations"
                                  ? "text-chop-muted"
                                  : "text-spiteCrimson"
                              }`}
                            >
                              {n.display}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] leading-snug text-sheetWhite/90">
                                {n.label}
                                {n.counterparty ? (
                                  <span className="text-chop-muted"> · {n.counterparty}</span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.1em] text-chop-muted">
                                {n.instrument || n.kind}
                                {n.qualifier === "approved" ? " · approved ceiling, not cash" : ""}
                                {n.capacity ? ` · as ${n.capacity}` : ""}
                                {n.grade ? ` · grade ${n.grade}` : ""}
                                {n.grade && !RECEIPT_GRADES.has(n.grade) && n.qualifier !== "approved"
                                  ? " · listed, not drawn"
                                  : ""}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {yearTolls.length > 0 ? (
                      <ul className="mb-3 space-y-1">
                        {yearTolls.map((n, i) => (
                          <li
                            key={`t-${n.kind}-${n.label}-${i}`}
                            className="flex flex-wrap items-baseline gap-x-2"
                          >
                            <span className="font-mono text-[13px] font-bold tabular-nums text-warning">
                              {n.display}
                            </span>
                            <span className="text-[12px] leading-snug text-chop-muted">
                              {n.label}
                              {n.qualifier ? ` · ${n.qualifier}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <ul className="space-y-3">
                      {lead.map((e) => (
                        <ClaimItem key={e.id || e.act} entry={e} />
                      ))}
                    </ul>

                    {rest.length > 0 ? (
                      <details className="group mt-2">
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-chop-muted [&::-webkit-details-marker]:hidden hover:text-sheetWhite">
                          <span className="group-open:hidden">
                            show the other {rest.length} claim{rest.length === 1 ? "" : "s"} in {y}
                          </span>
                          <span className="hidden group-open:inline">hide them</span>
                        </summary>
                        <ul className="mt-3 space-y-3">
                          {rest.map((e) => (
                            <ClaimItem key={e.id || e.act} entry={e} />
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                </details>
              </li>
            );
          })}
      </ol>

      {undated.length > 0 || undatedMoney.length > 0 ? (
        <details className="mt-4 border border-chop-border bg-white/[0.02] p-3">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-chop-muted [&::-webkit-details-marker]:hidden">
            {undated.length + undatedMoney.length} entr
            {undated.length + undatedMoney.length === 1 ? "y" : "ies"} with no date to place on the
            chart
          </summary>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-chop-muted">
            Only the year is known, or less. They stay on the page and out of the chart, because a
            mark needs a position in time.
          </p>
          <ul className="mt-2 space-y-1">
            {undated.map((e) => (
              <li key={e.id || e.act} className="flex items-baseline gap-2">
                <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-chop-muted">
                  {e.year || "—"}
                </span>
                <span className="text-[12.5px] leading-snug text-sheetWhite/80">{e.act}</span>
              </li>
            ))}
            {undatedMoney.map((n, i) => (
              <li key={`um-${n.label}-${i}`} className="flex items-baseline gap-2">
                <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-chop-muted">
                  {n.year || "—"}
                </span>
                <span className="text-[12.5px] leading-snug text-sheetWhite/80">
                  <span className="font-mono font-bold text-spiteCrimson">{n.display}</span>{" "}
                  {n.counterparty || n.label}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
    </>
  );
}

/** One claim: grade, where and when, what was done, and the receipts. */
function ClaimItem({ entry: e }: { entry: LedgerEntry }) {
  return (
    <li className="border-l border-chop-border pl-3">
      <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] uppercase tracking-[0.12em] text-chop-muted">
        {e.grade ? (
          <span className={`border px-1 ${GRADE_CHIP[e.grade] ?? GRADE_CHIP.C}`}>{e.grade}</span>
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
          <span className="border border-hypeNeon/40 px-1 text-hypeNeon/80">awaiting review</span>
        ) : null}
      </div>
      {/* The reason comes first; the act is the receipt for it. A claim nobody
          has read is listed as unread rather than presented as a finding. */}
      {e.take ? (
        <p className="mt-1 text-[13px] leading-snug text-sheetWhite/90">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-hypeNeon/70">
            why this is on the record ·{" "}
          </span>
          {e.take}
        </p>
      ) : (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted/70">
          not yet read · the act is listed, not explained
        </p>
      )}
      <p className="mt-0.5 text-[11.5px] leading-snug text-chop-muted">{e.act}</p>
      <div className="mt-1 flex flex-wrap gap-2.5">
        {e.id ? (
          <Link
            href={`/archive/claim/${encodeURIComponent(e.id)}`}
            className="font-mono text-[9px] uppercase tracking-[0.14em] text-spiteCrimson/90 underline decoration-chop-border underline-offset-2 hover:text-spiteCrimson"
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
            className="font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
          >
            source ↗
          </a>
        ))}
      </div>
    </li>
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
