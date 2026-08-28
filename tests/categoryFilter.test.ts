import { describe, it, expect } from "vitest";
import { isCategory, parseCategoryParam, CATEGORY_SUBCATS } from "@/lib/category";

describe("category helpers", () => {
  it("isCategory accepts only the two exact strings", () => {
    expect(isCategory("General")).toBe(true);
    expect(isCategory("Official")).toBe(true);
    expect(isCategory("general")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory(undefined)).toBe(false);
  });

  it("parseCategoryParam normalises case and rejects junk", () => {
    expect(parseCategoryParam("general")).toBe("General");
    expect(parseCategoryParam("OFFICIAL")).toBe("Official");
    expect(parseCategoryParam("Official")).toBe("Official");
    expect(parseCategoryParam("")).toBeNull();
    expect(parseCategoryParam(null)).toBeNull();
    expect(parseCategoryParam("both")).toBeNull();
  });

  it("subcategory lists are disjoint and non-empty", () => {
    const g = new Set(CATEGORY_SUBCATS.General);
    const o = new Set(CATEGORY_SUBCATS.Official);
    expect(g.size).toBeGreaterThan(0);
    expect(o.size).toBeGreaterThan(0);
    for (const s of g) expect(o.has(s)).toBe(false);
  });
});
