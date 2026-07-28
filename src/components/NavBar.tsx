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
  const isBoard = pathname === "/board";
  const [epochNum, setEpochNum] = useState<number | null>(null);

  useEffect(() => {
    getCurrentEpoch().then((ep) => {
      if (ep) setEpochNum(ep.epoch_number);
    }).catch(() => {});
  }, []);

  const linkClass = (isActive: boolean) =>
    `rounded-sm border-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
      isActive
        ? "border-black bg-spiteCrimson text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        : "border-transparent text-chop-muted hover:text-sheetWhite"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b-4 border-black bg-canvasBlack/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 items-center justify-between px-6">
        {/* ─── Left: Brand + Nav Links ──────────────────────────────────── */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-xl font-black uppercase tracking-tighter text-sheetWhite animate-glitch-text">
              <span className="text-spiteCrimson">FUCKYOU</span>ELON
            </span>
            <span className="hidden rounded-sm border-2 border-spiteCrimson bg-spiteCrimson/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-spiteCrimson sm:inline-block">
              $CHOP PROTOCOL
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link href="/" className={linkClass(isGuillotine)}>
              The Town Square
            </Link>
            <Link href="/whitepaper" className={linkClass(isWhitepaper)}>
              The Manifesto
            </Link>
            <Link href="/traitors" className={linkClass(isTraitors)}>
              Class Traitors
            </Link>
            <Link href="/leaderboard" className={linkClass(isLeaderboard)}>
              Next in Line
            </Link>
            <Link href="/board" className={linkClass(isBoard)}>
              The Committee
            </Link>
          </nav>
        </div>

        {/* ─── Right: Epoch Counter + Auth ──────────────────────────────── */}
        <div className="flex items-center gap-4">
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
