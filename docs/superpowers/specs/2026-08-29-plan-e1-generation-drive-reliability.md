# Plan E1 — Generation / Drive / Sheet Reliability — Design

**Date:** 2026-08-29
**Status:** Approved (all 8 sections brainstormed and confirmed with the user), pending implementation plan
**Branch:** `feat/plan-e1-generation-drive-reliability` (off `main` @ `bd3886f`)
**Scope:** One session. Live production app (`cert.pharmacozyme.com`), ~4,200 real certificates.

---

## 1. Problem statement

Post-deploy smoke testing of Plans A–D surfaced a cluster of generation / Drive /
Sheet reliability bugs. They were split into two plans by theme:

- **Plan E1 (this doc):** generation + Drive + Sheet reliability. Approved.
- **Plan E2 (deferred):** UI features (DB cover images, templates page search /
  filter / cascade-delete, generate-modal template list). Not started — separate
  brainstorm.

### Root causes (all verified against current code at `bd3886f`)

1. **Drive folder duplication.** `apps-script.js` `uploadPDF` calls
   `getOrCreateFolder(databaseName)` — a check-then-act lookup *by folder name* —
   on every single call. `CertificateGenerator` fires 5 concurrent uploads, so
   the first batch races: each request sees "no folder named X" and creates one,
   producing up to 5 duplicate per-database folders per run.
   (`apps-script.js:430-461` `uploadPDF`, `:463-499` `getOrCreateFolder`.)

2. **Drive links / fileIds never reach Firestore or the Sheet.** In
   `CertificateGenerator` Phase 3, the `batch-update` call that persists
   `driveLink` / `driveFileId` onto participant docs (`CertificateGenerator.tsx:874`)
   has **no `.ok` check** — a failed write is silently swallowed. The Sheet sync
   reads participant docs from Firestore, so a blank there is blank in the Sheet
   too. The follow-up cert-doc `PATCH` loop (`:889`) is `.catch(() => {})` — also
   silent, also uncounted.

3. **Orphaned Drive files on delete.** `handleDeletePdfOnly` and the participant
   delete paths only trash the Drive file when `participant.driveFileId` is set —
   there is no fallback to parse the id out of `participant.driveLink`. A
   participant with a link but no stored id keeps its file forever. (Note:
   `lib/certCascade.ts:45` *already* does the fallback for the cert-doc path; the
   gap is the participant-side paths and the component.)

4. **Fragile resume ledger.** `generationJobs/{databaseId}.completedParticipantIds`
   is a stored checkpoint list. An interrupted run had written every cert ID to
   Firestore in ~1s and checkpointed all of them "complete" *before* any PDF was
   rendered, so Resume saw "nothing to do" while every cert was missing its PDF.
   (`lib/generationResume.ts` `remainingToGenerate`, `CertificateGenerator.tsx:548`
   `checkpoint`, `:584-588` resume filter, `:925` `fullyCovered`.)

---

## 2. Decisions (locked)

| Question | Decision |
| --- | --- |
| What counts as "done" for a participant | **cert ID + Drive PDF.** Email is a **separate manual step**, never part of the generation completion model (Section 1, option A). |
| Resume-state model | **Derived, never stored.** Generation state is computed from participant docs on every read. `generationJobs` is kept but slimmed to a bare run marker (option A). |
| Row-delete matching in the Sheet | Match by `certificateId` (col A, exact) when present; else by Name + Email (case-insensitive, trimmed). |
| Folder consolidation | **Build the action** — an operator-triggered `consolidateFolders` that merges duplicate folders into the canonical one (option B), not just a passive "use the stored id" fix. |
| New retry logic | **None.** The existing 3× backoff on Drive upload stays. Section 3 only *notices* failures, it does not add retries. |
| Firestore rules / indexes | **No changes.** `generationJobs` has no rules block (deny-by-default + Admin-SDK bypass covers it). No new composite indexes. |
| New env vars | **None.** |

---

## 3. Non-goals

- No server-side generation worker or queue — generation stays client-driven in
  `CertificateGenerator`.
- No sweep of Drive folders/files that are **already** duplicated or orphaned
  beyond what the operator-triggered `consolidateFolders` action handles on
  demand. No automatic background reconciliation.
- No per-recipient email delivery-state model (Plan D's counts-only model stands:
  `Participant.emailError` string + `emailSent` bool).
- No change to `lib/urls.ts` `buildVerificationUrl` — every cert's QR still points
  at `/verify?certId=` and the category-less auto-verify keeps those resolving.
  **Inviolable** (Plan C review): never make auto-verify pass the page's category.
- Not fixing the ~140 pre-existing `no-explicit-any` eslint findings (house style).

---

## 4. Section 1 — Generation & Resume flow

**New model: generation state is DERIVED from participant docs, never a stored ledger.**

### 4.1 New module — `lib/generationState.ts` (pure, unit-tested)

```ts
type ParticipantGenState = "needs-cert" | "needs-pdf" | "complete";

// no certificateId                    -> "needs-cert"
// certificateId but no driveLink      -> "needs-pdf"
// certificateId and driveLink         -> "complete"
function classifyParticipant(p: Pick<Participant, "certificateId" | "driveLink">): ParticipantGenState;

interface GenerationSummary { needsCert: number; needsPdf: number; complete: number; total: number; }
function deriveGenerationSummary(participants: Pick<Participant, "certificateId" | "driveLink">[]): GenerationSummary;
```

- `driveLink` is the completeness signal (not `driveFileId`) — it is the field
  the Sheet sync and the public claim page actually read, and the field the
  "Missing Drive Link" filter chip already keys on.
- `lib/generationResume.ts` (`remainingToGenerate`) is **deleted** and its test
  (`tests/generationResume.test.ts`) replaced by `tests/generationState.test.ts`.

### 4.2 Slim `generationJobs/{databaseId}` doc

New shape (`lib/types.ts` `GenerationJob`):

```ts
interface GenerationJob {
  databaseId: string;
  templateId?: string;
  startedAt: string;
  status: "running" | "interrupted";
  startedBy: string;
}
```

- **DROP** `completedParticipantIds`, `total`, `phase`, `updatedAt`.
- Written `status: "running"` when a run starts; **deleted** on clean finish.
- A `running` job whose `startedAt` is older than **~30 min** reads as
  `interrupted` (staleness computed on read in the GET route — see Section 7).
- `PUT /api/generation-jobs/[databaseId]` payload shrinks to
  `{ templateId?, startedAt?, status? }`. It no longer accepts or stores
  `completedParticipantIds` / `total` / `phase`.

### 4.3 `CertificateGenerator` behaviour

- **On open:** show the derived breakdown, e.g.
  *"12 need a cert ID · 5 have an ID, no PDF · 64 complete"*
  (from `deriveGenerationSummary(participants)`).
- **Generate** processes `needs-cert ∪ needs-pdf`:
  - `needs-cert` → mint a new cert ID, render, upload.
  - `needs-pdf` → re-render with the **same** existing cert ID, upload. (No new
    ID, no new cert doc — the cert doc already exists; update its drive fields.)
- Checkbox **"Regenerate complete ones too"** — when ticked, adds the `complete`
  set (re-renders + re-uploads, keeping each existing cert ID). Replaces the old
  `filterNewOnly` / "Regenerate All" semantics.
- On start: `PUT` the job doc `{ templateId, startedAt: now, status: "running" }`.
- On clean finish (every targeted participant now classifies `complete`):
  `DELETE` the job doc.
- On any throw in the run: leave the job doc in place (it will read `interrupted`
  once stale, and the derived badge already reflects reality immediately).

### 4.4 Resume

- Triggered from the detail-view banner or the DB-card badge (both carry a
  "resume" intent).
- Resume **skips the template picker**: uses `job.templateId`, auto-starts
  Generate immediately over the current `needs-cert ∪ needs-pdf` set.
- Falls back to the picker **only** if `job.templateId` is absent (matches the
  Plan D A-3 ruling).
- There is no separate "remainder" computation any more — the derived
  `needs-cert ∪ needs-pdf` set *is* the remainder.

### 4.5 `useDatabaseManager` / `DatabaseList` / `DatabaseDetail`

- Each DB card gets a derived **"N unfinished"** badge where
  `N = needsCert + needsPdf > 0`. Clicking it opens the generator in resume mode.
- The Plan D detail-view `GenerationResumeBanner` stays. Its **"Discard"** button
  becomes **"Dismiss"** and only clears the local resume flag — it does **not**
  `DELETE` the job doc (the derived state is the truth; deleting the doc just
  loses the `templateId` shortcut).

### 4.6 Deletions from Plan D

- `completedParticipantIds` checkpoint logic in `CertificateGenerator` (the
  `checkpoint()` helper's payload, the `completedIds` array, all `.push` sites).
- `remainingToGenerate` and its dependence on the stored list.
- The `fullyCovered = completedIds.length >= jobTotal` gate and the
  **"N of M done — reopen this database to finish the rest"** partial-coverage
  toast (`CertificateGenerator.tsx:925-931`). Clean finish is now
  "every targeted participant classifies `complete`".
- The parked OOS-1 latent bug (`fullyCovered` miscount when a participant lacks
  an `id`) is **resolved by deletion** — that code path no longer exists.

---

## 5. Section 2 — Drive folder identity & consolidation

### 5.1 Establish a canonical folder id before the concurrent loop

In `CertificateGenerator`, before Phase 3's concurrent upload loop:

- If `database.driveFolderId` is set → use it.
- Else → **one** `getFolder` call to the bridge (`{ databaseName }` →
  `{ folderId }`), then `PUT /api/databases { id, driveFolderId, driveFolderUrl }`
  once, then use that id.
- Every `uploadPDF` call in the loop passes that `folderId`. No upload creates a
  folder any more.

### 5.2 apps-script `uploadPDF` takes a `folderId`

```
uploadPDF({ pdfData, fileName, databaseName, folderId? })
```

- `folderId` present → `DriveApp.getFolderById(folderId)` directly, no lookup, no
  create.
- `folderId` absent → fall back to `getOrCreateFolder(databaseName)` (first-upload
  / legacy path only).

### 5.3 `/api/drive-upload`

- Accept `folderId` in the POST body and pass it through to the bridge.

### 5.4 apps-script `consolidateFolders`

```
consolidateFolders({ folderName, canonicalFolderId })
  -> { movedFiles: number, trashedFolders: number }
```

- Find every folder named `folderName` directly under the parent
  (`DRIVE_FOLDER_ID` if resolvable, else the folder named `DRIVE_FOLDER_NAME`).
- For each folder whose id ≠ `canonicalFolderId`: move all its files into the
  canonical folder, then `setTrashed(true)` on the now-empty folder.
- Never touches the canonical folder itself or any folder with a different name.

### 5.5 `POST /api/drive/consolidate` (new route)

- Body `{ databaseId }`. Admin-gated.
- Resolves the DB's `name` + `driveFolderId`. **Refuses (400)** if
  `driveFolderId` is not set — there is no canonical target to consolidate into.
- Calls the bridge `consolidateFolders`, returns
  `{ movedFiles, trashedFolders }` for a toast.

### 5.6 UI

- **"Consolidate folders"** button in `DatabaseDetail`'s Drive action group,
  next to "Fix folder sharing". Disabled unless `database.driveFolderId` is set.
- On click → `POST /api/drive/consolidate` → toast
  *"Moved N file(s), removed M duplicate folder(s)."*

### 5.7 Dead helpers

`apps-script.js` `deleteRowsByCertIds` and `deleteRowsByEmail` are currently
**unreferenced** by any route (the routes use `clearCertIdsByEmail`). They are
superseded by the new `deleteRows` (Section 6) and should be **deleted** in this
plan.

---

## 6. Section 3 — Error propagation on the Drive / persistence path

**Theme: no state-persisting `await fetch` on the generation path goes unchecked.**
No new retries — this section only makes silent failures loud.

### 6.1 Phase-3 `batch-update` (driveLink / driveFileId → participant docs)

`CertificateGenerator.tsx:874` — capture the response; `if (!res.ok) throw`. The
throw routes into the existing run catch → the run is reported interrupted, the
job doc stays, and the derived "N unfinished" badge self-corrects on next read.

### 6.2 Cert-doc `PATCH` loop (drive links → `certificates` docs)

`CertificateGenerator.tsx:889` — keep it **non-fatal** (a missing drive link on a
cert doc doesn't break verification), but **count** the failures and surface them
in the final toast:
*"3 certificate record(s) couldn't be updated with their Drive link — [certIds]."*

### 6.3 Delete-path file-id resolution — `resolveDriveFileId`

Add to `lib/driveCleanup.ts` (it already exports `fileIdFromLink`):

```ts
function resolveDriveFileId(
  p: Pick<Participant, "driveFileId" | "driveLink">
): string | null;
// p.driveFileId || fileIdFromLink(p.driveLink) || null
```

Unit-tested: stored id wins; parses `/file/d/<id>/view`, `?usp=…`, `?id=<id>`;
returns `null` for empty / unparseable.

Use it everywhere a delete needs a participant's file id:
`app/api/participants/[id]/route.ts:112`, `app/api/participants/bulk-delete/route.ts:62`,
and the component's `handleDeletePdfOnly` path.

### 6.4 Fire-and-forget audit

Audit every caller of `lib/driveCleanup.ts` / `lib/certCascade.ts`: each must
either `await` the result or carry a one-line comment explaining why the failure
is intentionally ignored. (No behaviour change expected — this is a
read-and-annotate pass to lock in the contract.)

---

## 7. Section 4 — Delete cascades: Sheet row deletion

### 7.1 apps-script `deleteRows` (new, replaces `deleteRowsByCertIds` + `deleteRowsByEmail`)

```
deleteRows({ spreadsheetId, tabName, matches })
  matches: Array<{ certificateId?: string, name?: string, email?: string }>
  -> { deletedRows: number }
```

Per match:
- `certificateId` present → delete the row whose **col A === certificateId**
  exactly.
- else → delete the row whose **Name + Email** both match (case-insensitive,
  trimmed).

Collect all target row indices first, delete **bottom-up in one pass**. Never
touch the header row (row 1). A match with no hit is a no-op (not an error).

### 7.2 `DELETE /api/participants/[id]`

- Replace the `clearCertIdsByEmail` call with `deleteRows`, sending
  `[{ certificateId }]` when the participant has one, else `[{ name, email }]`.
- Firestore doc delete + Drive cascade unchanged (Drive cascade now uses
  `resolveDriveFileId` per 6.3).

### 7.3 `POST /api/participants/bulk-delete`

- One `deleteRows` call with the full `matches` array (one entry per deleted
  participant, `certificateId` when present else `name`/`email`), replacing the
  single batched `clearCertIdsByEmail`.

### 7.4 Keep `clearCertIdsByEmail`

Still used by the **cert-only deletion** path (delete the cert ID but keep the
Sheet row + participant). `lib/certCascade.ts:79` continues to call it. That
path's contract — row survives, col A cleared — is unchanged.

### 7.5 `handleDeletePdfOnly` and cert-cascade delete paths

Use `resolveDriveFileId` so a participant with a `driveLink` but no stored
`driveFileId` still gets its Drive file trashed. `handleDeleteCertId` is
**unchanged** (it must not touch the Drive file).

---

## 8. Section 5 — Public "0 participants"

`GET /api/databases/public` (`app/api/databases/public/route.ts:23`):

- Stop returning the stored `participantCount` field.
- Compute it **live**: for each live DB, a `.count()` aggregation on its
  `participants` subcollection, all in one `Promise.all` — same pattern the admin
  `GET /api/databases` route already uses.
- Per-DB failure → fall back to `0` for that DB, do not fail the whole response.
- The stored `participantCount` field stays in the doc (written elsewhere), it is
  just **no longer read** by this route.

---

## 9. Section 6 — Testing

### 9.1 Unit tests (real assertions, `npx vitest run`)

- **`tests/generationState.test.ts`** — `classifyParticipant` for every combo
  (no id; id no link; id + link; empty-string vs undefined for each field);
  `deriveGenerationSummary` totals across a mixed roster.
- **`tests/driveCleanup.test.ts`** (extend) — `resolveDriveFileId`: stored id
  wins over link; parses `/file/d/<id>/view`, `?usp=drivesdk`, `?id=<id>`;
  `null` for `""`, `undefined`, and a non-Drive URL.
- **`generationJobs` staleness** — a helper that maps
  `{ status: "running", startedAt }` → effective status, tested at the ~30-min
  boundary (fresh → `running`, stale → `interrupted`).

### 9.2 apps-script functions (`deleteRows`, `consolidateFolders`, `uploadPDF` folderId)

Hand-traced (no Java sandbox → no Apps Script test runner). The trace for each is
documented in the implementation plan. The **user smoke-tests them live** after
the Apps Script redeploy (Section 10).

### 9.3 Gate before every commit

`npx tsc --noEmit` clean · `npx vitest run` clean · `npm run build` exit 0.
(Baseline on `bd3886f`: tsc clean, build clean. Vitest count grows from the
current suite as tests are added; `generationResume.test.ts` is removed.)

---

## 10. Section 7 — File map

### New

| Path | Purpose |
| --- | --- |
| `lib/generationState.ts` | `classifyParticipant`, `deriveGenerationSummary` |
| `tests/generationState.test.ts` | unit tests for the above |
| `app/api/drive/consolidate/route.ts` | `POST { databaseId }` → bridge `consolidateFolders` |

### Edit

| Path | Change |
| --- | --- |
| `lib/types.ts` | `GenerationJob` slimmed (§4.2) |
| `lib/driveCleanup.ts` | add `resolveDriveFileId` |
| `tests/driveCleanup.test.ts` | add `resolveDriveFileId` cases |
| `app/api/generation-jobs/[databaseId]/route.ts` | shrink PUT payload; staleness-on-read in GET |
| `components/CertificateGenerator.tsx` | derived breakdown; needs-cert ∪ needs-pdf run; resume auto-start; drop checkpoint ledger; §6.1/§6.2 error handling; §5.1 canonical folder id |
| `components/admin/databases/useDatabaseManager.ts` | derived "N unfinished" per DB |
| `components/admin/databases/DatabaseList.tsx` | "N unfinished" badge → resume |
| `components/admin/databases/DatabaseDetail.tsx` | "Consolidate folders" button |
| `components/admin/databases/GenerationResumeBanner.tsx` | "Discard" → "Dismiss" (flag-only) |
| `app/api/drive-upload/route.ts` | pass `folderId` through |
| `app/api/participants/[id]/route.ts` | `deleteRows` + `resolveDriveFileId` |
| `app/api/participants/bulk-delete/route.ts` | `deleteRows` + `resolveDriveFileId` |
| `app/api/databases/public/route.ts` | live `.count()` instead of stored field |
| `apps-script.js` | `uploadPDF` folderId; new `deleteRows`, `consolidateFolders`; delete `deleteRowsByCertIds` + `deleteRowsByEmail` |

### Delete

| Path | Reason |
| --- | --- |
| `lib/generationResume.ts` | replaced by `lib/generationState.ts` |
| `tests/generationResume.test.ts` | replaced by `tests/generationState.test.ts` |

---

## 11. Section 8 — Rollout

E1 changes `apps-script.js` again → **another Apps Script web-app redeploy is
owed** (edit-version, URL unchanged) before `deleteRows`, `consolidateFolders`,
and the `uploadPDF` `folderId` path work in production.

- No new env vars.
- No `firestore.rules` changes.
- No new `firestore.indexes.json` entries.

**Deploy order:**

1. Merge `feat/plan-e1-generation-drive-reliability` → `main` (user's call).
2. Push → Vercel auto-deploys production.
3. **Blue-dot SHA check** — confirm the commit next to the live Production
   deployment matches the pushed HEAD (2 real stale-deploy incidents in this
   repo's history).
4. Apps Script editor → redeploy the web app (Manage deployments → edit → new
   version). URL must not change.
5. Live smoke test (user): generate a small batch (verify one folder, links land
   in Firestore + Sheet), run "Consolidate folders" on a DB with known
   duplicates, delete a participant (verify the Sheet row is removed), delete a
   PDF-only participant that has a `driveLink` but no `driveFileId` (verify the
   Drive file is trashed).

---

## 12. Pre-existing issues NOT in scope

- **`participants.certificateId` collection-group single-field index exemption** —
  a mistyped cert ID on `/verify` 500s instead of 404. Pre-existing, not caused
  by A–D or E1. Still owed to the user (a Firestore console action, no code).
- **Plan E2** — DB cover images, templates-page search/filter, generate-modal
  template list, template-delete Drive cascade. Deferred, separate brainstorm.
