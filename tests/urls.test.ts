import { describe, it, expect, beforeAll } from "vitest";
import { buildVerificationUrl, buildCertificateUrl } from "@/lib/urls";

beforeAll(() => {
  process.env.NEXT_PUBLIC_BASE_URL = "https://cert.example.com";
});

describe("certificate URLs", () => {
  it("builds a verification URL the verify page can actually read", () => {
    // app/verify/page.tsx reads ?certId= — the old `/verify/{id}` path shape 404s.
    expect(buildVerificationUrl("PZ-2026-A1B2C3D4")).toBe(
      "https://cert.example.com/verify?certId=PZ-2026-A1B2C3D4"
    );
  });

  it("escapes ids so a stray character cannot break the query string", () => {
    expect(buildVerificationUrl("PZ 2026/A&B")).toBe(
      "https://cert.example.com/verify?certId=PZ%202026%2FA%26B"
    );
  });

  it("tolerates a trailing slash on the base URL", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://cert.example.com/";
    expect(buildVerificationUrl("X")).toBe("https://cert.example.com/verify?certId=X");
    process.env.NEXT_PUBLIC_BASE_URL = "https://cert.example.com";
  });

  it("builds the recipient-facing certificate URL", () => {
    expect(buildCertificateUrl("PZ-2026-A1B2C3D4")).toBe(
      "https://cert.example.com/certificate?certId=PZ-2026-A1B2C3D4"
    );
  });
});
