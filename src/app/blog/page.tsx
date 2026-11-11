import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { listDispatches, type Dispatch } from "@/lib/posts-store";
import {
  DISPATCH_CATEGORIES,
  dispatchStyle,
  dispatchTilt,
} from "@/lib/dispatch-style";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispatches — Ada, in writing",
  description:
    "The week's receipts, written long. Ada takes the same record that moves the blade and gives it room to be furious.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Dispatches — Ada, in writing",
    description:
      "The week's receipts, written long. Ada takes the same record that moves the blade and gives it room to be furious.",
    url: "https://alaguillotine.com/blog",
    siteName: "A LA GUILLOTINE",
  },
};

function DispatchCard({
  post,
  index,
  lead,
}: {
  post: Dispatch;
  index: number;
  lead: boolean;
}) {
  const s = dispatchStyle(post.category);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`dispatch-card group flex flex-col border-2 border-black ${
        lead ? "sm:col-span-2" : ""
      }`}
      style={
        {
          backgroundColor: s.card,
          boxShadow: `8px 8px 0 0 ${s.accent}`,
          "--tilt": dispatchTilt(index),
        } as React.CSSProperties
      }
    >
      <div
        className="flex items-center gap-2 border-b-2 border-black px-3 py-1.5"
        style={{ backgroundColor: s.accent, color: s.ink }}
      >
        <span
          className="h-2 w-2 shrink-0 animate-pulse"
          style={{ backgroundColor: s.ink }}
        />
        <span className="text-[9px] font-black uppercase tracking-[0.25em]">
          {s.label}
        </span>
        <span className="ml-auto text-[8px] font-bold uppercase tracking-[0.15em] opacity-70">
          {new Date(post.publishedAt).toUTCString().slice(5, 16)}
        </span>
      </div>

      <div className={`flex flex-1 flex-col p-4 ${lead ? "md:p-6" : "md:p-5"}`}>
        <h2
          className={`font-black uppercase leading-[1.0] tracking-[-0.03em] ${
            lead ? "text-2xl md:text-4xl" : "text-lg md:text-xl"
          }`}
          style={{ color: s.title }}
        >
          {post.title}
        </h2>
        <p
          className={`mt-2 flex-1 font-mono leading-relaxed ${
            lead ? "text-[13px]" : "text-[11px]"
          }`}
          style={{ color: s.body }}
        >
          {post.dek}
        </p>
        <span
          className="mt-4 font-mono text-[9px] font-black uppercase tracking-[0.25em]"
          style={{ color: s.solid ? s.title : s.accent }}
        >
          read the dispatch →
        </span>
      </div>
    </Link>
  );
}

export default async function BlogIndex() {
  const posts = await listDispatches(30);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
          dispatches
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase tracking-tighter text-sheetWhite md:text-6xl">
          Ada, <span className="text-spiteCrimson">in writing.</span>
        </h1>
        <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
          One argument per pass. The wire reports; Ada decides what it means.
          Each dispatch is filed under the mechanism it names — the colour is
          the charge, not the mood.
        </p>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {DISPATCH_CATEGORIES.map((c) => (
            <span
              key={c.key}
              className="border-2 border-black px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.18em]"
              style={{ backgroundColor: c.accent, color: c.ink }}
            >
              {c.label}
              <span className="ml-1 font-normal opacity-70">{c.note}</span>
            </span>
          ))}
        </div>

        {posts.length === 0 ? (
          <p className="mt-12 border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
            no dispatches yet — the machine is still reading
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {posts.map((post, i) => (
              <DispatchCard
                key={post.slug}
                post={post}
                index={i}
                lead={i === 0}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
