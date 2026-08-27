import { describe, it, expect } from "vitest";
import { newCertificateId, newBlockchainHash, normalizeCertId } from "@/lib/certificateId";

describe("certificate ids", () => {
  it("mints the documented PZ-{year}-{8 hex} shape", () => {
    expect(newCertificateId(2026)).toMatch(/^PZ-2026-[0-9A-F]{8}$/);
  });

  it("uses 8 hex characters, not the 4 the import route used to use", () => {
    // 4 chars is 65_536 values; collisions become likely in the low hundreds of imports.
    const suffix = newCertificateId(2026).split("-")[2];
    expect(suffix).toHaveLength(8);
  });

  it("does not collide across a realistic bulk import", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newCertificateId(2026)));
    expect(ids.size).toBe(5000);
  });

  it("normalizes for case-insensitive lookup", () => {
    expect(normalizeCertId(" pz-2026-a1b2c3d4 ")).toBe("PZ-2026-A1B2C3D4");
    expect(normalizeCertId("")).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately wrong-typed input
    expect(normalizeCertId(undefined as any)).toBe("");
  });

  it("mints a 32-hex cosmetic hash", () => {
    expect(newBlockchainHash()).toMatch(/^0x[0-9a-f]{32}$/);
  });
});
