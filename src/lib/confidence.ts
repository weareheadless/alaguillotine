/**
 * Confidence, as arithmetic rather than taste.
 *
 * The archive records what a source claims and how strong the claim is. It does
 * not decide whether the person is guilty: the viewer does that, with the claim,
 * the quote, the outlet and this number in front of them. So the number has to
 * be something they can check, not a mood somebody assigned.
 *
 * Government registers are one class of source, and a strong one — a roll call
 * or a contract is a fact the state cannot unsay. They are not the gate. A state
 * that commits an act also writes the paperwork about it, and the people who are
 * never charged are the ones with the best lawyers, so an archive that only
 * reads filings records the careful and misses the catastrophic.
 *
 * The rules that keep this from becoming "whoever shouts loudest wins":
 *
 * 1. Class, not outlet. What matters is what the artifact is: a finding, a
 *    record, an admission, a report, an allegation.
 * 2. Independence, not repetition. A story citing another story is one origin.
 *    A hundred aggregators are still one. `derivedFrom` is how that is known.
 * 3. The passage must name the person. A claim about someone the source does
 *    not name is not a weak claim, it is not a claim.
 * 4. An undated act cannot be strong. It can be true and still unrankable.
 * 5. The actor's own account is evidence of the act and not of its intent.
 */

export type Stance = "admits" | "finds" | "records" | "reports" | "alleges";

export type Grade = "A" | "B" | "C" | "D";

export interface EvidenceInput {
  stance: Stance;
  /** True when the artifact was produced by the actor or its organ. */
  selfServing?: boolean;
  /**
   * The number of distinct origins behind the claim, not the number of URLs.
   * One court filing and one field investigation are two; a wire story and the
   * twelve outlets that reprinted it are one.
   */
  origins?: number;
  /** Does the quoted passage name the person the claim is about? */
  namesActor: boolean;
  /** Does the passage give a date for the act? */
  dated: boolean;
  /** A specialist field investigation, not desk reporting. */
  fieldInvestigation?: boolean;
}

export interface Evidence {
  grade: Grade;
  /** 0–1, before the category and window weights in the score. */
  score: number;
  /** Readable components, shown to the reader. */
  basis: string[];
}

const BASE: Record<Stance, number> = {
  finds: 0.95,
  admits: 0.92,
  records: 0.9,
  reports: 0.6,
  alleges: 0,
};

function gradeOf(score: number): Grade {
  if (score >= 0.9) return "A";
  if (score >= 0.75) return "B";
  if (score >= 0.55) return "C";
  return "D";
}

export function assessEvidence(input: EvidenceInput): Evidence {
  const basis: string[] = [`${input.stance}`];

  // Not weak — absent. The source has to name the person for the claim to be
  // about them at all.
  if (!input.namesActor) {
    return {
      grade: "D",
      score: 0,
      basis: [...basis, "the passage does not name them"],
    };
  }

  let score = BASE[input.stance];
  if (input.stance === "reports" && input.fieldInvestigation) {
    score = 0.75;
    basis.push("field investigation");
  }

  // A state's own inquiry clearing itself, or an actor's account of its own
  // intent, is worth less than the same words from anyone else. It still
  // documents the act, which is why this is a deduction and not a veto.
  if (input.selfServing) {
    score -= input.stance === "finds" ? 0.2 : 0.12;
    basis.push("the actor's own account");
  }

  const origins = Math.max(1, Math.min(4, Math.round(input.origins ?? 1)));
  if (origins > 1) {
    const bonus = Math.min(0.12, 0.04 * (origins - 1));
    score += bonus;
    basis.push(`${origins} independent origins`);
  }

  if (!input.dated) {
    score = Math.min(score, 0.55);
    basis.push("no date for the act");
  }

  score = Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  return { grade: gradeOf(score), score, basis };
}
