// Read-only audit: counts `databases` and `certificates` docs whose `category`
// is not exactly "General" or "Official". Run before shipping the General/Official
// split — any hit is a doc that will silently disappear from the UI (and, for
// databases, from BOTH admin tabs).
//
// Usage: node scripts/category-audit.mjs
//   Needs the same env as the app: FIREBASE_SERVICE_ACCOUNT_JSON
//   (base64-encoded service-account JSON, or raw JSON). Load your .env first, e.g.
//   `node --env-file=.env.local scripts/category-audit.mjs`.
//
// READ-ONLY: this script never calls .set / .update / .delete.

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APP_NAME = "pz-category-audit";
const VALID = new Set(["General", "Official"]);

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Provide the base64-encoded (or raw) " +
        "Firebase service-account JSON, the same value the app uses."
    );
  }
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
  const parsed = JSON.parse(text);
  const projectId = parsed.project_id;
  const clientEmail = parsed.client_email;
  const privateKey = parsed.private_key;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Service account JSON missing project_id / client_email / private_key.");
  }
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

function getDb() {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return getFirestore(existing);
  const sa = loadServiceAccount();
  const app = initializeApp({ credential: cert(sa), projectId: sa.projectId }, APP_NAME);
  return getFirestore(app);
}

const db = getDb();

for (const coll of ["databases", "certificates"]) {
  const snap = await db.collection(coll).get();
  const bad = [];
  snap.forEach((d) => {
    const c = d.data().category;
    if (!VALID.has(c)) bad.push({ id: d.id, category: c ?? "(absent)" });
  });
  console.log(`\n${coll}: ${snap.size} docs, ${bad.length} with an off-value category`);
  bad.slice(0, 50).forEach((b) => console.log(`  ${b.id}  category=${JSON.stringify(b.category)}`));
  if (bad.length > 50) console.log(`  … and ${bad.length - 50} more`);
}

process.exit(0);
