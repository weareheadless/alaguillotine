"use client";

import { useCallback, useState } from "react";
import { Loading, ErrorBox, Empty } from "./admin-ui";

const ROOTS = [
  { label: "bot root", path: "/SOCIAL/anticapitalist-bot" },
  { label: "/FYE", path: "/FYE" },
];

interface Entry {
  name: string;
  type: "dir" | "file";
  path: string;
  size?: number;
  mtime?: string;
}

interface TreeData {
  ok?: boolean;
  path?: string;
  entries?: Entry[];
  error?: string;
}

interface FileData {
  ok?: boolean;
  path?: string;
  size?: number;
  content?: string;
  truncated?: boolean;
  error?: string;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j as T;
}

export function AdminCodebase() {
  const [path, setPath] = useState<string | null>(null);
  const [tree, setTree] = useState<TreeData | null>(null);
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDir = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    setFile(null);
    try {
      const t = await getJson<TreeData>(`/api/admin/proxy/tree?path=${encodeURIComponent(p)}`);
      if (t.error) throw new Error(t.error);
      setTree(t);
      setPath(t.path ?? p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to list");
    } finally {
      setLoading(false);
    }
  }, []);

  const openFile = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const f = await getJson<FileData>(`/api/admin/proxy/file?path=${encodeURIComponent(p)}`);
      if (f.error) throw new Error(f.error);
      setFile(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to read");
    } finally {
      setLoading(false);
    }
  }, []);

  const dirParts = path ? path.split("/").filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <div className="border-2 border-glitchGray bg-chop-card/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {ROOTS.map((r) => (
            <button
              key={r.path}
              onClick={() => openDir(r.path)}
              className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                path === r.path
                  ? "border-hypeNeon bg-hypeNeon text-black"
                  : "border-glitchGray text-chop-muted hover:border-hypeNeon hover:text-hypeNeon"
              }`}
            >
              {r.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-chop-muted">
            read-only view of her codebase + the site repo
          </span>
        </div>
        {path && (
          <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-xs text-chop-muted">
            <button onClick={() => openDir(dirParts.slice(0, -1).join("/") || "/")} className="hover:text-hypeNeon">
              /
            </button>
            {dirParts.map((part, i) => {
              const p = "/" + dirParts.slice(0, i + 1).join("/");
              return (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-chop-muted">/</span>
                  <button onClick={() => openDir(p)} className="text-sheetWhite/80 hover:text-hypeNeon">
                    {part}
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {error && <ErrorBox msg={error} />}
      {loading ? (
        <Loading />
      ) : file ? (
        <div className="border-2 border-glitchGray bg-chop-card/60">
          <div className="flex items-center justify-between gap-3 border-b-2 border-glitchGray px-4 py-2">
            <span className="truncate font-mono text-xs text-sheetWhite">{file.path}</span>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-[10px] text-chop-muted">
                {file.size?.toLocaleString()} bytes
                {file.truncated ? " · truncated" : ""}
              </span>
              <button
                onClick={() => setFile(null)}
                className="border border-glitchGray px-2 py-1 text-[10px] font-bold uppercase text-chop-muted hover:border-hypeNeon hover:text-hypeNeon"
              >
                ← back
              </button>
            </div>
          </div>
          <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-sheetWhite/90">
            {file.content}
          </pre>
        </div>
      ) : (
        <div className="border-2 border-glitchGray bg-chop-card/60">
          {!tree && <Empty msg="pick a root to browse the codebase" />}
          {tree && tree.entries?.length === 0 && <Empty msg="empty directory" />}
          {tree && (
            <ul className="divide-y divide-glitchGray/40">
              {tree.entries?.map((e) => (
                <li key={e.path}>
                  <button
                    onClick={() => (e.type === "dir" ? openDir(e.path) : openFile(e.path))}
                    className="flex w-full items-center gap-3 px-4 py-1.5 text-left font-mono text-xs hover:bg-glitchGray/30"
                  >
                    <span className={e.type === "dir" ? "text-hypeNeon" : "text-chop-muted"}>
                      {e.type === "dir" ? "▸" : "·"}
                    </span>
                    <span className={`flex-1 truncate ${e.type === "dir" ? "font-bold text-sheetWhite" : "text-sheetWhite/80"}`}>
                      {e.name}
                      {e.type === "dir" ? "/" : ""}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-chop-muted">
                      {e.type === "file" ? e.size?.toLocaleString() : ""}
                    </span>
                    <span className="hidden shrink-0 text-[10px] text-chop-muted sm:block">{e.mtime}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
