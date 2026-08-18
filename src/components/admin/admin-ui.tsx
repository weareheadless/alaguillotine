"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

/* ── Data fetching hook ────────────────────────────────────────────── */
export function useAdmin<T = unknown>(path: string, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(path, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setData(j as T);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    refetch();
    if (!pollMs) return;
    const id = setInterval(refetch, pollMs);
    return () => clearInterval(id);
  }, [refetch, pollMs]);

  return { data, loading, error, refetch };
}

/* ── Layout primitives ─────────────────────────────────────────────── */
export function Section({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-2 border-glitchGray bg-chop-card/60">
      <header className="flex items-start justify-between gap-3 border-b-2 border-glitchGray px-4 py-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-hypeNeon">
            {title}
          </h3>
          {sub && <p className="mt-0.5 text-[11px] text-chop-muted">{sub}</p>}
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  k,
  v,
  tone = "text-sheetWhite",
}: {
  k: string;
  v: ReactNode;
  tone?: string;
}) {
  return (
    <div className="border-2 border-glitchGray bg-black px-3 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-widest text-chop-muted">{k}</div>
      <div className={`mt-1 break-words text-sm font-bold ${tone}`}>{v}</div>
    </div>
  );
}

const PILL_TONES: Record<string, string> = {
  green: "border-hypeNeon text-hypeNeon",
  red: "border-spiteCrimson text-spiteCrimson",
  gray: "border-glitchGray text-chop-muted",
  yellow: "border-amber-400 text-amber-400",
  white: "border-sheetWhite text-sheetWhite",
};

export function Pill({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: keyof typeof PILL_TONES | string;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        PILL_TONES[tone] ?? PILL_TONES.gray
      }`}
    >
      {children}
    </span>
  );
}

export function Loading() {
  return (
    <div className="animate-pulse py-10 text-center text-xs uppercase tracking-widest text-chop-muted">
      loading…
    </div>
  );
}

export function ErrorBox({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return (
    <div className="border-2 border-spiteCrimson/50 bg-spiteCrimson/10 px-4 py-3 text-sm text-spiteCrimson">
      <span className="font-bold">ERROR:</span> {msg}
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-3 border border-spiteCrimson px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-spiteCrimson hover:text-black"
        >
          retry
        </button>
      )}
    </div>
  );
}

export function Empty({ msg }: { msg: string }) {
  return <p className="py-6 text-center text-xs uppercase tracking-widest text-chop-muted">{msg}</p>;
}

/* ── Time helpers ──────────────────────────────────────────────────── */
export function fmtTs(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function relTs(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function money(n: number | undefined | null): string {
  const v = Number(n ?? 0);
  return `$${v.toFixed(v < 1 ? 4 : 2)}`;
}

export function num(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString();
}

/* ── Recursive JSON tree (collapsible) ─────────────────────────────── */
export function JsonTree({
  data,
  name,
  depth = 0,
}: {
  data: unknown;
  name?: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (data === null) return <span className="text-chop-muted">null</span>;
  const t = typeof data;
  if (t !== "object") {
    const str = String(data);
    const cls =
      t === "number" || t === "bigint"
        ? "text-hypeNeon"
        : t === "boolean"
          ? "text-spiteCrimson"
          : "text-sheetWhite/90";
    return <span className={cls}>{str}</span>;
  }

  const isArr = Array.isArray(data);
  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);
  const label = name ?? (isArr ? "array" : "object");

  return (
    <div className="font-mono text-[11px] leading-relaxed">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-sm px-1 text-chop-muted hover:bg-glitchGray/40 hover:text-sheetWhite"
      >
        <span className={`inline-block w-3 ${open ? "text-hypeNeon" : ""}`}>{open ? "▾" : "▸"}</span>
        <span className="font-bold text-sheetWhite">{label}</span>
        <span className="text-chop-muted">
          {isArr ? `[${keys.length}]` : `{${keys.length}}`}
        </span>
      </button>
      {open && (
        <div className="ml-3 border-l border-glitchGray pl-3">
          {keys.map((k) => (
            <div key={k} className="break-all">
              <span className="mr-1 select-none text-chop-muted">{k}:</span>
              <JsonTree data={obj[k]} name={k} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Minimal SVG bar chart ─────────────────────────────────────────── */
export function Bars({
  items,
  format,
  color = "#22C55E",
  height = 120,
}: {
  items: { label: string; value: number }[];
  format: (v: number) => string;
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const barW = Math.max(4, Math.min(28, 100 / items.length - 2));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${items.length * (barW + 4) + 4} ${height + 22}`} width="100%" height={height + 22}>
        {items.map((it, i) => {
          const h = Math.max(1, (it.value / max) * height);
          const x = i * (barW + 4) + 2;
          const y = height - h;
          return (
            <g key={it.label}>
              <rect x={x} y={y} width={barW} height={h} fill={it.value > 0 ? color : "#27272A"} opacity={it.value > 0 ? 0.9 : 0.4} />
              <title>{`${it.label}: ${format(it.value)}`}</title>
              <text x={x + barW / 2} y={height + 10} fontSize="8" fill="#71717A" textAnchor="middle">
                {it.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
