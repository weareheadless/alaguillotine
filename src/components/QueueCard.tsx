"use client";

import type { Figure } from "../lib/hateometer";

/**
 * One head, one blade.
 *
 * Every person in the queue has their own counter and their own blade. The blade
 * sits at that person's score: the shrunk mean of the harm reported in their
 * name this pass. Nothing is pooled, nothing is averaged across the queue.
 */

function MiniBlade({ score, dropped }: { score: number; dropped: boolean }) {
  const travel = dropped ? 46 : (Math.min(97, Math.max(3, score)) / 100) * 46;
  return (
    <svg viewBox="0 0 64 92" className="h-24 w-16 shrink-0" aria-hidden>
      <rect x="6" y="4" width="52" height="5" fill="#18181B" stroke="#27272A" />
      <rect x="8" y="4" width="4" height="84" fill="#141416" stroke="#27272A" />
      <rect x="52" y="4" width="4" height="84" fill="#141416" stroke="#27272A" />
      <line x1="32" y1="9" x2="32" y2={14 + travel} stroke="#3F3F46" strokeWidth="1" strokeDasharray="2 2" />
      <g
        className={dropped ? "blade-drop" : undefined}
        style={{
          transform: `translateY(${travel}px)`,
          transition: "transform 1.2s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <rect x="12" y="14" width="40" height="6" fill="#A1A1AA" />
        <path d="M12 20 L52 20 L32 29 Z" fill="#7F1D1D" />
        <line x1="12" y1="20" x2="52" y2="20" stroke="#F4F4F5" strokeWidth="1" opacity="0.8" />
      </g>
      <line x1="12" y1="66" x2="52" y2="66" stroke="#E11D48" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
    </svg>
  );
}

function Move({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="font-mono text-[9px] uppercase tracking-widest text-hypeNeon">new</span>;
  }
  if (delta === 0) return <span className="font-mono text-[9px] text-chop-muted">—</span>;
  const up = delta > 0;
  return (
    <span className={`font-mono text-[10px] tabular-nums ${up ? "text-spiteCrimson" : "text-hypeNeon"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

export function QueueCard({ figure }: { figure: Figure }) {
  const dropped = Boolean(figure.droppedAt);

  return (
    <article
      className={`group relative border bg-chop-card/40 transition-colors hover:bg-chop-card ${
        dropped ? "border-spiteCrimson/70 bg-spiteCrimson/[0.06]" : "border-chop-border"
      }`}
    >
      <div
        className="absolute left-0 top-0 h-full bg-spiteCrimson"
        style={{ width: dropped ? 4 : 2 }}
        aria-hidden
      />

      <div className="flex gap-4 p-4 md:gap-6 md:p-5">
        <MiniBlade score={figure.score} dropped={dropped} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] tabular-nums text-chop-muted">
                  {String(figure.rank).padStart(2, "0")}
                </span>
                <h3 className="text-[17px] font-black leading-tight text-sheetWhite md:text-xl">
                  {figure.name}
                </h3>
              </div>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                {figure.role}
                {figure.country ? ` · ${figure.country}` : ""}
              </p>
            </div>

            <div className="text-right">
              <div className="font-mono text-2xl font-black leading-none tabular-nums text-spiteCrimson md:text-3xl">
                {Math.round(figure.score)}
              </div>
              <div className="mt-1 flex items-center justify-end gap-2">
                {dropped ? (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-spiteCrimson">
                    dropped
                  </span>
                ) : (
                  <>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-chop-muted">
                      {figure.mentions} rep
                    </span>
                    <Move delta={figure.delta} />
                  </>
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 font-mono text-[11px] leading-relaxed text-chop-muted">
            {figure.reason}
          </p>

          {dropped && (
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em] text-spiteCrimson">
              blade fell {new Date(figure.droppedAt as string).toUTCString().slice(5, 16)} · counter frozen at{" "}
              {Math.round(figure.score)}
            </p>
          )}

          {figure.items.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-chop-border/60 pt-3">
              {figure.items.slice(0, 2).map((item, i) => (
                <li key={i} className="font-mono text-[10px] leading-relaxed text-chop-muted">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sheetWhite underline decoration-chop-border underline-offset-2 hover:decoration-spiteCrimson"
                  >
                    {item.headline}
                  </a>
                  <span className="block text-[10px] text-spiteCrimson/80">{item.quip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
