import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dispatchDescription, getDispatch } from "@/lib/posts-store";

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

  const paragraphs = post.body.split(/\n{2,}/).filter(Boolean);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
      <Link
        href="/blog"
        className="font-mono text-[10px] uppercase tracking-[0.25em] text-chop-muted hover:text-sheetWhite"
      >
        ← dispatches
      </Link>

      <h1 className="mt-6 text-3xl font-black uppercase leading-[0.95] tracking-tighter text-sheetWhite md:text-5xl">
        {post.title}
      </h1>
      <p className="mt-4 border-l-2 border-spiteCrimson pl-4 font-mono text-[13px] leading-relaxed text-chop-muted">
        {dispatchDescription(post)}
      </p>
      <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
        {new Date(post.publishedAt).toUTCString().slice(5, 16)} · ada
      </div>

      <article className="mt-10 space-y-5 text-[15px] leading-relaxed text-sheetWhite/90">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
    </main>
  );
}
