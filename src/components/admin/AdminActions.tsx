"use client";

import { useMemo, useState } from "react";
import { Pill, Loading, ErrorBox, useAdmin, Empty } from "./admin-ui";

interface ActionEvent {
  ts: number;
  when: string;
  module: string;
  kind: string;
  text: string;
}

interface ActionsData {
  events?: ActionEvent[];
  total?: number;
  error?: string;
}

const KIND_TONE: Record<string, string> = {
  decision: "green",
  tool: "white",
  post: "green",
  reply: "green",
  like: "green",
  journal: "gray",
  thought: "yellow",
  dream: "yellow",
  cycle: "gray",
  task: "white",
  website: "white",
  publish: "green",
  scratchpad: "white",
  ingest: "gray",
  memory: "gray",
  compaction: "gray",
  flow: "gray",
  code: "yellow",
  money: "yellow",
  inner: "yellow",
  mind: "gray",
  reflect: "gray",
  chat: "gray",
  news: "gray",
  reddit: "gray",
  bluesky: "gray",
};

const KINDS = [
  "decision", "tool", "post", "reply", "like", "journal", "thought", "dream",
  "cycle", "task", "website", "publish", "scratchpad", "ingest", "memory",
  "compaction", "code", "money", "inner", "mind", "reflect", "chat", "news",
  "reddit", "bluesky", "log",
];

export function AdminActions() {
  const { data, loading, error, refetch } = useAdmin<ActionsData>("/api/admin/proxy/actions?limit=600");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");

  const events = data?.events ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events.filter(
      (e) =>
        (kind === "all" || e.kind === kind) &&
        (!needle || e.text.toLowerCase().includes(needle)),
    );
  }, [events, kind, search]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="border-2 border-glitchGray bg-chop-card/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-wrap gap-1.5">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="border-2 border-glitchGray bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sheetWhite focus:border-hypeNeon focus:outline-none"
            >
              <option value="all">all kinds</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search…"
              className="min-w-[160px] flex-1 border-2 border-glitchGray bg-black px-2 py-1 text-xs text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
            />
          </div>
          <span className="text-[10px] text-chop-muted">
            {filtered.length} of {data?.total ?? events.length} events · parsed from logs/out.log
          </span>
        </div>
      </div>

      {data?.error && <ErrorBox msg={data.error} />}

      {filtered.length === 0 ? (
        <Empty msg="no events match" />
      ) : (
        <div className="border-2 border-glitchGray bg-chop-card/60">
          <ul className="divide-y divide-glitchGray/40">
            {filtered.map((e, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2">
                <span className="w-24 shrink-0 text-[10px] tabular-nums text-chop-muted">{e.when}</span>
                <span className="w-24 shrink-0">
                  <Pill tone={KIND_TONE[e.kind] ?? "gray"}>{e.kind}</Pill>
                </span>
                <span className="min-w-0 flex-1 break-words text-xs leading-relaxed text-sheetWhite/90">
                  {e.text}
                </span>
                <span className="hidden shrink-0 text-[10px] text-chop-muted sm:block">[{e.module}]</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
