"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";

/**
 * The manifesto, audited.
 *
 * The page used to be the one place on the site that asked to be believed. Ada
 * rewrote it every week, and nothing checked whether the text still described
 * the machine — which it did not: it was still promising a mean, a shrinkage
 * and a fixed ninety long after all three were deleted.
 *
 * So each claim is now matched against the constant that actually runs, on
 * every load. The prose keeps its rhythm; the margins carry receipts. A claim
 * the engine contradicts is shown in crimson, and the next refresh rewrites the
 * text whether or not a week has passed. What is left is a document that cannot
 * quietly outlive the thing it describes.
 */

interface AuditRow {
  id: string;
  n: number;
  clause: string;
  inText: string | null;
  inEngine: string;
  state: "agrees" | "disagrees" | "unstated";
  paragraph: number | null;
  match: string | null;
  at: number | null;
}

interface Audit {
  rows: AuditRow[];
  stated: number;
  agreeing: number;
  disagreeing: number;
  unstated: number;
  contradicted: boolean;
}

interface Standing {
  names: number;
  receipts: number;
  filedToday: number;
  chopped: number;
  cooling: number;
  sentence: { person: string; executeAt: string } | null;
  at: string;
}

interface Revision {
  id: number;
  createdAt: string;
}

interface Payload {
  body: string;
  updatedAt: string | null;
  fallback?: boolean;
  audit: Audit;
  standing: Standing | null;
  revisions: Revision[];
}

const stamp = (iso: string | null): string => {
  if (!iso) return "unversioned";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unversioned";
  return d
    .toUTCString()
    .slice(5, 16)
    .replace(/^0/, "")
    .toUpperCase();
};

const clock = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

/** Underline each claim the text makes, with its number in the margin. */
function markClaims(text: string, notes: AuditRow[]): ReactNode[] {
  const marks = notes
    .filter((n) => n.match && n.at !== null)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  const out: ReactNode[] = [];
  let cursor = 0;

  for (const note of marks) {
    const start = note.at ?? 0;
    const end = start + (note.match?.length ?? 0);
    if (start < cursor || end > text.length) continue;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <mark
        key={note.id}
        className={
          note.state === "disagrees"
            ? "bg-transparent text-spiteCrimson underline decoration-spiteCrimson decoration-2 underline-offset-4"
            : "bg-transparent text-sheetWhite underline decoration-hypeNeon/70 decoration-1 underline-offset-4"
        }
      >
        {text.slice(start, end)}
        <sup
          className={`ml-0.5 font-mono text-[8px] font-bold ${
            note.state === "disagrees" ? "text-spiteCrimson" : "text-hypeNeon"
          }`}
        >
          {note.n}
        </sup>
      </mark>,
    );
    cursor = end;
  }

  out.push(text.slice(cursor));
  return out;
}

/**
 * The claim numbers in the margin are per-load, so they are stable within a
 * page and meaningless outside it. They point at the table below, which is the
 * part that is meant to be read closely.
 */
function receiptsFor(notes: AuditRow[]) {
  return (
    <div className="flex flex-col gap-2">
      {notes.map((note) => (
        <div
          key={note.id}
          className={`border-l-2 pl-2 ${
            note.state === "disagrees" ? "border-spiteCrimson" : "border-hypeNeon/60"
          }`}
        >
          <div
            className={`font-mono text-[8px] font-bold uppercase tracking-[0.18em] ${
              note.state === "disagrees" ? "text-spiteCrimson" : "text-hypeNeon"
            }`}
          >
            {note.state === "disagrees" ? "✕" : "✓"} {note.clause}
          </div>
          <p className="mt-1 font-mono text-[9px] leading-relaxed text-chop-muted">
            text <span className="text-sheetWhite/80">{note.inText}</span> · engine{" "}
            <span className="text-sheetWhite/80">{note.inEngine}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

export default function ManifestoPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState<{
    id: number;
    body: string;
    createdAt: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/manifesto", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: Payload | null) => {
        if (cancelled) return;
        if (payload?.body) setData(payload);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Switching version changes the height of the page, so the old scroll
  // position lands wherever it can. Move to the top once the text is in.
  useEffect(() => {
    if (!viewing) return;
    const frame = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(frame);
  }, [viewing]);

  const openRevision = async (id: number) => {
    try {
      const res = await fetch(`/api/manifesto?rev=${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const rev = (await res.json()) as { body: string; updatedAt: string | null };
      setViewing({ id, body: rev.body, createdAt: rev.updatedAt });
    } catch {
      /* leave the current text in place */
    }
  };

  const body = viewing ? viewing.body : (data?.body ?? "");
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);

  const audit = data && !viewing ? data.audit : null;
  const notes = audit?.rows ?? [];
  const byParagraph = new Map<number, AuditRow[]>();
  for (const note of notes) {
    if (note.paragraph === null || !note.match) continue;
    const list = byParagraph.get(note.paragraph) ?? [];
    list.push(note);
    byParagraph.set(note.paragraph, list);
  }

  const agreeStated = notes.filter((n) => n.state === "agrees" && n.inText).length;
  const contradicts = (audit?.disagreeing ?? 0) > 0;
  const standing = data?.standing ?? null;

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-[1120px] px-5 pb-24 pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-chop-border pb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
            the manifesto
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
            {viewing ? `version ${viewing.id}` : `rev. ${stamp(data?.updatedAt ?? null)}`}
            {standing && !viewing ? ` · read ${clock(standing.at)} UTC` : ""}
          </p>
        </div>

        <h1 className="mt-5 max-w-3xl text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
          Ada, <span className="text-spiteCrimson">the ledger.</span>
        </h1>

        {viewing && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border border-chop-border bg-white/[0.03] px-3 py-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
              archived version · {stamp(viewing.createdAt) || "earlier"}
            </span>
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="ml-auto border border-chop-border px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-sheetWhite hover:border-spiteCrimson"
            >
              read the current text
            </button>
          </div>
        )}

        {failed && !data && (
          <p className="mt-10 border border-dashed border-chop-border p-8 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
            the manifesto is being rewritten
          </p>
        )}

        {/* The audit, before the prose: how much of this can be checked. */}
        {audit && (
          <section
            aria-label="Audit of the manifesto against the engine"
            className={`mt-8 border ${
              contradicts ? "border-spiteCrimson" : "border-chop-border"
            } bg-white/[0.02]`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-chop-border px-3 py-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  contradicts ? "bg-spiteCrimson" : "bg-hypeNeon"
                }`}
                aria-hidden
              />
              <h2
                className={`font-mono text-[9px] font-black uppercase tracking-[0.2em] ${
                  contradicts ? "text-spiteCrimson" : "text-hypeNeon"
                }`}
              >
                {contradicts
                  ? `${audit.disagreeing} claim${audit.disagreeing === 1 ? "" : "s"} contradict the engine`
                  : `${agreeStated} of ${audit.stated} stated claims agree with the engine`}
              </h2>
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-chop-muted sm:ml-auto">
                {audit.unstated} rule{audit.unstated === 1 ? "" : "s"} not stated · checked on load
              </span>
            </div>
            <p className="px-3 py-2 font-mono text-[9px] leading-relaxed text-chop-muted">
              {contradicts
                ? "This text describes a machine that no longer exists. It is rewritten at the next pass, whatever its age. The claims in dispute are underlined below and listed in the audit."
                : "Every rule this text claims is compared, on this load, with the constant the site actually runs on. A claim that drifts turns crimson and says so. Nothing here is quietly rewritten."}
            </p>
          </section>
        )}

        {/* The prose. Claims carry a number; the margin carries the receipt. */}
        <article className="mt-8">
          {paragraphs.map((paragraph, index) => {
            const paragraphNotes = byParagraph.get(index) ?? [];
            const lede = index === 0;
            return (
              <div
                key={index}
                className="border-t border-chop-border/60 py-5 first:border-t-0 xl:grid xl:grid-cols-[minmax(0,1fr)_230px] xl:gap-6"
              >
                <p
                  className={
                    lede
                      ? "text-[16px] leading-[1.7] text-sheetWhite md:text-[19px]"
                      : "text-[13.5px] leading-[1.8] text-sheetWhite/85 md:text-[15px] md:leading-[1.85]"
                  }
                >
                  {paragraphNotes.length > 0
                    ? markClaims(paragraph, paragraphNotes)
                    : paragraph}
                </p>
                {paragraphNotes.length > 0 && (
                  <div className="mt-3 xl:mt-1 xl:sticky xl:top-24">
                    {receiptsFor(paragraphNotes)}
                  </div>
                )}
              </div>
            );
          })}
        </article>

        {/* Standing: the half of the document that moves on its own. */}
        {standing && !viewing && (
          <section
            aria-label="The line as it stands"
            className="mt-10 border-l-2 border-spiteCrimson bg-white/[0.03] px-4 py-4"
          >
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-spiteCrimson">
              standing, as of this reading
            </p>
            <p className="mt-2 text-[15px] leading-[1.7] text-sheetWhite/90">
              The line holds{" "}
              <strong className="font-bold text-sheetWhite">{standing.names}</strong> names
              carrying{" "}
              <strong className="font-bold text-sheetWhite">
                {standing.receipts.toLocaleString("en-US")}
              </strong>{" "}
              receipts,{" "}
              <strong className="font-bold text-sheetWhite">{standing.filedToday}</strong> of
              them recording an act in the past day.{" "}
              <strong className="font-bold text-sheetWhite">{standing.chopped}</strong> names
              have been chopped;{" "}
              <strong className="font-bold text-sheetWhite">{standing.cooling}</strong> are
              still serving their three days.{" "}
              {standing.sentence ? (
                <>
                  <strong className="font-bold text-sheetWhite">
                    {standing.sentence.person}
                  </strong>{" "}
                  is under the blade until{" "}
                  {clock(standing.sentence.executeAt)} UTC.
                </>
              ) : (
                "No name is under the blade."
              )}
            </p>
            <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.14em] text-chop-muted">
              read from the tables, not written by a model ·{" "}
              <Link href="/next-in-line" className="underline hover:text-sheetWhite">
                the line
              </Link>
            </p>
          </section>
        )}

        {/* The table: the whole audit, including what the text leaves out. */}
        {audit && !viewing && (
          <section aria-label="The audit" className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-chop-border pb-2">
              <h2 className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-chop-muted">
                the audit
              </h2>
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-chop-muted">
                text vs. engine
              </p>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-chop-border">
                    {["clause", "in the text", "in the engine", "state"].map((h) => (
                      <th
                        key={h}
                        className="py-2 pr-3 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-chop-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.rows.map((row) => (
                    <tr key={row.id} className="border-b border-chop-border/60">
                      <td className="py-2 pr-3 font-mono text-[11px] text-sheetWhite/85">
                        {row.clause}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-sheetWhite/60">
                        {row.inText ?? "—"}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-sheetWhite/60">
                        {row.inEngine}
                      </td>
                      <td
                        className={`py-2 pr-3 font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${
                          row.state === "agrees"
                            ? "text-hypeNeon"
                            : row.state === "disagrees"
                              ? "text-spiteCrimson"
                              : "text-chop-muted"
                        }`}
                      >
                        {row.state === "disagrees"
                          ? "contradicts"
                          : row.state === "unstated"
                            ? "not stated"
                            : row.inText
                              ? "agrees"
                              : "no false claim"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-2xl font-mono text-[9px] leading-relaxed text-chop-muted">
              &ldquo;Not stated&rdquo; is not a failure. A manifesto is allowed to leave the
              arithmetic out; it is not allowed to get it wrong. Her next rewrite is asked to
              state the window, the cooldown, the band and the saturation, so the left column
              fills in on its own.
            </p>
          </section>
        )}

        {/* Versions. The document moves; this is where you see it move. */}
        {data && data.revisions.length > 0 && (
          <section aria-label="Earlier versions" className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-chop-border pb-2">
              <h2 className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-chop-muted">
                versions
              </h2>
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-chop-muted">
                every text she has published
              </p>
            </div>
            <ul className="mt-2 divide-y divide-chop-border/60">
              {data.revisions.map((rev) => {
                const isCurrent = !viewing && rev.id === data.revisions[0]?.id;
                return (
                  <li key={rev.id}>
                    <button
                      type="button"
                      onClick={() => openRevision(rev.id)}
                      className={`flex w-full items-center gap-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] hover:text-sheetWhite ${
                        viewing?.id === rev.id ? "text-spiteCrimson" : "text-chop-muted"
                      }`}
                    >
                      <span className="tabular-nums">{stamp(rev.createdAt)}</span>
                      <span className="text-chop-muted/60">v{rev.id}</span>
                      {isCurrent && (
                        <span className="ml-auto text-[8px] text-hypeNeon">current</span>
                      )}
                      {viewing?.id === rev.id && (
                        <span className="ml-auto text-[8px] text-spiteCrimson">reading</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="mt-10 border-t border-chop-border pt-4 font-mono text-[8px] leading-relaxed text-chop-muted/70">
          The blade is a metaphor. The arithmetic is not. If the text and the engine disagree,
          the engine is right and the text is rewritten.
        </p>
      </main>
    </div>
  );
}
