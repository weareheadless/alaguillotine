"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { NavBar } from "../../components/NavBar";
import { VotingPanel } from "../../components/VotingPanel";
import {
  getCurrentEpoch,
  ensureEpoch,
} from "../../app/actions/epoch";
import {
  fetchActiveProposals,
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

      if (!epoch || epoch.status === "active") {
        // No voting epoch yet
        setProposals([]);
        setTally(null);
        setMyVote(null);
        if (epoch) setEpochNumber(epoch.epoch_number);
        return;
      }

      setEpochNumber(epoch.epoch_number);

      const [proposalsData, tallyData] = await Promise.all([
        fetchActiveProposals(),
        fetchEpochTally(),
      ]);

      setProposals(proposalsData);

      if (tallyData) {
        setTally(tallyData);
        setOracleFired(tallyData.oracle_fired);
        setAttemptNumber(tallyData.attempt_number);
      }

      // Set attempt number from active proposals
      if (proposalsData.length > 0) {
        setAttemptNumber(proposalsData[0].attempt_number);
      }

      // Fetch my vote
      if (connected && publicKey && epoch) {
        const vote = await fetchMyVote(epoch.epoch_number);
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

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-12 text-center relative">
          <div className="inline-block border-b-4 border-spiteCrimson pb-3 mb-6 relative z-10">
            <h1 className="font-mono text-4xl font-black uppercase tracking-tighter text-sheetWhite sm:text-5xl md:text-6xl drop-shadow-[4px_4px_0_rgba(220,38,38,1)]">
              PROXY <span className="text-spiteCrimson">WAR</span>
            </h1>
          </div>
          <div className="mx-auto max-w-xl font-mono text-sm leading-relaxed text-sheetWhite bg-black p-4 border-2 border-gray-800 shadow-[6px_6px_0_0_#000] relative">
            <p className="mb-2">The AI Oracle pitches 3 manic allocation plans. The mob votes. If none win, the Oracle gets executed.</p>
            <p className="text-hypeNeon font-bold uppercase animate-pulse">
              ⚠️ HIGH BURN = EXPENSIVE FREE MESSAGES
            </p>
          </div>

          {/* Status line */}
          <div className="mt-8 font-mono text-sm tracking-widest inline-block shadow-[4px_4px_0_0_#000]">
            {oracleFired ? (
              <span className="block border-4 border-red-600 bg-red-600/20 px-4 py-2 font-black uppercase text-red-500 animate-pulse">
                💀 ORACLE FIRED. SYSTEM OVERRIDE.
              </span>
            ) : tally?.is_none_winner ? (
              <span className="block border-4 border-amber-400 bg-amber-400/20 px-4 py-2 font-black uppercase text-amber-400">
                ⚠ REGENERATING — ATTEMPT {attemptNumber}/3
              </span>
            ) : tally?.winner ? (
              <span className="block border-4 border-green-500 bg-green-500/20 px-4 py-2 font-black uppercase text-green-400">
                ✓ EPOCH {epochNumber} EXECUTED
              </span>
            ) : proposals.length > 0 ? (
              <span className="block border-4 border-hypeNeon bg-hypeNeon/10 px-4 py-2 font-black uppercase text-hypeNeon animate-pulse">
                VOTING OPEN — EPOCH {epochNumber}
              </span>
            ) : (
              <span className="block border-4 border-gray-700 bg-black px-4 py-2 font-black uppercase text-chop-muted">
                {epochNumber > 0
                  ? `AWAITING PROPOSALS — EPOCH ${epochNumber}`
                  : "THE BLADE AWAITS."}
              </span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 border-4 border-red-600 bg-black p-4 font-mono text-sm font-bold text-red-500 shadow-[6px_6px_0_0_rgba(220,38,38,1)] uppercase">
            <span className="animate-ping mr-2">!</span>{error}
          </div>
        )}

        {/* Voting Panel */}
        <VotingPanel
          proposals={proposals}
          tally={tally}
          myVote={myVote}
          onVote={handleVote}
          isWalletConnected={connected}
          hasEnoughChop={true} // TODO: Check balance on-chain
          oracleFired={oracleFired}
          isLoading={loading}
          epochNumber={epochNumber}
          attemptNumber={attemptNumber}
        />
      </main>
    </div>
  );
}
