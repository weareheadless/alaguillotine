"use client";

import { NavBar } from "@/components/NavBar";
import { Hateometer, useHateometer } from "@/components/Hateometer";
import { NextInLineBoard } from "@/components/NextInLineBoard";

export default function NextInLinePage() {
  const hate = useHateometer();

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-10">
        <section className="border-b-4 border-spiteCrimson pb-8">
          <p className="mb-3 inline-flex border border-hypeNeon/60 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-hypeNeon">
            rebuilt every 12 hours
          </p>
          <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-sheetWhite sm:text-7xl">
            Next <span className="text-spiteCrimson">in line.</span>
          </h1>
          <p className="mt-5 max-w-2xl font-mono text-sm leading-relaxed text-chop-muted">
            The clock counts. This page names. A machine reads the week&apos;s
            conflict and repression reporting, files it, and ranks the public
            officials the reporting keeps returning to — with the movement since
            the last pass, because a queue that never moves is a poster.
          </p>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Hateometer state={hate} />
          </div>

          <div>
            <NextInLineBoard figures={hate.figures} />

            <div className="mt-6 border-l-2 border-chop-border pl-4 font-mono text-[10px] leading-relaxed text-chop-muted">
              <p className="text-hypeNeon">// HOW TO READ THIS</p>
              <p className="mt-2">
                The score is not guilt, intent, or a legal finding. It is the
                shrunk mean of the harm rating of the reports that name the
                person, and the count is the number of separate reports doing the
                naming. Only public officials, commanders and arms executives who
                are named in the source text appear here; nothing is inferred.
                Every entry links to the report it came from. Movement is measured
                against the previous pass, not against a permanent baseline.
              </p>
              <p className="mt-2">
                If a name is wrong, the report is wrong. The source link is the
                appeal.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
