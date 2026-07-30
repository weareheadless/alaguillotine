"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  username: string;
  display_name: string;
  wallet_address: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithWallet: (address: string, signature: string, message: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  linkWallet: (address: string, signature: string, message: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  loginWithWallet: async () => ({ success: false }),
  logout: async () => {},
  updateDisplayName: async () => {},
  linkWallet: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  // Fetch current user on mount — exactly once
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      } catch {
        // Not logged in
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Login failed." };
    } catch {
      return { success: false, error: "Network error. Try again." };
    }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Registration failed." };
    } catch {
      return { success: false, error: "Network error. Try again." };
    }
  }, []);

  const loginWithWallet = useCallback(async (address: string, signature: string, message: string) => {
    try {
      const res = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: address, signature, message }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Wallet login failed." };
    } catch {
      return { success: false, error: "Network error. Try again." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch {
      // Still clear local state
      setUser(null);
    }
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: name }),
      });
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, display_name: name } : prev);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const linkWallet = useCallback(async (address: string, signature: string, message: string) => {
    try {
      const res = await fetch("/api/auth/wallet-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: address, signature, message }),
      });
      const data = await res.json();
      if (data.success) {
        setUser((prev) => prev ? { ...prev, wallet_address: address } : prev);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithWallet, logout, updateDisplayName, linkWallet }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
