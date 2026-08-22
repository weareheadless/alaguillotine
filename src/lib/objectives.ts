export type ObjectiveStatus =
  | "queued"
  | "planning"
  | "awaiting_approval"
  | "in_progress"
  | "paused"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled"
  | "unknown";

export type ObjectiveStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "awaiting_approval"
  | "blocked"
  | "failed"
  | "cancelled"
  | "unknown";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "not_required" | "unknown";
export type ObjectiveAction =
  | "create"
  | "edit"
  | "update"
  | "retry"
  | "cancel"
  | "remove"
  | "start"
  | "complete"
  | "focus"
  | "approve"
  | "reject"
  | "add_step"
  | "update_step"
  | "remove_step";

export interface ObjectiveApproval {
  id: string;
  objective_id?: string;
  step_id?: string;
  status: ApprovalStatus;
  label?: string;
  reason?: string;
  requested_at?: number | string | null;
}

export interface ObjectivePlanStep {
  id: string;
  title: string;
  description?: string;
  status: ObjectiveStepStatus;
  progress: number;
  approval_required?: boolean;
  approval_status?: ApprovalStatus;
  updated_at?: number | string | null;
}

export interface ObjectiveOperation {
  objective: string;
  status: string;
  objective_id?: string;
  progress?: number;
  updated_at?: number | string | null;
}

export interface OperationalObjective {
  id: string;
  title: string;
  objective: string;
  description?: string;
  constraints?: string[];
  priority?: string;
  kind?: string;
  auto_start?: boolean;
  repeat_days?: number;
  status: ObjectiveStatus;
  progress: number;
  plan_steps: ObjectivePlanStep[];
  current_step_id?: string;
  current_step?: string;
  approvals: ObjectiveApproval[];
  approval_required: boolean;
  approval_status?: ApprovalStatus;
  retryable: boolean;
  cancelable: boolean;
  focusable: boolean;
  focused: boolean;
  error?: string;
  result?: string;
  next_action?: string;
  deadline?: string | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
  operation?: ObjectiveOperation;
  metadata?: Record<string, unknown>;
}

export interface ObjectivesSnapshot {
  objectives: OperationalObjective[];
  approvals: ObjectiveApproval[];
  operation: ObjectiveOperation;
  updated_at?: number | string | null;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function first(value: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }
  return undefined;
}

function text(value: JsonRecord, keys: string[], fallback = ""): string {
  const item = first(value, keys);
  return typeof item === "string" ? item.trim() : item === undefined ? fallback : String(item).trim();
}

function bool(value: JsonRecord, keys: string[], fallback: boolean): boolean {
  const item = first(value, keys);
  if (typeof item === "boolean") return item;
  if (typeof item === "string") {
    if (item.toLowerCase() === "true") return true;
    if (item.toLowerCase() === "false") return false;
  }
  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/%/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function percent(value: unknown): number {
  const record = asRecord(value);
  const raw = Object.keys(record).length
    ? first(record, ["percent", "percentage", "progress_pct", "progress", "value"])
    : value;
  const parsed = numberValue(raw, 0);
  const normalized = parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function status(value: unknown, kind: "objective" | "step"): ObjectiveStatus | ObjectiveStepStatus {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[- ]/g, "_");
  const aliases: Record<string, string> = {
    pending: "queued",
    waiting: "queued",
    running: "in_progress",
    active: "in_progress",
    started: "in_progress",
    done: "completed",
    complete: "completed",
    succeeded: "completed",
    success: "completed",
    error: "failed",
    needs_approval: "awaiting_approval",
    waiting_approval: "awaiting_approval",
    pending_approval: "awaiting_approval",
    canceled: "cancelled",
  };
  const normalized = aliases[raw] ?? raw;
  const allowed =
    kind === "step"
      ? new Set(["pending", "in_progress", "completed", "awaiting_approval", "blocked", "failed", "cancelled"])
      : new Set(["queued", "planning", "awaiting_approval", "in_progress", "paused", "blocked", "completed", "failed", "cancelled"]);
  return (allowed.has(normalized) ? normalized : "unknown") as ObjectiveStatus | ObjectiveStepStatus;
}

function approvalStatus(value: unknown): ApprovalStatus {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[- ]/g, "_");
  if (raw === "approved" || raw === "accepted" || raw === "allow") return "approved";
  if (raw === "rejected" || raw === "denied" || raw === "deny") return "rejected";
  if (raw === "pending" || raw === "requested" || raw === "waiting") return "pending";
  if (raw === "not_required" || raw === "none" || raw === "optional") return "not_required";
  return "unknown";
}

function normalizeApproval(value: unknown, index: number, fallbackObjectiveId?: string): ObjectiveApproval | null {
  const raw = asRecord(value);
  if (!Object.keys(raw).length) return null;
  const id = text(raw, ["id", "approval_id", "request_id"], `approval-${index}`);
  return {
    id,
    objective_id: text(raw, ["objective_id"], fallbackObjectiveId) || undefined,
    step_id: text(raw, ["step_id"], "") || undefined,
    status: approvalStatus(first(raw, ["status", "state"])),
    label: text(raw, ["label", "title", "name"], "") || undefined,
    reason: text(raw, ["reason", "message", "description"], "") || undefined,
    requested_at: first(raw, ["requested_at", "created_at", "ts"]) as number | string | null | undefined,
  };
}

function normalizeStep(value: unknown, index: number): ObjectivePlanStep | null {
  const raw = asRecord(value);
  if (!Object.keys(raw).length && typeof value !== "string") return null;
  const title = typeof value === "string" ? value.trim() : text(raw, ["title", "name", "step", "description"], `step ${index + 1}`);
  if (!title) return null;
  const stepStatus = status(first(raw, ["status", "state"]), "step") as ObjectiveStepStatus;
  const rawProgress = first(raw, ["progress", "progress_pct", "percent", "percentage"]);
  return {
    id: typeof value === "string" ? `step-${index}` : text(raw, ["id", "step_id"], `step-${index}`),
    title,
    description: text(raw, ["description", "note", "detail"], "") || undefined,
    status: stepStatus,
    progress: rawProgress === undefined ? (stepStatus === "completed" ? 100 : 0) : percent(rawProgress),
    approval_required: bool(raw, ["approval_required", "requires_approval"], false),
    approval_status: first(raw, ["approval_status", "approval_state"]) !== undefined
      ? approvalStatus(first(raw, ["approval_status", "approval_state"]))
      : undefined,
    updated_at: first(raw, ["updated_at", "finished_at", "completed_at"]) as number | string | null | undefined,
  };
}

export function normalizeObjective(value: unknown, index = 0): OperationalObjective {
  const raw = asRecord(value);
  const id = text(raw, ["id", "objective_id", "task_id", "run_id"], `objective-${index}`);
  const objective = text(raw, ["objective", "request", "goal", "description", "title", "name"], "Untitled objective");
  const title = text(raw, ["title", "name", "objective", "goal"], objective || `objective ${index + 1}`);
  const objectiveStatus = status(first(raw, ["status", "state", "lifecycle"]), "objective") as ObjectiveStatus;

  const planValue = first(raw, ["plan_steps", "steps", "plan"]);
  const planRecord = asRecord(planValue);
  const rawSteps = Array.isArray(planValue)
    ? planValue
    : Array.isArray(planRecord.steps)
      ? planRecord.steps
      : Array.isArray(planRecord.items)
        ? planRecord.items
        : [];
  const plan_steps = rawSteps.map(normalizeStep).filter((step): step is ObjectivePlanStep => step !== null);
  const directProgress = first(raw, ["progress", "progress_pct", "percent", "percentage"]);
  const progress = directProgress === undefined
    ? plan_steps.length
      ? Math.round(plan_steps.reduce((sum, step) => sum + step.progress, 0) / plan_steps.length)
      : objectiveStatus === "completed"
        ? 100
        : 0
    : percent(directProgress);

  const rawApprovals = first(raw, ["approvals", "approval_queue"]);
  const approvals = (Array.isArray(rawApprovals) ? rawApprovals : [])
    .map((approval, approvalIndex) => normalizeApproval(approval, approvalIndex, id))
    .filter((approval): approval is ObjectiveApproval => approval !== null);
  const singleApproval = normalizeApproval(first(raw, ["approval"]), approvals.length, id);
  if (singleApproval && !approvals.some((approval) => approval.id === singleApproval.id)) approvals.push(singleApproval);
  const rawApprovalStatus = first(raw, ["approval_status", "approval_state"]);
  const pendingApproval = approvals.find((approval) => approval.status === "pending");
  const approval_status = rawApprovalStatus !== undefined
    ? approvalStatus(rawApprovalStatus)
    : pendingApproval?.status;
  const approval_required = bool(raw, ["approval_required", "requires_approval"], Boolean(pendingApproval) || objectiveStatus === "awaiting_approval");

  const current = first(raw, ["current_step", "active_step"]);
  const currentRecord = asRecord(current);
  const current_step_id = text(raw, ["current_step_id", "active_step_id"], "") || text(currentRecord, ["id", "step_id"], "") || undefined;
  const current_step = typeof current === "string" ? current : text(currentRecord, ["title", "name", "step"], "") || undefined;
  const operationValue = first(raw, ["operation"]);
  const operation = operationValue ? normalizeOperation(operationValue) : undefined;

  return {
    id,
    title,
    objective,
    description: text(raw, ["description", "note", "summary"], "") || undefined,
    constraints: Array.isArray(raw.constraints) ? raw.constraints.map((item) => String(item)).filter(Boolean) : [],
    priority: text(raw, ["priority"], "normal") || "normal",
    kind: text(raw, ["kind"], "admin_objective") || "admin_objective",
    auto_start: bool(raw, ["auto_start"], true),
    repeat_days: numberValue(first(raw, ["repeat_days"]), 0),
    status: objectiveStatus,
    progress,
    plan_steps,
    current_step_id,
    current_step,
    approvals,
    approval_required,
    approval_status,
    retryable: bool(raw, ["retryable", "can_retry"], objectiveStatus === "failed" || objectiveStatus === "blocked" || objectiveStatus === "cancelled"),
    cancelable: bool(raw, ["cancelable", "cancellable", "can_cancel"], ["queued", "planning", "awaiting_approval", "in_progress", "paused", "blocked"].includes(objectiveStatus)),
    focusable: bool(raw, ["focusable", "can_focus"], true),
    focused: bool(raw, ["focused", "is_focused", "active"], false),
    error: text(raw, ["error", "failure", "last_error"], "") || undefined,
    result: text(raw, ["result", "output"], "") || undefined,
    next_action: text(raw, ["next_action"], "") || undefined,
    deadline: first(raw, ["deadline", "due_at"]) as string | null | undefined,
    created_at: first(raw, ["created_at", "requested_at"]) as number | string | null | undefined,
    updated_at: first(raw, ["updated_at", "finished_at", "completed_at"]) as number | string | null | undefined,
    operation,
    metadata: asRecord(first(raw, ["metadata", "meta"])),
  };
}

export function normalizeOperation(value: unknown): ObjectiveOperation {
  if (typeof value === "string") {
    return { objective: value.trim(), status: value.trim() ? "active" : "idle" };
  }
  const raw = asRecord(value);
  const objective = text(raw, ["objective", "title", "name", "goal", "text"], "");
  return {
    objective,
    status: text(raw, ["status", "state"], objective ? "active" : "idle"),
    objective_id: text(raw, ["objective_id", "id", "task_id"], "") || undefined,
    progress: first(raw, ["progress", "progress_pct", "percent", "percentage"]) === undefined
      ? undefined
      : percent(first(raw, ["progress", "progress_pct", "percent", "percentage"])),
    updated_at: first(raw, ["updated_at", "ts"]) as number | string | null | undefined,
  };
}

export function normalizeObjectivesResponse(value: unknown): ObjectivesSnapshot {
  const raw = asRecord(value);
  const rawObjectives = first(raw, ["objectives", "items", "data"]);
  const objectiveValues = Array.isArray(rawObjectives)
    ? rawObjectives
    : rawObjectives && typeof rawObjectives === "object"
      ? Object.values(rawObjectives as JsonRecord)
      : [];
  const objectives = objectiveValues.map((item, index) => normalizeObjective(item, index));
  const topLevelApprovalValues = first(raw, ["approvals", "approval_queue"]);
  const approvals = (Array.isArray(topLevelApprovalValues) ? topLevelApprovalValues : [])
    .map((approval, index) => normalizeApproval(approval, index))
    .filter((approval): approval is ObjectiveApproval => approval !== null);
  const operationValue = first(raw, ["operation", "active_operation", "current_operation"]);
  let operation = normalizeOperation(operationValue);
  const activeValue = first(raw, ["active_objective", "current_objective"]);
  if (!operation.objective && activeValue) {
    operation = typeof activeValue === "string"
      ? normalizeOperation(activeValue)
      : normalizeOperation({ ...asRecord(activeValue), objective_id: asRecord(activeValue).id });
  }
  const focused = objectives.find((objective) => objective.focused && objective.status !== "completed" && objective.status !== "cancelled");
  if (!operation.objective && focused) {
    operation = {
      objective: focused.objective || focused.title,
      status: focused.status,
      objective_id: focused.id,
      progress: focused.progress,
      updated_at: focused.updated_at,
    };
  }
  return {
    objectives,
    approvals,
    operation,
    updated_at: first(raw, ["updated_at", "ts"]) as number | string | null | undefined,
  };
}
