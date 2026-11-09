"use client";

import { useCallback, useEffect, useState } from "react";

type Submission = {
  id: string;
  code: string;
  name: string;
  role: string;
  country: string;
  acts: string;
  sources: string[];
  why: string;
  submitter: string;
  status: "pending" | "approved" | "rejected";
  verdict: string;
  createdAt: string;
};

type Auth = "loading" | "authed" | "unauth";

export default function AdminSubmissionsPage() {
  const [auth, setAuth] = useState<Auth>("loading");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Submission[]>([]);
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (which: "pending" | "all") => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/submissions?status=${which}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { submissions?: Submission[] };
      setItems(data.submissions ?? []);
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

  if (auth === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvasBlack text-chop-muted">
        <div className="animate-pulse text-xs uppercase tracking-[0.3em]">
          loading…
        </div>
      </div>
    );
  }

  if (auth === "unauth") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvasBlack px-4 text-sheetWhite">
        <div className="w-full max-w-sm border-2 border-glitchGray bg-black/60 p-6">
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">
            the review desk
          </h1>
          <p className="mt-2 text-[11px] text-chop-muted">
            Ada&apos;s inbox. Enter the admin key.
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
      <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 border-b-2 border-glitchGray pb-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-chop-muted">
            ada control
          </p>
          <h1 className="text-lg font-black uppercase tracking-[0.15em]">
            the review desk
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {(["pending", "all"] as const).map((which) => (
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
            </button>
          ))}
          <button
            onClick={() => load(status)}
            className="border-2 border-glitchGray px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-chop-muted hover:text-sheetWhite"
          >
            refresh
          </button>
          <a
            href="/admin"
            className="border-2 border-glitchGray px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-chop-muted hover:text-sheetWhite"
          >
            console
          </a>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-4xl space-y-4">
        <CoveragePanel />
        {loading && items.length === 0 && (
          <p className="text-xs uppercase tracking-[0.3em] text-chop-muted">
            reading the pile…
          </p>
        )}
        {!loading && items.length === 0 && (
          <p className="border-2 border-glitchGray p-6 text-center font-mono text-[11px] text-chop-muted">
            nothing {status === "pending" ? "waiting" : "on file"}.
          </p>
        )}

        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            onDone={() => {
              load(status);
            }}
          />
        ))}
      </main>
    </div>
  );
}

type CoverageRow = {
  name: string;
  status: "pending" | "running" | "done" | "failed";
  entries: number;
  checkedAt: string | null;
  lastError?: string;
};

type CoverageData = {
  total: number;
  pending: number;
  running: number;
  done: number;
  failed: number;
  unread: number;
  rows: CoverageRow[];
};

/**
 * The guarantee, visible: how many names in the line have actually been read.
 * A first look is a bounded dossier pass, and "nothing found" counts as read.
 */
function CoveragePanel() {
  const [data, setData] = useState<CoverageData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/coverage?rows=1", { cache: "no-store" });
      const json = (await response.json()) as CoverageData;
      if (!response.ok) throw new Error("coverage unavailable");
      setData(json);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "coverage unavailable");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runNext() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/coverage?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "first look failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "first look failed");
    } finally {
      setBusy(false);
    }
  }

  const next = (data?.rows ?? []).filter((r) => r.status !== "done").slice(0, 3);

  return (
    <section className="border-2 border-glitchGray bg-chop-card/40 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-chop-muted">
            record coverage
          </p>
          <p className="mt-1 text-sm font-bold text-sheetWhite">
            {data ? `${data.done} of ${data.total} names read` : "reading…"}
            {data && data.unread > 0 && (
              <span className="ml-2 font-mono text-[10px] font-normal text-amber-400">
                {data.unread} unread
              </span>
            )}
          </p>
        </div>
        <button
          onClick={runNext}
          disabled={busy || !data || data.unread === 0}
          className="border-2 border-hypeNeon px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-hypeNeon hover:bg-hypeNeon hover:text-black disabled:border-glitchGray disabled:text-chop-muted"
        >
          {busy ? "reading…" : "run next first look"}
        </button>
      </div>
      {data && next.length > 0 && (
        <p className="mt-2 font-mono text-[10px] text-chop-muted">
          next: {next.map((r) => `${r.name} (${r.status})`).join(" · ")}
        </p>
      )}
      {error && <p className="mt-2 font-mono text-[10px] text-spiteCrimson">{error}</p>}
    </section>
  );
}

function ReviewCard({
  item,
  onDone,
}: {
  item: Submission;
  onDone: () => void;
}) {
  const [verdict, setVerdict] = useState(item.verdict);
  const [score, setScore] = useState("70");
  const [role, setRole] = useState(item.role);
  const [country, setCountry] = useState(item.country);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          action,
          verdict,
          score: Number(score),
          role,
          country,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "failed");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="border-2 border-glitchGray bg-black/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight">
            {item.name}
          </h2>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
            {[item.role, item.country].filter(Boolean).join(" · ") || "no role"} ·
            code {item.code} ·{" "}
            {item.createdAt.slice(0, 16).replace("T", " ")}
          </p>
        </div>
        <span
          className={`border-2 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] ${
            item.status === "pending"
              ? "border-hypeNeon text-hypeNeon"
              : item.status === "approved"
                ? "border-[#3ddc84] text-[#3ddc84]"
                : "border-spiteCrimson text-spiteCrimson"
          }`}
        >
          {item.status}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-sheetWhite/85">
        {item.acts}
      </p>
      {item.why && (
        <p className="mt-2 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-chop-muted">
          why: {item.why}
        </p>
      )}
      <ul className="mt-2 space-y-1">
        {item.sources.map((source) => (
          <li key={source}>
            <a
              href={source}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all font-mono text-[10px] text-hypeNeon underline decoration-hypeNeon/40"
            >
              {source}
            </a>
          </li>
        ))}
      </ul>

      {item.status === "pending" ? (
        <div className="mt-4 space-y-3 border-t-2 border-glitchGray pt-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <div>
              <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                verdict — shown to the submitter
              </label>
              <textarea
                value={verdict}
                onChange={(e) => setVerdict(e.target.value)}
                rows={2}
                placeholder="The record holds / not evil enough because…"
                className="w-full border-2 border-glitchGray bg-black px-2 py-1.5 font-mono text-[11px] text-sheetWhite focus:border-hypeNeon focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                score 0–100
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full border-2 border-glitchGray bg-black px-2 py-1.5 font-mono text-[11px] text-sheetWhite focus:border-hypeNeon focus:outline-none"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="role"
              className="border-2 border-glitchGray bg-black px-2 py-1.5 font-mono text-[11px] text-sheetWhite focus:border-hypeNeon focus:outline-none"
            />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="country"
              className="border-2 border-glitchGray bg-black px-2 py-1.5 font-mono text-[11px] text-sheetWhite focus:border-hypeNeon focus:outline-none"
            />
          </div>
          {error && <p className="text-[10px] text-spiteCrimson">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => decide("approve")}
              className="border-2 border-black bg-hypeNeon px-4 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.15em] text-black hover:bg-sheetWhite disabled:opacity-50"
            >
              {busy ? "…" : "approve → add to the line"}
            </button>
            <button
              disabled={busy}
              onClick={() => decide("reject")}
              className="border-2 border-spiteCrimson px-4 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.15em] text-spiteCrimson hover:bg-spiteCrimson hover:text-sheetWhite disabled:opacity-50"
            >
              reject — not evil enough
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t-2 border-glitchGray pt-3 font-mono text-[10px] leading-relaxed text-chop-muted">
          verdict: {item.verdict || "—"}
        </p>
      )}
    </article>
  );
}