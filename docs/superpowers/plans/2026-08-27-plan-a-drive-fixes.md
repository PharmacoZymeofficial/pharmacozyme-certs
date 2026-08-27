# Plan A — Drive Cleanup & Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every certificate/participant/database delete path also remove the corresponding Google Drive file (and, for a database, its folder), and guarantee every app-created Drive artifact is shared "anyone with link".

**Architecture:** Deletion becomes server-authoritative — the API routes own the Drive + Firestore + Sheet cascade instead of the browser firing several uncoordinated `fetch` calls. A new `lib/driveCleanup.ts` wraps the Apps Script bridge. `apps-script.js` gains a `deleteFolder` action, an `ensurePublic` action, and applies `setSharing` to folders as well as files, reporting `shared` back.

**Tech Stack:** Next.js 16 App Router route handlers, Firebase Admin SDK (`getAdminDb()`), the Google Apps Script bridge (`lib/appsScript.ts` → `callAppsScript`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-general-official-split-and-admin-ux-design.md` (§9, §10)

## Global Constraints

- **This is NOT the Next.js you know** — App Router, Next 16. Read `node_modules/next/dist/docs/` before using an unfamiliar API. Route handlers export `GET`/`POST`/`DELETE` functions taking `NextRequest`.
- All Firestore access in API routes goes through `getAdminDb()` from `@/lib/firebase.admin` — never the client SDK. Do **not** import from `firebase-admin/auth` (ESM crash — see spec / CONTEXT.md).
- Every admin API route starts with `const guard = await requireAdmin(request); if (!guard.ok) return guard.response;` from `@/lib/requireAdmin`.
- Apps Script calls go through `callAppsScript(action, payload)` from `@/lib/appsScript`; guard with `appsScriptConfigured()`.
- Drive cleanup is **best-effort**: a Drive failure must never block or reverse the Firestore deletion. Log with `console.error`, continue.
- Tests live in `tests/*.test.ts`, run with `npm test` (Vitest, node env). Import app modules via the `@/` alias. Match the style of `tests/certificateId.test.ts`.
- Build check is `npm run build` (uses `next build --webpack`). Type check is `npx tsc --noEmit`.
- Commit after every task. Conventional Commits. End commit messages with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Work on branch `feat/general-official-split` (already created).
- `apps-script.js` changes require a **manual Apps Script redeploy** by the user — the plan cannot deploy it. Flag this in the task and in the final report.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/driveCleanup.ts` | **New.** `fileIdFromLink`, `deleteDriveFile`, `deleteDriveFolder`, `ensureDrivePublic`. Pure wrappers over `callAppsScript`, all best-effort except the pure parser. |
| `lib/certCascade.ts` | **New.** `deleteCertificateCascade({ certDocId?, uniqueCertId, clearParticipant })` — the shared "delete a cert + its Drive file + reset its participant + clear the sheet cell" routine, used by 3 routes. |
| `app/api/certificates/route.ts` | **Modify.** `DELETE` accepts `id` OR `uniqueCertId`; delegates to `deleteCertificateCascade`. |
| `app/api/certificates/[id]/route.ts` | **Modify.** `DELETE` delegates to `deleteCertificateCascade`. |
| `app/api/participants/[id]/route.ts` | **Modify.** `DELETE` deletes the Drive file by default; also cascades the linked certificate doc. |
| `app/api/databases/route.ts` | **Modify.** `DELETE` also trashes `driveFolderId` after clearing participants. |
| `app/api/participants/bulk-delete/route.ts` | **New.** `POST { databaseId, participantIds, deleteCerts, deletePdfs }` — server-side bulk delete cascade. |
| `app/api/templates/route.ts` | **Modify.** `POST` reads `shared` from the bridge response, returns `sharingFailed` when false. |
| `app/api/drive-upload/route.ts` | **Modify.** `POST` returns `sharingFailed` from the bridge response. |
| `app/api/drive/ensure-public/route.ts` | **New.** `POST { fileId?, folderId? }` → calls `ensureDrivePublic`. |
| `apps-script.js` | **Modify.** `deleteFolder` + `ensurePublic` actions; `setSharing` on folders; `shared` in `uploadPDF`/`uploadTemplate`/`getOrCreateFolder` responses. |
| `tests/driveCleanup.test.ts` | **New.** Unit tests for `fileIdFromLink`. |
| `.env.example` | **Modify.** Note that the bridge owner account must permit link sharing. |

---

## Task 1: `lib/driveCleanup.ts` + `fileIdFromLink` tests

**Files:**
- Create: `lib/driveCleanup.ts`
- Test: `tests/driveCleanup.test.ts`

**Interfaces:**
- Consumes: `callAppsScript`, `appsScriptConfigured` from `@/lib/appsScript`.
- Produces:
  - `fileIdFromLink(link?: string | null): string | null`
  - `deleteDriveFile(fileId: string): Promise<void>`
  - `deleteDriveFolder(folderId: string): Promise<void>`
  - `ensureDrivePublic(target: { fileId?: string; folderId?: string }): Promise<{ shared: boolean }>`

- [ ] **Step 1: Write the failing test**

Create `tests/driveCleanup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fileIdFromLink } from "@/lib/driveCleanup";

describe("fileIdFromLink", () => {
  it("parses the /file/d/<id>/ share link shape", () => {
    expect(
      fileIdFromLink("https://drive.google.com/file/d/1AbC-dEf_2GhI/view?usp=sharing")
    ).toBe("1AbC-dEf_2GhI");
  });

  it("parses the ?id=<id> shape", () => {
    expect(
      fileIdFromLink("https://drive.google.com/uc?id=1AbC-dEf_2GhI&export=download")
    ).toBe("1AbC-dEf_2GhI");
  });

  it("returns null for junk or empty input", () => {
    expect(fileIdFromLink("")).toBeNull();
    expect(fileIdFromLink(null)).toBeNull();
    expect(fileIdFromLink(undefined)).toBeNull();
    expect(fileIdFromLink("https://example.com/nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/driveCleanup.test.ts`
Expected: FAIL — cannot resolve `@/lib/driveCleanup`.

- [ ] **Step 3: Write the implementation**

Create `lib/driveCleanup.ts`:

```ts
/**
 * Best-effort Google Drive cleanup + sharing, via the Apps Script bridge.
 *
 * Deletion must never block or reverse a Firestore write — every network call
 * here logs and swallows its own errors. `fileIdFromLink` is the one pure
 * function and is unit-tested.
 */
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

/** Pull a Drive file id out of the two link shapes the app stores. */
export function fileIdFromLink(link?: string | null): string | null {
  if (!link) return null;
  const byPath = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (byPath) return byPath[1];
  const byQuery = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byQuery) return byQuery[1];
  return null;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  if (!fileId || !appsScriptConfigured()) return;
  try {
    await callAppsScript("deletePDF", { fileId });
  } catch (err) {
    console.error(`Drive file delete failed for ${fileId}:`, err);
  }
}

export async function deleteDriveFolder(folderId: string): Promise<void> {
  if (!folderId || !appsScriptConfigured()) return;
  try {
    await callAppsScript("deleteFolder", { folderId });
  } catch (err) {
    console.error(`Drive folder delete failed for ${folderId}:`, err);
  }
}

export async function ensureDrivePublic(
  target: { fileId?: string; folderId?: string }
): Promise<{ shared: boolean }> {
  if ((!target.fileId && !target.folderId) || !appsScriptConfigured()) {
    return { shared: false };
  }
  try {
    const res = await callAppsScript<{ success?: boolean; shared?: boolean }>(
      "ensurePublic",
      target
    );
    return { shared: Boolean(res?.shared ?? res?.success) };
  } catch (err) {
    console.error("ensureDrivePublic failed:", err);
    return { shared: false };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/driveCleanup.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/driveCleanup.ts tests/driveCleanup.test.ts
git commit -m "feat: add lib/driveCleanup for best-effort Drive file/folder ops

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `apps-script.js` — `deleteFolder`, `ensurePublic`, folder sharing

**Files:**
- Modify: `apps-script.js`

**Interfaces:**
- Produces (Apps Script actions, called via `callAppsScript`):
  - `deleteFolder({ folderId })` → `{ success: boolean, error?: string }`
  - `ensurePublic({ fileId?, folderId? })` → `{ success: boolean, shared: boolean, error?: string }`
  - `uploadPDF` / `uploadTemplate` / `getFolder` responses gain `shared: boolean`

- [ ] **Step 1: Add the two new functions**

Add near `deletePDF` (after line ~522 in the DRIVE OPERATIONS section):

```js
function deleteFolder(payload) {
  const { folderId } = payload;
  if (!folderId) throw new Error("folderId is required");
  try {
    DriveApp.getFolderById(folderId).setTrashed(true);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function ensurePublic(payload) {
  const { fileId, folderId } = payload;
  if (!fileId && !folderId) throw new Error("fileId or folderId is required");
  try {
    const target = fileId
      ? DriveApp.getFileById(fileId)
      : DriveApp.getFolderById(folderId);
    target.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, shared: true };
  } catch (err) {
    return { success: false, shared: false, error: String(err) };
  }
}

/** Best-effort ANYONE_WITH_LINK share; returns whether it stuck. */
function shareBestEffort(fileOrFolder) {
  try {
    fileOrFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return true;
  } catch (err) {
    console.error("setSharing failed:", err && err.message);
    return false;
  }
}
```

- [ ] **Step 2: Register the actions in `doPost`**

In the `switch (action)` block in `doPost` (around line 80-125), add two cases alongside `deletePDF`:

```js
      case "deleteFolder":
        result = deleteFolder(payload);
        break;
      case "ensurePublic":
        result = ensurePublic(payload);
        break;
```

- [ ] **Step 3: Share folders and report `shared` in `uploadPDF`**

Replace the sharing block + return in `uploadPDF` (lines ~440-459) with:

```js
  const file = folder.createFile(pdfBlob);

  const fileShared = shareBestEffort(file);
  shareBestEffort(folder);

  return {
    success: true,
    fileId: file.getId(),
    fileName: file.getName(),
    webViewLink: file.getUrl(),
    webContentLink: file.getUrl(),
    folderId: folder.getId(),
    folderUrl: "https://drive.google.com/drive/folders/" + folder.getId(),
    shared: fileShared,
  };
```

- [ ] **Step 4: Same for `uploadTemplate`**

Replace the sharing block + return in `uploadTemplate` (lines ~396-410) with:

```js
  const file   = folder.createFile(blob);

  const fileShared = shareBestEffort(file);
  shareBestEffort(folder);

  return {
    success    : true,
    fileId     : file.getId(),
    viewUrl    : "https://drive.google.com/file/d/" + file.getId() + "/view",
    previewUrl : "https://drive.google.com/file/d/" + file.getId() + "/preview",
    shared     : fileShared,
  };
```

- [ ] **Step 5: Share the folder in `getOrCreateFolder` on creation**

In `getOrCreateFolder`, after `subFolder = parentFolder.createFolder(folderName);` (line ~492), add:

```js
    shareBestEffort(subFolder);
```

And after `parentFolder = DriveApp.createFolder(DRIVE_FOLDER_NAME);` (line ~481) add:

```js
      shareBestEffort(parentFolder);
```

- [ ] **Step 6: Manual — user redeploys the Apps Script**

This code is not deployed by git. In the task report, tell the user:
> `apps-script.js` changed — redeploy the Apps Script web app (Deploy → Manage deployments → edit the active deployment → Deploy) so `deleteFolder` / `ensurePublic` / folder-sharing take effect. Until then, folder deletion and `ensurePublic` return errors and are safely ignored.

- [ ] **Step 7: Commit**

```bash
git add apps-script.js
git commit -m "feat(apps-script): add deleteFolder + ensurePublic, share folders

Requires a manual Apps Script redeploy to take effect.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `lib/certCascade.ts` — shared certificate deletion routine

**Files:**
- Create: `lib/certCascade.ts`

**Interfaces:**
- Consumes: `getAdminDb`, `deleteDriveFile`, `fileIdFromLink`, `callAppsScript`, `appsScriptConfigured`.
- Produces:
  `deleteCertificateCascade(opts: { certDocId?: string; uniqueCertId?: string; clearParticipant?: boolean }): Promise<{ deletedCertDocs: number; driveFileDeleted: boolean; participantCleared: boolean }>`

- [ ] **Step 1: Write the implementation**

Create `lib/certCascade.ts`:

```ts
/**
 * The single "delete a certificate everywhere" routine.
 *
 * Used by DELETE /api/certificates, DELETE /api/certificates/[id], and the
 * participant + bulk delete routes. Deletes: the certificates doc(s), the Drive
 * PDF, and (unless clearParticipant === false) resets the linked participant and
 * clears the sheet cert-id cell. Drive + sheet steps are best-effort.
 */
import { getAdminDb } from "@/lib/firebase.admin";
import { deleteDriveFile, fileIdFromLink } from "@/lib/driveCleanup";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

interface CascadeOpts {
  certDocId?: string;
  uniqueCertId?: string;
  clearParticipant?: boolean; // default true
}

export async function deleteCertificateCascade(
  opts: CascadeOpts
): Promise<{ deletedCertDocs: number; driveFileDeleted: boolean; participantCleared: boolean }> {
  const db = getAdminDb();
  const clearParticipant = opts.clearParticipant !== false;

  // Resolve the cert doc(s).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  if (opts.certDocId) {
    const snap = await db.collection("certificates").doc(opts.certDocId).get();
    if (snap.exists) docs = [snap as FirebaseFirestore.QueryDocumentSnapshot];
  } else if (opts.uniqueCertId) {
    const q = await db
      .collection("certificates")
      .where("uniqueCertId", "==", opts.uniqueCertId)
      .get();
    docs = q.docs;
  }

  let driveFileDeleted = false;
  let participantCleared = false;

  for (const doc of docs) {
    const data = doc.data() || {};
    const fileId = data.driveFileId || fileIdFromLink(data.driveLink) || fileIdFromLink(data.pdfUrl);
    if (fileId) {
      await deleteDriveFile(fileId);
      driveFileDeleted = true;
    }

    if (clearParticipant && data.databaseId && data.participantId) {
      try {
        const pRef = db
          .collection("databases")
          .doc(data.databaseId)
          .collection("participants")
          .doc(data.participantId);
        const pSnap = await pRef.get();
        if (pSnap.exists) {
          await pRef.update({
            certificateId: "",
            certificateUrl: "",
            verificationUrl: "",
            driveLink: "",
            driveFileId: "",
            status: "pending",
            updatedAt: new Date().toISOString(),
          });
          participantCleared = true;

          const email = pSnap.data()?.email;
          const dbSnap = await db.collection("databases").doc(data.databaseId).get();
          const dbData = dbSnap.data() || {};
          if (email && dbData.sheetId && appsScriptConfigured()) {
            await callAppsScript("clearCertIdsByEmail", {
              spreadsheetId: dbData.sheetId,
              tabName: dbData.sheetTabName || "Participants",
              emails: [email],
            }).catch((e) => console.error("Sheet cert-id clear failed:", e));
          }
        }
      } catch (err) {
        console.error("Participant reset after cert delete failed:", err);
      }
    }

    await doc.ref.delete();
  }

  return { deletedCertDocs: docs.length, driveFileDeleted, participantCleared };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If the `FirebaseFirestore` namespace type is not in scope, change the `docs` type to `Array<{ data(): any; ref: { delete(): Promise<unknown> } }>` and cast.)

- [ ] **Step 3: Commit**

```bash
git add lib/certCascade.ts
git commit -m "feat: add lib/certCascade shared certificate-delete routine

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Wire `DELETE /api/certificates` + `[id]` to the cascade

**Files:**
- Modify: `app/api/certificates/route.ts` (the `DELETE` export, lines ~54-76)
- Modify: `app/api/certificates/[id]/route.ts` (the `DELETE` export, lines ~5-21)

**Interfaces:**
- Consumes: `deleteCertificateCascade` from `@/lib/certCascade`.

- [ ] **Step 1: Rewrite the collection-route DELETE**

In `app/api/certificates/route.ts`, replace the whole `DELETE` function with:

```ts
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const uniqueCertId = searchParams.get("uniqueCertId") || undefined;
    const id = searchParams.get("id") || undefined;
    const clearParticipant = searchParams.get("clearParticipant") !== "false";

    if (!uniqueCertId && !id) {
      return NextResponse.json({ error: "id or uniqueCertId is required" }, { status: 400 });
    }

    const result = await deleteCertificateCascade({
      certDocId: id,
      uniqueCertId,
      clearParticipant,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error deleting certificate:", error);
    return NextResponse.json({ error: "Failed to delete certificate", details: msg }, { status: 500 });
  }
}
```

Add the import at the top: `import { deleteCertificateCascade } from "@/lib/certCascade";`

- [ ] **Step 2: Rewrite the `[id]` route DELETE**

In `app/api/certificates/[id]/route.ts`, replace the `DELETE` function body with:

```ts
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Certificate ID is required" }, { status: 400 });
    }
    const result = await deleteCertificateCascade({ certDocId: id });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    return NextResponse.json({ error: "Failed to delete certificate" }, { status: 500 });
  }
}
```

Add: `import { deleteCertificateCascade } from "@/lib/certCascade";` and drop the now-unused `getAdminDb` import **only if** the `PUT` handler in the same file no longer needs it (it does — keep it).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass.

- [ ] **Step 4: Fix the broken `CertificateTable` call**

`components/CertificateTable.tsx:84` calls `DELETE /api/certificates?id=${cert.id}` — previously a 400. It now works (the route accepts `id`). No code change needed; verify by reading the line. If `cert.id` can be undefined, change to:

```ts
const key = cert.id ? `id=${encodeURIComponent(cert.id)}` : `uniqueCertId=${encodeURIComponent(cert.uniqueCertId)}`;
const response = await fetch(`/api/certificates?${key}`, { method: "DELETE" });
```

- [ ] **Step 5: Commit**

```bash
git add app/api/certificates/route.ts app/api/certificates/[id]/route.ts components/CertificateTable.tsx
git commit -m "feat(api): certificate DELETE cascades to Drive + participant + sheet

Also fixes the CertificateTable delete that sent ?id= to a route wanting uniqueCertId.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `DELETE /api/participants/[id]` — default PDF delete + cert cascade

**Files:**
- Modify: `app/api/participants/[id]/route.ts` (the `DELETE` export, lines ~73-133)

**Interfaces:**
- Consumes: `deleteDriveFile`, `fileIdFromLink` from `@/lib/driveCleanup`; `deleteCertificateCascade` from `@/lib/certCascade`.

- [ ] **Step 1: Update the DELETE handler**

In `app/api/participants/[id]/route.ts`, in the `DELETE` function, replace the block that reads `deletePdf` and conditionally deletes (lines ~81-107) with:

```ts
    const { searchParams } = new URL(request.url);
    const databaseId = searchParams.get("databaseId");
    const keepPdf = searchParams.get("keepPdf") === "true";

    if (!id) return NextResponse.json({ error: "Participant ID is required" }, { status: 400 });
    if (!databaseId) return NextResponse.json({ error: "Database ID is required" }, { status: 400 });

    const participantRef = getAdminDb()
      .collection("databases")
      .doc(databaseId)
      .collection("participants")
      .doc(id);
    const participantSnap = await participantRef.get();
    const participantData = participantSnap.exists ? participantSnap.data() : null;

    // Cascade the linked certificate doc + its Drive file first (best-effort).
    if (participantData?.certificateId) {
      await deleteCertificateCascade({
        uniqueCertId: participantData.certificateId,
        clearParticipant: false, // the participant is about to be deleted outright
      }).catch((e) => console.error("Cert cascade during participant delete failed:", e));
    }

    // Delete the participant's own Drive file if the cert cascade did not already.
    if (!keepPdf) {
      const fileId =
        participantData?.driveFileId || fileIdFromLink(participantData?.driveLink);
      if (fileId) await deleteDriveFile(fileId);
    }
```

Keep the rest of the function (the `participantRef.delete()` and the sheet `clearCertIdsByEmail` call) unchanged.

Add imports:
```ts
import { deleteDriveFile, fileIdFromLink } from "@/lib/driveCleanup";
import { deleteCertificateCascade } from "@/lib/certCascade";
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 3: Update callers that pass `deletePdf=true`**

Grep: `npx grep -rn "deletePdf" app components` (or use the editor). In `app/admin/databases/page.tsx` line ~882 the URL is `...&deletePdf=true`. That param is now ignored (delete-by-default). Leave it — harmless. No behavior change needed; note it in the commit.

- [ ] **Step 4: Commit**

```bash
git add app/api/participants/[id]/route.ts
git commit -m "feat(api): participant DELETE removes Drive PDF by default + cascades cert doc

Previously the cert doc was orphaned and the PDF only deleted with ?deletePdf=true.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `DELETE /api/databases` — trash the Drive folder

**Files:**
- Modify: `app/api/databases/route.ts` (the `DELETE` export, lines ~26-85)

**Interfaces:**
- Consumes: `deleteDriveFolder` from `@/lib/driveCleanup`.

- [ ] **Step 1: Add the folder deletion**

In `app/api/databases/route.ts`, in the `DELETE` function, after the templates-subcollection cleanup loop and **before** `await databaseRef.delete();` (line ~74), add:

```ts
    // Trash the database's Drive folder (best-effort — a leftover folder beats a failed delete).
    if (dbData?.driveFolderId) {
      await deleteDriveFolder(dbData.driveFolderId);
    }
```

Update the response `message` to: `"Database, participants, Drive files, Drive folder and Sheet data deleted"`.

Add import: `import { deleteDriveFolder } from "@/lib/driveCleanup";`

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add app/api/databases/route.ts
git commit -m "feat(api): database DELETE also trashes its Drive folder

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `POST /api/participants/bulk-delete`

**Files:**
- Create: `app/api/participants/bulk-delete/route.ts`

**Interfaces:**
- Consumes: `getAdminDb`, `requireAdmin`, `deleteDriveFile`, `fileIdFromLink`, `deleteCertificateCascade`.
- Produces: `POST { databaseId: string; participantIds: string[]; deleteCerts?: boolean; deletePdfs?: boolean }` → `{ success, deleted, certDocsDeleted, driveFilesDeleted, errors: string[] }`

- [ ] **Step 1: Write the route**

Create `app/api/participants/bulk-delete/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { deleteDriveFile, fileIdFromLink } from "@/lib/driveCleanup";
import { deleteCertificateCascade } from "@/lib/certCascade";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { databaseId, participantIds, deleteCerts = true, deletePdfs = true } =
      await request.json();

    if (!databaseId || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { error: "databaseId and a non-empty participantIds array are required" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const col = db.collection("databases").doc(databaseId).collection("participants");
    const errors: string[] = [];
    let certDocsDeleted = 0;
    let driveFilesDeleted = 0;
    let deleted = 0;

    for (const pid of participantIds) {
      try {
        const snap = await col.doc(pid).get();
        const data = snap.exists ? snap.data() : null;

        if (data?.certificateId && deleteCerts) {
          const res = await deleteCertificateCascade({
            uniqueCertId: data.certificateId,
            clearParticipant: false,
          });
          certDocsDeleted += res.deletedCertDocs;
          if (res.driveFileDeleted) driveFilesDeleted++;
        }

        if (deletePdfs) {
          const fileId = data?.driveFileId || fileIdFromLink(data?.driveLink);
          if (fileId && !(data?.certificateId && deleteCerts)) {
            await deleteDriveFile(fileId);
            driveFilesDeleted++;
          }
        }

        await col.doc(pid).delete();
        deleted++;
      } catch (err) {
        errors.push(`${pid}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      certDocsDeleted,
      driveFilesDeleted,
      errors,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Bulk delete failed", details: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass. Confirm the route appears in the build route list as `/api/participants/bulk-delete`.

- [ ] **Step 3: Commit**

```bash
git add app/api/participants/bulk-delete/route.ts
git commit -m "feat(api): add participants/bulk-delete with server-side Drive cascade

Wiring the admin UI to it is done in Plan B (BulkActionsBar extraction).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Surface `sharingFailed` + `ensure-public` route

**Files:**
- Modify: `app/api/templates/route.ts` (the `POST` export, lines ~56-91)
- Modify: `app/api/drive-upload/route.ts` (the `POST` export, lines ~20-36)
- Create: `app/api/drive/ensure-public/route.ts`

**Interfaces:**
- Produces: `POST /api/drive/ensure-public { fileId?, folderId? }` → `{ success, shared }`
- `POST /api/templates` and `POST /api/drive-upload` responses gain `sharingFailed?: boolean`.

- [ ] **Step 1: templates route — read `shared`**

In `app/api/templates/route.ts` `POST`, after the `if (!driveData.success) { throw ... }` check, in the `NextResponse.json({ success: true, ... })` at the end (line ~91), add `sharingFailed: driveData.shared === false` to the returned object.

- [ ] **Step 2: drive-upload route — read `shared`**

In `app/api/drive-upload/route.ts` `POST`, in the final `NextResponse.json({ success: true, ... })` (line ~30), add `sharingFailed: result.shared === false`.

- [ ] **Step 3: Create the ensure-public route**

Create `app/api/drive/ensure-public/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { ensureDrivePublic } from "@/lib/driveCleanup";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { fileId, folderId } = await request.json();
    if (!fileId && !folderId) {
      return NextResponse.json({ error: "fileId or folderId is required" }, { status: 400 });
    }
    const { shared } = await ensureDrivePublic({ fileId, folderId });
    return NextResponse.json({ success: true, shared });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "ensure-public failed", details: msg }, { status: 500 });
  }
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass; `/api/drive/ensure-public` in the route list.

- [ ] **Step 5: Commit**

```bash
git add app/api/templates/route.ts app/api/drive-upload/route.ts app/api/drive/ensure-public/route.ts
git commit -m "feat(api): report sharingFailed on upload, add drive/ensure-public

UI wiring for the 'Make public' / 'Fix folder sharing' buttons is in Plan B/C.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `.env.example` note + Plan A verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the doc note**

In `.env.example`, near the `GOOGLE_APPS_SCRIPT_URL` / `APPS_SCRIPT_SECRET` block, add a comment:

```
# NOTE: The Apps Script bridge runs as its owner account and creates every Drive
# file/folder there. That account MUST allow "anyone with the link" sharing
# (a personal Gmail does; a Workspace account with restricted external sharing
# does not — with such an account, uploads succeed but stay private and no code
# change can override the domain policy).
```

- [ ] **Step 2: Full test + build gate**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; Vitest all pass (existing 22 + 3 new `driveCleanup`); build succeeds.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: note the bridge account's link-sharing requirement

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Report to the user**

State plainly:
- What shipped (routes + lib + apps-script).
- **Action required:** redeploy the Apps Script web app, then push + verify the Vercel Production blue-dot SHA matches (see spec §11.4).
- Manual checks to run post-deploy (spec §11.2 items 8 + 9): delete a cert from the certificates table; delete a participant with a cert; delete a whole database; open a fresh template's Drive link in incognito.

---

## Self-Review Notes

- **Spec §9 coverage:** cert cascade (Tasks 3-4), participant cascade (Task 5), database folder (Task 6), bulk (Task 7), `deleteFolder` action (Task 2). ✅
- **Spec §10 coverage:** `deleteFolder`/`ensurePublic`/folder sharing (Task 2), `ensureDrivePublic` + route (Tasks 1, 8), `sharingFailed` surfacing (Task 8), `.env.example` note (Task 9). UI buttons for "Make public" are deferred to Plan B/C (they live in components being extracted there) — noted in Task 8.
- **Type consistency:** `deleteCertificateCascade` signature identical in Tasks 3, 4, 5, 7. `fileIdFromLink` / `deleteDriveFile` / `deleteDriveFolder` / `ensureDrivePublic` identical in Tasks 1, 3, 5, 6, 8.
- **Deferred to Plan B:** collapsing the monolith's client-side `handleDeleteCertificate` / `handleDeleteCertId` / `handleDeletePdfOnly` / bulk handlers to single server calls — those handlers move into extracted components in Plan B, which is where the wiring belongs.
