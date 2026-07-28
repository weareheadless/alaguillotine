"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { NavBar } from "../../components/NavBar";
import { account } from "../../lib/appwrite";
import {
  getCurrentEpoch,
  ensureEpoch,
  getTreasuryBalance,
  submitVote,
  fetchEpochHistory,
  fetchEpochVotes,
  isBoardMember,
} from "../../app/actions/epoch";
import type { EpochSummary, BoardMember, EpochDocument } from "../../lib/types";
import { getEpochThreshold, BOARD_SIZE } from "../../lib/types";

const HYPOTHESES: Record<string, { title: string; desc: string; icon: string }> = {
  H1: { title: "H1 — Plutocracy", desc: "Whales vote high burn. Alignment trick fails. Treasury shrinks.", icon: "🐋" },
  H2: { title: "H2 — Class Traitor", desc: "Committee balances burn, lottery, and dev. Greed routed properly.", icon: "🤝" },
  H3: { title: "H3 — Deadlock", desc: "Committee can't agree. Nothing gets allocated. Inaction wins.", icon: "💤" },
  H4: { title: "H4 — Kleptocracy", desc: "Committee votes itself a fat dividend. Self-interest wins.", icon: "👑" },
};

export default function BoardPage() {
  const [epoch, setEpoch] = useState<EpochSummary | null>(null);
  const [history, setHistory] = useState<EpochDocument[]>([]);
  const [boardMember, setBoardMember] = useState<BoardMember | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionJwt, setSessionJwt] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { publicKey } = useWallet();
  const { setVisible: showWalletModal } = useWalletModal();

  const load = useCallback(async () => {
    try {
      await ensureEpoch();
      const [epochData, historyData, balance] = await Promise.all([
        getCurrentEpoch(),
        fetchEpochHistory(),
        getTreasuryBalance(),
      ]);
      setEpoch(epochData);
      setHistory(historyData);
      setTreasuryBalance(balance);
    } catch (e) {
      console.error("Board load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await account.get();
        if (cancelled) return;
        const { jwt } = await account.createJWT();
        if (!cancelled) setSessionJwt(jwt);
      } catch {
        try {
          await account.createAnonymousSession();
          const { jwt } = await account.createJWT();
          if (!cancelled) setSessionJwt(jwt);
        } catch { /* fine */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!publicKey) { setBoardMember(null); return; }
    (async () => {
      const member = await isBoardMember(publicKey.toBase58());
      setBoardMember(member);
    })();
  }, [publicKey, epoch]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 20_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvasBlack">
        <div className="h-6 w-6 animate-spin rounded-sm border-2 border-spiteCrimson border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-canvasBlack">
      <NavBar />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 text-center">
          <h1 className="font-mono text-4xl font-black uppercase tracking-tighter text-sheetWhite">
            The <span className="text-spiteCrimson">Committee</span>
          </h1>
          <p className="mt-2 max-w-2xl mx-auto font-mono text-sm leading-relaxed text-chop-muted">
            // Look at them—our supreme leaders. These top 7 spenders bought their way into the inner circle, proving that even in a digital revolution, capital still wins. They threw the most money at the blade, so they get the ultimate power trip: directing the treasury flow every epoch. They decide who gets paid, who gets burned, and how much we allocate to &quot;the cause.&quot; They are the new oligarchs. Bow down to your new central bank.
          </p>
        </div>

        {/* ─── Protocol Stats ───────────────────────────────── */}
        <ProtocolStats epoch={epoch} treasuryBalance={treasuryBalance} />

        {/* ─── Two Column ───────────────────────────────────── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Left: Board Members */}
          <div className="border-4 border-black bg-sheetWhite p-6 font-mono shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
              <h2 className="text-lg font-black uppercase tracking-tighter text-canvasBlack">🏛️ The Committee</h2>
              {epoch && <StatusBadge status={epoch.status} />}
            </div>
            {epoch && epoch.board_members.length > 0 && epoch.board_members.some((m) => m.voted) ? (
              <div className="divide-y divide-black/20">
                {epoch.board_members.map((m, i) => (
                  <div key={m.wallet} className="flex items-center gap-3 px-2 py-2.5 text-xs text-canvasBlack">
                    <span className="w-6 text-center font-black text-chop-muted">{i + 1}</span>
                    <span className="flex-1 truncate font-mono text-[11px] text-canvasBlack">{m.wallet.slice(0, 8)}...{m.wallet.slice(-6)}</span>
                    <span className="font-bold tabular-nums text-canvasBlack">{m.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} CHOP</span>
                    {m.voted ? <span className="text-hypeNeon font-bold">✓</span> : <span className="text-chop-muted">—</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-canvasBlack">
                <p className="text-4xl mb-3">🪑</p>
                <p className="text-sm font-bold uppercase tracking-wider text-canvasBlack">
                  No Committee Yet
                </p>
                <p className="mt-2 text-xs text-chop-muted max-w-xs mx-auto">
                  Nobody has earned a seat through participation. Nominate someone on the Town Square to qualify. Seats are earned, not bought.
                </p>
              </div>
            )}
          </div>

          {/* Right: Voting */}
          <div className="border-4 border-black bg-sheetWhite p-6 font-mono shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
              <h2 className="text-lg font-black uppercase tracking-tighter text-canvasBlack">⚙️ Treasury Allocation</h2>
              {epoch && epoch.status === "voting" && (
                <span className="animate-pulse rounded-sm border-2 border-black bg-spiteCrimson px-2 py-0.5 text-[10px] font-black text-sheetWhite">VOTE NOW</span>
              )}
            </div>
            {epoch ? (
              <VoteSliders epochNumber={epoch.epoch_number} status={epoch.status} boardMember={boardMember} sessionJwt={sessionJwt} publicKey={publicKey} showWalletModal={() => showWalletModal(true)} onVoted={load} treasuryBalance={treasuryBalance} threshold={getEpochThreshold(epoch.epoch_number)} />
            ) : (
              <p className="py-8 text-center text-sm text-chop-muted">Waiting for epoch...</p>
            )}
          </div>
        </div>

        {/* ─── Epoch History ───────────────────────────────── */}
        {history.length > 0 && (
          <div className="mt-6">
            <EpochHistory epochs={history} />
          </div>
        )}

        {/* ─── How It Works ────────────────────────────────── */}
        <div className="mt-8 border-4 border-black bg-sheetWhite p-6 font-mono shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="mb-4 border-b-2 border-black pb-2 text-lg font-black uppercase tracking-tighter text-canvasBlack">📋 How It Works</h2>
            <div className="grid gap-3 text-xs sm:grid-cols-4">
            <div className="border border-black/20 p-3">
              <span className="font-black text-spiteCrimson">1. EPOCH STARTS</span>
              <p className="mt-1 text-chop-muted">A new epoch begins. Top 7 participants (most nominations) earn committee seats.</p>
            </div>
            <div className="border border-black/20 p-3">
              <span className="font-black text-hypeNeon">2. COMMITTEE VOTES</span>
              <p className="mt-1 text-chop-muted">Committee splits treasury: Burn, Lottery, Dev Fund, Board Dividend, Revolution Fund. Must sum to 100%.</p>
            </div>
            <div className="border border-black/20 p-3">
              <span className="font-black text-canvasBlack">3. REVOLUTION FUND</span>
              <p className="mt-1 text-chop-muted">The Revolution Fund pays out to a community-chosen cause. Committee nominates and votes on recipients each epoch.</p>
            </div>
            <div className="border border-black/20 p-3">
              <span className="font-black text-spiteCrimson">4. EXECUTION</span>
              <p className="mt-1 text-chop-muted">Votes averaged. Treasury moves. Recipients funded. New epoch begins. The revolution accidentally became a functional mutual aid DAO.</p>
            </div>
          </div>
          <div className="mt-4 border-t border-black/20 pt-4">
            <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-canvasBlack">Pre-Registered Hypotheses</h3>
            <div className="space-y-2">
              {Object.entries(HYPOTHESES).map(([key, h]) => (
                <div key={key} className="flex items-start gap-2 border border-black/10 p-2 text-[11px]">
                  <span className="text-lg">{h.icon}</span>
                  <div>
                    <span className="font-bold">{h.title}</span>
                    <p className="text-chop-muted">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Protocol Stats ────────────────────────────────────────────────────────

function ProtocolStats({ epoch, treasuryBalance }: { epoch: EpochSummary | null; treasuryBalance: number | null }) {
  const threshold = epoch ? getEpochThreshold(epoch.epoch_number) : 0;
  const committeeCount = epoch?.board_members?.filter((m: BoardMember) => m.voted).length ?? 0;
  return (
    <div className="grid grid-cols-2 gap-3 font-mono sm:grid-cols-4">
      <StatBox label="Current Epoch" value={epoch ? String(epoch.epoch_number) : "—"} color="text-hypeNeon" />
      <StatBox label="Msgs to Vote" value={threshold ? threshold.toLocaleString() : "—"} suffix="(1 CHOP burned each)" />
      <StatBox label="Committee" value={committeeCount > 0 ? String(committeeCount) : "—"} suffix={`of ${BOARD_SIZE}`} />
      <StatBox label="Treasury" value={treasuryBalance !== null ? treasuryBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"} suffix="$CHOP" color="text-hypeNeon" />
    </div>
  );
}

function StatBox({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color?: string }) {
  return (
    <div className="border-2 border-black bg-canvasBlack p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-chop-muted">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color || "text-sheetWhite"}`}>{value}</p>
      {suffix && <p className="text-[10px] text-chop-muted">{suffix}</p>}
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "ACTIVE", className: "bg-hypeNeon text-canvasBlack" },
    voting: { label: "VOTING", className: "bg-spiteCrimson text-sheetWhite animate-pulse" },
    executed: { label: "EXECUTED", className: "bg-canvasBlack text-chop-muted" },
  };
  const s = map[status] || map.active;
  return <span className={`rounded-sm border-2 border-black px-3 py-1 text-[10px] font-black uppercase tracking-widest ${s.className}`}>{s.label}</span>;
}

// ─── Vote Sliders ───────────────────────────────────────────────────────────

function VoteSliders({ epochNumber, status, boardMember, sessionJwt, publicKey, showWalletModal, onVoted, treasuryBalance, threshold }: {
  epochNumber: number; status: string; boardMember: BoardMember | null; sessionJwt: string | null;
  publicKey: any; showWalletModal: () => void; onVoted: () => void;
  treasuryBalance: number | null; threshold: number;
}) {
  const [burn, setBurn] = useState(5);
  const [lottery, setLottery] = useState(15);
  const [dev, setDev] = useState(35);
  const [board, setBoard] = useState(25);
  const [revolution, setRevolution] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const adjust = (which: "burn" | "lottery" | "dev" | "board" | "revolution", v: number) => {
    const setWhich = { burn: setBurn, lottery: setLottery, dev: setDev, board: setBoard, revolution: setRevolution }[which];
    setWhich(v);
    const rem = 100 - v;
    const others = ["burn","lottery","dev","board","revolution"].filter(k => k !== which) as Array<"burn"|"lottery"|"dev"|"board"|"revolution">;
    const state = { burn: burn, lottery: lottery, dev: dev, board: board, revolution: revolution };
    state[which] = v;
    const otherSum = others.reduce((s, k) => s + state[k], 0) || 1;
    let remaining = rem;
    for (let i = 0; i < others.length; i++) {
      const k = others[i];
      if (i === others.length - 1) {
        const setter = { burn: setBurn, lottery: setLottery, dev: setDev, board: setBoard, revolution: setRevolution }[k];
        setter(remaining);
      } else {
        const val = Math.round(state[k] / otherSum * rem);
        const setter = { burn: setBurn, lottery: setLottery, dev: setDev, board: setBoard, revolution: setRevolution }[k];
        setter(val);
        remaining -= val;
        state[k] = val;
      }
    }
  };

  const handleSubmit = async () => {
    if (!publicKey) { showWalletModal(); return; }
    if (!sessionJwt) { setError("Session not ready."); return; }
    setSubmitting(true); setError("");
    const result = await submitVote(sessionJwt, publicKey.toBase58(), burn, lottery, dev, board, revolution);
    if (result.success) { setDone(true); onVoted(); }
    else setError(result.error || "Vote failed.");
    setSubmitting(false);
  };

  const total = burn + lottery + dev + board + revolution;
  const isVoting = status === "voting";
  const alreadyVoted = done || (boardMember && boardMember.voted);

  if (alreadyVoted && boardMember?.vote) {
    return (
      <div className="border-2 border-hypeNeon bg-hypeNeon/10 p-4 text-center">
        <p className="text-sm font-bold uppercase text-hypeNeon">✓ Vote Cast</p>
        <div className="mt-2 flex justify-center gap-4 text-xs text-canvasBlack">
          <span>🔥 {boardMember.vote.burn_rate}%</span>
          <span>🎲 {boardMember.vote.lottery_rate}%</span>
          <span>🛠️ {boardMember.vote.dev_rate}%</span>
          <span>👑 {boardMember.vote.board_rate}%</span>
          <span>🚩 {boardMember.vote.revolution_rate}%</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!isVoting && (
        <div className="mb-3 rounded-sm border border-black/20 bg-black/5 px-3 py-1.5 text-center">
          <p className="text-[11px] text-chop-muted">
            {status === "executed" ? "Voting closed. Results above." : "Voting opens when threshold is reached. Preview:"}
          </p>
        </div>
      )}

      {/* Per-message burn = (treasury × burn%) / threshold */}
      {treasuryBalance !== null && treasuryBalance > 0 && (
        <div className="mb-3 rounded-sm border-2 border-spiteCrimson/30 bg-spiteCrimson/5 px-3 py-1.5 text-center">
          <p className="text-[11px] text-canvasBlack">
            🔥 <strong>{((treasuryBalance * burn / 100) / threshold).toLocaleString(undefined, { maximumFractionDigits: 2 })} CHOP</strong> burned per message
            <span className="block text-[10px] text-chop-muted">
              ({burn}% of {(treasuryBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} treasury ÷ {threshold.toLocaleString()} msgs)
            </span>
          </p>
        </div>
      )}
      {isVoting && !boardMember && publicKey && (
        <div className="mb-3 rounded-sm border border-spiteCrimson/30 bg-spiteCrimson/5 px-3 py-1.5 text-center">
          <p className="text-[11px] text-spiteCrimson">Your wallet is not on the board.</p>
        </div>
      )}
      {isVoting && !publicKey && (
        <div className="mb-3 text-center">
          <button onClick={showWalletModal} className="border-2 border-black bg-spiteCrimson px-4 py-2 text-xs font-bold uppercase text-sheetWhite">Connect Wallet</button>
        </div>
      )}

      <div className={isVoting && boardMember ? "" : "pointer-events-none opacity-60"}>
        <SliderRow label="🔥 Burn" value={burn} onChange={(v) => adjust("burn", v)} color="#e63946" hint="Destroyed forever — deflationary." />
        <SliderRow label="🎲 Lottery" value={lottery} onChange={(v) => adjust("lottery", v)} color="#39ff14" hint="Paid to one random active user." />
        <SliderRow label="🛠️ Dev Fund" value={dev} onChange={(v) => adjust("dev", v)} color="#3b82f6" hint="Pays the founder to keep the site running." />
        <SliderRow label="👑 Board Dividend" value={board} onChange={(v) => adjust("board", v)} color="#f59e0b" hint="Paid equally to the committee members." />
        <SliderRow label="🚩 Revolution Fund" value={revolution} onChange={(v) => adjust("revolution", v)} color="#dc2626" hint="Treasury pays out to a community-chosen cause or protest fund." />
      </div>

      <div className={`mt-4 text-center text-2xl font-black ${total === 100 ? "text-hypeNeon" : "text-spiteCrimson"}`}>{total}%</div>
      {error && <p className="mt-2 text-xs font-bold text-spiteCrimson">{error}</p>}

      {isVoting && boardMember && !alreadyVoted && (
        <button onClick={handleSubmit} disabled={submitting || total !== 100}
          className="mt-4 w-full cursor-pointer border-2 border-black bg-spiteCrimson py-3 text-center font-bold uppercase tracking-wider text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40">
          {submitting ? "SUBMITTING..." : "CAST VOTE"}
        </button>
      )}
    </div>
  );
}

function SliderRow({ label, value, onChange, color, hint }: { label: string; value: number; onChange: (v: number) => void; color: string; hint: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-wider text-canvasBlack">{label}</span>
        <span className="text-lg font-black text-canvasBlack tabular-nums">{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-3 cursor-pointer appearance-none border-2 border-black bg-white
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        style={{ accentColor: color }} />
      <p className="text-[10px] italic text-chop-muted">{hint}</p>
    </div>
  );
}

// ─── Epoch History ─────────────────────────────────────────────────────────

function EpochHistory({ epochs }: { epochs: EpochDocument[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [votes, setVotes] = useState<Array<{ voter_wallet: string; burn_rate: number; lottery_rate: number; dev_rate: number; board_rate: number }>>([]);

  return (
    <div className="border-4 border-black bg-sheetWhite p-6 font-mono shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <h2 className="mb-4 border-b-2 border-black pb-2 text-lg font-black uppercase tracking-tighter text-canvasBlack">📜 Epoch History</h2>
      <div className="divide-y divide-black/20">
        {epochs.map((ep) => (
          <div key={ep.$id}>
            <button onClick={async () => {
              const next = selected === ep.$id ? null : ep.$id; setSelected(next);
              if (next) { const v = await fetchEpochVotes(ep.$id); setVotes(v); }
            }} className="flex w-full items-center gap-4 px-3 py-2.5 text-left text-xs hover:bg-black/5">
              <span className="w-16 font-bold text-chop-muted">Epoch #{ep.epoch_number}</span>
              <span className="flex-1">🔥{ep.final_burn}% / 🎲{ep.final_lottery}% / 🛠️{ep.final_dev}% / 👑{ep.final_board}% / 🚩{(ep as any).final_revolution ?? 0}%</span>
              <HypothesisBadge h={ep.hypothesis_winner} />
              <span className="text-[10px] text-chop-muted">{new Date(ep.executed_at || ep.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </button>
            {selected === ep.$id && (
              <div className="bg-black/5 px-6 py-3 text-xs">
                {ep.hypothesis_winner && HYPOTHESES[ep.hypothesis_winner] && (
                  <div className="mb-2 flex items-center gap-2"><span>{HYPOTHESES[ep.hypothesis_winner].icon}</span><span className="font-bold">{HYPOTHESES[ep.hypothesis_winner].title}</span></div>
                )}
                {votes.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-chop-muted">Votes:</p>
                    {votes.map((v, i) => (
                      <div key={i} className="flex gap-3 text-[11px]">
                        <span className="font-mono">{v.voter_wallet.slice(0, 8)}...</span>
                        <span>🔥{v.burn_rate}% 🎲{v.lottery_rate}% 🛠️{v.dev_rate}% 👑{v.board_rate}% 🚩{(v as any).revolution_rate ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[11px] text-chop-muted">No votes recorded.</p>}
                <div className="mt-2 flex gap-4 text-[10px] text-chop-muted">
                  <span>Unique senders: {ep.unique_senders}</span>
                  <span>Treasury: {ep.treasury_amount.toLocaleString()} CHOP</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HypothesisBadge({ h }: { h: string | null }) {
  if (!h) return null;
  const colors: Record<string, string> = { H1: "bg-red-100 text-red-800 border-red-400", H2: "bg-green-100 text-green-800 border-green-400", H3: "bg-gray-100 text-gray-600 border-gray-400" };
  return <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold ${colors[h] || ""}`}>{h}</span>;
}
