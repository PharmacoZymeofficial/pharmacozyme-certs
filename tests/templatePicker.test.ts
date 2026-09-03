import { describe, it, expect } from "vitest";
import { normalizeCategory, splitByCategory } from "@/lib/templatePicker";

describe("normalizeCategory", () => {
  it("keeps 'Official' as-is", () => {
    expect(normalizeCategory("Official")).toBe("Official");
  });

  it("treats everything else (incl. undefined, '', unknown) as 'General'", () => {
    expect(normalizeCategory("General")).toBe("General");
    expect(normalizeCategory(undefined)).toBe("General");
    expect(normalizeCategory(null)).toBe("General");
    expect(normalizeCategory("")).toBe("General");
    expect(normalizeCategory("official")).toBe("General"); // case-sensitive by design
  });
});

describe("splitByCategory", () => {
  const t = (id: string, category?: string) => ({ id, category });

  it("puts DB-matching templates in primary, the rest in other", () => {
    const templates = [t("a", "Official"), t("b", "General"), t("c", "Official")];
    const { primary, other, primaryLabel, otherLabel } = splitByCategory(templates, "Official");
    expect(primary.map((x) => x.id)).toEqual(["a", "c"]);
    expect(other.map((x) => x.id)).toEqual(["b"]);
    expect(primaryLabel).toBe("Official");
    expect(otherLabel).toBe("General");
  });

  it("defaults a template with no category into General", () => {
    const templates = [t("a"), t("b", "Official")];
    const { primary, other } = splitByCategory(templates, "General");
    expect(primary.map((x) => x.id)).toEqual(["a"]);
    expect(other.map((x) => x.id)).toEqual(["b"]);
  });

  it("treats an unknown/undefined DB category as General", () => {
    const templates = [t("a", "General"), t("b", "Official")];
    const { primary, primaryLabel, otherLabel } = splitByCategory(templates, undefined);
    expect(primaryLabel).toBe("General");
    expect(otherLabel).toBe("Official");
    expect(primary.map((x) => x.id)).toEqual(["a"]);
  });

  it("preserves input order (API already sorts latest-first)", () => {
    const templates = [t("c3", "General"), t("c2", "General"), t("c1", "General")];
    const { primary } = splitByCategory(templates, "General");
    expect(primary.map((x) => x.id)).toEqual(["c3", "c2", "c1"]);
  });

  it("returns an empty primary when nothing matches the DB category", () => {
    const templates = [t("a", "General"), t("b", "General")];
    const { primary, other } = splitByCategory(templates, "Official");
    expect(primary).toEqual([]);
    expect(other.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
