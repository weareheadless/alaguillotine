/**
 * The manifesto, audited against the engine.
 *
 * Ada's text is prose, and prose drifts. The manifesto on file still said the
 * counter was "the mean of the reports, shrunk toward neutral" and that "at
 * ninety, the blade falls" long after the mean, the shrinkage and the ninety
 * were deleted. Nobody noticed, because nobody checks prose.
 *
 * So the page checks it. Every number and rule the text claims is compared with
 * the constant the site actually runs on, at read time. A claim that is missing
 * is reported as missing rather than failed; a claim that contradicts the
 * engine is reported as a contradiction, in crimson, and the next refresh
 * rewrites the text whether or not a week has passed.
 *
 * The check is not clever. It is a list of sentences this site is willing to be
 * held to, matched against the paragraphs that make them. That is the point: a
 * manifesto that cannot be checked is just a mood.
 */
import {
  COOLDOWN_DAYS,
  EVIDENCE_WINDOW_DAYS,
  SCORE_SATURATION,
  SENTENCE_BAND,
} from "./evidence";

export type AuditState = "agrees" | "disagrees" | "unstated";

export interface AuditRow {
  id: string;
  /** Position in the audit, used as the margin marker. */
  n: number;
  /** What the rule is called, for the table. */
  clause: string;
  /** The claim as the text makes it, verbatim. Null when it makes none. */
  inText: string | null;
  /** What the running engine does, in the same unit. */
  inEngine: string;
  state: AuditState;
  /** Paragraph the claim sits in, so the page can pin a receipt to it. */
  paragraph: number | null;
  /** The exact words to underline there. */
  match: string | null;
  /** Offset of the match inside the paragraph. */
  at: number | null;
}

export interface ManifestoAudit {
  rows: AuditRow[];
  stated: number;
  agreeing: number;
  disagreeing: number;
  unstated: number;
  /** True when the text says something the engine no longer does. */
  contradicted: boolean;
}

export interface ManifestoFacts {
  receipts: number;
  receiptsWithSource: number;
}

const WORD_NUMBERS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function numberFrom(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  return WORD_NUMBERS[t] ?? null;
}

type Found = { raw: string; value: number | null; at: number };

interface Claim {
  id: string;
  clause: string;
  inEngine: string;
  /** The value the engine holds, for numeric claims. */
  value: number | null;
  find: (text: string) => Found | null;
  /**
   * A claim whose presence is the failure: the text asserting a fixed ninety
   * threshold, or a mean that was deleted with the old engine.
   */
  forbidden?: boolean;
}

const CLAIMS: Claim[] = [
  {
    id: "window",
    clause: "scoring window",
    inEngine: `${EVIDENCE_WINDOW_DAYS} days`,
    value: EVIDENCE_WINDOW_DAYS,
    find: (t) => {
      const m = /\b(\d{2,3})\s*(?:calendar\s+)?days?\b/i.exec(t);
      return m ? { raw: m[0], value: numberFrom(m[1]), at: m.index } : null;
    },
  },
  {
    id: "cooldown",
    clause: "chop cooldown",
    inEngine: `${COOLDOWN_DAYS} days`,
    value: COOLDOWN_DAYS,
    find: (t) => {
      const m =
        /\b(\d|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:calendar\s+)?days?\b/i.exec(
          t,
        );
      return m ? { raw: m[0], value: numberFrom(m[1]), at: m.index } : null;
    },
  },
  {
    id: "undated",
    clause: "undated act weight",
    inEngine: "half",
    value: 0.5,
    find: (t) => {
      const m = /\b(?:counts?|weighs?|scores?)\s+(?:as\s+)?(half|0\.5)\b/i.exec(t);
      return m ? { raw: m[0], value: 0.5, at: m.index } : null;
    },
  },
  {
    id: "band",
    clause: "sentence band",
    inEngine: `top ${SENTENCE_BAND}`,
    value: SENTENCE_BAND,
    find: (t) => {
      const m = /\b(?:top|first|best|worst|highest)\s+(\d{1,2}|ten|eleven|twelve)\b/i.exec(t);
      return m ? { raw: m[0], value: numberFrom(m[1]), at: m.index } : null;
    },
  },
  {
    id: "saturation",
    clause: "score saturation",
    inEngine: `saturating sum, ${SCORE_SATURATION}`,
    value: SCORE_SATURATION,
    find: (t) => {
      // "The score saturates" is the claim; a number within forty characters
      // of it is a claim about the constant, and has to be the right one.
      const m = /saturat\w*/i.exec(t);
      if (!m) return null;
      const near = t.slice(m.index, m.index + 44).match(/\d+(?:\.\d+)?/);
      return {
        raw: m[0],
        value: near ? Number(near[0]) : SCORE_SATURATION,
        at: m.index,
      };
    },
  },
  {
    id: "threshold",
    clause: "blade threshold",
    inEngine: "none — the worst name in the top twelve",
    value: null,
    forbidden: true,
    find: (t) => {
      const m = /\b(?:falls?\s+at|threshold\s+of|at)\s+(90|ninety)\b/i.exec(t);
      return m ? { raw: m[0], value: numberFrom(m[1]), at: m.index } : null;
    },
  },
  {
    id: "method",
    clause: "the arithmetic",
    inEngine: "weighted acts, summed and saturating",
    value: null,
    forbidden: true,
    find: (t) => {
      const m =
        /\b(?:mean\s+of\s+the\s+(?:reports?|articles?|scores?)|shrunk\s+toward\s+(?:neutral|the\s+mean)|regression\s+to\s+the\s+mean)\b/i.exec(
          t,
        );
      return m ? { raw: m[0], value: null, at: m.index } : null;
    },
  },
  {
    id: "naming",
    clause: "private names",
    inEngine: "refused at ingest",
    value: null,
    find: (t) => {
      const m =
        /\b(?:do\s+not|never|does\s+not)\s+name\s+(?:private\s+(?:people|citizens|individuals)|critics|investigators|victims)\b/i.exec(
          t,
        );
      return m ? { raw: m[0], value: null, at: m.index } : null;
    },
  },
  {
    id: "sources",
    clause: "a source on every charge",
    inEngine: "every charge links a source",
    value: null,
    find: (t) => {
      const m =
        /\b(?:every|each)\s+(?:claim|score|charge|entry|reason)\b[^.]{0,60}?\b(?:source|url|link)\b/i.exec(
          t,
        );
      return m ? { raw: m[0], value: null, at: m.index } : null;
    },
  },
];

export function auditManifesto(body: string, facts?: ManifestoFacts): ManifestoAudit {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const rows: AuditRow[] = CLAIMS.map((claim, index) => {
    let hitParagraph: number | null = null;
    let found: Found | null = null;

    for (let i = 0; i < paragraphs.length; i += 1) {
      const candidate = claim.find(paragraphs[i]);
      if (candidate) {
        hitParagraph = i;
        found = candidate;
        break;
      }
    }

    const inEngine =
      claim.id === "sources" && facts && facts.receipts > 0
        ? `${facts.receiptsWithSource.toLocaleString("en-US")} of ${facts.receipts.toLocaleString("en-US")} carry a link`
        : claim.inEngine;

    let state: AuditState;
    if (claim.forbidden) {
      // The absence of a deleted rule is a pass; its presence is the failure.
      state = found ? "disagrees" : "agrees";
    } else if (!found) {
      state = "unstated";
    } else if (claim.value !== null) {
      state = found.value === claim.value ? "agrees" : "disagrees";
    } else {
      state = "agrees";
    }

    return {
      id: claim.id,
      n: index + 1,
      clause: claim.clause,
      inText: found?.raw ?? null,
      inEngine,
      state,
      paragraph: hitParagraph,
      match: found?.raw ?? null,
      at: found?.at ?? null,
    };
  });

  const stated = rows.filter((r) => r.inText !== null).length;
  const agreeing = rows.filter((r) => r.state === "agrees").length;
  const disagreeing = rows.filter((r) => r.state === "disagrees").length;
  const unstated = rows.filter((r) => r.state === "unstated").length;

  return {
    rows,
    stated,
    agreeing,
    disagreeing,
    unstated,
    contradicted: disagreeing > 0,
  };
}
