import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

const APP_NAME = "pz-admin";

/**
 * Deliberately does NOT import from "firebase-admin/auth".
 *
 * That module has an unconditional top-level `require("jwks-rsa")`
 * (node_modules/firebase-admin/lib/utils/jwt.js), and jwks-rsa depends on `jose`,
 * which ships as pure ESM. Vercel's serverless Function runtime cannot `require()`
 * that (`ERR_REQUIRE_ESM`) regardless of bundler (Turbopack or webpack) or configured
 * Node.js version — and because the import is unconditional, merely importing
 * anything from "firebase-admin/auth" crashes every route that transitively imports
 * this file, including ones that only touch Firestore. ID token verification is done
 * instead by lib/verifyFirebaseIdToken.ts, which has no such dependency.
 */

/**
 * Service account JSON, base64-encoded, from:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 *
 * Base64 rather than raw JSON because the private key contains newlines, which
 * survive neither `.env` files nor the Vercel dashboard reliably.
 */
function loadServiceAccount(): { projectId: string; clientEmail: string; privateKey: string } {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Server-side Firestore access requires a " +
        "Firebase service account key (base64-encoded). Without it the app would silently fall " +
        "back to unauthenticated client-SDK access, which firestore.rules now denies."
    );
  }

  let parsed: Record<string, unknown>;
  try {
    // Accept both base64 and raw JSON so a paste of either shape works.
    const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_JSON could not be parsed as JSON (or base64-encoded JSON): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const projectId = parsed.project_id as string | undefined;
  const clientEmail = parsed.client_email as string | undefined;
  const privateKey = parsed.private_key as string | undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing one of: project_id, client_email, private_key. " +
        "Make sure you copied the whole service-account file, not just part of it."
    );
  }

  return { projectId, clientEmail, privateKey: privateKey.replace(/\n/g, "\n") };
}

let cachedApp: App | undefined;
let cachedProjectId: string | undefined;

function adminApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) {
    cachedApp = existing;
    return cachedApp;
  }
  const sa = loadServiceAccount();
  cachedProjectId = sa.projectId;
  cachedApp = initializeApp({ credential: cert(sa), projectId: sa.projectId }, APP_NAME);
  return cachedApp;
}

/** Firestore with full admin privileges — bypasses firestore.rules. Server-only. */
export function getAdminDb(): Firestore {
  return getFirestore(adminApp());
}

/** The Firebase project ID from the service account — needed to verify ID token claims. */
export function getFirebaseProjectId(): string {
  adminApp();
  return cachedProjectId!;
}
