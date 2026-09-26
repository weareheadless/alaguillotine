"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useActionState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { fetchRaceMessages, submitPaidRaceMessage, submitRaceMessage, type RaceMessage, type RaceSubmitResponse } from "../app/actions/race-submit";

const SOLANA_RECEIVER = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET || "";
const CHOP_MINT = process.env.NEXT_PUBLIC_CHOP_MINT || "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump";
const CHOP_DECIMALS = parseInt(process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6", 10);

// ─── Types ─────────────────────────────────────────────────────────────────

interface RacePayload {
  race: {
    raceId: string;
    candidateA: string;
    candidateB: string;
    weightA: number;
    weightB: number;
    totalWeight: number;
    leader: string | null;
    leadWeight: number;
    leadPct: number;
    bladeLive: boolean;
    thresholdWeight: number;
    willDrop: boolean;
    epochNumber: number;
  } | null;
  nextUp: { name: string; net_worth: string; emoji: string } | null;
  fetchedAt: string;
}

// ─── Per-candidate side identity (A = crimson, B = green) ─────────────────
const SIDE = {
  a: {
    text: "text-spiteCrimson",
    border: "border-spiteCrimson",
    soft: "bg-spiteCrimson/10",
    solid: "bg-spiteCrimson",
    ring: "focus:ring-spiteCrimson/40",
    accentGuillotine: "guillotine-accent-a",
    symbol: "☠",
  },
  b: {
    text: "text-hypeNeon",
    border: "border-hypeNeon",
    soft: "bg-hypeNeon/10",
    solid: "bg-hypeNeon",
    ring: "focus:ring-hypeNeon/40",
    accentGuillotine: "guillotine-accent-b",
    symbol: "☠",
  },
} as const;
const side = (b: "a" | "b") => SIDE[b];

// Clipboard helper — same pattern as /src/app/ada/page.tsx (with fallback).
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

// ─── Guillotine (compact, reusable) ────────────────────────────────────────

function MiniGuillotine({
  active,
  dropped,
  bladePos,
  scale = 0.32,
  animationDelay = "0s",
  hairClass = "musk-head",
  accentClass = "",
}: {
  active: boolean; // is this the leader? (blade raised over it)
  dropped: boolean; // did the blade just fall here?
  bladePos: number; // 0-100 progress of the blade toward its target
  scale?: number;
  animationDelay?: string;
  hairClass?: "musk-head" | "trump-head";
  accentClass?: string;
}) {
  // Blade travels from raised (0) down toward the base (64% of container).
  const offset = dropped ? 74 : active ? 10 + (bladePos / 100) * 40 : 0;

  return (
    <div className="relative shrink-0" style={{ width: 200 * scale, height: 440 * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        <div
          className={`guillotine-wrapper ${accentClass}`}
          style={{
            "--guillotine-animation-delay": animationDelay,
            "--blade-animation-delay": animationDelay,
            "--blade-idle-duration": hairClass === "trump-head" ? "4.7s" : "3s",
            "--blade-glitch-duration": hairClass === "trump-head" ? "8.6s" : "7s",
          } as React.CSSProperties}
        >
          <div className="guillotine-post-left" />
          <div className="guillotine-post-right" />
          <div className="guillotine-beam" />
          <div className="guillotine-base" />
          <div className="guillotine-lunette" />
          <div className={`guillotine-head ${hairClass} ${dropped ? "severed" : ""}`} />
          <div className="absolute inset-0 z-10 overflow-hidden">
            <div className="guillotine-blade-wrapper" style={{ transform: `translateX(-50%) translateY(${offset}%)` }}>
              <div
                className={`guillotine-blade ${dropped ? "dropped" : ""}`}
                style={{ "--blade-animation-delay": animationDelay } as React.CSSProperties}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Board Submit Form ─────────────────────────────────────────────────────

function BoardForm({ board, name }: { board: "a" | "b"; name: string }) {
  const [state, formAction, pending] = useActionState<RaceSubmitResponse, FormData>(submitRaceMessage, {
    success: false,
  });
  const [text, setText] = useState("");
  const [freeName, setFreeName] = useState("");
  const [paidText, setPaidText] = useState("");
  const [paidName, setPaidName] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [mode, setMode] = useState<"free" | "paid">("free");
  const [paidSubmitting, setPaidSubmitting] = useState(false);
  const [paidError, setPaidError] = useState("");
  const [copied, setCopied] = useState(false);
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible: showWalletModal } = useWalletModal();

  // Clear the box once a submission lands.
  const prevSuccess = useRef(false);
  useEffect(() => {
    if (state.success && !prevSuccess.current) {
      setText("");
      window.dispatchEvent(new CustomEvent("new-message", { detail: { authorName: freeName.trim() || "Anonymous Spite", amount: 0 } }));
    }
    prevSuccess.current = state.success;
  }, [state.success]);

  const s = side(board);
  const permalink = state.success && typeof state.id === "string" ? state.id : null;

  const handlePaidSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number.parseFloat(paidAmount);
    if (!paidText.trim()) { setPaidError("Message is required."); return; }
    if (!amount || amount <= 0) { setPaidError("Enter a CHOP amount."); return; }
    if (!publicKey) { showWalletModal(true); return; }
    if (!SOLANA_RECEIVER) { setPaidError("Treasury wallet is not configured."); return; }

    setPaidSubmitting(true);
    setPaidError("");
    const authorName = paidName.trim();

    try {
      const mint = new PublicKey(CHOP_MINT);
      const receiver = new PublicKey(SOLANA_RECEIVER);
      const senderAta = getAssociatedTokenAddressSync(mint, publicKey, false, TOKEN_2022_PROGRAM_ID);
      const receiverAta = getAssociatedTokenAddressSync(mint, receiver, false, TOKEN_2022_PROGRAM_ID);
      const transaction = new Transaction();

      try {
        await getAccount(connection, senderAta, undefined, TOKEN_2022_PROGRAM_ID);
      } catch {
        transaction.add(createAssociatedTokenAccountInstruction(publicKey, senderAta, publicKey, mint, TOKEN_2022_PROGRAM_ID));
      }
      try {
        await getAccount(connection, receiverAta, undefined, TOKEN_2022_PROGRAM_ID);
      } catch {
        transaction.add(createAssociatedTokenAccountInstruction(publicKey, receiverAta, receiver, mint, TOKEN_2022_PROGRAM_ID));
      }

      const rawAmount = BigInt(Math.round(amount * Math.pow(10, CHOP_DECIMALS)));
      transaction.add(createTransferCheckedInstruction(senderAta, mint, receiverAta, publicKey, rawAmount, CHOP_DECIMALS, undefined, TOKEN_2022_PROGRAM_ID));
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) throw new Error("Transaction failed on-chain.");

      const formData = new FormData();
      formData.set("text", paidText.trim());
      formData.set("author_name", authorName);
      formData.set("amount_paid", amount.toFixed(2));
      formData.set("tx_signature", signature);
      formData.set("wallet_address", publicKey.toBase58());
      formData.set("board", board);

      const result = await submitPaidRaceMessage({ success: false }, formData);
      if (!result.success) throw new Error(result.error || "Paid message was not accepted.");

      setPaidText("");
      setPaidName("");
      setPaidAmount("");
      window.dispatchEvent(new CustomEvent("new-message", { detail: { authorName, amount } }));
      window.dispatchEvent(new CustomEvent("paid-message", {
        detail: { text: paidText.trim(), author_name: result.authorName || authorName || "Anonymous Whale", amount_paid: amount, created_at: new Date().toISOString() },
      }));
    } catch (error) {
      setPaidError(error instanceof Error ? error.message : "Transaction cancelled.");
    } finally {
      setPaidSubmitting(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="mb-2 flex border border-black/60 font-mono text-[9px] font-bold uppercase tracking-widest">
        <button type="button" onClick={() => setMode("free")} className={`flex-1 px-2 py-1 ${mode === "free" ? "bg-sheetWhite text-canvasBlack" : "text-chop-muted"}`}>Free shot</button>
        <button type="button" onClick={() => setMode("paid")} className={`flex-1 border-l border-black/60 px-2 py-1 ${mode === "paid" ? "bg-[#FDE047] text-canvasBlack" : "text-chop-muted"}`}>Paid override</button>
      </div>

      {mode === "free" ? (
        <form action={async (fd) => { fd.set("board", board); formAction(fd); }}>
          <input type="hidden" name="board" value={board} />
          <textarea name="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Aim for the ${name} side… say it sideways.`} maxLength={5000} rows={2} className={`w-full resize-none border ${s.border} bg-canvasBlack/90 px-3 py-2 font-mono text-[11px] text-sheetWhite placeholder:text-chop-muted focus:outline-none focus:ring-2 ${s.ring}`} />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <input name="author_name" value={freeName} onChange={(e) => setFreeName(e.target.value)} placeholder="Display name (optional)" aria-label="Optional display name" maxLength={30} className="min-w-0 flex-1 border border-white/20 bg-canvasBlack/70 px-2 py-1 font-mono text-[9px] text-sheetWhite placeholder:text-chop-muted" />
            <button type="submit" disabled={pending || !text.trim()} className={`border-2 border-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-canvasBlack transition-opacity hover:opacity-90 disabled:opacity-40 ${s.solid}`}>{pending ? "POSTING…" : "Swing the blade"}</button>
            <span className="font-mono text-[9px] text-chop-muted">{board === "a" ? "BOARD A" : "BOARD B"}</span>
          </div>
          {state.success && (
            <div className="mt-1 border border-hypeNeon/60 bg-hypeNeon/10 px-2 py-1 font-mono text-[9px] text-hypeNeon">
              <p className="font-bold">✓ ON THE BOARD — Referee scored it {state.score}/5{state.quip ? <span> — &ldquo;{state.quip}&rdquo;</span> : null}</p>
              {state.dropped && <p className="mt-0.5 text-spiteCrimson">⚔️ {state.decapitated} LOST THEIR HEAD! {state.survivor} holds the board.</p>}
              {permalink && (
                <p className="mt-1 flex items-center gap-2">
                  <a href={`/race/${permalink}`} className="underline decoration-dotted hover:text-sheetWhite">permalink</a>
                  <button
                    type="button"
                    onClick={() => {
                      copyText(`${window.location.origin}/race/${permalink}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="border border-hypeNeon px-1.5 py-0.5 text-[8px] font-bold uppercase hover:bg-hypeNeon hover:text-canvasBlack"
                  >
                    {copied ? "copied" : "copy link"}
                  </button>
                </p>
              )}
            </div>
          )}
          {!state.success && state.error && <p className="mt-1 font-mono text-[9px] text-spiteCrimson">{state.error}</p>}
        </form>
      ) : (
        <form onSubmit={handlePaidSubmit}>
          <textarea value={paidText} onChange={(e) => setPaidText(e.target.value)} placeholder={`Pay to put this message on the ${name} side.`} maxLength={5000} rows={2} className="w-full resize-none border border-[#FDE047] bg-canvasBlack/90 px-3 py-2 font-mono text-[11px] text-sheetWhite placeholder:text-chop-muted focus:outline-none focus:ring-2 focus:ring-[#FDE047]/40" />
          <div className="mt-1.5 grid grid-cols-[1fr_5.5rem_auto] gap-1.5">
            <input value={paidName} onChange={(e) => setPaidName(e.target.value)} placeholder="Display name (optional)" aria-label="Optional display name" maxLength={50} className="min-w-0 border border-[#FDE047] bg-canvasBlack/90 px-2 py-1 font-mono text-[10px] text-sheetWhite placeholder:text-chop-muted" />
            <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="CHOP" inputMode="decimal" className="w-full border border-[#FDE047] bg-canvasBlack/90 px-2 py-1 font-mono text-[10px] text-sheetWhite placeholder:text-chop-muted" />
            <button type="submit" disabled={paidSubmitting || !paidText.trim() || !paidAmount} className="border border-black bg-[#FDE047] px-2 py-1 text-[9px] font-black uppercase text-canvasBlack disabled:opacity-40">{paidSubmitting ? "..." : publicKey ? "Pay" : "Wallet"}</button>
          </div>
          <p className="mt-1 font-mono text-[9px] text-[#FDE047]">Paid messages are highlighted and hack the system.</p>
          {paidError && <p className="mt-1 font-mono text-[9px] text-spiteCrimson">{paidError}</p>}
        </form>
      )}
    </div>
  );
}

// ─── Board Wall ────────────────────────────────────────────────────────────

function BoardWall({ raceId, title, count, leadPct, board, leader, framed = true, showHeader = true }: { raceId: string; title: string; count: number; leadPct: number; board: "a" | "b"; leader: boolean; framed?: boolean; showHeader?: boolean }) {
  const [messages, setMessages] = useState<RaceMessage[]>([]);
  const s = side(board);

  useEffect(() => {
    let alive = true;
    const load = () => fetchRaceMessages(raceId, board).then((rows) => { if (alive) setMessages(rows); });
    load();
    const id = setInterval(load, 5000);
    // Refresh the wall immediately on a submit (don't wait for the 5s poll).
    const onNewMessage = () => load();
    window.addEventListener("new-message", onNewMessage);
    return () => { alive = false; clearInterval(id); window.removeEventListener("new-message", onNewMessage); };
  }, [raceId, board]);

  return (
    <div className={framed ? `border ${s.border} p-2` : "p-2"}>
      {showHeader && (
        <div className="race-score-header text-sheetWhite">
          <span className="flex items-center gap-1 font-black uppercase tracking-widest">{title}</span>
          <span className="tabular-nums text-chop-muted">{count.toLocaleString()}</span>
        </div>
      )}
      {leadPct > 0 && (
        <div className="mb-1 h-1.5 w-full overflow-hidden border border-black bg-canvasBlack">
          <div className="h-full bg-chop-muted" style={{ width: `${Math.min(leadPct * 5, 100)}%` }} />
        </div>
      )}
      <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto border-y border-black/40 py-2">
        {messages.length === 0 ? (
          <p className="font-mono text-[9px] text-chop-muted">// no shots fired yet</p>
        ) : messages.map((message) => {
          const isPaid = message.amount_paid > 0;
          return (
            <article key={message.id} className={`border-l-2 px-2 py-1.5 ${isPaid ? "border-spiteCrimson bg-[#FDE047] text-black" : "border-chop-muted/50 bg-canvasBlack/60"}`}>
              <div className={`flex items-center justify-between gap-2 font-mono text-[8px] ${isPaid ? "text-black/70" : "text-chop-muted"}`}>
                <span className="truncate">{message.author_name || "Anonymous"}</span>
                <span className={`shrink-0 tabular-nums ${isPaid ? "font-black text-spiteCrimson" : "text-hypeNeon"}`}>{isPaid ? `${message.amount_paid.toFixed(2)} CHOP PAID` : `craft ${message.score}/5`}</span>
              </div>
              <p className={`mt-0.5 whitespace-pre-wrap break-words text-[10px] leading-snug ${isPaid ? "font-bold text-black" : "text-sheetWhite"}`}>{message.text}</p>
            </article>
          );
        })}
      </div>
      <BoardForm board={board} name={title} />
    </div>
  );
}

// ─── Main RaceBoard ────────────────────────────────────────────────────────

export function RaceBoard() {
  const [data, setData] = useState<RacePayload | null>(null);
  const [mobileBoard, setMobileBoard] = useState<"a" | "b">("a");
  const [justDropped, setJustDropped] = useState<string | null>(null);

  const fetchRace = useCallback(async () => {
    try {
      const res = await fetch("/api/race", { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as RacePayload;
        // Detect a fresh drop to flash the animation.
        setData((prev) => {
          if (prev?.race?.leader && d.race?.leader && prev.race.leader !== d.race.leader && prev.race.raceId !== d.race.raceId) {
            setJustDropped(prev.race.leader);
            setTimeout(() => setJustDropped(null), 2500);
          }
          return d;
        });
        return d;
      }
    } catch {
      /* noop */
    }
    return null;
  }, []);

  useEffect(() => {
    fetchRace();
    const id = setInterval(fetchRace, 4000);
    return () => clearInterval(id);
  }, [fetchRace]);

  // On new message events, refetch immediately.
  useEffect(() => {
    const handler = () => fetchRace();
    window.addEventListener("new-message", handler);
    return () => window.removeEventListener("new-message", handler);
  }, [fetchRace]);

  const race = data?.race;
  const nextUp = data?.nextUp;
  if (!race) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-center font-mono text-chop-muted">
        <p className="text-sm">// Waiting for the first race to be seeded…</p>
      </div>
    );
  }

  const isA = race.leader === race.candidateA;
  const leadPctA = race.leader === race.candidateA ? race.leadPct : race.leader === race.candidateB ? 0 : 0;
  const leadPctB = race.leader === race.candidateB ? race.leadPct : 0;

  const aDropped = justDropped === race.candidateA;
  const bDropped = justDropped === race.candidateB;

  const bladeStatus = race.bladeLive
    ? race.willDrop
      ? "THE BLADE FALLS NOW"
      : `blade armed — lead needs > ${(race.thresholdWeight).toFixed(1)}`
    : "blade cold — race needs more weight";

  // Board ordering for mobile: leader first.
  const mobileOrder: ("a" | "b")[] = isA ? ["a", "b"] : ["b", "a"];
  const title = (b: "a" | "b") => (b === "a" ? race.candidateA : race.candidateB);
  const weight = (b: "a" | "b") => (b === "a" ? race.weightA : race.weightB);
  const lead = (b: "a" | "b") => (b === "a" ? leadPctA : leadPctB);

  return (
    <section className="relative mx-auto mt-4 w-full px-6">
      {/* ─── Mobile: sticky race strip ─────────────────────────────── */}
      <div className="sticky top-0 z-40 -mx-6 border-b-4 border-black bg-canvasBlack/95 px-3 py-1.5 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-1">
          {(["a", "b"] as const).map((b) => {
            const leader = race.leader === title(b);
            const s = side(b);
            return (
              <button
                key={b}
                onClick={() => setMobileBoard(b)}
                className={`flex flex-col items-center border px-1 py-0.5 transition-colors ${
                  leader ? s.border : "border-black bg-canvasBlack"
                }`}
              >
                <span className="font-mono text-[9px] font-black uppercase tracking-widest text-sheetWhite">
                  {s.symbol} {title(b)}
                  {leader ? " ▲" : ""}
                </span>
               <MiniGuillotine
                 active={leader}
                 dropped={b === "a" ? aDropped : bDropped}
                 bladePos={race.leadPct * 100}
                 scale={0.28}
                 animationDelay={b === "a" ? "0s" : "1.5s"}
                 hairClass={title(b) === "Trump" ? "trump-head" : "musk-head"}
                 accentClass={s.accentGuillotine}
               />
              </button>
            );
          })}
        </div>
        <p className="mt-0.5 text-center font-mono text-[8px] uppercase tracking-widest text-chop-muted">
          {bladeStatus}
        </p>
      </div>

      {/* ─── Desktop: guillotine / boards / guillotine ─────────────── */}
      <div className="hidden lg:block">
        <div className="mb-3 border border-black/60 bg-sheetWhite/5 p-3 text-center font-mono">
          <p className="text-[11px] font-black uppercase tracking-[0.2em]">
            <span className="text-sheetWhite">{race.candidateA.toUpperCase()}</span>{" "}
            <span className="text-chop-muted">vs</span>{" "}
            <span className="text-sheetWhite">{race.candidateB.toUpperCase()}</span>
          </p>
          <p className="mt-1 text-[10px] text-chop-muted">
            {race.leader ? (
              <>
                <span className="text-sheetWhite">▲ {race.leader}</span> leads by {race.leadWeight} ({race.leadPct.toFixed(1)}%) — {bladeStatus}
              </>
            ) : (
              <>Tied at {race.totalWeight} weight — {bladeStatus}</>
            )}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          {(["a", "b"] as const).map((b, i) => {
            const leader = race.leader === title(b);
            const s = side(b);
            return (
              <Fragment key={b}>
                {i === 1 && (
                  <div className="vs-divider" aria-hidden="true">
                    <span className="vs-badge">VS</span>
                  </div>
                )}
                <div className={`flex min-w-0 flex-col border ${s.border}`}>
                  {/* Candidate name + weight — neutral; the frame color alone distinguishes the sides */}
                  <div className="flex items-center justify-between gap-2 px-3 pt-3">
                    <span className="flex items-baseline gap-1.5 font-black uppercase tracking-widest text-sheetWhite">
                      <span className="text-sm leading-none">{s.symbol}</span>
                      <span className="text-[11px]">{title(b)}</span>
                    </span>
                    <span className="tabular-nums text-chop-muted">{weight(b).toLocaleString()}</span>
                  </div>

                  {/* Desktop horizontal row: guillotine | board (order depends on side) */}
                  {/* board "a" (left rect): GUILLOTINE on left, BOARD on right (flex-row) */}
                  {/* board "b" (right rect): BOARD on left, GUILLOTINE on right (flex-row-reverse) */}
                  <div className={`flex min-w-0 ${b === "a" ? "flex-row" : "flex-row-reverse"}`}>
                    {/* Guillotine — original full size (0.6); sits at the outer edge of its rectangle */}
                    <div className="flex shrink-0 flex-col items-center px-3 pt-2">
                      <MiniGuillotine
                        active={leader}
                        dropped={b === "a" ? aDropped : bDropped}
                        bladePos={race.leadPct * 100}
                        scale={0.6}
                        animationDelay={b === "a" ? "0s" : "1.5s"}
                        hairClass={title(b) === "Trump" ? "trump-head" : "musk-head"}
                        accentClass={s.accentGuillotine}
                      />
                      <p className="pb-2 text-center font-mono text-[9px] uppercase tracking-widest text-chop-muted">
                        {leader ? "blade armed" : "blade waiting"}
                      </p>
                    </div>

                    {/* Message wall + form — headerless, lives in the same single container, toward center */}
                    <div className="flex-1 min-w-0 px-3 pb-3">
                      <BoardWall raceId={race.raceId} title={title(b)} count={weight(b)} leadPct={lead(b) * 100} board={b} leader={leader} framed={false} showHeader={false} />
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* ─── Mobile: one swipeable wall at a time ──────────────────── */}
      <div className="mt-2 lg:hidden">
        {mobileOrder.map((b) => (
          <div key={b} className={b === mobileBoard ? "block" : "hidden"}>
            <BoardWall raceId={race.raceId} title={title(b)} count={weight(b)} leadPct={lead(b) * 100} board={b} leader={race.leader === title(b)} />
          </div>
        ))}
        {/* swipe hint */}
        <div className="mt-1 flex justify-center gap-1">
          {mobileOrder.map((b) => (
            <button
              key={b}
              onClick={() => setMobileBoard(b)}
              className={`h-2 w-6 border border-black ${b === mobileBoard ? side(b).solid : "bg-canvasBlack"}`}
              aria-label={title(b)}
            />
          ))}
        </div>
      </div>

      {/* ─── Upcoming Roster ───────────────────────────────────────── */}
      {nextUp && (
        <div className="relative z-20 mx-auto mt-8 max-w-4xl border-2 border-dashed border-hypeNeon/50 bg-canvasBlack px-4 py-4 font-mono shadow-[6px_6px_0_rgba(0,0,0,0.55)]">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-hypeNeon">
            // NEXT IN THE BASKET
          </p>
          <p className="mt-2 text-sm text-sheetWhite">
            {nextUp.emoji} <span className="font-black">{nextUp.name}</span>
            {nextUp.net_worth && <span className="text-chop-muted"> — {nextUp.net_worth}</span>} waits for the survivor.
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-chop-muted">The roster is kept in a separate lane so it never sits underneath the guillotine frame.</p>
        </div>
      )}
    </section>
  );
}
