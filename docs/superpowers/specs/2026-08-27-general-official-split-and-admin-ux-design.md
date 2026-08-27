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
export async function deleteDriveFile(fileId: string): Promise<void>;
export async function deleteDriveFolder(folderId: string): Promise<void>;
export function fileIdFromLink(link?: string): string | null; // /file/d/<id>/ or ?id=<id>
```
All best-effort: call `callAppsScript`, catch, `console.error`, return. Never throw.
Guarded by `appsScriptConfigured()`.

**`DELETE /api/certificates` (collection route):**
- Accept **`id` OR `uniqueCertId`** (fixes the `CertificateTable` call without
  changing the client).
- New cascade:
  1. Read the cert doc(s).
  2. `deleteDriveFile` for `driveFileId` (or `fileIdFromLink(driveLink)`).
  3. Delete the cert doc(s).
  4. If the cert references `databaseId` + `participantId`, clear that
     participant's `certificateId` / `certificateUrl` / `verificationUrl` /
     `driveLink` / `driveFileId` and set `status: "pending"`.
  5. If that database has a linked sheet, `clearCertIdsByEmail` for the
     participant's email (reuse existing action).
- `?clearParticipant=false` opts out of steps 4–5 (default: clear).

**`DELETE /api/certificates/[id]`:** delegate to the same helper, or remove its
`DELETE` export (grep confirms no caller — but keep it delegating for safety).

**`DELETE /api/participants/[id]`:**
- Drive-file deletion becomes the **default** when `driveFileId` (or a parseable
  `driveLink`) is present. `?keepPdf=true` opts out.
- Also delete the associated `certificates` doc(s) (`where uniqueCertId ==
  participant.certificateId`) and their Drive files — via the §9.2 cert helper so
  the logic lives in one place.
- Existing sheet cert-id clear stays.

**`DELETE /api/databases?id=`:**
- After the participant loop and template cleanup, if `dbData.driveFolderId`:
  `await deleteDriveFolder(dbData.driveFolderId)`. Best-effort, logged.
- Response message updated to mention the folder.

**Bulk delete paths in the admin UI:**
- Replace the client-side `Promise.all` fan-out of `drive-upload` + `certificates`
  + `batch-update` calls with a single server endpoint that performs the cascade
  per participant. Simplest: a `POST /api/participants/batch-update` mode, or a
  new `POST /api/participants/bulk-delete` taking `{ databaseId, participantIds,
  deleteCerts, deletePdfs }`. **Decision:** new `bulk-delete` route — clearer than
  overloading `batch-update`, and it can reuse the §9 helpers.

**UI confirm copy:**
- Single cert delete: "Delete this certificate? This also removes the PDF from
  Google Drive and resets the participant to pending."
- Database delete: "Delete this database, its N participants, their Drive files,
  and the database's Drive folder?"

### 9.3 Tests

- `tests/driveCleanup.test.ts` — `fileIdFromLink` parses the two known link
  shapes and returns `null` for junk.
- Cascade routes are integration-shaped (need Firestore) — cover with manual
  verification in §10, not unit tests, consistent with the repo's current
  test boundary (no Firestore emulator in this sandbox).

---

## 10. Testing & rollout

### 10.1 Automated (must be green before every push)

- `npx tsc --noEmit`
- `npx vitest run` — existing 22 + new: `generationResume`, `emailOutcome`,
  `driveCleanup`.
- `npm run build`

### 10.2 Manual verification

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

### 10.3 Deploy checklist (this repo's history)

- New env / config: **none** for this work (the §6 job collection and §9 folder
  action need no new env vars). `deleteFolder` needs an **Apps Script redeploy**.
- New Firestore index for `/api/search-name` category filter — deploy
  `firestore.indexes.json`.
- `firestore.rules` — `generationJobs` is API-only (Admin SDK), so it stays
  `if false` in the deny-by-default rules. No rules change needed.
- Work on a branch (`feat/general-official-split`), fast-forward merge to `main`
  when green (keeps the linear history this repo uses).
- After `git push`: open the Vercel **Deployments** tab and confirm the commit
  SHA next to the live (blue-dot) **Production** deployment matches the pushed
  SHA. Do not trust a "Redeploy" — it can re-promote stale code
  (two incidents this session from skipping this check).
- Apps Script redeploy + `firebase deploy --only firestore:indexes` before or with
  the Vercel deploy.

---

## 11. File-change summary

**New:**
- `app/official/page.tsx`
- `components/OfficialSearch.tsx`, `components/OfficialDatabaseCards.tsx`
- `components/verify/shared/{ResultCard,SkeletonCard,IdlePlaceholder}.tsx`,
  `components/verify/shared/format.ts`
- `components/admin/databases/*` (≈14 files per §5.1)
- `app/api/generation-jobs/[databaseId]/route.ts`
- `app/api/participants/bulk-delete/route.ts`
- `lib/driveCleanup.ts`
- `tests/generationResume.test.ts`, `tests/emailOutcome.test.ts`,
  `tests/driveCleanup.test.ts`

**Changed:**
- `app/verify/page.tsx`, `components/VerifySearch.tsx`,
  `components/PublicDatabaseCards.tsx` — General-scoped
- `components/Navbar.tsx` — `next/link`, Official link, active state
- `components/VerificationResult.tsx` — `Math.random()` → `useMemo`
- `app/admin/databases/page.tsx` — reduced to a tab wrapper
- `app/api/databases/public/route.ts` — `?category=` filter
- `app/api/search-name/route.ts` — `?category=` filter
- `app/api/verify/route.ts` — `mismatch` payload on category mismatch
- `app/api/certificates/route.ts` — accept `id`, Drive+participant cascade
- `app/api/certificates/[id]/route.ts` — delegate DELETE to the cascade helper
- `app/api/participants/[id]/route.ts` — default PDF delete, cascade cert doc
- `app/api/databases/route.ts` — delete `driveFolderId` folder
- `apps-script.js` — `deleteFolder` action
- `lib/types.ts` — `GenerationJob`, `Participant.emailError`
- `components/CertificateGenerator.tsx` — job checkpointing, chunked writes, resume
- `firestore.indexes.json` — search-name category composite index

---

## 12. Open risks

- **Refactor blast radius.** The monolith split is the riskiest part on a live
  app. Mitigation: behavior-preserving extraction first, tabs last, manual smoke
  after each extraction step, branch + FF merge.
- **`search-name` composite index** must be built in Firestore before the
  category-scoped query runs, or that query errors. Deploy the index first.
- **Apps Script `deleteFolder`** silently no-ops until the script is redeployed;
  folder cleanup will appear broken until then. Call it out in the deploy step.
- **Chunked cert writes** change the failure profile of generation — a mid-run
  failure now leaves *some* committed certs rather than none. This is the
  intended behavior (that's what makes resume work) but the operator-facing
  messaging must say "N of M written" on error, not "generation failed".
