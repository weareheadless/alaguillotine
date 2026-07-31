"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchWarRoomPosts,
  createWarRoomPost,
  castWarRoomVote,
  fetchMyWarRoomVotes,
} from "../app/actions/governance";
import type { WarRoomPost, WarRoomVoteStatus } from "../lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function fmtWallet(w: string): string {
  return `${w.slice(0, 4)}...${w.slice(-4)}`;
}

// ─── Reddit-style Post Card ────────────────────────────────────────────────────

function PostCard({
  post,
  voteStatus,
  onVote,
}: {
  post: WarRoomPost;
  voteStatus: 1 | -1 | 0;
  onVote: (type: "post" | "comment", id: string, v: 1 | -1) => void;
}) {
  const router = useRouter();
  const score = post.upvote_count - post.downvote_count;

  // Truncate body for preview
  const previewBody = post.body.length > 300
    ? post.body.slice(0, 300).replace(/\n$/, "") + "..."
    : post.body;

  return (
    <div
      className={`flex gap-0 transition-colors cursor-pointer ${
        post.is_sticky
          ? "border-l-[3px] border-l-amber-400 bg-amber-400/5"
          : "border-l-[3px] border-l-transparent hover:border-l-gray-600"
      }`}
    >
      {/* Vote column (Reddit-style left rail) */}
      <div className="flex flex-col items-center gap-0.5 px-2 py-2 min-w-[3rem] shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onVote("post", post.id, 1); }}
          className={`text-sm leading-none transition-colors ${
            voteStatus === 1
              ? "text-hypeNeon drop-shadow-[0_0_4px_rgba(57,255,20,0.8)]"
              : "text-chop-muted hover:text-hypeNeon"
          }`}
          title="Upvote"
        >
          ▲
        </button>
        <span
          className={`text-xs font-bold tabular-nums leading-none py-0.5 ${
            score > 0 ? "text-hypeNeon" : score < 0 ? "text-spiteCrimson" : "text-chop-muted"
          }`}
        >
          {score}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onVote("post", post.id, -1); }}
          className={`text-sm leading-none transition-colors ${
            voteStatus === -1
              ? "text-spiteCrimson drop-shadow-[0_0_4px_rgba(220,38,38,0.8)]"
              : "text-chop-muted hover:text-spiteCrimson"
          }`}
          title="Downvote"
        >
          ▼
        </button>
      </div>

      {/* Content column — click navigates to post page */}
      <div
        className="flex-1 min-w-0 py-2 pr-3"
        onClick={() => router.push(`/governance/war/${post.id}`)}
      >
        {/* Meta line */}
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          {post.is_sticky ? (
            <span className="text-[8px] font-black uppercase text-amber-400 tracking-wider">
              📌 PINNED
            </span>
          ) : null}
          {post.proposal_id ? (
            <span className="text-[8px] font-black uppercase text-blue-400 tracking-wider">
              📜 PROPOSAL
            </span>
          ) : null}
          <span className="text-[9px] font-bold text-chop-muted">
            posted by <span className="text-sheetWhite">{post.author_name}</span>
          </span>
          <span className="text-[9px] text-chop-muted">•</span>
          <span className="text-[9px] text-chop-muted">{timeAgo(post.created_at)}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-sheetWhite leading-snug hover:text-hypeNeon">
          {post.title}
        </h3>

        {/* Body preview */}
        <p className="mt-1 text-[11px] text-sheetWhite/80 leading-relaxed line-clamp-4 whitespace-pre-wrap break-words">
          {previewBody}
        </p>

        {/* Footer bar */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[9px] font-bold text-chop-muted hover:text-hypeNeon transition-colors">
            💬 {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}
          </span>
          <span className="text-[9px] text-chop-muted ml-auto group-hover:opacity-100 transition-opacity">
            click to open →
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main WarRoom Component ─────────────────────────────────────────────────────

interface WarRoomProps {
  isWalletConnected: boolean;
}

export function WarRoom({ isWalletConnected: _isWalletConnected }: WarRoomProps) {
  const [posts, setPosts] = useState<WarRoomPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [myVotes, setMyVotes] = useState<WarRoomVoteStatus>({ post_votes: {}, comment_votes: {} });

  // New post form
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const PAGE_SIZE = 20;

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const loadPosts = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchWarRoomPosts(page, PAGE_SIZE);
      setPosts(result.posts);
      setTotal(result.total);
    } catch (e) {
      console.error("[WarRoom] Load error:", e);
      setError("Failed to load posts.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadMyVotes = useCallback(async () => {
    try {
      const vs = await fetchMyWarRoomVotes();
      setMyVotes(vs);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadPosts();
    loadMyVotes();
    intervalRef.current = setInterval(() => {
      loadPosts();
      loadMyVotes();
    }, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadPosts, loadMyVotes]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleVote = async (type: "post" | "comment", id: string, v: 1 | -1) => {
    if (type === "post") {
      const current = myVotes.post_votes[id] ?? 0;
      const next = current === v ? 0 : v;
      setMyVotes((prev) => ({
        ...prev,
        post_votes: { ...prev.post_votes, [id]: next as 1 | -1 | 0 },
      }));
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          let up = p.upvote_count;
          let down = p.downvote_count;
          if (current === 1) up--;
          if (current === -1) down--;
          if (next === 1) up++;
          if (next === -1) down++;
          return { ...p, upvote_count: up, downvote_count: down };
        })
      );
    } else {
      const current = myVotes.comment_votes[id] ?? 0;
      const next = current === v ? 0 : v;
      setMyVotes((prev) => ({
        ...prev,
        comment_votes: { ...prev.comment_votes, [id]: next as 1 | -1 | 0 },
      }));
    }

    try {
      await castWarRoomVote(type, id, v);
    } catch (e: any) {
      console.error("[WarRoom] Vote error:", e);
      loadPosts();
      loadMyVotes();
    }
  };

  const handleCreatePost = async () => {
    const t = newTitle.trim();
    const b = newBody.trim();
    if (!t || !b) return;

    setSubmittingPost(true);
    setPostError(null);
    try {
      const result = await createWarRoomPost(t, b);
      if (result.success) {
        setNewTitle("");
        setNewBody("");
        setShowNewPost(false);
        await loadPosts();
      } else {
        setPostError(result.error || "Failed to create post.");
      }
    } catch (e: any) {
      setPostError(e?.message || "Network error.");
    } finally {
      setSubmittingPost(false);
    }
  };


  const totalPages = Math.ceil(total / PAGE_SIZE);
  const [sort, setSort] = useState<"new" | "top">("new");

  const sortedPosts = sort === "top"
    ? [...posts].sort((a, b) => (b.upvote_count - b.downvote_count) - (a.upvote_count - a.downvote_count))
    : posts;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="font-mono">
      {/* Top bar: sort + new post */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-0 border border-gray-800">
          <button
            onClick={() => setSort("new")}
            className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
              sort === "new"
                ? "bg-sheetWhite text-black"
                : "text-chop-muted hover:text-sheetWhite"
            }`}
          >
            🔥 NEW
          </button>
          <button
            onClick={() => setSort("top")}
            className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors border-l border-gray-800 ${
              sort === "top"
                ? "bg-sheetWhite text-black"
                : "text-chop-muted hover:text-sheetWhite"
            }`}
          >
            🏆 TOP
          </button>
        </div>

        <div className="flex items-center gap-2">
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-[10px] text-chop-muted">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="hover:text-sheetWhite disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ««
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="hover:text-sheetWhite disabled:opacity-30 disabled:cursor-not-allowed"
              >
                «
              </button>
              <span className="font-bold text-sheetWhite">{page}/{totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="hover:text-sheetWhite disabled:opacity-30 disabled:cursor-not-allowed"
              >
                »
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="hover:text-sheetWhite disabled:opacity-30 disabled:cursor-not-allowed"
              >
                »»
              </button>
            </div>
          )}
          <button
            onClick={() => setShowNewPost(!showNewPost)}
            className="border border-hypeNeon px-3 py-1 text-[10px] font-black uppercase text-hypeNeon hover:bg-hypeNeon hover:text-black transition-colors"
          >
            {showNewPost ? "✕ CANCEL" : "+ NEW POST"}
          </button>
        </div>
      </div>

      {/* New post form */}
      {showNewPost ? (
        <div className="mb-3 border border-hypeNeon bg-black p-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Post title..."
            className="w-full border border-gray-800 bg-canvasBlack px-3 py-2 text-xs text-sheetWhite font-mono placeholder:text-chop-muted focus:border-hypeNeon outline-none mb-2"
            maxLength={200}
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Draft your manifesto, propose a bounty, or yell into the void..."
            className="w-full border border-gray-800 bg-canvasBlack px-3 py-2 text-xs text-sheetWhite font-mono placeholder:text-chop-muted focus:border-hypeNeon outline-none resize-none h-20"
            maxLength={5000}
          />
          {postError ? (
            <p className="text-[10px] text-spiteCrimson font-bold mt-1">{postError}</p>
          ) : null}
          <button
            onClick={handleCreatePost}
            disabled={submittingPost || !newTitle.trim() || !newBody.trim()}
            className="mt-2 border border-hypeNeon bg-hypeNeon px-4 py-1.5 text-xs font-black uppercase text-black hover:bg-spiteCrimson hover:text-sheetWhite hover:border-spiteCrimson transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submittingPost ? "POSTING..." : "SUBMIT POST"}
          </button>
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <p className="text-[10px] text-spiteCrimson font-bold mb-2">{error}</p>
      ) : null}

      {/* Post list */}
      <div className="divide-y divide-gray-800/50 border-t border-b border-gray-800" id="war-room">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin border-2 border-hypeNeon border-t-transparent" />
            <span className="ml-2 text-[10px] font-black uppercase text-chop-muted animate-pulse">
              LOADING...
            </span>
          </div>
        ) : sortedPosts.length === 0 ? (
          <div className="py-10 text-center">
            <span className="text-2xl">🏴</span>
            <p className="mt-2 text-xs font-bold uppercase text-chop-muted">
              The Council chamber is silent. Be the first voice of the resistance.
            </p>
            <p className="mt-1 text-[10px] text-chop-muted">
              Proposals, manifestos, bounty claims — all debated and decided here.
            </p>
          </div>
        ) : (
          sortedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              voteStatus={myVotes.post_votes[post.id] ?? 0}
              onVote={handleVote}
            />
          ))
        )}
      </div>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-chop-muted">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="hover:text-sheetWhite disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ««
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="hover:text-sheetWhite disabled:opacity-30 disabled:cursor-not-allowed"
          >
            « PREV
          </button>
          <span className="font-bold text-sheetWhite">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="hover:text-sheetWhite disabled:opacity-30 disabled:cursor-not-allowed"
          >
            NEXT »
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="hover:text-sheetWhite disabled:opacity-30 disabled:cursor-not-allowed"
          >
            »»
          </button>
        </div>
      )}
    </div>
  );
}
