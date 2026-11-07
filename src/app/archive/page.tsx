import { listArchive } from "@/lib/archive-store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The archive — alaguillotine",
  description: "Everything Ada has read. Nothing is deleted.",
};

export default async function ArchivePage() {
  const rows = await listArchive(200);

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
        the archive
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
        Everything <span className="text-spiteCrimson">she read.</span>
      </h1>
      <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
        Four-hour readings come and go. This does not. Every report Ada has ever
        scored stays here, newest first — the record behind the queue, kept even
        when the news has moved on.
      </p>

      <div className="mt-8 font-mono text-[9px] uppercase tracking-[0.25em] text-chop-muted">
        {rows.length} entries on record
      </div>

      <div className="mt-4 divide-y divide-chop-border border-y border-chop-border">
        {rows.length === 0 ? (
          <p className="py-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
            nothing archived yet — the machine is still reading
          </p>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="py-4">
              <div className="flex items-baseline gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                <span className="tabular-nums text-spiteCrimson">{Math.round(row.rage)}</span>
                <span>{row.source}</span>
                <span>·</span>
                <span>{new Date(row.lastSeen).toUTCString().slice(5, 16)}</span>
              </div>
              <h2 className="mt-1.5 text-[15px] font-bold leading-snug text-sheetWhite">
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-spiteCrimson"
                >
                  {row.headline}
                </a>
              </h2>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-chop-muted">
                {row.fact}
              </p>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
