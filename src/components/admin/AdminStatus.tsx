"use client";

import { Section, Stat, Pill, Loading, ErrorBox, useAdmin, num, fmtTs, relTs } from "./admin-ui";

interface StatusData {
  name?: string;
  mood?: string;
  health?: string;
  tokens?: {
    spent_today?: number;
    budget?: number;
    remaining?: number;
    total?: number;
    last?: Record<string, unknown>;
    context_estimate?: number;
    context_tokens?: number;
    context_window_tokens?: number;
    context_breakdown?: Record<string, number>;
  };
  cycles?: { used?: number; budget?: number; remaining?: number; exhausted?: boolean };
  stats?: { total_posts?: number; total_reflections?: number; cycles?: number; total_ingests?: number; last_post?: string; last_wake?: number; last_dream_ts?: number; total_wakes?: number };
  personality?: { voice?: string; tone?: string; beliefs?: string[] };
  memory_store?: { count?: number };
  process?: { alive?: boolean; last_main_log?: string | null };
  conversations_count?: number;
}

function ChainPill({ ok }: { ok: boolean }) {
  return <Pill tone={ok ? "green" : "red"}>{ok ? "alive" : "dead"}</Pill>;
}

export function AdminStatus() {
  const { data, loading, error, refetch } = useAdmin<StatusData>("/api/admin/proxy/status", 15000);
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Identity bar */}
      <div className="border-2 border-glitchGray bg-chop-card/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-black uppercase tracking-tight text-sheetWhite">
            {data.name ?? "Ada Guillotine"}
          </span>
          <Pill tone="yellow">{data.mood ?? "?"}</Pill>
          <Pill tone={data.health === "critical" ? "red" : data.health === "low" ? "yellow" : "green"}>
            health: {data.health ?? "?"}
          </Pill>
          <ChainPill ok={!!data.process?.alive} />
          <span className="text-[10px] text-chop-muted">
            last main log: {data.process?.last_main_log ? relTs(Date.parse(`${data.process.last_main_log}Z`) / 1000) : "?"}
          </span>
        </div>
      </div>

      {/* Context — memory fed into prompts */}
      {(() => {
        const t = data.tokens ?? {};
        const win = t.context_window_tokens || 64000;
        const toks = t.context_tokens ?? 0;
        const chars = t.context_estimate ?? 0;
        const pct = Math.min(100, Math.round((toks / win) * 100));
        const barColor = pct >= 85 ? "bg-spiteCrimson" : pct >= 70 ? "bg-amber-400" : "bg-hypeNeon";
        const tone = pct >= 85 ? "text-spiteCrimson" : pct >= 70 ? "text-amber-400" : "text-hypeNeon";
        const bd = t.context_breakdown ?? {};
        const maxComp = Math.max(1, ...Object.values(bd));
        return (
          <Section
            title="Context"
            sub={`memory fed into every prompt — window ${num(win)} tokens · ~${Math.round(chars / 1000)}K chars`}
          >
            <div className="mb-3 flex items-center gap-4">
              <span className={`w-20 text-4xl font-black ${tone}`}>{pct}%</span>
              <div className="flex-1">
                <div className="h-4 w-full border border-glitchGray bg-black">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-chop-muted">
                  <span>{num(toks)} tokens ≈ {num(chars)} chars</span>
                  <span>window {num(win)}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {Object.entries(bd)
                .filter(([k]) => k !== "total")
                .map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-[10px] uppercase tracking-wider text-chop-muted">
                      <span>{k.replace(/_/g, " ")}</span>
                      <span>{num(v)} ch</span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full border border-glitchGray/50 bg-black">
                      <div
                        className="h-full bg-sheetWhite/40"
                        style={{ width: `${Math.round((v / maxComp) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </Section>
        );
      })()}

      {/* Cycles + stats */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Cycle budget" sub="wakes per day">
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-black ${Number(data.cycles?.remaining) <= 0 ? "text-spiteCrimson" : "text-hypeNeon"}`}>
              {num(data.cycles?.used)}
            </span>
            <span className="text-sm text-chop-muted">/ {data.cycles?.budget ? num(data.cycles?.budget) : "∞"}</span>
            {data.cycles?.exhausted && <Pill tone="red">exhausted</Pill>}
          </div>
          <p className="mt-2 text-[11px] text-chop-muted">remaining today: {num(data.cycles?.remaining)}</p>
        </Section>

        <Section title="Stats" sub="from her long-term memory">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat k="posts" v={num(data.stats?.total_posts)} />
            <Stat k="reflections" v={num(data.stats?.total_reflections)} />
            <Stat k="wakes" v={num(data.stats?.total_wakes)} />
            <Stat k="cycles" v={num(data.stats?.cycles)} />
            <Stat k="ingests" v={num(data.stats?.total_ingests)} />
            <Stat k="memory store" v={num(data.memory_store?.count)} />
            <Stat k="conversations" v={num(data.conversations_count)} />
          </div>
          <p className="mt-3 border-t border-glitchGray pt-2 text-[11px] text-chop-muted">
            last post: {data.stats?.last_post || "never"} · last dream: {fmtTs(data.stats?.last_dream_ts)} · last wake: {fmtTs(data.stats?.last_wake)}
          </p>
        </Section>
      </div>

      {/* Personality */}
      <Section title="Personality" sub="her distilled self">
        <div className="space-y-2 text-sm">
          {data.personality?.voice && (
            <p><span className="font-bold uppercase text-hypeNeon">voice:</span> <span className="text-sheetWhite/90">{data.personality.voice}</span></p>
          )}
          {data.personality?.tone && (
            <p><span className="font-bold uppercase text-hypeNeon">tone:</span> <span className="text-sheetWhite/90">{data.personality.tone}</span></p>
          )}
          {data.personality?.beliefs?.map((b, i) => (
            <p key={i} className="text-sheetWhite/90">· {b}</p>
          ))}
        </div>
      </Section>
    </div>
  );
}
