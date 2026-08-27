# General/Official Split + Phase 4 Admin UX — Design

**Date:** 2026-08-27
**Status:** Approved, pending implementation plan
**Scope:** One session. Live production app (`cert.pharmacozyme.com`), real users.

---

## 1. Problem statement

Two pieces of work, deliberately folded into one session because they touch the
same files (`app/admin/databases/page.tsx`, `components/VerifySearch.tsx`,
`components/PublicDatabaseCards.tsx`, and every certificate/participant/database
delete call site):

1. **General vs Official split.** `Database.category` is already a hard
   `"General" | "Official"` field, but both categories are mixed into one flat
   list on the public `/verify` page and in the admin database manager. Each
   category should get its own public page and its own admin view.

2. **Phase 4 admin UX.** The 3,470-line `app/admin/databases/page.tsx` is a single
   component and needs breaking up. Bulk certificate generation runs entirely in
   the browser and restarts from zero on reload. Email delivery status in the UI
   is optimistic (reports "sent" without checking). Certificate/folder deletion
   leaves orphaned files in Google Drive.

---

## 2. Decisions (locked)

| Question | Decision |
| --- | --- |
| Public routing shape | **Fork the pages fully.** `/official` is its own route with its own components, free to diverge from `/verify`. |
| Official visual identity | **Same design as General for now**, only labels/data differ. The fork exists so Official *can* diverge later without touching General. |
| Cross-category lookup | **Hard wall + redirect hint.** Each page only searches its own category. An ID found in the other category shows "This is an Official certificate — verify it at …" with a link. |
| Admin split shape | **One route, top-level tabs.** `/admin/databases?cat=general|official`, tab bar filters list / create / bulk ops. |
| Bulk generation resume | **Resumable, still client-driven.** Firestore job doc + chunked writes + resume banner. No new server infra. |
| Email delivery status | **Trustworthy counts only.** Real per-recipient outcome tallied, failed list with retry. No per-row status model, no provider webhooks. |
| Drive cleanup | **Server-authoritative cascade.** One server call owns file + folder + doc + sheet cleanup on every delete path. |
| Drive access for operators | **Guaranteed Anyone-with-link sharing** on every artifact the app creates, plus an `ensurePublic` retro-fix action. Bridge owner account must permit link sharing. |

---

## 3. Non-goals

- No visual redesign of the Official page (same as General day one).
- No server-side generation worker / queue.
- No provider (Brevo/Resend) delivery webhooks or per-recipient delivery-state model.
- No sweep of Drive orphans that **already** exist (fix stops new ones; a one-time
  cleanup is a separate task).
- Not fixing the ~140 pre-existing `no-explicit-any` eslint findings (house style).
- No change to certificate minting, QR encoding, or the `/certificate` claim page
  (QR encodes `/certificate?certId=`, which is category-agnostic and stays that way).

---

## 4. Public pages — forked General / Official

### 4.1 Routes

- `app/verify/page.tsx` — stays. Scoped to General.
- `app/official/page.tsx` — **new**, fork of `verify/page.tsx`. Scoped to Official.
  Heading/badge copy: "Official Certificates" / "Verify Official Recognition".
  Reuses the existing hero video assets until dedicated Official assets exist.
- `app/verify/[certId]/page.tsx` — unchanged. Legacy redirect lands on `/verify`;
  the hard-wall hint on `/verify` handles an Official cert from there.
- `app/page.tsx` — unchanged, redirects to `/verify`.

### 4.2 Components

**New (forked):**

- `components/OfficialSearch.tsx` — fork of `VerifySearch.tsx`.
  `SUB_CATS` restricted to the Official set:
  `["Central Team", "Sub Team", "Ambassadors", "Affiliates", "Mentors"]`.
  Every API call sends `category=Official`.
- `components/OfficialDatabaseCards.tsx` — fork of `PublicDatabaseCards.tsx`.
  Fetches `/api/databases/public?category=Official`.

**Changed:**

- `components/VerifySearch.tsx` — `SUB_CATS` restricted to the General set:
  `["Courses", "Workshops", "Webinars", "MED-Q"]`. All API calls send
  `category=General`.
- `components/PublicDatabaseCards.tsx` — fetches
  `/api/databases/public?category=General`.

**New (shared leaves — mechanical, no product logic):**

- `components/verify/shared/ResultCard.tsx`
- `components/verify/shared/SkeletonCard.tsx`
- `components/verify/shared/IdlePlaceholder.tsx`
- `components/verify/shared/format.ts` — `avatarGradient`, `initials`, `fmtDate`,
  `AVATAR_GRADIENTS`.

The page shell, the search-mode orchestration (`id` / `name`, debounce, dropdown,
sub-category chip row), and the card grid stay **forked** between General and
Official so they can diverge later. Only the leaf presentational pieces are
shared, keeping each fork to roughly its own ~200-line shell rather than ~1300
duplicated lines.

### 4.3 API changes

- **`GET /api/databases/public`** — add optional `?category=General|Official`
  query param. Absent → return all live databases (backward compatible). Present →
  filter `where("category", "==", category)` in addition to the existing
  `isLive == true`.

- **`GET /api/search-name`** — add optional `?category=General|Official`.
  When present:
  - Search 1 (certificates collection): add `category` equality filter alongside
    the existing `recipientName` range. Requires a composite index
    (`category` ASC, `recipientName` ASC) — add to `firestore.indexes.json`.
  - Search 2 (participants subcollections): skip any database whose
    `category !== param`.

- **`GET /api/verify`** — behavior change when `?category=` is present:
  - Currently: on a category mismatch it returns a generic 404
    ("Certificate found but does not match the selected category/subcategory.").
  - New: when the mismatch is specifically a **category** mismatch (not
    sub-category), return
    `{ error, mismatch: true, actualCategory: "Official", certId }` with status
    404. Sub-category mismatch behavior is unchanged.
  - The forked page catches `mismatch: true` and renders a dedicated panel:
    > This is an **Official** certificate.
    > Verify it at [cert.pharmacozyme.com/official](…)   **[Verify there →]**

    The button navigates to `/official?certId=<id>` (or `/verify?certId=<id>`
    from the Official page). Symmetric both directions.

### 4.4 Navbar

- `components/Navbar.tsx`:
  - Replace the raw `<a href="/verify">` internal link with `next/link`
    (fixes the `@next/next/no-html-link-for-pages` eslint finding).
  - Add an "Official" link next to "Verification".
  - Active underline driven by `usePathname()` (component becomes a client
    component, or a small client sub-component holds the nav links).

---

## 5. Admin database manager — break up + category tabs

### 5.1 Target structure

`app/admin/databases/page.tsx` (currently 3,470 lines, one `"use client"`
component) becomes a thin wrapper. Logic moves to `components/admin/databases/`:

| File | Responsibility |
| --- | --- |
| `DatabaseManager.tsx` | Top-level state, data fetching, handler wiring. Takes `category: "General" \| "Official"`. Renders list or detail view. |
| `useDatabaseManager.ts` | The shared state + handlers extracted from the monolith (databases, participants, selection, sort/filter, undo/redo history, all the fetch calls). Keeps `DatabaseManager.tsx` readable. |
| `DatabaseList.tsx` | Card grid of databases, live toggle, inline rename, "create" entry point. Filtered to `category`. |
| `DatabaseDetail.tsx` | Selected-database header, breadcrumb, Sheets/Drive tool groups, primary actions. |
| `ParticipantTable.tsx` | Sticky toolbar (actions, search, sort, filter chips), the table itself, keyboard row selection. |
| `ParticipantRow.tsx` | One row: inline edit of name/email/certId, generation status, issuance status, emailed status, per-row action dropdown. |
| `BulkActionsBar.tsx` | Bulk generate / send / delete / clear, and the bulk-target ("all" vs "selected") flow. |
| `GenerationResumeBanner.tsx` | Shows when an unfinished generation job exists for the open database (see §6). |
| `modals/CreateDatabaseModal.tsx` | Create form + Google Sheet linking. Category is **locked to the active tab**. |
| `modals/AddParticipantModal.tsx` | Single + bulk-paste add. |
| `modals/ImportModal.tsx` | CSV/Excel import + preview. |
| `modals/EmailModal.tsx` | Email compose, per-account daily-limit banner, send-mode toggle, schedule, send with real-outcome reporting (see §7). |
| `modals/ExportModal.tsx` | Export participants. |
| `modals/IdFormatModal.tsx` | The app/name/custom ID-format chooser. |

`SENDER_IDENTITIES` and `categoryStructure` move to a shared module
(`lib/certificateTaxonomy.ts` or `components/admin/databases/constants.ts`).

### 5.2 The wrapper

`app/admin/databases/page.tsx`:

```tsx
"use client";
// reads ?cat= (default "general"), renders a tab bar, mounts <DatabaseManager category={...} />
```

- Tab bar: `[ General (n) ] [ Official (n) ]` with live counts.
- URL state: `?cat=general|official`, via `useSearchParams` + `router.replace`.
  Default `general` when absent or invalid.
- Switching tabs: clears the selected database, resets filters, re-scopes the list.
- `DatabaseManager` receives `category` and:
  - `GET /api/databases` then filters client-side by `category` (the route returns
    all; no API change needed — small dataset), OR add an optional
    `?category=` filter to `GET /api/databases` for cleanliness. **Decision:**
    filter client-side, no API change — keeps the refactor behavior-preserving.
  - Create modal defaults + locks `category` to the tab.
  - All bulk operations stay within the tab's filtered set.

### 5.3 Refactor discipline

This is a large mechanical change to a live file. Order:

1. Extract pure helpers and constants first (no behavior change).
2. Extract leaf components (modals, `ParticipantRow`) with props threaded from the
   still-monolithic parent. Verify build + manual smoke after each.
3. Extract `useDatabaseManager` hook.
4. Split `DatabaseList` / `DatabaseDetail` / `ParticipantTable`.
5. Only once the component tree is stable: add the `?cat=` wrapper + tabs.

`npx tsc --noEmit`, `npx vitest run`, `npm run build` green at every step.
No behavior change until step 5.

---

## 6. Bulk generation — resume on reload

### 6.1 Current behavior

`components/CertificateGenerator.tsx` runs all phases in the browser:
render (20 concurrent) → one batch Firestore write at ~65% → Drive uploads
(5 concurrent) → sheet sync. A tab reload mid-run loses all un-written progress
and restarts from participant zero. It already skips participants that carry a
`certificateId`, so certs written before the reload are not regenerated — but
anything rendered-but-not-yet-written is lost, and the operator has no signal
that a run was interrupted.

### 6.2 Design

**Firestore collection `generationJobs`, one doc per database, id = `databaseId`:**

```ts
interface GenerationJob {
  databaseId: string;
  total: number;
  completedParticipantIds: string[];
  phase: "rendering" | "drive-upload" | "sheet-sync";
  startedAt: string;      // ISO
  updatedAt: string;      // ISO
  startedBy: string;      // admin email from session
}
```

**`app/api/generation-jobs/[databaseId]/route.ts`** — new, `requireAdmin`:
- `GET` → the job doc or `404`.
- `PUT` → upsert (merge) the job doc. Body validated: `total` number,
  `completedParticipantIds` string array, `phase` enum.
- `DELETE` → remove the job doc (called on clean completion or "Discard").

**`components/CertificateGenerator.tsx` changes:**
- On start: `PUT` the job doc with `total`, empty `completedParticipantIds`,
  `phase: "rendering"`.
- Replace the single batch write at 65% with **chunked writes every 25
  rendered certs**. After each chunk: batch-update participants + cert docs for
  that chunk, then `PUT` the job doc appending those participant ids and bumping
  `updatedAt`.
- Drive-upload phase: set `phase: "drive-upload"`; the chunk loop already exists,
  checkpoint `completedParticipantIds` is not needed for Drive (idempotent retry
  via the "Missing Drive Link" filter already covers it) but bump `updatedAt` so
  the job doesn't look stale.
- On clean finish: `DELETE` the job doc.
- On resume (see below): load `completedParticipantIds`, filter them out of
  `participantsToGenerate` in addition to the existing `certificateId` check,
  continue from the render phase.

**`GenerationResumeBanner.tsx` (in `DatabaseDetail`):**
- On database open, `GET /api/generation-jobs/{databaseId}`.
- If a job exists and `updatedAt` is within 24h:
  > ⚠️ Generation was interrupted — **240 of 500** done.
  > **[Resume]**  **[Discard]**
- **Resume** → opens the generator modal in resume mode (skips completed ids).
- **Discard** → `DELETE`s the job doc, banner disappears.
- If `updatedAt` older than 24h: treat as stale, show a lighter "Discard old
  generation job?" prompt, same `DELETE` action.

### 6.3 Types

Add `GenerationJob` to `lib/types.ts`.
Add unit tests for the resume filter (given a participant list + a
`completedParticipantIds` set + existing `certificateId`s → correct remaining set)
in `tests/generationResume.test.ts`.

---

## 7. Email delivery — trustworthy counts

### 7.1 Current behavior

`EmailModal` (inside the monolith) loops recipients calling `POST /api/send-email`,
tracks `sendProgress {current, total}`, and shows `emailStats` aggregate
(per-account daily limits). It does not tally real per-recipient success/failure —
the progress bar advancing is the only feedback, and a failed send is not
surfaced distinctly.

The scheduled-email path was already fixed this session
(`lib/scheduledEmail.ts::runScheduledJob`) to inspect the response before marking
`sent`.

### 7.2 Design

**Send loop (`EmailModal`):**
- For each recipient, record the real outcome:
  `{ participantId, email, ok: boolean, error?: string, queued?: boolean }`.
  `queued` = the send was deferred to `scheduled_emails` (quota overflow or
  scheduled mode).
- On completion, replace the optimistic summary with:
  > **412 sent · 6 failed · 82 queued**
- **Failed list**: a collapsible panel listing failed recipients (name + email +
  error message) with a **[Retry failed]** button that re-runs the send loop for
  only those participants.
- Persist minimal state on the participant:
  - Keep existing `emailSent` / `emailSentAt`.
  - Add `emailError?: string` (cleared on a subsequent successful send).
  - `ParticipantRow` "Emailed" column: unchanged yes/no, but a failed send shows a
    small red "failed" marker with the error on hover (reads `emailError`).

**Aggregate (`/api/email-stats`):**
- Audit that the returned `sent` counts reflect real send results. The route
  reads from `scheduled_emails` / an email-log source — confirm it counts
  delivered/attempted correctly and not just "rows written". Fix if it
  over-reports (mirror of the scheduled-email correctness fix).

**Types:** add `emailError?: string` to `Participant` in `lib/types.ts`.

**Tests:** `tests/emailOutcome.test.ts` — given a set of per-recipient results,
the summary tally (`sent` / `failed` / `queued`) is correct; a mixed batch with
one throw does not abort the loop.

---

## 8. Polish

- `components/VerificationResult.tsx` — `Math.random()` called during render
  (`react-hooks/purity`). Move the randomised value into `useMemo(() => …, [])`
  (or `useState` initialiser) so it is stable across renders.
- `components/Navbar.tsx` — raw `<a>` for internal nav → `next/link` (done in §4.4).
- Fix the handful of unescaped `"` in JSX flagged by eslint (exact files from
  `npx eslint .` output — `VerificationResult.tsx` and one or two others).
- Do **not** touch `no-explicit-any` occurrences.

---

## 9. Drive cleanup on delete — server-authoritative cascade

### 9.1 Current behavior (all broken or incomplete)

| Delete path | Drive file | Drive folder | Cert doc | Problem |
| --- | --- | --- | --- | --- |
| `CertificateTable` "Delete" → `DELETE /api/certificates?id=` | ❌ | — | ❌ | Route reads `uniqueCertId`, caller sends `id` → **400, nothing deleted**. |
| Monolith per-row / bulk delete | ✅ via separate `DELETE /api/drive-upload?fileId=` call | — | ✅ via separate call | 2–3 uncoordinated client fetches; any partial failure orphans the rest. |
| `DELETE /api/participants/[id]` | only if `?deletePdf=true` | — | ❌ **never deletes `certificates/{uniqueCertId}`** | Orphaned cert doc + (by default) orphaned Drive file. |
| `DELETE /api/databases?id=` | ✅ per participant (`deletePDF` by `driveFileId`) | ❌ **`driveFolderId` folder never deleted** | ✅ | Folder orphaned in Drive. No `deleteFolder` action exists. |

### 9.2 Design

**`apps-script.js`:**
- Add a `deleteFolder` action:
  ```js
  function deleteFolder(payload) {
    try {
      DriveApp.getFolderById(payload.folderId).setTrashed(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
  ```
  Wired into the `doPost` switch alongside `deletePDF`. Best-effort — a failure
  here must never block the Firestore deletion.
- Requires an Apps Script redeploy to take effect (documented in CONTEXT.md's
  deploy checklist).

**`lib/driveCleanup.ts` (new):**
```ts
export async function deleteDriveFile(fileId: string): Promise<boolean>;   // true = bridge reported success
export async function deleteDriveFolder(folderId: string): Promise<boolean>;
export function fileIdFromLink(link?: string | null): string | null; // /file/d/<id>/ or ?id=<id>
export async function ensureDrivePublic(t: { fileId?: string; folderId?: string }): Promise<{ shared: boolean }>;
```
All best-effort: call `callAppsScript`, catch, `console.error`, return `false`.
Never throw. Guarded by `appsScriptConfigured()`. The boolean return lets
`deleteCertificateCascade` report an accurate `driveFileDeleted` instead of
"a fileId existed".

**`DELETE /api/certificates` (collection route):**
- Accept **`id` OR `uniqueCertId`** (fixes the `CertificateTable` call without
  changing the client).
- New cascade:
  1. Read the cert doc(s).
  2. `deleteDriveFile` for `driveFileId` (or `fileIdFromLink(driveLink)`).
  3. Delete the cert doc(s).
  4. If the cert references `databaseId` + `participantId`, clear that
     participant's `certificateId` / `certificateUrl` / `verificationUrl` /
     `driveLink` / `driveFileId` and set `status: "pending"`, `emailSent: false`.
  5. If that database has a linked sheet, `clearCertIdsByEmail` for the
     participant's email (reuse existing action).
- `?clearParticipant=false` opts out of steps 4–5 (default: clear).
- **`?keepPdf=true` opts out of step 2** (default: delete the PDF). Added
  post-review: the admin UI has three separable operations — "Delete ID Only"
  (keep the PDF), "Delete PDF Only", and "Delete Both" — and the confirm text of
  the first promises the PDF survives. `deleteCertificateCascade` therefore takes
  `deleteDriveFile?: boolean` (default `true`); when `false` it skips the Drive
  delete **and** leaves the participant's `driveLink` / `driveFileId` intact
  (only `certificateId` / `certificateUrl` / `verificationUrl` / `status` are
  reset). The "Delete ID Only" call sites pass `?keepPdf=true`.

**`DELETE /api/certificates/[id]`:** delegate to the same helper, or remove its
`DELETE` export (grep confirms no caller — but keep it delegating for safety).

**`DELETE /api/participants/[id]`:**
- Drive-file deletion becomes the **default** when `driveFileId` (or a parseable
  `driveLink`) is present. `?keepPdf=true` opts out.
- Also delete the associated `certificates` doc(s) (`where uniqueCertId ==
  participant.certificateId`) and their Drive files — via the §9.2 cert helper so
  the logic lives in one place.
- **`?keepCert=true` opts out of the certificate cascade entirely** (default:
  cascade). Added post-review: the `undo` / `redo` handlers delete a participant
  and then re-`POST` an identical one to reverse an edit — that round-trip must
  not revoke the certificate or trash its PDF. Undo/redo pass
  `?keepPdf=true&keepCert=true`.
- Existing sheet cert-id clear stays.

**`DELETE /api/databases?id=`:**
- The participant-cleanup loop also **deletes each participant's `certificates`
  doc** (via `deleteCertificateCascade({ uniqueCertId, clearParticipant: false })`
  when `certificateId` is set) — a bare database delete otherwise leaves every
  cert ID still resolving in `/api/verify`. Drive-file deletion in the loop uses
  `deleteDriveFile(driveFileId || fileIdFromLink(driveLink))`, not a hand-rolled
  `deletePDF` call.
- After the participant loop and template cleanup, if `dbData.driveFolderId`:
  `await deleteDriveFolder(dbData.driveFolderId)`. Best-effort, logged.
- Response message updated to mention the folder.

**Bulk delete paths in the admin UI:**
- Replace the client-side `Promise.all` fan-out of `drive-upload` + `certificates`
  + `batch-update` calls with a single server endpoint that performs the cascade
  per participant. **Decision:** new `POST /api/participants/bulk-delete` taking
  `{ databaseId, participantIds, deleteCerts, deletePdfs }`, reusing the §9 helpers.
- The route **caps `participantIds` (reject >500 with a 400)**, processes in
  **chunks of ~5 concurrently** (matching `CertificateGenerator`'s existing
  concurrency), and issues **one batched `clearCertIdsByEmail`** for all deleted
  participants' emails at the end (the per-item cascade runs with
  `clearParticipant: false`, so the sheet clear must happen once here).

**UI confirm copy:**
- Single cert delete: "Delete this certificate? This also removes the PDF from
  Google Drive and resets the participant to pending."
- Database delete: "Delete this database, its N participants, their Drive files,
  and the database's Drive folder?"

### 9.3 Tests

- `tests/driveCleanup.test.ts` — `fileIdFromLink` parses the two known link
  shapes and returns `null` for junk.
- Cascade routes are integration-shaped (need Firestore) — cover with manual
  verification in §11.2, not unit tests, consistent with the repo's current
  test boundary (no Firestore emulator in this sandbox).

---

## 10. Team access to Drive artifacts (personal-email operators)

### 10.1 The "Unauthorized" bug — fix first, config only

`admin/templates` template upload fails with
`Failed to create template — Details: Drive upload failed: Unauthorized`.

Traced: `app/api/templates/route.ts:66` throws
`Drive upload failed: ${driveData.error}`, and `"Unauthorized"` is the literal
string `apps-script.js:72` returns when `isAuthorized(payload)` is false —
i.e. `payload.secret !== PropertiesService.getScriptProperties()
.getProperty("APPS_SCRIPT_SECRET")`.

Root cause: the 2026-08-27 security pass added the shared-secret gate. The Script
Property is set (otherwise `isAuthorized` falls through to allow-all), but the
Vercel `APPS_SCRIPT_SECRET` env var is unset, mismatched, or was set after the
last deployment (env vars bake in at deploy time, never hot-reload — the repeated
lesson in CONTEXT.md). Every Drive + Sheets bridge call is affected, not just
template upload — the operator just hit template upload first.

**The Apps Script `{error:"Unauthorized"}` is purely the shared-secret check** —
`isAuthorized()` at `apps-script.js:70`, `payload.secret === ScriptProperties`.
There is no per-user / email allowlist in `apps-script.js`. The `secret` is sent
server-side by the Vercel function, so the outcome is identical for every
logged-in admin. If the error appears for one operator's browser but not
another's, they are hitting **different deployments**: the likeliest cause is
`APPS_SCRIPT_SECRET` set only in Vercel's **Production** environment scope while
the failing browser reaches a Preview / branch / `*.vercel.app` build that has no
secret. Enable the env var for **Production, Preview, and Development** and
redeploy; confirm the failing browser's address bar is `cert.pharmacozyme.com`,
not a `*.vercel.app` alias.

**Fix (no code change):**

1. Vercel → Project → Settings → Environment Variables: `APPS_SCRIPT_SECRET`
   exists for **Production** and its value is byte-for-byte the Apps Script
   Script Property value (Apps Script editor → Project Settings → Script
   Properties → `APPS_SCRIPT_SECRET`).
2. Apps Script → Deploy → Manage deployments: the active `/exec` deployment is
   the latest code version (redeploy if not).
3. Trigger a **fresh Vercel production deployment** (new build — not a "Redeploy"
   of an older listing).
4. Verify: template upload **and** a Sheet sync both succeed.

On the critical path — blocks the team today. Do this before the implementation
work.

### 10.2 Guaranteed public-link sharing

The operators use the app from personal Google accounts. They never touch Drive
directly — every Drive operation runs as the single Apps Script owner account
("execute as: me"). So "the team must be able to upload files and access folders"
resolves to:

- the bridge must work for them (§10.1), **and**
- every folder/file the app creates must be **Anyone-with-link (Viewer)** so any
  operator or recipient can open and re-share it without being added explicitly.

CONTEXT.md's 2026-08-27 session already made the `setSharing` calls best-effort
try/catch — meaning a silent failure (a Workspace domain sharing policy, or a
transient error) leaves the artifact private, which is exactly this complaint.

**Code changes:**

- `apps-script.js` — every artifact-creating action (`uploadPDF`,
  `uploadTemplate`, `createNewSheet`) applies
  `setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)` to
  **the file it created**. Still wrapped so a sharing failure never aborts the
  upload — the action's JSON response carries `shared: true | false`.
  **Folder sharing (revised post-review):** only **app-created** folders are
  shared, and only **once, at creation** — the per-database certificate subfolder
  in `getOrCreateFolder`, and the `DRIVE_FOLDER_NAME` parent only on the
  by-name-creation fallback path. `uploadPDF` / `uploadTemplate` do **not**
  re-share the folder on every file (redundant, and it burns `setSharing` quota
  on the concurrent-upload path CONTEXT.md flags as already flaky). The
  pre-existing operator-supplied `TEMPLATES_FOLDER_ID` / `DRIVE_FOLDER_ID`
  folders are **never** auto-shared — flipping a folder the app did not create to
  anyone-with-link would expose unrelated content. Making an existing folder
  public is only ever done through the explicit `ensurePublic` action (the "Fix
  folder sharing" button).
- New `ensurePublic` action: `{ fileId?, folderId? }` → re-applies
  `ANYONE_WITH_LINK` / `VIEW`. Lets the app retro-fix anything created while
  sharing was silently failing. Best-effort, returns `{ success, shared }`.
- `lib/driveCleanup.ts` gains a sibling module or the same file gains
  `ensureDrivePublic(target)` wrapping the new action.
- Artifact-creating API routes (`templates`, `drive-upload`, `databases/drive-folder`)
  read `shared` from the bridge response; when `false`, still return the artifact
  but with `sharingFailed: true`.

**UI changes:**

- Templates page + `DatabaseDetail` Drive tool group: when a response carries
  `sharingFailed`, show
  "Uploaded — but the Drive link is not public yet. **[Make public]**" calling
  `ensurePublic`.
- `DatabaseDetail`: an always-available **"Fix folder sharing"** action on the
  database's Drive folder (calls `ensurePublic` with the `driveFolderId`).

**Config / documentation** (`.env.example` comment + a CONTEXT.md note):

- The Apps Script owner account **must** be one where `ANYONE_WITH_LINK` sharing
  is permitted. A personal Gmail account satisfies this. A Google Workspace
  account whose admin restricts external link sharing does **not** — the files
  upload but stay private and **no code change can override the domain policy**.
  If the bridge account is Workspace-restricted: loosen the policy for that
  account/OU, or move the bridge to a personal account.

### 10.3 Bundling

`deleteFolder` (§9), `ensurePublic`, and the sharing changes are all
`apps-script.js` edits needing one Apps Script redeploy — do them in a single
`apps-script.js` change and one redeploy.

### 10.4 Tests

`apps-script.js` has no runtime here — covered by §11.2 manual verification:
after redeploy, upload a template and generate a certificate, then open both
Drive links in a logged-out / incognito browser — both must load with no
permission prompt. After a delete, both must 404.

---

## 11. Testing & rollout

### 11.1 Automated (must be green before every push)

- `npx tsc --noEmit`
- `npx vitest run` — existing 22 + new: `generationResume`, `emailOutcome`,
  `driveCleanup`.
- `npm run build`

### 11.2 Manual verification

1. **Public split:** `/verify` shows only General databases + General sub-category
   chips; `/official` shows only Official. Name search on each is scoped.
2. **Cross-category hint:** enter an Official cert ID on `/verify` → "This is an
   Official certificate" panel with a working link to `/official?certId=…`.
   Reverse direction too.
3. **Legacy redirect:** `/verify/PZ-2026-XXXXXXXX` still resolves (General) /
   shows the hint (Official).
4. **Admin tabs:** `/admin/databases` defaults to General; switching to Official
   re-scopes the list, create modal locks category, counts in tab labels correct.
5. **Refactor smoke:** create DB, add participants, import CSV, edit a row inline,
   sort/filter, bulk select — all still work post-split.
6. **Bulk generation resume:** start a ~30-participant generation, reload the tab
   mid-render, confirm the resume banner appears with a correct count, click
   Resume, confirm only the remaining participants are processed and no duplicate
   cert IDs are minted. Click Discard on a fresh job → banner clears.
7. **Email counts:** send to a small list including one address forced to fail
   (invalid domain) → summary shows `N sent · 1 failed`, failed panel lists it,
   Retry failed re-attempts only that one.
8. **Drive cleanup:**
   - Delete a certificate from the standalone certificates table → cert doc gone,
     Drive file trashed, participant back to pending.
   - Delete a participant with a generated cert → participant, cert doc, and Drive
     file all gone.
   - Delete a whole database → participants, cert docs, all Drive files, **and the
     Drive folder** trashed.
9. **Drive sharing (§10.2):** after the Apps Script redeploy, upload a template
   and generate a certificate, then open both Drive links in an incognito /
   logged-out browser — both load with no permission prompt. Force a sharing
   failure is not reproducible here without a restricted account; instead confirm
   `ensurePublic` ("Make public" / "Fix folder sharing") returns success on an
   already-public folder.

### 11.3 Config prerequisites — do before any implementation

1. **`APPS_SCRIPT_SECRET` (§10.1)** — Vercel Production env var must equal the
   Apps Script Script Property; fresh Vercel deploy after setting it. This is
   currently broken and blocks all Drive/Sheets bridge calls.
2. **Bridge owner account (§10.2)** — confirm the Apps Script owner account
   permits `ANYONE_WITH_LINK` sharing (personal Gmail = yes; restricted Workspace
   = no).

### 11.4 Deploy checklist (this repo's history)

- New env / config: **none new** for the code work. Pre-existing
  `APPS_SCRIPT_SECRET` must be correct (§11.3).
- **`apps-script.js` redeploy** carries `deleteFolder` (§9) + `ensurePublic` and
  the sharing changes (§10) — one redeploy for all three.
- New Firestore index for `/api/search-name` category filter — deploy
  `firestore.indexes.json` **first**, before the code that queries it ships.
- `firestore.rules` — `generationJobs` is API-only (Admin SDK), stays `if false`
  in the deny-by-default rules. No rules change.
- Work on branch `feat/general-official-split`, fast-forward merge to `main`
  when green (keeps this repo's linear history).
- After `git push`: open the Vercel **Deployments** tab and confirm the commit
  SHA next to the live (blue-dot) **Production** deployment matches the pushed
  SHA. Do not trust a "Redeploy" — it can re-promote stale code (two incidents
  this session from skipping this check).
- Sequence: `firestore.indexes.json` deploy → `apps-script.js` redeploy →
  Vercel production deploy → verify blue-dot SHA → §11.2 manual pass.

---

## 12. File-change summary

**New:**
- `app/official/page.tsx`
- `components/OfficialSearch.tsx`, `components/OfficialDatabaseCards.tsx`
- `components/verify/shared/{ResultCard,SkeletonCard,IdlePlaceholder}.tsx`,
  `components/verify/shared/format.ts`
- `components/admin/databases/*` (≈14 files per §5.1)
- `app/api/generation-jobs/[databaseId]/route.ts`
- `app/api/participants/bulk-delete/route.ts`
- `lib/driveCleanup.ts` — file/folder delete + `ensureDrivePublic` + `fileIdFromLink`
- `tests/generationResume.test.ts`, `tests/emailOutcome.test.ts`,
  `tests/driveCleanup.test.ts`

**Changed:**
- `app/verify/page.tsx`, `components/VerifySearch.tsx`,
  `components/PublicDatabaseCards.tsx` — General-scoped
- `components/Navbar.tsx` — `next/link`, Official link, active state
- `components/VerificationResult.tsx` — `Math.random()` → `useMemo`
- `app/admin/databases/page.tsx` — reduced to a tab wrapper
- `app/admin/templates/page.tsx` — surface `sharingFailed` + "Make public"
- `app/api/databases/public/route.ts` — `?category=` filter
- `app/api/search-name/route.ts` — `?category=` filter
- `app/api/verify/route.ts` — `mismatch` payload on category mismatch
- `app/api/certificates/route.ts` — accept `id`, Drive+participant cascade
- `app/api/certificates/[id]/route.ts` — delegate DELETE to the cascade helper
- `app/api/participants/[id]/route.ts` — default PDF delete, cascade cert doc
- `app/api/databases/route.ts` — delete `driveFolderId` folder
- `app/api/templates/route.ts`, `app/api/drive-upload/route.ts`,
  `app/api/databases/drive-folder/route.ts` — read `shared`, return `sharingFailed`
- `apps-script.js` — `deleteFolder` + `ensurePublic` actions; `setSharing` on every
  created file **and** parent folder, with `shared` in the response
- `lib/types.ts` — `GenerationJob`, `Participant.emailError`
- `components/CertificateGenerator.tsx` — job checkpointing, chunked writes, resume
- `firestore.indexes.json` — search-name category composite index
- `.env.example` — note on the bridge owner account's sharing requirement

---

## 13. Open risks

- **Refactor blast radius.** The monolith split is the riskiest part on a live
  app. Mitigation: behavior-preserving extraction first, tabs last, manual smoke
  after each extraction step, branch + FF merge.
- **`search-name` composite index** must be built in Firestore before the
  category-scoped query runs, or that query errors. Deploy the index first.
- **Apps Script `deleteFolder` / `ensurePublic`** silently no-op until the script
  is redeployed; folder cleanup and sharing fixes appear broken until then.
- **`APPS_SCRIPT_SECRET` mismatch (§10.1)** currently breaks *all* Drive + Sheets
  bridge calls in production. Must be fixed before implementation work is testable
  end-to-end.
- **Restricted Workspace bridge account** — if the Apps Script owner is a
  Workspace account that blocks external link sharing, no code change makes
  artifacts public. Requires an admin policy change or moving the bridge account.
- **Chunked cert writes** change the failure profile of generation — a mid-run
  failure now leaves *some* committed certs rather than none. This is the
  intended behavior (that's what makes resume work) but the operator-facing
  messaging must say "N of M written" on error, not "generation failed".
