"use server";

import { Client, Account, Databases, Query } from "node-appwrite";
import type { SubmitFreeResponse, SubmitPaidResponse } from "../../lib/types";

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

    // Create document
    await databases.createDocument(
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

    await databases.createDocument(
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

    await databases.createDocument(
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

    return { success: true, transactionSignature: txSignature };
  } catch (err) {
    console.error("submitPaidMessage error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
