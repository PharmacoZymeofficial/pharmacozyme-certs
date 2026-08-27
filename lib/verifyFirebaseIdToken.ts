import jwt from "jsonwebtoken";

/**
 * Verifies a Firebase Auth ID token without going through `firebase-admin/auth`.
 *
 * `firebase-admin/auth` imports `jwks-rsa`, which has an unconditional top-level
 * `require("jose")` (node_modules/firebase-admin/lib/utils/jwt.js) -- and `jose` ships
 * as pure ESM. Vercel's serverless Function runtime cannot `require()` that module
 * (`ERR_REQUIRE_ESM`), regardless of bundler (confirmed under both Turbopack and
 * webpack builds) and regardless of the configured Node.js version. Because that
 * import is unconditional, merely importing anything from `firebase-admin/auth` --
 * even just for its types -- crashes at module-load time in production.
 *
 * This does the same verification firebase-admin would (fetch Google's public certs,
 * check the RS256 signature, validate standard claims) using `jsonwebtoken`, which has
 * no such ESM dependency.
 *
 * Reference: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  // Only ever cache a successful fetch — a transient network blip must not
  // permanently poison verification for the rest of the warm lambda's life.
  if (certCache && Date.now() < certCache.expiresAt) {
    return certCache.certs;
  }

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public certs: HTTP ${res.status}`);
  }
  const certs = (await res.json()) as Record<string, string>;

  // Respect the endpoint's own cache lifetime; fall back to 1 hour if absent/unparseable.
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  certCache = { certs, expiresAt: Date.now() + maxAgeSeconds * 1000 };
  return certs;
}

export interface VerifiedIdToken {
  uid: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
}

/**
 * Verifies a Firebase Auth ID token's signature and standard claims.
 * Throws on any failure — malformed token, unknown key, bad signature, wrong
 * issuer/audience, or expiry. Never returns a "partially trusted" result.
 */
export async function verifyFirebaseIdToken(idToken: string, projectId: string): Promise<VerifiedIdToken> {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("idToken is required");
  }

  const decodedHeader = jwt.decode(idToken, { complete: true });
  if (!decodedHeader || typeof decodedHeader === "string") {
    throw new Error("Malformed token");
  }

  const { kid, alg } = decodedHeader.header;
  if (alg !== "RS256") {
    throw new Error(`Unexpected signing algorithm: ${alg}`);
  }
  if (!kid) {
    throw new Error("Token header is missing kid");
  }

  const certs = await getGoogleCerts();
  const cert = certs[kid];
  if (!cert) {
    throw new Error("No matching Google public key for this token's kid");
  }

  const payload = jwt.verify(idToken, cert, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  }) as jwt.JwtPayload;

  if (!payload.sub) {
    throw new Error("Token has no subject (uid)");
  }
  // iat must not be in the future — jsonwebtoken checks exp/nbf but not this.
  if (typeof payload.iat === "number" && payload.iat > Date.now() / 1000 + 60) {
    throw new Error("Token issued-at time is in the future");
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    email_verified: typeof payload.email_verified === "boolean" ? payload.email_verified : undefined,
  };
}
