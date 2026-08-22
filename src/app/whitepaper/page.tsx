"use client";

import { Fragment } from "react";
import { NavBar } from "@/components/NavBar";
import { useSiteContent } from "@/lib/use-site-content";
import {
  type ManifestoBlock,
  type ManifestoBoxStyle,
  type ManifestoPart,
  type RoadmapStatus,
} from "@/lib/content";

const BOX_STYLES: Record<ManifestoBoxStyle, { box: string; headingColor: string }> = {
  red: {
    box: "rounded-lg border border-[#E11D48]/20 bg-[#E11D48]/5 p-5",
    headingColor: "text-[#E11D48]",
  },
  green: {
    box: "rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/5 p-5",
    headingColor: "text-[#22c55e]",
  },
  neutral: {
    box: "rounded-lg border border-[#343536] bg-[#343536]/50 p-5",
    headingColor: "text-[#D7DADC]",
  },
};

const ROADMAP_STATUS_STYLES: Record<RoadmapStatus, { status: string; statusColor: string; dotColor: string }> = {
  active: { status: "Active ✅", statusColor: "text-green-400", dotColor: "bg-green-400" },
  planned: { status: "Planned 🧠", statusColor: "text-[#D7DADC]", dotColor: "bg-[#D7DADC]" },
  final: { status: "Final 🎲", statusColor: "text-purple-400", dotColor: "bg-purple-400" },
};

export default function WhitepaperPage() {
  const { content } = useSiteContent();
  const m = content.manifesto;
  const titleWords = m.introTitle.split(" ");
  const firstProtocolSectionIndex = m.sections.findIndex((section) => section.part === "two");

  function renderBlock(block: ManifestoBlock, part: ManifestoPart, key: number) {
    switch (block.type) {
      case "paragraph":
        if (block.muted) {
          return (
            <p key={key} className="text-sm italic text-[#818384] leading-relaxed">
              {block.text}
            </p>
          );
        }
        return (
          <p
            key={key}
            className={part === "one" ? undefined : "text-[#D7DADC] leading-relaxed"}
          >
            {block.text}
          </p>
        );
      case "callout":
        return (
          <div key={key} className="rounded-lg border-l-4 border-[#E11D48] bg-[#E11D48]/5 p-5">
            <p className="text-xl font-semibold text-[#D7DADC]">{block.text}</p>
          </div>
        );
      case "box": {
        const { box, headingColor } = BOX_STYLES[block.style ?? "red"];
        if (!block.heading) {
          return (
            <div key={key} className={box}>
              <p className="text-base font-bold text-[#E11D48]">{block.text}</p>
            </div>
          );
        }
        return (
          <div key={key} className={box}>
            <p className={`text-sm font-semibold uppercase tracking-[0.15em] ${headingColor}`}>
              {block.heading}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[#D7DADC]">{block.text}</p>
          </div>
        );
      }
      case "itemBoxes":
        return (
          <div key={key} className="space-y-4 rounded-lg border border-[#343536] bg-[#343536]/50 p-6">
            {block.items.map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E11D48]/20 text-sm font-bold text-[#E11D48]">
                  {item.icon}
                </span>
                <div>
                  <p className="font-semibold text-[#D7DADC]">{item.heading}</p>
                  <p className="mt-1 text-sm text-[#818384]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        );
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] text-[#D7DADC]">
      {/* ─── Navigation ───────────────────────────────────────────────── */}
      <NavBar />

      {/* ─── Hero Header: THE MANIFESTO ─────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#343536]">
        <div className="absolute inset-0 grid-overlay opacity-40" />

        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          {/* Status badges */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E11D48]/30 bg-[#E11D48]/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#E11D48] animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E11D48]">
                {m.statusBadge}
              </span>
            </div>
          </div>

          <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            {titleWords.slice(0, -1).join(" ")}
            {titleWords.length > 1 ? " " : null}
            <span className="text-[#E11D48]">{titleWords[titleWords.length - 1]}</span>
          </h1>
          <p className="mt-4 max-w-3xl text-lg font-light italic leading-relaxed text-[#818384] sm:text-xl">
            {m.intro}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {m.cta.map((item, i) => (
              <a
                key={item.href}
                href={item.href}
                className={
                  i === 0
                    ? "inline-flex items-center gap-2 rounded-sm border-2 border-[#E11D48] bg-[#E11D48] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-[#E11D48]"
                    : "inline-flex items-center gap-2 rounded-sm border-2 border-[#343536] bg-[#343536]/50 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-[#D7DADC] transition-colors hover:border-[#E11D48] hover:text-[#E11D48]"
                }
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LEGAL DISCLAIMER ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-4 sm:px-6 lg:px-8">
        <div className="rounded-sm border-2 border-[#E11D48]/30 bg-[#E11D48]/5 p-6 font-mono text-sm leading-relaxed text-[#D7DADC]">
          <h2 className="mb-4 text-base font-bold text-[#E11D48] uppercase tracking-widest">
            {m.legalNotice.title}
          </h2>
          <p className="mb-4">
            This website is an interactive digital art installation, a work of political satire, and a brutal commentary on modern tech conglomerates.
          </p>
          <div className="space-y-4">
            {m.legalNotice.paragraphs.map((paragraph, i) => {
              const colonIndex = paragraph.indexOf(": ");
              if (colonIndex === -1) {
                return <p key={i}>{paragraph}</p>;
              }
              return (
                <p key={i}>
                  <strong className="text-white">{paragraph.slice(0, colonIndex)}:</strong>
                  {paragraph.slice(colonIndex + 1)}
                </p>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ PART I — THE MANIFESTO ═══════════════ */}
      <PartLabel
        id="manifesto"
        label={m.partOne.label}
        subtitle={m.partOne.subtitle}
      />

      {m.sections.map((section, i) => {
        const isFirstProtocolSection = i === firstProtocolSectionIndex;
        const body =
          section.part === "one" ? (
            <ManifestoSection key={section.id} id={section.id} title={section.title}>
              {section.blocks.map((block, j) => renderBlock(block, section.part, j))}
            </ManifestoSection>
          ) : (
            <Section key={section.id} id={section.id} title={section.title}>
              <div className="space-y-5">
                {section.blocks.map((block, j) => renderBlock(block, section.part, j))}
              </div>
            </Section>
          );
        return (
          <Fragment key={section.id}>
            {isFirstProtocolSection && (
              <PartLabel
                id="protocol"
                label={m.partTwo.label}
                subtitle={m.partTwo.subtitle}
              />
            )}
            {body}
            {section.id === "hype" && (
              <Section id="roadmap" title="12. Roadmap (The Experiment Unfolds)">
                <div className="relative">
                  <div className="absolute left-5 top-0 h-full w-px bg-gradient-to-b from-[#E11D48] via-[#E11D48]/30 to-transparent" />

                  {m.roadmap.map((phase, i) => {
                    const { status, statusColor, dotColor } = ROADMAP_STATUS_STYLES[phase.status];
                    return (
                      <TimelinePhase
                        key={phase.phase}
                        phase={phase.phase}
                        title={phase.title}
                        description={phase.description}
                        status={status}
                        statusColor={statusColor}
                        dotColor={dotColor}
                        isLast={i === m.roadmap.length - 1}
                      />
                    );
                  })}
                </div>
              </Section>
            )}
          </Fragment>
        );
      })}

      {/* ─── Closing Statement ─────────────────────────────────────────── */}
      <section className="border-b border-[#343536] py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-[#E11D48]/20 bg-gradient-to-b from-[#E11D48]/5 to-transparent p-8 text-center">
            <p className="text-base font-bold text-[#D7DADC]">
              {m.closing.declaration}
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#D7DADC]">
              $CHOP asks the only question that matters:{" "}
              <span className="italic text-[#D7DADC]">
                {m.closing.question}
              </span>
            </p>
            <p className="mt-4 text-lg font-bold text-[#E11D48]">
              {m.closing.tagline}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center">
        <p className="text-xs text-[#818384]">
          {m.footer.line}
        </p>
        <p className="mt-1 text-[10px] text-[#475569]">
          {m.footer.sub}
        </p>
      </footer>
    </div>
  );
}

/* ─── Reusable Section Wrapper ──────────────────────────────────────────────── */

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
    <section
      id={id}
      className="scroll-mt-16 border-b border-[#343536] py-16 sm:py-20"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-[#D7DADC] sm:text-3xl">
          {title}
        </h2>
        <div className="mt-2 mb-8 h-px w-16 bg-[#E11D48]/50" />
        {children}
      </div>
    </section>
  );
}

/* ─── Part Divider (e.g. PART I — THE MANIFESTO) ─────────────────────────────── */

function PartLabel({
  id,
  label,
  subtitle,
}: {
  id: string;
  label: string;
  subtitle?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 border-b border-[#343536] bg-[#E11D48]/[0.04] py-10 sm:py-12"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E11D48]">
          {label}
        </p>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#818384]">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}

/* ─── Manifesto Section (punchy, big type — Part I style) ────────────────────── */

function ManifestoSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 border-b border-[#343536] py-14 sm:py-16"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E11D48]">
          The Manifesto
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-[#D7DADC] sm:text-4xl">
          {title}
        </h2>
        <div className="mt-3 mb-8 h-1 w-16 bg-[#E11D48]" />
        <div className="space-y-6 text-lg leading-relaxed text-[#D7DADC]">
          {children}
        </div>
      </div>
    </section>
  );
}

/* ─── Timeline Phase Component ──────────────────────────────────────────────── */

function TimelinePhase({
  phase,
  title,
  description,
  status,
  statusColor,
  dotColor,
  isLast,
}: {
  phase: string;
  title: string;
  description: React.ReactNode;
  status: string;
  statusColor: string;
  dotColor: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-6 pb-12 last:pb-0">
      {/* Dot */}
      <div className="relative flex flex-col items-center">
        <div
          className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#343536] ${dotColor} shadow-[0_0_12px_rgba(220,38,38,0.15)]`}
        >
          <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        </div>
        {!isLast && <div className="absolute top-10 h-full w-px bg-[#343536]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#818384]">
            {phase}
          </span>
          <span className={`text-xs font-medium ${statusColor}`}>{status}</span>
        </div>
        <h3 className="mt-1 text-xl font-bold text-[#D7DADC]">{title}</h3>
        <p className="mt-2 text-sm text-[#818384] leading-relaxed max-w-2xl">
          {description}
        </p>
      </div>
    </div>
  );
}
