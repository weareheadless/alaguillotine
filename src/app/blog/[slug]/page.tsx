import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { dispatchDescription, dispatchDek, getDispatch, listDispatches } from "@/lib/posts-store";
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
  const editorial = post.editorial;
  const related = (await listDispatches(20)).filter(p => p.slug !== post.slug && p.category === post.category).slice(0, 2);
  const pullQuote = editorial?.pullQuote && post.body.includes(editorial.pullQuote) ? editorial.pullQuote : "";
  // A dispatch can be a document — a notice, a listing, a review — where
  // every line is a field. Treat any newline as a break so those forms keep
  // their shape instead of collapsing into one paragraph.
  const paragraphs = post.body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tight =
    paragraphs.length > 10 &&
    paragraphs.filter((line) => line.length < 140).length > paragraphs.length * 0.6;
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

        <h1 className="mt-7 text-4xl font-black leading-[1.02] tracking-tighter text-sheetWhite md:text-6xl">
          {post.title}
        </h1>
        <p
          className="mt-4 border-l-4 pl-4 font-mono text-[13px] leading-relaxed"
          style={{ borderColor: s.accent, color: s.bodyOnDark }}
        >
          {dispatchDek(post)}
        </p>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-chop-muted">
          Opinion & satire · Ada Guillotine · {Math.max(1, Math.ceil(post.body.split(/\s+/).length / 220))} min read
        </p>
        {editorial?.correction && <aside className="mt-6 border-2 border-spiteCrimson p-5 text-sm leading-relaxed">
          <h2 className="mb-2 font-mono text-xs font-black uppercase text-spiteCrimson">Correction · 11 November 2026</h2>
          {editorial.correction}
        </aside>}
        {editorial?.whatHappened && (
          <aside className="dispatch-grounding mt-8 border-y border-chop-border py-5">
            <h2 className="font-mono text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: s.accent }}>What happened</h2>
            <p className="mt-3 text-sm leading-relaxed text-sheetWhite/85">{editorial.whatHappened}</p>
            <a href="#reporting" className="mt-3 inline-block font-mono text-[10px] underline underline-offset-4">Read the supporting reporting ↓</a>
          </aside>
        )}

        <article
          className={
            tight
              ? "mt-10 space-y-2.5 border-l-2 border-chop-border pl-4 font-mono text-[13px] leading-relaxed text-sheetWhite/90"
              : "dispatch-prose mt-10 space-y-7 text-sheetWhite/90"
          }
        >
          {paragraphs.map((p, i) => {
            const section = /^\d+\.\s/.test(p);
            return (
              <div key={i}>
              <p
                className={
                  section
                    ? "pt-3 font-black uppercase tracking-[0.08em] text-sheetWhite"
                    : undefined
                }
              >
                {p}
              </p>
              {pullQuote && i === Math.floor(paragraphs.length / 2) - 1 && !p.includes(pullQuote) && (
                <blockquote className="dispatch-pullquote" style={{ borderColor: s.accent }}>
                  {pullQuote}
                </blockquote>
              )}
              </div>
            );
          })}
        </article>

        {editorial && (
          <section id="reporting" className="mt-12 scroll-mt-36 border-t border-chop-border pt-6">
            <h2 className="font-mono text-xs font-black uppercase tracking-widest">The reporting behind the opinion</h2>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-chop-muted">These extracts were read for this piece. They support the factual starting point; Ada’s conclusions are her own.</p>
            {editorial.sources.map((source, i) => (
              <details key={`${source.url}-${i}`} className="mt-4 border border-chop-border p-4">
                <summary className="cursor-pointer text-sm font-bold">{source.title}</summary>
                <blockquote className="mt-4 border-l-2 pl-4 text-sm leading-relaxed text-chop-muted">{source.quote}</blockquote>
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block font-mono text-[11px] underline">Open source ↗</a>
              </details>
            ))}
          </section>
        )}

        {related.length > 0 && (
          <aside className="mt-12 border-t border-chop-border pt-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-chop-muted">More on {s.label}</h2>
            {related.map(p => <Link key={p.slug} href={`/blog/${p.slug}`} className="mt-4 block text-lg font-black leading-snug hover:underline">{p.title} →</Link>)}
          </aside>
        )}

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
            <Link href="/feed" className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-sheetWhite hover:text-spiteCrimson">back to the feed →</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
