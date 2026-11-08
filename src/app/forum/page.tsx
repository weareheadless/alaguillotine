import Link from "next/link";
import { NavBar } from "@/components/NavBar";

export const metadata = {
  title: "The Forum — A LA GUILLOTINE",
  description:
    "The open floor: no email, accounts approved by hand, and every fund proposal argued in public.",
};

const FORUM_ORIGIN = "https://forum.alaguillotine.com";

/** Only allow in-forum paths; never an absolute URL or a protocol-relative one. */
function safePath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value.slice(0, 300);
}

function forumUrl(path: string): string {
  // The forum detects the frame itself and drops its duplicate chrome there,
  // so plain URLs are enough and survive navigation inside the frame.
  return new URL(path, FORUM_ORIGIN).toString();
}

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[] }>;
}) {
  const params = await searchParams;
  const path = safePath(params.to);
  const src = forumUrl(path);
  const full = `${FORUM_ORIGIN}${path}`;

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <div className="border-b border-chop-border bg-canvasBlack">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-spiteCrimson">
              the forum
            </span>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted sm:inline">
              no email · accounts approved by hand · one person, one voice
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/resistance"
              className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-chop-muted hover:text-hypeNeon"
            >
              the fund →
            </Link>
            <a
              href={full}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-hypeNeon underline decoration-hypeNeon/40 hover:decoration-hypeNeon"
            >
              open full screen ↗
            </a>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1500px]">
        <iframe
          src={src}
          title="A LA GUILLOTINE forum"
          className="block h-[calc(100dvh-150px)] min-h-[600px] w-full border-0 bg-canvasBlack"
          allow="clipboard-write"
        />
      </main>
    </div>
  );
}