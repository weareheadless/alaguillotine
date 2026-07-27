"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { databases, account, DATABASE_ID, MESSAGES_COLLECTION_ID } from "../lib/appwrite";
import { Query } from "appwrite";
import type { FeedMessage } from "../lib/types";
import { getDemoMessages } from "../lib/mock-data";
import { SubmitForm } from "./SubmitForm";

function MessageCard({ message, isCurrentUser, onReply }: { message: FeedMessage; isCurrentUser: boolean; onReply: (id: string) => void }) {
  const isPaid = message.amount_paid > 0;
  const isOwn = isCurrentUser;
  const isComment = !!message.parent_id;

  return (
    <div
      className={`animate-fade-in rounded-md border border-[#343536] bg-[#1A1A1B] p-3 transition-all hover:border-[#333] ${
        isPaid ? "border-l-[3px] border-l-[#FF4500]" : ""
      } ${isOwn && message.is_shadowbanned ? "opacity-40" : ""} ${
        isComment ? "ml-6 border-l-[#FF4500]/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm leading-relaxed text-[#D7DADC]">
            {message.text}
          </p>
        </div>
        {isPaid && (
          <span className="flex-shrink-0 rounded-full bg-[#FF4500]/10 px-2 py-0.5 text-xs font-semibold text-[#FF4500]">
            ${message.amount_paid.toFixed(2)}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-[#818384]">
        <span>{message.author_name}</span>
        <span>·</span>
        <span>
          {new Date(message.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {isOwn && message.is_shadowbanned && (
          <>
            <span>·</span>
            <span className="text-[#FF4500]">visibility restricted</span>
          </>
        )}
        {!isComment && (
          <>
            <span>·</span>
            <button
              onClick={() => onReply(message.$id)}
              className="cursor-pointer text-[#FF4500] transition-colors hover:text-[#FF6A33]"
            >
              Reply
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function MessageFeed() {
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showRepliesFor, setShowRepliesFor] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get current user ID
  useEffect(() => {
    account
      .get()
      .then((u) => setCurrentUserId(u.$id))
      .catch(() => setCurrentUserId(null));
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      // Get visible (non-shadowbanned) messages for everyone
      const visibleRes = await databases.listDocuments(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        [
          Query.equal("is_shadowbanned", false),
          Query.limit(100),
        ]
      );

      let docs = visibleRes.documents as unknown as FeedMessage[];

      // If user is logged in, also fetch their own shadowbanned messages
      if (currentUserId) {
        const ownRes = await databases.listDocuments(
          DATABASE_ID,
          MESSAGES_COLLECTION_ID,
          [
            Query.equal("author_id", currentUserId),
            Query.equal("is_shadowbanned", true),
            Query.limit(50),
          ]
        );
        const ownDocs = ownRes.documents as unknown as FeedMessage[];
        docs = [...docs, ...ownDocs];
      }

      // Sort client-side by createdAt (desc)
      docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMessages(docs);
    } catch (e) {
      console.error("MessageFeed fetch error:", e);
      if (e instanceof Error) {
        console.error("MessageFeed error name:", e.name, "message:", e.message);
        if ("response" in (e as any)) {
          console.error("MessageFeed error response:", JSON.stringify((e as any).response));
        }
      }
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 8_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMessages]);

  const handleReply = (id: string) => {
    setReplyingTo(replyingTo === id ? null : id);
    // Automatically show replies when replying
    if (showRepliesFor !== id) setShowRepliesFor(id);
  };

  const handleToggleReplies = (id: string) => {
    setShowRepliesFor(showRepliesFor === id ? null : id);
  };

  const handleReplySuccess = () => {
    setReplyingTo(null);
    // Keep replies visible after posting
    fetchMessages();
  };

  // Build threaded structure
  const topLevel = messages.filter((m) => !m.parent_id);
  const commentsByParent: Record<string, FeedMessage[]> = {};
  for (const msg of messages) {
    if (msg.parent_id) {
      if (!commentsByParent[msg.parent_id]) commentsByParent[msg.parent_id] = [];
      commentsByParent[msg.parent_id].push(msg);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF4500] border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm">💬</span>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#818384]">
          Messages
        </h2>
        <span className="rounded-full bg-[#343536] px-1.5 py-0.5 text-[9px] text-[#818384]">
          {topLevel.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {topLevel.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#818384]">
            No messages yet. Be the first!
          </p>
        ) : (
          topLevel.map((msg) => (
            <div key={msg.$id} className="flex flex-col gap-1.5">
              <MessageCard
                message={msg}
                isCurrentUser={msg.author_id === currentUserId}
                onReply={handleReply}
              />
              {/* Inline reply form */}
              {replyingTo === msg.$id && (
                <div className="ml-6">
                  <SubmitForm
                    parentId={msg.$id}
                    onSuccess={handleReplySuccess}
                  />
                </div>
              )}
              {/* "Show replies" toggle — only appears when there are comments */}
              {(commentsByParent[msg.$id]?.length > 0 || showRepliesFor === msg.$id) && (
                <button
                  onClick={() => handleToggleReplies(msg.$id)}
                  className="ml-6 cursor-pointer self-start px-2 py-1 text-[11px] font-semibold text-[#818384] transition-colors hover:text-[#D7DADC]"
                >
                  {showRepliesFor === msg.$id
                    ? `▲ Hide replies`
                    : `▼ ${commentsByParent[msg.$id]?.length || 0} ${commentsByParent[msg.$id]?.length === 1 ? "reply" : "replies"}`}
                </button>
              )}
              {/* Show comments only when expanded */}
              {showRepliesFor === msg.$id && commentsByParent[msg.$id]?.map((comment) => (
                <MessageCard
                  key={comment.$id}
                  message={comment}
                  isCurrentUser={comment.author_id === currentUserId}
                  onReply={() => {}}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
