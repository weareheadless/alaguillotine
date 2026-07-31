"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { NavBar } from "../../../../components/NavBar";
import {
  fetchWarRoomPost,
  postWarRoomComment,
  castWarRoomVote,
  fetchMyWarRoomVotes,
} from "../../../../app/actions/governance";
import type { WarRoomPost, WarRoomComment, WarRoomVoteStatus } from "../../../../lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function fmtWallet(w: string): string {
  return `${w.slice(0, 4)}...${w.slice(-4)}`;
}

// ─── Vote Buttons ───────────────────────────────────────────────────────────────

function VoteButtons({
  targetType,
  targetId,
  upvotes,
  downvotes,
  voteStatus,
  onVote,
  small,
}: {
  targetType: "post" | "comment";
  targetId: string;
  upvotes: number;
  downvotes: number;
  voteStatus: 1 | -1 | 0;
  onVote: (type: "post" | "comment", id: string, v: 1 | -1) => void;
  small?: boolean;
}) {
  return (
    <div className={`flex items-center ${small ? "gap-1" : "gap-2"}`}>
      <button
        onClick={() => onVote(targetType, targetId, 1)}
        className={`transition-colors ${
          voteStatus === 1
            ? "text-hypeNeon drop-shadow-[0_0_6px_rgba(57,255,20,0.8)]"
            : "text-chop-muted hover:text-hypeNeon"
        }`}
        title="Upvote"
      >
        ▲
      </button>
      <span
        className={`font-bold tabular-nums ${
          small ? "text-xs min-w-[1.5rem] text-center" : "text-sm min-w-[2rem] text-center"
        } ${
          upvotes - downvotes > 0
            ? "text-hypeNeon"
            : upvotes - downvotes < 0
              ? "text-spiteCrimson"
              : "text-chop-muted"
        }`}
      >
        {upvotes - downvotes}
      </span>
      <button
        onClick={() => onVote(targetType, targetId, -1)}
        className={`transition-colors ${
          voteStatus === -1
            ? "text-spiteCrimson drop-shadow-[0_0_6px_rgba(220,38,38,0.8)]"
            : "text-chop-muted hover:text-spiteCrimson"
        }`}
        title="Downvote"
      >
        ▼
      </button>
    </div>
  );
}

function CommentList({
  comments,
  parentId,
  voteStatus,
  onVote,
  replyingTo,
  onSetReplyingTo,
  onSubmitReply,
  depth,
}: {
  comments: WarRoomComment[];
  parentId: string | null;
  voteStatus: Record<string, 1 | -1 | 0>;
  onVote: (type: "post" | "comment", id: string, v: 1 | -1) => void;
  replyingTo: string | null;
  onSetReplyingTo: (id: string | null) => void;
  onSubmitReply: (text: string, parentId: string) => void;
  depth: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const threadComments = comments.filter((c) => c.parent_id === parentId);
  if (threadComments.length === 0) return null;

  return (
    <div className={depth > 0 ? "ml-4 border-l-2 border-gray-800 pl-3" : ""}>
      {threadComments.map((c) => (
        <div key={c.id} className="mb-2">
          <div className="flex items-start gap-2">
            <VoteButtons
              targetType="comment"
              targetId={c.id}
              upvotes={c.upvote_count}
              downvotes={c.downvote_count}
              voteStatus={voteStatus[c.id] ?? 0}
              onVote={onVote}
              small
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-sheetWhite">{c.author_name}</span>
                {c.author_wallet && (
                  <span className="text-[9px] text-chop-muted font-mono">
                    {fmtWallet(c.author_wallet)}
                  </span>
                )}
                <span className="text-[9px] text-chop-muted ml-auto">
                  {timeAgo(c.created_at)}
                </span>
              </div>
              <p className="text-xs text-sheetWhite leading-relaxed mt-0.5 break-words">
                {c.body}
              </p>
              <button
                onClick={() => onSetReplyingTo(replyingTo === c.id ? null : c.id)}
                className="text-[9px] text-chop-muted hover:text-hypeNeon font-bold uppercase mt-0.5"
              >
                ⚡ counter
              </button>

              {/* Inline reply form for this comment */}
              {replyingTo === c.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const val = inputRef.current?.value.trim();
                    if (val) onSubmitReply(val, c.id);
                  }}
                  className="mt-2 mb-2 flex gap-2"
                >
                  <input
                    ref={inputRef}
                    id={`reply-input-${c.id}`}
                    type="text"
                    placeholder="Write a reply..."
                    className="flex-1 border border-gray-800 bg-black px-2 py-1 text-[11px] text-sheetWhite font-mono placeholder:text-chop-muted focus:border-hypeNeon outline-none"
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    className="border border-hypeNeon bg-hypeNeon px-2 py-1 text-[10px] font-black uppercase text-black hover:bg-spiteCrimson hover:text-sheetWhite transition-colors"
                  >
                    POST
                  </button>
                </form>
              )}
            </div>
          </div>
          <CommentList
            comments={comments}
            parentId={c.id}
            voteStatus={voteStatus}
            onVote={onVote}
            replyingTo={replyingTo}
            onSetReplyingTo={onSetReplyingTo}
            onSubmitReply={onSubmitReply}
            depth={depth + 1}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function WarRoomPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<WarRoomPost | null>(null);
  const [comments, setComments] = useState<WarRoomComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [myVotes, setMyVotes] = useState<WarRoomVoteStatus>({ post_votes: {}, comment_votes: {} });
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const replyInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchWarRoomPost(postId);
      if (!data.post) {
        setNotFound(true);
      } else {
        setPost(data.post);
        setComments(data.comments);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const loadMyVotes = useCallback(async () => {
    try {
      const vs = await fetchMyWarRoomVotes();
      setMyVotes(vs);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    load();
    loadMyVotes();
    const iv = setInterval(() => {
      load();
      loadMyVotes();
    }, 10_000);
    return () => clearInterval(iv);
  }, [load, loadMyVotes]);

  const handleVote = async (type: "post" | "comment", id: string, v: 1 | -1) => {
    if (type === "post") {
      const current = myVotes.post_votes[id] ?? 0;
      const next = current === v ? 0 : v;
      setMyVotes((prev) => ({
        ...prev,
        post_votes: { ...prev.post_votes, [id]: next as 1 | -1 | 0 },
      }));
      if (post) {
        let up = post.upvote_count;
        let down = post.downvote_count;
        if (current === 1) up--;
        if (current === -1) down--;
        if (next === 1) up++;
        if (next === -1) down++;
        setPost({ ...post, upvote_count: up, downvote_count: down });
      }
    } else {
      const current = myVotes.comment_votes[id] ?? 0;
      const next = current === v ? 0 : v;
      setMyVotes((prev) => ({
        ...prev,
        comment_votes: { ...prev.comment_votes, [id]: next as 1 | -1 | 0 },
      }));
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          let up = c.upvote_count;
          let down = c.downvote_count;
          if (current === 1) up--;
          if (current === -1) down--;
          if (next === 1) up++;
          if (next === -1) down++;
          return { ...c, upvote_count: up, downvote_count: down };
        })
      );
    }

    try {
      await castWarRoomVote(type, id, v);
    } catch {
      load();
      loadMyVotes();
    }
  };

  const handleSubmitComment = async (e: React.FormEvent, parentId: string | null) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text) return;

    setSubmittingComment(true);
    try {
      const result = await postWarRoomComment(postId, text, parentId);
      if (result.success) {
        setReplyText("");
        setReplyingTo(null);
        await load();
      }
    } catch {
      // silent
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleInlineReply = async (text: string, parentId: string) => {
    setSubmittingComment(true);
    try {
      const result = await postWarRoomComment(postId, text, parentId);
      if (result.success) {
        setReplyingTo(null);
        await load();
      }
    } catch {
      // silent
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSetReplyingTo = (id: string | null) => {
    setReplyingTo(id);
    setReplyText("");
    if (id) {
      setTimeout(() => {
        const el = document.getElementById(`reply-input-${id}`);
        if (el) el.focus();
      }, 50);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-canvasBlack">
        <NavBar />
        <div className="flex items-center justify-center py-40">
          <div className="h-8 w-8 animate-spin rounded-sm border-2 border-spiteCrimson border-t-transparent" />
        </div>
      </div>
    );
  }

  // ─── Not Found ────────────────────────────────────────────────────────
  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-canvasBlack">
        <NavBar />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <div className="border-4 border-spiteCrimson bg-black p-8 shadow-[8px_8px_0px_0px_rgba(220,38,38,1)]">
            <p className="font-mono text-2xl font-black uppercase text-spiteCrimson">
              POST NOT FOUND
            </p>
            <p className="mt-2 font-mono text-sm text-chop-muted">
              This debate has been deleted or never existed.
            </p>
            <button
              onClick={() => router.push("/governance")}
              className="mt-6 border-2 border-sheetWhite px-6 py-2 font-mono text-xs font-bold uppercase text-sheetWhite transition-colors hover:bg-sheetWhite hover:text-canvasBlack"
            >
              ← Back to War Council
            </button>
          </div>
        </main>
      </div>
    );
  }

  const score = post.upvote_count - post.downvote_count;

  return (
    <div className="min-h-screen bg-canvasBlack font-mono">
      <NavBar />

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Back link */}
        <button
          onClick={() => router.push("/governance")}
          className="mb-4 text-xs font-bold uppercase tracking-wider text-chop-muted transition-colors hover:text-hypeNeon"
        >
          ← Back to War Council
        </button>

        {/* ─── Post ──────────────────────────────────────────────────── */}
        <div className="border-4 border-gray-800 bg-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-6">
          {/* Post header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b-2 border-gray-800">
            <VoteButtons
              targetType="post"
              targetId={post.id}
              upvotes={post.upvote_count}
              downvotes={post.downvote_count}
              voteStatus={myVotes.post_votes[post.id] ?? 0}
              onVote={handleVote}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {post.is_sticky ? (
                  <span className="text-[8px] font-black uppercase text-amber-400 tracking-wider">
                    📌 PINNED
                  </span>
                ) : null}
                <span className="text-[9px] text-chop-muted">
                  posted by <span className="font-bold text-sheetWhite">{post.author_name}</span>
                </span>
                <span className="text-[9px] text-chop-muted">{timeAgo(post.created_at)}</span>
              </div>
            </div>
            {post.is_locked ? (
              <span className="text-[9px] font-black uppercase text-spiteCrimson">🔒 LOCKED</span>
            ) : null}
          </div>

          {/* Post body */}
          <div className="px-5 py-5">
            <h1 className="text-lg font-bold text-sheetWhite leading-snug mb-3">
              {post.title}
            </h1>
            <p className="text-sm text-sheetWhite leading-relaxed whitespace-pre-wrap break-words">
              {post.body}
            </p>
          </div>

          {/* Post footer */}
          <div className="flex items-center gap-4 px-5 py-2.5 border-t-2 border-gray-800 text-[10px] text-chop-muted uppercase tracking-wider">
            <span>💬 {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}</span>
          </div>
        </div>

        {/* ─── Reply Form (top-level) ────────────────────────────────── */}
        {!post.is_locked && (
          <form
            onSubmit={(e) => handleSubmitComment(e, null)}
            className="mb-6 flex gap-2"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Weigh in on the debate..."
              className="flex-1 border-2 border-gray-800 bg-black px-3 py-2 text-sm text-sheetWhite font-mono placeholder:text-chop-muted focus:border-hypeNeon outline-none"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={submittingComment || !replyText.trim()}
              className="border-2 border-hypeNeon bg-hypeNeon px-4 py-2 text-xs font-black uppercase text-black hover:bg-spiteCrimson hover:text-sheetWhite hover:border-spiteCrimson transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submittingComment ? "..." : "POST"}
            </button>
          </form>
        )}

        {/* ─── Comments ──────────────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center gap-2 border-b-2 border-gray-800 pb-2">
            <span className="text-sm font-black uppercase tracking-wider text-sheetWhite">
              💬 Comments
            </span>
            <span className="border border-gray-700 px-2 py-0.5 text-[10px] font-bold text-hypeNeon">
              {comments.length}
            </span>
          </div>

          {comments.length === 0 ? (
            <div className="border-2 border-dashed border-gray-800 px-5 py-10 text-center">
              <p className="text-sm uppercase tracking-wider text-chop-muted">
                No comments yet. The floor is yours.
              </p>
            </div>
          ) : (
            <CommentList
              comments={comments}
              parentId={null}
              voteStatus={myVotes.comment_votes}
              onVote={handleVote}
              replyingTo={replyingTo}
              onSetReplyingTo={handleSetReplyingTo}
              onSubmitReply={handleInlineReply}
              depth={0}
            />
          )}
        </div>
      </main>
    </div>
  );
}
