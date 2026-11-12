"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  parseReservation,
  seatAlertDelay,
  seatAlertLabel,
  type SeatReservation,
} from "@/lib/seat-alert";

const STORAGE_KEY = "fye:seat-alert:v1";

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: SeatReservation | null): void {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode or storage disabled: the alert still works for this visit */
  }
}

/**
 * The booking stub.
 *
 * A seat reservation is a browser notification five minutes before the blade,
 * not a page navigation. The tab has to stay open, and the small print says so.
 */
export function ReserveSeat({
  at,
  name,
  slug,
}: {
  at: string;
  name: string;
  slug: string;
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [reserved, setReserved] = useState<SeatReservation | null>(null);
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supported = typeof Notification !== "undefined";
    const current = supported ? Notification.permission : "unsupported";
    setPermission(current);
    setReady(true);
    if (current === "denied") {
      setNote("Alerts are blocked in this browser’s settings.");
    } else if (current === "unsupported") {
      setNote("This browser cannot show notifications.");
    }

    const saved = parseReservation(readStorage());
    if (
      !saved ||
      saved.at !== at ||
      Date.parse(saved.at) <= Date.now() ||
      current !== "granted"
    ) {
      if (saved) writeStorage(null);
      setReserved(null);
      return;
    }
    setReserved(saved);
    setNote(`Alert set for ${seatAlertLabel(saved.at)}.`);
  }, [at]);

  useEffect(() => {
    if (!reserved || permission !== "granted") return;
    const delay = seatAlertDelay(reserved.at);
    if (delay === null) return;
    const timer = window.setTimeout(() => {
      try {
        new Notification("The blade falls in five minutes", {
          body: `${reserved.name} · ${seatAlertLabel(reserved.at)} sharp. Arrive early. Leave vertically.`,
          tag: `chop-${reserved.slug}`,
        });
        setNote("Alert sent. The blade is due in five minutes.");
      } catch {
        setNote("The browser refused the alert.");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [reserved, permission]);

  async function reserve(): Promise<void> {
    if (reserved) {
      writeStorage(null);
      setReserved(null);
      setNote("Alert cancelled.");
      return;
    }
    if (typeof Notification === "undefined") {
      setNote("This browser cannot show notifications.");
      return;
    }
    let current = Notification.permission;
    if (current === "default") current = await Notification.requestPermission();
    setPermission(current);
    if (current !== "granted") {
      setNote("Alerts are blocked in this browser’s settings.");
      return;
    }
    const next = { at, name, slug };
    writeStorage(next);
    setReserved(next);
    setNote(`Alert set for ${seatAlertLabel(at)}. Keep this tab open.`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={reserve}
        disabled={!ready}
        aria-pressed={Boolean(reserved)}
        className={`block w-full border-2 border-black px-3 py-3 text-center font-mono text-[11px] font-black uppercase tracking-widest transition-colors ${
          reserved
            ? "bg-sheetWhite text-canvasBlack hover:bg-black hover:text-sheetWhite"
            : "bg-canvasBlack text-hypeNeon hover:bg-spiteCrimson hover:text-sheetWhite"
        }`}
      >
        {reserved
          ? "Seat reserved ✓"
          : permission === "denied"
            ? "Alerts blocked"
            : permission === "unsupported"
              ? "Alerts unavailable"
              : "Reserve a seat"}
      </button>
      <p
        aria-live="polite"
        className="mt-2 min-h-[2.75rem] font-mono text-[8px] uppercase leading-relaxed tracking-[0.12em] text-black/70"
      >
        {note ||
          `Warns you five minutes before the blade · ${seatAlertLabel(at)}. Keep this tab open.`}
      </p>
      <Link
        href="/next-in-line"
        className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/60 underline underline-offset-2 hover:text-black"
      >
        See the full line ↗
      </Link>
    </div>
  );
}
