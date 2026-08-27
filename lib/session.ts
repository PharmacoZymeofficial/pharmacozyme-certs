/**
 * Signed admin session cookie.
 *
 * Replaces the previous scheme, which was plain `base64(JSON)` with no signature —
 * anyone could hand-craft `{"role":"super_admin"}` and be treated as a super admin.
 *
 * Format: `base64url(payload).base64url(HMAC-SHA256(payload, SESSION_SECRET))`
 *
 * Uses Web Crypto rather than `node:crypto` so this exact module works unchanged in
 * proxy.ts, route handlers, and Vitest.
 */

export const ADMIN_COOKIE = "pz_admin_auth";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type AdminRole = "super_admin" | "admin";

export interface SessionPayload {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  /** Issued-at, seconds since epoch. */
  iat: number;
  /** Expiry, seconds since epoch. */
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    );
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Constant-time comparison — avoids leaking signature bytes through timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Signs a session. `iat`/`exp` are filled in here; callers pass only identity. */
export async function signSession(
  user: Pick<SessionPayload, "uid" | "email" | "displayName" | "role">
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { ...user, iat: now, exp: now + SESSION_MAX_AGE_SECONDS };

  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(encoded));
  return `${encoded}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Verifies signature and expiry. Returns null for anything untrusted —
 * bad shape, bad signature, or expired. Never throws on malformed input.
 */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  try {
    const expectedSig = new Uint8Array(
      await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(encoded))
    );
    if (!timingSafeEqual(expectedSig, fromBase64Url(providedSig))) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as SessionPayload;

    if (!payload.uid || !payload.email || !payload.exp) return null;
    if (payload.role !== "admin" && payload.role !== "super_admin") return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Reads and verifies the session from a raw Cookie header. */
export async function sessionFromCookieHeader(cookieHeader: string | null): Promise<SessionPayload | null> {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== ADMIN_COOKIE) continue;
    return verifySession(decodeURIComponent(part.slice(eq + 1).trim()));
  }
  return null;
}
