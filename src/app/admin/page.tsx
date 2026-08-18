"use client";

import { useEffect, useState } from "react";
import { AdminChat } from "@/components/admin/AdminChat";
import { AdminStatus } from "@/components/admin/AdminStatus";
import { AdminCosts } from "@/components/admin/AdminCosts";
import { AdminMind } from "@/components/admin/AdminMind";
import { AdminActions } from "@/components/admin/AdminActions";
import { AdminConfig } from "@/components/admin/AdminConfig";
import { AdminCodebase } from "@/components/admin/AdminCodebase";
import { AdminChatLog } from "@/components/admin/AdminChatLog";
import { AdminTasksBoard } from "@/components/admin/AdminTasksBoard";

type Tab = "chat" | "status" | "costs" | "mind" | "actions" | "config" | "codebase" | "chatlog" | "tasks";

const NAV: { id: Tab; label: string }[] = [
  { id: "chat", label: "Direct Line" },
  { id: "status", label: "Status" },
  { id: "costs", label: "Costs" },
  { id: "mind", label: "Mind" },
  { id: "tasks", label: "Tasks" },
  { id: "actions", label: "Actions" },
  { id: "config", label: "Config" },
  { id: "codebase", label: "Codebase" },
  { id: "chatlog", label: "Chat Log" },
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
    <div className="flex bg-canvasBlack text-sheetWhite" style={{ height: "calc(100vh - 30px)" }}>
      {/* Sidebar */}
      <aside className="flex w-48 shrink-0 flex-col border-r-2 border-glitchGray bg-black/40">
        <div className="border-b-2 border-glitchGray px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-hypeNeon" />
            <span className="text-xs font-black uppercase tracking-[0.15em]">ada control</span>
          </div>
          <p className="mt-1 text-[9px] uppercase tracking-widest text-chop-muted">
            direct line · full telemetry
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              className={`block w-full border px-3 py-2 text-left text-xs font-bold uppercase tracking-wider ${
                tab === n.id
                  ? "border-hypeNeon bg-hypeNeon/10 text-hypeNeon"
                  : "border-transparent text-chop-muted hover:border-glitchGray hover:text-sheetWhite"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="border-t-2 border-glitchGray p-2">
          <button
            onClick={logout}
            className="w-full border border-spiteCrimson px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-spiteCrimson hover:bg-spiteCrimson hover:text-black"
          >
            lock console
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className={tab === "chat" ? "flex h-full flex-col" : "mx-auto max-w-5xl p-4"}>
          {tab === "chat" && <AdminChat onLogout={logout} />}
          {tab === "status" && <AdminStatus />}
          {tab === "costs" && <AdminCosts />}
          {tab === "mind" && <AdminMind />}
          {tab === "tasks" && (
            <div className="mx-auto max-w-5xl p-4">
              <AdminTasksBoard wide />
            </div>
          )}
          {tab === "actions" && <AdminActions />}
          {tab === "config" && <AdminConfig />}
          {tab === "codebase" && <AdminCodebase />}
          {tab === "chatlog" && <AdminChatLog />}
        </div>
      </main>
    </div>
  );
}
