"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButtons } from "./AuthButtons";
import { getCurrentEpoch } from "../app/actions/epoch";
import { useSiteContent } from "../lib/use-site-content";

export function NavBar() {
  const { content } = useSiteContent();
  const pathname = usePathname();
  const [epochNum, setEpochNum] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getCurrentEpoch().then((ep) => {
      if (ep) setEpochNum(ep.epoch_number);
    }).catch(() => {});
  }, []);

  // Close the portable menu whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close on Escape for keyboard users
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const linkClass = (active: boolean) =>
    `rounded-sm border-2 px-2 py-1 md:px-3 md:py-1.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-all ${
      active
        ? "border-black bg-spiteCrimson text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        : "border-transparent text-chop-muted hover:text-sheetWhite"
    }`;

  const mobileLinkClass = (active: boolean) =>
    `w-full rounded-sm border-2 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
      active
        ? "border-black bg-spiteCrimson text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
        : "border-transparent text-chop-muted hover:text-sheetWhite"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b-4 border-black bg-canvasBlack/90 backdrop-blur-md">
      <div className="mx-auto flex items-center justify-between gap-2 md:gap-3 px-4 md:px-6 py-2">
        {/* ─── Brand ─────────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <span className="text-lg md:text-xl font-black uppercase tracking-tighter text-sheetWhite animate-glitch-text">
            <span className="text-spiteCrimson">A LA</span> GUILLOTINE
          </span>
          <span className="hidden rounded-sm border-2 border-spiteCrimson bg-spiteCrimson/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-spiteCrimson sm:inline-block">
            $CHOP PROTOCOL
          </span>
        </Link>

        {/* ─── Nav Links (desktop, lg+) ─────────────────────────────── */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-1 ml-4">
          {content.nav.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(isActive(link.href))}>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ─── Right cluster: Epoch + Auth + Hamburger ────────────────── */}
        <div className="flex flex-shrink-0 items-center gap-2 md:gap-3">
          {epochNum !== null && (
            <>
              <span className="hidden lg:inline-block rounded-sm border-2 border-hypeNeon bg-hypeNeon/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-hypeNeon">
                EPOCH {epochNum}
              </span>
              <span className="lg:hidden rounded-sm border-2 border-hypeNeon bg-hypeNeon/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hypeNeon">
                E{epochNum}
              </span>
            </>
          )}

          {/* Desktop auth */}
          <div className="hidden lg:block">
            <AuthButtons />
          </div>
          {/* Portable auth */}
          <div className="lg:hidden scale-[0.85] origin-right">
            <AuthButtons />
          </div>

          {/* Sandwich menu (portable: phones + tablets) */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-sm border-2 border-black bg-spiteCrimson text-sheetWhite text-lg font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* ─── Portable dropdown menu (phones + tablets) ───────────────── */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          className="lg:hidden flex flex-col gap-2 border-t-2 border-black bg-canvasBlack/95 px-4 py-3 backdrop-blur-md"
        >
          {content.nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={mobileLinkClass(isActive(link.href))}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
