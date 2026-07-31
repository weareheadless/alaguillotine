"use client";

import type { ProposalWithTally } from "../lib/types";

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
      className={`relative border-4 bg-canvasBlack p-4 font-mono transition-all duration-75 flex flex-col ${borderColor}`}
    >
      {/* Winner / My Vote badges */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-3xl">{proposal.emoji}</span>
        <h3 className="text-sm font-black uppercase leading-tight text-sheetWhite line-clamp-2 flex-1">
          {proposal.title}
        </h3>
        {isWinner && (
          <span className="border-2 border-amber-400 bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase text-black animate-pulse shrink-0">
            🏆 WIN
          </span>
        )}
        {isMyVote && !isWinner && (
          <span className="border-2 border-spiteCrimson px-2 py-0.5 text-[9px] font-black uppercase text-spiteCrimson shrink-0">
            ✓ MY VOTE
          </span>
        )}
        {isNone && (
          <span className="border-2 border-red-600 bg-red-600/20 px-2 py-0.5 text-[9px] font-black uppercase text-red-500 shrink-0">
            ⚠ NONE ({3 - (proposal.attempt_number || 0)} LEFT)
          </span>
        )}
      </div>

      {/* Manifesto — compact */}
      <p className="text-[10px] leading-relaxed text-chop-muted mb-3 line-clamp-3 flex-1">
        {proposal.manifesto}
      </p>

      {/* Allocation bars — compact */}
      <div className="mb-3 space-y-1 bg-black p-2 border border-gray-800">
        {pcts.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5">
            <span className="w-10 text-[8px] font-black uppercase text-chop-muted tracking-wider shrink-0">
              {p.label}
            </span>
            <div className="h-3 flex-1 border border-gray-800 bg-canvasBlack relative overflow-hidden">
              <div
                className={`h-full ${p.color} transition-all duration-500 ease-out`}
                style={{ width: `${p.value}%` }}
              />
            </div>
            <span className="w-7 text-right text-[9px] font-black text-sheetWhite shrink-0">
              {p.value}%
            </span>
          </div>
        ))}
      </div>

      {/* Vote count + button */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black text-sheetWhite">{proposal.vote_count}</span>
          <span className="text-[9px] text-chop-muted uppercase">votes</span>
          {proposal.percentage > 0 && (
            <span className="text-[9px] text-hypeNeon font-bold">{proposal.percentage}%</span>
          )}
        </div>

        {canVote && (
          <button
            onClick={() => onVote(proposal.id)}
            className="border-2 border-black bg-hypeNeon px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-black shadow-[3px_3px_0_0_#000] hover:bg-spiteCrimson hover:text-sheetWhite active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            VOTE
          </button>
        )}

        {!isWalletConnected && (
          <span className="bg-red-900/40 text-red-500 px-2 py-0.5 text-[9px] font-bold uppercase border border-red-900">
            NO WALLET
          </span>
        )}

        {isWalletConnected && !hasEnoughChop && (
          <span className="bg-amber-900/40 text-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase border border-amber-900">
            NEED $CHOP
          </span>
        )}

        {hasVoted && !isMyVote && (
          <span className="text-[9px] font-bold text-chop-muted uppercase line-through">
            VOTED
          </span>
        )}
      </div>
    </div>
  );
}
