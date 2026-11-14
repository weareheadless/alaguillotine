import Link from "next/link";
import type { LedgerEntry, PositionRow } from "@/lib/archive-store";
import type { PersonNumber } from "@/lib/numbers";
import { safeHref } from "@/lib/url";

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

const money = (n: number): string => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};

const valueOf = (n: PersonNumber): number => {
  if (n.value != null && n.value > 0) return n.value;
  const parsed = Number(String(n.display).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

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
  now,
}: {
  ledger: LedgerEntry[];
  numbers: PersonNumber[];
  positions: PositionRow[];
  now: Date;
}) {
  const thisYear = now.getUTCFullYear();

  const flows = numbers.filter((n) => !TOLL_KINDS.has(n.kind) && n.kind !== "wealth");
  const tolls = numbers.filter((n) => TOLL_KINDS.has(n.kind));
  const wealth = numbers.filter((n) => n.kind === "wealth");

  const yearsOfItems = [
    ...ledger.map((e) => yearOf({ actDate: e.actDate, year: e.year })),
    ...flows.map((n) => yearOf(n)),
  ].filter((y): y is number => y != null);

  const firstYear = yearsOfItems.length ? Math.min(...yearsOfItems) : thisYear - 5;
  // A position that is still open runs to this year.
  const startYear = Math.min(
    firstYear,
    ...positions.map((p) => Number(p.fromDate.slice(0, 4)) || firstYear),
  );
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
  for (const n of flows) {
    const y = yearOf(n);
    if (y == null) continue;
    // A fine is money leaving; the bars are what arrived.
    if (n.direction === "out") continue;
    flowByYear.set(y, (flowByYear.get(y) ?? 0) + valueOf(n));
  }
  const maxFlow = Math.max(1, ...flowByYear.values());

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

  const activeYears = yearList.filter(
    (y) => (claimsByYear.get(y)?.length ?? 0) > 0 || flowByYear.has(y) || heldIn(y).length > 0,
  );

  return (
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
              [flows.length, "money entries"],
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

        {wealthPoints.length > 0 ? (
          <div className="border border-chop-border bg-white/[0.02] p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-chop-muted">
              reported wealth
            </p>
            {wealthPoints.length > 1 && wealthPoints[wealthPoints.length - 1].y > wealthPoints[0].y ? (
              <WealthStrip points={wealthPoints} max={maxWealth} />
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
              money documented, by year
            </h2>
            <span className="font-mono text-[9px] tabular-nums text-chop-muted">
              {startYear}–{endYear}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] items-end gap-[3px]">
            {yearList.map((y) => {
              const v = flowByYear.get(y) ?? 0;
              const held = heldIn(y);
              const state = held.some((p) => p.kind !== "firm");
              const h = v > 0 ? Math.max(3, (v / maxFlow) * 100) : 0;
              return (
                <div key={y} className="flex h-36 flex-col justify-end">
                  <div className="relative flex-1">
                    {held.length > 0 ? (
                      <div
                        className={`absolute inset-0 ${
                          state
                            ? "bg-hypeNeon/[0.07] border-t border-hypeNeon/40"
                            : "bg-sheetWhite/[0.04] border-t border-sheetWhite/20"
                        }`}
                      />
                    ) : null}
                    {v > 0 ? (
                      <div
                        className="absolute bottom-0 left-1/2 w-[62%] -translate-x-1/2 bg-spiteCrimson/70"
                        style={{ height: `${h}%` }}
                        title={`${money(v)} documented in ${y}`}
                      />
                    ) : null}
                    {v > 0 ? (
                      <span className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-[8.5px] tabular-nums text-sheetWhite/90">
                        {money(v)}
                      </span>
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
            Bar = money recorded arriving that year, from the source's own figure. Tinted column =
            an office or official role held. Amber dot = a toll attributed that year, on its own
            scale, never this one.
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
                              {n.counterparty || n.label}
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
