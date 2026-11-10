import type { PersonNumber } from "../lib/numbers";

/**
 * The numbers behind the name.
 *
 * A compact strip of the sourced figures that make the record concrete. Each
 * chip is the number, what it counts, and the year; the tooltip carries the
 * verbatim quote, and the person page carries the source link.
 */
export function PersonNumbers({
  numbers,
  limit = 3,
}: {
  numbers?: PersonNumber[];
  limit?: number;
}) {
  // One figure per kind: the record can hold several death tolls, but the
  // strip needs the one that best carries the charge.
  const seen = new Set<string>();
  const rows = (numbers ?? [])
    .filter((n) => {
      const key = n.kind === "other" ? `other:${n.label.toLowerCase()}` : n.kind;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
  if (!rows.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {rows.map((n) => (
        <span
          key={`${n.kind}-${n.label}`}
          title={n.evidenceQuote}
          className="inline-flex items-baseline gap-1.5 border border-chop-border/70 bg-black/20 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-chop-muted"
        >
          <span className="text-[11px] font-black tabular-nums text-spiteCrimson">
            {n.display}
          </span>
          <span>{n.label}</span>
          {n.year ? <span className="text-chop-muted/70">{n.year}</span> : null}
        </span>
      ))}
    </div>
  );
}
