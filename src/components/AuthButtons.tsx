"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../lib/auth-context";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTerminal } from "../lib/terminal-context";
import bs58 from "bs58";

export function AuthButtons() {
  const { user, loading, login, register, loginWithWallet, logout, updateDisplayName } = useAuth();
  const { publicKey, signMessage, connected, wallets, select, connect } = useWallet();
  const { addMessage } = useTerminal();
  const [mode, setMode] = useState<"idle" | "form">("idle");
  const [isRegister, setIsRegister] = useState(false);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Ref to track pending wallet login (triggered by button, completed by useEffect)
  const walletLoginPending = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSubmitting) return;
    if (!formUsername.trim() || !formPassword) {
      setFormError("Username and password are required.");
      return;
    }
    setFormSubmitting(true);
    setFormError("");

    addMessage(`>_ INITIATING TRADITIONAL AUTHENTICATION...`, "text-hypeNeon", 10);

    const result = isRegister
      ? await register(formUsername.trim(), formPassword)
      : await login(formUsername.trim(), formPassword);

    setFormSubmitting(false);

    if (result.success) {
      addMessage(`[OK] ACCESS GRANTED FOR USER: ${formUsername.trim()}`, "text-hypeNeon", 10);
      setMode("idle");
      setFormUsername("");
      setFormPassword("");
    } else {
      addMessage(`[ERROR] AUTHENTICATION FAILED: ${result.error}`, "text-spiteCrimson", 10);
      setFormError(result.error || "Something went wrong.");
    }
  };

  const handleNameClick = () => {
    if (!user) return;
    setNameDraft(user.display_name);
    setEditingName(true);
  };

  const handleNameSubmit = async () => {
    const trimmed = nameDraft.trim().slice(0, 30);
    if (!trimmed) return;
    setEditingName(false);
    await updateDisplayName(trimmed);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNameSubmit();
    if (e.key === "Escape") setEditingName(false);
  };

  // ─── Wallet login logic ────────────────────────────────────────────────────

  const executeWalletLogin = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    try {
      addMessage(`>_ WALLET DETECTED: ${publicKey.toBase58()}`, "text-hypeNeon", 10);
      const challengeRes = await fetch("/api/auth/challenge", { method: "POST" });
      const { challenge } = await challengeRes.json();
      const message = `Login to FuckYouElon: ${challenge}`;

      addMessage(`>_ REQUESTING SECURE SIGNATURE...`, "text-hypeNeon", 20);
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);
      const signature = bs58.encode(signatureBytes);

      addMessage(`[OK] SIGNATURE VERIFIED: ${signature.substring(0, 16)}...`, "text-hypeNeon", 5);
      const result = await loginWithWallet(publicKey.toBase58(), signature, message);

      if (result.success) {
        addMessage(`[OK] WALLET AUTHENTICATED SUCCESSFULLY`, "text-hypeNeon", 10);
        setMode("idle");
        setFormUsername("");
        setFormPassword("");
      } else {
        addMessage(`[ERROR] WALLET AUTHENTICATION FAILED`, "text-spiteCrimson", 10);
        setFormError(result.error || "Wallet login failed.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Wallet login cancelled or failed.";
      addMessage(`[ERROR] ${msg.toUpperCase()}`, "text-spiteCrimson", 10);
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  }, [publicKey, signMessage, loginWithWallet, addMessage]);

  // When wallet connects after the user clicked "Login with Wallet",
  // automatically sign and login.
  useEffect(() => {
    if (!walletLoginPending.current) return;
    if (!connected || !publicKey || !signMessage) return;
    walletLoginPending.current = false;
    executeWalletLogin();
  }, [connected, publicKey, signMessage, executeWalletLogin]);

  const handleWalletLogin = async () => {
    if (formSubmitting) return;
    setFormSubmitting(true);
    setFormError("");

    // If already connected, sign and login directly
    if (connected && publicKey && signMessage) {
      await executeWalletLogin();
      return;
    }

    // Try to select Phantom first, then fall back to first available wallet
    walletLoginPending.current = true;
    const preferred = wallets.find(w => w.adapter.name === "Phantom") ?? wallets[0];
    if (preferred) {
      try {
        addMessage(`>_ INITIATING WALLET CONNECTION...`, "text-hypeNeon", 10);
        select(preferred.adapter.name);
        await connect();
        // Connection triggers the useEffect above → executeWalletLogin
      } catch {
        // User rejected or wallet not available
        addMessage(`[ERROR] WALLET CONNECTION REJECTED`, "text-spiteCrimson", 10);
        setFormError("Wallet connection failed. Make sure Phantom or Solflare is installed.");
        setFormSubmitting(false);
        walletLoginPending.current = false;
      }
    } else {
      addMessage(`[ERROR] NO SOLANA WALLET DETECTED`, "text-spiteCrimson", 10);
      setFormError("No Solana wallet detected. Install Phantom or Solflare.");
      setFormSubmitting(false);
      walletLoginPending.current = false;
    }
  };

  if (loading) {
    return (
      <div className="h-10 w-32 animate-pulse border-2 border-black bg-glitchGray" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {editingName ? (
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            maxLength={30}
            autoFocus
            className="w-24 md:w-28 border-2 border-spiteCrimson bg-canvasBlack px-2 py-1 text-sm text-sheetWhite outline-none"
            placeholder="Your name"
          />
        ) : (
          <button
            onClick={handleNameClick}
            className="group flex items-center gap-1 px-1 md:px-2 py-1 text-xs md:text-sm font-mono font-bold text-sheetWhite transition-colors hover:text-hypeNeon truncate max-w-[100px] md:max-w-[200px]"
            title="Click to change your display name"
          >
            <span className="truncate">{user.display_name || user.username}</span>
            <svg className="h-3 w-3 flex-shrink-0 text-chop-muted opacity-0 transition-opacity group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button
          onClick={async () => {
            addMessage(`>_ TERMINATING SECURE SESSION...`, "text-yellow-400", 15);
            await logout();
            addMessage(`[OK] SESSION DESTROYED`, "text-yellow-400", 10);
          }}
          className="cursor-pointer border-2 border-glitchGray px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-mono font-bold text-chop-muted transition-all hover:border-spiteCrimson hover:text-spiteCrimson active:translate-x-0.5 active:translate-y-0.5 flex-shrink-0"
        >
          Logout
        </button>
      </div>
    );
  }

  if (mode === "form") {
    return (
      <div className="relative">
        <form
          onSubmit={handleSubmit}
          className="absolute right-0 top-full mt-2 flex flex-col gap-2 border-2 border-black bg-sheetWhite p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-[240px] z-[100]"
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-spiteCrimson">
              {isRegister ? "// JOIN THE RESISTANCE" : "// LOGIN"}
            </p>
            <button 
              type="button" 
              onClick={() => setMode("idle")}
              className="text-black font-black text-xs hover:text-spiteCrimson"
            >
              X
            </button>
          </div>
          <input
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            placeholder="Username"
            maxLength={20}
            className="border-2 border-black px-2 py-1.5 text-xs text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-spiteCrimson"
            autoFocus
          />
          <input
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="border-2 border-black px-2 py-1.5 text-xs text-canvasBlack placeholder-chop-muted outline-none focus:ring-2 focus:ring-spiteCrimson"
          />
          {formError && (
            <p className="text-[10px] font-bold text-spiteCrimson">{formError}</p>
          )}
          <button
            type="submit"
            disabled={formSubmitting}
            className="cursor-pointer border-2 border-black bg-spiteCrimson px-3 py-1.5 text-xs font-bold uppercase text-sheetWhite shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40"
          >
            {formSubmitting
              ? "// SUBMITTING..."
              : isRegister
              ? "JOIN"
              : "LOGIN"}
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setFormError(""); }}
            className="text-[10px] text-chop-muted underline hover:text-spiteCrimson"
          >
            {isRegister ? "Already have an account? Log in" : "No account? Join"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-black/20" />
            <span className="text-[9px] font-bold text-chop-muted uppercase">or</span>
            <div className="flex-1 border-t border-black/20" />
          </div>

          {/* Wallet login button */}
          <button
            type="button"
            onClick={handleWalletLogin}
            disabled={formSubmitting}
            className="cursor-pointer border-2 border-black bg-canvasBlack px-3 py-2 text-xs font-bold uppercase text-hypeNeon shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-hypeNeon hover:text-canvasBlack active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
            {connected && publicKey
              ? `LOGIN AS ${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
              : "LOGIN WITH WALLET"}
          </button>
        </form>
      </div>
    );
  }

  // The resistance lives in the forum, not in a local account: the forum takes
  // no email, a human approves every signup, and one login works across every
  // thread and every fund proposal.
  return (
    <a
      href="https://forum.alaguillotine.com"
      target="_blank"
      rel="noreferrer noopener"
      className="flex cursor-pointer items-center gap-2 border-2 border-black bg-spiteCrimson px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-mono font-bold text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none"
    >
      <svg className="h-3 w-3 md:h-4 md:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21a8 8 0 1 0-16 0" />
      </svg>
      <span className="hidden md:inline">Join the Resistance</span>
      <span className="inline md:hidden">Join</span>
    </a>
  );
}
