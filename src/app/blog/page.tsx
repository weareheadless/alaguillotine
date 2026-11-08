import Link from "next/link";
import { listDispatches } from "@/lib/posts-store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispatches — alaguillotine",
  description: "Ada writes the week up. Same reading as the blade, longer temper.",
};

export default async function BlogIndex() {
  const posts = await listDispatches(30);

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
        dispatches
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase tracking-tighter text-sheetWhite md:text-6xl">
        Ada, <span className="text-spiteCrimson">in writing.</span>
      </h1>
      <p className="mt-4 max-w-xl font-mono text-[12px] leading-relaxed text-chop-muted">
        One dispatch per pass. The same numbers as the blade, with room to be
        angry about them.
      </p>

      {posts.length === 0 ? (
        <p className="mt-12 border border-dashed border-chop-border p-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
          no dispatches yet — the machine is still reading
        </p>
      ) : (
        <div className="mt-10 divide-y divide-chop-border border-y border-chop-border">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block px-1 py-6 transition-colors hover:bg-chop-card/60"
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                {new Date(post.publishedAt).toUTCString().slice(5, 16)}
              </div>
              <h2 className="mt-2 text-xl font-bold leading-snug text-sheetWhite">
                {post.title}
              </h2>
              <p className="mt-2 font-mono text-[12px] leading-relaxed text-chop-muted">
                {post.dek}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
