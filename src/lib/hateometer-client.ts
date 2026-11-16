"use client";

import { useEffect, useSyncExternalStore } from "react";
import { emptyHate, type HateState } from "./hateometer";

/**
 * One reading per tab.
 *
 * The page and the announcement strip in the navbar both need the same
 * numbers, and both used to ask for them: two requests for a 300 KB payload on
 * every visit to the front page, each one running the same expensive query
 * behind it. The reading is global and identical for every reader, so it is
 * fetched once here and every component subscribes to that one result.
 *
 * A refresh is skipped when the last reading is still warm, and an in-flight
 * request is shared, so three components mounting together cost one call.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
const EMPTY = emptyHate();
let state: HateState = EMPTY;
let loadedAt = 0;
let inflight: Promise<HateState | null> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): HateState {
  return state;
}

function serverSnapshot(): HateState {
  return EMPTY;
}

/** How long a reading is treated as current before the next caller refreshes. */
const WARM_MS = 15_000;

export function pullHate(force = false): Promise<HateState | null> {
  if (inflight) return inflight;
  if (!force && loadedAt && Date.now() - loadedAt < WARM_MS) {
    return Promise.resolve(state);
  }

  inflight = (async () => {
    try {
      const res = await fetch("/api/hateometer", { cache: "no-store" });
      if (!res.ok) return null;
      const next = (await res.json()) as HateState;
      state = next;
      loadedAt = Date.now();
      emit();
      return next;
    } catch {
      /* keep the last good reading */
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function useHateometer(intervalMs = 90_000) {
  const reading = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  useEffect(() => {
    pullHate();
    const id = setInterval(() => pullHate(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { state: reading, pull: pullHate };
}

/* ── The strip's own reading ─────────────────────────────────────────────── */

/**
 * The announcement strip only needs the appointment: who is under the blade,
 * when it falls, and the short charge. Asking for the whole record to render
 * one line meant a 300 KB fetch on every page of the site, including the
 * archive and the person pages, which need none of it.
 *
 * `?lean=1` answers with the appointment alone. If the front page has already
 * fetched the full reading, this is not even called.
 */
let lean: HateState | null = null;
let leanAt = 0;
let leanInflight: Promise<HateState | null> | null = null;
const leanListeners = new Set<Listener>();

function emitLean(): void {
  for (const listener of leanListeners) listener();
}

function subscribeLean(listener: Listener): () => void {
  leanListeners.add(listener);
  return () => {
    leanListeners.delete(listener);
  };
}

function leanSnapshot(): HateState | null {
  return lean;
}

function leanServerSnapshot(): HateState | null {
  return null;
}

export function pullExecution(force = false): Promise<HateState | null> {
  if (leanInflight) return leanInflight;
  if (!force && leanAt && Date.now() - leanAt < WARM_MS) {
    return Promise.resolve(lean);
  }
  leanInflight = (async () => {
    try {
      const res = await fetch("/api/hateometer?lean=1", { cache: "no-store" });
      if (!res.ok) return null;
      lean = (await res.json()) as HateState;
      leanAt = Date.now();
      emitLean();
      return lean;
    } catch {
      return null;
    } finally {
      leanInflight = null;
    }
  })();
  return leanInflight;
}

export function useExecutionReading(intervalMs = 5 * 60 * 1000): HateState | null {
  const reading = useSyncExternalStore(subscribeLean, leanSnapshot, leanServerSnapshot);
  const full = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  useEffect(() => {
    // The front page already holds the appointment in its full reading; the
    // strip borrows it rather than paying for a second copy.
    if (full.execution) return;
    pullExecution();
    const id = setInterval(() => pullExecution(), intervalMs);
    return () => clearInterval(id);
  }, [full.execution, intervalMs]);

  return full.execution ? full : reading;
}
