import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

const APP_NAME = "pz-admin";

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

function adminApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) {
    cachedApp = existing;
    return cachedApp;
  }
  const sa = loadServiceAccount();
  cachedApp = initializeApp({ credential: cert(sa), projectId: sa.projectId }, APP_NAME);
  return cachedApp;
}

/** Firestore with full admin privileges — bypasses firestore.rules. Server-only. */
export function getAdminDb(): Firestore {
  return getFirestore(adminApp());
}

/** Firebase Auth admin — used to verify ID tokens at login. Server-only. */
export function getAdminAuth(): Auth {
  return getAuth(adminApp());
}
