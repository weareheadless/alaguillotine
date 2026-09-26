"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { BoardColumnId } from "@/lib/objectives";
import {
  BOARD_COLUMNS,
  approvalHeadline,
  statusToColumn,
  type ObjectiveAction,
  type ObjectiveApproval,
  type OperationalObjective,
} from "@/lib/objectives";
import { Pill, relTs } from "./admin-ui";

type CardAction = Extract<ObjectiveAction, "start" | "complete" | "retry" | "approve" | "reject">;

const COLUMN_LABEL: Record<BoardColumnId | "removed", string> = {
  todo: "to do",
  doing: "doing",
  needs_you: "needs you",
  stuck: "stuck",
  done: "done",
  removed: "removed",
};

const COLUMN_HINT: Record<BoardColumnId | "removed", string> = {
  todo: "queued and waiting for Ada",
  doing: "Ada is working on it now",
  needs_you: "waiting on your decision",
  stuck: "blocked or failed, needs a nudge",
  done: "completed objectives",
  removed: "cancelled objectives, hidden by default",
};

const COLUMN_ACCENT: Record<BoardColumnId | "removed", { text: string; border: string }> = {
  todo: { text: "text-chop-muted", border: "border-glitchGray" },
  doing: { text: "text-hypeNeon", border: "border-hypeNeon/60" },
  needs_you: { text: "text-amber-400", border: "border-amber-400/60" },
  stuck: { text: "text-spiteCrimson", border: "border-spiteCrimson/60" },
  done: { text: "text-chop-muted", border: "border-glitchGray" },
  removed: { text: "text-chop-muted", border: "border-glitchGray" },
};

const KIND_LABEL: Record<string, string> = {
  permission: "tool permission",
  plan: "plan approval",
  start: "start approval",
  side_effect: "side effect",
};

function pendingApproval(objective: OperationalObjective, allApprovals: ObjectiveApproval[]): ObjectiveApproval | undefined {
  return (
    objective.approvals.find((approval) => approval.status === "pending") ??
    allApprovals.find((approval) => approval.objective_id === objective.id && approval.status === "pending")
  );
}

function duePill(objective: OperationalObjective): ReactNode {
  const deadline = objective.deadline;
  if (!deadline) return null;
  const overdue = new Date(deadline).getTime() <= Date.now();
  return <Pill tone={overdue ? "red" : "yellow"}>{overdue ? "overdue" : `due ${deadline.slice(0, 10)}`}</Pill>;
}

export function KanbanCard({
  objective,
  allApprovals,
  busyAction,
  selected = false,
  onOpen,
  onAction,
}: {
  objective: OperationalObjective;
  allApprovals: ObjectiveApproval[];
  busyAction: string | null;
  selected?: boolean;
  onOpen: () => void;
  onAction: (action: CardAction, values?: Record<string, unknown>) => void;
}) {
  const column = statusToColumn(objective.status);
  const approval = pendingApproval(objective, allApprovals);
  const implicitApproval = objective.approval_required && !approval;
  const busy = busyAction !== null;
  const next = objective.current_step || objective.next_action;
  const updated = objective.updated_at
    ? relTs(typeof objective.updated_at === "number" ? objective.updated_at : Date.parse(objective.updated_at) / 1000)
    : null;

  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  function open(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen();
  }

  const startButton = "border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40";
  const primaryActions: Record<BoardColumnId, ReactNode> = {
    todo: (
      <button type="button" disabled={busy} onClick={(event) => { stop(event); onAction("start"); }} className={`${startButton} border-hypeNeon text-hypeNeon hover:bg-hypeNeon hover:text-black`}>start</button>
    ),
    doing: (
      <button type="button" disabled={busy} onClick={(event) => { stop(event); onAction("complete"); }} className={`${startButton} border-hypeNeon text-hypeNeon hover:bg-hypeNeon hover:text-black`}>mark done</button>
    ),
    needs_you: (
      <>
        <button type="button" disabled={busy || !approval} onClick={(event) => { stop(event); if (approval) onAction("approve", { approval_id: approval.id }); }} className={`${startButton} border-hypeNeon text-hypeNeon hover:bg-hypeNeon hover:text-black`}>approve</button>
        <button type="button" disabled={busy || !approval} onClick={(event) => { stop(event); if (approval) onAction("reject", { approval_id: approval.id }); }} className={`${startButton} border-spiteCrimson text-spiteCrimson hover:bg-spiteCrimson hover:text-black`}>reject</button>
      </>
    ),
    stuck: (
      <button type="button" disabled={busy || !objective.retryable} onClick={(event) => { stop(event); onAction("retry"); }} className={`${startButton} border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black`}>retry</button>
    ),
    done: null,
  };

  return (
    <article
      className={`cursor-pointer border bg-black/60 transition-colors hover:border-sheetWhite ${selected ? "border-hypeNeon bg-hypeNeon/10" : "border-glitchGray"}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Open ${objective.title}`}
      onKeyDown={open}
    >
      <div className="px-2 pt-2">
        <div className="flex items-start gap-1.5">
          <h3 className="min-w-0 flex-1 break-words text-[11px] font-bold leading-snug text-sheetWhite">{objective.title}</h3>
          <span className="shrink-0 text-[8px] text-chop-muted" title={objective.id}>#{objective.id.slice(0, 8)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {objective.focused && <Pill tone="green">focused</Pill>}
          {objective.priority && objective.priority !== "normal" && <Pill tone="gray">{objective.priority}</Pill>}
          {duePill(objective)}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="h-1 min-w-0 flex-1 border border-glitchGray bg-canvasBlack"><div className="h-full bg-hypeNeon transition-all" style={{ width: `${Math.max(0, Math.min(100, Math.round(objective.progress)))}%` }} /></div>
          <span className="shrink-0 text-[8px] tabular-nums text-chop-muted">{Math.round(objective.progress)}%</span>
        </div>
        {next ? (
          <p className="mt-1 truncate text-[9px] text-chop-muted" title={next}>next: {next}</p>
        ) : objective.error ? (
          <p className="mt-1 truncate text-[9px] text-spiteCrimson/80" title={objective.error}>{objective.error}</p>
        ) : null}
      </div>

      {(approval || implicitApproval) && (
        <div className="mx-2 mt-2 border border-amber-400/40 bg-amber-400/5 px-1.5 py-1">
          <div className="flex flex-wrap items-center gap-1">
            {approval?.kind && <span className="shrink-0 border border-amber-400/60 px-1 text-[7px] font-black uppercase tracking-widest text-amber-300">{KIND_LABEL[approval.kind] ?? "approval"}</span>}
            <span className="min-w-0 flex-1 text-[9px] leading-snug text-amber-200">{approval ? approvalHeadline(approval) : "approve & start authorizes this plan and queues it"}</span>
          </div>
        </div>
      )}

      <footer className="flex items-center gap-1 px-2 py-1.5">
        {primaryActions[column]}
        {updated && <span className="ml-auto text-[8px] text-chop-muted">{updated}</span>}
      </footer>
    </article>
  );
}

function ColumnHeader({ id, count }: { id: BoardColumnId | "removed"; count: number }) {
  const accent = COLUMN_ACCENT[id];
  return (
    <div className={`flex shrink-0 items-baseline justify-between gap-1 border-b-2 ${accent.border} px-1.5 pb-1`} title={COLUMN_HINT[id]}>
      <h4 className={`text-[9px] font-black uppercase tracking-[0.14em] ${accent.text}`}>{COLUMN_LABEL[id]}</h4>
      <span className="text-[9px] tabular-nums text-chop-muted">{count}</span>
    </div>
  );
}

function EmptyColumn() {
  return <p className="px-1.5 py-2 text-[9px] uppercase tracking-wider text-chop-muted/60">(empty)</p>;
}

interface BoardColumn {
  key: BoardColumnId | "removed";
  items: OperationalObjective[];
}

function groupColumns(objectives: OperationalObjective[], includeRemoved: boolean): BoardColumn[] {
  const grouped = new Map<BoardColumnId, OperationalObjective[]>(BOARD_COLUMNS.map((column) => [column.id, []]));
  for (const item of objectives) {
    if (item.status === "cancelled") continue;
    grouped.get(statusToColumn(item.status))!.push(item);
  }
  const columns: BoardColumn[] = BOARD_COLUMNS.map((column) => ({ key: column.id, items: grouped.get(column.id)! }));
  if (includeRemoved) {
    columns.push({ key: "removed", items: objectives.filter((item) => item.status === "cancelled") });
  }
  return columns;
}

export function AdminObjectivesKanban({
  objectives,
  approvals,
  busyAction,
  includeRemoved = false,
  layout = "columns",
  selectedId = null,
  onOpen,
  onAction,
}: {
  objectives: OperationalObjective[];
  approvals: ObjectiveApproval[];
  busyAction: string | null;
  includeRemoved?: boolean;
  layout?: "columns" | "stack";
  selectedId?: string | null;
  onOpen: (objectiveId: string) => void;
  onAction: (objectiveId: string | undefined, action: CardAction | "remove", values?: Record<string, unknown>) => void;
}) {
  const columns = groupColumns(objectives, includeRemoved);

  const cardProps = (item: OperationalObjective) => ({
    key: item.id,
    objective: item,
    allApprovals: approvals,
    busyAction,
    selected: item.id === selectedId,
    onOpen: () => onOpen(item.id),
    onAction: (action: CardAction, values?: Record<string, unknown>) => onAction(item.id, action, values),
  });

  if (layout === "stack") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        {columns.map((column) => (
          <section key={column.key}>
            <ColumnHeader id={column.key} count={column.items.length} />
            <div className="space-y-1.5 p-1.5">
              {column.items.length === 0 ? <EmptyColumn /> : column.items.map((item) => <KanbanCard {...cardProps(item)} />)}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const gridClass = columns.length > 5 ? "xl:grid-cols-6" : "xl:grid-cols-5";

  return (
    <div className={`grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 ${gridClass}`}>
      {columns.map((column) => (
        <section key={column.key} className={`flex min-w-0 flex-col border bg-canvasBlack/40 ${COLUMN_ACCENT[column.key].border}`}>
          <ColumnHeader id={column.key} count={column.items.length} />
          <div className="flex min-h-16 flex-1 flex-col gap-1.5 p-1.5">
            {column.items.length === 0 ? <EmptyColumn /> : column.items.map((item) => <KanbanCard {...cardProps(item)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
