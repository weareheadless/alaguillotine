"use server";

import { Client, Account, Databases, Query, ID } from "node-appwrite";
import type { SubmitFreeResponse, SubmitPaidResponse, SubmitNominationResponse, NominationEntry } from "../../lib/types";
import { NOMINATION_WEIGHT_FREE, NOMINATION_WEIGHT_MULTIPLIER } from "../../lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Client authenticated via JWT — for verifying the user */
function getJwtClient(jwt: string) {
  return new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setJWT(jwt);
}

/** Admin client with API key — for database writes */
function getAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

  const apiKey = process.env.APPWRITE_API_KEY;
  if (apiKey) {
    client.setKey(apiKey);
  }

  return client;
}

function getDatabaseId(): string {
  return (
    process.env.APPWRITE_DATABASE_ID ||
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ||
    ""
  );
}

function getCollectionId(): string {
  return (
    process.env.APPWRITE_MESSAGES_COLLECTION_ID ||
    process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID ||
    ""
  );
}

function getNominationsCollectionId(): string {
  return (
    process.env.APPWRITE_NOMINATIONS_COLLECTION_ID ||
    process.env.NEXT_PUBLIC_APPWRITE_NOMINATIONS_COLLECTION_ID ||
    "nominations"
  );
}

/**
 * Create a nomination document if a target_name was provided.
 * Returns the nomination weight.
 */
async function createNomination(
  databases: Databases,
  targetName: string,
  voterId: string | null,
  voterName: string,
  messageId: string,
  amountPaid: number,
): Promise<number> {
  const weight = amountPaid > 0
    ? Math.max(NOMINATION_WEIGHT_FREE, Math.floor(amountPaid * NOMINATION_WEIGHT_MULTIPLIER))
    : NOMINATION_WEIGHT_FREE;

  await databases.createDocument(
    getDatabaseId(),
    getNominationsCollectionId(),
    ID.unique(),
    {
      target_name: targetName.trim().slice(0, 50),
      voter_id: voterId,
      voter_name: voterName,
      message_id: messageId,
      weight,
      amount_paid: amountPaid,
      created_at: new Date().toISOString(),
    }
  );

  return weight;
}

/**
 * Calls the OpenAI Moderation API.
 * Returns `true` if the message should be shadowbanned.
 */
async function checkModeration(text: string): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false; // No key = no moderation

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return false;

    // Flag if any of these categories are flagged
    const categories = result.categories ?? {};
    return !!(
      categories.hate ||
      categories["hate/threatening"] ||
      categories.harassment ||
      categories.violence ||
      categories["violence/graphic"]
    );
  } catch {
    return false;
  }
}

// ─── Submit Free Message (Appwrite session required, one per user) ──────────────

export async function submitFreeMessage(formData: FormData): Promise<SubmitFreeResponse> {
  try {
    const text = formData.get("text")?.toString().trim();
    const jwt = formData.get("session_jwt")?.toString();
    const customName = formData.get("author_name")?.toString().trim();
    const targetName = formData.get("target_name")?.toString().trim();
    if (!text) return { success: false, error: "Message is required." };
    if (!jwt) {
      return { success: false, error: "You must be logged in to post a free message." };
    }

    // Verify JWT and get user
    const jwtClient = getJwtClient(jwt);
    const userAccount = new Account(jwtClient);
    let user;
    try {
      user = await userAccount.get();
    } catch {
      return { success: false, error: "Session expired. Please log in again." };
    }

    const authorId = user.$id;
    // Use the custom display name if provided, otherwise fall back to account name
    const authorName = customName ||
      (user.name as string) ||
      (user.email as string) ||
      "Anonymous";

    // Check one-message-per-user limit (only for top-level messages)
    const adminClient = getAdminClient();
    const databases = new Databases(adminClient);
    const existing = await databases.listDocuments(
      getDatabaseId(),
      getCollectionId(),
      [
        Query.isNull("parent_id"),
        Query.equal("author_id", authorId),
        Query.equal("amount_paid", 0),
        Query.limit(1),
      ]
    );

    if (existing.documents.length > 0) {
      return {
        success: false,
        error: "You've already posted a free message. Only one per person.",
      };
    }

    // Check moderation (shadowban)
    const isShadowbanned = await checkModeration(text);

    // Create document and capture its ID
    const msgDoc = await databases.createDocument(
      getDatabaseId(),
      getCollectionId(),
      "unique()",
      {
        text,
        author_id: authorId,
        author_name: authorName,
        amount_paid: 0,
        is_shadowbanned: isShadowbanned,
        created_at: new Date().toISOString(),
      }
    );

    // If user nominated a target, create a nomination
    if (targetName) {
      await createNomination(databases, targetName, authorId, authorName, msgDoc.$id, 0);
    }

    // Always return success to the client
    return { success: true };
  } catch (err) {
    console.error("submitFreeMessage error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Submit Comment (free, unlimited — only for replies) ───────────────────────

export async function submitComment(formData: FormData): Promise<SubmitFreeResponse> {
  try {
    const text = formData.get("text")?.toString().trim();
    const jwt = formData.get("session_jwt")?.toString();
    const customName = formData.get("author_name")?.toString().trim();
    const parentId = formData.get("parent_id")?.toString().trim();
    const targetName = formData.get("target_name")?.toString().trim();
    if (!text) return { success: false, error: "Comment text is required." };
    if (!parentId) return { success: false, error: "Missing parent message ID." };
    if (!jwt) {
      return { success: false, error: "You must be logged in to comment." };
    }

    // Verify JWT and get user
    const jwtClient = getJwtClient(jwt);
    const userAccount = new Account(jwtClient);
    let user;
    try {
      user = await userAccount.get();
    } catch {
      return { success: false, error: "Session expired. Please log in again." };
    }

    const authorId = user.$id;
    const authorName = customName ||
      (user.name as string) ||
      (user.email as string) ||
      "Anonymous";

    // Check moderation (shadowban)
    const isShadowbanned = await checkModeration(text);

    const adminClient = getAdminClient();
    const databases = new Databases(adminClient);

    const commentDoc = await databases.createDocument(
      getDatabaseId(),
      getCollectionId(),
      "unique()",
      {
        text,
        author_id: authorId,
        author_name: authorName,
        amount_paid: 0,
        is_shadowbanned: isShadowbanned,
        parent_id: parentId,
        created_at: new Date().toISOString(),
      }
    );

    // If user nominated a target, create a nomination
    if (targetName) {
      await createNomination(databases, targetName, authorId, authorName, commentDoc.$id, 0);
    }

    return { success: true };
  } catch (err) {
    console.error("submitComment error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Submit Paid Message (Solana, bypasses auth) ────────────────────────────────

export async function submitPaidMessage(formData: FormData): Promise<SubmitPaidResponse> {
  try {
    const text = formData.get("text")?.toString().trim();
    const authorName = formData.get("author_name")?.toString().trim() || "Anonymous";
    const amountPaid = parseFloat(formData.get("amount_paid")?.toString() || "0");
    const txSignature = formData.get("tx_signature")?.toString().trim();
    const targetName = formData.get("target_name")?.toString().trim();

    if (!text) return { success: false, error: "Message is required." };
    if (!amountPaid || amountPaid <= 0) {
      return { success: false, error: "Payment amount must be greater than 0." };
    }
    if (!txSignature) {
      return { success: false, error: "Transaction signature is required." };
    }

    // Verify the transaction on-chain
    const rpcUrl =
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const verifyRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [txSignature, { encoding: "json", maxSupportedTransactionVersion: 0 }],
      }),
    });

    const txData = await verifyRes.json();
    if (txData.error) {
      return { success: false, error: "Could not verify transaction on-chain." };
    }

    const adminClient = getAdminClient();
    const databases = new Databases(adminClient);

    // Check moderation (shadowban)
    const isShadowbanned = await checkModeration(text);

    const msgDoc = await databases.createDocument(
      getDatabaseId(),
      getCollectionId(),
      "unique()",
      {
        text,
        author_id: null,
        author_name: authorName,
        amount_paid: amountPaid,
        is_shadowbanned: isShadowbanned,
        created_at: new Date().toISOString(),
      }
    );

    // If user nominated a target, create a nomination with paid weight
    if (targetName) {
      await createNomination(databases, targetName, null, authorName, msgDoc.$id, amountPaid);
    }

    return { success: true, transactionSignature: txSignature };
  } catch (err) {
    console.error("submitPaidMessage error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}


// ─── Server-side leaderboard fetch (used by Leaderboard component) ───────────

export async function fetchLeaderboard(): Promise<NominationEntry[]> {
  try {
    const adminClient = getAdminClient();
    const databases = new Databases(adminClient);

    const nominations = await databases.listDocuments(
      getDatabaseId(),
      getNominationsCollectionId(),
      [Query.limit(5000)]
    );

    const docs = nominations.documents as unknown as import("../../lib/types").NominationDocument[];

    // Aggregate by target_name
    const agg = new Map<string, { total_weight: number; total_votes: number; total_paid: number; last_nominated_at: string }>();

    for (const doc of docs) {
      const key = doc.target_name.toLowerCase();
      const existing = agg.get(key) || { total_weight: 0, total_votes: 0, total_paid: 0, last_nominated_at: "" };
      existing.total_weight += doc.weight;
      existing.total_votes += 1;
      existing.total_paid += doc.amount_paid;
      if (doc.created_at > existing.last_nominated_at) {
        existing.last_nominated_at = doc.created_at;
      }
      agg.set(key, existing);
    }

    // Convert to sorted array
    const entries: NominationEntry[] = [];
    for (const [lowerName, data] of agg) {
      // Find the original-cased name from one of the docs
      const origName = docs.find(
        (d) => d.target_name.toLowerCase() === lowerName
      )?.target_name || lowerName;
      entries.push({
        target_name: origName,
        total_weight: data.total_weight,
        total_votes: data.total_votes,
        total_paid: data.total_paid,
        last_nominated_at: data.last_nominated_at,
      });
    }

    entries.sort((a, b) => b.total_weight - a.total_weight);

    return entries;
  } catch (err) {
    console.error("fetchLeaderboard error:", err);
    return [];
  }
}

// ─── Server-side traitors fetch (used by Class Traitors component) ───────────

export async function fetchTraitors(): Promise<import("../../lib/types").TraitorEntry[]> {
  try {
    const adminClient = getAdminClient();
    const databases = new Databases(adminClient);

    const messages = await databases.listDocuments(
      getDatabaseId(),
      getCollectionId(),
      [Query.limit(5000), Query.greaterThan("amount_paid", 0)]
    );

    const docs = messages.documents as unknown as import("../../lib/types").MessageDocument[];

    // Aggregate by author_name
    const agg = new Map<string, { total_paid: number; total_messages: number; last_active_at: string }>();

    for (const doc of docs) {
      if (!doc.author_name || doc.author_name === "Anonymous") continue;
      
      const key = doc.author_name.toLowerCase();
      const existing = agg.get(key) || { total_paid: 0, total_messages: 0, last_active_at: "" };
      existing.total_paid += doc.amount_paid || 0;
      existing.total_messages += 1;
      if (doc.created_at > existing.last_active_at) {
        existing.last_active_at = doc.created_at;
      }
      agg.set(key, existing);
    }

    // Convert to sorted array
    const entries: import("../../lib/types").TraitorEntry[] = [];
    for (const [lowerName, data] of agg) {
      // Find the original-cased name
      const origName = docs.find(
        (d) => d.author_name?.toLowerCase() === lowerName
      )?.author_name || lowerName;
      entries.push({
        author_name: origName,
        total_paid: data.total_paid,
        total_messages: data.total_messages,
        last_active_at: data.last_active_at,
      });
    }

    entries.sort((a, b) => b.total_paid - a.total_paid);

    return entries;
  } catch (err) {
    console.error("fetchTraitors error:", err);
    return [];
  }
}
