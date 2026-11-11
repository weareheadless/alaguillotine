"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDrawer } from "./drawers";
import { useSiteContent } from "../lib/use-site-content";
import { FORUM_ENABLED } from "@/lib/constants";
import { ExecutionTicker } from "./ExecutionTicker";

export function NavBar() {
  const { content } = useSiteContent();
  const pathname = usePathname();
  const { show } = useDrawer();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = content.nav.filter((link) => FORUM_ENABLED || link.href !== "/forum");

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
    `whitespace-nowrap rounded-sm border-2 px-2 py-1 md:px-2 md:py-1.5 xl:px-3 text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-all ${
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
          <span className="hidden rounded-sm border-2 border-spiteCrimson bg-spiteCrimson/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-spiteCrimson xl:inline-block">
            $CHOP PROTOCOL
          </span>
        </Link>

        {/* ─── Nav Links (desktop, lg+) ─────────────────────────────── */}
        <nav className="hidden lg:flex flex-1 items-center justify-center gap-1 ml-4">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(isActive(link.href))}>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* ─── Right cluster: the fund, propose, hamburger ───────────── */}
        <div className="flex flex-shrink-0 items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => show("fund")}
              className="whitespace-nowrap border-2 border-hypeNeon/60 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-hypeNeon transition-colors hover:bg-hypeNeon hover:text-canvasBlack"
            >
              Buy $CHOP
            </button>
            <button
              type="button"
              onClick={() => show("fund")}
              className="whitespace-nowrap border-2 border-chop-border px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-chop-muted transition-colors hover:border-hypeNeon hover:text-hypeNeon"
            >
              The Fund
            </button>
            <button
              type="button"
              onClick={() => show("propose")}
              className="whitespace-nowrap border-2 border-black bg-spiteCrimson px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Propose a name
            </button>
          </div>

          <button
            type="button"
            onClick={() => show("propose")}
            className="border-2 border-black bg-spiteCrimson px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-sheetWhite shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none lg:hidden"
          >
            Propose
          </button>

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

      {/* The blade has a published time. It gets the breaking-news bar. */}
      <ExecutionTicker />

      {/* ─── Portable dropdown menu (phones + tablets) ───────────────── */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          className="lg:hidden flex flex-col gap-2 border-t-2 border-black bg-canvasBlack/95 px-4 py-3 backdrop-blur-md"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={mobileLinkClass(isActive(link.href))}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              show("fund");
            }}
            className={`${mobileLinkClass(false)} text-hypeNeon`}
          >
            Buy $CHOP
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              show("fund");
            }}
            className={mobileLinkClass(false)}
          >
            The Fund
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              show("propose");
            }}
            className={mobileLinkClass(false)}
          >
            Propose a name
          </button>
        </nav>
      )}
    </header>
  );
}
