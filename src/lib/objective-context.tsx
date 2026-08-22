"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  normalizeObjectivesResponse,
  type ObjectiveAction,
  type ObjectivesSnapshot,
} from "./objectives";

export const OBJECTIVES_ENDPOINT = "/api/admin/proxy/objectives";

interface ObjectiveContextValue {
  snapshot: ObjectivesSnapshot | null;
  loading: boolean;
  error: string | null;
  busyAction: string | null;
  refresh: () => Promise<void>;
  act: (action: ObjectiveAction, objectiveId?: string, values?: Record<string, unknown>) => Promise<void>;
}

const ObjectiveContext = createContext<ObjectiveContextValue | null>(null);

export function ObjectiveProvider({ children, pollMs = 5000 }: { children: ReactNode; pollMs?: number }) {
  const [snapshot, setSnapshot] = useState<ObjectivesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(OBJECTIVES_ENDPOINT, { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
      }
      setSnapshot(normalizeObjectivesResponse(payload));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "failed to load objectives");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(interval);
  }, [pollMs, refresh]);

  const act = useCallback(
    async (action: ObjectiveAction, objectiveId?: string, values: Record<string, unknown> = {}) => {
      const key = `${action}:${objectiveId ?? "all"}`;
      setBusyAction(key);
      try {
        const response = await fetch(OBJECTIVES_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, action, ...(objectiveId ? { objective_id: objectiveId } : {}) }),
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => ({}));
        const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        if (!response.ok || body.ok === false) {
          throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
        }
        await refresh();
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "objective action failed";
        setError(message);
        throw caught;
      } finally {
        setBusyAction(null);
      }
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ snapshot, loading, error, busyAction, refresh, act }),
    [act, busyAction, error, loading, refresh, snapshot],
  );

  return <ObjectiveContext.Provider value={value}>{children}</ObjectiveContext.Provider>;
}

export function useObjectives(): ObjectiveContextValue {
  const value = useContext(ObjectiveContext);
  if (!value) throw new Error("useObjectives must be used inside ObjectiveProvider");
  return value;
}
