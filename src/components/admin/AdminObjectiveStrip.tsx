"use client";

import { useMemo } from "react";
import { useObjectives } from "@/lib/objective-context";
import type { ObjectiveStatus } from "@/lib/objectives";
import { Pill } from "./admin-ui";

function tone(status: string): "green" | "red" | "yellow" | "gray" {
  if (["completed", "succeeded"].includes(status)) return "green";
  if (["failed", "cancelled", "blocked"].includes(status)) return "red";
  if (["queued", "planning", "awaiting_approval", "pending", "paused"].includes(status)) return "yellow";
  return "gray";
}

function label(status: string): string {
  return status.replace(/_/g, " ");
}

function clampProgress(value: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

export function AdminObjectiveStrip({ onOpenTasks }: { onOpenTasks?: () => void }) {
  const { snapshot, loading, error } = useObjectives();
  const active = useMemo(() => {
    if (!snapshot) return undefined;
    const operationId = snapshot.operation.objective_id;
    return (
      snapshot.objectives.find((objective) => objective.id === operationId) ??
      snapshot.objectives.find((objective) => objective.focused) ??
      snapshot.objectives.find((objective) => !["completed", "cancelled"].includes(objective.status))
    );
  }, [snapshot]);

  const operation = snapshot?.operation;
  const objective = active?.title || active?.objective || operation?.objective;
  const status = active?.status || operation?.status || "idle";
  const progress = active ? active.progress : operation?.progress;

  return (
    <section className="border-b-2 border-glitchGray bg-chop-card/60 px-3 py-2" aria-label="operational objective">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${objective ? "animate-pulse bg-hypeNeon" : "bg-glitchGray"}`} />
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-chop-muted">operational objective</span>
          {objective && <Pill tone={tone(status)}>{label(status)}</Pill>}
        </div>
        {onOpenTasks && objective && (
          <button
            onClick={onOpenTasks}
            className="shrink-0 border border-glitchGray px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-chop-muted hover:border-hypeNeon hover:text-hypeNeon"
          >
            board ↗
          </button>
        )}
      </div>
      <div className="mt-1 truncate text-[11px] font-bold text-sheetWhite" title={objective || undefined}>
        {loading && !snapshot ? "loading objective state…" : objective || (error ? "objective plane unavailable" : "no active objective")}
      </div>
      {objective && (
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 min-w-0 flex-1 bg-black">
            <div className="h-full bg-hypeNeon transition-all" style={{ width: `${clampProgress(progress)}%` }} />
          </div>
          <span className="shrink-0 text-[9px] tabular-nums text-chop-muted">{clampProgress(progress)}%</span>
        </div>
      )}
      {error && !snapshot && <p className="mt-1 truncate text-[9px] text-spiteCrimson" title={error}>{error}</p>}
    </section>
  );
}

export function isObjectiveActive(status: ObjectiveStatus): boolean {
  return ["queued", "planning", "awaiting_approval", "in_progress", "paused", "blocked"].includes(status);
}
