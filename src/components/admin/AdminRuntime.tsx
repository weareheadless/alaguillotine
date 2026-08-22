"use client";

import { JsonTree, ErrorBox, Loading, Pill, Section, Stat, useAdmin } from "./admin-ui";

type Row = Record<string, unknown>;

type InstancesResponse = { instances?: Row[] };
type CyclesResponse = { cycles?: Row[] };
type ReportsResponse = { reports?: Row[] };

function text(row: Row, key: string, fallback = "-"): string {
  const value = row[key];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function tone(value: string): "green" | "red" | "yellow" | "gray" {
  if (["healthy", "succeeded", "running"].includes(value)) return "green";
  if (["failed", "blocked", "cancelled"].includes(value)) return "red";
  if (["degraded", "pending", "stale"].includes(value)) return "yellow";
  return "gray";
}

function compactTime(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function AdminRuntime() {
  const instances = useAdmin<InstancesResponse>("/api/admin/proxy/runtime/instances?limit=100", 10000);
  const cycles = useAdmin<CyclesResponse>("/api/admin/proxy/runtime/cycles?limit=40", 10000);
  const reports = useAdmin<ReportsResponse>("/api/admin/proxy/runtime/reports?limit=20", 10000);

  const error = instances.error || cycles.error || reports.error;
  if (instances.loading && !instances.data && cycles.loading && !cycles.data) return <Loading />;
  if (error && !instances.data && !cycles.data && !reports.data) {
    return <ErrorBox msg={error} onRetry={() => { instances.refetch(); cycles.refetch(); reports.refetch(); }} />;
  }

  const instanceRows = instances.data?.instances ?? [];
  const cycleRows = cycles.data?.cycles ?? [];
  const reportRows = reports.data?.reports ?? [];
  const healthy = instanceRows.filter((row) => text(row, "health") === "healthy").length;
  const active = cycleRows.filter((row) => ["running", "pending"].includes(text(row, "status"))).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat k="instances" v={instanceRows.length} />
        <Stat k="healthy" v={<span className="text-hypeNeon">{healthy}</span>} />
        <Stat k="recent cycles" v={cycleRows.length} />
        <Stat k="active cycles" v={<span className={active ? "text-amber-400" : "text-chop-muted"}>{active}</span>} />
      </div>

      <Section title="Runtime instances" sub="durable process identity, heartbeat, and health state">
        {instanceRows.length === 0 ? (
          <p className="text-xs text-chop-muted">No runtime instances recorded.</p>
        ) : (
          <div className="space-y-2">
            {instanceRows.map((row) => {
              const status = text(row, "status");
              const health = text(row, "health");
              return (
                <article key={text(row, "id")} className="border border-glitchGray bg-black/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sheetWhite">{text(row, "name")}</span>
                    <Pill tone={tone(status)}>{status}</Pill>
                    <Pill tone={tone(health)}>{health}</Pill>
                    <span className="text-[10px] text-chop-muted">{text(row, "workspace_id")}</span>
                  </div>
                  <div className="mt-2 grid gap-1 text-[10px] text-chop-muted sm:grid-cols-3">
                    <span>host: {text(row, "host")}</span>
                    <span>pid: {text(row, "process_id")}</span>
                    <span>last seen: {compactTime(row.last_seen_at)}</span>
                  </div>
                  {row.last_error ? <p className="mt-2 text-[10px] text-spiteCrimson">{text(row, "last_error")}</p> : null}
                  {row.metadata ? <div className="mt-2 border-t border-glitchGray/60 pt-2"><JsonTree data={row.metadata} name="metadata" /></div> : null}
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Cycles" sub="latest deterministic wake and execution records">
          {cycleRows.length === 0 ? <p className="text-xs text-chop-muted">No cycles recorded.</p> : (
            <div className="space-y-2">
              {cycleRows.map((row) => {
                const status = text(row, "status");
                return (
                  <div key={text(row, "id")} className="border border-glitchGray bg-black/60 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sheetWhite">cycle {text(row, "cycle_number")}</span>
                      <Pill tone={tone(status)}>{status}</Pill>
                      <span className="text-[10px] text-chop-muted">{text(row, "trigger")}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-chop-muted">started {compactTime(row.started_at)} · finished {compactTime(row.finished_at)}</div>
                    {row.error ? <div className="mt-1 text-[10px] text-spiteCrimson"><JsonTree data={row.error} name="error" /></div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Observer reports" sub="read-only health summaries; no hidden reasoning">
          {reportRows.length === 0 ? <p className="text-xs text-chop-muted">No observer reports recorded.</p> : (
            <div className="space-y-2">
              {reportRows.map((row) => {
                const health = text(row, "health");
                return (
                  <div key={text(row, "id")} className="border border-glitchGray bg-black/60 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={tone(health)}>{health}</Pill>
                      <Pill tone={tone(text(row, "status"))}>{text(row, "status")}</Pill>
                      <span className="text-[10px] text-chop-muted">{compactTime(row.observed_at)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-sheetWhite/90">{text(row, "summary")}</p>
                    {row.stream_health ? <div className="mt-1"><JsonTree data={row.stream_health} name="streams" /></div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
