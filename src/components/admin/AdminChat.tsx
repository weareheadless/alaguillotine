"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, fmtTs, money } from "./admin-ui";
import { AdminTasksBoard } from "./AdminTasksBoard";

interface ServerMsg {
  id: string;
  role: "user" | "ada";
  ts: number;
  when?: string;
  text: string;
  status?: "done" | "thinking" | "error";
  kind?: string;
  meta?: {
    action?: string;
    topic?: string;
    reasoning?: string;
    mood?: string;
    elapsed_sec?: number;
    tokens?: { total?: number; remaining?: number; spent_today?: number };
    health?: string;
    capital?: number;
    directive_accepted?: boolean;
    directive?: string;
    follow_up?: string;
    afterthought?: string;
    private?: string;
    error?: string;
  };
}

const POLL_MS = 5000;

function merge(prev: ServerMsg[], incoming: ServerMsg[]): ServerMsg[] {
  const byId = new Map<string, ServerMsg>();
  for (const m of prev) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.ts - b.ts);
}

function LongText({ text }: { text: string }) {
  const [open, setOpen] = useState(text.length <= 1200);
  const isLong = text.length > 1200;
  return (
    <div>
      <pre className={`whitespace-pre-wrap font-sans ${!open ? "max-h-64 overflow-hidden" : ""}`}>
        {text}
      </pre>
      {isLong && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-[10px] font-bold uppercase tracking-widest text-chop-muted hover:text-hypeNeon"
        >
          {open ? "▴ collapse" : `▾ show full reply (${text.length} chars)`}
        </button>
      )}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2 rounded-sm border-2 border-hypeNeon/40 bg-chop-card px-3 py-2">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hypeNeon" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hypeNeon [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hypeNeon [animation-delay:300ms]" />
      <span className="ml-1 text-xs uppercase tracking-widest text-chop-muted">Ada is thinking</span>
    </div>
  );
}

export function AdminChat({ onLogout }: { onLogout: () => void }) {
  const [msgs, setMsgs] = useState<ServerMsg[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openReasoning, setOpenReasoning] = useState<string | null>(null);
  const [openAfter, setOpenAfter] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const lastTsRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const thinking = msgs.some((m) => m.status === "thinking");

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    atBottomRef.current = near;
    setShowJump(!near);
  }

  function scrollToBottom() {
    atBottomRef.current = true;
    setShowJump(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function refresh(initial = false) {
    try {
      const since = initial ? 0 : Math.max(0, lastTsRef.current - 5);
      const r = await fetch(`/api/admin/proxy/conversation?since=${since}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      const incoming = Array.isArray(j.messages) ? (j.messages as ServerMsg[]) : [];
      if (incoming.length) {
        lastTsRef.current = Math.max(lastTsRef.current, ...incoming.map((m) => m.ts));
        setMsgs((prev) => merge(prev, incoming));
      }
      if (initial) setError(null);
    } catch (e) {
      if (initial) setError(e instanceof Error ? e.message : "failed to load conversation");
    }
  }

  useEffect(() => {
    refresh(true);
    pollRef.current = setInterval(() => refresh(false), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Auto-scroll only when the user is already at the bottom (new messages,
  // thinking indicator). If they've scrolled up to read a long reply, leave
  // their position alone — no yanking.
  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [msgs, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking || sending) return;
    setInput("");
    setError(null);
    setSending(true);
    try {
      const r = await fetch("/api/admin/proxy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      const incoming: ServerMsg[] = [];
      if (j?.user_message) incoming.push(j.user_message);
      if (j?.thinking) incoming.push(j.thinking);
      if (incoming.length) {
        lastTsRef.current = Math.max(lastTsRef.current, ...incoming.map((m) => m.ts));
        setMsgs((prev) => merge(prev, incoming));
        requestAnimationFrame(scrollToBottom);
      }
      refresh(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "chat failed");
    } finally {
      setSending(false);
    }
  }

  const lastTs = msgs.length ? msgs[msgs.length - 1].ts : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-glitchGray px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 animate-pulse rounded-full ${thinking ? "bg-hypeNeon" : "bg-glitchGray"}`} />
          <span className="text-sm font-black uppercase tracking-widest text-sheetWhite">
            Direct line — background &amp; persistent
          </span>
        </div>
        <div className="flex items-center gap-2">
          {thinking && (
            <span className="text-[10px] uppercase tracking-widest text-hypeNeon">thinking…</span>
          )}
          <button
            onClick={onLogout}
            className="border border-spiteCrimson px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-spiteCrimson hover:bg-spiteCrimson hover:text-black"
          >
            lock
          </button>
        </div>
      </div>

      {/* Two panes: conversation (left) + task board (right) */}
      <div className="flex min-h-0 flex-1">
        {/* Conversation */}
        <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="h-full space-y-4 overflow-y-auto px-4 py-4"
        >
        {msgs.length === 0 && !thinking && (
          <div className="py-16 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-chop-muted">
              no conversation open
            </p>
            <p className="mt-2 text-sm text-sheetWhite/80">
              This is your persistent 1:1 with her — it lives on the server, so
              it survives reloads and tab switches, and she can message you on
              her own. No message limit, her real brain, her real memory. She
              may reach for tools, accept or refuse directives, or stay silent.
              And she keeps thinking after she replies: a follow-up, a question,
              or a private afterthought.
            </p>
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-sm border-2 border-hypeNeon/50 bg-hypeNeon/10 px-3 py-2 text-sm text-sheetWhite">
                {m.text}
                <div className="mt-1 text-right text-[9px] text-chop-muted">
                  {m.when ? m.when : fmtTs(m.ts)}
                </div>
              </div>
            </div>
          ) : m.status === "thinking" ? (
            <div key={m.id} className="flex justify-start">
              <ThinkingBubble />
            </div>
          ) : m.status === "error" ? (
            <div key={m.id} className="flex justify-start">
              <div className="rounded-sm border-2 border-spiteCrimson/50 bg-spiteCrimson/10 px-3 py-2 text-xs text-spiteCrimson">
                she was interrupted mid-thought
                {m.meta?.error ? ` — ${m.meta.error}` : ""}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[92%]">
                <div className="rounded-sm border-2 border-glitchGray bg-chop-card px-3 py-2 text-sm leading-relaxed text-sheetWhite/95">
                  {m.kind === "proactive" && (
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-spiteCrimson">
                      she reached out on her own
                    </div>
                  )}
                  <LongText text={m.text} />
                  {m.meta?.directive_accepted && (
                    <p className="mt-2 border border-hypeNeon/40 bg-hypeNeon/5 px-2 py-1 text-[11px] text-hypeNeon">
                      DIRECTIVE ACCEPTED: {m.meta.directive}
                    </p>
                  )}
                  {m.meta?.reasoning && (
                    <div className="mt-2 border-t border-glitchGray pt-2">
                      <button
                        onClick={() => setOpenReasoning(openReasoning === m.id ? null : m.id)}
                        className="text-[10px] font-bold uppercase tracking-widest text-chop-muted hover:text-hypeNeon"
                      >
                        {openReasoning === m.id ? "▾ hide reasoning" : "▸ show reasoning"}
                      </button>
                      {openReasoning === m.id && (
                        <p className="mt-1 text-[11px] italic text-chop-muted">{m.meta.reasoning}</p>
                      )}
                    </div>
                  )}
                </div>
                {m.meta?.follow_up && (
                  <div className="mt-1.5 flex items-start gap-1.5">
                    <span className="mt-2 shrink-0 text-chop-muted">↳</span>
                    <div className="rounded-sm border-2 border-hypeNeon/30 bg-chop-card/70 px-3 py-2 text-sm leading-relaxed text-sheetWhite/95">
                      <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-hypeNeon">
                        she keeps talking
                      </div>
                      <LongText text={m.meta.follow_up} />
                    </div>
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Pill tone={m.meta?.action === "silent" ? "gray" : "green"}>
                    {m.meta?.action ?? "reply"}
                  </Pill>
                  {m.meta?.topic && <Pill tone="gray">topic: {m.meta.topic}</Pill>}
                  {m.meta?.mood && <Pill tone="yellow">{m.meta.mood}</Pill>}
                  {m.meta?.health && (
                    <Pill tone={m.meta.health === "critical" ? "red" : "green"}>{m.meta.health}</Pill>
                  )}
                  {typeof m.meta?.capital === "number" && (
                    <span className="text-[10px] text-chop-muted">capital {money(m.meta.capital)}</span>
                  )}
                  {typeof m.meta?.tokens?.total === "number" && (
                    <span className="text-[10px] text-chop-muted">
                      {m.meta.tokens.total.toLocaleString()} tokens
                    </span>
                  )}
                  {typeof m.meta?.elapsed_sec === "number" && (
                    <span className="text-[10px] text-chop-muted">{m.meta.elapsed_sec}s</span>
                  )}
                  {(m.meta?.afterthought || m.meta?.private) && (
                    <button
                      onClick={() => setOpenAfter(openAfter === m.id ? null : m.id)}
                      className="border border-amber-400/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-400/10"
                    >
                      {openAfter === m.id ? "▾ private afterthought" : "▸ private afterthought"}
                    </button>
                  )}
                </div>
                {openAfter === m.id && (m.meta?.afterthought || m.meta?.private) && (
                  <p className="mt-1.5 border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px] italic leading-relaxed text-amber-200/90">
                    <span className="mr-1 font-bold not-italic uppercase tracking-wider text-amber-400">
                      private:
                    </span>
                    {m.meta?.afterthought || m.meta?.private}
                  </p>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
        </div>

        {/* Jump to latest — appears only when you've scrolled up */}
        {showJump && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 border-2 border-hypeNeon bg-black/90 px-3 py-2 text-xs font-bold uppercase tracking-wider text-hypeNeon hover:bg-hypeNeon hover:text-black"
          >
            ↓ latest
          </button>
        )}

      {/* Composer */}
      <div className="border-t-2 border-glitchGray px-4 py-3">
        {error && (
          <p className="mb-2 text-xs text-spiteCrimson">
            <span className="font-bold">ERROR:</span> {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Talk to her. She decides how to respond."
            className="min-h-[40px] flex-1 resize-y rounded-sm border-2 border-glitchGray bg-black px-3 py-2 text-sm text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || thinking || sending}
            className="rounded-sm border-2 border-hypeNeon bg-hypeNeon px-4 py-2 text-xs font-bold uppercase tracking-wider text-black disabled:cursor-not-allowed disabled:border-glitchGray disabled:bg-transparent disabled:text-chop-muted"
          >
            {sending ? "…" : "send"}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-chop-muted">
          enter to send · shift+enter for newline · the conversation is stored
          server-side and processed in the background — you can switch tabs or
          close the page and she keeps thinking · she can also message you on
          her own.
        </p>
      </div>
        </div>

        {/* Task board sidebar — her projects, tasks, and subtasks, live */}
        <aside className="w-80 shrink-0 border-l-2 border-glitchGray bg-black/40">
          <AdminTasksBoard />
        </aside>
      </div>
    </div>
  );
}
