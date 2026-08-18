"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill, Loading, ErrorBox, relTs, Empty } from "./admin-ui";

interface Subtask {
  text: string;
  done: boolean;
  ts?: number;
}

interface Task {
  name: string;
  project: string;
  status: "open" | "in_progress" | "done";
  note?: string;
  progress?: string;
  source?: string;
  updated?: number;
  subtasks?: Subtask[];
}

interface Project {
  name: string;
  created?: number;
  updated?: number;
  count?: number;
  open?: number;
  in_progress?: number;
  done?: number;
  tasks?: Task[];
}

interface TasksData {
  projects?: Project[];
  tasks?: Task[];
}

const STATUS_TONE: Record<string, string> = {
  open: "gray",
  in_progress: "yellow",
  done: "green",
};

const POLL_MS = 15000;

async function api(path: string, body?: Record<string, unknown>) {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

function subtaskCount(t: Task): string {
  const subs = t.subtasks ?? [];
  if (!subs.length) return "";
  const done = subs.filter((s) => s.done).length;
  return `✓ ${done}/${subs.length}`;
}

function TaskRow({
  task,
  onMutate,
  busy,
}: {
  task: Task;
  onMutate: (body: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState("");
  const [newSub, setNewSub] = useState("");
  const subs = task.subtasks ?? [];
  const doneCount = subs.filter((s) => s.done).length;
  const allDone = subs.length > 0 && doneCount === subs.length;

  return (
    <li className="border border-glitchGray bg-black/60">
      <div className="flex items-start gap-2 px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {subs.length > 0 && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="text-[10px] text-chop-muted hover:text-hypeNeon"
                title="toggle subtasks"
              >
                {open ? "▾" : "▸"}
              </button>
            )}
            <span className={`text-xs font-bold ${task.status === "done" ? "text-chop-muted line-through" : "text-sheetWhite"}`}>
              {task.name}
            </span>
            <Pill tone={STATUS_TONE[task.status] ?? "gray"}>{task.status.replace("_", " ")}</Pill>
            {task.source && task.source !== "human" && (
              <Pill tone="gray">{task.source === "self" ? "SELF" : task.source.toUpperCase()}</Pill>
            )}
            {subs.length > 0 && (
              <Pill tone={allDone && task.status !== "done" ? "yellow" : "gray"}>{subtaskCount(task)}</Pill>
            )}
          </div>
          {task.note && <p className="mt-0.5 text-[10px] leading-snug text-chop-muted">{task.note}</p>}
          {task.progress && task.status !== "done" && (
            <p className="mt-0.5 text-[10px] leading-snug text-hypeNeon/80">{task.progress}</p>
          )}
          {typeof task.updated === "number" && (
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-chop-muted">
              updated {relTs(task.updated)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {task.status === "open" && (
            <button
              onClick={() => onMutate({ action: "update", name: task.name, project: task.project, status: "in_progress" })}
              disabled={busy}
              className="border border-hypeNeon/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-hypeNeon hover:bg-hypeNeon hover:text-black disabled:opacity-40"
            >
              start
            </button>
          )}
          {task.status !== "done" && (
            <button
              onClick={() => onMutate({ action: "complete", name: task.name, project: task.project })}
              disabled={busy}
              className="border border-hypeNeon px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-hypeNeon hover:bg-hypeNeon hover:text-black disabled:opacity-40"
            >
              done
            </button>
          )}
          <button
            onClick={() => onMutate({ action: "delete", name: task.name, project: task.project })}
            disabled={busy}
            className="border border-spiteCrimson/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-spiteCrimson hover:bg-spiteCrimson hover:text-black disabled:opacity-40"
          >
            ×
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-glitchGray px-3 py-2">
          {subs.length === 0 && (
            <p className="mb-1 text-[10px] text-chop-muted">no subtasks yet</p>
          )}
          <ul className="space-y-0.5">
            {subs.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <button
                  onClick={() => onMutate({ action: "subtask_toggle", name: task.name, project: task.project, index: i })}
                  disabled={busy}
                  className={`h-3.5 w-3.5 shrink-0 border ${s.done ? "border-hypeNeon bg-hypeNeon" : "border-glitchGray"}`}
                  aria-label={s.done ? "mark subtask undone" : "mark subtask done"}
                >
                  {s.done && <span className="block text-[9px] leading-none text-black">✓</span>}
                </button>
                <span className={`text-[11px] ${s.done ? "text-chop-muted line-through" : "text-sheetWhite/90"}`}>
                  {s.text}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSub.trim()) {
                  onMutate({ action: "subtask_add", name: task.name, project: task.project, text: newSub.trim() });
                  setNewSub("");
                }
              }}
              placeholder="+ add subtask"
              className="min-w-0 flex-1 border border-glitchGray bg-black px-2 py-1 text-[11px] text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
            />
          </div>
        </div>
      )}

      {task.status !== "done" && (
        <div className="flex items-center gap-1.5 border-t border-glitchGray/60 px-3 py-1.5">
          <input
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && progress.trim()) {
                onMutate({ action: "update", name: task.name, project: task.project, status: "in_progress", progress: progress.trim() });
                setProgress("");
              }
            }}
            placeholder="log progress…"
            className="min-w-0 flex-1 border border-glitchGray bg-black px-2 py-1 text-[11px] text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
          />
          <button
            onClick={() => {
              if (progress.trim()) {
                onMutate({ action: "update", name: task.name, project: task.project, status: "in_progress", progress: progress.trim() });
                setProgress("");
              }
            }}
            disabled={busy || !progress.trim()}
            className="border border-hypeNeon/60 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider text-hypeNeon hover:bg-hypeNeon hover:text-black disabled:opacity-40"
          >
            log
          </button>
        </div>
      )}
    </li>
  );
}

export function AdminTasksBoard({ wide = false }: { wide?: boolean }) {
  const [data, setData] = useState<TasksData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [note, setNote] = useState("");
  const [subtaskLines, setSubtaskLines] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    try {
      const j = await api("/api/admin/proxy/tasks");
      setData(j as TasksData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load tasks");
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api("/api/admin/proxy/tasks", body);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "task update failed");
    } finally {
      setBusy(false);
    }
  }

  async function addTask() {
    if (!name.trim() || busy) return;
    const subs = subtaskLines
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    await mutate({
      action: "create",
      name: name.trim(),
      project: project.trim(),
      note: note.trim(),
      subtasks: subs,
    });
    setName("");
    setNote("");
    setSubtaskLines("");
    setAddOpen(false);
  }

  if (error && !data) return <ErrorBox msg={error} onRetry={refresh} />;

  const projects = data?.projects ?? [];
  const total = projects.reduce((n, p) => n + (p.count ?? 0), 0);

  return (
    <div className={wide ? "space-y-4" : "flex h-full flex-col"}>
      <div className="flex items-center justify-between gap-2 border-b border-glitchGray px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-hypeNeon">
            task board
          </h3>
          <p className="text-[9px] uppercase tracking-wider text-chop-muted">
            {projects.length} project{projects.length === 1 ? "" : "s"} · {total} task{total === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => setAddOpen((o) => !o)}
          className="shrink-0 border border-hypeNeon px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-hypeNeon hover:bg-hypeNeon hover:text-black"
        >
          {addOpen ? "close" : "+ task"}
        </button>
      </div>

      {addOpen && (
        <div className="mx-3 my-2 border-2 border-hypeNeon/40 bg-chop-card p-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="task name *"
            className="mb-1.5 w-full border border-glitchGray bg-black px-2 py-1.5 text-xs text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
          />
          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="project (default: General)"
            className="mb-1.5 w-full border border-glitchGray bg-black px-2 py-1.5 text-xs text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="note / what it means"
            className="mb-1.5 w-full resize-y border border-glitchGray bg-black px-2 py-1.5 text-xs text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
          />
          <textarea
            value={subtaskLines}
            onChange={(e) => setSubtaskLines(e.target.value)}
            rows={2}
            placeholder={"subtasks, one per line (optional)\ne.g.\noutline\ndraft\npublish"}
            className="mb-2 w-full resize-y border border-glitchGray bg-black px-2 py-1.5 text-[11px] text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
          />
          <button
            onClick={addTask}
            disabled={!name.trim() || busy}
            className="w-full border border-hypeNeon bg-hypeNeon px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black hover:bg-black hover:text-hypeNeon disabled:opacity-40"
          >
            create task
          </button>
        </div>
      )}

      {error && (
        <p className="mx-3 text-[10px] text-spiteCrimson">
          <span className="font-bold">ERROR:</span> {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!data ? (
          <Loading />
        ) : projects.length === 0 ? (
          <Empty msg="no projects yet — add a task to start the board" />
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const tasks = p.tasks ?? [];
              const isCollapsed = collapsed[p.name];
              return (
                <div key={p.name} className="border-2 border-glitchGray bg-chop-card/60">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [p.name]: !c[p.name] }))}
                    className="flex w-full items-center justify-between gap-2 border-b-2 border-glitchGray px-2 py-1.5 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-[10px] text-chop-muted">{isCollapsed ? "▸" : "▾"}</span>
                      <span className="text-xs font-black uppercase tracking-wider text-sheetWhite">{p.name}</span>
                      <span className="text-[9px] uppercase tracking-wider text-chop-muted">
                        {p.open ?? 0} open · {p.in_progress ?? 0} in progress · {p.done ?? 0} done
                      </span>
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-chop-muted">
                      {typeof p.updated === "number" ? relTs(p.updated) : ""}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <ul className="space-y-1.5 p-1.5">
                      {tasks.length === 0 && (
                        <li className="px-2 py-1 text-[10px] text-chop-muted">no tasks in this project</li>
                      )}
                      {tasks.map((t) => (
                        <TaskRow key={`${p.name}:${t.name}`} task={t} onMutate={mutate} busy={busy} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}