/**
 * The dispatch palette.
 *
 * Every piece is filed under the mechanism it names, not the mood it was
 * written in. The colour is the file: red for extraction, yellow for the bill,
 * blue for impunity, purple for suppression, green for precarity. The blog
 * reads as a board of charges, not a list of dates.
 */

export type DispatchCategory =
  | "extraction"
  | "cost"
  | "impunity"
  | "suppression"
  | "precarity";

export interface DispatchStyle {
  key: DispatchCategory;
  label: string;
  note: string;
  /** Header strip and border. */
  accent: string;
  /** Text on the accent strip. */
  ink: string;
  /** Card background. */
  card: string;
  /** Title colour. */
  title: string;
  /** Body and dek colour. */
  body: string;
  /** Date and secondary text. */
  muted: string;
  /** Solid cards read like the yellow system ad, not a dark panel. */
  solid?: boolean;
}

export const DISPATCH_STYLES: Record<DispatchCategory, DispatchStyle> = {
  extraction: {
    key: "extraction",
    label: "extraction",
    note: "who took what",
    accent: "#E11D48",
    ink: "#0B0B0C",
    card: "#170609",
    title: "#F4F4F5",
    body: "#D4D4D8",
    muted: "#FDA4AF",
  },
  cost: {
    key: "cost",
    label: "the bill",
    note: "who pays for it",
    accent: "#FDE047",
    ink: "#0B0B0C",
    card: "#FDE047",
    title: "#0B0B0C",
    body: "#27272A",
    muted: "#52525B",
    solid: true,
  },
  impunity: {
    key: "impunity",
    label: "impunity",
    note: "who is never charged",
    accent: "#60A5FA",
    ink: "#0B0B0C",
    card: "#07101E",
    title: "#F4F4F5",
    body: "#D4D4D8",
    muted: "#93C5FD",
  },
  suppression: {
    key: "suppression",
    label: "suppression",
    note: "who is closing the exits",
    accent: "#C084FC",
    ink: "#0B0B0C",
    card: "#140A1E",
    title: "#F4F4F5",
    body: "#D4D4D8",
    muted: "#D8B4FE",
  },
  precarity: {
    key: "precarity",
    label: "precarity",
    note: "what is left of your life",
    accent: "#22C55E",
    ink: "#0B0B0C",
    card: "#07130B",
    title: "#F4F4F5",
    body: "#D4D4D8",
    muted: "#86EFAC",
  },
};

export const DISPATCH_CATEGORIES = Object.values(DISPATCH_STYLES);

const CATEGORY_SET = new Set<string>(DISPATCH_CATEGORIES.map((c) => c.key));

export function isDispatchCategory(value: unknown): value is DispatchCategory {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

/** Unknown or missing categories are filed as extraction, not thrown away. */
export function normaliseCategory(value: unknown): DispatchCategory {
  return isDispatchCategory(value) ? value : "extraction";
}

export function dispatchStyle(value: unknown): DispatchStyle {
  return DISPATCH_STYLES[normaliseCategory(value)];
}

/** The card's tilt, alternating so the board looks pinned, not printed. */
export function dispatchTilt(index: number): string {
  return index % 2 === 0 ? "-0.35deg" : "0.35deg";
}
