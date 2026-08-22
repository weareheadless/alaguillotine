"use client";

import { useState } from "react";
import { ProposalCard } from "./ProposalCard";
import type { ProposalWithTally, EpochTally } from "../lib/types";
import { useTerminal } from "../lib/terminal-context";

interface VotingPanelProps {
  proposals: ProposalWithTally[];
  tally: EpochTally | null;
  myVote: string | null;
  onVote: (proposalId: string, signature: string, signedMessage: string) => Promise<void>;
  isWalletConnected: boolean;
  hasEnoughChop: boolean;
  oracleFired: boolean;
  isLoading: boolean;
  epochNumber: number;
  attemptNumber: number;
}

export function VotingPanel({
  proposals,
  tally,
  myVote,
  onVote,
  isWalletConnected,
  hasEnoughChop,
  oracleFired,
  isLoading,
  epochNumber,
  attemptNumber,
}: VotingPanelProps) {
  const [votingId, setVotingId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const { addMessage } = useTerminal();

  const isVotingClosed = tally?.winner != null;
  const hasVoted = myVote !== null;

  const handleVote = async (proposalId: string) => {
    setVoteError(null);

    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) return;

    addMessage(`>_ INITIATING GOVERNANCE VOTE...`, "text-hypeNeon", 10);
    addMessage(`>_ TARGET: PROPOSAL ${proposalId}`, "text-hypeNeon", 5);

    const message = `I vote for: ${proposal.title} (proposal ${proposalId})`;

    // Request signature from wallet
    try {
      const { solana } = window as any;
      if (!solana?.isPhantom) {
        addMessage(`[ERROR] PHANTOM WALLET NOT DETECTED`, "text-spiteCrimson", 10);
        setVoteError("Phantom wallet required for voting.");
        return;
      }

      setVotingId(proposalId);

      addMessage(`>_ REQUESTING ZERO-KNOWLEDGE SIGNATURE...`, "text-hypeNeon", 20);
      const encodedMessage = new TextEncoder().encode(message);
      const result = await solana.signMessage(encodedMessage, "utf8");
      // result.signature is a Uint8Array
      const sigBytes = new Uint8Array(result.signature);

      // Convert to base58 for our verification
      const bs58 = (await import("bs58")).default;
      const sigB58 = bs58.encode(sigBytes);

      addMessage(`[OK] CRYPTOGRAPHIC PROOF VERIFIED: ${sigB58.substring(0, 16)}...`, "text-hypeNeon", 5);
      addMessage(`>_ SUBMITTING VOTE TALLY...`, "text-hypeNeon", 15);
      
      await onVote(proposalId, sigB58, message);
      
      addMessage(`[OK] VOTE RECORDED ON-CHAIN`, "text-hypeNeon", 5);
    } catch (err: any) {
      if (err?.message !== "User rejected the request.") {
        addMessage(`[ERROR] SIGNATURE FAILED: ${err?.message}`, "text-spiteCrimson", 10);
        setVoteError(err?.message || "Signature failed.");
      } else {
        addMessage(`[WARN] VOTE REJECTED BY USER`, "text-yellow-400", 10);
      }
    } finally {
      setVotingId(null);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 font-mono bg-canvasBlack border-4 border-gray-800 shadow-[8px_8px_0_0_#000] col-span-full">
        <div className="h-8 w-8 animate-spin border-4 border-hypeNeon border-t-transparent" />
        <span className="ml-3 font-black uppercase text-base text-sheetWhite animate-pulse tracking-widest">
          THE ORACLE IS YELLING...
        </span>
      </div>
    );
  }

  // ─── Oracle Fired ───────────────────────────────────────────────────────────

  if (oracleFired) {
    return (
      <div className="border-4 border-red-600 bg-canvasBlack p-6 text-center font-mono shadow-[12px_12px_0_0_rgba(220,38,38,1)] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(220,38,38,0.1)_10px,rgba(220,38,38,0.1)_20px)] col-span-full">
        <span className="text-6xl drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">💀</span>
        <h2 className="mt-4 text-3xl font-black uppercase text-red-500 drop-shadow-[2px_2px_0_#000]">
          SYSTEM FATAL: ORACLE EXECUTED
        </h2>
        <p className="mt-3 text-sm text-sheetWhite bg-black p-3 border border-red-900 inline-block">
          The mob rejected all plans 3 times. The Oracle is dead. <br/>
          <span className="text-red-400 font-bold">DEFAULT ALLOCATION IN EFFECT (25/25/25/25).</span><br/>
          A new AI prompt must be engineered to restore democracy.
        </p>
      </div>
    );
  }

  // ─── No Proposals Yet ───────────────────────────────────────────────────────

  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 font-mono border-4 border-gray-800 bg-black shadow-[8px_8px_0_0_#333] col-span-full">
        <span className="text-5xl animate-bounce drop-shadow-[0_0_15px_rgba(57,255,20,0.5)]">🔮</span>
        <p className="mt-4 text-lg font-black uppercase text-hypeNeon animate-pulse">
          THE ORACLE IS PREPARING THE MANIFESTOS...
        </p>
        <p className="mt-1 text-xs text-chop-muted uppercase tracking-widest">
          Standby for the drop.
        </p>
      </div>
    );
  }

  // ─── Proposals (horizontal grid) ─────────────────────────────────────────────

  return (
    <>
      {/* Vote error */}
      {voteError && (
        <div className="col-span-full border-4 border-red-600 bg-black p-3 font-mono text-xs font-bold text-red-500 shadow-[4px_4px_0_0_rgba(220,38,38,1)] uppercase">
          <span className="mr-2 animate-ping">⚠</span> {voteError}
        </div>
      )}

      {/* Proposal cards — horizontal grid (NONE is handled separately below) */}
      {proposals
        .filter((p) => p.is_none_option !== 1)
        .map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            isWinner={proposal.status === "won"}
            isNone={false}
            hasVoted={hasVoted}
            isMyVote={myVote === proposal.id}
            onVote={handleVote}
            isWalletConnected={isWalletConnected}
            hasEnoughChop={hasEnoughChop}
          />
        ))}

      {/* NONE option — big rejection button */}
      {(() => {
        const noneProposal = proposals.find((p) => p.is_none_option === 1);
        if (!noneProposal) return null;

        const noneVoted = myVote === noneProposal.id;
        const attemptsUsed = noneProposal.attempt_number || 0;
        const attemptsLeft = 3 - attemptsUsed;
        const canVote =
          isWalletConnected &&
          hasEnoughChop &&
          !hasVoted &&
          !isVotingClosed &&
          noneProposal.status === "active";
        const isNoneWinner = noneProposal.status === "won";

        return (
          <div className="col-span-full mt-2">
            <div className={`flex items-center gap-4 p-3 border-2 font-mono ${
              isNoneWinner
                ? "border-amber-400 bg-amber-400/10"
                : noneVoted
                  ? "border-spiteCrimson bg-spiteCrimson/5"
                  : "border-red-900/50 bg-red-900/5 hover:border-red-600/50"
            }`}>
              {/* Vote count */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-lg font-black text-sheetWhite">{noneProposal.vote_count}</span>
                <span className="text-[10px] text-chop-muted uppercase">rejection<br/>votes</span>
                {noneProposal.percentage > 0 && (
                  <span className="text-xs text-red-400 font-bold">{noneProposal.percentage}%</span>
                )}
              </div>

              {/* Label + attempts */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-black uppercase text-red-400 tracking-wider">
                  ☠️ REJECT ALL PROPOSALS
                </span>
                <p className="text-[9px] text-chop-muted mt-0.5">
                  None of the above. Make the Oracle try again.{" "}
                  <span className={attemptsLeft <= 1 ? "text-spiteCrimson font-bold" : "text-amber-400"}>
                    {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining until Oracle is executed.
                  </span>
                </p>
              </div>

              {/* Button */}
              {canVote && (
                <button
                  onClick={() => handleVote(noneProposal.id)}
                  className="shrink-0 border-2 border-red-600 bg-red-600/20 px-5 py-2 text-xs font-black uppercase text-red-400 hover:bg-red-600 hover:text-black shadow-[3px_3px_0_0_rgba(220,38,38,0.5)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  REJECT ALL
                </button>
              )}
              {noneVoted && !isNoneWinner && (
                <span className="shrink-0 border-2 border-spiteCrimson px-3 py-1.5 text-[10px] font-black uppercase text-spiteCrimson">
                  REJECTED ✓
                </span>
              )}
              {isNoneWinner && (
                <span className="shrink-0 border-2 border-amber-400 bg-amber-400 px-3 py-1.5 text-[10px] font-black uppercase text-black animate-pulse">
                  ⚠ NONE WON — REGENERATING
                </span>
              )}
              {!isWalletConnected && (
                <span className="shrink-0 bg-red-900/40 text-red-500 px-2 py-1 text-[9px] font-bold uppercase border border-red-900">
                  CONNECT WALLET
                </span>
              )}
              {isWalletConnected && !hasEnoughChop && !hasVoted && (
                <span className="shrink-0 bg-amber-900/40 text-amber-500 px-2 py-1 text-[9px] font-bold uppercase border border-amber-900">
                  NEED $CHOP
                </span>
              )}
              {hasVoted && !noneVoted && (
                <span className="shrink-0 text-[9px] font-bold text-chop-muted uppercase line-through">
                  ALREADY VOTED
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Voting closed message */}
      {isVotingClosed && (
        <div className="col-span-full border-4 border-amber-400 bg-black p-4 text-center font-mono shadow-[8px_8px_0_0_rgba(251,191,36,1)]">
          <span className="text-base font-black uppercase text-amber-400 animate-pulse">
            ⚠ VOTING CLOSED — EPOCH EXECUTED
          </span>
          <p className="mt-1 text-sm text-sheetWhite bg-gray-900 border border-amber-900 inline-block p-2">
            {tally?.winner?.title || "A plan"} won with{" "}
            <span className="text-hypeNeon font-bold">
              {tally?.winner
                ? tally.proposals.find((p) => p.id === tally.winner!.id)
                    ?.vote_count || 0
                : 0}
            </span>{" "}
            votes.
          </p>
        </div>
      )}
    </>
  );
}
