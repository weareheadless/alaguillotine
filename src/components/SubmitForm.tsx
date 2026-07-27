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
  const [freeText, setFreeText] = useState("");
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  const [freeError, setFreeError] = useState("");
  const [freeSuccess, setFreeSuccess] = useState(false);
  const [userStatus, setUserStatus] = useState<"loading" | "logged-in" | "logged-out" | "already-posted">("loading");
  const [userName, setUserName] = useState("");
  const [sessionJwt, setSessionJwt] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const [paidText, setPaidText] = useState("");
  const [paidName, setPaidName] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidSubmitting, setPaidSubmitting] = useState(false);
  const [paidError, setPaidError] = useState("");
  const [paidSuccess, setPaidSuccess] = useState(false);

  const { executed } = useExecution();
  const { publicKey, sendTransaction } = useWallet();
  const { setVisible: showWalletModal } = useWalletModal();

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      try {
        const u = await account.get();
        if (cancelled) return;
        let displayName = "";
        let hasCustom = false;
        try { const prefs = await account.getPrefs(); displayName = (prefs.display_name as string) || ""; hasCustom = !!prefs.display_name; } catch { displayName = ""; }
        if (!cancelled) { setUserName(displayName || u.name || "Anon"); setNeedsName(!hasCustom && !displayName); if (!hasCustom && !displayName) setNameInput(u.name || ""); }
        try { const { jwt } = await account.createJWT(); if (!cancelled) setSessionJwt(jwt); } catch (jwtErr) { console.error("[SubmitForm] JWT creation failed:", jwtErr); }
        await checkExistingPost(u.$id);
        if (typeof window !== "undefined") window.dispatchEvent(new Event("appwrite-session-ready"));
      } catch {
        try {
          await account.createAnonymousSession();
          if (cancelled) return;
          const u = await account.get();
          let displayName = "";
          let hasCustom = false;
          try { const prefs = await account.getPrefs(); displayName = (prefs.display_name as string) || ""; hasCustom = !!prefs.display_name; } catch { displayName = ""; }
          if (!cancelled) { setUserName(displayName || u.name || "Anon"); setNeedsName(!hasCustom && !displayName); if (!hasCustom && !displayName) setNameInput(u.name || ""); }
          const { jwt } = await account.createJWT(); if (!cancelled) setSessionJwt(jwt);
          await checkExistingPost(u.$id);
          if (typeof window !== "undefined") window.dispatchEvent(new Event("appwrite-session-ready"));
        } catch (err) { console.error("[SubmitForm] Auth init failed:", err); if (!cancelled) setUserStatus("logged-out"); }
      }
    }

    async function checkExistingPost(userId: string) {
      if (isComment) { if (!cancelled) setUserStatus("logged-in"); return; }
      try {
        const existing = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [Query.isNull("parent_id"), Query.equal("author_id", userId), Query.equal("amount_paid", 0), Query.limit(1)]);
        if (!cancelled) setUserStatus(existing.documents.length > 0 ? "already-posted" : "logged-in");
      } catch { if (!cancelled) setUserStatus("logged-in"); }
    }

    initAuth();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = async () => {
      try { const prefs = await account.getPrefs(); const dn = (prefs.display_name as string) || ""; if (dn) { setUserName(dn); setNeedsName(false); } } catch { /* ignore */ }
    };
    window.addEventListener("appwrite-session-ready", handler);
    return () => window.removeEventListener("appwrite-session-ready", handler);
  }, []);

  const handleFreeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (freeSubmitting || !freeText.trim()) return;
    if (!sessionJwt) { setFreeError("Session not ready."); return; }
    setFreeSubmitting(true); setFreeError("");
    const formData = new FormData();
    formData.set("text", freeText.trim()); formData.set("session_jwt", sessionJwt); formData.set("author_name", userName);
    if (isComment && parentId) formData.set("parent_id", parentId);
    const result = isComment ? await submitComment(formData) : await submitFreeMessage(formData);
    if (result.success) {
      setFreeSuccess(true); setFreeText(""); setUserStatus("already-posted");
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("new-message", { detail: { authorName: userName || "Anon", amount: 0 } }));
      onSuccess?.();
    } else setFreeError(result.error || "Something went wrong.");
    setFreeSubmitting(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim().slice(0, 30);
    if (!trimmed) return;
    try { await account.updatePrefs({ display_name: trimmed }); setUserName(trimmed); setNeedsName(false); if (typeof window !== "undefined") window.dispatchEvent(new Event("appwrite-session-ready")); } catch (err) { console.error("Failed to save name:", err); }
  };

  const handlePaidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paidSubmitting) return;
    const amount = parseFloat(paidAmount);
    if (!paidText.trim()) { setPaidError("Message is required."); return; }
    if (!amount || amount <= 0) { setPaidError("Enter a valid amount."); return; }
    if (!SOLANA_RECEIVER) { setPaidError("Receiver wallet not configured."); return; }
    if (!publicKey) { showWalletModal(true); return; }
    setPaidSubmitting(true); setPaidError("");
    try {
      const connection = new Connection(SOLANA_RPC);
      const receiverPubkey = new PublicKey(SOLANA_RECEIVER);
      const transaction = new Transaction().add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: receiverPubkey, lamports: amount * LAMPORTS_PER_SOL }));
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash; transaction.feePayer = publicKey;
      const signature = await sendTransaction(transaction, connection);
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) { setPaidError("Transaction failed."); setPaidSubmitting(false); return; }
      const formData = new FormData();
      formData.set("text", paidText.trim()); formData.set("author_name", paidName.trim() || "Anonymous Whale"); formData.set("amount_paid", amount.toFixed(2)); formData.set("tx_signature", signature);
      const result = await submitPaidMessage(formData);
      if (result.success) {
        setPaidSuccess(true); setPaidText(""); setPaidAmount(""); setPaidName("");
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("new-message", { detail: { authorName: paidName.trim() || "Anonymous Whale", amount } }));
        onSuccess?.();
      } else setPaidError(result.error || "Failed to save message.");
    } catch (err: unknown) { setPaidError(err instanceof Error ? err.message : "Transaction cancelled."); }
    setPaidSubmitting(false);
  };

  const [tab, setTab] = useState<"free" | "paid">("free");

  if (executed) {
    return (
      <div className="w-full">
        <div className="border-4 border-black bg-sheetWhite p-8 text-center font-mono shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-3 text-5xl">⚔️</div>
          <h2 className="text-xl font-black uppercase tracking-tighter text-spiteCrimson animate-glitch-text">The Blade Has Fallen</h2>
          <p className="mt-2 text-sm text-chop-muted">Threshold of {EXECUTION_THRESHOLD.toLocaleString()} reached. Submissions are now locked.</p>
          <div className="mx-auto mt-4 h-1 w-24 bg-spiteCrimson/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-4 border-black bg-sheetWhite p-6 font-mono shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <h2 className="mb-4 border-b-2 border-black pb-2 text-2xl font-black uppercase tracking-tighter text-canvasBlack">
        Execute Discontent
      </h2>

      {!isComment && (
        <div className="mb-5 flex border-2 border-black">
          <button onClick={() => setTab("free")} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${tab === "free" ? "bg-spiteCrimson text-sheetWhite" : "bg-white text-canvasBlack hover:bg-glitchGray hover:text-sheetWhite"}`}>
            [ FREE ]
          </button>
          <button onClick={() => setTab("paid")} className={`flex-1 border-l-2 border-black py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${tab === "paid" ? "bg-spiteCrimson text-sheetWhite" : "bg-white text-canvasBlack hover:bg-glitchGray hover:text-sheetWhite"}`}>
            [ PAID ]
          </button>
        </div>
      )}

      {needsName && (
        <div className="mb-4 border-2 border-black bg-hypeNeon/10 p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-spiteCrimson">// CHOOSE DISPLAY NAME</p>
          <p className="mb-3 text-[11px] text-chop-muted">This name will appear on your messages. You can change it anytime.</p>
          <div className="flex gap-2">
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }} placeholder="Enter a name..." maxLength={30} autoFocus className="flex-1 border-2 border-black bg-white px-3 py-2 text-sm text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-spiteCrimson" />
            <button onClick={handleSaveName} disabled={!nameInput.trim()} className="cursor-pointer border-2 border-black bg-spiteCrimson px-4 py-2 text-sm font-bold uppercase text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40">
              Set Name
            </button>
          </div>
        </div>
      )}

      {tab === "free" && (
        <>
          {userStatus === "logged-out" && (
            <div className="mb-4 border-2 border-black bg-white p-4 text-center">
              <p className="mb-3 text-xs text-chop-muted">// Could not create anonymous session. Click below to retry.</p>
              <button onClick={async () => { try { await account.createAnonymousSession(); const u = await account.get(); setUserName(u.name || "Anon"); setUserStatus("logged-in"); } catch (err) { console.error(err); } }} className="cursor-pointer border-2 border-black bg-spiteCrimson px-4 py-2 text-sm font-bold uppercase text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none">
                [ RETRY AUTH ]
              </button>
            </div>
          )}

          {userStatus === "already-posted" && !needsName && !isComment && (
            <div className="mb-4 border-2 border-dashed border-spiteCrimson bg-spiteCrimson/5 p-4 text-center">
              <p className="text-xs uppercase text-spiteCrimson">
                // One free message per user. Switch to{" "}
                <button onClick={() => setTab("paid")} className="font-bold underline decoration-2">PAID</button> to post again!
              </p>
            </div>
          )}

          {userStatus === "logged-in" && !needsName && (
            <form onSubmit={handleFreeSubmit} className="flex flex-col gap-3">
              {freeSuccess ? (
                <div className="border-2 border-hypeNeon bg-hypeNeon/10 p-4 text-center">
                  <p className="text-sm font-bold uppercase text-hypeNeon">// Message posted! ✅</p>
                </div>
              ) : (
                <>
                  <label className="block text-xs font-bold uppercase tracking-wider">// 1. Write Your Manifesto (Max 500 Chars)</label>
                  <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder={isComment ? "Write a reply..." : "Say something Elon will read while sitting on a toilet on his private jet..."} maxLength={500} rows={3} className="w-full resize-none border-2 border-black bg-white p-2 text-sm text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-spiteCrimson" />
                  {freeError && <p className="text-xs font-bold text-spiteCrimson">ERROR: {freeError}</p>}
                  <button type="submit" disabled={freeSubmitting || !freeText.trim()} className="w-full cursor-pointer border-2 border-black bg-spiteCrimson py-3 text-center font-bold uppercase tracking-wider text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-75 hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40">
                    {freeSubmitting ? "// POSTING..." : isComment ? "REPLY [SEND]" : "RELEASE THE BLADE [FREE EXECUTION]"}
                  </button>
                </>
              )}
            </form>
          )}
        </>
      )}

      {tab === "paid" && (
        <form onSubmit={handlePaidSubmit} className="flex flex-col gap-3">
          {paidSuccess ? (
            <div className="border-2 border-hypeNeon bg-hypeNeon/10 p-4 text-center">
              <p className="text-sm font-bold uppercase text-hypeNeon">// Paid message posted! 💎</p>
            </div>
          ) : (
            <>
              <label className="block text-xs font-bold uppercase tracking-wider">// 1. Write Your Manifesto (Max 500 Chars)</label>
              <textarea value={paidText} onChange={(e) => setPaidText(e.target.value)} placeholder="Say something Elon will read while sitting on a toilet on his private jet..." maxLength={500} rows={3} className="w-full resize-none border-2 border-black bg-white p-2 text-sm text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-hypeNeon" />

              <label className="block text-xs font-bold uppercase tracking-wider">// 2. Amount of SOL to Burn</label>
              <div className="flex gap-2">
                <input value={paidName} onChange={(e) => setPaidName(e.target.value)} placeholder="Name (or Anonymous Whale)" maxLength={50} className="flex-1 border-2 border-black bg-white px-3 py-2 text-sm text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-spiteCrimson" />
                <div className="relative w-32">
                  <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" type="text" inputMode="decimal" className="w-full border-2 border-black bg-white px-3 py-2 pl-7 text-xl font-bold text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-hypeNeon" />
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold text-chop-muted">◎</span>
                </div>
              </div>

              {paidError && <p className="text-xs font-bold text-spiteCrimson">ERROR: {paidError}</p>}
              <button type="submit" disabled={paidSubmitting || !paidText.trim() || !paidAmount} className="w-full cursor-pointer border-2 border-black bg-spiteCrimson py-3 text-center font-bold uppercase tracking-wider text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-75 hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40">
                {paidSubmitting ? "// PROCESSING..." : publicKey ? `RELEASE THE BLADE [SEND ${paidAmount || "0"} SOL]` : "CONNECT WALLET & EXECUTE"}
              </button>
              <p className="text-[10px] italic text-chop-muted">*Warning: This transaction will definitively accomplish absolutely nothing of tangible real-world utility.</p>
            </>
          )}
        </form>
      )}
    </div>
  );
}
