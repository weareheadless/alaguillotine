"use client";

import { useEffect, useState } from "react";
import { AdminChat } from "@/components/admin/AdminChat";
import { AdminStatus } from "@/components/admin/AdminStatus";
import { AdminMind } from "@/components/admin/AdminMind";
import { AdminActions } from "@/components/admin/AdminActions";
import { AdminConfig } from "@/components/admin/AdminConfig";
import { AdminCodebase } from "@/components/admin/AdminCodebase";
import { AdminChatLog } from "@/components/admin/AdminChatLog";
import { AdminRuntime } from "@/components/admin/AdminRuntime";
import { AdminMaintenance } from "@/components/admin/AdminMaintenance";
import { AdminPermissions } from "@/components/admin/AdminPermissions";
import { AdminRecovery } from "@/components/admin/AdminRecovery";
import { AdminTokens } from "@/components/admin/AdminTokens";
import { AdminArchitecture } from "@/components/admin/AdminArchitecture";
import { AdminObjectiveStrip } from "@/components/admin/AdminObjectiveStrip";
import { AdminObjectivesBoard } from "@/components/admin/AdminObjectivesBoard";
import { ObjectiveProvider } from "@/lib/objective-context";

type Tab =
  | "chat"
  | "runtime"
  | "maintenance"
  | "permissions"
  | "recovery"
  | "tokens"
  | "status"
  | "mind"
  | "actions"
  | "config"
  | "codebase"
  | "chatlog"
  | "tasks"
  | "architecture";

const NAV: { id: Tab; label: string }[] = [
  { id: "chat", label: "Direct Line" },
  { id: "runtime", label: "Runtime" },
  { id: "maintenance", label: "Maintenance" },
  { id: "permissions", label: "Permissions" },
  { id: "recovery", label: "Recovery" },
  { id: "tokens", label: "Tokens" },
  { id: "status", label: "Status" },
  { id: "mind", label: "Mind" },
  { id: "tasks", label: "Objectives" },
  { id: "actions", label: "Actions" },
  { id: "config", label: "Config" },
  { id: "codebase", label: "Codebase" },
  { id: "chatlog", label: "Chat Log" },
  { id: "architecture", label: "Architecture" },
];

type Auth = "loading" | "authed" | "unauth";

export default function AdminPage() {
  const [auth, setAuth] = useState<Auth>("loading");
  const [tab, setTab] = useState<Tab>("chat");
  const [key, setKey] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setAuth(j?.authed ? "authed" : "unauth"))
      .catch(() => setAuth("unauth"));
  }, []);

  async function login() {
    setErr(null);
    try {
      const r = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "bad key");
      setAuth("authed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "login failed");
    }
  }

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    setAuth("unauth");
  }

  if (auth === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvasBlack text-chop-muted">
        <div className="animate-pulse text-xs uppercase tracking-[0.3em]">loading…</div>
      </div>
    );
  }

  if (auth === "unauth") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvasBlack px-4 text-sheetWhite">
        <div className="w-full max-w-sm border-2 border-glitchGray bg-chop-card/60 p-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-spiteCrimson" />
            <h1 className="text-sm font-black uppercase tracking-[0.2em]">
              ada control room
            </h1>
          </div>
          <p className="mt-2 text-[11px] text-chop-muted">
            locked. enter the admin key to open the direct line and every
            internal readout.
          </p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="admin key"
            className="mt-4 w-full border-2 border-glitchGray bg-black px-3 py-2 text-sm text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
            autoFocus
          />
          {err && <p className="mt-2 text-xs text-spiteCrimson">{err}</p>}
          <button
            onClick={login}
            className="mt-3 w-full border-2 border-hypeNeon bg-hypeNeon px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-black hover:text-hypeNeon"
          >
            unlock
          </button>
          <p className="mt-4 text-[10px] text-chop-muted">
            the key lives in /FYE/.env.local (ADMIN_KEY). this console is
            gated at the API layer and proxy, not just in the UI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ObjectiveProvider>
      <div className="flex h-[calc(100dvh-30px)] min-h-0 flex-col overflow-hidden bg-canvasBlack text-sheetWhite md:flex-row">
        {/* Sidebar */}
        <aside className="sticky top-0 z-30 flex w-full shrink-0 flex-col border-b-2 border-glitchGray bg-black/95 md:h-full md:w-52 md:border-b-0 md:border-r-2">
          <div className="border-b-2 border-glitchGray px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-hypeNeon" />
              <span className="text-xs font-black uppercase tracking-[0.15em]">ada control</span>
            </div>
            <p className="mt-1 text-[9px] uppercase tracking-widest text-chop-muted">
              control plane · full telemetry
            </p>
            <button
              onClick={logout}
              className="mt-2 border border-spiteCrimson px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-spiteCrimson hover:bg-spiteCrimson hover:text-black md:hidden"
            >
              lock console
            </button>
          </div>
          <AdminObjectiveStrip onOpenTasks={() => setTab("tasks")} />
          <nav className="flex min-h-0 flex-1 gap-0.5 overflow-x-auto p-2 md:block md:space-y-0.5 md:overflow-y-auto">
            <a
              href="/admin/submissions"
              className="block shrink-0 border border-hypeNeon/60 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-hypeNeon hover:bg-hypeNeon hover:text-black md:w-full md:text-xs"
            >
              review desk →
            </a>
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`block shrink-0 border px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider md:w-full md:text-xs ${
                  tab === n.id
                    ? "border-hypeNeon bg-hypeNeon/10 text-hypeNeon"
                    : "border-transparent text-chop-muted hover:border-glitchGray hover:text-sheetWhite"
                }`}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="hidden border-t-2 border-glitchGray p-2 md:block">
            <button
              onClick={logout}
              className="w-full border border-spiteCrimson px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-spiteCrimson hover:bg-spiteCrimson hover:text-black"
            >
              lock console
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className={tab === "chat" ? "flex h-full min-h-0 flex-col" : "mx-auto max-w-6xl p-3 sm:p-4"}>
            {tab === "chat" && <AdminChat onLogout={logout} />}
            {tab === "runtime" && <AdminRuntime />}
            {tab === "maintenance" && <AdminMaintenance />}
            {tab === "permissions" && <AdminPermissions />}
            {tab === "recovery" && <AdminRecovery />}
            {tab === "tokens" && <AdminTokens />}
            {tab === "status" && <AdminStatus />}
            {tab === "mind" && <AdminMind />}
            {tab === "tasks" && (
              <div className="mx-auto max-w-7xl space-y-4 p-4">
                <AdminObjectivesBoard />
              </div>
            )}
            {tab === "actions" && <AdminActions />}
            {tab === "config" && <AdminConfig />}
            {tab === "codebase" && <AdminCodebase />}
            {tab === "chatlog" && <AdminChatLog />}
            {tab === "architecture" && <AdminArchitecture />}
          </div>
        </main>
      </div>
    </ObjectiveProvider>
  );
}
