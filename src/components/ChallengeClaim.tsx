"use client";

import { useState } from "react";

/**
 * The challenge button.
 *
 * A name on this site is a sentence from a newsroom. If that sentence is wrong
 * — the wrong person, the wrong fact, fabricated, or missing the context that
 * changes it — the reader has to be able to say so on the page where the claim
 * is made, without an account. The challenge is kept on record, and an upheld
 * challenge retracts the claim.
 */

const CATEGORIES = [
  { value: "wrong-person", label: "it names the wrong person" },
  { value: "wrong-fact", label: "a fact in it is wrong" },
  { value: "fabricated", label: "the reporting is fabricated" },
  { value: "missing-context", label: "it is missing context that changes it" },
  { value: "other", label: "something else" },
];

const FIELD =
  "w-full border-2 border-chop-border bg-canvasBlack px-2.5 py-2 font-mono text-[11px] text-sheetWhite outline-none transition-colors focus:border-hypeNeon";

export function ChallengeClaim({ claimId }: { claimId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("wrong-fact");
  const [detail, setDetail] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filed, setFiled] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claimId, category, detail, url }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "the challenge could not be filed");
      setFiled(String(data.id ?? ""));
      setOpen(false);
      setDetail("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "the challenge could not be filed");
    } finally {
      setBusy(false);
    }
  }

  if (filed) {
    return (
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-hypeNeon">
        challenge filed · {filed} · it is reviewed by hand; if the sentence does not hold it is
        retracted
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="font-mono text-[9px] uppercase tracking-[0.14em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
      >
        challenge this claim
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 w-full max-w-xl border border-chop-border bg-canvasBlack p-3 text-left"
    >
      <p className="font-mono text-[10px] leading-relaxed text-chop-muted">
        If this sentence is wrong, say how. A challenge is kept on record. If the sentence does not
        hold, the claim is retracted and leaves the page, the score and the archive.
      </p>

      <label className="mt-2 block font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
        what is wrong
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={`${FIELD} mt-1`}
        >
          {CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-2 block font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
        what happened, or what the record gets wrong
        <textarea
          required
          minLength={20}
          maxLength={2000}
          rows={3}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder="Name the sentence and the correction. A feeling is not a correction."
          className={`${FIELD} mt-1 resize-y normal-case tracking-normal`}
        />
      </label>

      <label className="mt-2 block font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted">
        link to the correction (optional)
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
          className={`${FIELD} mt-1 normal-case tracking-normal`}
        />
      </label>

      {error ? (
        <p role="alert" className="mt-2 font-mono text-[10px] text-spiteCrimson">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="border-2 border-black bg-spiteCrimson px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-sheetWhite disabled:opacity-60"
        >
          {busy ? "filing…" : "file the challenge"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[9px] uppercase tracking-[0.16em] text-chop-muted underline decoration-chop-border underline-offset-2 hover:text-sheetWhite"
        >
          cancel
        </button>
      </div>
    </form>
  );
}
