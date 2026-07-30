"use client";

import type { ProposalWithTally } from "../lib/types";
import { ProposalComments } from "./ProposalComments";

interface ProposalCardProps {
  proposal: ProposalWithTally;
  isWinner: boolean;
  isNone: boolean;
  hasVoted: boolean;
  isMyVote: boolean;
  onVote: (proposalId: string) => void;
  isWalletConnected: boolean;
  hasEnoughChop: boolean;
}

export function ProposalCard({
  proposal,
  isWinner,
  isNone,
  hasVoted,
  isMyVote,
  onVote,
  isWalletConnected,
  hasEnoughChop,
}: ProposalCardProps) {
  const borderColor = isWinner
    ? "border-amber-400 shadow-[8px_8px_0px_0px_rgba(251,191,36,1)]"
    : isNone
      ? "border-red-600 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(220,38,38,0.1)_10px,rgba(220,38,38,0.1)_20px)]"
      : "border-gray-300 shadow-[8px_8px_0px_0px_rgba(156,163,175,1)] hover:border-hypeNeon hover:shadow-[8px_8px_0px_0px_rgba(57,255,20,1)]";

  const pcts = [
    { label: "BURN", value: proposal.burn_pct, color: "bg-spiteCrimson" },
    { label: "BOUNTY", value: proposal.bounty_pct, color: "bg-hypeNeon" },
    { label: "INFRA", value: proposal.infra_pct, color: "bg-blue-500" },
    { label: "MKTG", value: proposal.marketing_pct, color: "bg-purple-500" },
  ];

  const canVote = isWalletConnected && hasEnoughChop && !hasVoted && !isNone;

  return (
    <div
      className={`relative border-4 bg-canvasBlack p-5 font-mono transition-all duration-75 ${borderColor}`}
    >
      {/* Winner badge */}
      {isWinner && (
        <div className="absolute -top-4 -right-4 border-4 border-black bg-amber-400 px-4 py-1 text-sm font-black uppercase text-black rotate-[5deg] shadow-[4px_4px_0_0_#000] animate-pulse">
          🏆 WINNER
        </div>
      )}

      {/* My vote indicator */}
      {isMyVote && (
        <div className="absolute -top-4 -left-4 border-4 border-black bg-spiteCrimson px-4 py-1 text-sm font-black uppercase text-sheetWhite -rotate-[5deg] shadow-[4px_4px_0_0_#000]">
          YOUR VOTE
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <span className="text-4xl drop-shadow-[2px_2px_0_rgba(255,255,255,0.8)]">{proposal.emoji}</span>
        <div className="flex-1">
          <h3 className="text-xl font-black uppercase leading-tight text-sheetWhite break-words">
            {proposal.title}
          </h3>
          {isNone && (
            <span className="text-xs font-bold uppercase text-red-500 bg-black px-1 mt-1 inline-block">
              ESCAPE HATCH — {3 - (proposal.attempt_number || 0)} ATTEMPTS REMAIN
            </span>
          )}
        </div>
      </div>

      {/* Manifesto */}
      <div className="mb-5 border-l-4 border-hypeNeon pl-3">
        <p className="text-sm leading-relaxed text-sheetWhite">
          {proposal.manifesto}
        </p>
      </div>

      {/* Allocation bars */}
      <div className="mb-4 space-y-2 bg-black p-3 border-2 border-gray-800">
        <div className="text-[10px] text-chop-muted uppercase mb-1">TREASURY ALLOCATIONS:</div>
        {pcts.map((p) => (
          <div key={p.label} className="flex items-center gap-3">
            <span className="w-14 text-xs font-black uppercase text-sheetWhite tracking-widest">
              {p.label}
            </span>
            <div className="h-4 flex-1 border-2 border-gray-800 bg-canvasBlack relative overflow-hidden">
              <div
                className={`h-full ${p.color} transition-all duration-500 ease-out`}
                style={{ width: `${p.value}%` }}
              >
                {/* Stripe effect inside bars */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #000 4px, #000 8px)' }}></div>
              </div>
            </div>
            <span className="w-10 text-right text-xs font-black text-sheetWhite">
              {p.value}%
            </span>
          </div>
        ))}
      </div>

      {/* Vote count + button */}
      <div className="flex items-center justify-between border-t-4 border-dashed border-gray-800 pt-4">
        <div className="text-sm text-chop-muted flex flex-col">
          <span className="font-black text-sheetWhite text-lg">{proposal.vote_count} <span className="text-xs text-chop-muted uppercase">votes</span></span>
          {proposal.percentage > 0 && (
            <span className="text-xs text-hypeNeon">{proposal.percentage}% SHARE</span>
          )}
        </div>

        {canVote && (
          <button
            onClick={() => onVote(proposal.id)}
            className="border-4 border-black bg-hypeNeon px-6 py-2 text-sm font-black uppercase tracking-widest text-black shadow-[4px_4px_0_0_#000] transition-transform hover:-translate-y-1 hover:bg-spiteCrimson hover:text-sheetWhite active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            VOTE
          </button>
        )}

        {isMyVote && !isWinner && (
          <span className="border-2 border-spiteCrimson px-3 py-1 text-xs font-black uppercase text-spiteCrimson">
            VOTED ✓
          </span>
        )}

        {!isWalletConnected && (
          <span className="bg-red-900/40 text-red-500 px-2 py-1 text-xs font-bold uppercase border border-red-900">
            WALLET DISCONNECTED
          </span>
        )}

        {isWalletConnected && !hasEnoughChop && (
          <span className="bg-amber-900/40 text-amber-500 px-2 py-1 text-xs font-bold uppercase border border-amber-900">
            NEED ≥1 $CHOP
          </span>
        )}

        {hasVoted && !isMyVote && (
          <span className="text-xs font-bold text-chop-muted uppercase line-through">
            ALREADY VOTED
          </span>
        )}
      </div>

      {/* Discussion thread */}
      <div className="mt-4 pt-4 border-t-4 border-black">
        <ProposalComments
          proposalId={proposal.id}
          isWalletConnected={isWalletConnected}
        />
      </div>
    </div>
  );
}
