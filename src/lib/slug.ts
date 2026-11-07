/**
 * One slug, everywhere.
 *
 * Names arrive with parentheses, accents, punctuation. The slug is the door to
 * the person page, so it has to be stable and it has to match between the link
 * and the row it opens. No trailing hyphen.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
