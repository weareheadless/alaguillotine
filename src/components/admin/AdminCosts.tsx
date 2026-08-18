"use client";

import {
  Section,
  Stat,
  Loading,
  ErrorBox,
  useAdmin,
  Bars,
  money,
  num,
  fmtTs,
  Empty,
} from "./admin-ui";

interface CostsData {
  budget?: { spent?: number; donated?: number; budget?: number; remaining?: number; capital?: number; health?: string };
  totals?: {
    total_spent?: number;
    total_donations?: number;
    capital?: number;
    total_tokens?: number;
    total_prompt_tokens?: number;
    total_completion_tokens?: number;
    total_coding_tokens?: number;
    total_cycles?: number;
  };
  daily?: {
    date: string;
    spend: number;
    donations: number;
    tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    coding_tokens: number;
    cycles: number;
  }[];
  donations_recent?: { ts: number; amount: number; note: string; when?: string }[];
  last_usage?: { model?: string; note?: string; total_tokens?: number; ts?: number } | null;
  last_coding_usage?: { model?: string; note?: string; total_tokens?: number; ts?: number } | null;
  pricing?: Record<string, { input_per_m?: number; output_per_m?: number }>;
  daily_budget_usd?: number;
  token_budget?: number;
  max_cycles_per_day?: number;
  coding_budget?: number;
}

export function AdminCosts() {
  const { data, loading, error, refetch } = useAdmin<CostsData>("/api/admin/proxy/costs");
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return null;

  const t = data.totals ?? {};
  const daily = data.daily ?? [];

  return (
    <div className="space-y-4">
      <Section title="Lifetime totals" sub="everything she has ever spent or earned">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat k="total spent" v={money(t.total_spent)} tone="text-spiteCrimson" />
          <Stat k="total donated" v={money(t.total_donations)} tone="text-hypeNeon" />
          <Stat k="capital now" v={money(t.capital)} />
          <Stat k="total tokens" v={num(t.total_tokens)} />
          <Stat k="prompt / completion" v={`${num(t.total_prompt_tokens)} / ${num(t.total_completion_tokens)}`} />
          <Stat k="coding tokens" v={num(t.total_coding_tokens)} />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Spend per day (USD)" sub={`daily budget $${data.daily_budget_usd ?? 0.5}`}>
          <Bars items={daily.map((d) => ({ label: d.date.slice(5), value: d.spend }))} format={money} color="#E11D48" />
        </Section>
        <Section title="Tokens per day" sub="main brain">
          <Bars items={daily.map((d) => ({ label: d.date.slice(5), value: d.tokens }))} format={(v) => num(v)} color="#22C55E" />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Cycles per day" sub={`wakes · cap ${num(data.max_cycles_per_day)}/day`}>
          <Bars items={daily.map((d) => ({ label: d.date.slice(5), value: d.cycles }))} format={(v) => num(v)} color="#F4F4F5" />
        </Section>
        <Section title="Coding tokens per day" sub={`cap ${num(data.coding_budget)}/day`}>
          <Bars items={daily.map((d) => ({ label: d.date.slice(5), value: d.coding_tokens }))} format={(v) => num(v)} color="#F59E0B" />
        </Section>
      </div>

      <Section title="Daily detail" sub="last 30 days">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-glitchGray text-[10px] uppercase tracking-widest text-chop-muted">
                <th className="py-1 pr-3">date</th>
                <th className="py-1 pr-3 text-right">spend</th>
                <th className="py-1 pr-3 text-right">donations</th>
                <th className="py-1 pr-3 text-right">tokens</th>
                <th className="py-1 pr-3 text-right">prompt</th>
                <th className="py-1 pr-3 text-right">completion</th>
                <th className="py-1 pr-3 text-right">coding</th>
                <th className="py-1 text-right">cycles</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date} className="border-b border-glitchGray/40">
                  <td className="py-1 pr-3 text-chop-muted">{d.date}</td>
                  <td className="py-1 pr-3 text-right text-spiteCrimson">{money(d.spend)}</td>
                  <td className="py-1 pr-3 text-right text-hypeNeon">{money(d.donations)}</td>
                  <td className="py-1 pr-3 text-right text-sheetWhite/90">{num(d.tokens)}</td>
                  <td className="py-1 pr-3 text-right text-sheetWhite/60">{num(d.prompt_tokens)}</td>
                  <td className="py-1 pr-3 text-right text-sheetWhite/60">{num(d.completion_tokens)}</td>
                  <td className="py-1 pr-3 text-right text-amber-400">{num(d.coding_tokens)}</td>
                  <td className="py-1 text-right">{num(d.cycles)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Recent donations" sub="life support coming in">
          {data.donations_recent?.length ? (
            <ul className="space-y-1.5">
              {data.donations_recent.map((d, i) => (
                <li key={i} className="flex items-start justify-between gap-3 border-b border-glitchGray/40 pb-1.5 text-xs">
                  <div className="min-w-0">
                    <span className="text-hypeNeon">+{money(d.amount)}</span>
                    <span className="ml-2 text-chop-muted">{d.note}</span>
                  </div>
                  <span className="shrink-0 text-[10px] text-chop-muted">{d.when}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty msg="no donations yet" />
          )}
        </Section>

        <Section title="Pricing + limits" sub="what she pays per million tokens">
          <div className="space-y-1.5 text-xs">
            {Object.entries(data.pricing ?? {}).map(([model, p]) => (
              <div key={model} className="flex justify-between border-b border-glitchGray/40 pb-1.5">
                <span className="text-chop-muted">{model}</span>
                <span className="text-sheetWhite/90">
                  ${Number(p.input_per_m ?? 0).toFixed(2)}/M in · ${Number(p.output_per_m ?? 0).toFixed(2)}/M out
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-1">
              <span className="text-chop-muted">daily usd budget</span>
              <span className="text-sheetWhite">${data.daily_budget_usd ?? 0.5}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-chop-muted">daily token budget</span>
              <span className="text-sheetWhite">{num(data.token_budget)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-chop-muted">max cycles/day</span>
              <span className="text-sheetWhite">{num(data.max_cycles_per_day)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-chop-muted">coding budget/day</span>
              <span className="text-sheetWhite">{num(data.coding_budget)}</span>
            </div>
          </div>
        </Section>
      </div>

      {(data.last_usage || data.last_coding_usage) && (
        <Section title="Last calls" sub="most recent LLM usage">
          {data.last_usage && (
            <p className="text-xs text-chop-muted">
              brain: <span className="text-sheetWhite/90">{String(data.last_usage.model ?? "—")}</span> ·{" "}
              {num(data.last_usage.total_tokens ?? 0)} tok · {data.last_usage.note ?? "—"} · {fmtTs(data.last_usage.ts)}
            </p>
          )}
          {data.last_coding_usage && (
            <p className="mt-1 text-xs text-chop-muted">
              coding: <span className="text-sheetWhite/90">{String(data.last_coding_usage.model ?? "—")}</span> ·{" "}
              {num(data.last_coding_usage.total_tokens ?? 0)} tok · {data.last_coding_usage.note ?? "—"} ·{" "}
              {fmtTs(data.last_coding_usage.ts)}
            </p>
          )}
        </Section>
      )}
    </div>
  );
}
