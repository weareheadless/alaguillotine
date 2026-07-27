"use client";

import { useState, useEffect } from "react";
import { account } from "../lib/appwrite";

export function AuthButtons() {
  const [user, setUser] = useState<{ $id: string; name: string; prefs?: Record<string, string> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Shared function to fetch user + prefs
  const fetchUser = async () => {
    try {
      const u = await account.get();
      const prefs = await account.getPrefs();
      setUser({
        $id: u.$id,
        name: (prefs.display_name as string) || u.name || "Anon",
        prefs: prefs as Record<string, string>,
      });
      return true;
    } catch {
      setUser(null);
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Check for existing session on mount — do NOT auto-create
    (async () => {
      await fetchUser();
      if (!cancelled) setLoading(false);
    })();

    // Listen for session changes from SubmitForm
    const handler = () => { if (!cancelled) { fetchUser(); setLoading(false); } };
    window.addEventListener("appwrite-session-ready", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("appwrite-session-ready", handler);
    };
  }, []);

  // Re-fetch when the tab becomes visible (in case session changed elsewhere)
  useEffect(() => {
    const handler = () => { if (!loading) fetchUser(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [loading]);

  const saveName = async (newName: string) => {
    const trimmed = newName.trim().slice(0, 30);
    if (!trimmed || !user) return;
    try {
      await account.updatePrefs({ ...user.prefs, display_name: trimmed });
      setUser({ ...user, name: trimmed, prefs: { ...user.prefs, display_name: trimmed } });
    } catch (err) {
      console.error("Failed to save name:", err);
    }
  };

  const handleNameClick = () => {
    if (!user) return;
    setNameDraft(user.name);
    setEditingName(true);
  };

  const handleNameSubmit = async () => {
    setEditingName(false);
    await saveName(nameDraft);
    // Notify SubmitForm that name changed
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("appwrite-session-ready"));
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNameSubmit();
    if (e.key === "Escape") setEditingName(false);
  };

  const handleLogin = async () => {
    setCreating(true);
    try {
      await account.createAnonymousSession();
      const u = await account.get();
      const prefs = await account.getPrefs();
      setUser({
        $id: u.$id,
        name: (prefs.display_name as string) || u.name || "Anon",
        prefs: prefs as Record<string, string>,
      });
    } catch (err) {
      console.error("Anonymous login failed:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
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
            className="w-28 border-2 border-spiteCrimson bg-canvasBlack px-2 py-1 text-sm text-sheetWhite outline-none"
            placeholder="Your name"
          />
        ) : (
          <button
            onClick={handleNameClick}
            className="group flex items-center gap-1 px-2 py-1 text-sm font-mono font-bold text-sheetWhite transition-colors hover:text-hypeNeon"
            title="Click to change your display name"
          >
            <span>{user.name}</span>
            <svg className="h-3 w-3 text-chop-muted opacity-0 transition-opacity group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="cursor-pointer border-2 border-glitchGray px-4 py-2 text-sm font-mono font-bold text-chop-muted transition-all hover:border-spiteCrimson hover:text-spiteCrimson active:translate-x-0.5 active:translate-y-0.5"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={creating}
      className="flex cursor-pointer items-center gap-2 border-2 border-black bg-spiteCrimson px-4 py-2 text-sm font-mono font-bold text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21a8 8 0 1 0-16 0" />
      </svg>
      {creating ? "Connecting..." : "Join Anonymously"}
    </button>
  );
}
