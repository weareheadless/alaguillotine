"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { FeedMessage } from "../lib/types";
import { useAuth } from "../lib/auth-context";
import { getDemoMessages } from "../lib/mock-data";
import { SubmitForm } from "./SubmitForm";
import { fetchVisibleMessages, fetchOwnMessages } from "../app/actions/feed";

function MessageCard({ message, isCurrentUser, onReply }: { message: FeedMessage; isCurrentUser: boolean; onReply: (id: string) => void }) {
  const isPaid = message.amount_paid > 0;
  const isOwn = isCurrentUser;
  const isComment = !!message.parent_id;
  const hasWallet = !!(message.author_id && message.author_id.length >= 32 && !message.author_id.includes(" "));
  const shortWallet = hasWallet ? `${message.author_id!.slice(0, 4)}...${message.author_id!.slice(-4)}` : null;

  return (
    <div
      className={`font-mono text-sm transition-all ${
        isPaid ? "border-l-[4px] border-l-hypeNeon" : ""
      } ${isOwn && message.is_shadowbanned ? "opacity-40" : ""} ${
        isComment ? "ml-8 border-l-[3px] border-l-spiteCrimson/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm leading-relaxed text-canvasBlack">
            {message.text}
          </p>
        </div>
        {isPaid && (
          <span className="flex-shrink-0 border-2 border-hypeNeon bg-hypeNeon/10 px-2 py-0.5 text-xs font-bold text-hypeNeon">
            ${message.amount_paid.toFixed(2)} CHOP
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-glitchGray/20 px-3 py-1.5 text-[10px] uppercase tracking-wider text-chop-muted">
        <span className="font-bold">{message.author_name}</span>
        {shortWallet && (
          <>
            <span className="font-normal text-[9px] text-chop-muted/60">{shortWallet}</span>
          </>
        )}
        <span>|</span>
        <span>
          {new Date(message.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })}
        </span>
        {isOwn && message.is_shadowbanned && (
          <>
            <span>|</span>
            <span className="text-spiteCrimson">[RESTRICTED]</span>
          </>
        )}
        {!isComment && (
          <>
            <span>|</span>
            <button
              onClick={() => onReply(message.$id)}
              className="cursor-pointer font-bold text-spiteCrimson transition-colors hover:text-black"
            >
              [ REPLY ]
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const MESSAGES_PER_PAGE = 25;

export function MessageFeed() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showRepliesFor, setShowRepliesFor] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const visibleDocs = await fetchVisibleMessages();
      let docs = visibleDocs;
      if (user) {
        const ownDocs = await fetchOwnMessages(user.id);
        docs = [...docs, ...ownDocs];
      }
      docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMessages(docs);
    } catch (e) {
      console.error("MessageFeed fetch error:", e);
      setMessages([]);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 8_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMessages]);

  const handleReply = (id: string) => {
    setReplyingTo(replyingTo === id ? null : id);
    if (showRepliesFor !== id) setShowRepliesFor(id);
  };
  const handleToggleReplies = (id: string) => setShowRepliesFor(showRepliesFor === id ? null : id);
  const handleReplySuccess = () => { setReplyingTo(null); fetchMessages(); };

  const topLevel = messages.filter((m) => !m.parent_id);
  const commentsByParent: Record<string, FeedMessage[]> = {};
  for (const msg of messages) {
    if (msg.parent_id) {
      if (!commentsByParent[msg.parent_id]) commentsByParent[msg.parent_id] = [];
      commentsByParent[msg.parent_id].push(msg);
    }
  }

  const totalPages = Math.max(1, Math.ceil(topLevel.length / MESSAGES_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageMessages = topLevel.slice(safePage * MESSAGES_PER_PAGE, (safePage + 1) * MESSAGES_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-sm border-2 border-spiteCrimson border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="w-full">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2 border-b-4 border-black pb-2">
        <span className="text-lg">💬</span>
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-sheetWhite">
          Place de la Révolution
        </h2>
        <span className="border-2 border-black bg-canvasBlack px-2 py-0.5 text-[10px] font-bold text-hypeNeon">
          {topLevel.length}
        </span>
      </div>

      {/* ─── Leaderboard Table ─────────────────────────────────────────── */}
      <div className="overflow-hidden border-4 border-canvasBlack shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {/* Table header */}
        <div className="flex border-b-4 border-canvasBlack bg-canvasBlack px-3 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-sheetWhite">
          <span className="w-10">#</span>
          <span className="flex-1">Manifesto</span>
          <span className="w-32 text-right hidden sm:block">Author</span>
          <span className="w-28 text-right">$CHOP</span>
        </div>

        {/* Table body with zebra stripes */}
        <div className="divide-y-2 divide-canvasBlack">
          {pageMessages.length === 0 ? (
            <div className="bg-sheetWhite px-3 py-12 text-center">
              <p className="text-sm uppercase tracking-wider text-chop-muted">
                // No executions yet. Be the first.
              </p>
            </div>
          ) : (
            pageMessages.map((msg, idx) => {
              const globalIdx = safePage * MESSAGES_PER_PAGE + idx + 1;
              const isDark = idx % 2 !== 0;
              let rowBg = isDark ? "bg-glitchGray text-sheetWhite" : "bg-sheetWhite text-canvasBlack";
              
              const isPaid = msg.amount_paid > 0;
              
              if (isPaid) {
                return (
                  <div key={msg.$id} className="w-full border-y-[3px] border-spiteCrimson bg-[#FDE047] px-3 py-2.5 relative overflow-hidden group">
                    <div className="absolute inset-0 grid-overlay opacity-10"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-2 md:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-bold leading-relaxed text-black">
                          {msg.text}
                        </p>
                      </div>
                      <span className="flex-shrink-0 border-2 border-black bg-spiteCrimson px-2 py-0.5 text-[10px] md:text-xs font-black text-sheetWhite drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] self-start">
                        ${msg.amount_paid.toFixed(2)} CHOP
                      </span>
                    </div>
                    <div className="relative z-10 flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[9px] md:text-[10px] uppercase tracking-wider text-black/70">
                      <span className="font-bold text-spiteCrimson drop-shadow-[1px_1px_0px_rgba(255,255,255,0.5)]">{msg.author_name}</span>
                      <span>|</span>
                      <span>
                        {new Date(msg.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {!msg.parent_id && (
                        <>
                          <span>|</span>
                          <button
                            onClick={() => handleReply(msg.$id)}
                            className="cursor-pointer font-bold text-black hover:text-spiteCrimson transition-colors drop-shadow-[1px_1px_0px_rgba(255,255,255,0.5)]"
                          >
                            [ REPLY ]
                          </button>
                        </>
                      )}
                      {(commentsByParent[msg.$id]?.length > 0 || showRepliesFor === msg.$id) && (
                        <>
                          <span>|</span>
                          <button
                            onClick={() => handleToggleReplies(msg.$id)}
                            className="cursor-pointer font-bold text-black hover:text-spiteCrimson drop-shadow-[1px_1px_0px_rgba(255,255,255,0.5)]"
                          >
                            {showRepliesFor === msg.$id
                              ? "[ HIDE REPLIES ]"
                              : `[ ${commentsByParent[msg.$id]?.length || 0} REPLIES ]`}
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Reply form for Paid Messages */}
                    {replyingTo === msg.$id && (
                      <div className="relative z-10 mt-3 ml-2 md:ml-4">
                        <SubmitForm parentId={msg.$id} onSuccess={handleReplySuccess} />
                      </div>
                    )}
                    
                    {/* Comments for Paid Messages */}
                    {showRepliesFor === msg.$id && commentsByParent[msg.$id]?.map((comment, ci) => {
                      const commentBg = ci % 2 === 0 ? "bg-black/10" : "bg-black/5";
                      return (
                      <div key={comment.$id} className={`relative z-10 mt-1 ml-4 md:ml-6 border-l-[3px] border-l-black/50 pl-3 py-1.5 pr-2 ${commentBg}`}>
                        <p className="text-sm text-black font-medium">{comment.text}</p>
                        <div className="mt-1 flex gap-2 text-[10px] uppercase tracking-wider opacity-80 text-black">
                          <span className="font-bold">{comment.author_name}</span>
                          <span>
                            {new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    )})}
                  </div>
                );
              }

              // We want text to inherit naturally from rowBg where possible
              return (
                <div key={msg.$id} className={rowBg}>
                  {/* Main row */}
                  <div className="flex items-start px-3 py-2.5">
                    <span className="w-10 flex-shrink-0 pt-1 text-[11px] font-bold opacity-60">
                      {String(globalIdx).padStart(3, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="break-words text-sm leading-relaxed">
                        {msg.text}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-wider opacity-60">
                        <span className="font-bold">{msg.author_name}</span>
                        <span>
                          {new Date(msg.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                        {!msg.parent_id && (
                          <button
                            onClick={() => handleReply(msg.$id)}
                            className="cursor-pointer font-bold text-spiteCrimson hover:opacity-100"
                          >
                            [ REPLY ]
                          </button>
                        )}
                        {(commentsByParent[msg.$id]?.length > 0 || showRepliesFor === msg.$id) && (
                          <button
                            onClick={() => handleToggleReplies(msg.$id)}
                            className="cursor-pointer font-bold hover:opacity-100"
                          >
                            {showRepliesFor === msg.$id
                              ? "[ HIDE REPLIES ]"
                              : `[ ${commentsByParent[msg.$id]?.length || 0} REPLIES ]`}
                          </button>
                        )}
                        {msg.is_shadowbanned && (
                          <span className="text-spiteCrimson">[RESTRICTED]</span>
                        )}
                      </div>
                      {/* Reply form */}
                      {replyingTo === msg.$id && (
                        <div className="mt-3 ml-4">
                          <SubmitForm parentId={msg.$id} onSuccess={handleReplySuccess} />
                        </div>
                      )}
                      {/* Comments */}
                      {showRepliesFor === msg.$id && commentsByParent[msg.$id]?.map((comment, ci) => {
                        // For comments, just alternate background opacity to differentiate them
                        const commentBg = ci % 2 === 0 ? "bg-black/10" : "bg-black/5";
                        return (
                        <div key={comment.$id} className={`mt-1 ml-6 border-l-[3px] border-l-spiteCrimson/50 pl-3 py-1.5 pr-2 ${commentBg}`}>
                          <p className="text-sm">{comment.text}</p>
                          <div className="mt-1 flex gap-2 text-[10px] uppercase tracking-wider opacity-60">
                            <span className="font-bold">{comment.author_name}</span>
                            <span>
                              {new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      )})}
                    </div>
                    <div className="w-28 flex-shrink-0 text-right">
                      {msg.amount_paid > 0 && (
                        <span className="inline-block border-2 border-hypeNeon bg-hypeNeon/10 px-2 py-0.5 text-xs font-bold text-hypeNeon">
                          ${msg.amount_paid.toFixed(2)} CHOP
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ─── Pagination — bracket keys ────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t-4 border-canvasBlack bg-canvasBlack px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.2em]">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="cursor-pointer text-sheetWhite transition-colors hover:text-hypeNeon disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [ PREV ]
            </button>
            <span className="text-chop-muted">
              PAGE {String(safePage + 1).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="cursor-pointer text-sheetWhite transition-colors hover:text-hypeNeon disabled:opacity-30 disabled:cursor-not-allowed"
            >
              [ NEXT ]
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
