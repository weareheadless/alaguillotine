"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, getAccount, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { submitFreeMessage, submitPaidMessage, submitComment } from "../app/actions/submit";
import { checkExistingFreeMessage } from "../app/actions/feed";
import { useAuth } from "../lib/auth-context";
import { useExecution } from "../lib/execution-context";
import { solveChallenge } from "../lib/pow";
import { EXECUTION_THRESHOLD } from "../lib/constants";

const SOLANA_RECEIVER = process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET || "";
const CHOP_MINT = process.env.NEXT_PUBLIC_CHOP_MINT || "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump";
const CHOP_DECIMALS = parseInt(process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6", 10);

export function SubmitForm({ onSuccess, parentId }: { onSuccess?: () => void; parentId?: string }) {
  const isComment = !!parentId;
  const { user, loading: authLoading } = useAuth();
  const [freeText, setFreeText] = useState("");
  const [freeSubmitting, setFreeSubmitting] = useState(false);
  const [freeError, setFreeError] = useState("");
  const [freeSuccess, setFreeSuccess] = useState(false);
  const [userStatus, setUserStatus] = useState<"loading" | "logged-in" | "logged-out" | "already-posted">("loading");

  const [paidText, setPaidText] = useState("");
  const [paidName, setPaidName] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidSubmitting, setPaidSubmitting] = useState(false);
  const [paidError, setPaidError] = useState("");
  const [paidSuccess, setPaidSuccess] = useState(false);

  const [chopBalance, setChopBalance] = useState<number | null>(null);
  const [chopBalanceError, setChopBalanceError] = useState<string>("");

  // PoW state
  const [powStatus, setPowStatus] = useState<"idle" | "computing" | "ready" | "skipped">("idle");
  const powSolutionRef = useRef<{ challenge: string; nonce: string } | null>(null);

  const { executed } = useExecution();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible: showWalletModal } = useWalletModal();

  // Fetch CHOP balance when wallet connects — uses the shared connection from ConnectionProvider
  useEffect(() => {
    if (!publicKey) {
      setChopBalance(null);
      setChopBalanceError("");
      return;
    }
    const pk = publicKey!;
    let cancelled = false;

    async function fetchBalance() {
      try {
        const mint = new PublicKey(CHOP_MINT);
        const ataAddress = getAssociatedTokenAddressSync(mint, pk, false, TOKEN_2022_PROGRAM_ID);
        const result = await connection.getTokenAccountBalance(ataAddress);
        if (!cancelled) {
          setChopBalance(result.value.uiAmount ?? 0);
          setChopBalanceError("");
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || String(err);
          if (msg.includes("account not found") || msg.includes("could not find")) {
            // ATA doesn't exist — wallet simply has no CHOP
            setChopBalance(0);
            setChopBalanceError("");
          } else {
            console.warn("[CHOP balance] fetch error:", msg);
            setChopBalanceError(`RPC error — check NEXT_PUBLIC_SOLANA_RPC_URL. ${msg.slice(0, 50)}`);
          }
        }
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [publicKey, connection]);

  // Auth status effect
  useEffect(() => {
    if (authLoading) {
      setUserStatus("loading");
      return;
    }

    if (!user) {
      setUserStatus("logged-out");
      return;
    }

    if (isComment) {
      setUserStatus("logged-in");
      return;
    }

    (async () => {
      try {
        const hasExisting = await checkExistingFreeMessage(user.id);
        setUserStatus(hasExisting ? "already-posted" : "logged-in");
      } catch {
        setUserStatus("logged-in");
      }
    })();
  }, [user, authLoading, isComment]);

  // PoW flow — start solving on mount for non-wallet users
  useEffect(() => {
    if (!user || user.wallet_address) {
      // Wallet-linked users skip PoW
      setPowStatus("skipped");
      return;
    }

    let cancelled = false;

    async function doPow() {
      setPowStatus("computing");
      try {
        // Fetch challenge from server
        const challengeRes = await fetch("/api/auth/challenge", { method: "POST" });
        const { challenge, difficulty } = await challengeRes.json();

        // Solve in background
        const solution = await solveChallenge(challenge, difficulty, (attempts) => {
          if (cancelled) return;
        });

        if (!cancelled) {
          powSolutionRef.current = { challenge: solution.challenge, nonce: solution.nonce };
          setPowStatus("ready");
        }
      } catch {
        if (!cancelled) setPowStatus("idle");
      }
    }

    doPow();
    return () => { cancelled = true; };
  }, [user]);

  const [targetName, setTargetName] = useState("");

  const handleFreeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (freeSubmitting || !freeText.trim()) return;
    if (!user) { setFreeError("You must be logged in."); return; }
    setFreeSubmitting(true); setFreeError("");

    const formData = new FormData();
    formData.set("text", freeText.trim());
    formData.set("author_name", user.display_name || user.username);

    // Add honeypot (hidden field — always empty for humans)
    formData.set("website", "");

    // Add PoW solution if not wallet-linked
    if (!user.wallet_address) {
      const solution = powSolutionRef.current;
      if (!solution) {
        setFreeError("Proof of work not ready yet. Please wait.");
        setFreeSubmitting(false);
        return;
      }
      formData.set("pow_challenge", solution.challenge);
      formData.set("pow_nonce", solution.nonce);
    }

    if (targetName.trim()) formData.set("target_name", targetName.trim());
    if (isComment && parentId) formData.set("parent_id", parentId);

    const result = isComment ? await submitComment(formData) : await submitFreeMessage(formData);

    if (result.success) {
      setFreeSuccess(true); setFreeText(""); setUserStatus("already-posted");
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("new-message", { detail: { authorName: user.display_name || user.username || "Anon", amount: 0 } }));
      onSuccess?.();
    } else setFreeError(result.error || "Something went wrong.");
    setFreeSubmitting(false);
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
      const mint = new PublicKey(CHOP_MINT);
      const receiverPubkey = new PublicKey(SOLANA_RECEIVER);

      const userAta = getAssociatedTokenAddressSync(mint, publicKey, false, TOKEN_2022_PROGRAM_ID);
      const treasuryAta = getAssociatedTokenAddressSync(mint, receiverPubkey, false, TOKEN_2022_PROGRAM_ID);

      const transaction = new Transaction();

      try {
        await getAccount(connection, userAta, undefined, TOKEN_2022_PROGRAM_ID);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userAta,
            publicKey,
            mint,
            TOKEN_2022_PROGRAM_ID,
          )
        );
      }

      try {
        await getAccount(connection, treasuryAta, undefined, TOKEN_2022_PROGRAM_ID);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            treasuryAta,
            receiverPubkey,
            mint,
            TOKEN_2022_PROGRAM_ID,
          )
        );
      }

      const rawAmount = BigInt(Math.round(amount * Math.pow(10, CHOP_DECIMALS)));
      console.log("[CHOP tx] Transferring", amount, "CHOP (raw:", rawAmount.toString(), ") from", publicKey.toBase58().slice(0, 8) + "...", "to", receiverPubkey.toBase58().slice(0, 8) + "...");

      transaction.add(
        createTransferCheckedInstruction(
          userAta,
          mint,
          treasuryAta,
          publicKey,
          rawAmount,
          CHOP_DECIMALS,
          undefined,
          TOKEN_2022_PROGRAM_ID,
        )
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash; transaction.feePayer = publicKey;

      console.log("[CHOP tx] Sending transaction...");
      const signature = await sendTransaction(transaction, connection);
      console.log("[CHOP tx] Signature:", signature);

      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      console.log("[CHOP tx] Confirmed. Err:", confirmation.value.err || "none");
      if (confirmation.value.err) { setPaidError("Transaction failed."); setPaidSubmitting(false); return; }
      const formData = new FormData();
      formData.set("text", paidText.trim());
      formData.set("author_name", paidName.trim() || "Anonymous Whale");
      formData.set("amount_paid", amount.toFixed(2));
      formData.set("tx_signature", signature);
      formData.set("wallet_address", publicKey.toBase58());
      // Add honeypot
      formData.set("website", "");
      if (targetName.trim()) formData.set("target_name", targetName.trim());
      const result = await submitPaidMessage(formData);
      if (result.success) {
        setPaidSuccess(true); setPaidText(""); setPaidAmount(""); setPaidName("");
        try {
          const ataAddr = getAssociatedTokenAddressSync(mint, publicKey, false, TOKEN_2022_PROGRAM_ID);
          const balResult = await connection.getTokenAccountBalance(ataAddr);
          setChopBalance(balResult.value.uiAmount ?? 0);
          setChopBalanceError("");
        } catch { /* ignore — background refresh, main fetch interval will retry */ }
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

  if (isComment) {
    if (!user) {
      return (
        <div className="border-2 border-black bg-white p-2 text-center font-mono mt-2">
          <p className="text-[10px] text-chop-muted">Log in to reply.</p>
        </div>
      );
    }
    return (
      <form onSubmit={handleFreeSubmit} className="flex flex-col gap-2 mt-2 font-mono relative">
        {freeSuccess ? (
          <div className="border border-hypeNeon bg-hypeNeon/10 p-2 text-center">
            <p className="text-[10px] font-bold uppercase text-hypeNeon">Reply posted! ✅</p>
          </div>
        ) : (
          <>
            <textarea 
              value={freeText} 
              onChange={(e) => setFreeText(e.target.value)} 
              placeholder="Write a reply..." 
              maxLength={200} 
              rows={2} 
              className="w-full resize-none border-2 border-black bg-white p-2 text-xs text-canvasBlack placeholder-chop-muted outline-none focus:ring-1 focus:ring-spiteCrimson" 
            />
            {freeError && <p className="text-[10px] font-bold text-spiteCrimson">ERROR: {freeError}</p>}
            <button 
              type="submit" 
              disabled={freeSubmitting || !freeText.trim() || (powStatus === "computing" && !user?.wallet_address)} 
              className="self-end cursor-pointer border-2 border-black bg-black px-4 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-sheetWhite shadow-[2px_2px_0px_0px_rgba(225,29,72,1)] transition-all hover:bg-spiteCrimson hover:text-black active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              {freeSubmitting ? "POSTING..." : "REPLY"}
            </button>
          </>
        )}
      </form>
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

      {tab === "free" && (
        <div className="min-h-[120px]">
          {userStatus === "loading" && (
            <div className="flex h-[120px] items-center justify-center border-2 border-black bg-glitchGray/50">
              <span className="text-xs uppercase tracking-widest text-chop-muted">Loading...</span>
            </div>
          )}

          {userStatus === "logged-out" && (
            <div className="flex h-[120px] items-center justify-center border-2 border-black bg-white p-4 text-center">
              <div>
                <p className="text-lg">🔒</p>
                <p className="mt-1 text-xs text-chop-muted">Log in to post a free message.</p>
              </div>
            </div>
          )}

          {userStatus === "already-posted" && !isComment && (
            <div className="flex h-[120px] items-center justify-center border-2 border-dashed border-spiteCrimson bg-spiteCrimson/5 p-4 text-center">
              <div>
                <p className="text-xs uppercase text-spiteCrimson">
                  One free message per user. Switch to{" "}
                  <button onClick={() => setTab("paid")} className="font-bold underline decoration-2">PAID</button> to post again!
                </p>
              </div>
            </div>
          )}

          {userStatus === "logged-in" && (
            <form onSubmit={handleFreeSubmit} className="flex flex-col gap-2">
              {freeSuccess ? (
                <div className="flex h-[120px] items-center justify-center border-2 border-hypeNeon bg-hypeNeon/10">
                  <p className="text-sm font-bold uppercase text-hypeNeon">// Message posted! ✅</p>
                </div>
              ) : (
                <>
                  {/* Invisible honeypot — bots fill this */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    style={{
                      position: "absolute",
                      left: "-9999px",
                      opacity: 0,
                      height: 0,
                      width: 0,
                    }}
                  />
                  <div className="flex gap-2">
                    <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="Say something Elon will read on his jet..." maxLength={500} rows={2} className="flex-1 resize-none border-2 border-black bg-white p-1.5 text-xs text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-spiteCrimson" />
                    <div className="flex flex-col gap-1.5">
                      <input value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="Nominate someone" maxLength={50} className="w-40 border-2 border-black bg-white px-2 py-1.5 text-[10px] text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-hypeNeon" />
                      <button type="submit" disabled={freeSubmitting || !freeText.trim() || (powStatus === "computing" && !user?.wallet_address)} className="cursor-pointer border-2 border-black bg-spiteCrimson px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-75 hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40">
                        {freeSubmitting ? "..." : "EXECUTE"}
                      </button>
                    </div>
                  </div>
                  {freeError && <p className="text-[10px] font-bold text-spiteCrimson">ERROR: {freeError}</p>}
                  <div className="flex items-center gap-2 text-[9px] text-chop-muted">
                    <span>{!user?.wallet_address ? (powStatus === "computing" ? "⏳ PoW..." : powStatus === "ready" ? "⚡ Ready" : "❌ PoW failed") : "✅ Wallet linked"}</span>
                    <span>|</span>
                    <span>🔥 1 $CHOP burned</span>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      )}

      {tab === "paid" && (
        <div className="min-h-[120px]">
        <form onSubmit={handlePaidSubmit} className="flex flex-col gap-2">
          {paidSuccess ? (
            <div className="flex h-[120px] items-center justify-center border-2 border-hypeNeon bg-hypeNeon/10">
              <p className="text-sm font-bold uppercase text-hypeNeon">// Paid message posted! 💎</p>
            </div>
          ) : (
            <>
              {/* Invisible honeypot — bots fill this */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  opacity: 0,
                  height: 0,
                  width: 0,
                }}
              />
              <div className="flex gap-2">
                <textarea value={paidText} onChange={(e) => setPaidText(e.target.value)} placeholder="Say something Elon will read on his jet..." maxLength={500} rows={2} className="flex-1 resize-none border-2 border-black bg-white p-1.5 text-xs text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-hypeNeon" />
                <div className="flex flex-col gap-1.5">
                  <input value={paidName} onChange={(e) => setPaidName(e.target.value)} placeholder="Name (or Anonymous Whale)" maxLength={50} className="w-40 border-2 border-black bg-white px-2 py-1.5 text-[10px] text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-spiteCrimson" />
                  <input value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="Nominate someone" maxLength={50} className="w-40 border-2 border-black bg-white px-2 py-1.5 text-[10px] text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-hypeNeon" />
                  <div className="relative">
                    <input value={paidAmount} onChange={(e) => setPaidAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" type="text" inputMode="decimal" className="w-40 border-2 border-black bg-white py-1.5 pl-7 pr-2 text-sm font-bold text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-hypeNeon" />
                    <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-chop-muted">$</span>
                  </div>
                  <button type="submit" disabled={paidSubmitting || !paidText.trim() || !paidAmount} className="cursor-pointer border-2 border-black bg-spiteCrimson py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-75 hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40">
                    {paidSubmitting ? "..." : publicKey ? `SEND ${paidAmount || "0"} CHOP` : "CONNECT WALLET"}
                  </button>
                </div>
              </div>
              {paidError && <p className="text-[10px] font-bold text-spiteCrimson">ERROR: {paidError}</p>}
              <div className="flex items-center gap-2 text-[9px] text-chop-muted">
                {publicKey && chopBalance !== null && (
                  <>
                    <span className={chopBalance > 0 ? "text-hypeNeon" : "text-spiteCrimson"}>
                      Balance: {chopBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} CHOP
                    </span>
                    <span>|</span>
                  </>
                )}
                {publicKey && chopBalanceError && <span className="text-spiteCrimson">⚠ RPC error</span>}
                <span>*No real-world utility</span>
              </div>
            </>
          )}
        </form>
        </div>
      )}
    </div>
  );
}
