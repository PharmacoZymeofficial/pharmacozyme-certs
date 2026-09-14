import { describe, it, expect } from "vitest";
import {
  newCertificateId,
  newBlockchainHash,
  normalizeCertId,
  bumpCertificateSerial,
  resolveUniqueCertificateIds,
} from "@/lib/certificateId";

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

describe("bumpCertificateSerial", () => {
  it("increments the trailing zero-padded serial", () => {
    expect(bumpCertificateSerial("PZ-MDC-B3-001")).toBe("PZ-MDC-B3-002");
    expect(bumpCertificateSerial("PZ-MDC-B3-009")).toBe("PZ-MDC-B3-010");
    expect(bumpCertificateSerial("PZ-MDC-B3-099")).toBe("PZ-MDC-B3-100");
  });

  it("preserves padding width when the increment doesn't grow the digit count", () => {
    expect(bumpCertificateSerial("PZ-MDC-B3-001").length).toBe("PZ-MDC-B3-001".length);
  });

  it("falls back to an appended -2 suffix when the trailing segment isn't numeric", () => {
    expect(bumpCertificateSerial("PZ-MDC-B3-XYZ")).toBe("PZ-MDC-B3-XYZ-2");
  });
});

describe("resolveUniqueCertificateIds", () => {
  // Reproduces the 2026-09-13 incident: two databases (COE-MDC3, COP-MDC3)
  // independently generated IDs starting at 001 with the same course prefix.
  it("bumps a candidate that collides with a different owner's existing ID", () => {
    const taken = new Map([["PZ-MDC-B3-001", "databases/coe/participants/nimra"]]);
    const resolved = resolveUniqueCertificateIds(
      [{ ownerPath: "databases/cop/participants/almas", certificateId: "PZ-MDC-B3-001" }],
      taken
    );
    expect(resolved.get("databases/cop/participants/almas")).toBe("PZ-MDC-B3-002");
  });

  it("leaves a participant's own existing ID untouched (not a self-collision)", () => {
    const taken = new Map([["PZ-MDC-B3-001", "databases/coe/participants/nimra"]]);
    const resolved = resolveUniqueCertificateIds(
      [{ ownerPath: "databases/coe/participants/nimra", certificateId: "PZ-MDC-B3-001" }],
      taken
    );
    expect(resolved.get("databases/coe/participants/nimra")).toBe("PZ-MDC-B3-001");
  });

  it("keeps bumping past a chain of collisions, including ones created earlier in the same batch", () => {
    const taken = new Map([
      ["PZ-MDC-B3-001", "databases/coe/participants/a"],
      ["PZ-MDC-B3-002", "databases/coe/participants/b"],
    ]);
    const resolved = resolveUniqueCertificateIds(
      [
        { ownerPath: "databases/cop/participants/x", certificateId: "PZ-MDC-B3-001" },
        { ownerPath: "databases/cop/participants/y", certificateId: "PZ-MDC-B3-001" },
      ],
      taken
    );
    expect(resolved.get("databases/cop/participants/x")).toBe("PZ-MDC-B3-003");
    expect(resolved.get("databases/cop/participants/y")).toBe("PZ-MDC-B3-004");
  });

  it("does not touch candidates that are already free", () => {
    const taken = new Map<string, string>();
    const resolved = resolveUniqueCertificateIds(
      [{ ownerPath: "databases/cop/participants/x", certificateId: "PZ-MDC-B3-050" }],
      taken
    );
    expect(resolved.get("databases/cop/participants/x")).toBe("PZ-MDC-B3-050");
  });
});
