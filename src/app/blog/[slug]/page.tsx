import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { dispatchDescription, getDispatch } from "@/lib/posts-store";
import { dispatchStyle } from "@/lib/dispatch-style";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getDispatch(slug);
  if (!post) return { title: "Dispatch not found — A LA GUILLOTINE" };

  const description = dispatchDescription(post);
  const url = `https://alaguillotine.com/blog/${post.slug}`;
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
      publishedTime: post.publishedAt,
      siteName: "A LA GUILLOTINE",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

export default async function DispatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getDispatch(slug);
  if (!post) notFound();

  const s = dispatchStyle(post.category);
  const paragraphs = post.body.split(/\n{2,}/).filter(Boolean);
  const date = new Date(post.publishedAt).toUTCString().slice(5, 16);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
        <Link
          href="/blog"
          className="font-mono text-[10px] uppercase tracking-[0.25em] text-chop-muted hover:text-sheetWhite"
        >
          ← dispatches
        </Link>

        <div
          className="mt-6 flex items-center gap-2 border-2 border-black px-3 py-1.5"
          style={{ backgroundColor: s.accent, color: s.ink }}
        >
          <span
            className="h-2 w-2 shrink-0 animate-pulse"
            style={{ backgroundColor: s.ink }}
          />
          <span className="text-[9px] font-black uppercase tracking-[0.25em]">
            {s.label}
          </span>
          <span className="hidden text-[8px] uppercase tracking-[0.15em] opacity-70 sm:inline">
            {s.note}
          </span>
          <span className="ml-auto text-[8px] font-bold uppercase tracking-[0.15em] opacity-70">
            {date} · ada
          </span>
        </div>

        <h1 className="mt-5 text-3xl font-black uppercase leading-[0.95] tracking-tighter text-sheetWhite md:text-5xl">
          {post.title}
        </h1>
        <p
          className="mt-4 border-l-4 pl-4 font-mono text-[13px] leading-relaxed"
          style={{ borderColor: s.accent, color: s.body }}
        >
          {dispatchDescription(post)}
        </p>

        <article className="mt-10 space-y-5 text-[15px] leading-relaxed text-sheetWhite/90">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </article>

        <div className="mt-12 border-t-2 border-black pt-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: s.muted }}>
            filed under <span className="font-black">{s.label}</span> — {s.note}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link
              href="/blog"
              className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-sheetWhite hover:text-spiteCrimson"
            >
              ← all dispatches
            </Link>
            <Link
              href="/next-in-line"
              className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-sheetWhite hover:text-hypeNeon"
            >
              the line →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
