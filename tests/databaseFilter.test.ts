import { describe, it, expect } from "vitest";
import { filterDatabases } from "@/lib/databaseFilter";
import type { Database } from "@/lib/types";

const db = (over: Partial<Database>): Database => ({
  name: "", category: "General", subCategory: "", topic: "", ...over,
});

const list: Database[] = [
  db({ name: "MEP Batch 1", subCategory: "Pharmacy", topic: "Compounding" }),
  db({ name: "Diploma Cohort", subCategory: "Clinical", topic: "Ward Rounds" }),
  db({ name: "Experience Letters", subCategory: "HR", topic: "Internships" }),
];

describe("filterDatabases", () => {
  it("returns the input unchanged for an empty query", () => {
    expect(filterDatabases(list, "")).toBe(list);
  });

  it("returns the input unchanged for a whitespace-only query", () => {
    expect(filterDatabases(list, "   ")).toBe(list);
  });

  it("matches on name, case-insensitively", () => {
    expect(filterDatabases(list, "mep").map((d) => d.name)).toEqual(["MEP Batch 1"]);
  });

  it("matches on subCategory", () => {
    expect(filterDatabases(list, "clinical").map((d) => d.name)).toEqual(["Diploma Cohort"]);
  });

  it("matches on topic", () => {
    expect(filterDatabases(list, "intern").map((d) => d.name)).toEqual(["Experience Letters"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterDatabases(list, "zzz")).toEqual([]);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(filterDatabases(list, "  diploma  ").map((d) => d.name)).toEqual(["Diploma Cohort"]);
  });
});
