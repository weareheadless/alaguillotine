"use client";

import { useState } from "react";

/** The fund address is meant to be copied, not admired. */
export function CopyAddress({
  address,
  label = "copy",
}: {
  address: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="break-all border-2 border-black bg-canvasBlack px-3 py-2 font-mono text-[11px] text-hypeNeon">
        {address}
      </code>
      <button
        type="button"
        onClick={copy}
        className="border-2 border-black bg-sheetWhite px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-canvasBlack shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        {copied ? "copied" : label}
      </button>
    </div>
  );
}