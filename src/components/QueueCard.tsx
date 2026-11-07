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
  const travel = dropped ? 58 : (Math.min(97, Math.max(3, score)) / 100) * 58;

  return (
    <svg viewBox="0 0 80 116" className="h-36 w-[104px] shrink-0 md:h-48 md:w-36" aria-hidden>
      <defs>
        <linearGradient id="miniSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4F4F5" />
          <stop offset="40%" stopColor="#D4D4D8" />
          <stop offset="60%" stopColor="#71717A" />
          <stop offset="100%" stopColor="#3F3F46" />
        </linearGradient>
      </defs>

      {/* glow behind the machine */}
      <ellipse cx="40" cy="52" rx="34" ry="50" fill="#E11D48" opacity="0.16" />

      {/* frame */}
      <rect x="4" y="3" width="72" height="8" fill="#3F3F46" stroke="#71717A" strokeWidth="1.2" />
      <rect x="5" y="3" width="8" height="108" fill="#27272A" stroke="#71717A" strokeWidth="1.2" />
      <rect x="67" y="3" width="8" height="108" fill="#27272A" stroke="#71717A" strokeWidth="1.2" />

      {/* rope */}
      <line
        x1="40"
        y1="10"
        x2="40"
        y2={18 + travel}
        stroke="#52525B"
        strokeWidth="1.2"
        strokeDasharray="2 2"
      />

      {/* blade */}
      <g
        className="mini-blade"
        style={{
          transform: `translateY(${travel}px)`,
          transition: "transform 1.2s cubic-bezier(.22,1,.36,1)",
        }}
      >
        <rect x="13" y="18" width="54" height="10" fill="url(#miniSteel)" />
        <path d="M13 28 L67 28 L40 42 Z" fill="#BE123C" />
        <path d="M13 28 L67 28 L40 42 Z" fill="url(#miniSteel)" opacity="0.45" />
        <line x1="13" y1="28" x2="67" y2="28" stroke="#FFFFFF" strokeWidth="1.8" />
        <line x1="13" y1="18" x2="67" y2="18" stroke="#E4E4E7" strokeWidth="0.8" opacity="0.8" />
      </g>

      {/* the line */}
      <line
        x1="13"
        y1="84"
        x2="67"
        y2="84"
        stroke="#E11D48"
        strokeWidth="1.5"
        strokeDasharray="5 3"
        opacity="0.65"
      />
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
