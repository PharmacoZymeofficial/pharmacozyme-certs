# PharmacoZyme Certificate System — Context

## What this app is

Next.js 16 (App Router) + React 19 + TypeScript app. Issues, tracks, and verifies training/course certificates for PharmacoZyme. Two audiences:

- **Public**: `/verify` (look up a certificate by ID/QR), `/certificate` + `/claim/[id]` (claim/view a certificate), home page `/`.
- **Admin** (`/admin/*`, cookie-gated): manage "databases" (a database = one course/topic with a roster of participants), issue certificates in bulk, manage categories/templates, send bulk email, view activity/reports, sync with Google Sheets/Drive.

## Stack

- **Frontend**: Next.js 16, React 19, Tailwind v4.
- **Data**: Firebase Firestore (`lib/firebase.ts`). No Firebase Admin SDK — all reads/writes go through the client SDK, even from API routes.
- **PDF**: `pdf-lib`, `@pdf-lib/fontkit`, `@react-pdf/renderer`, `pdfjs-dist` — certificate rendering/templating (`app/api/templates/*`, `app/api/certificates/render`, `app/api/certificates/generate`).
- **QR codes**: `qrcode`, embedded per certificate, linking to the verify URL.
- **Google Sheets/Drive**: bridged via a separately-deployed Google Apps Script web app (`apps-script.js`, see `GOOGLE_SHEETS_SETUP.md`). Next.js calls it over HTTP (`GOOGLE_APPS_SCRIPT_URL`) for sheet sync and Drive PDF uploads (`app/api/sheets/*`, `app/api/drive-upload`).
- **Email**: two providers wired up in `app/api/send-email/route.ts` — Brevo REST API (per-sender API keys, hardcoded sender map) and Resend (fallback path, simulates sends if no key configured). `nodemailer` is a dependency but doesn't appear wired into the send path. Scheduled/queued sends via `scheduled_emails` Firestore collection, drained daily by a Vercel Cron (`vercel.json` → `/api/cron/send-scheduled`, `0 0 * * *`).
- **Auth**: custom, not Firebase Auth rules-based. `app/api/admin/auth` sets an httpOnly cookie (`pz_admin_auth`) containing **base64-encoded JSON** (`{uid, email, displayName, role}`) — not signed/encrypted. Supports a Firebase-Auth-driven flow (client signs in, posts uid+email, server assigns `role: super_admin` only if email === hardcoded `pharmacozymeofficial@gmail.com`, else `admin`) and a legacy shared-password flow (`ADMIN_PASSWORD` env, defaults to `"pharmacozyme2026"` if unset).

## Data model (`lib/types.ts`)

- `Database` — a course/topic grouping; optional linked Google Sheet + Drive folder.
- `Participant` — belongs to a `Database` (subcollection `databases/{id}/participants`); also a legacy top-level `participants` collection exists.
- `Certificate` — top-level `certificates` collection; carries `uniqueCertId` (format `PZ-{year}-{8-char-hex}`), status, QR/verification URL, a cosmetic `blockchainHash` (just a random hex string, not an actual chain).
- `Category` / `SubCategory` / `Topic` — taxonomy for certificate types.

## Request flow highlights

- **Issuing certificates** (`app/api/certificates/generate`): batches Firestore writes (`writeBatch`, 250-doc chunks) when no PDF/Drive upload is needed; falls back to a slower per-participant loop when uploading PDFs to Drive via the Apps Script bridge. Re-syncs the linked Sheet afterward.
- **Verifying** (`app/api/verify`): rate-limited by IP (in-memory, 25 req/min, `lib/rateLimit.ts`). Tries exact `uniqueCertId` match, then case variants, then falls back to scanning every database's `participants` subcollection by `certificateId`. Uppercases input already, plus falls back to the raw + lowercase variants for legacy records.
- **Sheets sync** (`app/api/sheets/sync`, and inline in `generate`): both directions (`firebaseToSheets`, `sheetsToFirebase`) proxy through `apps-script.js`. Participant ordering for sheet writes sorts by a **numeric trailing digit** in the ID (`/(\d+)$/`, base-10) — this is a legacy scheme for IDs like `Hamza-MDC-001`, not the current hex `uniqueCertId` format.

## Known issue: `implementation_plan.md.resolved`

A prior plan file describes three bugs and their fixes. Cross-checked against current code:

1. **Cert ID collision risk** (was 4 hex chars) — **fixed**: `generate/route.ts` now uses `uuidv4().split('-')[0].toUpperCase()` (8 chars).
2. **Verify case-sensitivity** — **fixed**: `verify/route.ts` uppercases input and also tries lower/original-case variants.
3. **"Hex sort bug" in Sheets sync** (`parseInt` base-10 on a hex string) — the plan's diagnosis doesn't match current code: both `generate/route.ts` and `sync/route.ts` sort via `getSerial()`, a regex pulling a **trailing decimal digit run**, not a hex slice. For current hex `uniqueCertId`s (e.g. `PZ-2026-A1B2C3D4`) there's usually no trailing digit run, so `getSerial` returns `0` for most rows and the "sort" is a no-op — sheet row order likely just falls back to whatever order Firestore returned. **This one may still be an open, if differently-shaped, bug** — worth confirming what order you actually want in the Sheet.

## Things I noticed that look like security gaps (flagging, not fixing)

- **`firestore.rules` is fully open**: every collection (`certificates`, `databases`, `participants`, `admins`, `settings`, etc.) is `allow read, write: if true`. Since the Firebase client config is public by nature, anyone with the project's public config can read/write Firestore directly, bypassing the Next.js app and any cookie check entirely.
- **The admin cookie is unsigned**: `pz_admin_auth` is just `base64(JSON)`, no HMAC/signature. Anyone can hand-craft a cookie with `role: "super_admin"` and pass `proxy.ts`'s check, which only verifies the cookie *exists*, not that it's valid.
- **No server-side auth check on most admin API routes**: grep across `app/api` shows only `send-email`, `certificates/generate`, `admin/tutorial-seen`, `admin/me`, `admin/auth`, and `activity-logs` even reference the admin cookie — and those only use it to *label* activity-log entries, not to gate access. Routes like certificate delete/update, participants batch-update, categories, templates, databases don't appear to check the cookie/role before mutating.
- **Legacy password fallback** defaults to a hardcoded string (`pharmacozyme2026`) if `ADMIN_PASSWORD` isn't set in the environment.

Net effect: today, access control is essentially client-side-only (UI hides the admin panel without a cookie) rather than enforced at the data or API layer.

## Loose ends / debug cruft

- Root-level `test-api.js`, `test-drive.js`, `test-upload.js`, `test-apps-script.js`, `check-drives.js`, `check-folder.js` are ad hoc scripts, not part of the app or a test suite. `test-api.js` has a hardcoded LAN IP (`192.168.18.165`).
- `graphify-out/graph.json` + the Graphify instructions in `AGENTS.md` imply a `graphify auto-update` CLI is expected to run after every edit — not verified whether that tool is actually installed/available here.
