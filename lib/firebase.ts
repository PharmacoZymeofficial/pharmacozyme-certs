import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

/**
 * Firebase *client* SDK — browser only.
 *
 * Server-side code must use `lib/firebase.admin.ts` instead: firestore.rules is now
 * deny-by-default, so unauthenticated client-SDK access from an API route is refused.
 *
 * The config values are public by design (they ship to the browser), but they are no
 * longer hardcoded as fallbacks: a preview or staging deploy missing these vars used to
 * silently read and write *production* Firestore.
 *
 * Config is resolved lazily, on first use, so that `next build` does not require the
 * env vars to be present at build time.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill in the Firebase web ` +
        `config (Firebase Console → Project Settings → Your Apps).`
    );
  }
  return value;
}

function firebaseConfig() {
  return {
    apiKey: required("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: required("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: required("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: required("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: required("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: required("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig());
  }
  return app;
}

/** Firestore via the public client SDK. Browser only — subject to firestore.rules. */
export function getDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp());
  }
  return firestore;
}
