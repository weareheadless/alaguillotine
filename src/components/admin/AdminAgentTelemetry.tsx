"use client";

import { useState } from "react";
import { ErrorBox, Pill, relTs, useAdmin } from "./admin-ui";

type Permission = {
  type?: string;
  properties?: {
    id?: string;
    permissionID?: string;
    requestID?: string;
    sessionID?: string;
    permission?: string;
    patterns?: string[];
    metadata?: { command?: string };
  };
};

type Activity = {
  at?: number;
  event_id?: string | null;
  kind?: string;
  event_type?: string;
  session_id?: string;
  tool?: string;
  status?: string;
  permission?: string;
  reply?: string;
  agent?: string;
  description?: string;
  command?: string;
  error?: string;
  role?: string;
  finish?: string;
};

type AgentStatus = {
  session_id?: string;
  session_statuses?: Record<string, { type?: string }>;
  children?: { id?: string; agent?: string; title?: string }[];
  pending_permissions?: Permission[];
  activity?: Activity[];
};

function permissionId(permission: Permission): string {
  const properties = permission.properties ?? {};
  return properties.id ?? properties.permissionID ?? properties.requestID ?? "";
}

function activityLabel(item: Activity): string {
  if (item.kind === "permission") {
    return `${item.permission ?? "permission"}${item.reply ? ` · ${item.reply}` : " · waiting"}`;
  }
  if (item.kind === "tool") return `${item.tool ?? "tool"} · ${item.status ?? "unknown"}`;
  if (item.kind === "subtask") return `delegated to ${item.agent ?? "subagent"}`;
  if (item.kind === "session_status") return `session ${item.status ?? "unknown"}`;
  if (item.kind === "session_error") return `session error: ${item.error ?? "unknown"}`;
  if (item.kind === "message") return `${item.role ?? "message"}${item.finish ? ` · ${item.finish}` : ""}`;
  return item.event_type ?? item.kind ?? "activity";
}

export function AdminAgentTelemetry() {
  const { data, loading, error, refetch } = useAdmin<AgentStatus>("/api/admin/proxy/agent/status", 2000);
  const [working, setWorking] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (loading && !data) {
    return <div className="p-3 text-[10px] uppercase tracking-widest text-chop-muted">loading agent telemetry…</div>;
  }
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return null;

  const pending = data.pending_permissions ?? [];
  const activity = [...(data.activity ?? [])].reverse().slice(0, 18);
  const busy = Object.values(data.session_statuses ?? {}).some((status) => status?.type === "busy");
  const state = pending.length ? "approval needed" : busy ? "working" : "idle";
  const tone = pending.length ? "yellow" : busy ? "green" : "gray";

  async function answer(permission: Permission, response: "once" | "always" | "reject") {
    const properties = permission.properties ?? {};
    const sessionId = properties.sessionID;
    const id = permissionId(permission);
    if (!sessionId || !id) return;
    setWorking(id);
    setActionError(null);
    try {
      const result = await fetch("/api/admin/proxy/agent/permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, permission_id: id, response }),
      });
      const json = await result.json();
      if (!result.ok || !json?.ok) throw new Error(json?.error || `HTTP ${result.status}`);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "approval action failed");
    } finally {
      setWorking(null);
    }
  }

  async function abort() {
    const sessionId = data?.session_id;
    if (!sessionId) return;
    setWorking("abort");
    setActionError(null);
    try {
      const result = await fetch("/api/admin/proxy/agent/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const json = await result.json();
      if (!result.ok || !json?.ok) throw new Error(json?.error || `HTTP ${result.status}`);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "abort failed");
    } finally {
      setWorking(null);
    }
  }

  return (
    <section className="shrink-0 border-b-2 border-glitchGray bg-black/70">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${pending.length ? "animate-pulse bg-amber-400" : busy ? "animate-pulse bg-hypeNeon" : "bg-glitchGray"}`} />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-sheetWhite">agent activity</span>
          <Pill tone={tone}>{state}</Pill>
          {pending.length > 0 && <Pill tone="yellow">{pending.length} approval{pending.length === 1 ? "" : "s"}</Pill>}
        </div>
        <div className="flex items-center gap-1.5">
          {busy && (
            <button
              type="button"
              onClick={abort}
              disabled={working !== null}
              className="border border-spiteCrimson px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-spiteCrimson hover:bg-spiteCrimson hover:text-black disabled:opacity-50"
            >
              stop
            </button>
          )}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="agent-activity-details"
            onClick={() => setExpanded((value) => !value)}
            className="border border-glitchGray px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-chop-muted hover:border-hypeNeon hover:text-hypeNeon"
          >
            {expanded ? "hide" : "show"}
          </button>
        </div>
      </div>

      {expanded && (
        <div id="agent-activity-details">
          {pending.length > 0 && (
            <div className="space-y-2 border-t border-amber-400/40 bg-amber-400/5 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">approval queue</div>
              {pending.map((permission) => {
                const properties = permission.properties ?? {};
                const id = permissionId(permission);
                const child = data.children?.find((candidate) => candidate.id === properties.sessionID);
                const command = properties.metadata?.command;
                return (
                  <div key={`${properties.sessionID}-${id}`} className="border border-amber-400/40 bg-black px-2 py-2 text-[11px] text-sheetWhite/90">
                    <div className="font-bold text-amber-300">{properties.permission ?? "permission"}</div>
                    <div className="mt-0.5 text-chop-muted">
                      {child?.agent ?? "subagent"} · {child?.title ?? properties.sessionID ?? "unknown session"}
                    </div>
                    {command && <code className="mt-1 block break-words text-[10px] text-sheetWhite/80">{command}</code>}
                    {properties.patterns?.length ? <div className="mt-1 break-words text-[10px] text-chop-muted">patterns: {properties.patterns.join(", ")}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button type="button" onClick={() => answer(permission, "once")} disabled={working !== null} className="border border-hypeNeon px-1.5 py-0.5 text-[10px] font-bold uppercase text-hypeNeon hover:bg-hypeNeon hover:text-black disabled:opacity-50">allow once</button>
                      <button type="button" onClick={() => answer(permission, "always")} disabled={working !== null} className="border border-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-400 hover:bg-amber-400 hover:text-black disabled:opacity-50">always</button>
                      <button type="button" onClick={() => answer(permission, "reject")} disabled={working !== null} className="border border-spiteCrimson px-1.5 py-0.5 text-[10px] font-bold uppercase text-spiteCrimson hover:bg-spiteCrimson hover:text-black disabled:opacity-50">reject</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {actionError && <div className="px-3 py-1 text-[11px] text-spiteCrimson">{actionError}</div>}

          <div className="max-h-56 overflow-y-auto border-t border-glitchGray/60 px-3 py-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-chop-muted">high-level activity · no private reasoning</div>
            {activity.length === 0 ? (
              <div className="py-2 text-[11px] text-chop-muted">No activity captured yet.</div>
            ) : (
              <div className="space-y-1.5">
                {activity.map((item, index) => (
                  <div key={`${item.event_id ?? item.at}-${index}`} className="flex gap-2 text-[11px] leading-snug">
                    <span className="w-12 shrink-0 text-chop-muted">{relTs(item.at)}</span>
                    <span className={item.kind === "permission" ? "text-amber-300" : item.kind === "tool" ? "text-hypeNeon" : "text-sheetWhite/80"}>
                      {activityLabel(item)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
