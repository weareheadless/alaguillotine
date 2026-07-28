"use server";

import { LocalDatabases, Query } from "../../lib/local-db";
import type { FeedMessage, CounterData } from "../../lib/types";

function getDb() {
  return new LocalDatabases();
}

/** Fetch visible messages for the main feed */
export async function fetchVisibleMessages(): Promise<FeedMessage[]> {
  try {
    const db = getDb();
    const visibleRes = db.listDocuments("", "messages", [
      Query.equal("is_shadowbanned", false),
      Query.limit(100),
    ]);
    return visibleRes.documents as unknown as FeedMessage[];
  } catch (e) {
    console.error("fetchVisibleMessages error:", e);
    return [];
  }
}

/** Fetch own messages (including shadowbanned) for the current user */
export async function fetchOwnMessages(authorId: string): Promise<FeedMessage[]> {
  try {
    const db = getDb();
    const ownRes = db.listDocuments("", "messages", [
      Query.equal("author_id", authorId),
      Query.equal("is_shadowbanned", true),
      Query.limit(50),
    ]);
    return ownRes.documents as unknown as FeedMessage[];
  } catch (e) {
    console.error("fetchOwnMessages error:", e);
    return [];
  }
}

/** Get total message count (visible only) */
export async function fetchMessageCount(): Promise<CounterData> {
  try {
    const db = getDb();
    const res = db.listDocuments("", "messages", [
      Query.equal("is_shadowbanned", false),
      Query.limit(1),
    ]);
    return { total: res.total };
  } catch (e) {
    console.error("fetchMessageCount error:", e);
    return { total: 0 };
  }
}

/** Check if a user already has a free top-level message */
export async function checkExistingFreeMessage(authorId: string): Promise<boolean> {
  try {
    const db = getDb();
    const existing = db.listDocuments("", "messages", [
      Query.isNull("parent_id"),
      Query.equal("author_id", authorId),
      Query.equal("amount_paid", 0),
      Query.limit(1),
    ]);
    return existing.documents.length > 0;
  } catch {
    return false;
  }
}
