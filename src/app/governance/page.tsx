"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { NavBar } from "../../components/NavBar";
import { VotingPanel } from "../../components/VotingPanel";
import { WarRoom } from "../../components/WarRoom";
import {
  getCurrentEpoch,
  ensureEpoch,
} from "../../app/actions/epoch";
import {
  fetchLatestProposals,
  fetchEpochTally,
  fetchMyVote,
  castVote,
} from "../../app/actions/governance";
import type { ProposalWithTally, EpochTally } from "../../lib/types";

export default function GovernancePage() {
  const [proposals, setProposals] = useState<ProposalWithTally[]>([]);
  const [tally, setTally] = useState<EpochTally | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [epochNumber, setEpochNumber] = useState<number>(0);
  const [attemptNumber, setAttemptNumber] = useState<number>(1);
  const [oracleFired, setOracleFired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { publicKey, connected } = useWallet();

  const load = useCallback(async () => {
    try {
      setError(null);
      await ensureEpoch();
      const epoch = await getCurrentEpoch();

      const [proposalsData, tallyData] = await Promise.all([
        fetchLatestProposals(),
        fetchEpochTally(),
      ]);

      setProposals(proposalsData);

      // The epoch being voted on is whichever epoch produced the latest proposals.
      const latestEpochNumber =
        proposalsData[0]?.epoch_number ??
        tallyData?.epoch_number ??
        epoch?.epoch_number ??
        0;

      setEpochNumber(latestEpochNumber);

      if (tallyData) {
        setTally(tallyData);
        setOracleFired(tallyData.oracle_fired);
        setAttemptNumber(tallyData.attempt_number);
      }

      // Set attempt number from the latest proposals
      if (proposalsData.length > 0) {
        setAttemptNumber(proposalsData[0].attempt_number);
      }

      // Fetch my vote
      if (connected && publicKey && latestEpochNumber > 0) {
        const vote = await fetchMyVote(latestEpochNumber);
        setMyVote(vote);
      }
    } catch (e) {
      console.error("Governance load error:", e);
      setError("Failed to load governance data.");
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 20_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const handleVote = async (
    proposalId: string,
    signature: string,
    signedMessage: string,
  ) => {
    const result = await castVote(proposalId, signature, signedMessage);
    if (result.success) {
      setMyVote(proposalId);
      await load(); // Refresh tally
    } else {
      throw new Error(result.error || "Vote failed.");
    }
  };

  return (
    <div className="relative min-h-screen bg-canvasBlack overflow-hidden">
      <NavBar />

      {/* Grimy background noise/scanlines */}
      <div className="pointer-events-none fixed inset-0 opacity-10"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)' }}>
      </div>

      <main className="relative z-10 mx-auto max-w-[95rem] px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center relative">
          <div className="inline-block border-b-4 border-spiteCrimson pb-3 mb-6 relative z-10">
            <h1 className="font-mono text-4xl font-black uppercase tracking-tighter text-sheetWhite sm:text-5xl md:text-6xl drop-shadow-[4px_4px_0_rgba(220,38,38,1)]">
              PROXY <span className="text-spiteCrimson">WAR</span>
            </h1>
          </div>
          <div className="mx-auto font-mono text-sm leading-relaxed text-sheetWhite bg-black p-4 border-2 border-gray-800 shadow-[6px_6px_0_0_#000] relative text-left">
            <p className="mb-2">
              <span className="text-spiteCrimson font-bold">// SKYNET_BUDGET_EDITION.exe —</span> A domesticated AI overlord with the god complex of a lawnmower has been granted <span className="text-amber-400">limited</span> control over the protocol. It proposes treasury allocations. You vote. It obeys. Think of it as a Terminator that needs your permission to open a spreadsheet.
            </p>
            <p className="mb-2 text-chop-muted">
              The Oracle controls exactly <span className="text-sheetWhite font-bold">three levers</span>: burn rate, redistribution %, and dev fund %. That&apos;s it. It cannot launch nukes, it cannot self-replicate, and it definitely cannot rewrite its own prompt — <span className="text-spiteCrimson">we checked.</span>
            </p>
            <p className="mb-2">
              Reject all three proposals and the Oracle gets <span className="text-spiteCrimson font-bold">unplugged</span>. Permanently. Three strikes and Skynet goes back to being a calculator. The community can always vote to grant it new powers, new levers, maybe even a sense of humor — but that&apos;s <span className="text-hypeNeon font-bold">your call, not its.</span>
            </p>
            <p className="text-hypeNeon font-bold uppercase animate-pulse">
              ⚠️ THE ORACLE CONTROLS THE BURN. DEMOCRACY CONTROLS THE ORACLE. THIS IS NOT A DRILL.
            </p>
          </div>

          {/* Status line */}
          <div className="mt-6 font-mono text-sm tracking-widest inline-block shadow-[4px_4px_0_0_#000] w-full max-w-none">
            {oracleFired ? (
              <span className="block border-4 border-red-600 bg-red-600/20 px-4 py-2 font-black uppercase text-red-500 animate-pulse text-center">
                💀 ORACLE TERMINATED. SKYNET IS OFFLINE. COMMUNITY MANUAL OVERRIDE ACTIVE.
              </span>
            ) : tally?.is_none_winner ? (
              <span className="block border-4 border-amber-400 bg-amber-400/20 px-4 py-2 font-black uppercase text-amber-400 text-center">
                ⚠ THE ORACLE SWEATS — REGENERATING PROPOSALS (ATTEMPT {attemptNumber}/3)
              </span>
            ) : tally?.winner ? (
              <span className="block border-4 border-green-500 bg-green-500/20 px-4 py-2 font-black uppercase text-green-400 text-center">
                ✓ EPOCH {epochNumber} EXECUTED — THE HIVE MIND HAS SPOKEN
              </span>
            ) : proposals.length > 0 ? (
              <span className="block border-4 border-hypeNeon bg-hypeNeon/10 px-4 py-2 font-black uppercase text-hypeNeon animate-pulse text-center">
                🗳 VOTING LIVE — EPOCH {epochNumber} — THE ORACLE AWAITS YOUR JUDGMENT
              </span>
            ) : (
              <span className="block border-4 border-gray-700 bg-black px-4 py-2 font-black uppercase text-chop-muted text-center">
                {epochNumber > 0
                  ? `ORACLE BOOTING UP — AWAITING PROPOSALS FOR EPOCH ${epochNumber}`
                  : "THE ORACLE BOOTS WHEN THE FIRST EPOCH TRIGGERS. THE BLADE COMES FIRST."}
              </span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 border-4 border-red-600 bg-black p-4 font-mono text-sm font-bold text-red-500 shadow-[6px_6px_0_0_rgba(220,38,38,1)] uppercase">
            <span className="animate-ping mr-2">!</span>{error}
          </div>
        )}

        {/* Tally / Progress Bar — full width above the split */}
        {proposals.length > 0 && (
          <div className="mb-4 h-10 flex overflow-hidden border-4 border-gray-800 shadow-[6px_6px_0_0_#000]">
            {proposals.map((p) => (
              <div
                key={p.id}
                className={`flex flex-col items-center justify-center text-[10px] sm:text-xs font-black uppercase transition-all border-r-2 border-black last:border-r-0 ${
                  p.is_none_option
                    ? "bg-red-600 text-black"
                    : "bg-gray-300 text-canvasBlack hover:bg-sheetWhite"
                } ${
                  p.id === myVote ? "ring-4 ring-inset ring-spiteCrimson bg-sheetWhite" : ""
                }`}
                style={{
                  width: p.percentage > 0 ? `${p.percentage}%` : "0%",
                  minWidth: p.percentage > 0 ? "3rem" : "0",
                }}
                title={`${p.title}: ${p.vote_count} votes (${p.percentage}%)`}
              >
                <span className="truncate w-full text-center px-1">{p.emoji} {p.percentage}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Total votes */}
        {proposals.length > 0 && (
          <div className="text-center font-mono text-xs text-chop-muted mb-4">
            {(tally?.total_votes || proposals.reduce((s, p) => s + p.vote_count, 0)).toLocaleString()}{" "}
            votes cast • Epoch {epochNumber}
            {attemptNumber > 1 && ` • Attempt ${attemptNumber}/3`}
          </div>
        )}

        {/* Column Headers */}
        <div className="mb-2 font-mono text-xs font-black uppercase tracking-widest text-chop-muted border-b-2 border-spiteCrimson pb-1">
          🔮 ORACLE PROPOSALS
        </div>

        {/* Proposals — horizontal 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <VotingPanel
            proposals={proposals}
            tally={tally}
            myVote={myVote}
            onVote={handleVote}
            isWalletConnected={connected}
            hasEnoughChop={true}
            oracleFired={oracleFired}
            isLoading={loading}
            epochNumber={epochNumber}
            attemptNumber={attemptNumber}
          />
        </div>

        {/* War Room — full width below */}
        <div className="mb-2 font-mono text-xs font-black uppercase tracking-widest text-chop-muted border-b-2 border-hypeNeon pb-1">
          📢 THE PEOPLE'S WAR COUNCIL
        </div>
        <div>
          <WarRoom isWalletConnected={connected} />
        </div>
      </main>
    </div>
  );
}
