import type { Database } from "@/lib/types";

/**
 * Client-side filter for the admin database grid. The grid already holds the
 * full per-category list in memory, so this is a plain substring match — no
 * API call, no pagination. Matches the fields the public filter and the
 * templates-page search use: name, subCategory, topic (deliberately not
 * description).
 */
export function filterDatabases(dbs: Database[], query: string): Database[] {
  const q = query.trim().toLowerCase();
  if (!q) return dbs;
  return dbs.filter((d) =>
    `${d.name} ${d.subCategory} ${d.topic}`.toLowerCase().includes(q)
  );
}
