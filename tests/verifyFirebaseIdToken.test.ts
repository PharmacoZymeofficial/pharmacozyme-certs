import { describe, it, expect } from "vitest";
import { verifyFirebaseIdToken } from "@/lib/verifyFirebaseIdToken";

describe("verifyFirebaseIdToken", () => {
  it("rejects a malformed token", async () => {
    await expect(verifyFirebaseIdToken("not-a-jwt", "some-project")).rejects.toThrow();
  });

  it("rejects an empty token", async () => {
    await expect(verifyFirebaseIdToken("", "some-project")).rejects.toThrow("idToken is required");
  });

  it("rejects a token with the wrong algorithm", async () => {
    // header: {"alg":"HS256","typ":"JWT"} — Firebase ID tokens are always RS256.
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
    const fakeToken = `${header}.${payload}.sig`;

    await expect(verifyFirebaseIdToken(fakeToken, "some-project")).rejects.toThrow(/algorithm/i);
  });

  it("rejects a token with no kid in the header", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
    const fakeToken = `${header}.${payload}.sig`;

    await expect(verifyFirebaseIdToken(fakeToken, "some-project")).rejects.toThrow(/kid/i);
  });
});
