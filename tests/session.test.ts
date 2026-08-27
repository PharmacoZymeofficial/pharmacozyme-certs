import { describe, it, expect, beforeAll } from "vitest";
import { signSession, verifySession, sessionFromCookieHeader, ADMIN_COOKIE } from "@/lib/session";

const USER = {
  uid: "abc123",
  email: "someone@example.com",
  displayName: "Someone",
  role: "admin" as const,
};

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough-to-pass-validation";
});

describe("session signing", () => {
  it("round-trips a signed session", async () => {
    const payload = await verifySession(await signSession(USER));
    expect(payload).toMatchObject(USER);
    expect(payload!.exp).toBeGreaterThan(payload!.iat);
  });

  it("rejects a forged cookie — the exact attack the old scheme allowed", async () => {
    // The previous format was plain base64(JSON) with no signature, so this was a valid session.
    const forged = Buffer.from(
      JSON.stringify({ uid: "x", email: "attacker@example.com", role: "super_admin", exp: 9e9 })
    ).toString("base64url");

    expect(await verifySession(forged)).toBeNull();
    expect(await verifySession(`${forged}.`)).toBeNull();
    expect(await verifySession(`${forged}.bogussignature`)).toBeNull();
  });

  it("rejects a tampered payload that keeps a valid-looking signature", async () => {
    const token = await signSession(USER);
    const [, signature] = token.split(".");
    const escalated = Buffer.from(JSON.stringify({ ...USER, role: "super_admin" })).toString("base64url");

    expect(await verifySession(`${escalated}.${signature}`)).toBeNull();
  });

  it("rejects a session signed with a different secret", async () => {
    const token = await signSession(USER);
    process.env.SESSION_SECRET = "a-completely-different-secret-of-sufficient-length";
    const result = await verifySession(token);
    process.env.SESSION_SECRET = "test-secret-that-is-long-enough-to-pass-validation";

    expect(result).toBeNull();
  });

  it("rejects an expired session", async () => {
    const token = await signSession(USER);
    const [encoded] = token.split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // Re-sign with an expiry in the past via a direct crypto path would duplicate impl;
    // instead assert verify() enforces exp by fast-forwarding time.
    const realNow = Date.now;
    Date.now = () => (payload.exp + 1) * 1000;
    const result = await verifySession(token);
    Date.now = realNow;

    expect(result).toBeNull();
  });

  it("returns null for malformed input instead of throwing", async () => {
    for (const bad of [undefined, null, "", "...", "not-a-token", "a.b.c"]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately wrong-typed input
      expect(await verifySession(bad as any)).toBeNull();
    }
  });

  it("reads the session out of a Cookie header", async () => {
    const token = await signSession(USER);
    const header = `other=1; ${ADMIN_COOKIE}=${token}; another=2`;

    expect(await sessionFromCookieHeader(header)).toMatchObject(USER);
    expect(await sessionFromCookieHeader("other=1")).toBeNull();
    expect(await sessionFromCookieHeader(null)).toBeNull();
  });
});
