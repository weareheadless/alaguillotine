"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchProposalComments, postComment } from "../app/actions/governance";
import type { ProposalComment } from "../lib/types";

interface ProposalCommentsProps {
  proposalId: string;
  isWalletConnected: boolean;
}

export function ProposalComments({ proposalId, isWalletConnected }: ProposalCommentsProps) {
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const data = await fetchProposalComments(proposalId);
      setComments(data);
    } catch {
      // silent
    }
  }, [proposalId]);

  useEffect(() => {
    if (open) {
      loadComments();
      const iv = setInterval(loadComments, 15_000);
      return () => clearInterval(iv);
    }
  }, [open, loadComments]);

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      const result = await postComment(proposalId, trimmed);
      if (result.success) {
        setText("");
        await loadComments();
      } else {
        setError(result.error || "Failed to post.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setPosting(false);
    }
  };

  const formatWallet = (w: string) => `${w.slice(0, 4)}...${w.slice(-4)}`;

  return (
    <div className="border-t-2 border-black pt-3">
      {/* Toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-chop-muted hover:text-canvasBlack transition-colors"
      >
        <span>{open ? "▾" : "▸"}</span>
        💬 Discussion ({comments.length})
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Comment list */}
          {comments.length === 0 ? (
            <p className="text-[10px] italic text-chop-muted py-2">
              No hot takes yet. Break the silence.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="border-2 border-black bg-gray-50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-canvasBlack">
                      {c.author_name}
                    </span>
                    <span className="text-[9px] text-chop-muted font-mono">
                      {formatWallet(c.author_wallet)}
                    </span>
                    <span className="text-[9px] text-chop-muted ml-auto">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-canvasBlack leading-relaxed break-words">
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Post form */}
          {isWalletConnected ? (
            <div className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Weigh in... (max 500 chars)"
                maxLength={500}
                rows={2}
                className="w-full border-2 border-black px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-hypeNeon"
              />
              {error && (
                <p className="text-[10px] text-red-600 font-bold">{error}</p>
              )}
              <button
                onClick={handlePost}
                disabled={posting || !text.trim()}
                className="rounded-sm border-2 border-black bg-canvasBlack px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-sheetWhite transition-all hover:bg-spiteCrimson disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {posting ? "POSTING..." : "POST"}
              </button>
            </div>
          ) : (
            <p className="text-[9px] text-chop-muted italic">
              Connect wallet to join the discussion.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
