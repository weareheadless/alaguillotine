"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButtons } from "./AuthButtons";
import { getCurrentEpoch } from "../app/actions/epoch";

export function NavBar() {
  const pathname = usePathname();
  const isGuillotine = pathname === "/";
  const isLeaderboard = pathname === "/leaderboard";
  const isWhitepaper = pathname === "/whitepaper";
  const isTraitors = pathname === "/traitors";
  const isBenefactors = pathname === "/benefactors";
  const isGovernance = pathname === "/governance";
  const [epochNum, setEpochNum] = useState<number | null>(null);

  useEffect(() => {
    getCurrentEpoch().then((ep) => {
      if (ep) setEpochNum(ep.epoch_number);
    }).catch(() => {});
  }, []);

  const linkClass = (isActive: boolean) =>
    `rounded-sm border-2 px-2 py-1 md:px-3 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-all ${
      isActive
        ? "border-black bg-spiteCrimson text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        : "border-transparent text-chop-muted hover:text-sheetWhite"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b-4 border-black bg-canvasBlack/90 backdrop-blur-md">
      <div className="mx-auto flex flex-col md:flex-row md:min-h-16 items-start md:items-center justify-between px-4 md:px-6 py-2 md:py-2 gap-2 md:gap-3">
        {/* ─── Top Row (Mobile): Brand + Auth ──────────────────────────── */}
        <div className="flex w-full items-center justify-between md:w-auto">
          <Link href="/" className="flex items-center gap-2 md:gap-3">
            <span className="text-lg md:text-xl font-black uppercase tracking-tighter text-sheetWhite animate-glitch-text">
              <span className="text-spiteCrimson">FUCKYOU</span>ELON
            </span>
            <span className="hidden rounded-sm border-2 border-spiteCrimson bg-spiteCrimson/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-spiteCrimson sm:inline-block">
              $CHOP PROTOCOL
            </span>
          </Link>

          {/* Mobile Auth / Epoch */}
          <div className="flex items-center gap-2 md:hidden">
            {epochNum !== null && (
              <span className="rounded-sm border-2 border-hypeNeon bg-hypeNeon/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hypeNeon">
                E{epochNum}
              </span>
            )}
            <div className="scale-[0.85] origin-right">
              <AuthButtons />
            </div>
          </div>
        </div>

        {/* ─── Nav Links (wrap to 2 lines on desktop) ──────── */}
        <nav className="flex w-full md:w-auto items-center gap-1 flex-wrap pb-1 md:pb-0 scrollbar-hide md:ml-4 flex-1 md:justify-center">
          <Link href="/" className={linkClass(isGuillotine)}>
            The Town Square
          </Link>
          <Link href="/whitepaper" className={linkClass(isWhitepaper)}>
            The Manifesto
          </Link>
          <Link href="/traitors" className={linkClass(isTraitors)}>
            Class Traitors
          </Link>
          <Link href="/benefactors" className={linkClass(isBenefactors)}>
            Capital Defectors
          </Link>
          <Link href="/leaderboard" className={linkClass(isLeaderboard)}>
            Next in Line
          </Link>
          <Link href="/governance" className={linkClass(isGovernance)}>
            The Proxy War
          </Link>
        </nav>

        {/* ─── Right on Desktop: Epoch Counter + Auth ───────────────────── */}
        <div className="hidden md:flex items-center gap-3 ml-auto flex-shrink-0">
          {epochNum !== null && (
            <span className="rounded-sm border-2 border-hypeNeon bg-hypeNeon/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-hypeNeon">
              EPOCH {epochNum}
            </span>
          )}
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
