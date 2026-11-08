import Link from "next/link";
import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { getSubmissionByCode, submissionDb } from "@/lib/submissions";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-hypeNeon bg-hypeNeon/10 text-hypeNeon",
  approved: "border-[#3ddc84] bg-[#3ddc84]/10 text-[#3ddc84]",
  rejected: "border-spiteCrimson bg-spiteCrimson/10 text-spiteCrimson",
};

const STATUS_LINE: Record<string, string> = {
  pending: "Ada has not ruled on it yet.",
  approved: "It is in the line.",
  rejected: "It did not make the wall.",
};

export default async function SubmissionStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const database = await submissionDb();
  if (!database) notFound();

  const submission = await getSubmissionByCode(database, code);
  if (!submission) notFound();

  const slug = slugify(submission.name);
  const filed = new Date(submission.createdAt);
  const reviewed = submission.reviewedAt
    ? new Date(submission.reviewedAt)
    : null;

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <Link
          href="/submit"
          className="font-mono text-[10px] uppercase tracking-[0.25em] text-chop-muted hover:text-sheetWhite"
        >
          ← propose another
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span
            className={`border-2 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.2em] ${
              STATUS_STYLE[submission.status] ?? STATUS_STYLE.pending
            }`}
          >
            {submission.status}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
            receipt {submission.code}
          </span>
        </div>

        <h1 className="mt-4 text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-6xl">
          {submission.name}
        </h1>
        {(submission.role || submission.country) && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-chop-muted">
            {[submission.role, submission.country].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-8 border-2 border-black bg-sheetWhite p-5 text-canvasBlack shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-spiteCrimson">
            Ada&apos;s verdict
          </p>
          {submission.verdict ? (
            <p className="mt-3 whitespace-pre-wrap font-mono text-[12px] leading-relaxed">
              {submission.verdict}
            </p>
          ) : (
            <p className="mt-3 font-mono text-[12px] leading-relaxed text-black/60">
              {STATUS_LINE[submission.status] ?? STATUS_LINE.pending} No reason
              is written yet — that comes with the decision.
            </p>
          )}
        </div>

        <section className="mt-8 space-y-4">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-chop-muted">
              the charge you filed
            </p>
            <p className="mt-2 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-sheetWhite/85">
              {submission.acts}
            </p>
          </div>

          {submission.sources.length > 0 && (
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-chop-muted">
                sources
              </p>
              <ul className="mt-2 space-y-1">
                {submission.sources.map((source) => (
                  <li key={source}>
                    <a
                      href={source}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all font-mono text-[11px] text-hypeNeon underline decoration-hypeNeon/40 hover:decoration-hypeNeon"
                    >
                      {source}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {submission.why && (
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-chop-muted">
                why it matters
              </p>
              <p className="mt-2 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-chop-muted">
                {submission.why}
              </p>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t-2 border-black pt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
          filed {filed.toUTCString().slice(5, 16)}
          {reviewed ? ` · reviewed ${reviewed.toUTCString().slice(5, 16)}` : ""}
          {submission.status === "approved" && slug ? (
            <>
              {" · "}
              <Link href={`/person/${slug}`} className="text-hypeNeon hover:underline">
                open the ledger
              </Link>
            </>
          ) : null}
        </footer>
      </main>
    </div>
  );
}