"use client";

import { useState } from "react";
import { ErrorBox, Loading, Section, Stat, useAdmin } from "./admin-ui";

type Row = Record<string, unknown>;
type RecoverySummary = {
  status?: string;
  candidate_ids?: string[];
  recovered_task_ids?: string[];
  skipped_task_ids?: string[];
  candidate_count?: number;
  recovered_count?: number;
  skipped_count?: number;
  recovered_runs?: number;
  skipped_runs?: number;
};
type RecoveryResponse = { tasks?: RecoverySummary; older_than_seconds?: number };
type CheckpointsResponse = { checkpoints?: Row[] };

function value(row: Row, key: string, fallback = "-"): string {
  const item = row[key];
  return item === null || item === undefined || item === "" ? fallback : String(item);
}

export function AdminRecovery() {
  const recovery = useAdmin<RecoveryResponse>("/api/admin/proxy/recovery?older_than_seconds=3600&limit=100", 10000);
  const checkpoints = useAdmin<CheckpointsResponse>("/api/admin/proxy/checkpoints", 15000);
  const [age, setAge] = useState("3600");
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (recovery.loading && !recovery.data && checkpoints.loading && !checkpoints.data) return <Loading />;
  const error = recovery.error || checkpoints.error;
  if (error && !recovery.data && !checkpoints.data) return <ErrorBox msg={error} onRetry={() => { recovery.refetch(); checkpoints.refetch(); }} />;

  const preview = recovery.data?.tasks ?? {};
  const candidateIds = preview.candidate_ids ?? [];
  const saved = checkpoints.data?.checkpoints ?? [];

  async function recover() {
    const seconds = Number(age);
    if (!Number.isInteger(seconds) || seconds < 1) {
      setMessage("age must be a positive number of seconds");
      return;
    }
    setWorking("recovery");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/proxy/recovery/stale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, older_than_seconds: seconds }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`);
      const counts = data?.counts ?? {};
      setMessage(`recovery applied: ${Number(counts.recovered ?? 0)} task(s), ${Number(counts.recovered_runs ?? 0)} run(s)`);
      await recovery.refetch();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "recovery failed");
    } finally {
      setWorking(null);
    }
  }

  async function restore(checkpointId: string) {
    if (!window.confirm(`Restore checkpoint ${checkpointId}? This replaces tracked files and runtime state.`)) return;
    setWorking(checkpointId);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/proxy/checkpoint/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpoint_id: checkpointId, confirm: true }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`);
      setMessage(`restored checkpoint ${checkpointId}`);
      await checkpoints.refetch();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "restore failed");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat k="stale candidates" v={<span className={Number(preview.candidate_count) ? "text-amber-400" : "text-hypeNeon"}>{Number(preview.candidate_count ?? 0)}</span>} />
        <Stat k="checkpoints" v={saved.length} />
        <Stat k="threshold" v={`${age}s`} />
      </div>
      <Section title="Stale-task recovery" sub="preview first; confirmed recovery marks old running work for safe continuation">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] uppercase tracking-wider text-chop-muted">
            older than seconds
            <input value={age} onChange={(event) => setAge(event.target.value.replace(/[^0-9]/g, ""))} className="mt-1 block w-36 border border-glitchGray bg-black px-2 py-1.5 text-xs text-sheetWhite focus:border-hypeNeon focus:outline-none" />
          </label>
          <button onClick={recover} disabled={working !== null} className="border border-amber-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-400 hover:text-black disabled:opacity-40">recover stale</button>
        </div>
        {message ? <p className="mt-3 text-xs text-sheetWhite/80">{message}</p> : null}
        <div className="mt-4 space-y-2">
          {candidateIds.length === 0 ? <p className="text-xs text-chop-muted">No stale tasks match the current threshold.</p> : (
            <div className="space-y-1">
              {candidateIds.map((id) => <div key={id} className="border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-[10px] text-amber-300">{id}</div>)}
              <div className="pt-1 text-[10px] text-chop-muted">recovered {Number(preview.recovered_count ?? 0)} · skipped {Number(preview.skipped_count ?? 0)} · runs recovered {Number(preview.recovered_runs ?? 0)}</div>
            </div>
          )}
        </div>
      </Section>
      <Section title="Checkpoint archive" sub="runtime SQLite snapshots are captured with SQLite backup, not raw file copy">
        {saved.length === 0 ? <p className="text-xs text-chop-muted">No checkpoints recorded.</p> : (
          <div className="space-y-2">
            {saved.map((checkpoint, index) => {
              const id = value(checkpoint, "id", `checkpoint-${index}`);
              return (
                <div key={id} className="flex flex-wrap items-center gap-2 border border-glitchGray bg-black/60 px-3 py-2 text-[10px]">
                  <span className="font-bold text-sheetWhite">{id}</span>
                  <span className="text-chop-muted">{value(checkpoint, "label")}</span>
                  <span className="text-chop-muted">{value(checkpoint, "created_at")}</span>
                  <button onClick={() => restore(id)} disabled={working !== null} className="ml-auto border border-spiteCrimson px-2 py-1 font-bold uppercase tracking-wider text-spiteCrimson hover:bg-spiteCrimson hover:text-black disabled:opacity-40">restore</button>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
