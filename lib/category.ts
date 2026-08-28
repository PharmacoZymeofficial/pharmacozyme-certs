export type Category = "General" | "Official";

const ALL: Category[] = ["General", "Official"];

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (ALL as string[]).includes(v);
}

export function parseCategoryParam(v: string | null | undefined): Category | null {
  if (!v) return null;
  const lower = v.trim().toLowerCase();
  if (lower === "general") return "General";
  if (lower === "official") return "Official";
  return null;
}

/** Given the requested category filter and a cert's own category, is this a hard cross-category miss? */
export function isCategoryMismatch(
  requested: string | null | undefined,
  actual: string | null | undefined
): boolean {
  const req = parseCategoryParam(requested ?? null);
  return req !== null && isCategory(actual) && actual !== req;
}

export const CATEGORY_SUBCATS: Record<Category, string[]> = {
  General: ["Courses", "Workshops", "Webinars", "MED-Q"],
  Official: ["Central Team", "Sub Team", "Ambassadors", "Affiliates", "Mentors"],
};
