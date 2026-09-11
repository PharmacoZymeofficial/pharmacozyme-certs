# Admin database search + per-database 16:9 cover images — Design

**Date:** 2026-09-10
**Status:** Approved (approach + all sections confirmed with the user), pending implementation plan
**Branch:** `feat/db-search-and-covers` (off `main` @ `88b59d1`)
**Scope:** One session. Live production app (`cert.pharmacozyme.com`), ~4,200 real certificates.

---

## 1. Problem statement

Two unrelated gaps in the admin **Database Management** section and its public
counterparts:

1. **No search on the admin database grid.** `components/admin/databases/DatabaseList.tsx`
   renders every database in the active category (General / Official) as a card
   with no filter. The templates admin page already got search + category split
   in `ae33cd4`; the public verify/official pages already have a client-side
   database filter (`PublicDatabaseCards.tsx`). The admin grid is the odd one out.

2. **No cover image per database.** Databases render as an icon + green gradient
   everywhere they appear (admin grid, admin detail header, public cards, public
   scoped-search header). The user wants an optional 16:9 cover image per
   database, uploaded from the admin panel, shown at all four sites.

---

## 2. Feature 1 — Admin database search

### Behaviour

- A search input sits above the card grid in `DatabaseManager`, rendered **only
  when no database is open** (`!selectedDatabase`), visually matching the
  templates-page search field.
- Filter is **client-side** over the already-loaded `databases` array (the list
  is already fully in memory per category — no pagination, no API call).
- Match: case-insensitive substring against `name`, `subCategory`, `topic`
  (same three fields the public filter and templates search use — **not**
  `description`).
- Empty-match state mirrors the public cards: a centered "No databases match
  \"<query>\"" block with the `search_off` icon.
- Category tab counts (`CategoryTabs`) continue to reflect the **unfiltered**
  totals — search narrows the visible cards only.

### Structure

- New pure module `lib/databaseFilter.ts`:
  ```ts
  export function filterDatabases(dbs: Database[], query: string): Database[]
  ```
  Trims the query; empty query returns the input unchanged; otherwise substring
  match on the three fields. Vitest-covered.
- `DatabaseManager` holds `const [dbSearch, setDbSearch] = useState("")` locally
  (not lifted into `useDatabaseManager` — nothing else needs it) and passes
  `filterDatabases(databases, dbSearch)` to `DatabaseList`, plus `dbSearch` /
  `setDbSearch` for the input and empty state.
- `DatabaseList` gets `query: string` and renders the "no match" block when
  `databases.length === 0 && query.trim()` (its existing "No Databases Yet"
  empty state stays for the genuinely-empty-category case).

### No API change. No `Database` type change.

---

## 3. Feature 2 — Per-database 16:9 cover image

### 3.1 Data model

`lib/types.ts` `Database` gains two optional fields:

| Field | Type | Meaning |
|---|---|---|
| `coverImageId` | `string?` | Google Drive file id of the uploaded cover |
| `coverUpdatedAt` | `string?` | ISO timestamp of the last cover write — used as the cache-bust query param |

`PUT /api/databases` already accepts `{ id, ...updateData }` and does a
passthrough `.update()`, so **persisting these needs no route change** — only the
upload route writes them.

### 3.2 Storage — Google Drive via Apps Script

Two new `apps-script.js` actions (added to the `doPost` switch):

- **`uploadDatabaseCover({ fileName, base64Data, mimeType, folderId })`**
  - Decodes the blob, uploads it into the database's **own Drive folder** when
    `folderId` (the DB's `driveFolderId`) is supplied — so the existing
    `deleteDriveFolder(dbData.driveFolderId)` cascade in `DELETE /api/databases`
    trashes the cover automatically on database deletion.
  - When the DB has no Drive folder, uploads into a dedicated `DB_COVERS` folder
    (created-if-missing under the root, id cached in a script constant like
    `TEMPLATES_FOLDER_ID` / `DRIVE_FOLDER_ID`).
  - `shareBestEffort(file)` (existing helper).
  - Returns `{ success: true, fileId }`.

- **`getFileBytes({ fileId })`** — generic; returns
  `{ success: true, base64, mimeType }`. Runs as the file owner, so it works even
  when a Workspace policy blocks "anyone with the link" (identical reasoning to
  the existing `getTemplateBytes`). Used by the serving proxy.

`apps-script.js` is **not bundled**. After this ships the user must hand-paste
the file into `script.google.com` and redeploy the web app (edit version, URL
unchanged). Changes are **hand-traced only** — no Java in the sandbox, no
Sheets/Drive emulator. This is a named release step (see §6).

Old-file cleanup: replacing a cover trashes the previous `coverImageId`
best-effort via a `deleteFile({ fileId })` action. If none exists yet, add it
(thin wrapper over `DriveApp.getFileById(fileId).setTrashed(true)`), or reuse
`deletePDF` if its shape fits.

### 3.3 Upload route — `app/api/databases/[id]/cover/route.ts`

- **`POST`** (admin-gated via `requireAdmin`):
  - Reads multipart `file`.
  - Server-side guards: `file.type` starts with `image/`; `file.size` ≤ a cap
    (the client already downscales — cap the raw upload at ~6 MB post-crop to be
    safe, reject clearly otherwise).
  - `base64 = Buffer.from(await file.arrayBuffer()).toString("base64")`.
  - Loads the DB doc to read `driveFolderId`.
  - `callAppsScript("uploadDatabaseCover", { fileName, base64Data, mimeType, folderId })`
    with one retry on failure (same pattern as `templates/route.ts`).
  - Best-effort trash of the prior `coverImageId`.
  - `.update({ coverImageId, coverUpdatedAt: new Date().toISOString() })`.
  - Returns `{ success, coverImageId, coverUpdatedAt }`.
- **`DELETE`** (admin-gated): best-effort Drive trash, then
  `.update({ coverImageId: FieldValue.delete(), coverUpdatedAt: FieldValue.delete() })`.

### 3.4 Client crop + encode

- New module `lib/coverImage.ts` — the **testable math only**:
  ```ts
  // given source WxH, return the center-crop rect for a 16:9 target
  export function centerCrop16x9(srcW: number, srcH: number): { sx: number; sy: number; sw: number; sh: number }
  export const COVER_W = 1600;
  export const COVER_H = 900;
  ```
- Thin canvas glue (in the upload component or a `lib/coverImage.client.ts`,
  untested): load `File` into an `Image`, draw the `centerCrop16x9` rect onto a
  1600×900 canvas, `canvas.toBlob(..., "image/webp", 0.82)`. Target < ~400 KB;
  no hard client rejection on size (server caps). Reject a source file > 10 MB
  before decoding.

### 3.5 Serving proxy — `GET /api/databases/[id]/cover`

- **Public** (no `requireAdmin`).
- Loads the DB doc; 404 if no `coverImageId`.
- `callAppsScript("getFileBytes", { fileId: coverImageId })` → `Buffer`.
- Headers: `Content-Type` from the stored mime (default `image/webp`),
  `Cache-Control: public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400`.
  Vercel's CDN holds the bytes; `?v={coverUpdatedAt}` busts it on replace.
- Served from our own origin as a plain `<img>` — **no `next/image` remote
  pattern / `next.config` change**.
- A small helper `coverUrl(db: Pick<Database, "id" | "coverImageId" | "coverUpdatedAt">): string | null`
  in `lib/coverImage.ts` returns `/api/databases/${id}/cover?v=${coverUpdatedAt}`
  or `null`. Vitest-covered.

### 3.6 Render sites

All four use `coverUrl(db)`, render `object-cover` in a 16:9 box, and fall back
to the **current** icon/gradient treatment when `coverUrl` is `null`.

1. **Admin `DatabaseList.tsx`** — cover caps each card (above the icon/badge row).
2. **Admin `DatabaseDetail.tsx`** — cover banner in the header, with hover
   controls: "Add cover" / "Change cover" / "Remove cover" wired to the
   `POST`/`DELETE` route; a spinner during upload; `toast` on done/fail;
   re-fetch the DB list so the new cover shows without a reload.
3. **Public `PublicDatabaseCards.tsx` + `OfficialDatabaseCards.tsx`** — cover
   caps each card (above the accent strip / header row). The count-up animation
   and tilt behaviour are unchanged.
4. **Public scoped-search header** — the `selectedDb` block in
   `VerifySearch.tsx` (~L520) and the matching block in `OfficialSearch.tsx`:
   a small (e.g. 64×36) rounded cover thumbnail beside the db name/subcategory.

`GET /api/databases/public` adds `coverImageId` **and** `coverUpdatedAt` to its
hand-picked field subset (it deliberately returns only whitelisted fields).
`coverUrl` needs both. The admin list route already returns full docs.

### 3.7 Out of scope

- Multi-image galleries / ordering (single cover, replace-on-reupload).
- Cover field in `CreateDatabaseModal` (cover is added after the DB exists).
- In-browser crop/reposition UI (center-crop only).
- Video or animated covers.
- Cover on the certificate PDF or the verification result card.

---

## 4. Data flow

**Upload:** admin picks a file in `DatabaseDetail` → client center-crops to
1600×900 WebP → `POST /api/databases/[id]/cover` (multipart) → route reads
`driveFolderId`, calls `uploadDatabaseCover`, trashes the old file, writes
`coverImageId` + `coverUpdatedAt` → client re-fetches DB list.

**Display (admin):** DB list / detail already have the full doc → `coverUrl(db)`
→ `<img src="/api/databases/{id}/cover?v={coverUpdatedAt}">` → proxy →
`getFileBytes` → CDN-cached bytes.

**Display (public):** `/api/databases/public` returns `coverImageId` +
`coverUpdatedAt` → cards / scoped header call `coverUrl` → same proxy, same CDN
cache (the proxy is public and identical regardless of caller).

**Delete DB:** existing `deleteDriveFolder(driveFolderId)` cascade trashes the
whole folder, cover included (when the cover was stored in the DB folder).
Covers in the `DB_COVERS` fallback folder are orphaned on DB delete — acceptable
(rare: only DBs with no Drive folder; a follow-up sweep could clean them, noted
not built).

---

## 5. Error handling

| Failure | Behaviour |
|---|---|
| Apps Script down during upload | One retry, then route returns 502; `DatabaseDetail` toasts "Cover upload failed — try again". No doc write. |
| Apps Script down during serve | Proxy returns 502; `<img>` shows nothing → CSS fallback background (icon/gradient) stays visible behind it. `stale-while-revalidate` keeps a prior good copy at the edge. |
| `getFileBytes` on a trashed/missing file | Proxy 404 → fallback treatment renders. |
| Sharing policy blocks anyone-with-link | Irrelevant — proxy reads bytes as owner, never relies on the public Drive URL. |
| Client crop fails (corrupt image) | Caught in canvas glue; toast "Could not read that image"; no upload attempted. |
| Old-cover trash fails on replace | Logged, ignored; new cover still saved (orphan file, harmless). |

---

## 6. Testing & release

### Automated (vitest)

- `lib/databaseFilter.ts` — empty query passthrough; case-insensitivity; each of
  name / subCategory / topic matches; no-match returns `[]`; whitespace-only
  query.
- `lib/coverImage.ts` — `centerCrop16x9` for wider-than-16:9, taller, exact;
  `coverUrl` returns the versioned path when `coverImageId` set, `null`
  otherwise.

### Manual smoke (no emulator — Apps Script is hand-traced)

1. Upload a cover on a DB **with** a Drive folder → appears on admin grid card,
   admin detail header, and (if the DB is live) the public card + public scoped
   header.
2. Upload on a DB **without** a Drive folder → lands in `DB_COVERS`, renders the
   same.
3. Replace a cover → new image shows (cache-bust works), old Drive file trashed.
4. Remove a cover → all four sites fall back to icon/gradient.
5. Delete a DB that had a folder-stored cover → Drive folder (with cover) trashed.
6. Confirm the public proxy response carries the long `s-maxage` header and a
   second request is a CDN `HIT`.

### Release step (user, manual)

- **Hand-paste the updated `apps-script.js` into `script.google.com` and
  redeploy the web app** (Manage deployments → edit → new version; URL
  unchanged). The three new actions (`uploadDatabaseCover`, `getFileBytes`,
  `deleteFile` if added) do not exist in the deployed script until this is done —
  uploads and covers will 500/blank until then.

### Pre-push gate (standard)

`npx tsc --noEmit`, `npx vitest run`, `npm run build` — all clean. After push,
confirm the Vercel Production deployment SHA matches.

---

## 7. Files touched

**New**
- `lib/databaseFilter.ts` + test
- `lib/coverImage.ts` + test
- `lib/coverImage.client.ts` (canvas glue) — or inline in the detail component
- `app/api/databases/[id]/cover/route.ts` (`POST`, `DELETE`, `GET`)

**Modified**
- `apps-script.js` — `uploadDatabaseCover`, `getFileBytes`, `deleteFile`;
  `DB_COVERS` folder constant
- `lib/types.ts` — `Database.coverImageId`, `Database.coverUpdatedAt`
- `components/admin/databases/DatabaseManager.tsx` — search state + wiring
- `components/admin/databases/DatabaseList.tsx` — search prop, no-match state, cover on card
- `components/admin/databases/DatabaseDetail.tsx` — cover banner + upload/remove controls
- `components/PublicDatabaseCards.tsx` — cover on card
- `components/OfficialDatabaseCards.tsx` — cover on card
- `components/VerifySearch.tsx` — cover thumb in `selectedDb` header
- `components/OfficialSearch.tsx` — cover thumb in `selectedDb` header
- `app/api/databases/public/route.ts` — return `coverImageId` + `coverUpdatedAt`

---

## 8. Inviolable-constraint check

- No change to `lib/urls.ts` / auto-verify — untouched.
- No change to the email model — untouched.
- No change to the Sheet ↔ app alias tables — untouched.
- `apps-script.js` alias tables (`MANAGED_ALIASES_`) untouched; only new,
  independent actions added.
- New public route `GET /api/databases/[id]/cover` returns image bytes only — no
  participant / cert data. `GET /api/databases/public` still returns only
  whitelisted fields (two image-pointer fields added).
