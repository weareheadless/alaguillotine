/**
 * A Periodic Transaction Report, read as rows.
 *
 * The PDF has no table markup. What it has is a repeating shape: an owner code,
 * one or more lines of asset name, an asset-type code, a transaction letter,
 * the transaction date, the notification date, and an amount band — in that
 * order, once per transaction. So the parser anchors on the only part of that
 * shape which cannot be confused with prose: a type letter followed by two
 * dates. Blocks are cut at the amount band that ends each one.
 *
 * Everything is kept verbatim. The quote stored with a trade is the exact run
 * of lines the values came from, so a reader can check the amount against the
 * filing rather than against our arithmetic. When a block does not fit the
 * shape it is skipped and counted — never repaired by guesswork.
 */

export interface PtrTransaction {
  owner: string;
  asset: string;
  ticker: string;
  assetType: string;
  /** P purchase, S sale, E exchange, G gift — the filing's own letter. */
  type: string;
  date: string;
  notified: string;
  amountLow: number | null;
  amountHigh: number | null;
  amountLabel: string;
  /** The exact lines this row was read from. */
  quote: string;
  /** 0-based line number in the document text. */
  line: number;
}

const TYPE_LINE = /^(P|S|E|G)(?:\s*\(partial\))?$/i;
const DATE_LINE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const OWNER_LINE = /^(SP|JT|DC|Self)$/i;
const ASSET_TYPE = /^\[[A-Z]{1,3}\]$/;
/** `$1,001 - $15,000`, possibly split over two lines. */
const AMOUNT_FULL = /^\$([\d,]+)\s*[-–—]\s*\$([\d,]+)$/;
const AMOUNT_OPEN = /^\$([\d,]+)\s*[-–—]$/;
const AMOUNT_CLOSE = /^\$([\d,]+)$/;

function iso(value: string): string {
  const match = DATE_LINE.exec(value.trim());
  if (!match) return "";
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function money(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** `Rollins, Inc. Common Stock (ROL)` → asset + ticker. */
function splitTicker(asset: string): { asset: string; ticker: string } {
  const match = /^(.*?)\s*\(([A-Z][A-Z0-9.\-]{0,9})\)$/.exec(asset);
  if (!match) return { asset, ticker: "" };
  return { asset: match[1].trim(), ticker: match[2] };
}

const NOISE =
  /^(ID|Owner|Asset|Transaction|Type|Date|Notification|Amount|Cap\.|Gains >|\$200\?|Name:|Status:|State\/District:|Member|Clerk of the House.*|F\s*I|P\s*T\s*R|Yes|No|[A-Z])$/;

export interface PtrFiler {
  /** The filer's name as the index prints it, to drop it from page chrome. */
  name?: string;
  /** `GA12` — also page chrome. */
  stateDst?: string;
}

const normalise = (line: string): string =>
  line.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();

/** An asset cell that has swallowed page furniture is not an asset name. */
function plausibleAsset(value: string): boolean {
  if (value.length < 3 || value.length > 160) return false;
  return !/( F S :| S O :|\$|Owner:| L :|>|CERTIFY|Digitally Signed)/i.test(value);
}

export function parsePtr(text: string, filer: PtrFiler = {}): PtrTransaction[] {
  return parsePtrWithStats(text, filer).rows;
}

export interface PtrParseResult {
  rows: PtrTransaction[];
  /** Blocks whose asset cell was page furniture rather than a name. */
  rejected: number;
}

export function parsePtrWithStats(text: string, filer: PtrFiler = {}): PtrParseResult {
  const lines = text.split("\n");
  const rows: PtrTransaction[] = [];
  let rejected = 0;

  // Lines that belong to the transaction being built, in document order.
  let buffer: Array<{ at: number; text: string }> = [];

  const chrome = (value: string): boolean => {
    if (!value) return true;
    if (NOISE.test(value)) return true;
    if (filer.name && value.includes(filer.name)) return true;
    if (/^Hon\.\s/.test(value)) return true;
    if (/^[A-Z]{2}\d{2}$/.test(value)) return true;
    if (filer.stateDst && value === filer.stateDst) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const value = normalise(lines[i]);

    // Page furniture sits between the previous amount and the next asset. It
    // belongs to neither transaction, so the buffer restarts at each boundary.
    if (
      /^(Gains >|\$200\?|Clerk of the House.*|P\s*T\s*R|Digitally Signed:.*|Yes|No|I\s*CERTIFY.*)$/.test(
        value,
      ) ||
      /^I CERTIFY/.test(value)
    ) {
      buffer = [];
      continue;
    }

    // An anchor: a transaction letter with a date on each of the next two
    // lines. It is the only part of the shape that prose cannot imitate.
    const type = TYPE_LINE.test(value) ? value.toUpperCase() : "";
    const date = type ? iso(normalise(lines[i + 1] ?? "")) : "";
    const notified = type ? iso(normalise(lines[i + 2] ?? "")) : "";

    if (type && date && notified) {
      let low: number | null = null;
      let high: number | null = null;
      let label = "";
      let end = -1;
      for (let j = i + 3; j < Math.min(i + 9, lines.length); j += 1) {
        const full = AMOUNT_FULL.exec(normalise(lines[j]));
        if (full) {
          low = money(full[1]);
          high = money(full[2]);
          label = `$${full[1]} - $${full[2]}`;
          end = j;
          break;
        }
        const open = AMOUNT_OPEN.exec(normalise(lines[j]));
        const close = AMOUNT_CLOSE.exec(normalise(lines[j + 1] ?? ""));
        if (open && close) {
          low = money(open[1]);
          high = money(close[1]);
          label = `$${open[1]} - $${close[1]}`;
          end = j + 1;
          break;
        }
      }

      if (end > 0 && buffer.length) {
        // `Filing Status: New` and `Schedule/Owner: …` print their header and
        // value above the row they belong to; both belong to this row, not the
        // asset.
        for (;;) {
          const head = buffer[0]?.text ?? "";
          if (buffer.length >= 2 && /^F\s*S\s*:$/.test(head)) {
            buffer.splice(0, 2);
            continue;
          }
          if (buffer.length >= 2 && /^S\s*O\s*:?$/.test(head)) {
            buffer.splice(0, 2);
            continue;
          }
          break;
        }

        // A schedule marker can be the value of the Schedule/Owner pair.
        while (buffer.length && /^SCH\d*$/.test(buffer[0].text)) buffer.shift();

        let owner = "";
        if (buffer.length && OWNER_LINE.test(buffer[0].text)) owner = buffer.shift()?.text ?? "";

        let assetType = "";
        if (buffer.length && ASSET_TYPE.test(buffer[buffer.length - 1].text)) {
          assetType = buffer.pop()?.text ?? "";
        }

        if (buffer.length) {
          const first = buffer[0];
          const { asset, ticker } = splitTicker(
            buffer.map((entry) => entry.text).join(" ").replace(/\s+/g, " ").trim(),
          );
          if (asset && plausibleAsset(asset)) {
            rows.push({
              owner,
              asset,
              ticker,
              assetType,
              type: type.replace(/\s*\(PARTIAL\)$/, ""),
              date,
              notified,
              amountLow: low,
              amountHigh: high,
              amountLabel: label,
              quote: lines
                .slice(first.at, end + 1)
                .map((line) => line.trim())
                .filter(Boolean)
                .join("\n"),
              line: first.at,
            });
          } else if (asset) {
            rejected += 1;
          }
        }
        buffer = [];
        i = end;
        continue;
      }

      // An anchor without an amount is not a transaction we can read. Drop it
      // and its dates so they cannot leak into the next asset name.
      i += 2;
      continue;
    }

    if (!chrome(value)) buffer.push({ at: i, text: value });
  }

  return { rows, rejected };
}

/** The sentence a stored trade produces. No adjective, no inference. */
export function transactionAct(row: PtrTransaction, filing: { docId: string; filed: string }): string {
  const verb = row.type.startsWith("P")
    ? "Bought"
    : row.type.startsWith("S")
      ? "Sold"
      : row.type.startsWith("E")
        ? "Exchanged"
        : "Reported a change in";
  const what = [row.asset, row.ticker ? `(${row.ticker})` : "", row.assetType]
    .filter(Boolean)
    .join(" ");
  return `${verb} ${what} — ${row.amountLabel} — periodic transaction report ${filing.docId}, filed ${filing.filed}.`;
}
