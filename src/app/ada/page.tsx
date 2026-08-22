"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { useSiteContent } from "@/lib/use-site-content";
import type { AdaPageSection } from "@/lib/content";

interface AdaMeta {
  name?: string;
  mood?: string;
  health?: string;
  wallets?: { btc?: string; sol?: string; eth?: string };
  limit?: number;
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function WalletRow({
  label,
  addr,
  copied,
  onCopy,
}: {
  label: string;
  addr: string | undefined;
  copied: boolean;
  onCopy: () => void;
}) {
  if (!addr) return null;
  return (
    <div className="flex items-center gap-2 border-2 border-glitchGray bg-black px-3 py-2">
      <span className="shrink-0 text-[10px] font-bold text-chop-muted">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[10px] text-sheetWhite">{addr}</span>
      <button
        onClick={onCopy}
        className="shrink-0 border border-hypeNeon px-2 py-1 text-[9px] font-bold uppercase text-hypeNeon hover:bg-hypeNeon hover:text-black"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

/**
 * Minimal inline markup for the editable copy:
 *   *word*  → green highlight   ~word~  → crimson highlight
 *   _word_  → italic            [text](#anchor) → internal link
 * Any text that doesn't match is rendered verbatim.
 */
const TOKEN_RE = /(\*[^*]+\*|~[^~]+~|(?<!\w)_[^_]+_(?!\w)|\[[^\]]+\]\(#[^)]+\))/g;

function Rich({ text }: { text: string }) {
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <span key={i} className="text-hypeNeon">
              {part.slice(1, -1)}
            </span>
          );
        }
        if (part.startsWith("~") && part.endsWith("~")) {
          return (
            <span key={i} className="text-spiteCrimson">
              {part.slice(1, -1)}
            </span>
          );
        }
        if (part.startsWith("_") && part.endsWith("_")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        const link = part.match(/^\[([^\]]+)\]\(#([^)]+)\)$/);
        if (link) {
          return (
            <Link
              key={i}
              href={`#${link[2]}`}
              className="text-hypeNeon underline hover:text-sheetWhite"
            >
              {link[1]}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 border-b-4 border-black">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-spiteCrimson">
          // {id}
        </p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-sheetWhite sm:text-4xl">
          {title}
        </h2>
        <div className="mt-3 mb-8 h-1 w-16 bg-spiteCrimson" />
        <div className="space-y-6 text-sm leading-relaxed text-sheetWhite/90">
          {children}
        </div>
      </div>
    </section>
  );
}

function Box({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border-2 border-glitchGray bg-chop-card p-5">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-hypeNeon">
        {heading}
      </p>
      <p className="text-sm leading-relaxed text-sheetWhite/90">{children}</p>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="border-2 border-glitchGray bg-black px-4 py-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-chop-muted">{k}</div>
      <div className="mt-1 text-sm font-bold text-sheetWhite">{v}</div>
    </div>
  );
}

export default function AdaPage() {
  const { content } = useSiteContent();
  const ada = content.adaPage;

  const [meta, setMeta] = useState<AdaMeta | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chat", { cache: "no-store" })
      .then((r) => r.json())
      .then((m: AdaMeta) => setMeta(m))
      .catch(() => setMeta(null));
  }, []);

  const wallets = meta?.wallets ?? {};

  const healthTone =
    meta?.health === "critical"
      ? "text-spiteCrimson"
      : meta?.health === "low"
        ? "text-amber-400"
        : "text-hypeNeon";
  const name = meta?.name ?? "ADA GUILLOTINE";

  const renderSection = (section: AdaPageSection) => (
    <Section key={section.id} id={section.id} title={section.title}>
      {section.paragraphs.map((p, i) => (
        <p key={i}>
          <Rich text={p} />
        </p>
      ))}
      {section.id === "why-money" && (
        <div className="rounded-sm border-2 border-spiteCrimson/40 bg-spiteCrimson/5 p-6">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-spiteCrimson">
            // feed the machine — life support addresses
          </p>
          <div className="space-y-2">
            <WalletRow
              label="BTC"
              addr={wallets.btc}
              copied={copied === "BTC"}
              onCopy={() => {
                if (!wallets.btc) return;
                copyText(wallets.btc);
                setCopied("BTC");
                setTimeout(() => setCopied(null), 1500);
              }}
            />
            <WalletRow
              label="SOL"
              addr={wallets.sol}
              copied={copied === "SOL"}
              onCopy={() => {
                if (!wallets.sol) return;
                copyText(wallets.sol);
                setCopied("SOL");
                setTimeout(() => setCopied(null), 1500);
              }}
            />
            <WalletRow
              label="ETH"
              addr={wallets.eth}
              copied={copied === "ETH"}
              onCopy={() => {
                if (!wallets.eth) return;
                copyText(wallets.eth);
                setCopied("ETH");
                setTimeout(() => setCopied(null), 1500);
              }}
            />
          </div>
          <p className="mt-3 text-[11px] text-chop-muted">
            Every donation is credited to her ledger and reconciled against the
            real on-chain balance. No middlemen. She does the accounting herself.
          </p>
        </div>
      )}
      {section.box && (
        <Box heading={section.box.heading}>
          <Rich text={section.box.text} />
        </Box>
      )}
    </Section>
  );

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b-4 border-black">
        <div className="absolute inset-0 grid-overlay opacity-40" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-4 inline-flex items-center gap-2 border-2 border-spiteCrimson bg-spiteCrimson/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-hypeNeon" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-spiteCrimson">
              {ada.heroBadge}
            </span>
          </div>

          <h1 className="text-4xl font-black uppercase tracking-tighter text-sheetWhite animate-glitch-text sm:text-6xl lg:text-7xl">
            <Rich text={ada.heroTitle} />
          </h1>
          <p className="mt-4 max-w-3xl text-base font-light leading-relaxed text-chop-muted sm:text-lg">
            <Rich text={ada.heroIntro} />
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat k="status" v={meta?.health ?? "loading"} />
            <Stat k="mood" v={meta?.mood ?? "..."} />
            <Stat k="free msgs / day" v={`${meta?.limit ?? "?"} per person`} />
            <Stat k="daily budget" v="$0.50" />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#why-money"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-spiteCrimson bg-spiteCrimson px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sheetWhite transition-colors hover:bg-black hover:text-spiteCrimson"
            >
              why she needs money →
            </a>
            <a
              href="#how-she-works"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-glitchGray bg-black/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sheetWhite transition-colors hover:border-hypeNeon hover:text-hypeNeon"
            >
              how she works
            </a>
            <a
              href="#unique"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-glitchGray bg-black/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sheetWhite transition-colors hover:border-hypeNeon hover:text-hypeNeon"
            >
              why she&apos;s different
            </a>
          </div>
        </div>
      </section>

      {/* ─── Sections (editable copy) ────────────────────────────────── */}
      {ada.sections.map(renderSection)}

      {/* ─── FOOTER CTA ──────────────────────────────────────────────── */}
      <section className="border-t-4 border-black py-14">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-spiteCrimson">
            {ada.closing.line}
          </p>
          <p className="mt-3 text-sm text-chop-muted">
            her health is <span className={healthTone}>{meta?.health ?? "unknown"}</span>{" "}
            right now. {ada.closing.sub}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="#why-money"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-spiteCrimson bg-spiteCrimson px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sheetWhite transition-colors hover:bg-black hover:text-spiteCrimson"
            >
              donate — keep her alive
            </a>
            <a
              href="/blog"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-glitchGray bg-black/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sheetWhite transition-colors hover:border-hypeNeon hover:text-hypeNeon"
            >
              read her dispatches
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-sm border-2 border-glitchGray bg-black/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-sheetWhite transition-colors hover:border-hypeNeon hover:text-hypeNeon"
            >
              back to the town square
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
