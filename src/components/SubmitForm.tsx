"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";
import { submitFreeMessage, submitPaidMessage, submitComment } from "../app/actions/submit";
import { account, databases, DATABASE_ID, MESSAGES_COLLECTION_ID } from "../lib/appwrite";
import { useExecution } from "../lib/execution-context";
import { EXECUTION_THRESHOLD } from "../lib/constants";
import { Query } from "appwrite";

const SOLANA_RECEIVER = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET || "";
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export function SubmitForm({ onSuccess, parentId }: { onSuccess?: () => void; parentId?: string }) {
  const isComment = !!parentId;
  // ─── Free Tier State ─────────────────────────────────────────────────────
  const [freeText, setFreeText] = useState("");
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  const [freeError, setFreeError] = useState("");
  const [freeSuccess, setFreeSuccess] = useState(false);
  const [userStatus, setUserStatus] = useState<"loading" | "logged-in" | "logged-out" | "already-posted">("loading");
  const [userName, setUserName] = useState("");
  const [sessionJwt, setSessionJwt] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // ─── Paid Tier State ─────────────────────────────────────────────────────
  const [paidText, setPaidText] = useState("");
  const [paidName, setPaidName] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidSubmitting, setPaidSubmitting] = useState(false);
  const [paidError, setPaidError] = useState("");
  const [paidSuccess, setPaidSuccess] = useState(false);

  const { executed } = useExecution();
  const { publicKey, sendTransaction } = useWallet();
  const { setVisible: showWalletModal } = useWalletModal();

  // ─── Check user auth status on mount, auto-create anonymous session ──────
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      try {
        // Try to get existing session first
        const u = await account.get();
        if (cancelled) return;
        // Read display name from user preferences (set by AuthButtons)
        let displayName = "";
        let hasCustom = false;
        try {
          const prefs = await account.getPrefs();
          displayName = (prefs.display_name as string) || "";
          hasCustom = !!prefs.display_name;
        } catch {
          displayName = "";
        }
        if (!cancelled) {
          setUserName(displayName || u.name || "Anon");
          setNeedsName(!hasCustom && !displayName);
          if (!hasCustom && !displayName) setNameInput(u.name || "");
        }
        // Always create a JWT, even for existing sessions (needed for cross-domain auth)
        try {
          const { jwt } = await account.createJWT();
          if (!cancelled) setSessionJwt(jwt);
        } catch (jwtErr) {
          console.error("[SubmitForm] JWT creation failed:", jwtErr);
        }
        await checkExistingPost(u.$id);
        // Notify AuthButtons that session is ready
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("appwrite-session-ready"));
        }
      } catch {
        // No existing session — create anonymous one
        try {
          await account.createAnonymousSession();
          if (cancelled) return;
          const u = await account.get();
          // Read display name from user preferences
          let displayName = "";
          let hasCustom = false;
          try {
            const prefs = await account.getPrefs();
            displayName = (prefs.display_name as string) || "";
            hasCustom = !!prefs.display_name;
          } catch {
            displayName = "";
          }
          if (!cancelled) {
            setUserName(displayName || u.name || "Anon");
            setNeedsName(!hasCustom && !displayName);
            if (!hasCustom && !displayName) setNameInput(u.name || "");
          }
          // Generate JWT for server-side auth (cookie is on Appwrite domain, not localhost)
          const { jwt } = await account.createJWT();
          if (!cancelled) setSessionJwt(jwt);
          await checkExistingPost(u.$id);
          // Notify AuthButtons that session is ready
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("appwrite-session-ready"));
          }
        } catch (err) {
          console.error("[SubmitForm] Auth init failed:", err);
          if (!cancelled) setUserStatus("logged-out");
        }
      }
    }

    async function checkExistingPost(userId: string) {
      // Comments are unlimited — no per-user check needed
      if (isComment) {
        if (!cancelled) setUserStatus("logged-in");
        return;
      }
      try {
        // Only check for existing top-level posts (parent_id is null)
        const existing = await databases.listDocuments(
          DATABASE_ID,
          MESSAGES_COLLECTION_ID,
          [
            Query.isNull("parent_id"),
            Query.equal("author_id", userId),
            Query.equal("amount_paid", 0),
            Query.limit(1),
          ]
        );
        if (!cancelled) {
          setUserStatus(existing.documents.length > 0 ? "already-posted" : "logged-in");
        }
      } catch {
        if (!cancelled) setUserStatus("logged-in");
      }
    }

    initAuth();
    return () => { cancelled = true; };
  }, []);

  // ─── Re-check display name when changed externally (e.g., from navbar) ──
  useEffect(() => {
    const handler = async () => {
      try {
        const prefs = await account.getPrefs();
        const dn = (prefs.display_name as string) || "";
        if (dn) {
          setUserName(dn);
          setNeedsName(false);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("appwrite-session-ready", handler);
    return () => window.removeEventListener("appwrite-session-ready", handler);
  }, []);

  // ─── Free Submission ─────────────────────────────────────────────────────
  const handleFreeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (freeSubmitting || !freeText.trim()) return;

    // Ensure we have a JWT
    if (!sessionJwt) {
      setFreeError("Session not ready. Please wait or reload the page.");
      return;
    }

    setFreeSubmitting(true);
    setFreeError("");

    const formData = new FormData();
    formData.set("text", freeText.trim());
    formData.set("session_jwt", sessionJwt);
    formData.set("author_name", userName);
    if (isComment && parentId) {
      formData.set("parent_id", parentId);
    }

    const result = isComment
      ? await submitComment(formData)
      : await submitFreeMessage(formData);

    if (result.success) {
      setFreeSuccess(true);
      setFreeText("");
      setUserStatus("already-posted");
      // Notify HeroCounter for the blade wiggle
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("new-message", {
          detail: { authorName: userName || "Anon", amount: 0 },
        }));
      }
      onSuccess?.();
    } else {
      setFreeError(result.error || "Something went wrong.");
    }

    setFreeSubmitting(false);
  };

  // ─── Save Display Name ──────────────────────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = nameInput.trim().slice(0, 30);
    if (!trimmed) return;
    try {
      await account.updatePrefs({ display_name: trimmed });
      setUserName(trimmed);
      setNeedsName(false);
      // Notify AuthButtons to update the navbar
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("appwrite-session-ready"));
      }
    } catch (err) {
      console.error("Failed to save name:", err);
    }
  };

  // ─── Paid Submission (Solana) ────────────────────────────────────────────
  const handlePaidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paidSubmitting) return;

    const amount = parseFloat(paidAmount);
    if (!paidText.trim()) {
      setPaidError("Message is required.");
      return;
    }
    if (!amount || amount <= 0) {
      setPaidError("Enter a valid amount greater than 0.");
      return;
    }
    if (!SOLANA_RECEIVER) {
      setPaidError("Solana receiver wallet not configured.");
      return;
    }

    // Connect wallet if not connected
    if (!publicKey) {
      showWalletModal(true);
      return;
    }

    setPaidSubmitting(true);
    setPaidError("");

    try {
      // Build and send Solana transaction
      const connection = new Connection(SOLANA_RPC);
      const receiverPubkey = new PublicKey(SOLANA_RECEIVER);
      const lamports = amount * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: receiverPubkey,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      // Confirm transaction
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) {
        setPaidError("Transaction failed on-chain.");
        setPaidSubmitting(false);
        return;
      }

      // Submit message to Appwrite
      const formData = new FormData();
      formData.set("text", paidText.trim());
      formData.set("author_name", paidName.trim() || "Anonymous Whale");
      formData.set("amount_paid", amount.toFixed(2));
      formData.set("tx_signature", signature);

      const result = await submitPaidMessage(formData);

      if (result.success) {
        setPaidSuccess(true);
        setPaidText("");
        setPaidAmount("");
        setPaidName("");
        // Notify HeroCounter for the blade wiggle
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("new-message", {
            detail: { authorName: paidName.trim() || "Anonymous Whale", amount },
          }));
        }
        onSuccess?.();
      } else {
        setPaidError(result.error || "Failed to save message.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction cancelled or failed.";
      setPaidError(message);
    }

    setPaidSubmitting(false);
  };

  // ─── Tab state ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"free" | "paid">("free");

  // ─── Render ──────────────────────────────────────────────────────────────

  if (executed) {
    return (
      <div className="w-full">
        <div className="animate-fade-in rounded-xl border border-[#FF4500]/30 bg-[#FF4500]/5 p-8 text-center">
          <div className="mb-3 text-5xl">⚔️</div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[#FF4500]">
            The Blade Has Fallen
          </h2>
          <p className="mt-2 text-sm text-[#818384]">
            The threshold of {EXECUTION_THRESHOLD.toLocaleString()} messages has been reached.
            The guillotine has dropped. Submission forms are now locked.
          </p>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-[#FF4500]/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-[#343536] bg-[#1A1A1B] p-5">
      {/* ─── Tab buttons — hide for comments (no paid option) ────────── */}
      {!isComment && (
        <div className="mb-4 flex gap-1 rounded-lg bg-[#0a0a0a] p-1">
          <button
            onClick={() => setTab("free")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              tab === "free"
                ? "bg-[#FF4500] text-white"
                : "text-[#666] hover:text-[#D7DADC]"
            }`}
          >
            🆓 Free
          </button>
          <button
            onClick={() => setTab("paid")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-all ${
              tab === "paid"
                ? "bg-[#FF4500] text-white"
                : "text-[#666] hover:text-[#D7DADC]"
            }`}
          >
            💎 Paid
          </button>
        </div>
      )}

      {/* ─── Free Tab Content ─────────────────────────────────────────── */}
      {tab === "free" && (
        <>
          {/* ─── Name prompt — shows whenever no custom name is set, regardless of post status ─── */}
          {needsName && (
            <div className="rounded-lg border border-[#FF4500]/30 bg-[#FF4500]/5 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#FF4500]">
                🎭 Choose your display name
              </p>
              <p className="mb-3 text-[11px] text-[#818384]">
                This name will appear on your messages. You can change it anytime.
              </p>
              <div className="flex gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
                  placeholder="Enter a name..."
                  maxLength={30}
                  autoFocus
                  className="flex-1 rounded-md border border-[#343536] bg-[#0a0a0a] px-3 py-2 text-sm text-[#D7DADC] placeholder-[#818384] outline-none focus:border-[#FF4500]"
                />
                <button
                  onClick={handleSaveName}
                  disabled={!nameInput.trim()}
                  className="cursor-pointer rounded-md bg-[#FF4500] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#FF6A33] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Set Name
                </button>
              </div>
            </div>
          )}

          {userStatus === "logged-out" && (
            <div className="rounded-lg border border-[#343536] bg-[#0a0a0a] p-4 text-center">
              <p className="mb-3 text-xs text-[#818384]">
                Could not create anonymous session. Click below to retry.
              </p>
              <button
                onClick={async () => {
                  try {
                    await account.createAnonymousSession();
                    const u = await account.get();
                    setUserName(u.name || "Anon");
                    setUserStatus("logged-in");
                  } catch (err) {
                    console.error("Anonymous login failed:", err);
                  }
                }}
                className="cursor-pointer rounded-md bg-[#FF4500] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#FF6A33]"
              >
                Retry Anonymous Login
              </button>
            </div>
          )}

          {userStatus === "already-posted" && !needsName && !isComment && (
            <div className="rounded-lg border border-[#343536] bg-[#0a0a0a] p-4 text-center">
              <p className="text-xs text-[#818384]">
                You&apos;ve already posted your free message. Switch to{" "}
                <button onClick={() => setTab("paid")} className="text-[#FF4500] underline">
                  Paid
                </button>{" "}
                to post again!
              </p>
            </div>
          )}

          {userStatus === "logged-in" && !needsName && (
            <form onSubmit={handleFreeSubmit} className="flex flex-col gap-3">
              {freeSuccess ? (
                <div className="rounded-lg border border-[#46D160]/30 bg-[#46D160]/5 p-4 text-center">
                  <p className="text-sm text-[#46D160]">Message posted! ✅</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder={`What's on your mind, ${userName || "Anon"}?`}
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none rounded-md border border-[#343536] bg-[#0a0a0a] px-3 py-2 text-sm text-[#D7DADC] placeholder-[#818384] outline-none focus:border-[#FF4500]"
                  />
                  {freeError && <p className="text-xs text-[#FF4500]">{freeError}</p>}
                  <button
                    type="submit"
                    disabled={freeSubmitting || !freeText.trim()}
                    className="cursor-pointer rounded-md bg-[#FF4500] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#FF6A33] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {freeSubmitting ? "Posting..." : "Post Free Message"}
                  </button>
                </>
              )}
            </form>
          )}
        </>
      )}

      {/* ─── Paid Tab Content ─────────────────────────────────────────── */}
      {tab === "paid" && (
        <form onSubmit={handlePaidSubmit} className="flex flex-col gap-3">
          {paidSuccess ? (
            <div className="rounded-lg border border-[#46D160]/30 bg-[#46D160]/5 p-4 text-center">
              <p className="text-sm text-[#46D160]">Paid message posted! 💎</p>
            </div>
          ) : (
            <>
              <textarea
                value={paidText}
                onChange={(e) => setPaidText(e.target.value)}
                placeholder="Say something loud..."
                maxLength={500}
                rows={3}
                className="w-full resize-none rounded-md border border-[#343536] bg-[#0a0a0a] px-3 py-2 text-sm text-[#D7DADC] placeholder-[#818384] outline-none focus:border-[#FF4500]"
              />
              <div className="flex gap-2">
                <input
                  value={paidName}
                  onChange={(e) => setPaidName(e.target.value)}
                  placeholder="Your name (or Anonymous Whale)"
                  maxLength={50}
                  className="flex-1 rounded-md border border-[#343536] bg-[#0a0a0a] px-3 py-2 text-sm text-[#D7DADC] placeholder-[#818384] outline-none focus:border-[#FF4500]"
                />
                <div className="relative w-28">
                  <input
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-md border border-[#343536] bg-[#0a0a0a] px-3 py-2 pl-6 text-sm text-[#D7DADC] placeholder-[#818384] outline-none focus:border-[#FF4500]"
                  />
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#818384]">$</span>
                </div>
              </div>
              {paidError && <p className="text-xs text-[#FF4500]">{paidError}</p>}
              <button
                type="submit"
                disabled={paidSubmitting || !paidText.trim() || !paidAmount}
                className="cursor-pointer rounded-md bg-gradient-to-r from-[#FF4500] to-[#D93A00] px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-[0_0_16px_rgba(255,136,0,0.4)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paidSubmitting
                  ? "Processing..."
                  : publicKey
                    ? `Send ${paidAmount || "0"} SOL & Post`
                    : "Connect Wallet & Post"}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
