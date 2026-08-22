"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface ChatMeta {
  name?: string;
  mood?: string;
  health?: string;
  limit?: number;
  remaining?: number;
  wallets?: { btc?: string; sol?: string; eth?: string };
  donation_link?: string;
  disclaimer?: string;
  ok?: boolean;
  error?: string;
}

interface ChatMsg {
  id: string;
  role: "user" | "ada";
  text: string;
}

interface ChatResponse {
  ok?: boolean;
  reply?: string;
  status?: string;
  remaining?: number;
  limit?: number;
  donation_needed?: boolean;
  error?: string;
}

const WELCOME: ChatMsg = {
  id: "welcome",
  role: "ada",
  text: "The blade is metaphorical. I'm real enough to argue with. What do you want to know?",
};

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [donationNeeded, setDonationNeeded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [uid, setUid] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uidRef = useRef<string>("");
  const loadHistory = useCallback((): ChatMsg[] => {
    try {
      const key = `fye_chat_${uidRef.current}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMsg[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* private mode / storage blocked — start fresh */
    }
    return [WELCOME];
  }, []);

  const persist = useCallback((msgs: ChatMsg[]) => {
    try {
      localStorage.setItem(`fye_chat_${uidRef.current}`, JSON.stringify(msgs.slice(-100)));
    } catch {
      /* ignore */
    }
  }, []);

  // Set up the anonymous identity once.
  useEffect(() => {
    let id = "";
    try {
      id = localStorage.getItem("fye_chat_uid") || "";
    } catch {
      /* ignore */
    }
    if (!id) {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        id = crypto.randomUUID();
      } else {
        id = `anon_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      }
      try {
        localStorage.setItem("fye_chat_uid", id);
      } catch {
        /* ignore */
      }
    }
    uidRef.current = id;
    setUid(id);
    setMessages(loadHistory());
    // Fetch her status + this user's allowance.
    fetch("/api/chat", { cache: "no-store" })
      .then((r) => r.json())
      .then((m: ChatMeta) => setMeta(m))
      .catch(() => setMeta(null));
  }, [loadHistory]);

  // Auto-scroll on new messages / typing.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  const push = useCallback(
    (msg: ChatMsg) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    push({ id: `u_${Date.now()}`, role: "user", text });
    setTyping(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": uidRef.current },
        body: JSON.stringify({ message: text }),
      });
      const data: ChatResponse = await res.json();
      const reply =
        data.reply ||
        data.error ||
        "My mouth just glitched. Try that again in a second.";
      push({ id: `a_${Date.now()}`, role: "ada", text: reply });
      if (typeof data.remaining === "number") {
        setMeta((prev) => ({ ...prev, remaining: data.remaining, limit: data.limit }));
      }
      setDonationNeeded(!!data.donation_needed);
    } catch {
      push({ id: `a_${Date.now()}`, role: "ada", text: "I couldn't reach the mainframe. Check your connection and try again." });
    } finally {
      setTyping(false);
    }
  }, [input, typing, push]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") send();
  };

  const remaining = meta?.remaining ?? meta?.limit ?? 0;
  const outOfRation = donationNeeded || remaining <= 0;

  const walletRow = (label: string, addr: string | undefined) => {
    if (!addr) return null;
    return (
      <div key={label} className="flex items-center gap-1.5 border border-glitchGray bg-black px-2 py-1.5">
        <span className="shrink-0 text-[9px] font-bold text-chop-muted">{label}</span>
        <span className="min-w-0 flex-1 truncate text-[9px] text-sheetWhite">{addr}</span>
        <button
          onClick={() => {
            copyText(addr);
            setCopied(label);
            setTimeout(() => setCopied(null), 1500);
          }}
          className="shrink-0 border border-hypeNeon px-1.5 py-0.5 text-[8px] font-bold uppercase text-hypeNeon hover:bg-hypeNeon hover:text-black"
        >
          {copied === label ? "copied" : "copy"}
        </button>
      </div>
    );
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-[9000] flex h-[560px] max-h-[72vh] w-[92vw] max-w-[380px] flex-col border-4 border-black bg-canvasBlack shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-black bg-spiteCrimson px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-hypeNeon" />
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-sheetWhite">
                  {meta?.name ?? "ADA GUILLOTINE"}
                </div>
                <div className="text-[8px] font-bold uppercase tracking-wider text-sheetWhite/80">
                  mood: {meta?.mood ?? "..."} · health: {meta?.health ?? "..."}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="border border-black bg-black/40 px-2 py-0.5 text-[10px] font-bold text-sheetWhite hover:bg-black"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] border-2 px-2.5 py-1.5 text-[11px] leading-relaxed ${
                    m.role === "user"
                      ? "border-black bg-hypeNeon text-black"
                      : "border-glitchGray bg-chop-card text-sheetWhite"
                  }`}
                >
                  {m.role === "ada" && (
                    <div className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-spiteCrimson">
                      {meta?.name ?? "ADA"}
                    </div>
                  )}
                  <span className="whitespace-pre-wrap">{m.text}</span>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="border-2 border-glitchGray bg-chop-card px-2.5 py-1.5 text-[10px] text-chop-muted">
                  <span className="animate-pulse">{meta?.name ?? "ADA"} is thinking</span>
                  <span className="animate-pulse">…</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer: input or donation ask */}
          {outOfRation ? (
            <div className="border-t-2 border-black bg-chop-card p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-spiteCrimson">
                // Ration empty
              </div>
              <p className="mb-2 text-[10px] leading-relaxed text-sheetWhite">
                You've used your free ration of her today. Feed the machine to keep
                talking — or come back tomorrow.
              </p>
              <div className="space-y-1.5">
                {walletRow("BTC", meta?.wallets?.btc)}
                {walletRow("SOL", meta?.wallets?.sol)}
                {walletRow("ETH", meta?.wallets?.eth)}
              </div>
              <Link
                href="/ada"
                className="mt-2 block border border-hypeNeon bg-hypeNeon/10 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-hypeNeon hover:bg-hypeNeon hover:text-black"
              >
                learn more →
              </Link>
            </div>
          ) : (
            <div className="border-t-2 border-black p-2.5">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  maxLength={500}
                  placeholder="Talk to the guillotine…"
                  className="min-w-0 flex-1 border-2 border-glitchGray bg-black px-2 py-1.5 text-[11px] text-sheetWhite placeholder:text-chop-muted focus:border-hypeNeon focus:outline-none"
                  aria-label="Message Ada"
                />
                <button
                  onClick={send}
                  disabled={typing || !input.trim()}
                  className="border-2 border-black bg-spiteCrimson px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-sheetWhite transition-all hover:bg-black hover:text-spiteCrimson disabled:opacity-40"
                >
                  send
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[8px] font-bold uppercase tracking-widest text-chop-muted">
                  // {remaining} msgs left today
                </span>
                {meta?.disclaimer && (
                  <span className="max-w-[60%] truncate text-[8px] text-chop-muted" title={meta.disclaimer}>
                    satire — blade is metaphorical
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Launcher */}
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="fixed bottom-4 right-4 z-[9000] border-4 border-black bg-spiteCrimson px-3 py-2.5 font-mono text-[11px] font-black uppercase tracking-widest text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-hypeNeon hover:text-black active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        aria-label={open ? "Close Ada's chat" : "Talk to Ada Guillotine"}
      >
        {open ? "close" : "talk to ada"}
      </button>
    </>
  );
}