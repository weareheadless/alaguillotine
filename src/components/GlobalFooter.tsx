"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDrawer } from "./drawers";
import { FORUM_ENABLED } from "@/lib/constants";

const LINKS = [
  { href: "/", label: "The Blade" },
  { href: "/next-in-line", label: "Next in Line" },
  { href: "/whitepaper", label: "The Manifesto" },
  { href: "/blog", label: "Dispatches" },
];

export function GlobalFooter() {
  const pathname = usePathname();
  const { show } = useDrawer();
  if (pathname?.startsWith("/admin")) return null;
  const links = LINKS.filter((link) => FORUM_ENABLED || link.href !== "/forum");
  return (
    <footer className="border-t-4 border-black bg-[#0a0a0a] py-12 px-6 z-50 relative">
      <div className="mx-auto max-w-4xl font-mono text-xs text-[#818384] leading-relaxed">
        <nav className="mb-10 flex flex-wrap justify-center gap-x-6 gap-y-2 border-b border-white/10 pb-6 text-[10px] font-bold uppercase tracking-[0.15em]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "text-hypeNeon" : "text-chop-muted hover:text-sheetWhite"}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => show("fund")}
            className="text-hypeNeon hover:text-sheetWhite"
          >
            Buy $CHOP
          </button>
          <button
            type="button"
            onClick={() => show("fund")}
            className="text-chop-muted hover:text-sheetWhite"
          >
            The Fund
          </button>
          <button
            type="button"
            onClick={() => show("propose")}
            className="text-chop-muted hover:text-sheetWhite"
          >
            Submit a Name
          </button>
        </nav>
        <h3 className="mb-4 text-center text-[13px] font-bold text-spiteCrimson uppercase tracking-widest">
          NOTICE OF ARTISTIC SATIRE &amp; SYMBOLIC REPRESENTATION
        </h3>
        <p className="mb-6 text-center text-sm">
          This website is an interactive digital art installation, a work of political satire, and a satirical commentary on modern tech conglomerates.
        </p>
        <div className="space-y-4 rounded-sm border-2 border-spiteCrimson/20 bg-black p-6">
          <p>
            <strong className="text-sheetWhite">1. Public Figures as Symbols:</strong> Any reference to real individuals, names, or likenesses (including tech executives, billionaires) is used strictly as a <strong className="text-spiteCrimson">symbolic proxy for late-stage capitalism, systemic power structures, and corporate excess</strong>. These individuals are depicted not as private biological targets, but as archetypes of global economic friction (<em>ras-le-bol</em>).
          </p>
          <p>
            <strong className="text-sheetWhite">2. Metaphorical Imagery:</strong> The guillotine and associated mechanical animations are historical metaphors for revolutionary market corrections and the public critique of extreme wealth concentration. They are artistic expressions, not literal, physical, or real-world threats of violence. No physical harm is intended, encouraged, or implied.
          </p>
          <p>
            <strong className="text-sheetWhite">3. Zero Utility &amp; Speculation:</strong> The $CHOP token is a digital collectible with zero utility, no functional roadmap, and no expectation of profit derived from the managerial efforts of others. Buying this token is an explicit act of financial self-harm and internet participation.
          </p>
        </div>
      </div>
    </footer>
  );
}
