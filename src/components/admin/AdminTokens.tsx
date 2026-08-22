"use client";

import { ErrorBox, JsonTree, Loading, Section, Stat, useAdmin } from "./admin-ui";

type Summary = {
  record_count?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  by_provider?: Record<string, number>;
  by_model?: Record<string, number>;
  by_operation?: Record<string, number>;
};

type Usage = Record<string, unknown>;
type TokenResponse = { summary?: Summary; usage?: Usage[] };

function number(value: unknown): string {
  return Number(value ?? 0).toLocaleString();
}

function MapRows({ data, label }: { data?: Record<string, number>; label: string }) {
  const rows = Object.entries(data ?? {}).sort(([, a], [, b]) => b - a);
  return (
    <div>
      <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-chop-muted">{label}</div>
      {rows.length === 0 ? <p className="text-[10px] text-chop-muted">no records</p> : (
        <div className="space-y-1">
          {rows.map(([name, total]) => (
            <div key={name} className="flex justify-between gap-3 text-[10px]">
              <span className="truncate text-sheetWhite/90">{name}</span>
              <span className="shrink-0 text-hypeNeon">{number(total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminTokens() {
  const { data, loading, error, refetch } = useAdmin<TokenResponse>("/api/admin/proxy/tokens?limit=80", 15000);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return null;

  const summary = data.summary ?? {};
  const usage = data.usage ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat k="records" v={number(summary.record_count)} />
        <Stat k="input tokens" v={<span className="text-hypeNeon">{number(summary.input_tokens)}</span>} />
        <Stat k="output tokens" v={number(summary.output_tokens)} />
        <Stat k="total tokens" v={<span className="text-hypeNeon">{number(summary.total_tokens)}</span>} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Providers" sub="token volume by provider"><MapRows data={summary.by_provider} label="provider" /></Section>
        <Section title="Models" sub="token volume by model"><MapRows data={summary.by_model} label="model" /></Section>
        <Section title="Operations" sub="token volume by operation"><MapRows data={summary.by_operation} label="operation" /></Section>
      </div>
      <Section title="Recent usage" sub="input/output accounting only; no cost or currency fields shown">
        {usage.length === 0 ? <p className="text-xs text-chop-muted">No token observations recorded.</p> : (
          <div className="space-y-2">
            {usage.map((row, index) => (
              <div key={String(row.id ?? index)} className="border border-glitchGray bg-black/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="font-bold text-sheetWhite">{String(row.provider ?? "unknown")}</span>
                  <span className="text-chop-muted">{String(row.model ?? "unknown model")}</span>
                  <span className="text-chop-muted">{String(row.operation ?? "operation")}</span>
                  <span className="ml-auto text-hypeNeon">{number(row.total_tokens)} tok</span>
                </div>
                <div className="mt-1 text-[10px] text-chop-muted">in {number(row.input_tokens)} · out {number(row.output_tokens)} · {String(row.recorded_at ?? "-")}</div>
                {row.metadata ? <div className="mt-1"><JsonTree data={row.metadata} name="metadata" /></div> : null}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
