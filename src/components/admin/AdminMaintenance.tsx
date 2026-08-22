"use client";

import { ErrorBox, JsonTree, Loading, Pill, Section, Stat, fmtTs, relTs, useAdmin } from "./admin-ui";

type Run = Record<string, unknown>;
type Job = Record<string, unknown>;
type Response = { maintenance_runs?: Run[]; jobs?: Job[]; summary?: Record<string, unknown> };

function value(row: Run, key: string, fallback = "-"): string {
  const item = row[key];
  return item === null || item === undefined || item === "" ? fallback : String(item);
}

function tone(status: string): "green" | "red" | "yellow" | "gray" {
  if (status === "succeeded") return "green";
  if (["failed", "blocked", "cancelled"].includes(status)) return "red";
  if (["pending", "running"].includes(status)) return "yellow";
  return "gray";
}

export function AdminMaintenance() {
  const { data, loading, error, refetch } = useAdmin<Response>("/api/admin/proxy/maintenance?limit=100", 10000);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return null;

  const runs = data.maintenance_runs ?? [];
  const jobs = data.jobs ?? [];
  const active = runs.filter((run) => ["pending", "running"].includes(value(run, "status"))).length;
  const failed = runs.filter((run) => value(run, "status") === "failed").length;
  const overdue = jobs.filter((job) => ["overdue", "never_run", "failed"].includes(value(job, "status"))).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat k="jobs" v={jobs.length} />
        <Stat k="overdue / failed" v={<span className={overdue ? "text-spiteCrimson" : "text-hypeNeon"}>{overdue}</span>} />
        <Stat k="active" v={<span className="text-amber-400">{active}</span>} />
        <Stat k="failed" v={<span className={failed ? "text-spiteCrimson" : "text-chop-muted"}>{failed}</span>} />
      </div>
      <Section title="Maintenance schedule" sub="wall-clock jobs; startup catches up anything overdue">
        {jobs.length === 0 ? <p className="text-xs text-chop-muted">No scheduler definitions returned.</p> : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const status = value(job, "status");
              const lastRun = job.last_run as Run | null;
              const summary = lastRun?.summary;
              return (
                <article key={value(job, "kind")} className="border border-glitchGray bg-black/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sheetWhite">{value(job, "label")}</span>
                    <Pill tone={tone(status === "healthy" ? "succeeded" : status)}>{status}</Pill>
                    <span className="text-[10px] text-chop-muted">{value(job, "kind")}</span>
                  </div>
                  <div className="mt-2 grid gap-1 text-[10px] text-chop-muted sm:grid-cols-3">
                    <span>every {Math.max(1, Math.round(Number(job.interval_seconds ?? 0) / 60))}m</span>
                    <span>last {lastRun ? relTs(Date.parse(String(lastRun.created_at)) / 1000) : "never"}</span>
                    <span>next {job.next_due ? fmtTs(Number(job.next_due)) : "—"}</span>
                  </div>
                  {summary ? <div className="mt-2"><JsonTree data={summary} name="last result" /></div> : null}
                  {lastRun?.error ? <div className="mt-2 text-[10px] text-spiteCrimson"><JsonTree data={lastRun.error} name="error" /></div> : null}
                </article>
              );
            })}
          </div>
        )}
      </Section>
      <Section title="Maintenance ledger" sub="bounded jobs and terminal outcomes from the runtime control plane">
        {runs.length === 0 ? <p className="text-xs text-chop-muted">No maintenance runs recorded.</p> : (
          <div className="space-y-2">
            {runs.map((run) => {
              const status = value(run, "status");
              return (
                <article key={value(run, "id")} className="border border-glitchGray bg-black/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sheetWhite">{value(run, "kind")}</span>
                    <Pill tone={tone(status)}>{status}</Pill>
                    <span className="text-[10px] text-chop-muted">{value(run, "runtime_instance_id")}</span>
                  </div>
                   {run.summary ? <div className="mt-1 text-[11px] text-sheetWhite/90"><JsonTree data={run.summary} name="summary" /></div> : null}
                  <div className="mt-2 text-[10px] text-chop-muted">created {value(run, "created_at")} · finished {value(run, "finished_at")}</div>
                  {run.error ? <div className="mt-2 text-[10px] text-spiteCrimson"><JsonTree data={run.error} name="error" /></div> : null}
                </article>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
