# PharmacoZyme Certificate System — Context

## What this app is

Next.js 16 (App Router) + React 19 + TypeScript app. Issues, tracks, and verifies training/course certificates for PharmacoZyme. Two audiences:

- **Public**: `/verify` (look up a certificate by ID/QR), `/certificate` + `/claim/[id]` (claim/view a certificate), home page `/`.
- **Admin** (`/admin/*`, cookie-gated): manage "databases" (a database = one course/topic with a roster of participants), issue certificates in bulk, manage categories/templates, send bulk email, view activity/reports, sync with Google Sheets/Drive.

## Stack

- **Frontend**: Next.js 16, React 19, Tailwind v4.
- **Data**: Firebase Firestore (`lib/firebase.ts`). No Firebase Admin SDK — all reads/writes go through the client SDK, even from API routes.
- **PDF**: `pdf-lib`, `@pdf-lib/fontkit`, `@react-pdf/renderer`, `pdfjs-dist` — certificate rendering/templating (`app/api/templates/*`, `app/api/certificates/render`, `app/api/certificates/generate`). The actual font/QR/text-drawing logic for uploaded templates lives in one shared module, `lib/certificateRender.ts`, used by both `app/api/certificates/render` (real generation) and `app/api/templates/preview` (editor preview) — previously these were two independently-maintained copies of the same logic, which is exactly the kind of thing that causes "preview looks right, real cert doesn't" bugs.
- **QR codes**: `qrcode`, embedded per certificate, linking to the verify URL.
- **Google Sheets/Drive**: bridged via a separately-deployed Google Apps Script web app (`apps-script.js`, see `GOOGLE_SHEETS_SETUP.md`). Next.js calls it over HTTP (`GOOGLE_APPS_SCRIPT_URL`) for sheet sync and Drive PDF uploads (`app/api/sheets/*`, `app/api/drive-upload`).
- **Email**: two providers wired up in `app/api/send-email/route.ts` — Brevo REST API (per-sender API keys, hardcoded sender map) and Resend (fallback path, simulates sends if no key configured). `nodemailer` is a dependency but doesn't appear wired into the send path. Scheduled/queued sends via `scheduled_emails` Firestore collection, drained daily by a Vercel Cron (`vercel.json` → `/api/cron/send-scheduled`, `0 0 * * *`).
- **Auth**: custom, not Firebase Auth rules-based. `app/api/admin/auth` sets an httpOnly cookie (`pz_admin_auth`) containing **base64-encoded JSON** (`{uid, email, displayName, role}`) — not signed/encrypted. Supports a Firebase-Auth-driven flow (client signs in, posts uid+email, server assigns `role: super_admin` only if email === hardcoded `pharmacozymeofficial@gmail.com`, else `admin`) and a legacy shared-password flow (`ADMIN_PASSWORD` env, defaults to `"pharmacozyme2026"` if unset).

## Data model (`lib/types.ts`)

- `Database` — a course/topic grouping; optional linked Google Sheet + Drive folder.
- `Participant` — belongs to a `Database` (subcollection `databases/{id}/participants`); also a legacy top-level `participants` collection exists. Carries an optional `customFields: Record<string, string>` map — any Sheet/CSV column beyond the fixed set (name, email, certificateId, etc.), e.g. "Designation" or "Start Date", populated by both live Sheet sync and CSV/Excel import. A template's custom-text element can bind to one of these via `sourceField` so real certificates print that participant's value (see Session log below).
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

## Session log — 2026-08-26 → 27

Fixed three reported bugs plus a requested feature, all pushed to `main` (commits `3898d0a`, `ac2d6c8`):

1. **Font not applying after generation** — `lib/fonts.server.ts` was permanently caching a *failed* font fetch as "give up" for the life of the warm server instance. One transient network blip on one request silently broke that font for everyone until the next cold start. Fixed: only successes get cached.
2. **Template editor UX** — `app/admin/templates/page.tsx` gained undo/redo (Ctrl+Z / Ctrl+Shift+Z), drag-to-center/drag-to-other-element snapping, a debounced live auto-preview (once Preview is opened once), and background-box + letter-spacing controls for Name/Cert ID/custom text.
3. **Dynamic per-participant fields** (the main feature ask) — extra Sheet columns (e.g. "Designation", "Start Date", "Department") now flow into `participant.customFields` via both the live Sheet sync (`apps-script.js`'s `syncData` read mode now reads header-named columns past the fixed 9, plus `app/api/sheets/sync/route.ts`) and CSV/Excel import (`app/admin/databases/page.tsx`, `app/api/participants/route.ts`). In the template editor, a custom-text element has a new "Bind to Column" field (`sourceField`) — when set, real certificates print that participant's value instead of static text. `CertificateGenerator.tsx` warns (non-blocking) before generating if any participants are missing a bound value.
4. **Drive link sometimes missing after bulk generation** — `components/CertificateGenerator.tsx`'s Drive-upload step now retries each upload up to 3× with backoff; any still-failed ones surface a specific toast and a new "Missing Drive Link" filter chip in `admin/databases`, pointing at the existing "Regenerate All" bulk action (which safely reuses the existing certificate ID).
5. **Root cause found for #4 (and for a template-upload "big error" report)**: in `apps-script.js`, `uploadTemplate`, `uploadPDF`, and `createNewSheet` all call `.setSharing(ANYONE_WITH_LINK, ...)` immediately after creating the Drive file/sheet, **unguarded**. If that sharing call throws (a Workspace domain sharing-policy rejection, or any transient error), the whole function throws even though the file/sheet was already created — orphaning it in Drive with no matching Firestore record, while the user sees "failed." Fixed: sharing is now best-effort (wrapped in try/catch) and no longer undoes an otherwise-successful upload. **Caveat**: if the Workspace domain genuinely blocks "anyone with the link" sharing, the file now uploads successfully but stays privately shared — later anonymous fetches (template rendering, public downloads) could still 403 until that policy is loosened or the specific `DRIVE_FOLDER_ID`/`TEMPLATES_FOLDER_ID` folders are shared directly.
6. Added `grantPermissions()` to `apps-script.js` — run manually once from the Apps Script editor's function dropdown to authorize Drive+Sheets scopes in one shot, instead of guessing which existing function to run.

### Unresolved thread as of session end

User hit a template-upload `404` in production after all the above. Verified (not guessed) that the deployed Apps Script URL itself is healthy — a direct Node `fetch` replicating the app's exact call got a clean `200`. Conclusion: **Vercel was still serving a build from before the `GOOGLE_APPS_SCRIPT_URL` env var was last updated** — Vercel does not hot-reload env var changes into already-running serverless functions, only a fresh deployment picks up the new value. Last instruction given: redeploy the Vercel project (Deployments → ⋯ → Redeploy), then retry. **Not yet confirmed working end-to-end** — next session should check whether that redeploy fixed it, and whether template preview/download/verification still 403 (Workspace sharing-policy caveat above).

### Repo/environment notes

- This directory had no `.git` before this session. Initialized fresh, verified it matched `origin/main` exactly before adding any changes (no drift), then committed and pushed directly to `main` (matches this repo's existing history — no PRs used).
- Windows Git Credential Manager had a stale cached GitHub account (`ditpharmacozyme`) without push access to this repo — cleared via `cmdkey /delete`, first push then prompted a fresh login as the correct account.
- `node_modules` were installed this session (weren't present before) to run `tsc --noEmit` and `npm run build` for verification — both passed clean after every change.

## Things I noticed that look like security gaps (flagging, not fixing)

- **`firestore.rules` is fully open**: every collection (`certificates`, `databases`, `participants`, `admins`, `settings`, etc.) is `allow read, write: if true`. Since the Firebase client config is public by nature, anyone with the project's public config can read/write Firestore directly, bypassing the Next.js app and any cookie check entirely.
- **The admin cookie is unsigned**: `pz_admin_auth` is just `base64(JSON)`, no HMAC/signature. Anyone can hand-craft a cookie with `role: "super_admin"` and pass `proxy.ts`'s check, which only verifies the cookie *exists*, not that it's valid.
- **No server-side auth check on most admin API routes**: grep across `app/api` shows only `send-email`, `certificates/generate`, `admin/tutorial-seen`, `admin/me`, `admin/auth`, and `activity-logs` even reference the admin cookie — and those only use it to *label* activity-log entries, not to gate access. Routes like certificate delete/update, participants batch-update, categories, templates, databases don't appear to check the cookie/role before mutating.
- **Legacy password fallback** defaults to a hardcoded string (`pharmacozyme2026`) if `ADMIN_PASSWORD` isn't set in the environment.

Net effect: today, access control is essentially client-side-only (UI hides the admin panel without a cookie) rather than enforced at the data or API layer.

## Loose ends / debug cruft

- Root-level `test-api.js`, `test-drive.js`, `test-upload.js`, `test-apps-script.js`, `check-drives.js`, `check-folder.js` are ad hoc scripts, not part of the app or a test suite. `test-api.js` has a hardcoded LAN IP (`192.168.18.165`).
- `graphify-out/graph.json` + the Graphify instructions in `AGENTS.md` imply a `graphify auto-update` CLI is expected to run after every edit — not verified whether that tool is actually installed/available here.
