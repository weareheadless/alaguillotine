"use client";

import { FsdBanner } from "../components/FsdBanner";
import { AdPopups } from "../components/AdPopups";
import { NavBar } from "../components/NavBar";
import { RulesBanner } from "../components/RulesBanner";
import { ClockInstallation } from "../components/ClockInstallation";
import { SubliminalVideo } from "../components/SubliminalVideo";
import { useSiteContent } from "../lib/use-site-content";

export default function HomePage() {
  const { content } = useSiteContent();

  return (
    <div className="relative min-h-screen bg-canvasBlack">
      <FsdBanner />

      {/* ─── Atmospheric video, with the messages it was always meant to have ── */}
      <SubliminalVideo
        src="/static/musk_is_presented_with_the_reality.mp4"
        poster="/appwrite-icon.svg"
        messages={content.subliminalMessages}
      />

      <NavBar />

      <main className="relative z-10 pb-16 md:pb-8">
        <div className="mx-auto mt-8 max-w-5xl px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
            {content.hero.badge}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black uppercase leading-[0.95] tracking-tighter text-sheetWhite md:text-5xl">
            {content.hero.headline}
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[11px] leading-relaxed text-chop-muted md:text-sm">
            {content.hero.subheadline}
          </p>
        </div>

        <ClockInstallation />

        <div className="mx-auto mt-10 max-w-5xl px-6">
          <RulesBanner />
        </div>
      </main>

      <AdPopups />

      <footer className="relative z-10 border-t-4 border-black py-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-chop-muted">
          {content.footer}
        </p>
      </footer>
    </div>
  );
}
