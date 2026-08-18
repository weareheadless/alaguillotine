"use client";

import { useMemo, useState } from "react";
import { Loading, ErrorBox, useAdmin, JsonTree, Empty } from "./admin-ui";

interface ConfigData {
  config?: Record<string, unknown>;
}

function flatten(obj: Record<string, unknown>, prefix = "", out: { path: string; value: string }[] = []) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, path, out);
    } else {
      const value = Array.isArray(v)
        ? `[${v.length}] ${JSON.stringify(v).slice(0, 200)}`
        : String(v ?? "null");
      out.push({ path, value });
    }
  }
  return out;
}

export function AdminConfig() {
  const { data, loading, error, refetch } = useAdmin<ConfigData>("/api/admin/proxy/config");
  const [query, setQuery] = useState("");

  const flat = useMemo(() => {
    if (!data?.config) return [];
    return flatten(data.config);
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter((f) => f.path.toLowerCase().includes(q) || f.value.toLowerCase().includes(q));
  }, [flat, query]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="border-2 border-glitchGray bg-chop-card/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-hypeNeon">
            config.yaml
          </span>
          <span className="text-[10px] text-chop-muted">
            read-only · {flat.length} keys · {Object.keys(data.config ?? {}).length} sections
          </span>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search keys or values (e.g. budget, model, threshold)…"
          className="mt-3 w-full border-2 border-glitchGray bg-black px-3 py-2 text-xs text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
        />
      </div>

      {query ? (
        filtered.length ? (
          <div className="border-2 border-glitchGray bg-chop-card/60">
            <ul className="divide-y divide-glitchGray/40">
              {filtered.map((f) => (
                <li key={f.path} className="flex items-start gap-3 px-4 py-1.5 font-mono text-xs">
                  <span className="shrink-0 font-bold text-hypeNeon">{f.path}</span>
                  <span className="min-w-0 break-all text-sheetWhite/80">{f.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty msg="no matching keys" />
        )
      ) : (
        <div className="border-2 border-glitchGray bg-chop-card/60 p-4">
          <JsonTree data={data.config} name="config" depth={1} />
        </div>
      )}
    </div>
  );
}
