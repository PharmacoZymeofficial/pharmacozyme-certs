# Sheet header-name mapping + template-editor fixes — Design

**Date:** 2026-09-02
**Status:** Approved (approach and all sections confirmed with the user), pending implementation plan
**Branch:** `feat/sheet-header-mapping` (off `main` @ `3e26931`)
**Scope:** One session. Live production app (`cert.pharmacozyme.com`), ~4,200 real certificates.

---

## 1. Problem statement

Post-deploy testing of the "Official CTM Experience Letters" template surfaced four
issues in the template editor + Google-Sheets data path.

### Bug 3 (primary) — rigid positional sheet layout destroys custom columns

`apps-script.js` `syncData` assumes a **fixed 9-column layout**:

| A | B | C | D | E | F | G | H | I | J+ |
|---|---|---|---|---|---|---|---|---|-----|
| Certificate ID | Name | Email | Certificate URL | Status | Issue Date | Emailed | Drive Link | Created At | custom fields |

Custom template columns are only read from **column J onward**
(`apps-script.js:331-332`, `lastCol > 9`). The user's hand-built "EL" tab has a
different layout — `Name` in B, `Email` in C, then `Designation/Role`,
`Start Date`, `End Date`, `Duration`, `Department` in D–H.

Consequences:
- **Read** (`syncData` mode `read`, `app/api/sheets/sync/route.ts:66-134`):
  columns D–H are read as the app's own fixed fields (`certificateUrl`, `status`,
  `issueDate`, …). `lastCol` is 8, so `customHeaders` is `[]` — **no custom
  fields captured**. `participant.customFields` stays empty, so every bound
  placeholder prints blank and generation warns "Some participants are missing
  values for bound field(s)…" (`CertificateGenerator.tsx:624-640`).
- **Write** (`syncData` mode `write`, called after every generation via
  `CertificateGenerator.tsx:924-928` `mode: "firebaseToSheets"`):
  `syncData` clears columns A–I (`apps-script.js:308-312`) and writes the fixed
  9-column layout with fixed labels (`:279-292`). The user's D–H columns are
  **overwritten and lost** (observed: sheet came back as
  `Certificate ID | Name | Email | Certificate URL | Status | Issue Date | Emailed | Drive Link | Created At`).

### Bug 1 — template upload reports "Could not make it public"

`apps-script.js` `uploadTemplate` (`:373-397`) calls `shareBestEffort(file)`; when
the Apps Script owner account cannot set `ANYONE_WITH_LINK` (personal-account
limit or Workspace policy), `shared` comes back `false` and the client shows an
**error** toast ("Could not make it public — the bridge account may block link
sharing"). The template file itself uploads fine.

Open question resolved during implementation: does certificate rendering fetch the
template bytes through Apps Script (authenticated — unaffected) or via a public
Drive URL (broken when not shared)? See §6.

### Bug 2 — no zoom in the template editor

The editor canvas (`app/admin/templates/page.tsx:1041-1042`) sizes itself with
`aspectRatio` and places markers as `%`-positioned children. There is no
in-editor zoom, so the user zooms the browser — which scales the background but
not the marker geometry consistently, making fine placement impossible.

### Bug 4 — certificate preview clipped in A4 portrait

The preview modal (`app/admin/templates/page.tsx:1383-1410`) caps the iframe at
`max-w-3xl` / `maxHeight: 90vh` with `overflow: auto`. A portrait letter overflows
and the inner scrollbar is not obvious.

---

## 2. Decisions (locked)

| Question | Decision |
| --- | --- |
| Sheet layout model | **Header-name mapping.** The header row (row 1) is the source of truth on every read and write. No positional assumptions. |
| What is a "managed" column | A fixed set of header names (case-insensitive, alias table): `Name`, `Email`, `Certificate ID`, `Certificate URL`, `Status`, `Issue Date`, `Emailed`, `Drive Link`, `Created At`. |
| What is a "custom" column | Any header not in the managed set. Stored in `participant.customFields["<exact header text>"]`. Template `sourceField` binds to that exact text. |
| Minimum sheet | One column whose header resolves to `Name`. Everything else optional. |
| Write-back safety | `syncData` write **never clears or reorders a column it does not own**. Managed values are written into their existing header column, or a new column is appended on the right if that header is absent. |
| Row identity on write | Match each participant to an existing row by `Name + Email` (case-insensitive, trimmed). Update only managed cells in that row. Unmatched participants are appended as new rows. `Name`/`Email` cells of an existing row are never rewritten. |
| Fresh-sheet default headers | Reordered to `Name, Email, Certificate ID, Certificate URL, Status, Issue Date, Emailed, Drive Link, Created At`. |
| Editor bind field | Free-text input gains a datalist/dropdown of the linked sheet's real headers. Free text still accepted. |
| Editor zoom | `transform: scale()` on the canvas wrapper (background + markers together), 50–200% + "Fit". Drag/resize math divides pointer deltas by the zoom factor. |
| Preview modal | Size to the page aspect ratio with a visible inner scroll + an "Actual size / Fit page" toggle. |
| Rollout | Apps Script web-app redeploy required (edit version, URL unchanged). |

### Non-goals

- No migration of existing sheets. Every current database's linked sheet already
  uses the standard layout, which the new header-mapping code reads and writes
  identically — the managed header names are the same strings. Only sheets that
  deviate (like "EL") change behavior, and for the better.
- No change to CSV/Excel import beyond making it share the same managed/custom
  classification helper (it already produces `customFields`).
- No change to `buildVerificationUrl` / auto-verify (untouched area).
- Email model unchanged (counts-only).

---

## 3. New module: `lib/sheetSchema.ts` (pure, unit-tested)

```ts
export const MANAGED_FIELDS = [
  "name", "email", "certificateId", "certificateUrl",
  "status", "issueDate", "emailSent", "driveLink", "createdAt",
] as const;
export type ManagedField = typeof MANAGED_FIELDS[number];

/** Header text (any case / spacing) -> managed field key, or null if it's a custom column. */
export function resolveManagedField(header: string): ManagedField | null;

/** Row 1 values -> { managed: Partial<Record<ManagedField, number>>, custom: Record<string, number> }
 *  (values are 0-based column indexes; first win on duplicate headers). */
export function buildHeaderMap(headerRow: unknown[]): HeaderMap;

/** The display label the app writes when it has to CREATE a managed column. */
export const MANAGED_LABELS: Record<ManagedField, string>;
// name->"Name", email->"Email", certificateId->"Certificate ID", ... emailSent->"Emailed"

/** Alias table, e.g. "email sent"|"emailed"->emailSent, "cert id"|"certificate id"->certificateId,
 *  "date issued"|"issue date"->issueDate, "url"|"certificate url"->certificateUrl. */
```

`resolveManagedField` normalizes: trim, collapse internal whitespace, lowercase,
strip a trailing `*`. Anything not matched (including `"Designation/Role"`,
`"Start Date"`) is custom.

`app/api/sheets/sync/route.ts` and the CSV import route both import
`resolveManagedField` so the managed/custom split is defined in exactly one place.

---

## 4. Apps Script `syncData` — rewrite

### 4.1 `read` mode

```
headerRow = sheet row 1
for each data row:
  rec = {}
  for each header h at column i:
     mf = <managed field for h?>   // via a JS port of resolveManagedField
     if mf: rec[mf] = cell(i) (with the existing Date -> "MMM d, yyyy" formatting)
     else : rec.custom[h.trim()] = cell(i)   // h non-empty
  if rec.name: push rec
return { success: true, data: [...] }
```

Route side (`sheetsToFirebase`): `customFields = rec.custom || {}` (drop the old
`KNOWN_KEYS`/`Object.entries` sweep — apps-script now returns `custom` directly).
Everything else (match by name+email, update-or-insert) is unchanged.

### 4.2 `write` mode

New payload: `{ spreadsheetId, tabName, participants: [{ name, email, certificateId, certificateUrl, status, issueDate, emailSent, driveLink, createdAt }], mode: "write" }`
— no `headers` / `writeHeaders` / positional `data`.

```
headerRow      = sheet row 1 (may be empty on a brand-new tab)
map            = buildHeaderMap(headerRow)
writeFields    = [certificateId, certificateUrl, status, issueDate, emailSent, driveLink, createdAt]
                 // NOT name/email — see row identity rule

// 1. ensure a column exists for every managed field we write + for name/email
for mf in [name, email, ...writeFields]:
  if map.managed[mf] == null:
     append MANAGED_LABELS[mf] as a new header at (lastCol+1), bold it
     map.managed[mf] = that new index

// 2. index existing rows by name+email
existingRowByKey = { `${name.toLowerCase().trim()}_${email.toLowerCase().trim()}` -> rowNumber }
                   built from map.managed.name / map.managed.email columns, rows 2..lastRow

// 3. per participant
for p in participants:
  key = `${p.name...}_${p.email...}`
  row = existingRowByKey[key]
  if row:
     for mf in writeFields: setCell(row, map.managed[mf], format(p[mf]))
     // name/email columns of an existing row are left as-is
  else:
     row = ++lastRow
     for mf in [name, email, ...writeFields]: setCell(row, map.managed[mf], format(p[mf]))
     existingRowByKey[key] = row

return { success: true, rowsWritten: participants.length, columnsAppended: <n> }
```

- `emailSent` formats to `"Yes"`/`"No"`.
- Writes are batched per column range where practical (`getRange(2, col, n, 1).setValues(...)`)
  but correctness first — a per-cell loop is acceptable for the row counts here
  (largest DB ≈ 300 rows).
- **No `clearContent` anywhere.** Custom columns are never in `writeFields`, never
  in the ensure-column loop, never touched.

### 4.3 `addHeaders`

Reorder to `["Name","Email","Certificate ID","Certificate URL","Status","Issue Date","Emailed","Drive Link","Created At"]`.
Only ever called for a **brand-new** tab (`createSheet`, `linkSheet` creating a
missing tab), so no risk to existing sheets.

---

## 5. `app/api/sheets/sync/route.ts` — changes

- `firebaseToSheets` branch: stop building `headerRow` / passing `writeHeaders`.
  Send `participants: sortedParticipants.map(pick the 9 managed fields)`.
- `sheetsToFirebase` branch: replace the `KNOWN_KEYS` sweep with
  `customFields: rec.custom || {}`.
- Managed-field picking uses `MANAGED_FIELDS` from `lib/sheetSchema.ts`.

---

## 6. Bug 1 — template sharing

Implementation step 1: read `app/api/templates/[id]/pdf/route.ts` and the editor
preview/render fetch path.

- **If** the render/preview path already fetches template bytes through Apps
  Script or a stored copy (not a public `drive.google.com` URL): the sharing
  failure is cosmetic. Change the client toast from `error` to an informational
  note: *"Template uploaded. Couldn't set a public link — that's fine unless you
  plan to share the raw file."* Keep `shared: false` in the response for
  diagnostics.
- **If** rendering depends on the file being public: add `getTemplateBytes`
  to `apps-script.js` (`DriveApp.getFileById(fileId).getBlob().getBytes()` →
  base64) and route template fetches through it, so rendering never depends on
  link-sharing. Then apply the toast downgrade above.

Scope note: no attempt to change the Google account's sharing policy.

---

## 7. Bug 2 — editor zoom

- `const [zoom, setZoom] = useState(1)` in `app/admin/templates/page.tsx`.
- A control group near the canvas: `−  [ 100% ▾ ]  +  [Fit]` (50 / 75 / 100 / 125 / 150 / 200 %, plus Fit = recompute to fill the viewport area).
- Apply `style={{ transform: \`scale(${zoom})\`, transformOrigin: "top center" }}`
  to the **canvas wrapper** that contains both the background `<img>`/PDF layer
  and the `DraggableMarker`s, so they scale as one unit.
- The scroll container (`:1026`, `overflow-auto`) already lets the scaled canvas
  pan.
- Pointer math: in `handleGlobalMouseMove` / `startResize`, divide raw pixel
  deltas by `zoom` before converting to `%` / size. `containerSizeRef` /
  `containerWidth` reads must use the **unscaled** bounding box (measure the inner
  canvas element, or divide `getBoundingClientRect()` by `zoom`).
- Zoom does not persist — resets to Fit on open.

---

## 8. Bug 4 — preview modal

- Compute `pageRatio = templateDimensions.width / templateDimensions.height`.
- `const [previewFit, setPreviewFit] = useState<"fit" | "actual">("fit")`.
- `fit`: iframe `height: min(82vh, 90vw / pageRatio)`, `width: height * pageRatio`,
  centered, whole page visible.
- `actual`: iframe at the page's natural pixel size inside a scrollable box.
- Toggle button in the modal header: `Fit page ⇆ Actual size`.
- Modal body keeps `overflow: auto`; in `fit` mode a tall portrait page still
  scrolls if `82vh` isn't enough, and the scrollbar sits on the modal body, not
  a hidden inner element.

---

## 9. File map

| File | Change |
|------|--------|
| `lib/sheetSchema.ts` | **New.** Managed-field list, alias table, `resolveManagedField`, `buildHeaderMap`, `MANAGED_LABELS`. |
| `tests/sheetSchema.test.ts` | **New.** Alias resolution, custom classification, header-map (dupes, gaps, blanks). |
| `apps-script.js` | `syncData` read + write rewritten (header-driven, row-matched, no clear). `addHeaders` reordered. Possibly new `getTemplateBytes` (§6). |
| `app/api/sheets/sync/route.ts` | `firebaseToSheets` sends `participants` not positional rows; `sheetsToFirebase` uses `rec.custom`. Imports `sheetSchema`. |
| `app/api/participants/route.ts` (+ `ImportModal`) | CSV/Excel import uses `resolveManagedField` for the managed/custom split (behavior parity). |
| `app/admin/templates/page.tsx` | Bind-to-column dropdown (§1.5); zoom control + scaled wrapper + pointer math (§7); preview fit/actual toggle (§8). |
| `app/api/templates/[id]/pdf/route.ts` | Only if §6 needs the authenticated fetch path. |
| `components/CertificateGenerator.tsx` | None expected — it already reads `participant.customFields[sourceField]`; the fix is upstream in the sync. Confirm during implementation. |
| `CONTEXT.md` | Session log entry. |

---

## 10. Testing

- **Unit** (`tests/sheetSchema.test.ts`): `resolveManagedField` for each managed
  name + aliases + case/space variants; custom headers (`"Designation/Role"`,
  `"Start Date"`, `""`) → null/custom; `buildHeaderMap` with duplicate headers
  (first wins), gaps, empty row.
- **Apps Script hand-traces** (no Java emulator here): `syncData` read + write
  traced against (i) the user's `_, Name, Email, Designation/Role, Start Date,
  End Date, Duration, Department` layout; (ii) the standard 9-column layout
  (must be byte-identical output to today); (iii) a sheet missing
  `Certificate ID`; (iv) unknown columns interleaved between managed ones;
  (v) a brand-new empty tab (headers appended).
- **Manual live check** (user): restore "EL" from Google Sheets version history →
  re-sync (sheet → app) → confirm `Designation/Role` etc. appear on participants →
  generate one certificate → confirm the bound values print AND the sheet still
  has its D–H columns, with `Certificate ID` / `Drive Link` etc. filled into
  existing or newly-appended columns.

---

## 11. Rollout

1. Merge → Vercel auto-deploys. Confirm blue-dot Production SHA matches.
2. **Apps Script web-app redeploy** (edit version, URL unchanged) — the `syncData`
   rewrite is inert until then; until redeployed, sheet sync keeps the old
   positional behavior (no worse than today).
3. User restores the "EL" sheet from version history and runs the §10 manual
   check.
4. The already-generated bad `2026-PZ-CTM-0001` (blank bound fields) is
   regenerated after the fix.

---

## 12. Pre-existing issues explicitly out of scope

- Duplicate `uniqueCertId` records in prod `certificates` (~3 genuine
  cross-person collisions + re-generation litter) — separate data decision.
- `participants.certificateId` collection-group index — verified already deployed.
- The Google account's Drive link-sharing policy itself.
