"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { NameSubmissionForm } from "./NameSubmissionForm";
import { TreasuryStats } from "./TreasuryStats";
import { CopyAddress } from "./CopyAddress";
import { CHOP_MINT, FUND_WALLET } from "@/lib/treasury";

/**
 * The two side panels: propose a name, and the fund.
 *
 * One button opens the same panel on every page, so the forum stays a forum
 * and the money stays one click away without taking up the page.
 */

type DrawerId = "propose" | "fund";

const DrawerContext = createContext<{
  open: DrawerId | null;
  show: (id: DrawerId) => void;
  hide: () => void;
}>({ open: null, show: () => {}, hide: () => {} });

export function useDrawer() {
  return useContext(DrawerContext);
}

export function DrawerButton({
  which,
  className,
  children,
}: {
  which: DrawerId;
  className?: string;
  children: React.ReactNode;
}) {
  const { show } = useDrawer();
  return (
    <button type="button" onClick={() => show(which)} className={className}>
      {children}
    </button>
  );
}

function syncUrl(id: DrawerId | null) {
  const url = new URL(window.location.href);
  url.searchParams.delete("propose");
  url.searchParams.delete("fund");
  if (id) url.searchParams.set(id, "1");
  window.history.replaceState(null, "", url);
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<DrawerId | null>(null);
  // Content mounts the first time a drawer opens, then stays mounted so the
  // form keeps its state and the balance does not refetch on every page.
  const [seen, setSeen] = useState<Set<DrawerId>>(new Set());

  const show = useCallback((id: DrawerId) => {
    setSeen((prev) => new Set(prev).add(id));
    setOpen(id);
    syncUrl(id);
  }, []);

  const hide = useCallback(() => {
    setOpen(null);
    syncUrl(null);
  }, []);

  // /resistance and shared links land with ?fund=1 or ?propose=1.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fund") === "1") {
      setSeen((prev) => new Set(prev).add("fund"));
      setOpen("fund");
    } else if (params.get("propose") === "1") {
      setSeen((prev) => new Set(prev).add("propose"));
      setOpen("propose");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, hide]);

  return (
    <DrawerContext.Provider value={{ open, show, hide }}>
      {children}

      <div
        className={`fixed inset-0 z-[90] transition-opacity duration-200 ${
          open ? "bg-black/70 backdrop-blur-sm" : "pointer-events-none opacity-0"
        }`}
        onClick={hide}
        aria-hidden="true"
      />

      <Panel
        id="propose"
        open={open === "propose"}
        onClose={hide}
        label="the front door"
        title="Propose a name."
      >
        {!seen.has("propose") ? null : (
        <>
        <p className="font-mono text-[11px] leading-relaxed text-chop-muted">
          Free, no account, no email. Ada reads every proposal and answers with
          a real reason — even when the reason is that they are not evil enough.
        </p>
        <div className="mt-5">
          <NameSubmissionForm compact />
        </div>
        </>
        )}
      </Panel>

      <Panel
        id="fund"
        open={open === "fund"}
        onClose={hide}
        label="the fund"
        title="The money."
      >
        {!seen.has("fund") ? null : (
        <>
        <p className="font-mono text-[11px] leading-relaxed text-chop-muted">
          Food, legal aid, medical care and shelter. The forum decides where it
          goes; this site can only read the wallet.
        </p>

        <div className="mt-4 border-2 border-black bg-sheetWhite/[0.03] p-4">
          <TreasuryStats wallet={FUND_WALLET} />
          <div className="mt-3">
            <CopyAddress address={FUND_WALLET} label="copy address" />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[9px] uppercase tracking-[0.12em]">
            <a
              href={`https://solscan.io/account/${FUND_WALLET}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-chop-muted underline decoration-chop-muted/40 hover:text-hypeNeon"
            >
              Solscan
            </a>
            <a
              href={`https://pump.fun/coin/${CHOP_MINT}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-chop-muted underline decoration-chop-muted/40 hover:text-hypeNeon"
            >
              buy $CHOP
            </a>
          </div>
          <p className="mt-3 border-t border-chop-border pt-2 font-mono text-[9px] leading-relaxed text-chop-muted">
            $CHOP is a meme, not a donation. It can go to zero. Send SOL to fund
            the work.
          </p>
        </div>

        <ol className="mt-4 space-y-2 font-mono text-[10px] leading-relaxed text-chop-muted">
          <li>
            <span className="font-bold text-sheetWhite">01 propose</span> — a
            named organisation, an amount, a receipt.
          </li>
          <li>
            <span className="font-bold text-sheetWhite">02 decide</span> — the
            forum argues it; a vote when there is money.
          </li>
          <li>
            <span className="font-bold text-sheetWhite">03 prove</span> — the
            wallet pays; the receipt goes in the thread.
          </li>
        </ol>

        <p className="mt-3 border-t border-chop-border pt-2 font-mono text-[9px] leading-relaxed text-chop-muted">
          Food, water, shelter, legal aid, medical aid. No weapons, no violence.
          No key on this site.
        </p>

        <Link
          href="/forum?c=the_fund"
          onClick={hide}
          className="mt-4 block border-2 border-black bg-spiteCrimson px-4 py-2.5 text-center font-mono text-[10px] font-black uppercase tracking-[0.15em] text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          Argue it in the forum →
        </Link>
        </>
        )}
      </Panel>
    </DrawerContext.Provider>
  );
}

function Panel({
  id,
  open,
  onClose,
  label,
  title,
  children,
}: {
  id: DrawerId;
  open: boolean;
  onClose: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      id={`drawer-${id}`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-hidden={!open}
      inert={!open}
      className={`fixed right-0 top-0 z-[91] flex h-full w-full max-w-[440px] flex-col border-l-2 border-chop-border bg-canvasBlack shadow-[-12px_0_40px_rgba(0,0,0,0.5)] transition-transform duration-200 ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b-2 border-chop-border px-5 py-4">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-spiteCrimson">
            {label}
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase leading-none tracking-tighter">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="border-2 border-chop-border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-chop-muted transition-colors hover:border-sheetWhite hover:text-sheetWhite"
        >
          close ×
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </aside>
  );
}