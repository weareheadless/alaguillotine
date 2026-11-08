"use client";

import { useState } from "react";
import Link from "next/link";

const field =
  "w-full border-2 border-black bg-canvasBlack px-3 py-2 font-mono text-[12px] text-sheetWhite placeholder:text-chop-muted/60 outline-none transition-colors focus:border-hypeNeon";
const label =
  "mb-1 block font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-chop-muted";

export function NameSubmissionForm({ compact = false }: { compact?: boolean }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  const [acts, setActs] = useState("");
  const [sources, setSources] = useState("");
  const [why, setWhy] = useState("");
  const [submitter, setSubmitter] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const urls = sources
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          country,
          acts,
          sources: urls,
          why,
          submitter,
          website,
        }),
      });
      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "the queue rejected it. try again.");
        return;
      }
      setCode(data.code ?? "");
    } catch {
      setError("could not reach the queue. check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (code) {
    return (
      <div className="border-4 border-hypeNeon bg-hypeNeon/5 p-6">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-hypeNeon">
          received
        </p>
        <h2 className="mt-3 text-3xl font-black uppercase leading-none tracking-tighter text-sheetWhite">
          It is on the pile.
        </h2>
        <p className="mt-3 max-w-xl font-mono text-[12px] leading-relaxed text-chop-muted">
          Ada reads every proposal. If the record supports it, the name goes
          into the line with its own counter. If it does not, you get a real
          reason — sometimes just that they are not evil enough to make the
          wall.
        </p>
        <div className="mt-5 border-2 border-black bg-canvasBlack p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
            your receipt code
          </p>
          <p className="mt-1 select-all font-mono text-3xl font-black tracking-[0.2em] text-hypeNeon">
            {code}
          </p>
          <p className="mt-2 font-mono text-[10px] text-chop-muted">
            Write it down. It is the only way back to your proposal — there is
            no account and no email.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/submit/${code}`}
            className="border-2 border-black bg-spiteCrimson px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-sheetWhite shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            Track this proposal
          </Link>
          <button
            type="button"
            onClick={() => {
              setCode("");
              setName("");
              setRole("");
              setCountry("");
              setActs("");
              setSources("");
              setWhy("");
              setSubmitter("");
            }}
            className="border-2 border-glitchGray px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-chop-muted transition-colors hover:border-sheetWhite hover:text-sheetWhite"
          >
            Propose another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
        <div>
          <label htmlFor="name" className={label}>
            The name *
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="A public figure"
            maxLength={80}
            required
            className={field}
          />
        </div>
        {!compact && (
          <div>
            <label htmlFor="role" className={label}>
              What they do
            </label>
            <input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="CEO, minister, landlord, fund"
              maxLength={120}
              className={field}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="acts" className={label}>
          What they did *
        </label>
        <textarea
          id="acts"
          value={acts}
          onChange={(e) => setActs(e.target.value)}
          placeholder="One paragraph. What happened, who it hurt, and when. Specifics only — a feeling is not a charge."
          rows={compact ? 3 : 5}
          maxLength={2000}
          required
          className={`${field} resize-y`}
        />
        <p className="mt-1 text-right font-mono text-[9px] text-chop-muted">
          {acts.length}/2000
        </p>
      </div>

      <div>
        <label htmlFor="sources" className={label}>
          Sources * — one URL per line
        </label>
        <textarea
          id="sources"
          value={sources}
          onChange={(e) => setSources(e.target.value)}
          placeholder={
            compact
              ? "https://example.com/investigation"
              : "https://example.com/investigation\nhttps://example.com/court-filing"
          }
          rows={compact ? 2 : 3}
          required
          className={`${field} resize-y`}
        />
        <p className="mt-1 font-mono text-[9px] text-chop-muted">
          Court filings, official records, archived reporting. Not screenshots of
          a reply guy.
        </p>
      </div>

      {!compact && (
        <div>
          <label htmlFor="why" className={label}>
            Why it matters (optional)
          </label>
          <textarea
            id="why"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="The part the article buries."
            rows={2}
            maxLength={600}
            className={`${field} resize-y`}
          />
        </div>
      )}

      {/* Bots fill this in; humans never see it. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <p className="border-2 border-spiteCrimson bg-spiteCrimson/10 p-3 font-mono text-[11px] text-spiteCrimson">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="border-2 border-black bg-spiteCrimson px-6 py-3 font-mono text-[12px] font-black uppercase tracking-wider text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:opacity-50"
        >
          {busy ? "// filing..." : "File the charge"}
        </button>
        <p className="font-mono text-[9px] uppercase tracking-wider text-chop-muted">
          free · no account · no email · 2 a day
        </p>
        {compact && (
          <Link
            href="/submit"
            className="font-mono text-[9px] uppercase tracking-wider text-hypeNeon underline decoration-hypeNeon/40 hover:decoration-hypeNeon"
          >
            full form: role, country, more sources →
          </Link>
        )}
      </div>
    </form>
  );
}