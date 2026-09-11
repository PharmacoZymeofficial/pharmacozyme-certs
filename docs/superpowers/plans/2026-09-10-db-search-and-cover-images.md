# Admin Database Search + Per-Database Cover Images — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side search box to the admin database grid, and an optional 16:9 cover image per database shown on the admin grid, admin detail header, public verify/official cards, and the public scoped-search header.

**Architecture:** Search is a pure predicate (`lib/databaseFilter.ts`) filtering an already-loaded list — no API. Cover images are uploaded through a new admin route to Google Drive via a new Apps Script action, their Drive file id stored on the `Database` doc, and served back through a public proxy route (`GET /api/databases/[id]/cover`) that streams bytes from Apps Script with long CDN cache headers. All render sites fall back to today's icon/gradient when no cover is set.

**Tech Stack:** Next.js 16 App Router (webpack build), React 19, TypeScript, Tailwind v4, Vitest (node env, pure-logic tests only), Firestore Admin SDK, Google Apps Script bridge (`lib/appsScript.ts` → `callAppsScript`).

**Spec:** `docs/superpowers/specs/2026-09-10-db-search-and-cover-images-design.md`

## Global Constraints

- Live production app (`cert.pharmacozyme.com`), ~4,200 real certificates — additive changes only.
- Firestore via Admin SDK only: `getAdminDb()` from `lib/firebase.admin.ts`. NEVER import `firebase-admin/auth`.
- Use the **Bash tool** (not PowerShell) for `npm`/`npx`.
- `apps-script.js` is NOT bundled — the user hand-pastes it into `script.google.com` and manually redeploys the web app. No Java in the sandbox → Apps Script changes are **hand-traced, never emulator-tested**.
- Apps Script actions are dispatched from the `doPost` `switch` on `action`; every handler returns a plain object, receives the full parsed `payload`, and must tolerate `isAuthorized` already having run.
- Admin API routes are gated with `const guard = await requireAdmin(request); if (!guard.ok) return guard.response;`.
- Dynamic route params are `{ params }: { params: Promise<{ id: string }> }` and must be `await`ed.
- Vitest: tests live in `tests/**/*.test.ts`, `environment: "node"`, alias `@` → repo root. Pure logic only — no route or component tests in this codebase; everything else is manual smoke.
- Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Conventional Commits.
- Pre-push gate: `npx tsc --noEmit`, `npx vitest run`, `npm run build` — all clean.
- Branch: `feat/db-search-and-covers` (already created off `main` @ `88b59d1`; the design doc is already committed on it).
- Inviolable: no changes to `lib/urls.ts` / auto-verify, the counts-only email model, or the Sheet alias tables (`ALIASES` / `MANAGED_ALIASES_`).

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `lib/databaseFilter.ts` | Pure `filterDatabases(dbs, query)` predicate for the admin grid search |
| `tests/databaseFilter.test.ts` | Unit tests for `filterDatabases` |
| `lib/coverImage.ts` | Pure cover helpers: `centerCrop16x9`, `COVER_W`, `COVER_H`, `coverUrl` |
| `tests/coverImage.test.ts` | Unit tests for `centerCrop16x9` + `coverUrl` |
| `lib/coverImage.client.ts` | Browser-only canvas glue: `cropToCoverBlob(file) → Promise<Blob>` (uses `centerCrop16x9`) |
| `app/api/databases/[id]/cover/route.ts` | `POST` (upload), `DELETE` (clear), `GET` (public serving proxy) |

**Modified files**

| File | Change |
|---|---|
| `apps-script.js` | New actions `uploadDatabaseCover`, `getFileBytes`; new `DB_COVERS_FOLDER_ID` handling; two `doPost` switch cases |
| `lib/types.ts` | `Database.coverImageId?: string`, `Database.coverUpdatedAt?: string` |
| `components/admin/databases/useDatabaseManager.ts` | Expose `fetchDatabases` in the hook's return object |
| `components/admin/databases/DatabaseManager.tsx` | Local `dbSearch` state; pass filtered list + search props to `DatabaseList`; pass `fetchDatabases` to `DatabaseDetail` |
| `components/admin/databases/DatabaseList.tsx` | Accept `query`; render no-match state; render cover on each card |
| `components/admin/databases/DatabaseDetail.tsx` | Cover banner + Add/Change/Remove controls; upload/remove wiring |
| `components/PublicDatabaseCards.tsx` | Cover on each card |
| `components/OfficialDatabaseCards.tsx` | Cover on each card |
| `components/VerifySearch.tsx` | Cover thumbnail in the `selectedDb` header block |
| `components/OfficialSearch.tsx` | Cover thumbnail in the `selectedDb` header block |
| `app/api/databases/public/route.ts` | Add `coverImageId` + `coverUpdatedAt` to the returned field subset |

---

## Task 1: `filterDatabases` pure predicate

**Files:**
- Create: `lib/databaseFilter.ts`
- Test: `tests/databaseFilter.test.ts`

**Interfaces:**
- Consumes: `Database` from `@/lib/types` (existing).
- Produces: `filterDatabases(dbs: Database[], query: string): Database[]` — trims `query`; empty/whitespace query returns `dbs` unchanged (same array reference is fine); otherwise returns the subset whose `name`, `subCategory`, or `topic` contains the query as a case-insensitive substring.

- [ ] **Step 1: Write the failing test**

```ts
// tests/databaseFilter.test.ts
import { describe, it, expect } from "vitest";
import { filterDatabases } from "@/lib/databaseFilter";
import type { Database } from "@/lib/types";

const db = (over: Partial<Database>): Database => ({
  name: "", category: "General", subCategory: "", topic: "", ...over,
});

const list: Database[] = [
  db({ name: "MEP Batch 1", subCategory: "Pharmacy", topic: "Compounding" }),
  db({ name: "Diploma Cohort", subCategory: "Clinical", topic: "Ward Rounds" }),
  db({ name: "Experience Letters", subCategory: "HR", topic: "Internships" }),
];

describe("filterDatabases", () => {
  it("returns the input unchanged for an empty query", () => {
    expect(filterDatabases(list, "")).toBe(list);
  });

  it("returns the input unchanged for a whitespace-only query", () => {
    expect(filterDatabases(list, "   ")).toBe(list);
  });

  it("matches on name, case-insensitively", () => {
    expect(filterDatabases(list, "mep").map((d) => d.name)).toEqual(["MEP Batch 1"]);
  });

  it("matches on subCategory", () => {
    expect(filterDatabases(list, "clinical").map((d) => d.name)).toEqual(["Diploma Cohort"]);
  });

  it("matches on topic", () => {
    expect(filterDatabases(list, "intern").map((d) => d.name)).toEqual(["Experience Letters"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterDatabases(list, "zzz")).toEqual([]);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(filterDatabases(list, "  diploma  ").map((d) => d.name)).toEqual(["Diploma Cohort"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/databaseFilter.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/databaseFilter"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/databaseFilter.ts
import type { Database } from "@/lib/types";

/**
 * Client-side filter for the admin database grid. The grid already holds the
 * full per-category list in memory, so this is a plain substring match — no
 * API call, no pagination. Matches the fields the public filter and the
 * templates-page search use: name, subCategory, topic (deliberately not
 * description).
 */
export function filterDatabases(dbs: Database[], query: string): Database[] {
  const q = query.trim().toLowerCase();
  if (!q) return dbs;
  return dbs.filter((d) =>
    `${d.name} ${d.subCategory} ${d.topic}`.toLowerCase().includes(q)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/databaseFilter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/databaseFilter.ts tests/databaseFilter.test.ts
git commit -m "feat(databases): add filterDatabases predicate for admin grid search

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Wire search into the admin database grid

**Files:**
- Modify: `components/admin/databases/DatabaseManager.tsx`
- Modify: `components/admin/databases/DatabaseList.tsx`

**Interfaces:**
- Consumes: `filterDatabases` from `@/lib/databaseFilter` (Task 1).
- Produces: `DatabaseList` gains two required props — `query: string` and `onClearQuery: () => void` — used only for the no-match empty state. The search `<input>` itself lives in `DatabaseManager`.

- [ ] **Step 1: Add search state + input in `DatabaseManager.tsx`**

Near the other `useState` / hook destructuring at the top of the component body, add:

```tsx
const [dbSearch, setDbSearch] = useState("");
```

`useState` is already imported? It imports `{ useEffect }` only — change that import to `import { useEffect, useState } from "react";`.

Add `filterDatabases` import at the top:

```tsx
import { filterDatabases } from "@/lib/databaseFilter";
```

Add `fetchDatabases` to the `useDatabaseManager(category)` destructuring (it is exposed in Task 7 — if Task 7 has not run yet, add it there first; the hook currently defines `fetchDatabases` at line ~278 but does not return it).

- [ ] **Step 2: Render the search input above `DatabaseList`**

Replace the `{!selectedDatabase && ( <DatabaseList ... /> )}` block with a fragment that renders a toolbar then the list. Match the templates-page toolbar style (`app/admin/templates/page.tsx:689-703`):

```tsx
{!selectedDatabase && (
  <>
    <div className="mb-6 relative max-w-sm">
      <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-gray-400 pointer-events-none">search</span>
      <input
        type="text"
        placeholder="Search databases…"
        value={dbSearch}
        onChange={(e) => setDbSearch(e.target.value)}
        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-green-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-vivid-green"
      />
      {dbSearch && (
        <button
          onClick={() => setDbSearch("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      )}
    </div>
    <DatabaseList
      databases={filterDatabases(databases, dbSearch)}
      query={dbSearch}
      onClearQuery={() => setDbSearch("")}
      setShowCreateModal={setShowCreateModal}
      setSelectedDatabase={setSelectedDatabase}
      setFilterStatus={setFilterStatus}
      setFilterEmailed={setFilterEmailed}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      renamingDbId={renamingDbId}
      setRenamingDbId={setRenamingDbId}
      renameValue={renameValue}
      setRenameValue={setRenameValue}
      handleRenameDatabase={handleRenameDatabase}
      handleDeleteDatabase={handleDeleteDatabase}
      handleToggleLive={handleToggleLive}
      onResumeDatabase={resumeDatabase}
    />
  </>
)}
```

- [ ] **Step 3: Add `query` / `onClearQuery` props + no-match state in `DatabaseList.tsx`**

In `DatabaseListProps` add:

```tsx
  query: string;
  onClearQuery: () => void;
```

Add them to the destructured params. Then change the top-level conditional so an empty list caused by an active query shows a distinct state:

```tsx
{databases.length === 0 ? (
  query.trim() ? (
    <div className="bg-white rounded-xl border border-green-100 p-12 text-center">
      <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">search_off</span>
      <h3 className="text-lg font-headline font-bold text-brand-dark-green mb-1">No databases match “{query.trim()}”</h3>
      <button onClick={onClearQuery} className="mt-3 text-sm font-bold text-brand-green hover:underline">
        Clear search
      </button>
    </div>
  ) : (
    // ... existing "No Databases Yet" block unchanged ...
  )
) : (
  // ... existing grid unchanged ...
)}
```

- [ ] **Step 4: Verify build + types**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, 99 tests pass (92 existing + 7 from Task 1).

- [ ] **Step 5: Manual smoke**

Run: `npm run dev`, open `/admin/databases`. Type a partial database name → grid narrows. Type gibberish → "No databases match" with a working "Clear search". Switch General/Official tab → counts unchanged, search field persists its text (acceptable). Open a database → search field is gone; go back → it reappears.

- [ ] **Step 6: Commit**

```bash
git add components/admin/databases/DatabaseManager.tsx components/admin/databases/DatabaseList.tsx
git commit -m "feat(databases): search box on the admin database grid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `coverImage` pure helpers

**Files:**
- Create: `lib/coverImage.ts`
- Test: `tests/coverImage.test.ts`

**Interfaces:**
- Consumes: `Database` from `@/lib/types`.
- Produces:
  - `export const COVER_W = 1600;`
  - `export const COVER_H = 900;`
  - `centerCrop16x9(srcW: number, srcH: number): { sx: number; sy: number; sw: number; sh: number }` — the source rectangle to sample so a center crop fills a 16:9 target. For a source wider than 16:9, `sh = srcH`, `sw = srcH * 16/9`, `sx = (srcW - sw) / 2`, `sy = 0`. For taller, mirror on the other axis. For exactly 16:9, the whole source.
  - `coverUrl(db: Pick<Database, "id" | "coverImageId" | "coverUpdatedAt">): string | null` — returns `/api/databases/${db.id}/cover?v=${encodeURIComponent(db.coverUpdatedAt ?? "")}` when both `id` and `coverImageId` are truthy, else `null`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/coverImage.test.ts
import { describe, it, expect } from "vitest";
import { centerCrop16x9, coverUrl, COVER_W, COVER_H } from "@/lib/coverImage";

describe("centerCrop16x9", () => {
  it("keeps full height and crops width on a wide source", () => {
    // 4000x1000 (4:1) → sample 1777.77x1000 centered
    const r = centerCrop16x9(4000, 1000);
    expect(r.sh).toBe(1000);
    expect(r.sw).toBeCloseTo(1000 * (16 / 9), 3);
    expect(r.sx).toBeCloseTo((4000 - 1000 * (16 / 9)) / 2, 3);
    expect(r.sy).toBe(0);
  });

  it("keeps full width and crops height on a tall source", () => {
    // 900x1600 → sample 900x506.25 centered
    const r = centerCrop16x9(900, 1600);
    expect(r.sw).toBe(900);
    expect(r.sh).toBeCloseTo(900 * (9 / 16), 3);
    expect(r.sy).toBeCloseTo((1600 - 900 * (9 / 16)) / 2, 3);
    expect(r.sx).toBe(0);
  });

  it("samples the whole source when it is already 16:9", () => {
    expect(centerCrop16x9(1920, 1080)).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });
});

describe("coverUrl", () => {
  it("returns a versioned path when a cover is set", () => {
    expect(coverUrl({ id: "abc", coverImageId: "drive123", coverUpdatedAt: "2026-09-10T00:00:00.000Z" }))
      .toBe("/api/databases/abc/cover?v=2026-09-10T00%3A00%3A00.000Z");
  });

  it("returns null when there is no coverImageId", () => {
    expect(coverUrl({ id: "abc", coverImageId: undefined, coverUpdatedAt: undefined })).toBeNull();
  });

  it("returns null when there is no id", () => {
    expect(coverUrl({ id: undefined, coverImageId: "drive123", coverUpdatedAt: "x" })).toBeNull();
  });

  it("tolerates a missing coverUpdatedAt", () => {
    expect(coverUrl({ id: "abc", coverImageId: "drive123", coverUpdatedAt: undefined }))
      .toBe("/api/databases/abc/cover?v=");
  });
});

describe("constants", () => {
  it("are a 16:9 pair", () => {
    expect(COVER_W / COVER_H).toBeCloseTo(16 / 9, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/coverImage.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/coverImage"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/coverImage.ts
import type { Database } from "@/lib/types";

export const COVER_W = 1600;
export const COVER_H = 900;
const RATIO = 16 / 9;

/**
 * The source rectangle to sample so that drawing it into a 16:9 target
 * produces a center crop (no distortion, no letterboxing).
 */
export function centerCrop16x9(
  srcW: number,
  srcH: number
): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = srcW / srcH;
  if (srcRatio > RATIO) {
    // too wide — full height, crop the sides
    const sw = srcH * RATIO;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  if (srcRatio < RATIO) {
    // too tall — full width, crop top/bottom
    const sh = srcW / RATIO;
    return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
  }
  return { sx: 0, sy: 0, sw: srcW, sh: srcH };
}

/**
 * URL for the public cover-serving proxy, cache-busted by the last write.
 * null when the database has no cover — callers render the icon/gradient
 * fallback instead.
 */
export function coverUrl(
  db: Pick<Database, "id" | "coverImageId" | "coverUpdatedAt">
): string | null {
  if (!db.id || !db.coverImageId) return null;
  return `/api/databases/${db.id}/cover?v=${encodeURIComponent(db.coverUpdatedAt ?? "")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/coverImage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/coverImage.ts tests/coverImage.test.ts
git commit -m "feat(databases): add coverImage crop math + proxy-url helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `Database` type fields + Apps Script actions

**Files:**
- Modify: `lib/types.ts:2-19` (the `Database` interface)
- Modify: `apps-script.js` (config constants near line 5-8; `doPost` switch near line 80-133; new functions near the `uploadTemplate` / `getTemplateBytes` block ~line 451-479)

**Interfaces:**
- Produces (TS): `Database.coverImageId?: string`, `Database.coverUpdatedAt?: string`.
- Produces (Apps Script, called via `callAppsScript(action, payload)`):
  - `uploadDatabaseCover({ fileName: string, base64Data: string, mimeType: string, folderId?: string })` → `{ success: true, fileId: string }` (throws → `{ error }` shape from the `doPost` catch).
  - `getFileBytes({ fileId: string })` → `{ success: true, base64: string, mimeType: string }`.

- [ ] **Step 1: Add the type fields**

In `lib/types.ts`, inside `interface Database`, after `driveFolderUrl?: string;`:

```ts
  /** Google Drive file id of the database's 16:9 cover image, if one was uploaded. */
  coverImageId?: string;
  /** ISO timestamp of the last cover write — used to cache-bust the serving proxy. */
  coverUpdatedAt?: string;
```

- [ ] **Step 2: Add the `DB_COVERS` folder constant**

In `apps-script.js`, after the `TEMPLATES_FOLDER_ID` line (~line 8):

```js
// Fallback folder for database cover images when the database has no Drive
// folder of its own. Covers for databases that DO have a folder go into that
// folder instead, so the existing folder-delete cascade removes them.
// Leave as "" to auto-create a "PZ DB Covers" folder under the Drive root on
// first use; paste the resulting id here afterwards to skip the name lookup.
var DB_COVERS_FOLDER_ID = "";
```

- [ ] **Step 3: Add the two switch cases**

In the `doPost` `switch (action)` block, alongside the other Drive cases (after `case "getTemplateBytes":`):

```js
      case "uploadDatabaseCover":
        result = uploadDatabaseCover(payload);
        break;
      case "getFileBytes":
        result = getFileBytes(payload);
        break;
```

- [ ] **Step 4: Add the handler functions**

After `getTemplateBytes` (~line 479):

```js
// Uploads a database cover image. Into the database's own Drive folder when
// folderId is supplied (so folder deletion also removes the cover); otherwise
// into DB_COVERS_FOLDER_ID (auto-created if blank).
function uploadDatabaseCover(payload) {
  var fileName = payload.fileName;
  var base64Data = payload.base64Data;
  var mimeType = payload.mimeType || "image/webp";
  if (!fileName || !base64Data) throw new Error("fileName and base64Data are required");

  var folder;
  if (payload.folderId) {
    try {
      folder = DriveApp.getFolderById(payload.folderId);
      if (folder.isTrashed()) folder = coversFolder_();
    } catch (e) {
      folder = coversFolder_();
    }
  } else {
    folder = coversFolder_();
  }

  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
  var file = folder.createFile(blob);
  shareBestEffort(file);
  return { success: true, fileId: file.getId() };
}

// Resolves the fallback covers folder, creating it once if needed.
function coversFolder_() {
  if (DB_COVERS_FOLDER_ID) {
    try { return DriveApp.getFolderById(DB_COVERS_FOLDER_ID); } catch (e) { /* fall through */ }
  }
  var existing = DriveApp.getFoldersByName("PZ DB Covers");
  if (existing.hasNext()) return existing.next();
  return DriveApp.createFolder("PZ DB Covers");
}

// Returns any Drive file's bytes as base64, running as the file owner so it
// works even when Workspace policy blocks anyone-with-link sharing. Same
// rationale as getTemplateBytes.
function getFileBytes(payload) {
  var fileId = payload.fileId;
  if (!fileId) throw new Error("fileId is required");
  var blob = DriveApp.getFileById(fileId).getBlob();
  return { success: true, base64: Utilities.base64Encode(blob.getBytes()), mimeType: blob.getContentType() };
}
```

- [ ] **Step 5: Hand-trace the Apps Script changes**

No emulator. Read through by hand and confirm in the plan's review notes:
- `doPost` parses `payload` from `JSON.parse(e.postData.contents)` — `fileName`, `base64Data`, `mimeType`, `folderId`, `fileId` all arrive as top-level keys on the posted JSON (the client sends `{ action, ...payload, secret }`). ✔ matches `uploadTemplate`'s existing `payload.fileName` / `payload.base64Data` access.
- `isAuthorized(payload)` runs before the switch — unaffected.
- `Utilities.newBlob(bytes, contentType, name)` + `folder.createFile(blob)` is exactly the `uploadTemplate` pattern. ✔
- Trashed-folder guard mirrors `uploadPDF` (`folder.isTrashed()`). ✔
- `getFileBytes` is `getTemplateBytes` with the fixed `application/pdf` assumption removed. ✔

- [ ] **Step 6: Verify TS build**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean (no test change; `apps-script.js` is not part of the TS project).

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts apps-script.js
git commit -m "feat(databases): cover-image type fields + Apps Script upload/getFileBytes actions

apps-script.js must be hand-pasted into script.google.com and the web app
redeployed before the cover routes work — tracked as a release step.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Cover route — `POST` / `DELETE` / `GET`

**Files:**
- Create: `app/api/databases/[id]/cover/route.ts`

**Interfaces:**
- Consumes: `getAdminDb` (`@/lib/firebase.admin`), `requireAdmin` (`@/lib/requireAdmin`), `callAppsScript` + `appsScriptConfigured` (`@/lib/appsScript`), `FieldValue` (`firebase-admin/firestore`). Apps Script actions `uploadDatabaseCover`, `getFileBytes`, `deletePDF` (existing — trashes any file id).
- Produces:
  - `POST /api/databases/[id]/cover` (admin) — multipart body with `file`; returns `{ success: true, coverImageId, coverUpdatedAt }`.
  - `DELETE /api/databases/[id]/cover` (admin) — returns `{ success: true }`.
  - `GET /api/databases/[id]/cover` (public) — `image/*` bytes with long CDN cache headers, or 404.

- [ ] **Step 1: Write the route**

```ts
// app/api/databases/[id]/cover/route.ts
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

const MAX_BYTES = 6 * 1024 * 1024; // client already downscales to ~1600x900 WebP

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  if (!appsScriptConfigured()) {
    return NextResponse.json({ error: "GOOGLE_APPS_SCRIPT_URL is not set" }, { status: 500 });
  }

  try {
    const { id } = await params;
    const dbRef = getAdminDb().collection("databases").doc(id);
    const snap = await dbRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Database not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 400 });
    }

    const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const folderId = (snap.data()?.driveFolderId as string | undefined) || undefined;
    const prevCoverId = snap.data()?.coverImageId as string | undefined;

    const call = () =>
      callAppsScript("uploadDatabaseCover", {
        fileName: `cover-${id}-${Date.now()}.webp`,
        base64Data,
        mimeType: file.type,
        ...(folderId ? { folderId } : {}),
      });

    let res: any;
    try {
      res = await call();
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      res = await call();
    }
    if (!res?.success || !res.fileId) {
      throw new Error(`Cover upload failed: ${res?.error || JSON.stringify(res)}`);
    }

    const coverUpdatedAt = new Date().toISOString();
    await dbRef.update({ coverImageId: res.fileId, coverUpdatedAt });

    // Best-effort trash of the previous cover; never fail the request for it.
    if (prevCoverId && prevCoverId !== res.fileId) {
      callAppsScript("deletePDF", { fileId: prevCoverId }).catch(() => {});
    }

    return NextResponse.json({ success: true, coverImageId: res.fileId, coverUpdatedAt });
  } catch (error: any) {
    console.error("Cover POST failed:", error);
    return NextResponse.json({ error: error?.message || "Upload failed" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const dbRef = getAdminDb().collection("databases").doc(id);
    const snap = await dbRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Database not found" }, { status: 404 });

    const coverId = snap.data()?.coverImageId as string | undefined;
    if (coverId && appsScriptConfigured()) {
      callAppsScript("deletePDF", { fileId: coverId }).catch(() => {});
    }
    await dbRef.update({
      coverImageId: FieldValue.delete(),
      coverUpdatedAt: FieldValue.delete(),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cover DELETE failed:", error);
    return NextResponse.json({ error: error?.message || "Delete failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const snap = await getAdminDb().collection("databases").doc(id).get();
    const coverId = snap.exists ? (snap.data()?.coverImageId as string | undefined) : undefined;
    if (!coverId) return new NextResponse(null, { status: 404 });

    const res = await callAppsScript("getFileBytes", { fileId: coverId });
    if (!res?.success || !res.base64) return new NextResponse(null, { status: 404 });

    const bytes = Buffer.from(res.base64, "base64");
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": res.mimeType || "image/webp",
        "Cache-Control": "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400",
      },
    });
  } catch (error: any) {
    console.error("Cover GET failed:", error);
    return new NextResponse(null, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify build + types**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all clean. `npm run build` should list the new route `ƒ /api/databases/[id]/cover`.

- [ ] **Step 3: Commit**

```bash
git add app/api/databases/\[id\]/cover/route.ts
git commit -m "feat(databases): cover-image upload/delete/serve route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Browser canvas glue — `cropToCoverBlob`

**Files:**
- Create: `lib/coverImage.client.ts`

**Interfaces:**
- Consumes: `centerCrop16x9`, `COVER_W`, `COVER_H` from `@/lib/coverImage` (Task 3).
- Produces: `cropToCoverBlob(file: File): Promise<Blob>` — decodes the image, center-crops to 16:9, draws onto a `COVER_W`×`COVER_H` canvas, resolves a `image/webp` blob at quality 0.82. Rejects if the file is not decodable or exceeds 10 MB.

- [ ] **Step 1: Write the module**

```ts
// lib/coverImage.client.ts
// Browser-only: uses <canvas> and Image. Do not import from server code.
import { centerCrop16x9, COVER_W, COVER_H } from "@/lib/coverImage";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export async function cropToCoverBlob(file: File): Promise<Blob> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Image must be under 10 MB");
  }

  const bitmap = await loadImage(file);
  const { sx, sy, sw, sh } = centerCrop16x9(bitmap.width, bitmap.height);

  const canvas = document.createElement("canvas");
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a canvas context");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, COVER_W, COVER_H);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image"))),
      "image/webp",
      0.82
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/coverImage.client.ts
git commit -m "feat(databases): client-side cover crop/encode helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Cover banner + controls in `DatabaseDetail`

**Files:**
- Modify: `components/admin/databases/useDatabaseManager.ts` (return object, ~line 1438)
- Modify: `components/admin/databases/DatabaseManager.tsx` (pass new prop)
- Modify: `components/admin/databases/DatabaseDetail.tsx`

**Interfaces:**
- Consumes: `coverUrl` (`@/lib/coverImage`), `cropToCoverBlob` (`@/lib/coverImage.client`).
- Produces: `DatabaseDetail` gains one prop — `onCoverChanged: () => void` — called after a successful upload or remove so the parent re-fetches the database list.

- [ ] **Step 1: Expose `fetchDatabases` from the hook**

In `components/admin/databases/useDatabaseManager.ts`, in the `return { ... }` object (starts ~line 1438), add `fetchDatabases,` next to `fetchParticipants,`.

- [ ] **Step 2: Pass the callback from `DatabaseManager`**

In `DatabaseManager.tsx`, add `fetchDatabases` to the `useDatabaseManager(category)` destructuring (if not already added in Task 2). On the `<DatabaseDetail ... />` element add:

```tsx
onCoverChanged={() => fetchDatabases(true)}
```

- [ ] **Step 3: Add the prop to `DatabaseDetail` types + signature**

In `DatabaseDetailProps` add `onCoverChanged: () => void;` and destructure it.

Add imports at the top:

```tsx
import { useRef, useState } from "react";
import { coverUrl } from "@/lib/coverImage";
import { cropToCoverBlob } from "@/lib/coverImage.client";
```

- [ ] **Step 4: Add upload state + handlers inside the component**

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);
const [coverBusy, setCoverBusy] = useState(false);
const cover = coverUrl(selectedDatabase);

const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  setCoverBusy(true);
  try {
    const blob = await cropToCoverBlob(file);
    const body = new FormData();
    body.append("file", new File([blob], "cover.webp", { type: "image/webp" }));
    const res = await fetch(`/api/databases/${selectedDatabase.id}/cover`, { method: "POST", body });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Upload failed");
    toast.success("Cover updated");
    onCoverChanged();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Cover upload failed");
  } finally {
    setCoverBusy(false);
  }
};

const handleCoverRemove = async () => {
  setCoverBusy(true);
  try {
    const res = await fetch(`/api/databases/${selectedDatabase.id}/cover`, { method: "DELETE" });
    if (!res.ok) throw new Error("Remove failed");
    toast.success("Cover removed");
    onCoverChanged();
  } catch {
    toast.error("Could not remove the cover");
  } finally {
    setCoverBusy(false);
  }
};
```

(`toast` is an existing prop — `ReturnType<typeof useToast>`; confirm `.success` / `.error` exist on it by checking `components/Toast.tsx`. If the API differs, e.g. `toast(msg)`, adapt these four calls.)

- [ ] **Step 5: Render the cover banner**

Immediately inside `<div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-clip">`, before the `{/* Database Header */}` div, add:

```tsx
<div className="relative w-full aspect-[16/9] bg-green-50 group">
  {cover ? (
    <img src={cover} alt={`${selectedDatabase.name} cover`} className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center">
      <span className="material-symbols-outlined text-5xl text-green-200">image</span>
    </div>
  )}
  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={coverBusy}
      className="px-3 py-1.5 rounded-lg bg-white/95 text-brand-dark-green text-xs font-bold shadow disabled:opacity-50"
    >
      {coverBusy ? "Working…" : cover ? "Change cover" : "Add cover"}
    </button>
    {cover && !coverBusy && (
      <button
        onClick={handleCoverRemove}
        className="px-3 py-1.5 rounded-lg bg-white/95 text-red-600 text-xs font-bold shadow"
      >
        Remove
      </button>
    )}
  </div>
  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleCoverPick} />
</div>
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 7: Manual smoke** (requires the Apps Script redeploy — see Task 11; until then expect a 502 toast)

`npm run dev` → open a database → hover the banner → "Add cover" → pick a landscape photo → it crops, uploads, and appears. Re-open "Change cover" with a portrait photo → center-cropped correctly. "Remove" → falls back to the placeholder icon.

- [ ] **Step 8: Commit**

```bash
git add components/admin/databases/useDatabaseManager.ts components/admin/databases/DatabaseManager.tsx components/admin/databases/DatabaseDetail.tsx
git commit -m "feat(databases): cover banner + upload/remove controls in the detail view

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Cover on the admin grid cards

**Files:**
- Modify: `components/admin/databases/DatabaseList.tsx`

**Interfaces:**
- Consumes: `coverUrl` (`@/lib/coverImage`).

- [ ] **Step 1: Import the helper**

```tsx
import { coverUrl } from "@/lib/coverImage";
```

- [ ] **Step 2: Render a cover strip at the top of each card**

Inside `databases.map((db) => ( ... ))`, as the first child of the card `<div>` (before the `flex items-start justify-between` header row), add:

```tsx
{coverUrl(db) && (
  <div className="-m-6 mb-4 aspect-[16/9] overflow-hidden rounded-t-xl bg-green-50">
    <img src={coverUrl(db)!} alt="" className="w-full h-full object-cover" />
  </div>
)}
```

(The `-m-6 mb-4` pulls the image to the card edges past the `p-6` padding, then restores bottom spacing. Verify visually; if the card padding differs, use a wrapper instead.)

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual smoke**

Grid shows the cover above databases that have one; databases without a cover look exactly as before.

- [ ] **Step 5: Commit**

```bash
git add components/admin/databases/DatabaseList.tsx
git commit -m "feat(databases): show cover image on admin grid cards

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Covers on the public database cards

**Files:**
- Modify: `app/api/databases/public/route.ts`
- Modify: `components/PublicDatabaseCards.tsx`
- Modify: `components/OfficialDatabaseCards.tsx`

**Interfaces:**
- Consumes: `coverUrl` (`@/lib/coverImage`).
- Produces: `/api/databases/public` response objects gain `coverImageId: string` (or `""`) and `coverUpdatedAt: string` (or `""`).

- [ ] **Step 1: Return the cover fields from the public API**

In `app/api/databases/public/route.ts`, in the object returned from the `snap.docs.map` callback, add:

```ts
        coverImageId: (data.coverImageId as string) || "",
        coverUpdatedAt: (data.coverUpdatedAt as string) || "",
```

- [ ] **Step 2: Extend the `PublicDatabase` interface in both card files**

In `components/PublicDatabaseCards.tsx` and `components/OfficialDatabaseCards.tsx`, add to `interface PublicDatabase`:

```ts
  coverImageId?: string;
  coverUpdatedAt?: string;
```

- [ ] **Step 3: Render the cover in `DatabaseCard` (both files)**

Add the import:

```tsx
import { coverUrl } from "@/lib/coverImage";
```

In `DatabaseCard`, compute `const cover = coverUrl(db);` and render it as the first child inside the card container, before `{/* Card top accent strip */}`:

```tsx
{cover && (
  <div className="w-full aspect-[16/9] overflow-hidden" style={{ borderRadius: "1.25rem 1.25rem 0 0" }}>
    <img src={cover} alt="" className="w-full h-full object-cover" />
  </div>
)}
```

When `cover` is present the existing 4px accent strip still renders directly beneath it — that is fine. Leave the icon/header row untouched.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 5: Manual smoke**

On `/verify` and `/official`, live databases with a cover show the 16:9 image atop the card; the hover tilt / shimmer / count-up still work; databases without a cover are unchanged.

- [ ] **Step 6: Commit**

```bash
git add app/api/databases/public/route.ts components/PublicDatabaseCards.tsx components/OfficialDatabaseCards.tsx
git commit -m "feat(databases): show cover image on public verify/official cards

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Cover thumbnail in the public scoped-search header

**Files:**
- Modify: `components/VerifySearch.tsx` (the `selectedDb` block ~line 520)
- Modify: `components/OfficialSearch.tsx` (matching block)

**Interfaces:**
- Consumes: `coverUrl` (`@/lib/coverImage`). Needs `selectedDb` to carry `id`, `coverImageId`, `coverUpdatedAt` — confirm the `databases` state in these components comes from `/api/databases/public` (Task 9 adds the fields). If the local `Database`-ish type is inline, extend it with the two optional fields.

- [ ] **Step 1: Inspect the `selectedDb` render block**

Run: `sed -n '505,535p' components/VerifySearch.tsx` and the equivalent in `OfficialSearch.tsx`. Identify the element that shows `selectedDb.subCategory · selectedDb.topic`.

- [ ] **Step 2: Add the thumbnail**

Import `coverUrl`. Immediately before the name/subcategory text node, insert:

```tsx
{coverUrl(selectedDb) && (
  <img
    src={coverUrl(selectedDb)!}
    alt=""
    className="w-16 h-9 rounded-md object-cover flex-shrink-0"
  />
)}
```

Wrap the thumbnail + existing text in a `flex items-center gap-2` container if they are not already siblings in a flex row.

- [ ] **Step 3: Extend the local db type if needed**

If `tsc` complains that `coverImageId` / `coverUpdatedAt` are missing on the selected-db type, add them as optional fields to whatever interface backs `databases` in that file.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all clean.

- [ ] **Step 5: Manual smoke**

On `/verify`, click a database card that has a cover → the scoped header shows a small thumbnail beside its name. A database with no cover shows the header exactly as before.

- [ ] **Step 6: Commit**

```bash
git add components/VerifySearch.tsx components/OfficialSearch.tsx
git commit -m "feat(databases): cover thumbnail in the public scoped-search header

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Full verification + release notes

**Files:**
- Modify: `docs/superpowers/plans/2026-09-10-db-search-and-cover-images.md` (append a "Release steps" section — or wherever the team tracks manual deploy steps)

- [ ] **Step 1: Full local gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: types clean; vitest ~104 tests pass (92 + 7 + 5); build succeeds and lists `ƒ /api/databases/[id]/cover`.

- [ ] **Step 2: Write the release steps**

Append to this plan (or the team's deploy checklist):

```markdown
## Release steps (manual, user-owned)

1. Merge `feat/db-search-and-covers` and let Vercel deploy; confirm the
   Production deployment SHA matches the merge commit.
2. Open `script.google.com`, replace the whole `apps-script.js` with this
   branch's version, Save, then Deploy → Manage deployments → edit the active
   web-app deployment → New version → Deploy. The web-app URL does not change;
   `GOOGLE_APPS_SCRIPT_URL` stays as-is.
3. In the Apps Script editor, run `grantPermissions` once (Drive scope is
   unchanged but re-approving is harmless) if cover uploads return
   "Access denied: DriveApp".
4. Optional: after the first cover upload for a database with no Drive folder,
   open the auto-created "PZ DB Covers" folder in Drive, copy its id into
   `DB_COVERS_FOLDER_ID` at the top of `apps-script.js`, and redeploy — this
   skips a name lookup on every future fallback upload.
5. Smoke test (see Step 3 below) on production.
```

- [ ] **Step 3: Production smoke test (after the Apps Script redeploy)**

- [ ] Upload a cover on a database **with** a Drive folder → appears on the admin detail banner + admin grid card.
- [ ] Mark that database live (or use one already live) → cover shows on `/verify` (or `/official`) card and, after clicking the card, in the scoped-search header.
- [ ] Re-request the cover URL (`/api/databases/<id>/cover?v=...`) → second load is a CDN `HIT` (check the `x-vercel-cache` response header).
- [ ] Upload a cover on a database **without** a Drive folder → lands in "PZ DB Covers", renders the same.
- [ ] Replace a cover → new image shows within a second (cache-bust via `?v=`), old Drive file is in the trash.
- [ ] Remove a cover → all sites fall back to the icon/gradient.
- [ ] Delete a test database that had a folder-stored cover → its Drive folder (cover included) is trashed.
- [ ] Admin database search: partial name / subCategory / topic all narrow the grid; gibberish shows the no-match state.

- [ ] **Step 4: Commit + finish**

```bash
git add docs/superpowers/plans/2026-09-10-db-search-and-cover-images.md
git commit -m "docs: release steps for db-search-and-covers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Then invoke **superpowers:finishing-a-development-branch** to choose how to integrate (merge+push / PR / hold) — that decision is the user's per the project constraints.

---

## Self-Review

**Spec coverage**

| Spec section | Task(s) |
|---|---|
| §2 admin search — input, client filter, name+subCat+topic, no-match state, unfiltered tab counts | Task 1 (predicate), Task 2 (UI + no-match; counts already computed from `allDbs` upstream, untouched) |
| §3.1 data model — `coverImageId`, `coverUpdatedAt`, no PUT change | Task 4 |
| §3.2 storage — `uploadDatabaseCover`, `getFileBytes`, DB folder vs `DB_COVERS`, old-file cleanup, hand-trace | Task 4 (actions), Task 5 (cleanup via `deletePDF`) |
| §3.3 upload route — POST/DELETE, guards, retry, prior-file trash | Task 5 |
| §3.4 client crop — `centerCrop16x9`, canvas glue, WebP 0.82, 10 MB reject | Task 3 (math), Task 6 (glue) |
| §3.5 serving proxy — public GET, cache headers, `?v=`, no next/image domain, `coverUrl` helper | Task 3 (`coverUrl`), Task 5 (GET) |
| §3.6 render sites 1-4 + public API field subset | Task 8 (grid), Task 7 (detail), Task 9 (public cards + API), Task 10 (scoped header) |
| §4 data flow | Tasks 5-10 |
| §5 error handling — toasts, fallback, 404/502 | Task 5 (route), Task 7 (toasts) |
| §6 testing + release step | Task 1/3 (vitest), Task 11 (manual + release notes) |
| §8 inviolable-constraint check | Global Constraints; no task touches urls/email/aliases |

No spec requirement is left without a task.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Task 10 Step 1 asks the implementer to `sed` the exact lines because the surrounding JSX is large and not worth transcribing in full — the change itself (Steps 2-3) is given as complete code. Task 7 Step 4 flags the `toast` API as needing a one-line confirmation against `components/Toast.tsx` with explicit fallback instruction.

**Type consistency:** `coverImageId` / `coverUpdatedAt` spelled identically in `lib/types.ts` (Task 4), the route (Task 5), `coverUrl` (Task 3), the public API (Task 9), and the card interfaces (Task 9/10). `filterDatabases(dbs, query)` signature identical in Task 1 and Task 2. `coverUrl(db)` takes `Pick<Database, "id" | "coverImageId" | "coverUpdatedAt">` — satisfied by both the full `Database` (admin) and the extended `PublicDatabase` (public). Apps Script action names `uploadDatabaseCover` / `getFileBytes` identical in Task 4 (handlers + switch) and Task 5 (callers). `onCoverChanged` prop identical in Task 7 Steps 2-3.

---

## Release Steps (as implemented — read before deploying)

All 11 tasks are complete on `feat/db-search-and-covers`. Full local gate is clean:
`npx tsc --noEmit` clean, `npx vitest run` 107/107 (16 files), `npm run build` succeeds
and lists `ƒ /api/databases/[id]/cover`.

Two things changed from the original plan during implementation review — read these
before deploying, they affect what "correct behaviour" looks like:

- **The cover proxy's rate limit is 300 requests/60s per IP, keyed `cover:<ip>`** — not
  the 25/60s the plan originally specified. The original number was sized for a search
  endpoint and would have 429'd a visitor's browser mid-page-load on any database grid
  with more than ~25 live covers, and would have made the admin grid (mostly draft
  databases, so never CDN-cached) unusable past ~25 databases. `lib/rateLimit.ts` now
  takes optional `max`/`windowMs` params; `/api/verify` and `/api/search-name` are
  provably unaffected (both still call `rateLimit(ip)` with no args → original 25/60s).
- **All three 404 branches on the cover proxy cache for 60 seconds, not an hour.** The
  original hour-long cache would have pinned a draft's 404 at the edge for up to an hour
  after the database was published (there is no way to cache-bust a 404, since a cover
  page's URL is versioned only by `coverUpdatedAt`, which an `isLive` toggle doesn't
  touch), and would have turned any transient Apps Script hiccup into an hour-long
  visible outage on a live cover.

1. Merge `feat/db-search-and-covers` and let Vercel deploy; confirm the Production
   deployment SHA matches the merge commit.
2. Open `script.google.com`, replace the whole `apps-script.js` with this branch's
   version, Save, then Deploy → Manage deployments → edit the active web-app deployment
   → New version → Deploy. The web-app URL does not change; `GOOGLE_APPS_SCRIPT_URL`
   stays as-is. **Nothing cover-related works until this step is done** — `uploadDatabaseCover`
   and `getFileBytes` do not exist in the currently-deployed script.
3. In the Apps Script editor, run `grantPermissions` once (Drive scope is unchanged but
   re-approving is harmless) if cover uploads return "Access denied: DriveApp".
4. Optional: after the first cover upload for a database with no Drive folder, open the
   auto-created "PZ DB Covers" folder in Drive, copy its id into `DB_COVERS_FOLDER_ID`
   at the top of `apps-script.js`, and redeploy — skips a name lookup on every future
   fallback upload.
5. Run the production smoke test below.

### Production smoke test (after the Apps Script redeploy)

- [ ] Upload a cover on a database **with** a Drive folder → appears on the admin detail
      banner + admin grid card.
- [ ] Mark that database live (or use one already live) → cover shows on `/verify` (or
      `/official`) card and, after clicking the card, in the scoped-search header.
- [ ] Re-request the cover URL (`/api/databases/<id>/cover?v=...`) → second load is a CDN
      `HIT` (check the `x-vercel-cache` response header).
- [ ] Upload a cover on a database **without** a Drive folder → lands in "PZ DB Covers",
      renders the same.
- [ ] Replace a cover → new image shows within a second (cache-bust via `?v=`), old Drive
      file is in the trash (allow a few seconds — the delete is now correctly awaited).
- [ ] Remove a cover → all sites fall back to the icon/gradient.
- [ ] Force a cover load failure (e.g. temporarily break the Apps Script URL) → every
      render site (admin grid, admin detail, public cards, scoped header) falls back to
      its icon/gradient treatment, not a broken-image glyph.
- [ ] Delete a test database that had a folder-stored cover → its Drive folder (cover
      included) is trashed.
- [ ] Admin database search: partial name / subCategory / topic all narrow the grid;
      gibberish shows the no-match state.
- [ ] As a non-admin (logged out), try to fetch the cover of a database with `isLive: false`
      → 404, same shape as a missing cover. As an admin, the same URL should still resolve
      (draft-preview path), with a `private` cache header rather than the public long one.

### Rulings made during implementation

The full ledger with reasoning for every decision above the task level lives at
`.superpowers/sdd/2026-09-10-db-search-and-cover-images/progress.md` (git-ignored,
session-local). It will be deleted once the final whole-branch review is clean, per the
subagent-driven-development skill's Finish step. The two rate-limit/cache rulings above
are its highest-impact entries; the rest are mostly scoping/sequencing calls (which
tasks got batched, which trailer was active when) with no user-facing effect.
