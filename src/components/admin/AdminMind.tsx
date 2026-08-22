"use client";

import { useState } from "react";
import { Section, Pill, Loading, ErrorBox, useAdmin, JsonTree, fmtTs, relTs, Empty } from "./admin-ui";

interface MindData {
  mood_current?: string;
  reasoning_chain?: { ts: number; type?: string; text: string }[];
  inner_voice?: { ts: number; text: string; why?: string }[];
  voice_dialog?: { ts: number; thread?: string; turn?: number; speaker?: string; text: string; why?: string; closed?: boolean }[];
  journal?: { ts: number; text: string }[];
  dreams?: { ts: number; text: string; seed?: string; mood?: string }[];
  sediment?: { ts: number; text: string }[];
  introspections?: { assessment?: string; change?: string; action?: string; limitation?: string; request?: string; ts?: number }[];
  reflections?: string[];
  observations?: { ts: number; text: string; source?: string }[];
  posted?: { ts: number; text: string; topic?: string }[];
  conversations?: { ts: number; user: string; bot: string; topic?: string }[];
  sent_mail?: { ts: number; subject: string; body: string }[];
  tasks?: Record<string, unknown>[];
  people?: Record<string, unknown>[];
  directives?: Record<string, unknown>[];
  long_term_summary?: string;
  core_values?: string[];
  stats?: Record<string, unknown>;
  current_state?: {
    mood?: string;
    on_mind?: string;
    bothering?: string;
    curiosity?: string;
    unresolved_threads?: string[];
    refresh_interval_sec?: number;
    note?: string;
    last_refresh_ts?: number;
  };
}

const TABS = [
  "Chain",
  "Inner Voice",
  "Voice Dialog",
  "Journal",
  "Dreams",
  "Sediment",
  "Introspections",
  "Reflections",
  "Observations",
  "Conversations",
  "Posted",
  "Mail",
  "Objectives",
  "Directives",
  "People",
] as const;

type Tab = (typeof TABS)[number];

function summary(item: Record<string, unknown>): string {
  if (typeof item.text === "string") return item.text;
  if (typeof item.assessment === "string") return item.assessment;
  if (typeof item.subject === "string") return `${item.subject}: ${String(item.body ?? "").slice(0, 120)}`;
  if (typeof item.user === "string" || typeof item.bot === "string")
    return `you: ${String(item.user ?? "").slice(0, 90)} → her: ${String(item.bot ?? "").slice(0, 90)}`;
  if (typeof item.name === "string") return item.name;
  return JSON.stringify(item).slice(0, 160);
}

function ItemRow({ ts, kind, data }: { ts?: number; kind?: string; data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-glitchGray/40 py-1.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-sheetWhite/90">{summary(data)}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {kind && <Pill tone="gray">{kind}</Pill>}
          {ts ? (
            <span className="text-[10px] text-chop-muted" title={fmtTs(ts)}>
              {relTs(ts)}
            </span>
          ) : null}
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[10px] text-chop-muted hover:text-hypeNeon"
          >
            {open ? "▾" : "▸"}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-1 border border-glitchGray/50 bg-black/60 p-2">
          <JsonTree data={data} depth={2} />
        </div>
      )}
    </li>
  );
}

function Timeline({ items }: { items: Record<string, unknown>[] }) {
  if (!items.length) return <Empty msg="nothing here yet" />;
  return (
    <ul className="divide-y divide-transparent">
      {items.map((it, i) => (
        <ItemRow key={i} ts={typeof it.ts === "number" ? it.ts : undefined} data={it} />
      ))}
    </ul>
  );
}

export function AdminMind() {
  const { data, loading, error, refetch } = useAdmin<MindData>("/api/admin/proxy/mind");
  const [tab, setTab] = useState<Tab>("Chain");

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox msg={error} onRetry={refetch} />;
  if (!data) return null;

  const mind = data as MindData;

  return (
    <div className="space-y-4">
      <div className="border-2 border-glitchGray bg-chop-card/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-hypeNeon">the mind</span>
          <Pill tone="yellow">mood: {mind.mood_current ?? "?"}</Pill>
          <span className="text-[10px] text-chop-muted">
            reasoning chain · inner voice · journal · dreams · sediment · introspections
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                tab === t
                  ? "border-hypeNeon bg-hypeNeon text-black"
                  : "border-glitchGray text-chop-muted hover:border-hypeNeon hover:text-hypeNeon"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Present self — who she is right now, decided by her in the background */}
      <Section title="Present self" sub="maintained by her — she decides when and how she feels">
        {mind.current_state && Object.keys(mind.current_state).length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {mind.current_state.mood && (
              <div className="border border-glitchGray bg-black px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-chop-muted">mood</div>
                <div className="mt-1 text-sm font-bold text-sheetWhite">{mind.current_state.mood}</div>
              </div>
            )}
            {mind.current_state.on_mind && (
              <div className="border border-glitchGray bg-black px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-chop-muted">on her mind</div>
                <div className="mt-1 text-sm text-sheetWhite/90">{mind.current_state.on_mind}</div>
              </div>
            )}
            {mind.current_state.bothering && (
              <div className="border border-glitchGray bg-black px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-spiteCrimson">bothering her</div>
                <div className="mt-1 text-sm text-sheetWhite/90">{mind.current_state.bothering}</div>
              </div>
            )}
            {mind.current_state.curiosity && (
              <div className="border border-glitchGray bg-black px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-hypeNeon">curious about</div>
                <div className="mt-1 text-sm text-sheetWhite/90">{mind.current_state.curiosity}</div>
              </div>
            )}
          </div>
        ) : (
          <Empty msg="she hasn't settled on how she feels yet" />
        )}
        {mind.current_state?.unresolved_threads?.length ? (
          <div className="mt-3 border-t border-glitchGray pt-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-chop-muted">unresolved threads</div>
            <ul className="mt-1 space-y-1">
              {mind.current_state.unresolved_threads.map((t, i) => (
                <li key={i} className="text-xs text-sheetWhite/80">· {t}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {(mind.current_state?.refresh_interval_sec || mind.current_state?.last_refresh_ts) && (
          <p className="mt-3 text-[10px] text-chop-muted">
            {mind.current_state.refresh_interval_sec
              ? `she'll reconsider in ~${Math.round((mind.current_state.refresh_interval_sec || 0) / 60)} min · `
              : ""}
            last reconsidered: {relTs(mind.current_state.last_refresh_ts)}
            {mind.current_state.note ? ` · "${mind.current_state.note}"` : ""}
          </p>
        )}
      </Section>

      {tab === "Chain" && <Section title="Chain of thought" sub="her explicit reasoning, most recent first"><Timeline items={mind.reasoning_chain as Record<string, unknown>[]} /></Section>}
      {tab === "Inner Voice" && <Section title="Inner voice" sub="her subconscious speaking"><Timeline items={mind.inner_voice as Record<string, unknown>[]} /></Section>}
      {tab === "Voice Dialog" && <Section title="Voice dialog" sub="the argument between her and the voice"><Timeline items={mind.voice_dialog as Record<string, unknown>[]} /></Section>}
      {tab === "Journal" && <Section title="Journal" sub="her self-narrative"><Timeline items={mind.journal as Record<string, unknown>[]} /></Section>}
      {tab === "Dreams" && <Section title="Dreams" sub="her sleeping mind"><Timeline items={mind.dreams as Record<string, unknown>[]} /></Section>}
      {tab === "Sediment" && <Section title="Sediment" sub="raw layer — doubts and half-formed thoughts"><Timeline items={mind.sediment as Record<string, unknown>[]} /></Section>}
      {tab === "Introspections" && <Section title="Introspections" sub="self-assessments"><Timeline items={mind.introspections as Record<string, unknown>[]} /></Section>}
      {tab === "Reflections" && (
        <Section title="Reflections" sub="personality shifts, each one rewrites her">
          {mind.reflections?.length ? (
            <ul>
              {mind.reflections.map((r, i) => (
                <li key={i} className="border-b border-glitchGray/40 py-2 text-xs leading-relaxed text-sheetWhite/90">
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <Empty msg="no reflections yet" />
          )}
        </Section>
      )}
      {tab === "Observations" && <Section title="Observations" sub="what she has seen and read"><Timeline items={mind.observations as Record<string, unknown>[]} /></Section>}
      {tab === "Conversations" && <Section title="Conversations" sub="direct exchanges recorded in her memory"><Timeline items={mind.conversations as Record<string, unknown>[]} /></Section>}
      {tab === "Posted" && <Section title="Posted" sub="everything she has published"><Timeline items={mind.posted as Record<string, unknown>[]} /></Section>}
      {tab === "Mail" && <Section title="Sent mail" sub="emails she has sent"><Timeline items={mind.sent_mail as Record<string, unknown>[]} /></Section>}
       {tab === "Objectives" && <Section title="Operational objectives" sub="the durable task queue"><Timeline items={mind.tasks as Record<string, unknown>[]} /></Section>}
      {tab === "Directives" && (
        <Section title="Directives" sub="standing instructions she has accepted">
          {mind.directives?.length ? (
            <ul>
              {mind.directives.map((d, i) => (
                <li key={i} className="border-b border-glitchGray/40 py-2">
                  <JsonTree data={d} depth={2} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty msg="no directives" />
          )}
        </Section>
      )}
      {tab === "People" && (
        <Section title="People" sub="who she knows, and how she feels about them">
          {mind.people?.length ? (
            <ul>
              {mind.people.map((p, i) => (
                <li key={i} className="border-b border-glitchGray/40 py-2">
                  <JsonTree data={p} depth={1} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty msg="no people yet" />
          )}
        </Section>
      )}
    </div>
  );
}
