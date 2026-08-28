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

export const CATEGORY_SUBCATS: Record<Category, string[]> = {
  General: ["Courses", "Workshops", "Webinars", "MED-Q"],
  Official: ["Central Team", "Sub Team", "Ambassadors", "Affiliates", "Mentors"],
};
