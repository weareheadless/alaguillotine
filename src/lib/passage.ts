/**
 * The rule, in SQL.
 *
 * A row is on the public record only when it carries the sentence it was filed
 * from and that sentence is still found in the stored article text. Anything
 * else is an allegation with a link: the act was written by a machine or an
 * older pipeline, the passage was never kept, and nobody can check it without
 * redoing the research. On a site that names people that is not good enough.
 *
 * Both tables are aliased `c` (claims) and `d` (documents) where this is used.
 */
export const PASSAGE_SQL =
  "trim(coalesce(c.quote, '')) != '' AND instr(d.text_excerpt, c.quote) > 0";
