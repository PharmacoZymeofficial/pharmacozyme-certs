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

## Session log — 2026-08-28 → 29: Plans A–D via subagent-driven-development

Branch `feat/general-official-split` (base `main` @ 88f0b39). Four plans executed
with the SDD loop (fresh implementer + task review per task, whole-branch review
at the end). **All complete, all reviewed clean. UNMERGED / UNPUSHED / UNDEPLOYED**
— that authorization was withheld for the whole effort.

- **Plan A** (Drive fixes) — complete, final review clean.
- **Plan B** (`admin/databases/page.tsx` 3,470-line monolith → 16 focused files) — complete, final review clean.
- **Plan C** (General/Official public-page split: `/verify` = General, `/official` = Official; admin database mgmt split into per-category tabs) — complete; "With fixes" → fix wave `cf07488` → re-review clean.
- **Plan D** (generation-resume + email-delivery visibility + Drive-sharing UI + lint polish) — 13 tasks, complete. Whole-branch review "With fixes" (2 Critical + 5 Important, all in the resume flow / email tally) → one fix wave `1986c6b` → re-review: all addressed, no new breakage. Final HEAD **`1986c6b`**.
  - New: `generationJobs` Firestore collection (API-only, one doc per database, no rules block — deny-by-default covers it); `GET/PUT/DELETE /api/generation-jobs/[databaseId]`; `lib/generationResume.ts`, `lib/emailOutcome.ts`; `Participant.emailError`; `GenerationJob` type incl. `templateId`.
  - Gates green at HEAD: `npx tsc --noEmit`, `npx vitest run` 51/51, `npm run build`.

**Inviolable (Plan C review):** `lib/urls.ts buildVerificationUrl` mints `/verify?certId=` for EVERY cert, Official included — every issued Official QR points at `/verify`. The category-LESS auto-verify on both public pages is what keeps those resolving. Never change auto-verify to pass the page's category.

**Before this branch ships (user-owed — see the `plan-d-branch-state` memory for the full list):** P-1 prod category audit (`node scripts/category-audit.mjs`, MERGE-BLOCKING); P-2 `firestore:indexes` deploy + wait for `certificates(category,recipientName)` Enabled; P-3 Apps Script redeploy; P-4 preview click-through; P-5 post-deploy blue-dot SHA check; plus the Plan D manual passes (spec §11.2 #6-7) — test the forced-404 resume path and rows-selected resume path specifically.

**Parked (latent, 1-line fix):** `CertificateGenerator.tsx` `fullyCovered = completedIds.length >= jobTotal` miscounts if a participant doc lacks an `id` (not reachable in the live data model).

## Session log — 2026-08-29 → 30: Plan E1 (generation / Drive / Sheet reliability)

Branch `feat/plan-e1-generation-drive-reliability` off `main` @ `bd3886f`, 14 tasks via subagent-driven-development, then a whole-branch final-review fix wave (C-1, C-2, I-1..I-7 + minors — see `.superpowers/sdd/2026-08-29-plan-e1-generation-drive-reliability/final-fix-wave-report.md`). HEAD is now this fix-wave commit's SHA (see `git log`).

**What shipped:** Generation state is now derived from participant docs (`lib/generationState.ts` — `classifyParticipant`/`deriveGenerationSummary`/`jobEffectiveStatus`), not the old `generationJobs.completedParticipantIds` ledger. `generationJobs/{id}` doc slimmed to `{ templateId, startedAt, status, startedBy }`. `CertificateGenerator` run set = needs-cert ∪ needs-pdf (∪ complete via checkbox); needs-pdf re-renders the same cert id, no 2nd cert doc; resume auto-starts on `job.templateId`; Phase-3 driveLink batch-update now throws on `!ok` (was silent); cert-doc PATCH failures counted + toasted; one canonical Drive folder id resolved before the concurrent upload loop and passed to every `uploadPDF`. Apps-script.js: new `deleteRows` (match by cert id else name+email), new `consolidateFolders`, `uploadPDF` accepts `folderId`; dead `deleteRowsByCertIds`/`deleteRowsByEmail` removed. `clearCertIdsByEmail` kept (cert-only delete path). New route `POST /api/drive/consolidate`; participant DELETE + bulk-delete now call `deleteRows` (Sheet row removed, not just col A cleared) + use `resolveDriveFileId` so a driveLink-only participant's PDF isn't orphaned. Public `/api/databases/public` computes live `.count()` participant counts. Admin `/api/databases` GET tags each DB `hasUnfinishedJob` → "Unfinished — Resume" card badge. Deleted `lib/generationResume.ts` + its test.

**Gate at HEAD:** `npx tsc --noEmit` clean, `npx vitest run` 64 passed (64), `npx next build` exit 0. Grep sweep: zero hits on `completedParticipantIds|remainingToGenerate|generationResume|deleteRowsByCertIds|deleteRowsByEmail|filterNewOnly|showExistingWarning|participantsToGenerate|jobTotal` across `app/`, `components/`, `lib/`, `tests/`.

**USER-OWED before / at ship** (list, verbatim intent):
- (1) Apps Script web-app redeploy (edit-version, URL unchanged) — `deleteRows` / `consolidateFolders` / `uploadPDF` folderId are inert until then; the delete routes stay best-effort/swallowed in the meantime.
- (2) After push: Vercel blue-dot Production SHA must match the pushed branch HEAD (2 real stale-deploy incidents in this repo).
- (3) Run the plan's "Live smoke test" checklist (9 items: Apps Script redeploy, blue-dot check, `moveTo` sanity, fresh generation, interrupted+resume, consolidate duplicates, participant delete, orphan delete, public page counts).
- (4) STILL owed (pre-existing, NOT E1): the `participants.certificateId` collection-group single-field index exemption — a mistyped cert ID on /verify 500s instead of 404. Out of E1 scope.

**Note:** no new env vars, no firestore.rules changes, no new indexes.

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

## Session log — 2026-08-27: security hardening, correctness fixes, cleanup

Full-scope pass covering security, correctness bugs, dead code/deps, and the start of
the URL-consistency cleanup. Not yet pushed to git (working tree has uncommitted
changes as of session end) — see "Not yet done" below before treating this as shipped.

### Security (closes every gap listed in the previous "flagging, not fixing" section)

1. **Adopted the Firebase Admin SDK** (`lib/firebase.admin.ts`, new). Every API route's
   Firestore access now goes through `getAdminDb()`/`getAdminAuth()` instead of the
   public client SDK — `lib/firebase.ts` is client/browser-only now (`getDb()`,
   `getFirebaseApp()`, both lazy so `next build` doesn't need the env vars present).
   Requires `FIREBASE_SERVICE_ACCOUNT_JSON` (base64-encoded service account JSON) — the
   module throws loudly if it's missing rather than silently falling back.
2. **`firestore.rules` rewritten to deny-by-default.** Only the four client components
   that still talk to Firestore directly (`admin/login`, `admin/reports`,
   `admin/settings`, `AdminSidebar`) get scoped rules; everything else is `if false`
   because the API routes now bypass rules via the Admin SDK. `admins/{uid}` rules pin
   role/status server-side on self-registration (can't self-grant `super_admin` or
   `approved`) and let only an approved super admin read/write other admins' docs.
   **Not verified against the emulator** — this sandbox has no Java/JVM. A full
   emulator test suite is at `tests/rules/firestore.test.ts`, runnable via
   `npm run test:rules` (needs Java on PATH) — run it before trusting these rules in
   production, they were only traced by hand against every call site.
3. **`POST /api/admin/auth` rewritten** to require a real Firebase ID token
   (`{idToken}`), verify it server-side (`verifyIdToken`), and enforce
   `admins/{uid}.status === "approved"` — previously it accepted `{uid, email}` from
   the request body with zero verification (a complete auth bypass) and never checked
   approval status. The legacy shared-password flow (`ADMIN_PASSWORD`, defaulting to
   the literal `"pharmacozyme2026"`) is deleted.
4. **Session cookie is now HMAC-signed** (`lib/session.ts`, Web Crypto so it works in
   `proxy.ts`, route handlers, and tests unchanged). Needs `SESSION_SECRET` env var
   (32+ chars) — rotating it invalidates all sessions. `proxy.ts` now verifies the
   signature/expiry instead of just checking the cookie is non-empty.
5. **Every admin API route now gated** via `requireAdmin()`/`requireSuperAdmin()`
   (`lib/requireAdmin.ts`) — 34 routes total were audited; previously only 4 even
   referenced the cookie, and none of them gated on it. `GET /api/certificates` (full
   recipient PII, unauthenticated) was the worst of these.
6. **Apps Script bridge (`apps-script.js`) now checks a shared secret**
   (`APPS_SCRIPT_SECRET`, read from Script Properties via `isAuthorized()`) on every
   `doPost`/`doGet` — it was previously reachable by anyone who learned the deployment
   URL, which is unavoidably public since the web app must be deployed as "Anyone".
   **Falls back to allow-all with a console.warn if the Script Property isn't set yet**
   — set it in the Apps Script editor (Project Settings → Script Properties) and the
   matching `APPS_SCRIPT_SECRET` env var in Vercel, or this is a no-op.
7. Collapsed 4 duplicated `callAppsScript` implementations into one
   (`lib/appsScript.ts`) so the secret only needed adding in one place.
8. Deleted `/api/test` (public, wrote an unbounded `_connection_test` doc on every GET).

### Correctness bugs fixed

- **Scheduled emails silently marked "sent" when nothing was delivered** — the cron
  dropped `gmailEmail`/`senderName`/`replyTo` when re-POSTing to `/api/send-email` (so
  it always fell through to Resend, never the operator's chosen Brevo sender), and
  never inspected the response before writing `status: "sent"`. Fixed in one shared
  `lib/scheduledEmail.ts::runScheduledJob`, used by both the cron and the
  `scheduled-emails/[id]` "send now"/"retry" action. The Resend no-key path no longer
  reports `success: true` for a simulated send — it now 503s unless
  `ALLOW_SIMULATED_EMAIL=true`.
- **`/verify/{certId}` 404** — nothing served that path; the real page reads
  `?certId=`. Added `app/verify/[certId]/page.tsx` as a redirect, and centralized every
  URL-minting site behind `lib/urls.ts` (`buildVerificationUrl`, `buildCertificateUrl`).
  `CertificateGenerator.tsx`'s live QR-minting path now uses `buildCertificateUrl`
  (→ `/certificate?certId=`) instead of its own `NEXT_PUBLIC_VERIFY_URL`-derived
  `/claim?id=` construction — consistent with the `/claim` → `/certificate` migration
  from the 2026-08-26 session (commit `7ee930a`).
- **Quota-overflow email queue silently dropped recipients** — `quotaFailed` recipients
  (each carrying a full `pdfBase64`) were queued into one `scheduled_emails` doc,
  exceeding Firestore's 1 MiB doc cap for anything past a couple of certificates; the
  write threw into an empty `catch {}` while the response still reported them queued.
  Fixed: `pdfBase64` stripped before queueing, chunked at 200 recipients/doc, and a
  write failure now surfaces as `autoQueueError` in the response.
- **Sheets sort was worse than a no-op** — `getSerial`'s `/(\d+)$/` matched the
  trailing digit of *current* hex IDs too (e.g. `PZ-2026-A1B2C3D4` → `4`), so rows were
  shuffled by whatever digit happened to land at the end of a random hex string, not
  merely left unsorted. New `lib/participantSort.ts::sortParticipantsForSheet` only
  treats an ID as a legacy serial if it doesn't match the current `PZ-{year}-{hex}`
  shape; otherwise sorts by `createdAt` ascending. Used everywhere the old duplicated
  `getSerial` logic lived (`participants`, `participants/batch-update`, `sheets/sync`).
- **CSV/manual-import certificate IDs were only 4 hex chars** (`uuidv4().slice(0,4)`,
  ~65k possible values) — the generate route was fixed for this in the prior session
  but `certificates/import` still had the narrow version. New shared
  `lib/certificateId.ts` (`newCertificateId`, `newBlockchainHash`, `normalizeCertId`)
  used by both surviving mint sites. Import route also actually batches its Firestore
  writes now (it built a `writeBatch` and then never used it) and gives imported
  certs a real `verificationUrl`/`qrCode` (previously absent).
- **`GET /api/verify`'s fallback scan was O(databases × 4) sequential reads** on every
  miss (the common case for a typo). Replaced with one parallel
  `collectionGroup("participants")` query across all 4 case variants; added
  `firestore.indexes.json` with the required field override
  (collection-group indexes aren't automatic).
- Rate limiting (`lib/rateLimit.ts`, and the login attempt limiter) is still per-instance
  in-memory — documented in code comments as not the real control on Vercel's
  serverless model. **Not fixed** — needs a Vercel Firewall rate-limit rule (dashboard
  config, not code) or Upstash Redis; flagging for next session.

### Cleanup

- Deleted: `/api/certificates/generate` (243 lines, zero callers — client-side
  `CertificateGenerator.tsx` does its own generation), `/api/test`, root
  `test-*.js`/`check-*.js` ad hoc scripts, `implementation_plan.md.resolved`.
- Removed unused deps: `nodemailer`, `@types/nodemailer`, `googleapis`, `pdfjs-dist`,
  `storage` (an unrelated package, almost certainly installed by mistake).
- `npm audit`: was 2 critical/8 high/5 moderate. `npm audit fix` (non-breaking) cleared
  the `websocket-driver` critical. Bumped `next`/`eslint-config-next` 16.2.2 → 16.3.3
  (non-major fix, per `npm audit`) clearing the `postcss`/`sharp` high-severity
  advisories. Swapped `xlsx` from the stalled npm registry copy (0.18.5, prototype
  pollution + ReDoS, no npm fix) to SheetJS's own patched CDN build
  (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` — drop-in, same API, user
  confirmed the source-swap explicitly). Remaining: 9 moderate, all inside
  `firebase-admin`'s own transitive `@google-cloud/storage`/`teeny-request` chain — no
  non-breaking fix exists; `npm audit fix --force` would *downgrade* firebase-admin to
  10.3.0, which is npm's resolver being wrong, not a real fix. Left alone.
- Added a test harness (was none): Vitest (`npm test`), 22 unit tests across
  `tests/session.test.ts`, `tests/urls.test.ts`, `tests/certificateId.test.ts`,
  `tests/participantSort.test.ts`, plus the emulator-only `tests/rules/*`. Fixed
  `"lint": "eslint"` (no-op, lints nothing) → `"lint": "eslint ."`.

### Verified this session

`npx tsc --noEmit`, `npx vitest run` (22/22), and `npm run build` all pass clean after
every phase. `npx eslint .` now actually runs (previously a no-op) and surfaces ~148
pre-existing problems across the untouched UI codebase — mostly the `no-explicit-any`
convention used throughout the original code (not fixed, matches pre-existing style),
plus a few genuine ones worth a look: `components/VerificationResult.tsx` calls
`Math.random()` during render (`react-hooks/purity`), `components/Navbar.tsx` uses a
raw `<a>` for internal nav, a couple of unescaped `"` in JSX. Not touched this session
— flagged for the Phase 4 (admin UX) pass.

## Deploy incident — 2026-08-27: Turbopack + firebase-admin ESM crash

Deploying the above session's work to production surfaced a real incident, now fixed:

1. **First deploy attempt did nothing** — the session's 70 changed files were never
   committed, so every Vercel "Redeploy" just rebuilt the old pre-migration commit
   (`3dfcf40`) while the new `firestore.rules` (published straight to Firebase,
   independent of git) were already live. Old client-SDK routes + new deny-by-default
   rules = every Firestore read 500'd. Fixed by committing and pushing
   (`3dfcf40..7f6b15f`) — see git log.
2. **Stale GitHub credential blocked the push** — same issue as the 2026-08-26 session
   (`ditpharmacozyme` cached in Windows Git Credential Manager, no push access to this
   repo). Cleared with `cmdkey /delete:LegacyGeneric:target=git:https://github.com`,
   then the next `git push` prompted a fresh interactive login.
3. **After the real deploy, `/api/admin/auth` 500'd** with
   `Error [ERR_REQUIRE_ESM]: require() of ES Module .../jose/dist/webapi/index.js from
   .../jwks-rsa/src/utils.js not supported`, stack trace through Turbopack's own
   `externalImport` runtime helper. Root cause: `firebase-admin@14.3.0` →
   `jwks-rsa@4.1.0` → hard dependency on `jose@^6.1.3`, which ships pure ESM
   (`"type": "module"`). **First fix attempt** — changed `package.json`'s `build`
   script from `next build` to `next build --webpack` (the documented Turbopack
   opt-out flag), reasoning that Turbopack's externals handling was the culprit.
   Verified locally (built, ran `next start`, confirmed clean) — **this only masked
   the symptom for the one route tested; the deploy still crashed**, including on
   routes that never touch Firebase Auth at all (e.g. `/api/databases/public`, pure
   Firestore). Also spent one round-trip chasing a false lead: the currently-*live*
   Vercel deployment turned out to still be the pre-fix build, because a manual
   "Redeploy" of an older listing had re-promoted it over the newer commit — another
   instance of the stale-deployment trap from step 1. Promoting the correct build
   confirmed the webpack change alone did not fix it: same crash, this time with a
   stack trace through Vercel's own runtime loader (`opt/rust/nodejs.js`), not
   Turbopack — meaning it's not a bundler-choice problem at all.
4. **Actual root cause**: `node_modules/firebase-admin/lib/utils/jwt.js` has an
   **unconditional, module-load-time** `require("jwks-rsa")` at its top (line 24) —
   not lazy, not inside a function. Any file that imports *anything* from
   `"firebase-admin/auth"` triggers this at import time, which is exactly why the
   Firestore-only route crashed too: `lib/firebase.admin.ts` imported
   `firebase-admin/auth` just to expose a `getAdminAuth()` helper, so every consumer of
   that file — including ones that only ever call `getAdminDb()` — pulled in the whole
   broken chain. This is unrelated to Node.js version (Vercel was already on 24.x) and
   unrelated to the bundler (reproduces under both Turbopack and webpack, and even
   under Vercel's own runtime module loader). Upstream tracked at
   [auth0/node-jwks-rsa#493](https://github.com/auth0/node-jwks-rsa/issues/493), open
   since March 2026, unresolved.
   **Real fix**: removed the `firebase-admin/auth` import from `lib/firebase.admin.ts`
   entirely (it now only exports `getAdminDb()` and `getFirebaseProjectId()`). Added
   `lib/verifyFirebaseIdToken.ts`, which verifies Firebase ID tokens manually —
   fetches Google's public certs (`securetoken@system.gserviceaccount.com`, cached
   respecting the endpoint's own `Cache-Control` header, success-only caching per the
   `lib/fonts.server.ts` convention), checks the RS256 signature via `jsonwebtoken`
   (pure CJS, no ESM dependency), and validates `iss`/`aud`/`exp`/`sub`. This is a
   standard, documented pattern for verifying Firebase ID tokens without the full
   Admin SDK. `app/api/admin/auth/route.ts` now calls this instead of
   `getAdminAuth().verifyIdToken()`, wrapped in a try/catch that was previously
   missing (a crash after token verification would have been an unhandled 500 either
   way). Verified locally: built with `next build --webpack` (kept, since it's
   harmless and may still help), ran `next start`, and POSTed a **structurally valid**
   RS256 JWT (correct header/payload shape, so it reaches the actual Google-certs
   fetch code path, not just an early parse-failure) to `/api/admin/auth` — got a
   clean JSON error (missing local `FIREBASE_SERVICE_ACCOUNT_JSON`, expected — no
   `.env.local` in this dev sandbox), with zero trace of `jwks-rsa`/`jose`/`ERR_REQUIRE_ESM`
   anywhere in the server log. Same clean result for `/api/databases/public`.
   **Confirmed working on the live Vercel deployment (commit `a13de09`)** — login,
   admin panel, and Firestore reads all functioning. Incident closed.
5. **Lesson for next time**: after any `git push` intended to deploy, explicitly
   verify (via the Deployments tab) that the git commit shown next to the **live**
   (blue-dot) Production deployment matches the pushed SHA — a "Redeploy" action on an
   older listing can silently re-promote stale code over a newer, already-built one.

### Not yet done from the original plan

- **Firestore rules emulator verification** — see above, needs Java in this sandbox.
- **Phase 4 (admin UX/UI)**: the 3,470-line `admin/databases/page.tsx` monolith,
  bulk-generation resume-on-reload, email delivery visibility in the UI, and general
  polish — not started. Large enough to warrant its own session.
- **Vercel Firewall rate limiting** — dashboard config, can't be done from code.
- **New env vars required before this deploys**: `FIREBASE_SERVICE_ACCOUNT_JSON`,
  `SESSION_SECRET`, `APPS_SCRIPT_SECRET`, and `CRON_SECRET` is now *required* (was
  optional) — see the comments in `.env.example`. **Also requires an Apps Script
  redeploy** (to pick up the `isAuthorized()` check) and a `firestore.rules` deploy.
  Given the prior session's Vercel env-var lesson: a fresh deployment is required after
  setting these, hot-reloading into a running function does not happen.
- **Update**: all of the above, plus the deploy-incident fixes, are committed, pushed,
  and confirmed working in production as of commit `915e30e`. See the "Deploy
  incident" section above for the full trail (stale deployment, then the Turbopack
  red herring, then the real `firebase-admin/auth` fix).

## Requested for next session — split "General" vs "Official" into separate pages

`Database.category` (`lib/types.ts`) is already a hard `"General" | "Official"` field,
seeded in `app/admin/categories/page.tsx` with distinct subcategories per category
(General: Courses/Workshops/Webinars/MED-Q; Official: Central Team/Sub Team/
Ambassadors/Affiliates/Mentors) — but today both categories' databases and
subcategory filter chips are mixed together in one flat list, both on the public
`/verify` page (`components/VerifySearch.tsx`'s subcategory chip row) and in the admin
`admin/databases` page (one flat database list, category is just a creation-time
dropdown field, no split view).

**Requested**: give each category its own public page —
`cert.pharmacozyme.com/verify` for General, `cert.pharmacozyme.com/official` for
Official — instead of one page mixing both. Also split the admin panel's database
management by category (not just as a filter dropdown but as a real separation, e.g.
tabs or distinct sections) so General and Official databases aren't managed in one
undifferentiated list.

Not scoped or designed yet — this needs its own brainstorming/planning pass (routing
approach: new route vs one route with a category param; how much of
`VerifySearch.tsx`/`PublicDatabaseCards.tsx`/`admin/databases/page.tsx` to share vs
fork; whether "Official" gets its own distinct visual identity). Good candidate to
fold into the Phase 4 admin-UX session below, since it touches the exact same files
that session is already going to be restructuring.

## Session log — 2026-09-02: Sheet header mapping + editor fixes

Branch `feat/sheet-header-mapping` implementing header-driven sheet model, Apps Script
read/write rewrite, and three UI/rendering bug fixes. All tasks complete and reviewed
clean. Committed but **requires Apps Script redeploy + live steps before ship** (see below).

**What shipped:**

- **Header-name sheet model** — linked Google Sheet's header row is now the source of truth.
  Managed columns (Name, Email, Certificate ID, Certificate URL, Status, Issue Date,
  Emailed, Drive Link, Created At, plus aliases) are matched by header name; every other
  column is a custom field keyed by its exact header text, bound to template placeholders
  via `sourceField`. New pure module `lib/sheetSchema.ts` with `resolveManagedField`,
  `buildHeaderMap`, `MANAGED_LABELS`, `splitImportedRow`, `lookupBoundValue`.
- **`apps-script.js` syncData read + write rewritten** — header-driven, row-matched by
  name+email. Write path never clears or reorders a column it doesn't own, so custom
  columns survive (critical: resync on future changes won't clobber user data).
  `updateCertIds` / `upsertRow` / `clearCertIdsByEmail` / `deleteRows` made header-aware
  via shared `managedColMap_` helper. `addHeaders` reordered to canonical order.
- **`/api/sheets/sync`** sends `participants` (9 managed fields + custom map) instead of
  positional rows; reads `rec.custom` from the Apps Script read.
- **CSV/Excel import** (`ImportModal`, `app/api/participants/route.ts`) uses the same
  `resolveManagedField` split.
- **Bug 1 (template rendering)** — `lib/templateBytes.ts` `fetchTemplatePdf`: stored
  `pdfBase64` → Drive public URL → Apps Script `getTemplateBytes` fallback. Rendering
  and preview no longer depend on Drive link-sharing (avoids 403 if Workspace domain
  blocks "anyone with link" — file still uploads but falls back to serverless fetch).
  `pdfBase64` cached on the template doc. Sharing-failure toast downgraded to info.
- **Bug 2 (editor zoom)** — `transform: scale()` zoom control (50–200% + Fit) on the
  template-editor canvas; markers scale with the background; drag placement is
  zoom-invariant.
- **Bug 4 (preview)** — certificate-preview modal has Fit page / Actual size toggle;
  A4-portrait certificates no longer clip.
- **Bound-column matching case/whitespace-insensitive** — `lookupBoundValue` normalizes
  header names when resolving participant values.

**Manual steps owed at ship:**

1. Apps Script web-app redeploy (edit version, URL unchanged) — `syncData` rewrite +
   `getTemplateBytes` are inert until then.
2. Restore "EL" tab of "Official Certificates" sheet from Google Sheets version history
   (generation had overwritten its custom columns before this fix landed).
3. Regenerate certificate `2026-PZ-CTM-0001` (was issued with blank bound fields before
   the fix).
4. Run the plan's Live smoke test checklist (9 items in
   `docs/superpowers/plans/2026-09-02-sheet-header-mapping-and-editor-fixes.md`).
5. Vercel blue-dot Production SHA check after deploy (verify git commit shown in
   Deployments matches the pushed branch HEAD).

**Verification at HEAD:** `npx tsc --noEmit`, `npx vitest run`, `npx next build` all pass.

## Loose ends / debug cruft

- `graphify-out/graph.json` + the Graphify instructions in `AGENTS.md` imply a
  `graphify auto-update` CLI is expected to run after every edit — confirmed this
  session it is **not installed** (`graphify: command not found`); skipped rather than
  worked around.
