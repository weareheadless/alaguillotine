"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButtons } from "./AuthButtons";

export function NavBar() {
  const pathname = usePathname();
  const isWhitepaper = pathname === "/whitepaper";

  return (
    <header className="sticky top-0 z-50 border-b border-[#343536] bg-[#030303]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 items-center justify-between px-6">
        {/* ─── Left: Brand + Nav Links ──────────────────────────────────── */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-[#D7DADC]">
              <span className="text-[#FF4500]">FuckYou</span>Elon
            </span>
            <span className="hidden rounded-full border border-[#343536] px-2.5 py-1 text-[11px] text-[#666] sm:inline-block">
              Public Message Board
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                !isWhitepaper
                  ? "bg-[#1A1A1B] text-[#D7DADC]"
                  : "text-[#666] hover:text-[#D7DADC]"
              }`}
            >
              Guillotine
            </Link>
            <Link
              href="/whitepaper"
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                isWhitepaper
                  ? "bg-[#1A1A1B] text-[#D7DADC]"
                  : "text-[#666] hover:text-[#D7DADC]"
              }`}
            >
              Whitepaper
            </Link>
          </nav>
        </div>

        {/* ─── Right: Auth ──────────────────────────────────────────────── */}
        <AuthButtons />
      </div>
    </header>
  );
}
