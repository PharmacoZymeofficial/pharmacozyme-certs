# Sheet Header-Name Mapping + Template-Editor Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the linked Google Sheet header-name driven (any column order, custom columns preserved), fix template rendering when the Drive file isn't public, and add editor zoom + a fittable certificate preview.

**Architecture:** A new pure module `lib/sheetSchema.ts` defines the managed-vs-custom header split (with an alias table). `apps-script.js` `syncData` is rewritten for both read and write to be header-driven and row-matched — the write path never clears a column it doesn't own. `app/api/sheets/sync/route.ts` stops sending positional rows. Template bytes are fetched through a new Apps Script `getTemplateBytes` fallback so rendering never depends on Drive link-sharing. The editor gets a `transform: scale()` zoom wrapper and the preview modal gets a fit/actual toggle.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Google Apps Script (copy-pasted, not bundled), Firebase Admin SDK.

**Spec:** `docs/superpowers/specs/2026-09-02-sheet-header-mapping-and-editor-fixes.md`

## Global Constraints

- Live production app `cert.pharmacozyme.com`, ~4,200 real certificates. No destructive data operations.
- Verify locally before any push: `npx tsc --noEmit`, `npx vitest run`, `npm run build` — all clean.
- `apps-script.js` is not bundled. It is copy-pasted into the Apps Script editor and the web app is manually redeployed (edit version, URL unchanged). Plan changes to it must keep it valid ES5-ish V8 script (`var`, no TS).
- Never import `firebase-admin/auth` (ERR_REQUIRE_ESM). Server Firestore access is via `lib/firebase.admin.ts` `getAdminDb()`.
- Never change `lib/urls.ts buildVerificationUrl` or the category-less auto-verify.
- Commit messages: Conventional Commits, and every commit body ends with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Managed header names (canonical labels the app writes): `Name`, `Email`, `Certificate ID`, `Certificate URL`, `Status`, `Issue Date`, `Emailed`, `Drive Link`, `Created At`.
- Row identity on sheet write: match by `Name + Email` (lowercased, trimmed, joined with `_`). Never rewrite the `Name`/`Email` cells of an existing row.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/sheetSchema.ts` | **New.** Managed field keys, alias table, `normalizeHeader`, `resolveManagedField`, `buildHeaderMap`, `MANAGED_FIELDS`, `MANAGED_LABELS`. Pure, no imports. |
| `tests/sheetSchema.test.ts` | **New.** Unit tests for the above. |
| `lib/templateBytes.ts` | **New.** `fetchTemplatePdf(templateData)` — pdfBase64 → Drive public URL → Apps Script `getTemplateBytes`, with best-effort write-back of `pdfBase64`. |
| `apps-script.js` | `syncData` read + write rewrite; `addHeaders` reorder; `managedColMap_` helper + header-aware `updateCertIds` / `upsertRow` / `clearCertIdsByEmail` / `deleteRows`; new `getTemplateBytes` + dispatch case. |
| `app/api/sheets/sync/route.ts` | `firebaseToSheets` sends `participants` (managed fields only); `sheetsToFirebase` uses `rec.custom`. |
| `app/api/participants/route.ts` | CSV/Excel import uses `resolveManagedField` for the managed/custom split. |
| `app/api/templates/route.ts` | Store `pdfBase64` on template create when small enough. |
| `app/api/templates/[id]/pdf/route.ts` | Use `fetchTemplatePdf`. |
| `app/api/certificates/render/route.ts` | Use `fetchTemplatePdf`. |
| `app/api/templates/preview/route.ts` | Use `fetchTemplatePdf`. |
| `app/admin/templates/page.tsx` | Sharing-toast downgrade; zoom wrapper + control; preview fit/actual toggle; `sourceField` trim + hint. |
| `CONTEXT.md` | Session log entry. |

---

## Task 1: `lib/sheetSchema.ts` — managed/custom header logic

**Files:**
- Create: `lib/sheetSchema.ts`
- Test: `tests/sheetSchema.test.ts`

**Interfaces:**
- Produces:
  - `MANAGED_FIELDS: readonly ManagedField[]` where `type ManagedField = "name" | "email" | "certificateId" | "certificateUrl" | "status" | "issueDate" | "emailSent" | "driveLink" | "createdAt"`
  - `MANAGED_LABELS: Record<ManagedField, string>` → `{ name: "Name", email: "Email", certificateId: "Certificate ID", certificateUrl: "Certificate URL", status: "Status", issueDate: "Issue Date", emailSent: "Emailed", driveLink: "Drive Link", createdAt: "Created At" }`
  - `normalizeHeader(h: string): string`
  - `resolveManagedField(h: string): ManagedField | null`
  - `buildHeaderMap(headerRow: unknown[]): { managed: Partial<Record<ManagedField, number>>; custom: Record<string, number> }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sheetSchema.test.ts
import { describe, it, expect } from "vitest";
import { resolveManagedField, buildHeaderMap, MANAGED_LABELS } from "@/lib/sheetSchema";

describe("resolveManagedField", () => {
  it("maps canonical labels", () => {
    expect(resolveManagedField("Name")).toBe("name");
    expect(resolveManagedField("Certificate ID")).toBe("certificateId");
    expect(resolveManagedField("Drive Link")).toBe("driveLink");
    expect(resolveManagedField("Emailed")).toBe("emailSent");
  });
  it("is case- and whitespace-insensitive and strips a trailing *", () => {
    expect(resolveManagedField("  email address ")).toBe("email");
    expect(resolveManagedField("EMAIL")).toBe("email");
    expect(resolveManagedField("Name*")).toBe("name");
    expect(resolveManagedField("issue  date")).toBe("issueDate");
  });
  it("resolves known aliases", () => {
    expect(resolveManagedField("Recipient Name")).toBe("name");
    expect(resolveManagedField("Cert ID")).toBe("certificateId");
    expect(resolveManagedField("Date Issued")).toBe("issueDate");
    expect(resolveManagedField("Email Sent")).toBe("emailSent");
    expect(resolveManagedField("Verification URL")).toBe("certificateUrl");
  });
  it("returns null for custom columns", () => {
    expect(resolveManagedField("Designation/Role")).toBeNull();
    expect(resolveManagedField("Start Date")).toBeNull();
    expect(resolveManagedField("Department")).toBeNull();
    expect(resolveManagedField("")).toBeNull();
  });
});

describe("buildHeaderMap", () => {
  it("maps the user's hand-built layout: blank, Name, Email, then customs", () => {
    const map = buildHeaderMap(["", "Name", "Email", "Designation/Role", "Start Date", "Department"]);
    expect(map.managed).toEqual({ name: 1, email: 2 });
    expect(map.custom).toEqual({ "Designation/Role": 3, "Start Date": 4, "Department": 5 });
  });
  it("maps the standard 9-column layout", () => {
    const map = buildHeaderMap([
      "Certificate ID", "Name", "Email", "Certificate URL", "Status",
      "Issue Date", "Emailed", "Drive Link", "Created At",
    ]);
    expect(map.managed).toEqual({
      certificateId: 0, name: 1, email: 2, certificateUrl: 3, status: 4,
      issueDate: 5, emailSent: 6, driveLink: 7, createdAt: 8,
    });
    expect(map.custom).toEqual({});
  });
  it("first column wins on a duplicate header; blanks are skipped", () => {
    const map = buildHeaderMap(["Name", "Name", "", "Score"]);
    expect(map.managed.name).toBe(0);
    expect(map.custom).toEqual({ Score: 3 });
  });
  it("MANAGED_LABELS covers every managed field", () => {
    expect(Object.keys(MANAGED_LABELS).sort()).toEqual(
      ["certificateId","certificateUrl","createdAt","driveLink","email","emailSent","issueDate","name","status"]
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sheetSchema.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sheetSchema'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/sheetSchema.ts
/**
 * The single definition of which Google-Sheet columns the app manages vs. which
 * are free-form custom fields. Used by the sheet-sync route and CSV import so the
 * managed/custom split lives in exactly one place. A hand-kept JS port of
 * `normalizeHeader` + `resolveManagedField` also lives in `apps-script.js` — keep
 * the two in sync (the alias table below is the source of truth).
 *
 * Pure module: no imports.
 */

export const MANAGED_FIELDS = [
  "name", "email", "certificateId", "certificateUrl",
  "status", "issueDate", "emailSent", "driveLink", "createdAt",
] as const;
export type ManagedField = (typeof MANAGED_FIELDS)[number];

/** The header label the app writes when it has to CREATE a managed column. */
export const MANAGED_LABELS: Record<ManagedField, string> = {
  name: "Name",
  email: "Email",
  certificateId: "Certificate ID",
  certificateUrl: "Certificate URL",
  status: "Status",
  issueDate: "Issue Date",
  emailSent: "Emailed",
  driveLink: "Drive Link",
  createdAt: "Created At",
};

/** normalized header text -> managed field. Every canonical label is included. */
const ALIASES: Record<string, ManagedField> = {
  "name": "name",
  "recipient name": "name",
  "recipient": "name",
  "full name": "name",
  "email": "email",
  "email address": "email",
  "e-mail": "email",
  "certificate id": "certificateId",
  "cert id": "certificateId",
  "certificate no": "certificateId",
  "certificate number": "certificateId",
  "certificate url": "certificateUrl",
  "certificate link": "certificateUrl",
  "verification url": "certificateUrl",
  "verify url": "certificateUrl",
  "status": "status",
  "issue date": "issueDate",
  "issued": "issueDate",
  "date issued": "issueDate",
  "issued on": "issueDate",
  "emailed": "emailSent",
  "email sent": "emailSent",
  "email status": "emailSent",
  "drive link": "driveLink",
  "drive url": "driveLink",
  "pdf link": "driveLink",
  "certificate pdf": "driveLink",
  "created at": "createdAt",
  "created": "createdAt",
  "date created": "createdAt",
};

export function normalizeHeader(h: string): string {
  return String(h ?? "")
    .replace(/\*+$/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function resolveManagedField(h: string): ManagedField | null {
  const n = normalizeHeader(h);
  if (!n) return null;
  return ALIASES[n] ?? null;
}

export function buildHeaderMap(headerRow: unknown[]): {
  managed: Partial<Record<ManagedField, number>>;
  custom: Record<string, number>;
} {
  const managed: Partial<Record<ManagedField, number>> = {};
  const custom: Record<string, number> = {};
  headerRow.forEach((raw, i) => {
    const header = String(raw ?? "").trim();
    if (!header) return;
    const mf = resolveManagedField(header);
    if (mf) {
      if (managed[mf] === undefined) managed[mf] = i;
    } else if (custom[header] === undefined) {
      custom[header] = i;
    }
  });
  return { managed, custom };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sheetSchema.test.ts`
Expected: PASS (4 + 4 assertions groups).

- [ ] **Step 5: Commit**

```bash
git add lib/sheetSchema.ts tests/sheetSchema.test.ts
git commit -m "feat(sheets): managed/custom header resolution module"
```

---

## Task 2: Apps Script `syncData` — header-driven READ

**Files:**
- Modify: `apps-script.js` (`syncData` `read` branch, ~lines 321-363; add `resolveManagedField_` helper near the top of the DATA SYNC section)

**Interfaces:**
- Consumes: the alias table from Task 1 (re-implemented in JS — see Step 1).
- Produces: `syncData({mode:"read"})` now returns `{ success: true, data: [ { name, email, certificateId, certificateUrl, status, issueDate, emailSent, driveLink, createdAt, custom: { "<header>": "<value>" } } ] }`. Every managed key is present (empty string if the column is absent); `custom` holds every non-managed non-empty header.

- [ ] **Step 1: Add the JS port of the header resolver**

Insert just above `function syncData(payload) {` in `apps-script.js`:

```javascript
// Hand-kept port of lib/sheetSchema.ts — keep the alias table identical.
var MANAGED_ALIASES_ = {
  "name": "name", "recipient name": "name", "recipient": "name", "full name": "name",
  "email": "email", "email address": "email", "e-mail": "email",
  "certificate id": "certificateId", "cert id": "certificateId",
  "certificate no": "certificateId", "certificate number": "certificateId",
  "certificate url": "certificateUrl", "certificate link": "certificateUrl",
  "verification url": "certificateUrl", "verify url": "certificateUrl",
  "status": "status",
  "issue date": "issueDate", "issued": "issueDate", "date issued": "issueDate", "issued on": "issueDate",
  "emailed": "emailSent", "email sent": "emailSent", "email status": "emailSent",
  "drive link": "driveLink", "drive url": "driveLink", "pdf link": "driveLink", "certificate pdf": "driveLink",
  "created at": "createdAt", "created": "createdAt", "date created": "createdAt"
};
var MANAGED_LABELS_ = {
  name: "Name", email: "Email", certificateId: "Certificate ID", certificateUrl: "Certificate URL",
  status: "Status", issueDate: "Issue Date", emailSent: "Emailed", driveLink: "Drive Link", createdAt: "Created At"
};
function normalizeHeader_(h) {
  return String(h == null ? "" : h).replace(/\*+$/, "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ").toLowerCase();
}
function resolveManagedField_(h) {
  var n = normalizeHeader_(h);
  if (!n) return null;
  return MANAGED_ALIASES_[n] || null;
}
function formatCell_(cell) {
  return Object.prototype.toString.call(cell) === "[object Date]"
    ? Utilities.formatDate(cell, Session.getScriptTimeZone(), "MMM d, yyyy")
    : cell;
}
```

- [ ] **Step 2: Replace the `read` branch body**

Replace everything from `} else if (mode === "read") {` up to (not including) the final `return { success: false, error: "Invalid mode" };` with:

```javascript
  } else if (mode === "read") {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol < 1) {
      return { success: true, data: [] };
    }

    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var managed = {};   // field -> col index (0-based)
    var customCols = []; // { header, index }
    for (var c = 0; c < headerRow.length; c++) {
      var header = String(headerRow[c] == null ? "" : headerRow[c]).replace(/^\s+|\s+$/g, "");
      if (!header) continue;
      var mf = resolveManagedField_(header);
      if (mf) { if (managed[mf] === undefined) managed[mf] = c; }
      else {
        var already = false;
        for (var k = 0; k < customCols.length; k++) if (customCols[k].header === header) already = true;
        if (!already) customCols.push({ header: header, index: c });
      }
    }

    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var data = values.map(function (row) {
      function m(field) { return managed[field] === undefined ? "" : formatCell_(row[managed[field]]); }
      var rec = {
        name: m("name"),
        email: m("email"),
        certificateId: m("certificateId"),
        certificateUrl: m("certificateUrl"),
        status: m("status"),
        issueDate: m("issueDate"),
        emailSent: m("emailSent") === "Yes" || m("emailSent") === true,
        driveLink: m("driveLink"),
        createdAt: m("createdAt"),
        custom: {}
      };
      for (var j = 0; j < customCols.length; j++) {
        var v = formatCell_(row[customCols[j].index]);
        if (v !== "" && v !== null && v !== undefined) rec.custom[customCols[j].header] = String(v);
      }
      return rec;
    });

    return { success: true, data: data };
  }

  return { success: false, error: "Invalid mode" };
```

Also delete the now-unused old `customHeaders` logic and the inline date-format ternary (replaced by `formatCell_`). Leave the `write` branch for Task 3.

- [ ] **Step 3: Syntax check**

Run: `node -c apps-script.js`
Expected: no output (valid).

- [ ] **Step 4: Hand-trace and record it**

Add a `## Apps Script hand-traces` section to this plan file. Trace `syncData` read against the user's `["", "Name", "Email", "Designation/Role", "Start Date", "End Date", "Duration", "Department"]` header row with one data row `["", "Javeria Mustaqeem", "jvra.mstqm@gmail.com", "Sales representative", "20-July-2025", "25-August-2026", "1 year and 1 month", "Sales"]`. Expected `data[0]`:
`{ name: "Javeria Mustaqeem", email: "jvra.mstqm@gmail.com", certificateId: "", ...all managed "" ..., emailSent: false, custom: { "Designation/Role": "Sales representative", "Start Date": "20-July-2025", "End Date": "25-August-2026", "Duration": "1 year and 1 month", "Department": "Sales" } }`.
Also trace the standard 9-col layout and confirm `custom` is `{}` and managed values match the old positional output.

- [ ] **Step 5: Commit**

```bash
git add apps-script.js docs/superpowers/plans/2026-09-02-sheet-header-mapping-and-editor-fixes.md
git commit -m "feat(apps-script): header-driven syncData read"
```

---

## Task 3: Apps Script `syncData` — header-driven WRITE (no clobber) + `addHeaders` reorder

**Files:**
- Modify: `apps-script.js` (`syncData` `write` branch ~lines 276-320; `addHeaders` ~lines 236-251)

**Interfaces:**
- Consumes: `resolveManagedField_`, `MANAGED_LABELS_`, `normalizeHeader_` from Task 2.
- Produces: `syncData({ mode: "write", spreadsheetId, tabName, participants: [ { name, email, certificateId, certificateUrl, status, issueDate, emailSent, driveLink, createdAt } ] })` → `{ success: true, rowsWritten: N, columnsAppended: M }`. Never clears a column. Matches rows by name+email. Appends missing managed columns on the right.

- [ ] **Step 1: Replace the `write` branch body**

Replace everything from `if (mode === "write") {` through the `return { success: true, rowsWritten: rows.length };` and its closing `}` (i.e. the whole `write` block) with:

```javascript
  if (mode === "write") {
    var participants = payload.participants || [];
    var WRITE_FIELDS = ["certificateId", "certificateUrl", "status", "issueDate", "emailSent", "driveLink", "createdAt"];
    var ENSURE_FIELDS = ["name", "email"].concat(WRITE_FIELDS);

    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // header -> col index (1-based), managed only
    var managedCol = {};
    for (var c = 0; c < headerRow.length; c++) {
      var mf = resolveManagedField_(headerRow[c]);
      if (mf && managedCol[mf] === undefined) managedCol[mf] = c + 1;
    }

    // Ensure a column exists for every field we may write.
    var columnsAppended = 0;
    for (var f = 0; f < ENSURE_FIELDS.length; f++) {
      var field = ENSURE_FIELDS[f];
      if (managedCol[field] === undefined) {
        lastCol += 1;
        sheet.getRange(1, lastCol).setValue(MANAGED_LABELS_[field]).setFontWeight("bold");
        managedCol[field] = lastCol;
        columnsAppended += 1;
      }
    }

    // Index existing rows by name+email.
    var lastRow = sheet.getLastRow();
    var rowByKey = {};
    if (lastRow > 1) {
      var nameCol = managedCol.name, emailCol = managedCol.email;
      var keyVals = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
      for (var r = 0; r < keyVals.length; r++) {
        var nm = String(keyVals[r][nameCol - 1] || "").toLowerCase().replace(/^\s+|\s+$/g, "");
        var em = String(keyVals[r][emailCol - 1] || "").toLowerCase().replace(/^\s+|\s+$/g, "");
        if (nm || em) rowByKey[nm + "_" + em] = r + 2;
      }
    }

    function fmt(field, p) {
      if (field === "emailSent") return p.emailSent ? "Yes" : "No";
      return p[field] == null ? "" : p[field];
    }

    var written = 0;
    for (var i = 0; i < participants.length; i++) {
      var p = participants[i];
      var key = String(p.name || "").toLowerCase().replace(/^\s+|\s+$/g, "") + "_" +
                String(p.email || "").toLowerCase().replace(/^\s+|\s+$/g, "");
      var row = rowByKey[key];
      if (row) {
        for (var w = 0; w < WRITE_FIELDS.length; w++) {
          sheet.getRange(row, managedCol[WRITE_FIELDS[w]]).setValue(fmt(WRITE_FIELDS[w], p));
        }
      } else {
        lastRow += 1;
        row = lastRow;
        for (var e = 0; e < ENSURE_FIELDS.length; e++) {
          sheet.getRange(row, managedCol[ENSURE_FIELDS[e]]).setValue(fmt(ENSURE_FIELDS[e], p));
        }
        rowByKey[key] = row;
      }
      written += 1;
    }

    return { success: true, rowsWritten: written, columnsAppended: columnsAppended };
  }
```

Note: `fmt("name", p)` / `fmt("email", p)` just return `p.name` / `p.email` (only used on the new-row path).

- [ ] **Step 2: Reorder `addHeaders`**

Replace the `headers` array in `addHeaders` with:

```javascript
  const headers = [
    "Name",
    "Email",
    "Certificate ID",
    "Certificate URL",
    "Status",
    "Issue Date",
    "Emailed",
    "Drive Link",
    "Created At"
  ];
```

- [ ] **Step 3: Syntax check**

Run: `node -c apps-script.js`
Expected: valid.

- [ ] **Step 4: Hand-trace**

Append to `## Apps Script hand-traces`:
- **User's "EL" layout after Task 2 restore**: header `["", "Name", "Email", "Designation/Role", "Start Date", "End Date", "Duration", "Department"]`, existing row 2 = Javeria. Write `participants: [{ name: "Javeria Mustaqeem", email: "jvra.mstqm@gmail.com", certificateId: "2026-PZ-CTM-0001", certificateUrl: "https://…", status: "generated", issueDate: "Sep 2, 2026", emailSent: false, driveLink: "https://drive…", createdAt: "2026-09-02T…" }]`. Trace: `managedCol` = `{ name: 2, email: 3 }`. ENSURE loop appends `Certificate ID`(9), `Certificate URL`(10), `Status`(11), `Issue Date`(12), `Emailed`(13), `Drive Link`(14), `Created At`(15) → `columnsAppended: 7`. `rowByKey` = `{ "javeria mustaqeem_jvra.mstqm@gmail.com": 2 }`. Participant matches row 2 → sets cols 9-15 on row 2. Columns 1 ("" blank), 4-8 (Designation…Department) **untouched**. Result: `{ rowsWritten: 1, columnsAppended: 7 }`.
- **Standard 9-col layout**: `managedCol` fully populated, `columnsAppended: 0`, existing rows matched by name+email, only WRITE_FIELDS cells updated. Confirm no `clearContent` runs and output matches today's for an unchanged roster.
- **Brand-new empty tab**: `headerRow` all blank → ENSURE appends all 9 in ENSURE order (Name, Email, then WRITE_FIELDS) → every participant is a new row.

- [ ] **Step 5: Commit**

```bash
git add apps-script.js docs/superpowers/plans/2026-09-02-sheet-header-mapping-and-editor-fixes.md
git commit -m "feat(apps-script): header-driven syncData write that never clobbers custom columns"
```

---

## Task 4: Apps Script — make the other positional writers header-aware

**Files:**
- Modify: `apps-script.js` — `updateCertIds` (~675-711), `upsertRow` (~714-755), `clearCertIdsByEmail` (~820-850), `deleteRows` cert-id column lookup (~780, 796)

**Why:** these four also hard-code column A = cert ID, column C = email. On the user's "EL" sheet (blank col A, email in col C by luck) `updateCertIds` / `clearCertIdsByEmail` write to the wrong column and `upsertRow` overwrites the custom D–H columns of the row it touches.

**Interfaces:**
- Consumes: `resolveManagedField_` from Task 2.
- Produces: a shared helper `managedColMap_(sheet)` → `{ name, email, certificateId, certificateUrl, status, issueDate, emailSent, driveLink, createdAt }` with 1-based column numbers or `null` when absent.

- [ ] **Step 1: Add `managedColMap_`**

Below `formatCell_` (from Task 2):

```javascript
// sheet -> { managedField: 1-basedColNum | null } from the header row.
function managedColMap_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {
    name: null, email: null, certificateId: null, certificateUrl: null, status: null,
    issueDate: null, emailSent: null, driveLink: null, createdAt: null
  };
  for (var c = 0; c < headerRow.length; c++) {
    var mf = resolveManagedField_(headerRow[c]);
    if (mf && map[mf] === null) map[mf] = c + 1;
  }
  return map;
}
```

- [ ] **Step 2: `updateCertIds` — write to the resolved cert-id column, match on the resolved email column**

Replace the batch-read + write (lines ~686-708) with:

```javascript
  var cols = managedColMap_(sheet);
  if (!cols.email) return { success: false, error: "Sheet has no Email column" };

  // Ensure a Certificate ID column exists.
  var certCol = cols.certificateId;
  if (!certCol) {
    certCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, certCol).setValue("Certificate ID").setFontWeight("bold");
  }

  var emailCol = sheet.getRange(2, cols.email, rowCount, 1).getValues();
  var certIdCol = sheet.getRange(2, certCol, rowCount, 1).getValues();

  var emailToCertId = {};
  updates.forEach(function (upd) {
    var email = (upd.email || "").toLowerCase().trim();
    if (email) emailToCertId[email] = upd.certificateId;
  });

  var updated = 0;
  for (var i = 0; i < rowCount; i++) {
    var email = (emailCol[i][0] || "").toLowerCase().trim();
    if (emailToCertId[email] !== undefined) { certIdCol[i][0] = emailToCertId[email]; updated++; }
  }
  sheet.getRange(2, certCol, rowCount, 1).setValues(certIdCol);
  return { success: true, updated: updated };
```

- [ ] **Step 3: `clearCertIdsByEmail` — same treatment**

Replace lines ~834-847 with the resolved-column version:

```javascript
  var cols = managedColMap_(sheet);
  if (!cols.email || !cols.certificateId) return { success: true, cleared: 0 };

  var emailCol = sheet.getRange(2, cols.email, rowCount, 1).getValues();
  var certIdCol = sheet.getRange(2, cols.certificateId, rowCount, 1).getValues();

  var cleared = 0;
  for (var i = 0; i < rowCount; i++) {
    if (emailSet.has((emailCol[i][0] || "").toLowerCase().trim())) { certIdCol[i][0] = ""; cleared++; }
  }
  sheet.getRange(2, cols.certificateId, rowCount, 1).setValues(certIdCol);
  return { success: true, cleared: cleared };
```

- [ ] **Step 4: `upsertRow` — match by name+email on resolved columns, write only managed cells**

Replace the body from `const email = …` (line ~721) through the end of the function with:

```javascript
  var cols = managedColMap_(sheet);
  // Ensure name/email + the write fields have columns.
  var ENSURE = ["name", "email", "certificateId", "certificateUrl", "status", "issueDate", "emailSent", "driveLink", "createdAt"];
  var LABELS = { name: "Name", email: "Email", certificateId: "Certificate ID", certificateUrl: "Certificate URL",
    status: "Status", issueDate: "Issue Date", emailSent: "Emailed", driveLink: "Drive Link", createdAt: "Created At" };
  var lc = sheet.getLastColumn();
  for (var f = 0; f < ENSURE.length; f++) {
    if (!cols[ENSURE[f]]) { lc += 1; sheet.getRange(1, lc).setValue(LABELS[ENSURE[f]]).setFontWeight("bold"); cols[ENSURE[f]] = lc; }
  }

  var name = (row.name || "").toLowerCase().trim();
  var email = (row.email || "").toLowerCase().trim();
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (lastRow > 1) {
    var scan = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    for (var i = 0; i < scan.length; i++) {
      var n = String(scan[i][cols.name - 1] || "").toLowerCase().trim();
      var e = String(scan[i][cols.email - 1] || "").toLowerCase().trim();
      if (n === name && e === email) { targetRow = i + 2; break; }
    }
  }

  function put(field, val) { sheet.getRange(targetRow, cols[field]).setValue(val); }
  var WRITE = ["certificateId", "certificateUrl", "status", "issueDate", "emailSent", "driveLink", "createdAt"];
  if (targetRow > 0) {
    for (var w = 0; w < WRITE.length; w++) put(WRITE[w], WRITE[w] === "emailSent" ? (row.emailSent ? "Yes" : "No") : (row[WRITE[w]] || ""));
    return { success: true, action: "updated", row: targetRow };
  } else {
    targetRow = sheet.getLastRow() + 1;
    for (var a = 0; a < ENSURE.length; a++) put(ENSURE[a], ENSURE[a] === "emailSent" ? (row.emailSent ? "Yes" : "No") : (row[ENSURE[a]] || ""));
    return { success: true, action: "appended", row: targetRow };
  }
```

- [ ] **Step 5: `deleteRows` — resolve the cert-id + name + email columns**

At the top of `deleteRows`, after the `sheet` is resolved, add `var cols = managedColMap_(sheet);` and change the data read + row-key logic to use `cols.certificateId`, `cols.name`, `cols.email` (fall back to 1/2/3 only if a column is `null`, to stay compatible with a sheet that has no header at all):

```javascript
  var aCol = cols.certificateId || 1, bCol = cols.name || 2, cCol = cols.email || 3;
  var maxCol = Math.max(aCol, bCol, cCol);
  var values = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();
  // ... rowCertId = String(values[i][aCol - 1]); key = norm(values[i][bCol - 1]) + " " + norm(values[i][cCol - 1]);
```

- [ ] **Step 6: Syntax check + hand-trace**

Run: `node -c apps-script.js`.
Append to `## Apps Script hand-traces`: trace `upsertRow` against the "EL" layout (blank A, Name B, Email C, Designation D…Department H) editing Javeria's row — confirm it appends `Certificate ID`..`Created At` at cols 9-15, writes only those on row 2, leaves D-H intact.

- [ ] **Step 7: Commit**

```bash
git add apps-script.js docs/superpowers/plans/2026-09-02-sheet-header-mapping-and-editor-fixes.md
git commit -m "feat(apps-script): header-aware updateCertIds, upsertRow, clearCertIdsByEmail, deleteRows"
```

---

## Task 5: `app/api/sheets/sync/route.ts` — wire the new syncData contract

**Files:**
- Modify: `app/api/sheets/sync/route.ts`

**Interfaces:**
- Consumes: `MANAGED_FIELDS` from Task 1; `syncData` read/write contract from Tasks 2-3.
- Produces: unchanged HTTP surface (`{ success, mode, synced }`).

- [ ] **Step 1: Rewrite the `firebaseToSheets` branch**

Replace lines ~34-65 (`if (mode === "firebaseToSheets") { … }`) with:

```ts
    if (mode === "firebaseToSheets") {
      const participantsSnap = await adminDb
        .collection("databases").doc(databaseId).collection("participants").get();

      const participants = participantsSnap.docs.map((d) => d.data() as any);
      const sortedParticipants = sortParticipantsForSheet(participants);

      const rows = sortedParticipants.map((p) => ({
        name: p.name || "",
        email: p.email || "",
        certificateId: p.certificateId || "",
        certificateUrl: p.certificateUrl || "",
        status: p.status || "pending",
        issueDate: p.issueDate || "",
        emailSent: !!p.emailSent,
        driveLink: p.driveLink || "",
        createdAt: p.createdAt || "",
      }));

      const result = await callAppsScript("syncData", {
        spreadsheetId, tabName, mode: "write", participants: rows,
      });

      return NextResponse.json({
        success: true, mode: "firebaseToSheets", synced: result.rowsWritten,
      });
    }
```

- [ ] **Step 2: Rewrite the `sheetsToFirebase` custom-field handling**

In the `sheetsToFirebase` branch, replace the `KNOWN_KEYS` set and the `Object.entries(p)` sweep (lines ~84-111) with:

```ts
      let synced = 0;

      for (const rec of result.data as any[]) {
        if (!rec.name) continue;

        const nameKey = (rec.name || "").toLowerCase().trim();
        const emailKey = (rec.email || "").toLowerCase().trim();
        const key = `${nameKey}_${emailKey}`;
        const existing = existingByKey.get(key);

        const fields = {
          name: rec.name,
          email: rec.email || "",
          certificateId: rec.certificateId || "",
          certificateUrl: rec.certificateUrl || "",
          status: rec.status || "pending",
          issueDate: rec.issueDate || "",
          emailSent: !!rec.emailSent,
          driveLink: rec.driveLink || "",
          customFields: (rec.custom && typeof rec.custom === "object") ? rec.custom : {},
        };

        if (existing) {
          await existing.ref.update(fields);
        } else {
          const newRef = await participantsRef.add({ ...fields, createdAt: new Date().toISOString() });
          existingByKey.set(key, { ref: newRef });
        }
        synced++;
      }
```

Remove the now-unused `import`… none to remove. Delete the `KNOWN_KEYS` constant.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Full test suite**

Run: `npx vitest run`
Expected: PASS (Task 1 tests included; nothing else affected).

- [ ] **Step 5: Commit**

```bash
git add app/api/sheets/sync/route.ts
git commit -m "feat(sheets): sync route uses header-driven syncData contract"
```

---

## Task 6: CSV/Excel import — same managed/custom split

**Files:**
- Modify: `app/api/participants/route.ts` (the import/create path that builds `customFields`)

**Interfaces:**
- Consumes: `resolveManagedField` from Task 1.

- [ ] **Step 1: Read the current import path**

Run: `grep -n "customFields\|KNOWN\|headers\|Object.entries\|reserved" app/api/participants/route.ts`
Identify where an imported row's non-standard columns become `customFields`.

- [ ] **Step 2: Write/adjust a test**

Add to `tests/` (new file `tests/participantImport.test.ts` if the logic is extractable, otherwise assert via the existing import test if one exists). If the classification is inline in the route and not unit-testable without a large harness, extract a helper `splitImportedRow(row: Record<string, unknown>): { fields: {...}; customFields: Record<string,string> }` into `lib/sheetSchema.ts` and test it there:

```ts
it("splitImportedRow keeps unknown columns as custom", () => {
  const { customFields } = splitImportedRow({
    Name: "A", Email: "b@c.d", Designation: "Lead", "Start Date": "2025",
  });
  expect(customFields).toEqual({ Designation: "Lead", "Start Date": "2025" });
});
```

- [ ] **Step 3: Implement**

Replace the route's ad-hoc known-key check with `resolveManagedField(header) === null` → custom. Keep the existing field assignments for managed headers.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/participants/route.ts lib/sheetSchema.ts tests/
git commit -m "refactor(import): reuse managed-header resolution for custom fields"
```

---

## Task 7: Bug 1 — template bytes without depending on Drive sharing

**Files:**
- Create: `lib/templateBytes.ts`
- Modify: `apps-script.js` (new `getTemplateBytes` + dispatch case)
- Modify: `app/api/templates/route.ts` (store `pdfBase64` on create when small)
- Modify: `app/api/templates/[id]/pdf/route.ts`, `app/api/certificates/render/route.ts`, `app/api/templates/preview/route.ts` (use `fetchTemplatePdf`)
- Modify: `app/admin/templates/page.tsx` (toast downgrade)

**Interfaces:**
- Produces: `fetchTemplatePdf(templateId: string, templateData: { driveFileId?: string; pdfBase64?: string }): Promise<Buffer>`.

- [ ] **Step 1: Add `getTemplateBytes` to apps-script**

Add dispatch case near the other template cases and the function:

```javascript
      case "getTemplateBytes":
        result = getTemplateBytes(payload);
        break;
```

```javascript
function getTemplateBytes(payload) {
  var fileId = payload.fileId;
  if (!fileId) throw new Error("fileId is required");
  var blob = DriveApp.getFileById(fileId).getBlob();
  return { success: true, base64: Utilities.base64Encode(blob.getBytes()), mimeType: blob.getContentType() };
}
```

Run `node -c apps-script.js` → valid.

- [ ] **Step 2: Write `lib/templateBytes.ts`**

```ts
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { getAdminDb } from "@/lib/firebase.admin";

const MAX_STORED_B64 = 920_000; // keep the Firestore doc well under the 1 MB limit

/**
 * Template PDF bytes, independent of Drive link-sharing.
 * 1. stored pdfBase64  2. Drive public URL (fast path for shared files)
 * 3. Apps Script getTemplateBytes (always works — runs as the file owner)
 * On a step-3 success, best-effort caches pdfBase64 back onto the template doc.
 */
export async function fetchTemplatePdf(
  templateId: string,
  templateData: { driveFileId?: string; pdfBase64?: string }
): Promise<Buffer> {
  if (templateData.pdfBase64) {
    return Buffer.from(templateData.pdfBase64, "base64");
  }

  if (templateData.driveFileId) {
    try {
      const res = await fetch(
        `https://drive.google.com/uc?export=download&id=${templateData.driveFileId}`,
        { redirect: "follow" }
      );
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        // Heuristic: Drive's HTML "can't scan / sign in" pages are small and not %PDF.
        if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return buf;
      }
    } catch { /* fall through */ }

    if (appsScriptConfigured()) {
      const r = await callAppsScript<{ success?: boolean; base64?: string; error?: string }>(
        "getTemplateBytes",
        { fileId: templateData.driveFileId }
      );
      if (r?.success && r.base64) {
        const buf = Buffer.from(r.base64, "base64");
        if (r.base64.length <= MAX_STORED_B64) {
          getAdminDb().collection("certificateTemplates").doc(templateId)
            .update({ pdfBase64: r.base64 }).catch(() => {});
        }
        return buf;
      }
    }
  }

  throw new Error("Template PDF could not be loaded from Drive or Apps Script.");
}
```

- [ ] **Step 3: Store `pdfBase64` on template create**

In `app/api/templates/route.ts`, in the `newTemplate` object, add after `driveFileId: driveData.fileId,`:

```ts
      ...(base64Data.length <= 920_000 ? { pdfBase64: base64Data } : {}),
```

- [ ] **Step 4: Route the three consumers through `fetchTemplatePdf`**

- `app/api/templates/[id]/pdf/route.ts`: replace the `if (data.driveFileId) { fetch(uc?export…) } … else if (data.pdfBase64)` block with:
  ```ts
  const { fetchTemplatePdf } = await import("@/lib/templateBytes");
  const pdf = await fetchTemplatePdf(id, data);
  return new NextResponse(pdf, { headers });
  ```
- `app/api/certificates/render/route.ts` (~lines 25-34): same substitution using the template id in scope.
- `app/api/templates/preview/route.ts` (~lines 23-32): same.

- [ ] **Step 5: Downgrade the sharing toast**

In `app/admin/templates/page.tsx`, find the `sharingFailed` handling (search `sharingFailed` / "make it public"). Replace the error toast with:

```ts
toast.info("Template uploaded. Couldn't set a public Drive link — that's fine, certificates still render.");
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all clean; `node -c apps-script.js` valid.

- [ ] **Step 7: Commit**

```bash
git add lib/templateBytes.ts apps-script.js app/api/templates/route.ts "app/api/templates/[id]/pdf/route.ts" app/api/certificates/render/route.ts app/api/templates/preview/route.ts app/admin/templates/page.tsx
git commit -m "fix(templates): fetch template bytes via Apps Script fallback, not just public Drive URL"
```

---

## Task 8: Bug 2 — Canva-style zoom in the template editor

**Files:**
- Modify: `app/admin/templates/page.tsx` (editor canvas area ~lines 1026-1106)

- [ ] **Step 1: Add zoom state and a "fit" helper**

Near the other editor `useState`s:

```tsx
const [zoom, setZoom] = useState(1);
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
```

- [ ] **Step 2: Add the zoom control above the canvas**

Just inside the `<div className="flex-1 flex items-start justify-center p-6 overflow-auto">` (line ~1026), before the canvas wrapper, add:

```tsx
<div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-white/95 border border-gray-200 rounded-lg shadow-sm px-1.5 py-1">
  <button onClick={() => setZoom(z => ZOOM_STEPS[Math.max(0, ZOOM_STEPS.indexOf(z) - 1)] ?? 0.5)}
    className="px-1.5 text-gray-600 hover:bg-gray-100 rounded">−</button>
  <span className="text-xs tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
  <button onClick={() => setZoom(z => ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, ZOOM_STEPS.indexOf(z) + 1)] ?? 2)}
    className="px-1.5 text-gray-600 hover:bg-gray-100 rounded">+</button>
  <button onClick={() => setZoom(1)}
    className="px-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Fit</button>
</div>
```

(The parent needs `relative` — add it to the `flex-1 flex items-start…` div's className.)

- [ ] **Step 3: Apply the transform to the canvas wrapper**

On the canvas element that currently has `style={{ aspectRatio: … }}` (line ~1041-1042) and holds the iframe + all `DraggableMarker`s, add to its style:

```tsx
style={{
  aspectRatio: `${templateDimensions.width} / ${templateDimensions.height}`,
  cursor: activeDrag ? 'grabbing' : 'default',
  transform: `scale(${zoom})`,
  transformOrigin: 'top center',
}}
```

The outer wrapper at line ~1027 keeps its `maxWidth`. Because `previewRef` is on this scaled element, `getBoundingClientRect()` in the pointer handlers returns the scaled box and the existing `(clientX - rect.left) / rect.width * 100` math stays correct with no change. `ResizeObserver`'s `contentRect` is the unscaled layout box, so `containerSizeRef` (used for marker font px) also stays correct.

- [ ] **Step 4: Manual check (dev server)**

Run: `npm run dev`, open a template editor, set zoom to 200%, drag a marker. Confirm: background and markers scale together; the marker lands where dropped; arrow-key nudges still move by the same visual amount relative to the page.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/admin/templates/page.tsx
git commit -m "feat(editor): zoom control that scales canvas and markers together"
```

---

## Task 9: Bug 4 — fittable certificate preview

**Files:**
- Modify: `app/admin/templates/page.tsx` (preview modal ~lines 1380-1420)

- [ ] **Step 1: Add fit/actual state**

```tsx
const [previewFit, setPreviewFit] = useState<"fit" | "actual">("fit");
```

- [ ] **Step 2: Size the iframe to the page shape**

In the preview modal, replace the iframe wrapper + iframe (lines ~1404-1410) with:

```tsx
<div className="flex-1 overflow-auto p-4 flex justify-center">
  {(() => {
    const ratio = templateDimensions.width / templateDimensions.height || 0.707;
    const style = previewFit === "fit"
      ? { height: `min(78vh, calc(88vw / ${ratio}))`, width: `calc(min(78vh, calc(88vw / ${ratio})) * ${ratio})` }
      : { width: templateDimensions.width, height: templateDimensions.height, maxWidth: "none" as const };
    return (
      <iframe
        src={`${previewPdfUrl}#toolbar=0&navpanes=0`}
        style={style}
        className="border border-gray-200 bg-white"
        title="Certificate Preview"
      />
    );
  })()}
</div>
```

- [ ] **Step 3: Add the toggle to the modal header**

In the header row (line ~1392-1403), before the close button:

```tsx
<button
  onClick={() => setPreviewFit(f => (f === "fit" ? "actual" : "fit"))}
  className="text-xs font-medium text-gray-600 hover:bg-gray-100 px-2 py-1 rounded-lg"
>
  {previewFit === "fit" ? "Actual size" : "Fit page"}
</button>
```

- [ ] **Step 4: Reset on open**

Wherever `previewPdfUrl` is set (search `setPreviewPdfUrl(`), also call `setPreviewFit("fit")`.

- [ ] **Step 5: Manual check**

`npm run dev` → open the "Official CTM Experience Letters" preview (A4 portrait). Confirm the whole page is visible in "Fit page", and "Actual size" shows it at natural size with a working scrollbar.

- [ ] **Step 6: Verify + commit**

```bash
npx tsc --noEmit && npm run build
git add app/admin/templates/page.tsx
git commit -m "fix(editor): certificate preview fits A4 portrait with a fit/actual toggle"
```

---

## Task 10: Editor — trim `sourceField`, add a hint

**Files:**
- Modify: `app/admin/templates/page.tsx` (Bind to Column input ~line 1140)

**Context:** the editor is not database-scoped (a template serves many databases), so there is no single sheet whose headers we could offer as a dropdown. Keep free-text; make it robust and self-documenting.

- [ ] **Step 1: Trim on change**

Line ~1140-1141: change the `onChange` to store a trimmed value:

```tsx
onChange={e => updateCustomElement(customEl.id, { sourceField: e.target.value.trim() || undefined })}
```

- [ ] **Step 2: Sharpen the hint text**

The helper `<p>` under the input (~line 1144): set its text to:

```
Must match a column header in your linked Google Sheet exactly (case-insensitive). e.g. "Designation/Role"
```

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add app/admin/templates/page.tsx
git commit -m "fix(editor): trim bound-column names and clarify the hint"
```

---

## Task 11: Session log

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Add a session-log section**

Append a `## Session log — 2026-09-02: Sheet header mapping + editor fixes` section summarizing: header-name sheet model (managed vs custom, `lib/sheetSchema.ts`), `syncData` read/write rewrite (row-matched, no clobber), Apps Script redeploy owed, `getTemplateBytes` fallback, editor zoom + preview toggle. Note the manual live steps: restore "EL" from Sheets version history, redeploy Apps Script, re-sync, regenerate `2026-PZ-CTM-0001`.

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(context): log the sheet-header-mapping session"
```

---

## Apps Script hand-traces

### Task 2 — `syncData({ mode: "read" })`, header-driven

**Trace A — user's "EL" custom layout (blank col A, managed Name/Email, 5 custom cols)**

Input:
- `headerRow = ["", "Name", "Email", "Designation/Role", "Start Date", "End Date", "Duration", "Department"]`
- one data row: `["", "Javeria Mustaqeem", "jvra.mstqm@gmail.com", "Sales representative", "20-July-2025", "25-August-2026", "1 year and 1 month", "Sales"]`
- `lastRow = 2`, `lastCol = 8` → guard `lastRow <= 1 || lastCol < 1` is false.

Header loop:
| c | raw | trimmed | `resolveManagedField_` | effect |
|---|-----|---------|------------------------|--------|
| 0 | `""` | `""` | — | skipped (empty) |
| 1 | `"Name"` | `"Name"` | `normalizeHeader_` → `"name"` → `"name"` | `managed.name = 1` |
| 2 | `"Email"` | `"Email"` | → `"email"` → `"email"` | `managed.email = 2` |
| 3 | `"Designation/Role"` | same | `"designation/role"` → not in `MANAGED_ALIASES_` → `null` | `customCols += {header:"Designation/Role", index:3}` |
| 4 | `"Start Date"` | same | `"start date"` → `null` | `customCols += {header:"Start Date", index:4}` |
| 5 | `"End Date"` | same | `"end date"` → `null` | `customCols += {header:"End Date", index:5}` |
| 6 | `"Duration"` | same | `"duration"` → `null` | `customCols += {header:"Duration", index:6}` |
| 7 | `"Department"` | same | `"department"` → `null` | `customCols += {header:"Department", index:7}` |

`managed = { name: 1, email: 2 }` — all 7 other managed fields absent.

Row mapping (`m(field)` returns `""` when `managed[field] === undefined`):
- `name` → `formatCell_(row[1])` = `"Javeria Mustaqeem"` (not a Date)
- `email` → `formatCell_(row[2])` = `"jvra.mstqm@gmail.com"`
- `certificateId, certificateUrl, status, issueDate, driveLink, createdAt` → `""`
- `emailSent` → `m("emailSent")` = `""`; `"" === "Yes" || "" === true` → **`false`**
- custom loop: each cell is a non-empty string → `rec.custom[header] = String(v)`

`data[0]` =
```
{
  name: "Javeria Mustaqeem",
  email: "jvra.mstqm@gmail.com",
  certificateId: "",
  certificateUrl: "",
  status: "",
  issueDate: "",
  emailSent: false,
  driveLink: "",
  createdAt: "",
  custom: {
    "Designation/Role": "Sales representative",
    "Start Date": "20-July-2025",
    "End Date": "25-August-2026",
    "Duration": "1 year and 1 month",
    "Department": "Sales"
  }
}
```
Matches the brief's expected output. ✅

**Trace B — standard 9-column layout (`addHeaders` order)**

Input:
- `headerRow = ["Certificate ID","Name","Email","Certificate URL","Status","Issue Date","Emailed","Drive Link","Created At"]`
- one data row: `["2026-PZ-CTM-0001","Ali Raza","ali@example.com","https://pharmacozyme.example/verify/2026-PZ-CTM-0001","issued", <Date 2025-07-20>, "Yes", "https://drive.google.com/file/d/abc/view", <Date 2025-07-20>]`
- `lastRow = 2`, `lastCol = 9`.

Header loop resolves every column to a managed field:
`managed = { certificateId:0, name:1, email:2, certificateUrl:3, status:4, issueDate:5, emailSent:6, driveLink:7, createdAt:8 }`, `customCols = []`.

Row mapping:
- `certificateId` → `"2026-PZ-CTM-0001"`, `name` → `"Ali Raza"`, `email` → `"ali@example.com"`, `certificateUrl` → `"https://pharmacozyme.example/verify/2026-PZ-CTM-0001"`, `status` → `"issued"`, `driveLink` → `"https://drive.google.com/file/d/abc/view"` — all identical to the old positional read (`row[0]`,`row[1]`,…).
- `emailSent` → `formatCell_("Yes")` = `"Yes"`; `"Yes" === "Yes"` → `true` — same as old `row[6] === "Yes"`.
- `issueDate` / `createdAt` → cells are `Date` objects → `formatCell_` → `Utilities.formatDate(cell, tz, "MMM d, yyyy")` → `"Jul 20, 2025"`. (Old read returned these managed date cells as raw `Date`; `formatCell_` is now applied uniformly to managed cells too — see note.)

`data[0].custom` = `{}` (no custom columns). ✅

`data[0]` =
```
{
  name: "Ali Raza",
  email: "ali@example.com",
  certificateId: "2026-PZ-CTM-0001",
  certificateUrl: "https://pharmacozyme.example/verify/2026-PZ-CTM-0001",
  status: "issued",
  issueDate: "Jul 20, 2025",
  emailSent: true,
  driveLink: "https://drive.google.com/file/d/abc/view",
  createdAt: "Jul 20, 2025",
  custom: {}
}
```

**Note (behavior change):** the old code date-formatted only the extra (col ≥ 10) custom cells; managed `Issue Date` / `Created At` cells came back as raw `Date`. The new code runs `formatCell_` on every cell, so a date-typed managed cell now returns a `"MMM d, yyyy"` string instead of a `Date`. Non-date managed values are byte-for-byte identical to the old positional output. Object key order also changed (name-first) but consumers read by key name.

---

### Task 3 — `syncData({ mode: "write" })`, header-driven, no-clobber

Branch replaced in full: NO `clearContent`, NO positional `row[0..8]` writes. Every write is a targeted `sheet.getRange(row, managedCol[field]).setValue(...)` on a column the app owns. `WRITE_FIELDS` = `["certificateId","certificateUrl","status","issueDate","emailSent","driveLink","createdAt"]` (7). `ENSURE_FIELDS` = `["name","email"].concat(WRITE_FIELDS)` (9).

**Trace 1 — user's "EL" layout after Task 2 restore (blank col A, custom D–H)**

Input:
- `sheet.getLastColumn() = 8`; `headerRow = ["", "Name", "Email", "Designation/Role", "Start Date", "End Date", "Duration", "Department"]` (0-based indices 0–7).
- existing row 2: `["", "Javeria Mustaqeem", "jvra.mstqm@gmail.com", "Sales representative", "20-July-2025", "25-August-2026", "1 year and 1 month", "Sales"]`; `sheet.getLastRow() = 2`.
- `participants = [{ name: "Javeria Mustaqeem", email: "jvra.mstqm@gmail.com", certificateId: "2026-PZ-CTM-0001", certificateUrl: "https://…", status: "generated", issueDate: "Sep 2, 2026", emailSent: false, driveLink: "https://drive…", createdAt: "2026-09-02T…" }]`

Steps:
- `lastCol = Math.max(8, 1) = 8`. `headerRow` read over 8 cols.
- managedCol loop: c0 `""`→null; c1 `"Name"`→`name`→`managedCol.name = 2`; c2 `"Email"`→`email`→`managedCol.email = 3`; c3–c7 (`Designation/Role`,`Start Date`,`End Date`,`Duration`,`Department`)→not in `MANAGED_ALIASES_`→null. ⇒ `managedCol = { name: 2, email: 3 }`.
- ENSURE loop (start `lastCol = 8`): `name`,`email` already present → skipped. Then append, each `lastCol += 1` then `setValue` bold at that col:
  | field | col | label |
  |-------|-----|-------|
  | certificateId | 9 | Certificate ID |
  | certificateUrl | 10 | Certificate URL |
  | status | 11 | Status |
  | issueDate | 12 | Issue Date |
  | emailSent | 13 | Emailed |
  | driveLink | 14 | Drive Link |
  | createdAt | 15 | Created At |
  ⇒ `columnsAppended = 7`. Appended columns start at 9 = one past the real last column (8). Custom cols 4–8 untouched; col 1 (blank) untouched.
- Row index: `lastRow = 2 > 1`. `nameCol = 2`, `emailCol = 3`. `keyVals = getRange(2, 1, 1, 15)` (getLastColumn now 15). r0: `nm = "javeria mustaqeem"`, `em = "jvra.mstqm@gmail.com"` ⇒ `rowByKey = { "javeria mustaqeem_jvra.mstqm@gmail.com": 2 }`.
- Participant loop, i0: `key = "javeria mustaqeem_jvra.mstqm@gmail.com"` → `row = 2` (matched). WRITE_FIELDS loop sets ONLY:
  - col 9 = `"2026-PZ-CTM-0001"`, col 10 = `"https://…"`, col 11 = `"generated"`, col 12 = `"Sep 2, 2026"`, col 13 = `fmt("emailSent")` = `"No"` (emailSent false), col 14 = `"https://drive…"`, col 15 = `"2026-09-02T…"`.
  - `written = 1`. Name (col 2), Email (col 3), blank col 1, and custom cols 4–8 (Designation/Role … Department) are never written.
- Return: `{ success: true, rowsWritten: 1, columnsAppended: 7 }`. ✅ Matches brief.

**Trace 2 — standard 9-col layout, unchanged roster**

Input:
- `headerRow = ["Name","Email","Certificate ID","Certificate URL","Status","Issue Date","Emailed","Drive Link","Created At"]` (new `addHeaders` order); `getLastColumn() = 9`.
- existing rows 2–3 = Ali Raza / Sara Khan, already fully populated; `getLastRow() = 3`.
- `participants` = the same two people, same field values (unchanged roster).

Steps:
- `lastCol = 9`. managedCol loop resolves every column ⇒ `managedCol = { name:1, email:2, certificateId:3, certificateUrl:4, status:5, issueDate:6, emailSent:7, driveLink:8, createdAt:9 }`.
- ENSURE loop: all 9 fields present ⇒ no `setValue` on the header row, `columnsAppended = 0`.
- Row index: `keyVals = getRange(2, 1, 2, 9)`. `rowByKey = { "ali raza_ali@example.com": 2, "sara khan_sara@example.com": 3 }`.
- Participant loop: Ali → row 2 matched → cols 3–9 on row 2 re-set to their existing values (net no change); Sara → row 3 matched → cols 3–9 on row 3. Name/Email (cols 1–2) never rewritten. `written = 2`.
- No `clearContent` anywhere in the branch (grep-verified). `emailSent` still serialized `"Yes"`/`"No"` exactly as the old code. For an unchanged roster every written cell equals its prior content ⇒ resulting sheet is identical to today's output, minus the destructive clear-and-rewrite of Name/Email and any columns ≥ 10.
- Return: `{ success: true, rowsWritten: 2, columnsAppended: 0 }`. ✅

**Trace 3 — brand-new empty tab**

Input: freshly `insertSheet`-ed tab, no content. `sheet.getLastColumn() = 0`, `sheet.getLastRow() = 0`.

Steps:
- `lastCol = sheet.getLastColumn() = 0`. `headerRow = lastCol >= 1 ? getRange(...) : [] = []` (fix M5 — the `>= 1` guard avoids `getRange(1,1,1,0)` throwing).
- managedCol loop: `headerRow` empty ⇒ loop body never runs ⇒ `managedCol = {}`.
- ENSURE loop (start `lastCol = 0`): every field absent, so all 9 appended in ENSURE order — `lastCol += 1` first, so the first append (`name`) lands at **column 1 / A**:
  `name`→1 "Name", `email`→2 "Email", `certificateId`→3, `certificateUrl`→4, `status`→5, `issueDate`→6, `emailSent`→7 "Emailed", `driveLink`→8, `createdAt`→9 "Created At". `columnsAppended = 9`. No blank column A.
- Row index: the ENSURE loop has just written header cells to row 1, so `sheet.getLastRow()` returns **1** at the point it is called (after ENSURE, before the participant loop). `lastRow = 1`; `lastRow > 1` is false ⇒ `rowByKey = {}`.
- Participant loop: every participant is unmatched → `lastRow += 1` → first new data row = `1 + 1 = 2`. ENSURE_FIELDS loop writes name→col1, email→col2, then the 7 WRITE_FIELDS into cols 3–9. Header stays on row 1, data from row 2. ✅ Every participant is a new appended row with Name+Email+7 fields. Return `{ success: true, rowsWritten: participants.length, columnsAppended: 9 }`.

Resolved (fix M5): the earlier draft seeded `lastCol = Math.max(getLastColumn(), 1) = 1` on an empty sheet, so the pre-incrementing ENSURE loop started the header block at column 2 and left column A permanently blank. Seeding from the raw `getLastColumn()` (0 on a fresh tab), with a `>= 1` guard on the header read, makes the first append land in column A. This path is reachable when `createSheet` runs with multiple `subDatabases` — only `getSheets()[0]` gets `addHeaders`; tabs 2+ (`insertSheet` at ~line 196) reach `syncData` write with no header row. Task 4's `managedColMap_` still uses `Math.max(getLastColumn(), 1)`, which is correct there (it only reads the header row and never appends).

---

### Task 4 — `upsertRow`, header-aware, against the "EL" layout

**Trace — user's "EL" custom layout, editing Javeria's existing row**

Input:
- `sheet.getLastColumn() = 8`; `headerRow = ["", "Name", "Email", "Designation/Role", "Start Date", "End Date", "Duration", "Department"]` (0-based indices 0–7 → 1-based cols 1–8).
- existing row 2: `["", "Javeria Mustaqeem", "jvra.mstqm@gmail.com", "Sales representative", "20-July-2025", "25-August-2026", "1 year and 1 month", "Sales"]`; `sheet.getLastRow() = 2`.
- `row = { name: "Javeria Mustaqeem", email: "jvra.mstqm@gmail.com", certificateId: "2026-PZ-CTM-0001", certificateUrl: "https://…verify/2026-PZ-CTM-0001", status: "generated", issueDate: "Sep 2, 2026", emailSent: false, driveLink: "https://drive…", createdAt: "2026-09-02T…" }`

Steps:
- `cols = managedColMap_(sheet)`: `lastCol = max(8,1) = 8`; header loop — c0 `""`→`null`; c1 `"Name"`→`normalizeHeader_`→`"name"`→`name`, `map.name = 2`; c2 `"Email"`→`email`, `map.email = 3`; c3 `"Designation/Role"`→`"designation/role"`→not in `MANAGED_ALIASES_`→`null`; c4–c7 (`Start Date`,`End Date`,`Duration`,`Department`)→`null`. ⇒ `cols = { name:2, email:3, certificateId:null, certificateUrl:null, status:null, issueDate:null, emailSent:null, driveLink:null, createdAt:null }`.
- ENSURE loop, `lc = sheet.getLastColumn() = 8`. `ENSURE = [name, email, certificateId, certificateUrl, status, issueDate, emailSent, driveLink, createdAt]`.
  - `name` → `cols.name` truthy → skip. `email` → `cols.email` truthy → skip.
  - `certificateId`: falsy → `lc = 9`; `setRange(1,9).setValue("Certificate ID").bold`; `cols.certificateId = 9`.
  - `certificateUrl`: `lc = 10` → "Certificate URL"; `cols.certificateUrl = 10`.
  - `status`: `lc = 11` → "Status"; `cols.status = 11`.
  - `issueDate`: `lc = 12` → "Issue Date"; `cols.issueDate = 12`.
  - `emailSent`: `lc = 13` → "Emailed"; `cols.emailSent = 13`.
  - `driveLink`: `lc = 14` → "Drive Link"; `cols.driveLink = 14`.
  - `createdAt`: `lc = 15` → "Created At"; `cols.createdAt = 15`.
  ⇒ appended `Certificate ID`..`Created At` at cols **9–15**, one past the real last column (8). Blank col 1 and custom cols 4–8 untouched.
- `name = "javeria mustaqeem"`, `email = "jvra.mstqm@gmail.com"`. `lastRow = sheet.getLastRow() = 2 > 1`:
  - `scan = getRange(2, 1, 1, sheet.getLastColumn()=15).getValues()` → one row; `scan[0]` is the 15-wide row (cols 9–15 currently blank).
  - i0: `n = String(scan[0][cols.name-1] = scan[0][1] = "Javeria Mustaqeem").toLowerCase().trim() = "javeria mustaqeem"`; `e = scan[0][2] = "jvra.mstqm@gmail.com"`. `n === name && e === email` → `targetRow = 0 + 2 = 2`. break.
- `targetRow = 2 > 0` → update branch. `WRITE = [certificateId, certificateUrl, status, issueDate, emailSent, driveLink, createdAt]`. `put(field, val)` = `getRange(2, cols[field]).setValue(val)`:
  - `put("certificateId", "2026-PZ-CTM-0001")` → cell (2,9)
  - `put("certificateUrl", "https://…verify/2026-PZ-CTM-0001")` → (2,10)
  - `put("status", "generated")` → (2,11)
  - `put("issueDate", "Sep 2, 2026")` → (2,12)
  - `put("emailSent", "No")` (field === "emailSent" → `row.emailSent ? "Yes" : "No"` → `false` → `"No"`) → (2,13)
  - `put("driveLink", "https://drive…")` → (2,14)
  - `put("createdAt", "2026-09-02T…")` → (2,15)
  - Return `{ success: true, action: "updated", row: 2 }`.
- Cells written on row 2: **only cols 9–15**. Col 1 (blank), col 2 (Name), col 3 (Email), and custom cols **4–8** (Designation/Role, Start Date, End Date, Duration, Department) are never touched. ✅ Matches the brief expectation (appends `Certificate ID`..`Created At` at cols 9–15, writes only those on row 2, leaves D–H intact).

**Empty-tab cursor note:** `lc` is seeded from `sheet.getLastColumn()` (not `Math.max(…, 1)`), so on a genuinely empty tab the first ENSURE field (`name`) lands at `0 + 1 = 1` (column A), not column B. The append branch then sets `targetRow = sheet.getLastRow() + 1` — after the ENSURE loop wrote row 1 headers, `getLastRow() = 1` → first data row = 2. The same `getLastColumn()`-seeded cursor is used in `updateCertIds` / `clearCertIdsByEmail` (both via `sheet.getLastColumn() + 1` for the appended Certificate ID column).

---

## Live smoke test (run by the user — redeploy Apps Script FIRST, then merge + deploy Vercel)

1. Redeploy the Apps Script web app (edit → new version, URL unchanged). `read` is backward-compatible either way, but `write` is not — deploying Vercel before the Apps Script redeploy makes every Firebase→Sheets sync 500 until the redeploy (the new `/api/sheets/sync` sends `{ mode:"write", participants:[...] }` with no `data`; the old deployed write branch does `data.map(...)`). Redeploy Apps Script first.
2. Merge `feat/sheet-header-mapping` and let Vercel deploy — only after step 1.
3. Vercel blue-dot Production SHA check: confirm the git commit shown in Deployments matches the pushed branch HEAD.
4. Google Sheets → "Official Certificates" → File → Version history → restore the version of the "EL" tab from before generation (with Designation/Start Date/… data).
5. In the app, open the database linked to that sheet → sync **from** the sheet → confirm the participant now shows Designation/Role, Start Date, etc. (check the participant table or re-open the generator warning — it should NOT warn about missing bound fields).
6. Generate one certificate. Confirm: the PDF prints Designation/Role, Start Date, End Date, Duration, Department in their bound positions; QR + cert ID + name still correct.
7. Open the sheet. Confirm: the D–H custom columns are still there with their original values; `Certificate ID`, `Certificate URL`, `Status`, `Drive Link`, etc. are filled into existing or newly-appended columns; no column was wiped.
8. Regenerate the earlier bad `2026-PZ-CTM-0001` so its bound fields are populated.
9. Template editor: open a template, zoom to 150–200%, confirm markers track the background; drop a marker and confirm it lands where expected.
10. Preview a portrait template: confirm "Fit page" shows the whole page and "Actual size" scrolls.
11. Upload a template from an account whose Drive blocks link sharing: confirm the toast is informational (not a red error) and the editor still renders the PDF.

---

## Self-review

- **Spec coverage:** §1.5 editor dropdown → downgraded to Task 10 (trim + hint) because the editor is not database-scoped; documented in Task 10 context. §3 module → Task 1. §4 syncData read/write → Tasks 2-3; the other positional writers (`updateCertIds`/`upsertRow`/`clearCertIdsByEmail`/`deleteRows`) → Task 4. §5 route → Task 5. §6 Bug 1 → Task 7. §7 zoom → Task 8. §8 preview → Task 9. §9 file map → all covered (plus `apps-script.js` positional-writer changes from Task 4). §10 testing → Task 1 unit tests + hand-traces in Tasks 2-4 + smoke test. §11 rollout → smoke test list + CONTEXT (Task 11).
- **Placeholder scan:** none — every code step has real code; Task 6 Step 1 is an inspection step whose outcome branches to two spelled-out options.
- **Type consistency:** `syncData` read returns `custom` (Tasks 2, 5 agree). Write takes `participants` with the 9 managed keys + `emailSent: boolean` (Tasks 3, 5 agree). `managedColMap_` shape (Task 4) matches `MANAGED_FIELDS` (Task 1). `fetchTemplatePdf(templateId, templateData)` signature consistent across Task 7 steps 2 and 4.
