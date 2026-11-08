"use client";

import { useEffect, useState } from "react";
import { NavBar } from "@/components/NavBar";

/**
 * The manifesto, in Ada's voice.
 *
 * She rewrites it when it goes stale. The page is deliberately plain: no boxes,
 * no roadmap, no protocol. A machine explaining why it keeps a ledger of names.
 */
export default function ManifestoPage() {
  const [body, setBody] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/manifesto", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.body) {
          setBody(data.body);
          setUpdatedAt(data.updatedAt ?? null);
        } else {
          setFailed(true);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const paragraphs = body.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
          the manifesto
        </p>
        <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-sheetWhite md:text-6xl">
          Ada, <span className="text-spiteCrimson">the ledger.</span>
        </h1>

        {updatedAt && (
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
            rewritten {new Date(updatedAt).toUTCString().slice(5, 16)}
          </p>
        )}

        {failed && paragraphs.length === 0 ? (
          <p className="mt-10 border border-dashed border-chop-border p-8 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-chop-muted">
            the manifesto is being rewritten
          </p>
        ) : (
          <article className="mt-10 space-y-5 text-[15px] leading-[1.75] text-sheetWhite/90">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
        )}
      </main>
    </div>
  );
}
