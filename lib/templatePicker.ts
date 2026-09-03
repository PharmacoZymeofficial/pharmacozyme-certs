/**
 * Pure helpers for the generate-PDF template picker.
 *
 * The picker defaults to templates whose category matches the database being
 * generated for (an "Official" database surfaces Official templates first), with
 * the other category available behind a "show more" toggle. Category is a free
 * string on the stored template; anything that isn't exactly "Official" is
 * treated as "General" (the upload default).
 */

export type TemplateCategory = "General" | "Official";

export interface Categorizable {
  category?: string | null;
}

/** Collapse a stored category string to one of the two real buckets. */
export function normalizeCategory(c: string | undefined | null): TemplateCategory {
  return c === "Official" ? "Official" : "General";
}

/**
 * Partition templates into the ones matching the database's category (`primary`)
 * and the rest (`other`), preserving input order. The API already returns
 * templates newest-first, so `primary`/`other` stay newest-first too.
 */
export function splitByCategory<T extends Categorizable>(
  templates: T[],
  dbCategory: string | undefined | null
): { primary: T[]; other: T[]; primaryLabel: TemplateCategory; otherLabel: TemplateCategory } {
  const primaryLabel = normalizeCategory(dbCategory);
  const otherLabel: TemplateCategory = primaryLabel === "Official" ? "General" : "Official";
  const primary = templates.filter((t) => normalizeCategory(t.category) === primaryLabel);
  const other = templates.filter((t) => normalizeCategory(t.category) === otherLabel);
  return { primary, other, primaryLabel, otherLabel };
}
