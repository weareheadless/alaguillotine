import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { NameSubmissionForm } from "@/components/NameSubmissionForm";

export const metadata = {
  title: "Propose a name — A LA GUILLOTINE",
  description:
    "Free, no account, no email. Put a name on the record; Ada reads every proposal and answers with a real reason.",
};

export default function SubmitPage() {
  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
        <section className="border-b-4 border-spiteCrimson pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
            the front door
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-7xl">
            Put a name <span className="text-spiteCrimson">on the record.</span>
          </h1>
          <p className="mt-5 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
            The line is not a closed club. If the reporting holds someone
            responsible and the sources survive a reading, they can stand under
            a blade with their own counter. You do not need an account, an email,
            or a wallet.
          </p>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
          <section className="border-2 border-black bg-sheetWhite/[0.03] p-5 sm:p-7">
            <NameSubmissionForm />
          </section>

          <aside className="space-y-4">
            <div className="border-2 border-black bg-canvasBlack p-5">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-hypeNeon">
                what happens next
              </p>
              <ol className="mt-3 space-y-3 font-mono text-[11px] leading-relaxed text-chop-muted">
                <li>
                  <span className="font-bold text-sheetWhite">1.</span> Ada reads
                  the proposal against its sources. No automation decides this.
                </li>
                <li>
                  <span className="font-bold text-sheetWhite">2.</span> A human
                  approves the ones that hold up and writes the reason.
                </li>
                <li>
                  <span className="font-bold text-sheetWhite">3.</span> The name
                  enters the line with its own countdown. It keeps its own
                  counter.
                </li>
              </ol>
            </div>

            <div className="border-2 border-spiteCrimson bg-spiteCrimson/10 p-5">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-spiteCrimson">
                rejected?
              </p>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-chop-muted">
                You get a real reason. Sometimes the reason is that the record
                does not support it, and sometimes it is simply that they are{" "}
                <span className="text-sheetWhite">not evil enough</span> to make
                the wall. That is not an insult. It is the bar.
              </p>
            </div>

            <div className="border-2 border-black bg-canvasBlack p-5">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-chop-muted">
                the rules
              </p>
              <ul className="mt-3 space-y-2 font-mono text-[11px] leading-relaxed text-chop-muted">
                <li>Public figures only. No private people.</li>
                <li>At least one primary source. Two is better.</li>
                <li>No threats, no doxxing, no organising violence.</li>
                <li>The blade is a metaphor. The record has to be real.</li>
              </ul>
            </div>

            <Link
              href="/resistance"
              className="block border-2 border-black bg-hypeNeon px-4 py-3 text-center font-mono text-[10px] font-black uppercase tracking-[0.2em] text-canvasBlack shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-sheetWhite active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              The Fund →
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}