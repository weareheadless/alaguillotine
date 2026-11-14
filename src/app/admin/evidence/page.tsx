"use client";

import { useCallback, useEffect, useState } from "react";

type Status = "pending" | "accepted" | "rejected" | "legacy";

type Row = {
  id: string;
  person: string;
  role: string;
  act: string;
  place: string;
  year: number;
  category: string;
  confidence: number;
  sources: string[];
  caseId: string;
  createdAt: string;
  reviewStatus: Status;
  reviewNote: string;
  actDate: string | null;
  datePrecision: string;
};

type Counts = Record<Status, number> & { total?: number };

/**
 * The evidence desk.
 *
 * Nothing enters the score without a person here saying it may. The queue of
 * pending claims is the worklist; the audit is the mechanical pass that moves
 * the ones that cannot stand — sanctions dated by the enforcement, receipts
 * filed from a headline, a 1980 order filed as this year — into review with
 * their reason attached.
 */
export default function AdminEvidencePage() {
  const [auth, setAuth] = useState<"loading" | "authed" | "unauth">("loading");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | "all">("pending");
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const load = useCallback(async (which: Status | "all") => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/evidence?status=${which}&limit=100`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        rows?: Row[];
        total?: number;
        counts?: Counts;
      };
      setItems(data.rows ?? []);
      setTotal(data.total ?? 0);
      setCounts(data.counts ?? null);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.authed) {
          setAuth("authed");
          load("pending");
        } else {
          setAuth("unauth");
        }
      })
      .catch(() => setAuth("unauth"));
  }, [load]);

  async function login() {
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? "bad key");
      setAuth("authed");
      load(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    }
  }

  async function review(row: Row, next: Status) {
    const note =
      next === "rejected"
        ? window.prompt(`Why is this claim rejected? It stays on the record.\n\n${row.act}`)
        : next === "accepted"
          ? window.prompt("What establishes the act and its date?", row.reviewNote || "")
          : "";
    if (next === "rejected" && !note) return;
    await fetch("/api/admin/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, status: next, note: note ?? "" }),
    });
    load(status);
  }

  async function audit() {
    setReport(null);
    const response = await fetch("/api/admin/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audit: true }),
    });
    const data = await response.json();
    if (!response.ok) {
      setReport(data?.error ?? "audit failed");
      return;
    }
    setReport(
      `${data.flagged} of ${data.scanned} legacy claims moved to review: ` +
        Object.entries(data.byRule ?? {})
          .map(([rule, n]) => `${rule} ${n}`)
          .join(", "),
    );
    load(status);
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
        <div className="w-full max-w-sm border-2 border-glitchGray bg-black/60 p-6">
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">the evidence desk</h1>
          <p className="mt-2 text-[11px] text-chop-muted">Enter the admin key.</p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="admin key"
            className="mt-4 w-full border-2 border-glitchGray bg-black px-3 py-2 text-sm text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
            autoFocus
          />
          {error && <p className="mt-2 text-xs text-spiteCrimson">{error}</p>}
          <button
            onClick={login}
            className="mt-3 w-full border-2 border-hypeNeon bg-hypeNeon px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-black hover:text-hypeNeon"
          >
            unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvasBlack px-4 py-6 text-sheetWhite sm:px-6">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 border-b-2 border-glitchGray pb-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
            evidence · review
          </p>
          <h1 className="text-lg font-black uppercase tracking-[0.15em]">the evidence desk</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["pending", "accepted", "rejected", "legacy", "all"] as const).map((which) => (
            <button
              key={which}
              onClick={() => {
                setStatus(which);
                load(which);
              }}
              className={`border-2 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] ${
                status === which
                  ? "border-hypeNeon bg-hypeNeon text-black"
                  : "border-glitchGray text-chop-muted hover:text-sheetWhite"
              }`}
            >
              {which}
              {counts && which !== "all" ? ` ${counts[which]}` : ""}
            </button>
          ))}
          <button
            onClick={() => load(status)}
            className="border-2 border-glitchGray px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-chop-muted hover:text-sheetWhite"
          >
            refresh
          </button>
          <button
            onClick={audit}
            className="border-2 border-spiteCrimson px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-spiteCrimson hover:bg-spiteCrimson hover:text-black"
          >
            run audit
          </button>
          <a
            href="/admin"
            className="border-2 border-glitchGray px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-chop-muted hover:text-sheetWhite"
          >
            console
          </a>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-5xl space-y-4">
        {report && (
          <p className="border-2 border-glitchGray p-3 font-mono text-[10px] text-chop-muted">
            {report}
          </p>
        )}
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
          {total} in {status}
        </p>
        {loading && items.length === 0 && (
          <p className="text-xs uppercase tracking-[0.3em] text-chop-muted">reading the pile…</p>
        )}
        {!loading && items.length === 0 && (
          <p className="border-2 border-glitchGray p-6 text-center font-mono text-[11px] text-chop-muted">
            nothing {status === "all" ? "on file" : `in ${status}`}.
          </p>
        )}

        {items.map((row) => (
          <article key={row.id} className="border-2 border-glitchGray p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
              <span className="text-[12px] font-bold tracking-normal text-sheetWhite">
                {row.person}
              </span>
              <span>·</span>
              <span>{row.role || "role unknown"}</span>
              <span>·</span>
              <span className="tabular-nums">{row.year}</span>
              <span>·</span>
              <span>{row.category}</span>
              <span>·</span>
              <span className="tabular-nums">{Math.round(row.confidence)}</span>
              <span>·</span>
              <span className="text-hypeNeon">{row.reviewStatus}</span>
              <span className="ml-auto">{row.caseId}</span>
            </div>
            <p className="mt-2 text-[14px] leading-snug text-sheetWhite/90">{row.act}</p>
            {row.reviewNote && (
              <p className="mt-1 font-mono text-[10px] text-spiteCrimson/90">{row.reviewNote}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-[0.14em]">
              {row.sources.slice(0, 2).map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-chop-muted underline hover:text-sheetWhite"
                >
                  source ↗
                </a>
              ))}
              {row.actDate && <span className="text-chop-muted">act {row.actDate}</span>}
              <span className="text-chop-muted">{row.datePrecision}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => review(row, "accepted")}
                className="border-2 border-hypeNeon px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-hypeNeon hover:bg-hypeNeon hover:text-black"
              >
                accept
              </button>
              <button
                onClick={() => review(row, "rejected")}
                className="border-2 border-spiteCrimson px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-spiteCrimson hover:bg-spiteCrimson hover:text-black"
              >
                reject
              </button>
              <button
                onClick={() => review(row, "pending")}
                className="border-2 border-glitchGray px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-chop-muted hover:text-sheetWhite"
              >
                hold
              </button>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
