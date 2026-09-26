import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaceResult } from "../../../lib/race";

interface RaceResultPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RaceResultPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = getRaceResult(id);
  if (!result) {
    return { title: "Result not found — FUCKYOUELON" };
  }
  const { message, candidate } = result;
  const authorName = message.author_name || "Anonymous Spite";
  return {
    title: `${authorName} scored ${message.score}/5 on ${candidate} — FUCKYOUELON`,
    description: message.text.slice(0, 200),
    openGraph: {
      type: "article",
      url: `/race/${id}`,
      images: ["/og-image.png"],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RaceResultPage({ params }: RaceResultPageProps) {
  const { id } = await params;
  const result = getRaceResult(id);
  if (!result) notFound();

  const { message, race, side, candidate } = result;
  const authorName = message.author_name || "Anonymous Spite";
  const sideLabel = side === "a" ? "BOARD A" : "BOARD B";
  const sideTone =
    side === "a"
      ? { text: "text-spiteCrimson", border: "border-spiteCrimson" }
      : { text: "text-hypeNeon", border: "border-hypeNeon" };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12 font-mono">
      <article className="border-4 border-black bg-chop-card shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div
          className={`flex items-center justify-between gap-2 border-b-2 border-black px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${sideTone.text}`}
        >
          <span>// race result</span>
          <span className={`border px-2 py-0.5 ${sideTone.border}`}>{sideLabel}</span>
        </div>

        <div className="px-4 py-5">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-sheetWhite">
            {message.text}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-glitchGray pt-3 text-[10px] uppercase tracking-widest text-chop-muted">
            <span className="text-sheetWhite">{authorName}</span>
            <span className={`font-black ${sideTone.text}`}>scored {message.score}/5</span>
            <span>
              on <span className="text-sheetWhite">{candidate || "no candidate"}</span> · {sideLabel}
            </span>
          </div>

          {race?.status === "over" && (
            <p className="mt-3 border-l-2 border-spiteCrimson bg-spiteCrimson/10 px-3 py-2 text-[11px] uppercase tracking-wide text-spiteCrimson">
              ⚔️ {race.decapitated} lost their head — {race.survivor} holds the board.
            </p>
          )}
        </div>
      </article>

      <Link
        href="/"
        className="self-start text-[10px] font-bold uppercase tracking-widest text-chop-muted transition-colors hover:text-hypeNeon"
      >
        ← back to the guillotine
      </Link>
    </main>
  );
}
