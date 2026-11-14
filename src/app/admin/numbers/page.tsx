"use client";

import { useCallback, useEffect, useState } from "react";

type Status = "pending" | "accepted" | "rejected" | "legacy";

type Row = {
  slug: string;
  person: string;
  kind: string;
  label: string;
  display: string;
  year: number | null;
  sourceUrl: string;
  evidenceQuote: string;
  confidence: number;
  qualifier: string;
  whose: string;
  grade: string;
  gradeBasis: string;
  reviewStatus: Status;
};

/**
 * The figures desk.
 *
 * A number is easier to check than a claim and harder to argue with once it is
 * on the page, which is why the ones nobody checked did the most damage: a
 * projection filed as a toll, a country's mortality filed against a minister,
 * a company's profit filed as a man's money. Each row here is one figure and
 * the sentence it came from.
 */
export default function AdminNumbersPage() {
  const [auth, setAuth] = useState<"loading" | "authed" | "unauth">("loading");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | "all">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async (next: Status | "all") => {
    const response = await fetch(`/api/admin/numbers?status=${next}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { rows: Row[]; counts: Record<string, number> };
    setRows(data.rows ?? []);
    setCounts(data.counts ?? {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.authed) {
          setAuth("authed");
          load("pending");
        } else setAuth("unauth");
      })
      .catch(() => setAuth("unauth"));
  }, [load]);

  async function login() {
    setError(null);
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await response.json();
    if (!response.ok || !data?.ok) {
      setError(data?.error ?? "bad key");
      return;
    }
    setAuth("authed");
    load("pending");
  }

  async function review(row: Row, next: Status) {
    let qualifier = row.qualifier;
    let whose = row.whose;
    let grade = row.grade;
    let basis = "";
    if (next === "accepted") {
      qualifier = (window.prompt("qualifier: recorded / attributed / projected / estimate", qualifier) ?? "").toLowerCase();
      whose = (window.prompt("whose money or toll: person / firm / fund / state", whose) ?? "").toLowerCase();
      grade = (window.prompt("grade A/B/C/D", grade || "C") ?? "").toUpperCase();
      if (!grade) return;
      if (grade === "A" || grade === "B") {
        basis = window.prompt(`What establishes it at grade ${grade}? (required)`, row.gradeBasis || "") ?? "";
        if (!basis) return;
      }
    }
    if (next === "rejected") {
      basis = window.prompt(`Why does this figure not stand?\n\n${row.display} — ${row.label}\n\n${row.evidenceQuote}`) ?? "";
      if (!basis) return;
    }
    await fetch("/api/admin/numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: row.slug,
        kind: row.kind,
        label: row.label,
        status: next,
        qualifier,
        whose,
        grade,
        basis,
      }),
    });
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
      <div className="flex min-h-screen items-center justify-center bg-canvasBlack px-6">
        <div className="w-full max-w-sm">
          <h1 className="font-mono text-[11px] uppercase tracking-[0.3em] text-sheetWhite">the figures desk</h1>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="admin key"
            className="mt-4 w-full border border-chop-border bg-black px-3 py-2 font-mono text-xs text-sheetWhite outline-none"
          />
          {error ? <p className="mt-2 font-mono text-[10px] text-spiteCrimson">{error}</p> : null}
          <button
            onClick={login}
            className="mt-3 border border-chop-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-sheetWhite hover:border-spiteCrimson"
          >
            enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvasBlack px-5 py-8 text-sheetWhite">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.3em]">the figures desk</h1>
        <p className="mt-2 max-w-2xl font-mono text-[10px] leading-relaxed text-chop-muted">
          Numbers are held until someone reads the sentence they came from. Accept sets the
          qualifier (recorded, attributed, projected, estimate), whose figure it is, and a grade.
          A and B need a written basis.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["pending", "accepted", "rejected", "legacy", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                load(s);
              }}
              className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                status === s ? "border-spiteCrimson text-spiteCrimson" : "border-chop-border text-chop-muted"
              }`}
            >
              {s} {counts[s] != null ? `· ${counts[s]}` : ""}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="mt-6 font-mono text-[11px] text-chop-muted">nothing here.</p>
        ) : (
          <ul className="mt-6 divide-y divide-chop-border">
            {rows.map((row) => (
              <li key={`${row.slug}-${row.kind}-${row.label}`} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                  <span className="text-sheetWhite">{row.slug}</span>
                  <span>·</span>
                  <span>{row.kind}</span>
                  {row.year ? (
                    <>
                      <span>·</span>
                      <span>{row.year}</span>
                    </>
                  ) : null}
                  <span>·</span>
                  <span>{row.reviewStatus}</span>
                  {row.grade ? <span className="border border-chop-border px-1">{row.grade}</span> : null}
                  {row.qualifier ? <span className="text-hypeNeon">{row.qualifier}</span> : null}
                  {row.whose ? <span>whose: {row.whose}</span> : null}
                </div>

                <p className="mt-1.5">
                  <span className="font-mono text-lg font-black tabular-nums text-spiteCrimson">{row.display}</span>{" "}
                  <span className="text-[13px] text-sheetWhite/85">{row.label}</span>
                </p>
                <p className="mt-1 font-mono text-[10px] leading-snug text-chop-muted">{row.evidenceQuote}</p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => review(row, "accepted")}
                    className="border border-chop-border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] hover:border-hypeNeon hover:text-hypeNeon"
                  >
                    accept
                  </button>
                  <button
                    onClick={() => review(row, "rejected")}
                    className="border border-chop-border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] hover:border-spiteCrimson hover:text-spiteCrimson"
                  >
                    reject
                  </button>
                  <button
                    onClick={() => review(row, "pending")}
                    className="border border-chop-border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] hover:text-sheetWhite"
                  >
                    hold
                  </button>
                  <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted underline underline-offset-2 hover:text-sheetWhite"
                  >
                    source ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
