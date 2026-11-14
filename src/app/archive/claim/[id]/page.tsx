import Link from "next/link";
import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { getLedgerEntry, ledgerRevisions } from "@/lib/archive-store";
import { slugify } from "@/lib/slug";
import { safeHref } from "@/lib/url";

export const dynamic = "force-dynamic";

type Params = { id: string };

const STATUS_LABEL: Record<string, string> = {
  accepted: "reviewed",
  legacy: "awaiting review",
  pending: "unreviewed",
  rejected: "withdrawn",
};

const OUTCOME_LABEL: Record<string, string> = {
  charged: "charged",
  convicted: "convicted",
  investigated: "investigated, no charge",
  settled: "settled",
  sanctioned: "sanctioned",
  no_action: "no action taken",
  blocked: "proceedings blocked",
  unknown: "no proceedings recorded",
};

const STATUS_LINE: Record<string, string> = {
  accepted: "An editor has checked this claim against its source.",
  legacy:
    "Filed before review existed. It still scores until an editor has read it.",
  pending:
    "Not yet reviewed. It is on the record and it does not score.",
  rejected:
    "Withdrawn from the score. It stays in the archive, because a correction you cannot read is not a correction.",
};

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const row = await getLedgerEntry(decodeURIComponent(id));
  if (!row) return { title: "No such claim" };
  return {
    title: `${row.person} — one claim on record`,
    description: row.act.slice(0, 160),
    alternates: { canonical: `/archive/claim/${encodeURIComponent(row.id)}` },
  };
}

export default async function ClaimPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const row = await getLedgerEntry(decodeURIComponent(id));
  if (!row) notFound();
  const revisions = await ledgerRevisions(row.id);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[860px] px-5 pb-24 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
          <Link href="/archive" className="hover:text-sheetWhite">
            the archive
          </Link>{" "}
          · one claim
        </p>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
          <Link
            href={`/person/${slugify(row.person)}`}
            className="text-[15px] font-black tracking-normal text-sheetWhite hover:text-spiteCrimson"
          >
            {row.person}
          </Link>
          <span>·</span>
          <span>{row.role || "role unknown"}</span>
          <span>·</span>
          <span>{row.place || "place unrecorded"}</span>
        </div>

        <p className="mt-4 max-w-2xl font-mono text-[10px] leading-relaxed text-chop-muted">
          This is conduct on the record, not a verdict. Evidence is graded A–D and
          the outcome of any proceedings is shown beside it; a claim can be
          well documented and never prosecuted, and that absence is recorded too.
        </p>

        <h1 className="mt-3 text-2xl font-bold leading-snug text-sheetWhite md:text-3xl">
          {row.act}
        </h1>
        {row.take ? (
          <div className="mt-4 border-l-2 border-hypeNeon/50 pl-3">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-chop-muted">
              Ada’s take
            </p>
            <p className="mt-1 max-w-3xl text-[14px] leading-snug text-sheetWhite/85">{row.take}</p>
          </div>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-chop-border py-5 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-[9px] uppercase tracking-[0.2em] text-chop-muted">status</dt>
            <dd className="mt-1 text-sheetWhite">
              {STATUS_LABEL[row.reviewStatus] ?? row.reviewStatus}
            </dd>
            <dd className="mt-1 text-[10px] leading-snug text-chop-muted">
              {STATUS_LINE[row.reviewStatus] ?? ""}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.2em] text-chop-muted">
              when it happened
            </dt>
            <dd className="mt-1 text-sheetWhite">
              {row.actDate ?? `${row.year} (year only)`}
            </dd>
            <dd className="mt-1 text-[10px] text-chop-muted">
              {row.datePrecision === "day"
                ? "dated to the day"
                : row.datePrecision === "month"
                  ? "dated to the month"
                  : row.datePrecision === "unknown"
                    ? "no conduct date established"
                    : "year only"}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.2em] text-chop-muted">category</dt>
            <dd className="mt-1 text-sheetWhite">{row.category || "unclassified"}</dd>
            <dd className="mt-1 text-[10px] text-chop-muted">
              attribution {row.attribution}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] uppercase tracking-[0.2em] text-chop-muted">evidence</dt>
            <dd className="mt-1 text-sheetWhite">
              grade {row.grade || "ungraded"} · {OUTCOME_LABEL[row.outcome] ?? row.outcome}
            </dd>
            <dd className="mt-1 text-[10px] leading-snug text-chop-muted">
              {row.gradeBasis || "no basis recorded"}
            </dd>
          </div>
        </dl>

        {row.evidenceQuote ? (
          <section className="mt-6">
            <h2 className="font-mono text-[9px] uppercase tracking-[0.25em] text-chop-muted">
              the passage it rests on{row.sourceLang ? ` · ${row.sourceLang}` : ""}
            </h2>
            <blockquote className="mt-2 border-l-2 border-hypeNeon/60 pl-4 text-[14px] leading-relaxed text-sheetWhite/90">
              {row.evidenceQuote}
            </blockquote>
          </section>
        ) : (
          <p className="mt-6 border-l-2 border-chop-border pl-4 font-mono text-[11px] leading-relaxed text-chop-muted">
            No supporting passage has been attached to this claim yet. That is
            not evidence of nothing; it is evidence not yet transcribed.
          </p>
        )}

        <section className="mt-8">
          <h2 className="font-mono text-[9px] uppercase tracking-[0.25em] text-chop-muted">
            sources
          </h2>
          {row.sources.length ? (
            <ul className="mt-2 space-y-1.5">
              {row.sources.map((url) => (
                <li key={url}>
                  <a
                    href={safeHref(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-mono text-[11px] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-spiteCrimson/90">no source attached</p>
          )}
        </section>

        {row.reviewNote && (
          <section className="mt-8">
            <h2 className="font-mono text-[9px] uppercase tracking-[0.25em] text-chop-muted">
              reviewer&rsquo;s note
            </h2>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-sheetWhite/80">
              {row.reviewNote}
            </p>
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-mono text-[9px] uppercase tracking-[0.25em] text-chop-muted">
            revisions
          </h2>
          {revisions.length ? (
            <ol className="mt-2 space-y-2 font-mono text-[11px]">
              {revisions.map((r, i) => (
                <li key={`${r.at}-${i}`} className="border-l-2 border-chop-border pl-3">
                  <span className="text-sheetWhite/80">
                    {r.from || "legacy"} → {r.to}
                  </span>
                  <span className="text-chop-muted"> · {r.reviewer} · {r.at.slice(0, 16)}</span>
                  {r.note && <p className="text-chop-muted">{r.note}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-chop-muted">
              no review decision recorded yet.
            </p>
          )}
        </section>

        <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
          claim id <span className="normal-case tracking-normal">{row.id}</span> · filed{" "}
          {row.createdAt.slice(0, 10)}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/person/${slugify(row.person)}`}
            className="border border-chop-border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted hover:text-sheetWhite"
          >
            every claim about {row.person.split(" ")[0]} →
          </Link>
          <Link
            href="/archive"
            className="border border-chop-border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted hover:text-sheetWhite"
          >
            the archive →
          </Link>
        </div>
      </main>
    </div>
  );
}
