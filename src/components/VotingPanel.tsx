"use client";

import { useState } from "react";
import { ProposalCard } from "./ProposalCard";
import type { ProposalWithTally, EpochTally } from "../lib/types";

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

  const isVotingClosed = tally?.winner != null;

  const handleVote = async (proposalId: string) => {
    setVoteError(null);

    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) return;

    const message = `I vote for: ${proposal.title} (proposal ${proposalId})`;

    // Request signature from wallet
    try {
      const { solana } = window as any;
      if (!solana?.isPhantom) {
        setVoteError("Phantom wallet required for voting.");
        return;
      }

      setVotingId(proposalId);

      const encodedMessage = new TextEncoder().encode(message);
      const result = await solana.signMessage(encodedMessage, "utf8");
      // result.signature is a Uint8Array
      const sigBytes = new Uint8Array(result.signature);

      // Convert to base58 for our verification
      const bs58 = (await import("bs58")).default;
      const sigB58 = bs58.encode(sigBytes);

      await onVote(proposalId, sigB58, message);
    } catch (err: any) {
      if (err?.message !== "User rejected the request.") {
        setVoteError(err?.message || "Signature failed.");
      }
    } finally {
      setVotingId(null);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 font-mono bg-canvasBlack border-4 border-gray-800 shadow-[8px_8px_0_0_#000]">
        <div className="h-10 w-10 animate-spin border-4 border-hypeNeon border-t-transparent" />
        <span className="ml-4 font-black uppercase text-xl text-sheetWhite animate-pulse tracking-widest">
          THE ORACLE IS YELLING...
        </span>
      </div>
    );
  }

  // ─── Oracle Fired ───────────────────────────────────────────────────────────

  if (oracleFired) {
    return (
      <div className="border-4 border-red-600 bg-canvasBlack p-8 text-center font-mono shadow-[12px_12px_0_0_rgba(220,38,38,1)] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(220,38,38,0.1)_10px,rgba(220,38,38,0.1)_20px)]">
        <span className="text-8xl drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">💀</span>
        <h2 className="mt-6 text-4xl font-black uppercase text-red-500 drop-shadow-[2px_2px_0_#000]">
          SYSTEM FATAL: ORACLE EXECUTED
        </h2>
        <p className="mt-4 text-base text-sheetWhite bg-black p-4 border border-red-900 inline-block">
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
      <div className="flex flex-col items-center py-20 font-mono border-4 border-gray-800 bg-black shadow-[8px_8px_0_0_#333]">
        <span className="text-7xl animate-bounce drop-shadow-[0_0_15px_rgba(57,255,20,0.5)]">🔮</span>
        <p className="mt-6 text-xl font-black uppercase text-hypeNeon animate-pulse">
          THE ORACLE IS PREPARING THE MANIFESTOS...
        </p>
        <p className="mt-2 text-sm text-chop-muted uppercase tracking-widest">
          Standby for the drop.
        </p>
      </div>
    );
  }

  // ─── Proposals ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Vote error */}
      {voteError && (
        <div className="border-4 border-red-600 bg-black p-4 font-mono text-sm font-bold text-red-500 shadow-[4px_4px_0_0_rgba(220,38,38,1)] uppercase">
          <span className="mr-2 animate-ping">⚠</span> {voteError}
        </div>
      )}

      {/* Tally bar */}
      {proposals.length > 0 && (
        <div className="h-12 flex overflow-hidden border-4 border-gray-800 shadow-[6px_6px_0_0_#000]">
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
      <div className="text-center font-mono text-xs text-chop-muted">
        {tally?.total_votes || proposals.reduce((s, p) => s + p.vote_count, 0)}{" "}
        votes cast • Epoch {epochNumber}
        {attemptNumber > 1 && ` • Attempt ${attemptNumber}`}
      </div>

      {/* Proposal cards */}
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          isWinner={proposal.status === "won"}
          isNone={proposal.is_none_option === 1}
          hasVoted={myVote !== null}
          isMyVote={myVote === proposal.id}
          onVote={handleVote}
          isWalletConnected={isWalletConnected}
          hasEnoughChop={hasEnoughChop}
        />
      ))}

      {/* Voting closed message */}
      {isVotingClosed && (
        <div className="border-4 border-amber-400 bg-black p-6 text-center font-mono shadow-[8px_8px_0_0_rgba(251,191,36,1)]">
          <span className="text-lg font-black uppercase text-amber-400 animate-pulse">
            ⚠ VOTING CLOSED — EPOCH EXECUTED
          </span>
          <p className="mt-2 text-sm text-sheetWhite bg-gray-900 border border-amber-900 inline-block p-2">
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
    </div>
  );
}
