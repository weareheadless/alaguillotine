import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { ledgerFacets, listLedger } from "@/lib/archive-store";
import { slugify } from "@/lib/slug";
import { safeHref } from "@/lib/url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Archive — every receipt",
  description:
    "Every charge on record, by name, year and category: 5,000 receipts with the roll call, the report and the date.",
  alternates: { canonical: "/archive" },
  openGraph: {
    title: "The Archive — every receipt",
    description: "Every charge on record, by name, year and category.",
    url: "https://alaguillotine.com/archive",
    siteName: "A LA GUILLOTINE",
  },
};

type Params = { q?: string; year?: string | number; category?: string; page?: string | number };

const num = (n: number): string => n.toLocaleString("en-US");

const href = (base: Params, next: Params): string => {
  const params = new URLSearchParams();
  const merged = { ...base, ...next };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== null && String(v).length > 0) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `/archive?${qs}` : "/archive";
};

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const person = typeof params.q === "string" ? params.q : "";
  const year = Number(params.year) || 0;
  const category = typeof params.category === "string" ? params.category : "";
  const page = Math.max(1, Number(params.page) || 1);

  const [facets, result] = await Promise.all([
    ledgerFacets(),
    listLedger({ person, year, category, page, per: 40 }),
  ]);

  const base: Params = {
    q: person || undefined,
    year: year || undefined,
    category: category || undefined,
  };
  const filtered = Boolean(person || year || category);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[1100px] px-5 pb-24 pt-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
        the archive
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
        Every <span className="text-spiteCrimson">receipt.</span>
      </h1>
      <p className="mt-4 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
        The line is the last 180 days. This is everything: every charge ever
        filed, by name, year and category, with the roll call or the report it
        came from. Nothing here is deleted, and nothing here is scored by what
        you think of it.
      </p>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
        <span className="text-sheetWhite">{num(facets.total)} charges</span>
        <span>·</span>
        <span>{num(facets.people)} names</span>
        <span>·</span>
        <span>{num(facets.years.reduce((n, y) => n + y.n, 0))} dated</span>
        <Link href="/archive/readings" className="ml-auto underline hover:text-sheetWhite">
          the readings →
        </Link>
      </div>

      {/* Search and filters are links and a GET form: they work with the back
          button, they can be shared, and the page needs no JavaScript. */}
      <form action="/archive" method="get" className="mt-6 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={person}
          placeholder="name, or part of one"
          className="min-w-[220px] flex-1 border border-chop-border bg-transparent px-3 py-2 font-mono text-[12px] text-sheetWhite placeholder:text-chop-muted/60 focus:border-spiteCrimson focus:outline-none"
        />
        {year ? <input type="hidden" name="year" value={year} /> : null}
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button
          type="submit"
          className="border border-spiteCrimson bg-spiteCrimson px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white"
        >
          search
        </button>
        {filtered && (
          <Link
            href="/archive"
            className="border border-chop-border px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-chop-muted hover:text-sheetWhite"
          >
            clear
          </Link>
        )}
      </form>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {facets.years.slice(0, 8).map((y) => (
          <Link
            key={y.year}
            href={href(base, { year: year === y.year ? undefined : y.year, page: undefined })}
            className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
              year === y.year
                ? "border-spiteCrimson text-spiteCrimson"
                : "border-chop-border text-chop-muted hover:text-sheetWhite"
            }`}
          >
            {y.year} · {y.n}
          </Link>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {facets.categories.map((c) => (
          <Link
            key={c.category}
            href={href(base, {
              category: category === c.category ? undefined : c.category,
              page: undefined,
            })}
            className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
              category === c.category
                ? "border-hypeNeon text-hypeNeon"
                : "border-chop-border text-chop-muted hover:text-sheetWhite"
            }`}
          >
            {c.category} · {c.n}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex items-baseline justify-between border-b border-chop-border pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
        <span>
          {num(result.total)} {result.total === 1 ? "receipt" : "receipts"}
          {filtered ? " matching" : ""}
        </span>
        <span>
          page {result.page} of {result.pages}
        </span>
      </div>

      {result.rows.length === 0 ? (
        <p className="py-12 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
          nothing on record matches that
        </p>
      ) : (
        <ol className="divide-y divide-chop-border/70">
          {result.rows.map((row) => (
            <li key={row.id} className="py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                <Link
                  href={`/person/${slugify(row.person)}`}
                  className="text-[11px] font-bold tracking-normal text-sheetWhite hover:text-spiteCrimson"
                >
                  {row.person}
                </Link>
                <span>·</span>
                <span className="tabular-nums text-spiteCrimson">{Math.round(row.confidence)}</span>
                <span>{row.category}</span>
                <span>·</span>
                <span className="tabular-nums">{row.year}</span>
                {row.place ? (
                  <>
                    <span>·</span>
                    <span className="normal-case tracking-normal">{row.place}</span>
                  </>
                ) : null}
              </div>
              <p className="mt-1.5 text-[14px] leading-snug text-sheetWhite/90">{row.act}</p>
              {row.sources.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-3">
                  {row.sources.slice(0, 2).map((url) => (
                    <a
                      key={url}
                      href={safeHref(url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                    >
                      source ↗
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {result.pages > 1 && (
        <nav className="mt-8 flex items-center justify-between border-t border-chop-border pt-4 font-mono text-[9px] uppercase tracking-[0.2em]">
          {result.page > 1 ? (
            <Link
              href={href(base, { page: result.page - 1 })}
              className="border border-chop-border px-3 py-2 text-chop-muted hover:text-sheetWhite"
            >
              ← newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-chop-muted">
            {num((result.page - 1) * result.per + 1)}–
            {num(Math.min(result.total, result.page * result.per))} of {num(result.total)}
          </span>
          {result.page < result.pages ? (
            <Link
              href={href(base, { page: result.page + 1 })}
              className="border border-chop-border px-3 py-2 text-chop-muted hover:text-sheetWhite"
            >
              older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      </main>
    </div>
  );
}
