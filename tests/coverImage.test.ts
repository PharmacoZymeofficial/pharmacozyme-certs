import { describe, it, expect } from "vitest";
import { centerCrop16x9, coverUrl, COVER_W, COVER_H } from "@/lib/coverImage";

describe("centerCrop16x9", () => {
  it("keeps full height and crops width on a wide source", () => {
    // 4000x1000 (4:1) → sample 1777.77x1000 centered
    const r = centerCrop16x9(4000, 1000);
    expect(r.sh).toBe(1000);
    expect(r.sw).toBeCloseTo(1000 * (16 / 9), 3);
    expect(r.sx).toBeCloseTo((4000 - 1000 * (16 / 9)) / 2, 3);
    expect(r.sy).toBe(0);
  });

  it("keeps full width and crops height on a tall source", () => {
    // 900x1600 → sample 900x506.25 centered
    const r = centerCrop16x9(900, 1600);
    expect(r.sw).toBe(900);
    expect(r.sh).toBeCloseTo(900 * (9 / 16), 3);
    expect(r.sy).toBeCloseTo((1600 - 900 * (9 / 16)) / 2, 3);
    expect(r.sx).toBe(0);
  });

  it("samples the whole source when it is already 16:9", () => {
    expect(centerCrop16x9(1920, 1080)).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });
});

describe("coverUrl", () => {
  it("returns a versioned path when a cover is set", () => {
    expect(coverUrl({ id: "abc", coverImageId: "drive123", coverUpdatedAt: "2026-09-10T00:00:00.000Z" }))
      .toBe("/api/databases/abc/cover?v=2026-09-10T00%3A00%3A00.000Z");
  });

  it("returns null when there is no coverImageId", () => {
    expect(coverUrl({ id: "abc", coverImageId: undefined, coverUpdatedAt: undefined })).toBeNull();
  });

  it("returns null when there is no id", () => {
    expect(coverUrl({ id: undefined, coverImageId: "drive123", coverUpdatedAt: "x" })).toBeNull();
  });

  it("tolerates a missing coverUpdatedAt", () => {
    expect(coverUrl({ id: "abc", coverImageId: "drive123", coverUpdatedAt: undefined }))
      .toBe("/api/databases/abc/cover?v=");
  });
});

describe("constants", () => {
  it("are a 16:9 pair", () => {
    expect(COVER_W / COVER_H).toBeCloseTo(16 / 9, 5);
  });
});
