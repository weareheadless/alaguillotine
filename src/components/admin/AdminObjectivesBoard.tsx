"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useObjectives } from "@/lib/objective-context";
import { approvalHeadline } from "@/lib/objectives";
import type { ObjectiveApproval, ObjectivePlanStep, OperationalObjective } from "@/lib/objectives";
import { Empty, ErrorBox, Loading, Pill } from "./admin-ui";
import { AdminObjectivesKanban } from "./AdminObjectivesKanban";

function pendingApproval(objective: OperationalObjective, allApprovals: ObjectiveApproval[]): ObjectiveApproval | undefined {
  return (
    objective.approvals.find((approval) => approval.status === "pending") ??
    allApprovals.find((approval) => approval.objective_id === objective.id && approval.status === "pending")
  );
}

const KIND_LABEL: Record<string, string> = {
  permission: "tool permission",
  plan: "plan approval",
  start: "start approval",
  side_effect: "side effect",
};

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "gray",
}: {
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  tone?: "green" | "red" | "yellow" | "gray";
}) {
  const classes = {
    green: "border-hypeNeon text-hypeNeon hover:bg-hypeNeon hover:text-black",
    red: "border-spiteCrimson text-spiteCrimson hover:bg-spiteCrimson hover:text-black",
    yellow: "border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-black",
    gray: "border-glitchGray text-chop-muted hover:border-sheetWhite hover:text-sheetWhite",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40 ${classes}`}
    >
      {children}
    </button>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  multiline = false,
  large = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  large?: boolean;
}) {
  const className = `w-full border border-glitchGray bg-black text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none ${large ? "px-3 py-2 text-sm" : "px-2 py-1 text-[10px]"}`;
  return multiline ? (
    <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={large ? 4 : 2} className={`${className} resize-y`} />
  ) : (
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={className} />
  );
}

function StepRow({
  step,
  editing,
  busy,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  large = false,
}: {
  step: ObjectivePlanStep;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSave: (title: string, description: string) => void;
  onCancel: () => void;
  onRemove: () => void;
  large?: boolean;
}) {
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description ?? "");

  if (editing) {
    return (
      <li className="space-y-1 border border-hypeNeon/40 bg-black/50 p-2">
        <Field value={title} onChange={setTitle} placeholder="step title" large={large} />
        <Field value={description} onChange={setDescription} placeholder="what evidence completes this step?" multiline large={large} />
        <div className="flex gap-1">
          <ActionButton tone="green" disabled={busy} onClick={() => onSave(title, description)}>save step</ActionButton>
          <ActionButton disabled={busy} onClick={onCancel}>cancel</ActionButton>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed">
      <span className={`mt-1 h-4 w-4 shrink-0 border text-center text-[10px] leading-[14px] ${step.status === "completed" ? "border-hypeNeon bg-hypeNeon text-black" : step.status === "failed" || step.status === "blocked" ? "border-spiteCrimson text-spiteCrimson" : "border-glitchGray text-chop-muted"}`}>
        {step.status === "completed" ? "x" : step.status === "in_progress" ? "." : ""}
      </span>
      <span className={`min-w-0 flex-1 ${step.status === "completed" ? "text-chop-muted line-through" : "text-sheetWhite/90"}`}>
        {step.title}
        {step.description && <span className="mt-1 block text-[13px] leading-relaxed text-chop-muted">{step.description}</span>}
      </span>
      <Pill tone={step.status === "completed" ? "green" : step.status === "failed" || step.status === "blocked" ? "red" : step.status === "in_progress" ? "green" : "yellow"}>{step.status.replace(/_/g, " ")}</Pill>
      <button type="button" onClick={onEdit} disabled={busy} className="text-[11px] uppercase text-chop-muted hover:text-hypeNeon disabled:opacity-40">edit</button>
      <button type="button" onClick={onRemove} disabled={busy} className="text-[11px] uppercase text-spiteCrimson/70 hover:text-spiteCrimson disabled:opacity-40">remove</button>
    </li>
  );
}

function DetailParameter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-chop-muted">{label}</div>
      <div className="mt-1 text-sm text-sheetWhite">{children}</div>
    </div>
  );
}

function statusTone(status: string): "green" | "red" | "yellow" | "gray" {
  if (status === "completed") return "green";
  if (["failed", "cancelled", "blocked"].includes(status)) return "red";
  if (["queued", "planning", "awaiting_approval", "paused"].includes(status)) return "yellow";
  if (status === "in_progress") return "green";
  return "gray";
}

function progressValue(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ObjectiveCard({
  objective,
  allApprovals,
  busyAction,
  onAction,
}: {
  objective: OperationalObjective;
  allApprovals: ObjectiveApproval[];
  busyAction: string | null;
  onAction: (action: "edit" | "retry" | "remove" | "start" | "complete" | "approve" | "reject" | "add_step" | "update_step" | "remove_step", values?: Record<string, unknown>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingStep, setAddingStep] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [title, setTitle] = useState(objective.title);
  const [description, setDescription] = useState(objective.description ?? "");
  const [objectiveText, setObjectiveText] = useState(objective.objective);
  const [priority, setPriority] = useState(objective.priority ?? "normal");
  const [deadline, setDeadline] = useState(objective.deadline ? objective.deadline.slice(0, 10) : "");
  const [repeatDays, setRepeatDays] = useState(objective.repeat_days ? String(objective.repeat_days) : "");
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepDescription, setNewStepDescription] = useState("");
  const approval = pendingApproval(objective, allApprovals);
  const implicitApproval = objective.approval_required && !approval;
  const startLabel = objective.approval_required || approval ? "approve & start" : "start";
  const busy = busyAction !== null;
  const currentStep = objective.current_step || objective.next_action;
  const deadlineMs = objective.deadline ? new Date(objective.deadline).getTime() : Number.NaN;
  const overdue = Number.isFinite(deadlineMs) && deadlineMs <= Date.now();

  function saveObjective() {
    onAction("edit", {
      title: title.trim(),
      objective: objectiveText.trim(),
      description: description.trim(),
      priority,
      deadline: deadline || null,
      repeat_days: repeatDays ? Number(repeatDays) : 0,
    });
    setEditing(false);
  }

  function removeObjective() {
    if (window.confirm(`Remove "${objective.title}" from the active task board?`)) onAction("remove");
  }

  function removeStep(step: ObjectivePlanStep) {
    if (window.confirm(`Remove step "${step.title}"?`)) onAction("remove_step", { step_id: step.id });
  }

  return (
    <article className={`overflow-hidden border-2 ${objective.focused ? "border-hypeNeon" : "border-glitchGray"} bg-black/60`}>
      <div className="grid min-w-0 md:grid-cols-[8rem_minmax(0,1fr)]">
        <aside className="border-b border-glitchGray bg-black/40 md:border-b-0 md:border-r">
          <div className="space-y-4 p-3 sm:p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-hypeNeon">parameters</div>
            <DetailParameter label="status"><Pill tone={statusTone(objective.status)}>{objective.status.replace(/_/g, " ")}</Pill></DetailParameter>
            <DetailParameter label="priority"><span className="uppercase tracking-wider">{objective.priority || "normal"}</span></DetailParameter>
            <DetailParameter label="due date"><span className={overdue ? "text-spiteCrimson" : objective.deadline ? "text-amber-300" : "text-chop-muted"}>{objective.deadline ? `${overdue ? "overdue" : "due"} ${objective.deadline.slice(0, 10)}` : "not set"}</span></DetailParameter>
            <DetailParameter label="progress">
              <div className="flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1 border border-glitchGray bg-canvasBlack"><div className="h-full bg-hypeNeon" style={{ width: `${progressValue(objective.progress)}%` }} /></div>
                <span className="text-sm font-bold tabular-nums text-hypeNeon">{progressValue(objective.progress)}%</span>
              </div>
            </DetailParameter>
            <DetailParameter label="task id"><code className="break-all text-[11px] text-chop-muted">{objective.id}</code></DetailParameter>
          </div>

          {(approval || implicitApproval) && (
            <div className="border-y border-amber-400/40 bg-amber-400/5 p-3 sm:p-4">
              {approval?.kind && <span className="mb-2 inline-block border border-amber-400/60 px-1 text-[8px] font-black uppercase tracking-widest text-amber-300">{KIND_LABEL[approval.kind] ?? "approval"}</span>}
              <p className="text-xs leading-relaxed text-amber-200">{approval ? approvalHeadline(approval) : "Click approve & start to approve this plan and queue the objective."}</p>
              {approval && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <ActionButton tone="green" disabled={busy} onClick={() => onAction("approve", { approval_id: approval.id })}>approve</ActionButton>
                  <ActionButton tone="red" disabled={busy} onClick={() => onAction("reject", { approval_id: approval.id })}>reject</ActionButton>
                </div>
              )}
            </div>
          )}

          <footer className="flex flex-wrap gap-1.5 p-3 sm:p-4">
            <ActionButton disabled={busy} tone="yellow" onClick={() => setEditing((value) => !value)}>{editing ? "close editor" : "edit"}</ActionButton>
            {objective.status !== "in_progress" && objective.status !== "completed" && objective.status !== "cancelled" && <ActionButton disabled={busy} tone="green" onClick={() => onAction("start")}>{startLabel}</ActionButton>}
            {objective.status !== "completed" && objective.status !== "cancelled" && <ActionButton disabled={busy} tone="green" onClick={() => onAction("complete")}>complete</ActionButton>}
            {objective.retryable && <ActionButton disabled={busy} tone="yellow" onClick={() => onAction("retry")}>retry</ActionButton>}
            {objective.cancelable && <ActionButton disabled={busy} tone="red" onClick={removeObjective}>remove</ActionButton>}
          </footer>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-glitchGray px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-start gap-2">
              <h3 className="min-w-0 flex-1 break-words text-lg font-black leading-tight text-sheetWhite sm:text-xl">{objective.title}</h3>
              {objective.focused && <Pill tone="green">focused</Pill>}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-sheetWhite/95 sm:text-[15px]">{objective.objective}</p>
            {objective.description && <p className="mt-4 whitespace-pre-wrap border-l-2 border-hypeNeon/50 pl-3 text-sm leading-7 text-chop-muted sm:text-[15px]">{objective.description}</p>}
          </header>

          {editing && (
            <div className="space-y-2 border-b border-hypeNeon/40 bg-hypeNeon/5 px-4 py-4 sm:px-6">
              <Field value={title} onChange={setTitle} placeholder="task title" large />
              <Field value={objectiveText} onChange={setObjectiveText} placeholder="what should Ada accomplish?" multiline large />
              <Field value={description} onChange={setDescription} placeholder="notes and acceptance context" multiline large />
              <div className="grid gap-2 sm:grid-cols-3">
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className="border border-glitchGray bg-black px-2 py-2 text-sm text-sheetWhite focus:border-hypeNeon focus:outline-none"><option value="urgent">urgent</option><option value="high">high</option><option value="normal">normal</option><option value="low">low</option></select>
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="border border-glitchGray bg-black px-2 py-2 text-sm text-sheetWhite focus:border-hypeNeon focus:outline-none" />
                <input value={repeatDays} onChange={(event) => setRepeatDays(event.target.value.replace(/[^0-9]/g, ""))} placeholder="repeat days" className="border border-glitchGray bg-black px-2 py-2 text-sm text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none" />
              </div>
              <div className="flex flex-wrap gap-1.5"><ActionButton tone="green" disabled={busy} onClick={saveObjective}>save task</ActionButton><ActionButton disabled={busy} onClick={() => setEditing(false)}>cancel</ActionButton></div>
            </div>
          )}

          <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
            {currentStep && <section><h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-hypeNeon">next action</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-sheetWhite/90 sm:text-[15px]">{currentStep}</p></section>}
            {objective.constraints?.length ? <section><h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-hypeNeon">constraints</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-sheetWhite/90 sm:text-[15px]">{objective.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}</ul></section> : null}
            <section>
              <div className="flex items-center justify-between gap-2"><h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-hypeNeon">plan steps</h4><span className="text-xs text-chop-muted">{objective.plan_steps.filter((step) => step.status === "completed").length}/{objective.plan_steps.length}</span></div>
              <ol className="mt-4 space-y-4">{objective.plan_steps.map((step) => <StepRow key={step.id} step={step} editing={editingStep === step.id} busy={busy} large onEdit={() => setEditingStep(step.id)} onCancel={() => setEditingStep(null)} onSave={(nextTitle, nextDescription) => { onAction("update_step", { step_id: step.id, title: nextTitle, description: nextDescription }); setEditingStep(null); }} onRemove={() => removeStep(step)} />)}</ol>
              {addingStep ? <div className="mt-4 space-y-2 border border-hypeNeon/40 bg-black/50 p-3"><Field value={newStepTitle} onChange={setNewStepTitle} placeholder="new step title" large /><Field value={newStepDescription} onChange={setNewStepDescription} placeholder="what evidence completes this step?" multiline large /><div className="flex gap-1.5"><ActionButton tone="green" disabled={busy} onClick={() => { onAction("add_step", { title: newStepTitle, description: newStepDescription }); setNewStepTitle(""); setNewStepDescription(""); setAddingStep(false); }}>add step</ActionButton><ActionButton disabled={busy} onClick={() => setAddingStep(false)}>cancel</ActionButton></div></div> : <button type="button" onClick={() => setAddingStep(true)} className="mt-4 text-xs font-bold uppercase tracking-wider text-chop-muted hover:text-hypeNeon">+ add step</button>}
            </section>
            {objective.result && <section className="border-l-2 border-hypeNeon/50 pl-3"><h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-hypeNeon">result</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-sheetWhite/90 sm:text-[15px]">{objective.result}</p></section>}
            {objective.error && <section className="border-l-2 border-spiteCrimson/60 pl-3"><h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-spiteCrimson">error</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-spiteCrimson/90 sm:text-[15px]">{objective.error}</p></section>}
          </div>
        </div>
      </div>
    </article>
  );
}

type BoardAction = "create" | "edit" | "retry" | "remove" | "start" | "complete" | "approve" | "reject" | "add_step" | "update_step" | "remove_step";

export function AdminObjectivesBoard({
  compact = false,
  onCompactExpandedChange,
}: {
  compact?: boolean;
  onCompactExpandedChange?: (expanded: boolean) => void;
}) {
  const { snapshot, loading, error, busyAction, refresh, act } = useObjectives();
  const [addOpen, setAddOpen] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [deadline, setDeadline] = useState("");
  const [repeatDays, setRepeatDays] = useState("");

  useEffect(() => {
    const selectedExists = selectedId ? snapshot?.objectives.some((item) => item.id === selectedId) : false;
    if (selectedId && snapshot && !selectedExists) setSelectedId(null);
    onCompactExpandedChange?.(compact && Boolean(selectedId && selectedExists));
  }, [compact, onCompactExpandedChange, selectedId, snapshot]);

  if (loading && !snapshot) return <Loading />;
  if (error && !snapshot) return <ErrorBox msg={error} onRetry={refresh} />;
  if (!snapshot) return null;

  function runAction(objectiveId: string | undefined, action: BoardAction, values: Record<string, unknown> = {}) {
    void act(action, objectiveId, values).then(() => {
      if (compact && (action === "remove" || action === "complete")) setSelectedId(null);
    }).catch(() => undefined);
  }

  function createTask() {
    if (!title.trim()) return;
    runAction(undefined, "create", { title: title.trim(), objective: objective.trim() || title.trim(), description: description.trim(), priority, deadline: deadline || null, repeat_days: repeatDays ? Number(repeatDays) : 0, kind: "task", auto_start: true });
    setTitle(""); setObjective(""); setDescription(""); setPriority("normal"); setDeadline(""); setRepeatDays(""); setAddOpen(false);
  }

  const selectedObjective = selectedId ? snapshot.objectives.find((item) => item.id === selectedId) : undefined;

  const createForm = (
    <div className="shrink-0 space-y-1.5 border-b border-hypeNeon/40 bg-hypeNeon/5 p-2">
      <Field value={title} onChange={setTitle} placeholder="task title *" />
      <Field value={objective} onChange={setObjective} placeholder="what should Ada accomplish?" multiline />
      <Field value={description} onChange={setDescription} placeholder="notes and acceptance context" multiline />
      <div className="grid grid-cols-3 gap-1.5">
        <select value={priority} onChange={(event) => setPriority(event.target.value)} className="border border-glitchGray bg-black px-1 py-1 text-[10px] text-sheetWhite"><option value="urgent">urgent</option><option value="high">high</option><option value="normal">normal</option><option value="low">low</option></select>
        <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="border border-glitchGray bg-black px-1 py-1 text-[10px] text-sheetWhite" />
        <input value={repeatDays} onChange={(event) => setRepeatDays(event.target.value.replace(/[^0-9]/g, ""))} placeholder="repeat days" className="border border-glitchGray bg-black px-1 py-1 text-[10px] text-sheetWhite placeholder:text-chop-muted" />
      </div>
      <ActionButton tone="green" disabled={busyAction !== null || !title.trim()} onClick={createTask}>create task</ActionButton>
    </div>
  );

  const header = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-hypeNeon">task board</h2>
          <Pill tone="green">{snapshot.objectives.filter((item) => item.status !== "cancelled").length}</Pill>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => setShowRemoved((value) => !value)} className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${showRemoved ? "border-sheetWhite text-sheetWhite" : "border-glitchGray text-chop-muted hover:text-sheetWhite"}`}>{showRemoved ? "hide removed" : "all"}</button>
          <button onClick={() => setAddOpen((value) => !value)} className="border border-hypeNeon px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-hypeNeon hover:bg-hypeNeon hover:text-black">{addOpen ? "close" : "+ task"}</button>
        </div>
      </div>
      {error && <p className="mt-2 border border-spiteCrimson/40 px-2 py-1 text-[10px] text-spiteCrimson"><span className="font-bold">ERROR:</span> {error}</p>}
    </>
  );

  const kanban = (
    <AdminObjectivesKanban
      objectives={snapshot.objectives}
      approvals={snapshot.approvals}
      busyAction={busyAction}
      includeRemoved={showRemoved}
      layout={compact ? "stack" : "columns"}
      selectedId={selectedId}
      onOpen={setSelectedId}
      onAction={(objectiveId, action, values) => runAction(objectiveId, action as BoardAction, values)}
    />
  );

  const detailHeader = (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-hypeNeon/40 bg-black/95 px-3 py-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-hypeNeon">task details</span>
      <button type="button" onClick={() => setSelectedId(null)} className="border border-glitchGray px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-chop-muted hover:border-hypeNeon hover:text-hypeNeon">close details</button>
    </div>
  );

  if (compact) {
    return (
      <section className="flex min-h-0 flex-1 flex-col bg-chop-card/60">
        <header className="shrink-0 border-b-2 border-hypeNeon/60 px-3 py-2">{header}</header>
        {addOpen && createForm}

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className={`min-h-0 overflow-hidden ${selectedObjective ? "md:w-44 md:flex-none md:border-r md:border-glitchGray" : "flex-1"}`}>
            {snapshot.objectives.filter((item) => showRemoved || item.status !== "cancelled").length === 0 ? <Empty msg="no tasks yet" /> : kanban}
          </div>
          {selectedObjective && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {detailHeader}
              <div className="p-2">
                <ObjectiveCard objective={selectedObjective} allApprovals={snapshot.approvals} busyAction={busyAction} onAction={(action, values) => runAction(selectedObjective.id, action, values)} />
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="border-2 border-hypeNeon/60 bg-chop-card/60">
      <header className="border-b-2 border-hypeNeon/60 px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-hypeNeon">task board</h2>
            <Pill tone="green">live</Pill>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowRemoved((value) => !value)} className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${showRemoved ? "border-sheetWhite text-sheetWhite" : "border-glitchGray text-chop-muted hover:text-sheetWhite"}`}>{showRemoved ? "hide removed" : "all"}</button>
            <button onClick={() => setAddOpen((value) => !value)} className="border border-hypeNeon px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-hypeNeon hover:bg-hypeNeon hover:text-black">{addOpen ? "close" : "+ task"}</button>
          </div>
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-chop-muted">to do → doing → needs you → stuck → done · click a card for details</p>
        {error && <p className="mt-2 border border-spiteCrimson/40 px-2 py-1 text-[10px] text-spiteCrimson"><span className="font-bold">ERROR:</span> {error}</p>}
      </header>

      {addOpen && <div className="border-b border-hypeNeon/40 bg-hypeNeon/5 p-3">{createForm}</div>}

      <div className="p-3 sm:p-4">
        {snapshot.objectives.filter((item) => showRemoved || item.status !== "cancelled").length === 0 ? <Empty msg="no operational tasks yet" /> : kanban}
      </div>

      {selectedObjective && (
        <div className="border-t-2 border-glitchGray">
          {detailHeader}
          <div className="p-3 sm:p-4">
            <ObjectiveCard objective={selectedObjective} allApprovals={snapshot.approvals} busyAction={busyAction} onAction={(action, values) => runAction(selectedObjective.id, action, values)} />
          </div>
        </div>
      )}
    </section>
  );
}
