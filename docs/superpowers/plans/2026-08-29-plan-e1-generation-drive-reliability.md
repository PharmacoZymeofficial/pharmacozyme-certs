# Plan E1 — Generation / Drive / Sheet Reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bulk certificate generation, Drive upload, and Sheet sync reliable by replacing the fragile stored resume ledger with derived state, killing the concurrent Drive-folder race, propagating silent persistence failures, and making delete cascades remove Sheet rows and orphaned Drive files.

**Architecture:** Generation completeness becomes a pure function of each participant doc (`certificateId` present? `driveLink` present?), computed on every read — the `generationJobs` doc shrinks to a bare run marker (`templateId` + `startedAt` + `status`). A canonical Drive folder id is resolved once per run and passed to every `uploadPDF` call so Apps Script never creates a folder by name under concurrency. Every state-persisting `await fetch` on the generation path gets an `.ok` check. Sheet-row deletion moves to one `deleteRows` Apps Script function matched by cert id or name+email.

**Tech Stack:** Next.js 16 (App Router, `next build` — no eslint in build), React 19, TypeScript, Firebase Admin SDK (`lib/firebase.admin.ts` — never import `firebase-admin/auth`), Vitest, Google Apps Script bridge (`apps-script.js`, HTTP via `lib/appsScript.ts`).

**Spec:** `docs/superpowers/specs/2026-08-29-plan-e1-generation-drive-reliability.md` — read it alongside this plan.

## Global Constraints

- **Branch:** `feat/plan-e1-generation-drive-reliability` (already created off `main` @ `bd3886f`). Do not merge, push, or deploy — that is the user's call.
- **Gate before every commit:** `npx tsc --noEmit` clean · `npx vitest run` clean · `npm run build` exit 0. Run all three from the Bash tool (PowerShell execution policy blocks `npm`; `npm.cmd` or the Bash tool works).
- **Commits:** Conventional Commits. Body ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **No new env vars. No `firestore.rules` changes. No new `firestore.indexes.json` entries.**
- **No new retry logic.** The existing 3× backoff on Drive upload stays exactly as-is. This plan only *notices* failures.
- **Inviolable (Plan C review):** never change `lib/urls.ts` `buildVerificationUrl` or make the public-page auto-verify pass the page's category. Not touched by this plan — keep it that way.
- **Email is out of scope.** The counts-only model (`Participant.emailError` string + `emailSent` bool) is untouched. "Done" for a participant = cert id + Drive PDF, never email.
- React 19: type-only imports use `import type`. `JSX` comes from `react` (`import type { JSX } from "react"`).
- `apps-script.js` is not type-checked or bundled — it is copy-pasted into the Apps Script editor by the user. Changes there ride along in the commit but require a manual web-app redeploy (Section 11 of the spec).
- Do **not** run `graphify auto-update` (not installed — `AGENTS.md` mentions it; it is a known no-op in this workspace).

---

## File Structure

### New files

| Path | Responsibility |
| --- | --- |
| `lib/generationState.ts` | Pure: `classifyParticipant`, `deriveGenerationSummary`, `jobEffectiveStatus`. The single source of truth for "what still needs doing". |
| `tests/generationState.test.ts` | Unit tests for the above. |
| `app/api/drive/consolidate/route.ts` | `POST { databaseId }` → resolve name + `driveFolderId` → Apps Script `consolidateFolders` → `{ movedFiles, trashedFolders }`. |

### Modified files

| Path | Change |
| --- | --- |
| `lib/driveCleanup.ts` | Add `resolveDriveFileId(participant)`. |
| `tests/driveCleanup.test.ts` | Add `resolveDriveFileId` cases. |
| `lib/types.ts` | `GenerationJob` slimmed to `{ databaseId, templateId?, startedAt, status, startedBy }`. |
| `app/api/generation-jobs/[databaseId]/route.ts` | PUT accepts only `{ templateId?, startedAt?, status? }`; GET applies `jobEffectiveStatus` (stale `running` → `interrupted`). |
| `app/api/databases/public/route.ts` | Live `.count()` per live DB instead of the stored `participantCount`. |
| `app/api/databases/route.ts` | GET tacks `hasUnfinishedJob: boolean` onto each DB from one `generationJobs` collection read. |
| `app/api/drive-upload/route.ts` | Accept + forward `folderId`. |
| `app/api/participants/[id]/route.ts` | `deleteRows` instead of `clearCertIdsByEmail`; `resolveDriveFileId` for the Drive file. |
| `app/api/participants/bulk-delete/route.ts` | One `deleteRows` with a full `matches` array; `resolveDriveFileId`. |
| `components/CertificateGenerator.tsx` | Derived run set (needs-cert ∪ needs-pdf [∪ complete]); drop the `completedParticipantIds` ledger; job doc = bare marker; `.ok` checks on Phase-3 writes; count cert-PATCH failures; resolve the canonical folder id once; resume auto-starts. |
| `components/admin/databases/GenerationResumeBanner.tsx` | Render from a passed-in `GenerationSummary` + `job.status`; button label "Discard" → "Dismiss". |
| `components/admin/databases/useDatabaseManager.ts` | `discardGenerationJob` → dismiss (flag only, no DELETE); derive the selected DB's summary; thread `hasUnfinishedJob` through the list. |
| `components/admin/databases/DatabaseManager.tsx` | Pass the derived summary to the banner; pass resume intent from the card. |
| `components/admin/databases/DatabaseDetail.tsx` | Pass the summary to the banner; add the "Consolidate folders" button. |
| `components/admin/databases/DatabaseList.tsx` | "Unfinished — Resume" badge on cards where `hasUnfinishedJob`. |
| `apps-script.js` | `uploadPDF` accepts `folderId`; new `deleteRows` + `consolidateFolders`; delete unused `deleteRowsByCertIds` + `deleteRowsByEmail`; add the two new `case`s and drop the two old ones in `doPost`. |

### Deleted files

| Path | Reason |
| --- | --- |
| `lib/generationResume.ts` | Replaced by `lib/generationState.ts`. |
| `tests/generationResume.test.ts` | Replaced by `tests/generationState.test.ts`. |

### Ruling — the DB-card "unfinished" badge (spec §4.5)

The spec says each DB card gets a derived "N unfinished" badge. The card list (`DatabaseList`) only ever has the lightweight `Database[]` — deriving a *count* per card would need either an N+1 participant fetch across all ~33 databases on every admin page load, or a stored aggregate (which the spec forbids). **Ruling:** the card badge is driven by **`generationJobs` doc existence** — `/api/databases` GET does one extra `generationJobs.get()` and tacks `hasUnfinishedJob` onto each DB. The card shows a plain "Unfinished — Resume" badge (no number). The **precise derived breakdown** ("12 need a cert ID · 5 have an ID, no PDF · 64 complete") is shown in the detail-view banner and the generator, where participants are already loaded. A job doc exists exactly while a run is `running` or `interrupted` and is deleted on clean finish, so its presence is a faithful "unfinished" signal. Cost if wrong: the card badge can lag reality by one run if a run throws before writing the job doc (it writes it first thing, so this is near-impossible) — the detail banner always shows truth.

---

## Task 1: `lib/generationState.ts` — pure state derivation

**Files:**
- Create: `lib/generationState.ts`
- Test: `tests/generationState.test.ts`

**Interfaces:**
- Consumes: `Participant` from `@/lib/types`.
- Produces:
  - `type ParticipantGenState = "needs-cert" | "needs-pdf" | "complete"`
  - `classifyParticipant(p: Pick<Participant, "certificateId" | "driveLink">): ParticipantGenState`
  - `interface GenerationSummary { needsCert: number; needsPdf: number; complete: number; total: number }`
  - `deriveGenerationSummary(participants: Pick<Participant, "certificateId" | "driveLink">[]): GenerationSummary`
  - `jobEffectiveStatus(job: { status?: string; startedAt?: string }, now?: number): "running" | "interrupted"`
  - `const STALE_JOB_MS = 30 * 60 * 1000`

- [ ] **Step 1: Write the failing test**

Create `tests/generationState.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  classifyParticipant,
  deriveGenerationSummary,
  jobEffectiveStatus,
  STALE_JOB_MS,
} from "@/lib/generationState";

describe("classifyParticipant", () => {
  it("no certificateId -> needs-cert (undefined or empty string)", () => {
    expect(classifyParticipant({})).toBe("needs-cert");
    expect(classifyParticipant({ certificateId: "" })).toBe("needs-cert");
    expect(classifyParticipant({ certificateId: "   " })).toBe("needs-cert");
  });

  it("certificateId but no driveLink -> needs-pdf", () => {
    expect(classifyParticipant({ certificateId: "2026-PZ-CRS-0001" })).toBe("needs-pdf");
    expect(classifyParticipant({ certificateId: "2026-PZ-CRS-0001", driveLink: "" })).toBe("needs-pdf");
  });

  it("certificateId and driveLink -> complete", () => {
    expect(
      classifyParticipant({ certificateId: "2026-PZ-CRS-0001", driveLink: "https://drive.google.com/file/d/abc/view" })
    ).toBe("complete");
  });

  it("driveLink without a certificateId is still needs-cert", () => {
    expect(classifyParticipant({ driveLink: "https://drive.google.com/file/d/abc/view" })).toBe("needs-cert");
  });
});

describe("deriveGenerationSummary", () => {
  it("tallies a mixed roster", () => {
    const summary = deriveGenerationSummary([
      {},                                                                       // needs-cert
      { certificateId: "" },                                                     // needs-cert
      { certificateId: "X" },                                                    // needs-pdf
      { certificateId: "Y", driveLink: "" },                                     // needs-pdf
      { certificateId: "Z", driveLink: "https://drive.google.com/file/d/z/view" }, // complete
    ]);
    expect(summary).toEqual({ needsCert: 2, needsPdf: 2, complete: 1, total: 5 });
  });

  it("empty roster -> all zeroes", () => {
    expect(deriveGenerationSummary([])).toEqual({ needsCert: 0, needsPdf: 0, complete: 0, total: 0 });
  });
});

describe("jobEffectiveStatus", () => {
  const base = Date.parse("2026-08-29T12:00:00.000Z");

  it("a fresh running job stays running", () => {
    expect(
      jobEffectiveStatus({ status: "running", startedAt: new Date(base - 60_000).toISOString() }, base)
    ).toBe("running");
  });

  it("a running job older than STALE_JOB_MS reads as interrupted", () => {
    expect(
      jobEffectiveStatus({ status: "running", startedAt: new Date(base - STALE_JOB_MS - 1).toISOString() }, base)
    ).toBe("interrupted");
  });

  it("an explicitly interrupted job stays interrupted regardless of age", () => {
    expect(
      jobEffectiveStatus({ status: "interrupted", startedAt: new Date(base - 60_000).toISOString() }, base)
    ).toBe("interrupted");
  });

  it("a missing or unparseable startedAt reads as interrupted", () => {
    expect(jobEffectiveStatus({ status: "running" }, base)).toBe("interrupted");
    expect(jobEffectiveStatus({ status: "running", startedAt: "not-a-date" }, base)).toBe("interrupted");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/generationState.test.ts`
Expected: FAIL — `Cannot find module '@/lib/generationState'`.

- [ ] **Step 3: Write the implementation**

Create `lib/generationState.ts`:

```ts
import type { Participant } from "@/lib/types";

/**
 * Generation state for one participant, derived purely from their doc — never
 * from a stored checkpoint list. `driveLink` (not `driveFileId`) is the
 * completeness signal: it is the field the Sheet sync, the public claim page,
 * and the "Missing Drive Link" filter chip all read.
 *
 *   no certificateId               -> "needs-cert"  (mint id, render, upload)
 *   certificateId, no driveLink     -> "needs-pdf"   (re-render SAME id, upload)
 *   certificateId + driveLink       -> "complete"
 */
export type ParticipantGenState = "needs-cert" | "needs-pdf" | "complete";

export function classifyParticipant(
  p: Pick<Participant, "certificateId" | "driveLink">
): ParticipantGenState {
  if (!p.certificateId || !p.certificateId.trim()) return "needs-cert";
  if (!p.driveLink || !p.driveLink.trim()) return "needs-pdf";
  return "complete";
}

export interface GenerationSummary {
  needsCert: number;
  needsPdf: number;
  complete: number;
  total: number;
}

export function deriveGenerationSummary(
  participants: Pick<Participant, "certificateId" | "driveLink">[]
): GenerationSummary {
  const summary: GenerationSummary = { needsCert: 0, needsPdf: 0, complete: 0, total: participants.length };
  for (const p of participants) {
    const state = classifyParticipant(p);
    if (state === "needs-cert") summary.needsCert++;
    else if (state === "needs-pdf") summary.needsPdf++;
    else summary.complete++;
  }
  return summary;
}

/** A `running` job doc older than this reads as `interrupted`. */
export const STALE_JOB_MS = 30 * 60 * 1000;

/**
 * The effective status of a generation-job doc. A run writes `status: "running"`
 * on start and deletes the doc on clean finish, so a `running` doc that is still
 * around after STALE_JOB_MS almost certainly belongs to a crashed/closed tab.
 */
export function jobEffectiveStatus(
  job: { status?: string; startedAt?: string },
  now: number = Date.now()
): "running" | "interrupted" {
  if (job.status === "interrupted") return "interrupted";
  const started = job.startedAt ? Date.parse(job.startedAt) : NaN;
  if (Number.isNaN(started)) return "interrupted";
  return now - started > STALE_JOB_MS ? "interrupted" : "running";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/generationState.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Full gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0. (`lib/generationResume.ts` and its test still exist and still pass — untouched this task.)

- [ ] **Step 6: Commit**

```bash
git add lib/generationState.ts tests/generationState.test.ts
git commit -m "$(cat <<'EOF'
feat(generation): derived generation-state module

Pure classifyParticipant / deriveGenerationSummary / jobEffectiveStatus —
replaces the stored completedParticipantIds ledger as the source of truth
for what a generation run still needs to do.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `/api/databases/public` — live participant counts

**Files:**
- Modify: `app/api/databases/public/route.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: same response shape (`{ databases: [...] }`), `participantCount` now computed live.

**Context:** `app/api/databases/route.ts:121-135` already does exactly this pattern (`.count().get()` per DB in `Promise.all`, per-DB catch → 0). Mirror it.

- [ ] **Step 1: Read the reference implementation**

Read `app/api/databases/route.ts:99-145` (the admin GET) — copy its `Promise.all` + `.count()` + per-DB `catch → 0` shape.

- [ ] **Step 2: Rewrite the route**

Replace the body of `GET` in `app/api/databases/public/route.ts` so it no longer reads `data.participantCount` and instead computes it:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { parseCategoryParam } from "@/lib/category";

// Public by design: powers the course cards on the verify page. Returns only a
// hand-picked subset of fields, and only for databases explicitly marked isLive.
export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const category = parseCategoryParam(new URL(request.url).searchParams.get("category"));
    let query = adminDb.collection("databases").where("isLive", "==", true);
    if (category) query = query.where("category", "==", category);
    const snap = await query.get();

    const live = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        let participantCount = 0;
        try {
          // Stored data.participantCount drifts; count the subcollection live.
          const countSnap = await adminDb
            .collection("databases")
            .doc(d.id)
            .collection("participants")
            .count()
            .get();
          participantCount = countSnap.data().count || 0;
        } catch {
          participantCount = 0; // per-DB failure must not fail the whole response
        }
        return {
          id: d.id,
          name: (data.name as string) || "",
          category: (data.category as string) || "",
          subCategory: (data.subCategory as string) || "",
          topic: (data.topic as string) || "",
          description: (data.description as string) || "",
          participantCount,
          createdAt: (data.createdAt as string) || "",
        };
      })
    );

    live.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ databases: live });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to fetch", details: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0.

- [ ] **Step 4: Manual reasoning check (no emulator)**

Confirm in the diff: (a) `data.participantCount` is no longer read anywhere in this file; (b) the `category` filter still applies before the count loop; (c) a thrown `.count()` yields `0` for that DB only, not a 500.

- [ ] **Step 5: Commit**

```bash
git add app/api/databases/public/route.ts
git commit -m "$(cat <<'EOF'
fix(public): compute live participant counts on the public databases route

Stop trusting the stored participantCount field (it drifts to 0); count
each live database's participants subcollection via .count() aggregation,
same pattern as the admin /api/databases route. Per-DB failure falls back
to 0 without failing the response.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `resolveDriveFileId` in `lib/driveCleanup.ts`

**Files:**
- Modify: `lib/driveCleanup.ts`
- Test: `tests/driveCleanup.test.ts`

**Interfaces:**
- Consumes: `fileIdFromLink` (already in this file), `Participant` from `@/lib/types`.
- Produces: `resolveDriveFileId(p: Pick<Participant, "driveFileId" | "driveLink">): string | null`

- [ ] **Step 1: Add the failing test**

Append to `tests/driveCleanup.test.ts`:

```ts
import { resolveDriveFileId } from "@/lib/driveCleanup";

describe("resolveDriveFileId", () => {
  it("prefers the stored driveFileId over the link", () => {
    expect(
      resolveDriveFileId({ driveFileId: "STORED_ID", driveLink: "https://drive.google.com/file/d/LINK_ID/view" })
    ).toBe("STORED_ID");
  });

  it("falls back to parsing the /file/d/<id>/view link", () => {
    expect(
      resolveDriveFileId({ driveLink: "https://drive.google.com/file/d/1Abc-DEF_ghi/view?usp=drivesdk" })
    ).toBe("1Abc-DEF_ghi");
  });

  it("falls back to parsing the ?id=<id> link", () => {
    expect(
      resolveDriveFileId({ driveLink: "https://drive.google.com/uc?id=1Abc-DEF_ghi&export=download" })
    ).toBe("1Abc-DEF_ghi");
  });

  it("returns null when there is nothing usable", () => {
    expect(resolveDriveFileId({})).toBeNull();
    expect(resolveDriveFileId({ driveFileId: "", driveLink: "" })).toBeNull();
    expect(resolveDriveFileId({ driveLink: "https://drive.google.com/drive/folders/1Xyz" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/driveCleanup.test.ts`
Expected: FAIL — `resolveDriveFileId` is not exported.

- [ ] **Step 3: Implement**

Add to `lib/driveCleanup.ts` (below `fileIdFromLink`), and add the `Participant` type import at the top (`import type { Participant } from "@/lib/types";`):

```ts
/**
 * The Drive file id for a participant's certificate PDF: the stored id if we
 * have it, otherwise parsed out of the stored share link, otherwise null.
 * Use this everywhere a delete needs a file id — a participant can carry a
 * `driveLink` with no `driveFileId` (older records, or a partial write).
 */
export function resolveDriveFileId(
  p: Pick<Participant, "driveFileId" | "driveLink">
): string | null {
  if (p.driveFileId && p.driveFileId.trim()) return p.driveFileId.trim();
  return fileIdFromLink(p.driveLink);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/driveCleanup.test.ts`
Expected: PASS (old `fileIdFromLink` cases + new `resolveDriveFileId` cases).

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/driveCleanup.ts tests/driveCleanup.test.ts
git commit -m "$(cat <<'EOF'
feat(drive): resolveDriveFileId helper (stored id or parsed from link)

A participant can have a driveLink but no driveFileId; delete paths that
only checked driveFileId left the Drive file orphaned. One helper, unit
tested, for every such call site.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: apps-script `deleteRows` (+ retire the two unused delete helpers)

**Files:**
- Modify: `apps-script.js`

**Interfaces:**
- Produces (Apps Script action): `deleteRows({ spreadsheetId, tabName, matches })` where
  `matches: Array<{ certificateId?: string; name?: string; email?: string }>` → `{ success: true, deletedRows: number }`.

**Context:** `deleteRowsByCertIds` (`apps-script.js:365`) and `deleteRowsByEmail` (`:650`) have **zero callers** anywhere in the app (grep `deleteRowsByCertIds|deleteRowsByEmail` across the repo → only `apps-script.js` + the stale `graphify-out/graph.json`). They are superseded by `deleteRows`. `clearCertIdsByEmail` (`:682`) **stays** — it is used by the cert-only delete path (`lib/certCascade.ts:79`) where the Sheet row must survive.

Sheet column layout (from `syncData` / `upsertRow` in `apps-script.js`): col A = certificateId, col B = name, col C = email. Row 1 is the header. Confirm this against the current `syncData` write block before implementing.

- [ ] **Step 1: Confirm the column layout**

Read `apps-script.js` `syncData` (around `:300-360`) and `upsertRow`. Note the 0-indexed positions of `certificateId`, `name`, `email` in a written row. The rest of this task assumes A/B/C (0,1,2) — adjust the indices in Step 2 if the code says otherwise and record the real layout in the hand-trace (Step 4).

- [ ] **Step 2: Add `deleteRows`, remove the two dead helpers**

In `apps-script.js`:

1. Delete the whole `function deleteRowsByCertIds(payload) { ... }` block and the whole `function deleteRowsByEmail(payload) { ... }` block.
2. In `doPost`'s `switch (action)`, delete the `case "deleteRowsByCertIds":` and `case "deleteRowsByEmail":` clauses (2 lines each including `break;` / `result = ...`).
3. Add a `case "deleteRows":` clause next to the other row-mutation cases:

```js
      case "deleteRows":
        result = deleteRows(payload);
        break;
```

4. Add the function (place it near `clearCertIdsByEmail`):

```js
/**
 * Delete Sheet rows matching a list of participant identifiers.
 *
 * matches: [{ certificateId?, name?, email? }, ...]
 *   - certificateId present -> delete the row whose col A === certificateId exactly
 *   - else                  -> delete the row whose Name (col B) AND Email (col C)
 *                              both match, case-insensitive and trimmed
 * Header row (row 1) is never touched. A match with no hit is a silent no-op.
 * All target rows are collected first, then deleted bottom-up in one pass.
 */
function deleteRows(payload) {
  var spreadsheetId = payload.spreadsheetId;
  var tabName = payload.tabName;
  var matches = payload.matches || [];
  if (!spreadsheetId || !tabName) throw new Error("spreadsheetId and tabName are required");
  if (matches.length === 0) return { success: true, deletedRows: 0 };

  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(tabName);
  if (!sheet) throw new Error("Sheet tab not found: " + tabName);

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, deletedRows: 0 };

  var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues(); // cols A,B,C for data rows

  var norm = function (v) { return String(v == null ? "" : v).trim().toLowerCase(); };
  var certIds = {};
  var nameEmail = {};
  for (var m = 0; m < matches.length; m++) {
    var match = matches[m];
    if (match.certificateId) {
      certIds[String(match.certificateId)] = true;
    } else if (match.name || match.email) {
      nameEmail[norm(match.name) + " " + norm(match.email)] = true;
    }
  }

  var rowsToDelete = [];
  for (var i = values.length - 1; i >= 0; i--) {
    var rowCertId = String(values[i][0]);
    var key = norm(values[i][1]) + " " + norm(values[i][2]);
    if (certIds[rowCertId] === true || nameEmail[key] === true) {
      rowsToDelete.push(i + 2); // +2: 1-indexed + skip header
    }
  }

  for (var r = 0; r < rowsToDelete.length; r++) {
    sheet.deleteRow(rowsToDelete[r]);
  }
  return { success: true, deletedRows: rowsToDelete.length };
}
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0. (`apps-script.js` is not compiled — this only confirms nothing in TS referenced the removed functions. Grep once more: `grep -rn "deleteRowsByCertIds\|deleteRowsByEmail" app lib components` → no hits.)

- [ ] **Step 4: Write the hand-trace into this plan**

Append a `### Task 4 hand-trace` block to the "Apps Script hand-traces" section at the bottom of this file. Trace at least: (a) 3 matches, one by certId that hits row 5, one by name+email that hits row 2, one that hits nothing — assert `deletedRows === 2` and that rows are deleted in order [5, 2] (bottom-up, so index 5 first); (b) empty `matches` → `{ deletedRows: 0 }` with no `openById` call past the guard; (c) a sheet with only a header row → `{ deletedRows: 0 }`.

- [ ] **Step 5: Commit**

```bash
git add apps-script.js docs/superpowers/plans/2026-08-29-plan-e1-generation-drive-reliability.md
git commit -m "$(cat <<'EOF'
feat(apps-script): deleteRows — match by cert id or name+email

Delete Sheet rows for deleted participants (cert-id exact, else
name+email case-insensitive), bottom-up, header untouched. Retires the
unused deleteRowsByCertIds / deleteRowsByEmail helpers. clearCertIdsByEmail
stays for the cert-only path where the row must survive.

Requires an Apps Script web-app redeploy before the delete routes use it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: apps-script `uploadPDF` folderId + `consolidateFolders`

**Files:**
- Modify: `apps-script.js`

**Interfaces:**
- Produces (Apps Script actions):
  - `uploadPDF({ pdfData, fileName, databaseName, folderId? })` — `folderId` present → `DriveApp.getFolderById(folderId)`, no lookup/create; absent → existing `getOrCreateFolder(databaseName)` fallback. Return shape unchanged (still includes `folderId`).
  - `consolidateFolders({ folderName, canonicalFolderId })` → `{ success: true, movedFiles: number, trashedFolders: number }`.

- [ ] **Step 1: `uploadPDF` takes `folderId`**

In `apps-script.js` `function uploadPDF(payload)` (`:430`), change the folder resolution:

```js
function uploadPDF(payload) {
  var pdfData = payload.pdfData;
  var fileName = payload.fileName;
  var databaseName = payload.databaseName;
  var folderId = payload.folderId;

  // folderId (resolved once per run by the caller) avoids the check-then-act
  // race in getOrCreateFolder under 5 concurrent uploads. Fall back to a
  // name lookup only when the caller couldn't supply an id (first upload).
  var folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    folder = getOrCreateFolder(databaseName);
  }

  var pdfBlob = Utilities.newBlob(Utilities.base64Decode(pdfData), "application/pdf", fileName);
  var file = folder.createFile(pdfBlob);
  var fileShared = shareBestEffort(file);

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
}
```

(Keep `spreadsheetId` out — the current signature destructures it but never uses it; dropping it is fine, or leave it, but do not add new behavior around it.)

- [ ] **Step 2: Add `consolidateFolders`**

Add near `getOrCreateFolder`:

```js
/**
 * Merge duplicate per-database folders into one canonical folder.
 *
 * Finds every folder named `folderName` directly under the parent
 * (DRIVE_FOLDER_ID if resolvable, else the folder named DRIVE_FOLDER_NAME).
 * For each such folder whose id !== canonicalFolderId: move all its files into
 * the canonical folder, then trash the now-empty duplicate. The canonical
 * folder itself and any folder with a different name are never touched.
 */
function consolidateFolders(payload) {
  var folderName = payload.folderName;
  var canonicalFolderId = payload.canonicalFolderId;
  if (!folderName || !canonicalFolderId) throw new Error("folderName and canonicalFolderId are required");

  var parent;
  if (DRIVE_FOLDER_ID) {
    try { parent = DriveApp.getFolderById(DRIVE_FOLDER_ID); } catch (e) { parent = null; }
  }
  if (!parent) {
    var byName = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    if (!byName.hasNext()) throw new Error("Parent folder not found");
    parent = byName.next();
  }

  var canonical = DriveApp.getFolderById(canonicalFolderId);
  var movedFiles = 0;
  var trashedFolders = 0;

  var dupes = parent.getFoldersByName(folderName);
  while (dupes.hasNext()) {
    var dupe = dupes.next();
    if (dupe.getId() === canonicalFolderId) continue;

    var files = dupe.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      f.moveTo(canonical); // Drive v3 move; keeps the same file id
      movedFiles++;
    }
    dupe.setTrashed(true);
    trashedFolders++;
  }

  return { success: true, movedFiles: movedFiles, trashedFolders: trashedFolders };
}
```

> **Note on `moveTo`:** `File.moveTo(folder)` is the current DriveApp move API. If the Apps Script runtime the user is on predates it, the fallback is `canonical.addFile(f); dupe.removeFile(f);`. Record which one you shipped in the hand-trace.

- [ ] **Step 3: Wire the `case`**

In `doPost`'s `switch`, add:

```js
      case "consolidateFolders":
        result = consolidateFolders(payload);
        break;
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0.

- [ ] **Step 5: Hand-trace into this plan**

Append `### Task 5 hand-trace`: (a) `uploadPDF` with `folderId` set → asserts `getFolderById` is called and `getOrCreateFolder` is not; without `folderId` → the reverse. (b) `consolidateFolders` with a parent holding folders `["Course A" (canonical, 2 files), "Course A" (dupe1, 3 files), "Course A" (dupe2, 0 files), "Course B" (1 file)]` and `canonicalFolderId` = the first → assert `movedFiles === 3`, `trashedFolders === 2`, "Course B" untouched, canonical now has 5 files. (c) `canonicalFolderId` pointing at a folder that no longer exists → `getFolderById` throws → the whole call throws (acceptable — the route surfaces it as a 500 + toast).

- [ ] **Step 6: Commit**

```bash
git add apps-script.js docs/superpowers/plans/2026-08-29-plan-e1-generation-drive-reliability.md
git commit -m "$(cat <<'EOF'
feat(apps-script): uploadPDF folderId + consolidateFolders

uploadPDF uses a caller-supplied folderId directly (no name lookup) to
kill the concurrent getOrCreateFolder race; name lookup stays as the
first-upload fallback. consolidateFolders merges duplicate per-database
folders into the canonical one and trashes the empties.

Requires an Apps Script web-app redeploy.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/api/drive-upload` — forward `folderId`

**Files:**
- Modify: `app/api/drive-upload/route.ts`

**Interfaces:**
- Consumes: request body now optionally carries `folderId: string`.
- Produces: passes `folderId` through to the Apps Script `uploadPDF` payload. Response shape unchanged.

- [ ] **Step 1: Thread `folderId` through**

In `app/api/drive-upload/route.ts` `POST`, change the destructure and the `callAppsScript` payload:

```ts
    const { pdfBytes, fileName, databaseName, folderId } = await request.json();

    if (!pdfBytes || !fileName) {
      return NextResponse.json({ error: "Missing pdfBytes or fileName" }, { status: 400 });
    }

    const base64Data =
      typeof pdfBytes === "string" ? pdfBytes : Buffer.from(pdfBytes).toString("base64");

    const result = await callAppsScript("uploadPDF", {
      pdfData: base64Data,
      fileName,
      databaseName: databaseName || "Certificates",
      ...(folderId ? { folderId } : {}),
    });
```

- [ ] **Step 2: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/drive-upload/route.ts
git commit -m "$(cat <<'EOF'
feat(drive-upload): forward optional folderId to the Apps Script bridge

Lets the generator pin every upload in a run to one resolved folder id.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `/api/drive/consolidate` route

**Files:**
- Create: `app/api/drive/consolidate/route.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/requireAdmin`), `callAppsScript` + `appsScriptConfigured` (`@/lib/appsScript`), `getAdminDb` (`@/lib/firebase.admin`).
- Produces: `POST { databaseId: string }` → `200 { success: true, movedFiles: number, trashedFolders: number }` | `400` (no `driveFolderId`) | `404` (no such DB) | `500`.

- [ ] **Step 1: Write the route**

Create `app/api/drive/consolidate/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

// Merge any duplicate Drive folders for a database into its canonical
// driveFolderId. Refuses if the database has no canonical folder id yet —
// there is no safe target to consolidate into.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { databaseId } = await request.json();
    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }
    if (!appsScriptConfigured()) {
      return NextResponse.json({ error: "Apps Script not configured" }, { status: 500 });
    }

    const snap = await getAdminDb().collection("databases").doc(databaseId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }
    const data = snap.data() || {};
    if (!data.driveFolderId) {
      return NextResponse.json(
        { error: "This database has no canonical Drive folder yet — generate certificates first." },
        { status: 400 }
      );
    }

    const result = await callAppsScript<{
      success?: boolean;
      movedFiles?: number;
      trashedFolders?: number;
      error?: string;
    }>("consolidateFolders", {
      folderName: data.name || "",
      canonicalFolderId: data.driveFolderId,
    });

    if (!result?.success) {
      return NextResponse.json(
        { error: "Consolidation failed", details: result?.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      movedFiles: result.movedFiles || 0,
      trashedFolders: result.trashedFolders || 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Consolidation failed", details: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the route registers**

Run: `npm run build`
Expected: exit 0, and `/api/drive/consolidate` appears in the route list of the build output.

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit` · `npx vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/api/drive/consolidate/route.ts
git commit -m "$(cat <<'EOF'
feat(drive): POST /api/drive/consolidate

Resolves a database's name + canonical driveFolderId and asks the bridge
to merge duplicate folders into it. Refuses (400) when there is no
canonical folder id yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Delete cascades — `deleteRows` + `resolveDriveFileId` in the participant routes

**Files:**
- Modify: `app/api/participants/[id]/route.ts`
- Modify: `app/api/participants/bulk-delete/route.ts`

**Interfaces:**
- Consumes: `resolveDriveFileId` (`@/lib/driveCleanup`, Task 3), Apps Script `deleteRows` (Task 4).
- Produces: no response-shape change.

**Context:** `deleteRows` on the Sheet is only correct once the Apps Script redeploy has happened (Section 11). Until then these calls are best-effort and swallow their errors — same as the `clearCertIdsByEmail` calls they replace — so shipping the code ahead of the redeploy is safe (the Sheet row just isn't removed yet).

- [ ] **Step 1: `app/api/participants/[id]/route.ts` DELETE**

- Change the import: `import { deleteDriveFile, resolveDriveFileId } from "@/lib/driveCleanup";` (drop `fileIdFromLink`).
- Replace the participant-own-file block (`:110-114`):

```ts
    if (!keepPdf && !(participantData?.certificateId && !keepCert)) {
      const fileId = resolveDriveFileId(participantData || {});
      if (fileId) await deleteDriveFile(fileId);
    }
```

- Replace the Sheet clear block (`:118-130`) — delete the row instead of clearing col A:

```ts
    // Remove the participant's Sheet row entirely (cert id if we have one, else
    // name+email). Best-effort — a redeploy of apps-script.js enables deleteRows.
    if (appsScriptConfigured()) {
      try {
        const sheet = await getSheetInfo(databaseId);
        if (sheet && participantData) {
          const match = participantData.certificateId
            ? { certificateId: participantData.certificateId }
            : { name: participantData.name || "", email: participantData.email || "" };
          await callAppsScript("deleteRows", { ...sheet, matches: [match] });
        }
      } catch (syncErr) {
        console.error("Sheet row delete failed after participant deletion:", syncErr);
      }
    }
```

- Update the stale comment above the block if present.

- [ ] **Step 2: `app/api/participants/bulk-delete/route.ts`**

- Change the import: `import { deleteDriveFile, resolveDriveFileId } from "@/lib/driveCleanup";` (drop `fileIdFromLink`).
- In `handleOne`, replace `:62`:

```ts
        if (deletePdfs && !(data?.certificateId && deleteCerts)) {
          const fileId = resolveDriveFileId(data || {});
          if (fileId && (await deleteDriveFile(fileId))) res.driveFiles++;
        }
```

- Collect match objects alongside `deletedEmails`. Add near the other accumulators:

```ts
    const rowMatches: Array<{ certificateId?: string; name?: string; email?: string }> = [];
```

  and inside `handleOne`, after `await col.doc(pid).delete(); res.deleted++;`:

```ts
        if (data?.certificateId) rowMatches.push({ certificateId: data.certificateId });
        else if (data?.name || data?.email) rowMatches.push({ name: data?.name || "", email: data?.email || "" });
```

  (Push to a shared array from within `Promise.all` map callbacks is safe here — single-threaded, order doesn't matter for a match set.)

- Replace the final batched sheet-clear block (`:86-94`) with a single `deleteRows`:

```ts
    // One batched Sheet row delete for every participant removed above.
    if (rowMatches.length > 0 && dbData.sheetId && appsScriptConfigured()) {
      await callAppsScript("deleteRows", {
        spreadsheetId: dbData.sheetId,
        tabName: dbData.sheetTabName || "Participants",
        matches: rowMatches,
      }).catch((e) => console.error("Bulk-delete sheet row delete failed:", e));
    }
```

  `deletedEmails` is now unused — remove its declaration and its `deletedEmails.push(data.email)` line.

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0. `npx vitest run tests/certCascade.test.ts` — still green (that path is unchanged; it still uses `clearCertIdsByEmail`).

- [ ] **Step 4: Manual reasoning check**

Confirm in the diff: (a) `lib/certCascade.ts` is **not** touched — the cert-only delete path still clears col A and keeps the row; (b) both participant routes now call `deleteRows`, not `clearCertIdsByEmail`; (c) `resolveDriveFileId` is used for every participant-own-file delete; (d) `app/api/databases/route.ts` DELETE (whole-database delete) still uses `clearCertIdsByEmail` — leave it, deleting the whole Sheet's rows on DB-delete is a separate call the spec didn't ask for.

- [ ] **Step 5: Commit**

```bash
git add app/api/participants/[id]/route.ts app/api/participants/bulk-delete/route.ts
git commit -m "$(cat <<'EOF'
feat(participants): delete Sheet rows on participant delete; resolve orphan PDFs

DELETE and bulk-delete now call deleteRows (match by cert id, else
name+email) instead of only clearing col A, and use resolveDriveFileId so
a participant with a driveLink but no stored driveFileId still gets its
Drive file trashed. Cert-only deletion is unchanged (row must survive).

Sheet row removal is live only after the apps-script.js redeploy.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: "Consolidate folders" UI action

**Files:**
- Modify: `components/admin/databases/useDatabaseManager.ts`
- Modify: `components/admin/databases/DatabaseDetail.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
- Consumes: `POST /api/drive/consolidate` (Task 7).
- Produces: `handleConsolidateFolders: () => Promise<void>` from `useDatabaseManager`, passed to `DatabaseDetail` as `onConsolidateFolders?`.

- [ ] **Step 1: Hook action**

In `useDatabaseManager.ts`, next to the existing Drive-folder action (`~:1010-1056`, the `/api/databases/drive-folder` fetch), add:

```ts
  const handleConsolidateFolders = async () => {
    if (!selectedDatabase?.id) return;
    if (!(selectedDatabase as Database).driveFolderId) {
      toast.warning("Generate certificates first — there's no main Drive folder to consolidate into yet.");
      return;
    }
    try {
      const res = await fetch("/api/drive/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseId: selectedDatabase.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          data.movedFiles || data.trashedFolders
            ? `Moved ${data.movedFiles} file(s), removed ${data.trashedFolders} duplicate folder(s).`
            : "No duplicate folders found — nothing to consolidate."
        );
      } else {
        toast.error(data.error || "Could not consolidate folders.");
      }
    } catch {
      toast.error("Could not reach the consolidation service.");
    }
  };
```

Add `handleConsolidateFolders` to the hook's return object (near `resumeGeneration` / the other Drive actions).

- [ ] **Step 2: `DatabaseDetail` button**

- Add `onConsolidateFolders?: () => void;` to `DatabaseDetailProps` and the destructure.
- In the Drive action group (find the existing "Fix folder sharing" button), add next to it:

```tsx
{onConsolidateFolders && (
  <button
    onClick={onConsolidateFolders}
    disabled={!(database as { driveFolderId?: string }).driveFolderId}
    className="/* copy the sibling 'Fix folder sharing' button's classes verbatim */"
    title="Merge duplicate Drive folders for this database into one"
  >
    <span className="material-symbols-outlined text-sm">folder_managed</span>
    Consolidate folders
  </button>
)}
```

Match the exact class list and markup shape of the adjacent button — do not invent a new style.

- [ ] **Step 3: `DatabaseManager` wiring**

Where `DatabaseDetail` is rendered (`~:365-373`), pass `onConsolidateFolders={handleConsolidateFolders}` and add `handleConsolidateFolders` to the destructure from `useDatabaseManager()` at the top of the component.

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/admin/databases/useDatabaseManager.ts components/admin/databases/DatabaseDetail.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "$(cat <<'EOF'
feat(admin): Consolidate folders action in the database detail view

Button next to "Fix folder sharing", gated on driveFolderId, calls
POST /api/drive/consolidate and reports moved files / trashed folders.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `CertificateGenerator` — derived run set, bare job marker, error propagation

**Files:**
- Modify: `components/CertificateGenerator.tsx`

**Interfaces:**
- Consumes: `classifyParticipant`, `deriveGenerationSummary` (`@/lib/generationState`, Task 1); `POST /api/databases/drive-folder` (existing — resolves + persists `driveFolderId`); `folderId` on `POST /api/drive-upload` (Task 6).
- Produces: no prop-signature change (`{ database, participants, onGenerated, resumeMode }`). Job doc it writes is now `{ templateId, startedAt, status: "running" }`.

This is the largest task. Work through the edits in order; gate once at the end.

### 10a — imports and the run-set model

- [ ] **Step 1:** Replace the import on line 23:

```ts
import { classifyParticipant, deriveGenerationSummary } from "@/lib/generationState";
```

Keep `import type { GenerationJob } from "@/lib/types";` for now (Task 12 slims the type).

- [ ] **Step 2:** Add a derived summary near the top of the component body (after `const participantsWithExistingPDFs = ...`, ~`:481`):

```ts
  const summary = deriveGenerationSummary(participants);
  // Default target: everything not already complete. Checkbox adds the complete set.
  const [regenerateComplete, setRegenerateComplete] = useState(false);
```

Remove `const [filterNewOnly, setFilterNewOnly] = useState(false);` (`:478`) and `const [showExistingWarning, setShowExistingWarning] = useState(false);` / `const [existingCertCount, setExistingCertCount] = useState(0);` (`:476-477`).

### 10b — `generateCertificates` / `startGeneration`

- [ ] **Step 3:** Collapse `generateCertificates` into a direct call. Replace (`:506-516`):

```ts
  const startGeneration = async () => {
    setIsGenerating(true);
```

...and delete the old `generateCertificates` function entirely. Update the picker's Generate button `onClick` (Step 12) to call `startGeneration`.

- [ ] **Step 4:** Replace the participant-sorting + `participantsToGenerate` block (`:523-539`) with the derived run set:

```ts
    const sortedParticipants = [...participants].sort((a, b) => {
      if (a.certificateId && b.certificateId) {
        const aNum = parseInt(a.certificateId.split("-").pop() || "0");
        const bNum = parseInt(b.certificateId.split("-").pop() || "0");
        return aNum - bNum;
      }
      return 0;
    });

    // Derived run set: needs-cert ∪ needs-pdf, plus complete only if asked.
    const runList = sortedParticipants.filter((p) => {
      const state = classifyParticipant(p);
      return state !== "complete" || regenerateComplete;
    });
    // Which of those get a brand-new cert id (and a new certificates doc).
    const needsCertIds = new Set(
      sortedParticipants.filter((p) => classifyParticipant(p) === "needs-cert" && p.id).map((p) => p.id as string)
    );

    if (runList.length === 0) {
      toast.info("Nothing to generate — every participant already has a certificate and a PDF.");
      return;
    }
```

Then rename every later use of `participantsToGenerate` in this function to `runList`.

- [ ] **Step 5:** Replace the job-doc plumbing (`:536-561`). Delete `let jobTotal = ...`, `const completedIds: string[] = [];`, and the entire `checkpoint` helper. Replace with:

```ts
    const jobUrl = `/api/generation-jobs/${database.id}`;
    let effectiveTemplate = selectedTemplate;

    // Bare run marker — written once on start, deleted on clean finish, left in
    // place on any throw (it reads "interrupted" once stale). No progress ledger.
    const markRunning = async (templateId: string) => {
      try {
        await fetch(jobUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, startedAt: new Date().toISOString(), status: "running" }),
        });
      } catch { /* non-fatal */ }
    };
```

- [ ] **Step 6:** Replace the `resumeMode` block (`:564-606`). Resume no longer filters a remainder (the derived `runList` *is* the remainder) — it only locks the template:

```ts
      if (resumeMode) {
        let job: GenerationJob | undefined;
        try {
          const jr = await fetch(jobUrl);
          if (jr.ok) job = (await jr.json()).job;
        } catch { /* fall through to the picked template */ }

        const originalTemplate = job?.templateId;
        if (
          originalTemplate &&
          (["standard", "modern"].includes(originalTemplate) ||
            uploadedTemplates.some((t) => t.id === originalTemplate))
        ) {
          effectiveTemplate = originalTemplate;
          if (originalTemplate !== selectedTemplate) {
            const name = uploadedTemplates.find((t) => t.id === originalTemplate)?.name || "Standard";
            toast.info(`Resuming with the original run's template (${name}).`);
          }
        } else if (originalTemplate) {
          toast.warning("The original run's template is no longer available — using your current selection.");
        }
      }

      await markRunning(effectiveTemplate);
```

### 10c — render / write phases

- [ ] **Step 7:** In the Phase-1/2 chunk loop, change `certDocs` so a doc is created **only** for `needs-cert` participants (re-rendering a `needs-pdf`/`complete` participant must not mint a second `certificates` doc). At `:754`:

```ts
          const certDocs = fresh
            .filter(({ participant }) => participant.id && needsCertIds.has(participant.id))
            .map(({ participant, certId, verificationUrl }) => ({
              uniqueCertId: certId,
              recipientName: participant.name,
              recipientEmail: participant.email || "",
              category: database.category,
              subCategory: database.subCategory,
              topic: database.topic,
              certType: database.topic || database.subCategory,
              issueDate,
              status: "generated",
              verificationUrl,
              databaseId: database.id,
              participantId: participant.id,
              createdAt: new Date().toISOString(),
            }));
```

- [ ] **Step 8:** Remove the `completedIds` checkpoint after the chunk write (`:790-800`). Keep the `if (!buRes.ok) throw` — reword the message (no `jobTotal`/`completedIds`):

```ts
          if (!buRes.ok) {
            throw new Error(`Chunk write failed (HTTP ${buRes.status}) — run interrupted, reopen to resume.`);
          }
          // no checkpoint — resume derives the remainder from participant docs
```

Delete the `await checkpoint("rendering")` call that followed. Delete the earlier `await checkpoint("rendering")` at `:677` and `await checkpoint("drive-upload")` at `:809` and `await checkpoint("sheet-sync")` at `:910`.

### 10d — canonical folder id (spec §5.1)

- [ ] **Step 9:** Just before the Phase-3 concurrent loop (`:808`, inside `if (database.linkedSheet)`), resolve the folder once:

```ts
        // Resolve ONE canonical Drive folder id before firing concurrent uploads
        // so Apps Script never creates a folder by name under a race.
        let runFolderId: string | undefined = database.driveFolderId || undefined;
        if (!runFolderId) {
          try {
            const fr = await fetch("/api/databases/drive-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ databaseId: database.id, databaseName: database.name }),
            });
            if (fr.ok) runFolderId = (await fr.json()).folderId || undefined;
          } catch { /* fall back to per-upload name lookup */ }
        }
```

- [ ] **Step 10:** In the upload `fetch("/api/drive-upload", ...)` body (`:833`), add `folderId`:

```ts
                  body: JSON.stringify({
                    pdfBytes: base64Data,
                    fileName: driveFileName,
                    databaseName: database.name,
                    ...(runFolderId ? { folderId: runFolderId } : {}),
                  }),
```

The existing "first upload persists `data.folderId` to the DB doc" block (`:837-848`) can stay as-is (harmless when `runFolderId` was already set — it just re-writes the same id); or guard it with `if (!runFolderId && !driveFolderUpdated && data.folderId)`. Prefer the guard.

### 10e — error propagation (spec §6.1 / §6.2)

- [ ] **Step 11:** Phase-3 `driveSucceeded` batch-update (`:874-882`) — check `.ok` and throw:

```ts
          const buRes2 = await fetch("/api/participants/batch-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              databaseId: database.id,
              updates: driveSucceeded.map((r) => ({ id: r.participantId, driveLink: r.driveLink, driveFileId: r.driveFileId })),
              skipSheetSync: true,
            }),
          });
          if (!buRes2.ok) {
            throw new Error(`Drive-link write failed (HTTP ${buRes2.status}) — run interrupted, reopen to resume.`);
          }
```

  Cert-doc PATCH loop (`:886-896`) — count failures instead of swallowing:

```ts
          let certPatchFailures = 0;
          const PATCH_CONCURRENCY = 20;
          for (let i = 0; i < driveSucceeded.length; i += PATCH_CONCURRENCY) {
            await Promise.all(
              driveSucceeded.slice(i, i + PATCH_CONCURRENCY).map((r) =>
                fetch("/api/certificates", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ uniqueCertId: r.certId, driveLink: r.driveLink, driveFileId: r.driveLink, pdfUrl: r.driveLink }),
                })
                  .then((res) => { if (!res.ok) certPatchFailures++; })
                  .catch(() => { certPatchFailures++; })
              )
            );
          }
          if (certPatchFailures > 0) {
            toast.warning(`${certPatchFailures} certificate record(s) couldn't be updated with their Drive link. Re-run generation to retry.`);
          }
```

  (Keep `driveFileId: r.driveFileId` — the snippet above has a typo; use `r.driveFileId`.)

### 10f — finish, no partial-coverage toast

- [ ] **Step 12:** Replace the `fullyCovered` block (`:921-931`). Clean finish = every targeted participant now classifies `complete`. Re-fetch the fresh participant docs (the run just wrote them) and check:

```ts
      setGenerationProgress(100);

      // Clean finish = nothing in this run's scope still needs work. Re-derive
      // from fresh docs rather than trusting an in-memory tally.
      let cleanFinish = driveFailed.length === 0;
      try {
        const fresh = await fetch(`/api/participants?databaseId=${database.id}`);
        if (fresh.ok) {
          const data = await fresh.json();
          const byId = new Map<string, { certificateId?: string; driveLink?: string }>(
            (data.participants || []).filter((p: { id?: string }) => p.id).map((p: { id: string }) => [p.id, p])
          );
          cleanFinish = runList.every((p) => {
            const doc = p.id ? byId.get(p.id) : undefined;
            return doc ? classifyParticipant(doc) === "complete" : false;
          });
        }
      } catch { /* keep the driveFailed-based guess */ }

      if (cleanFinish) {
        await fetch(jobUrl, { method: "DELETE" }).catch(() => {});
      }
      // else: leave the job doc — it reads "interrupted" once stale and the
      // derived badge already reflects what's left.
```

Delete the old `toast.warning(`${completedIds.length} of ${jobTotal} done ...`)` line and the `else { await checkpoint(...) }` branch.

- [ ] **Step 13:** In the `catch (err)` (`:979-987`), drop the `completedIds`/`jobTotal` reference:

```ts
    } catch (err) {
      console.error("Error generating certificates:", err);
      sfx.error();
      toast.error("Generation interrupted — reopen this database to resume the rest. " + (err as Error).message);
    } finally {
```

- [ ] **Step 14:** Delete the trailing `if (resumeMode && database.linkedSheet)` "missing Drive link" nudge block (`:949-969`) — the derived badge/banner now covers this permanently, and it referenced `completedIds`.

### 10g — picker UI

- [ ] **Step 15:** Delete the whole `if (showExistingWarning)` render block (`:1053-1108`).

- [ ] **Step 16:** In the `if (showTemplateSelect)` block, replace the sub-header line and the summary grid so it shows the derived breakdown, and add the checkbox above the Generate button. Around `:1216-1218`:

```tsx
            <p className="text-sm text-on-surface-variant">
              {summary.needsCert} need a cert ID · {summary.needsPdf} have an ID, no PDF · {summary.complete} complete
            </p>
```

Above the Generate button (`:1357`):

```tsx
        {summary.complete > 0 && (
          <label className="flex items-center gap-2 text-sm text-on-surface-variant mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={regenerateComplete}
              onChange={(e) => setRegenerateComplete(e.target.checked)}
            />
            Regenerate the {summary.complete} complete certificate{summary.complete !== 1 ? "s" : ""} too
          </label>
        )}
```

Change the Generate button (`:1357-1364`):

```tsx
        <button
          onClick={startGeneration}
          disabled={isGenerating || participants.length === 0}
          className="w-full py-4 vivid-gradient-cta text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined">auto_awesome</span>
          {(() => {
            const target = summary.needsCert + summary.needsPdf + (regenerateComplete ? summary.complete : 0);
            return `Generate ${target} certificate${target !== 1 ? "s" : ""}`;
          })()}
        </button>
```

### 10h — resume auto-start (spec §4.4)

- [ ] **Step 17:** Add an effect that auto-starts a resumed run once templates have loaded:

```ts
  useEffect(() => {
    if (!resumeMode || loadingTemplates || isGenerating || showDownload) return;
    // Resume skips the picker: startGeneration re-locks to job.templateId itself.
    void startGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeMode, loadingTemplates]);
```

Place it after the `fetchTemplates` effect. `startGeneration` is defined below it in source but hoisting via `function`/closure is fine because the effect runs after mount — if the linter/TS complains about use-before-define, wrap the call in `setTimeout(() => void startGeneration(), 0)` or move the effect below `startGeneration`'s definition.

### 10i — gate

- [ ] **Step 18:** Search the file for leftovers: `grep -n "completedIds\|jobTotal\|checkpoint\|filterNewOnly\|showExistingWarning\|remainingToGenerate\|participantsToGenerate" components/CertificateGenerator.tsx` — expect **zero** hits.

- [ ] **Step 19:** Full gate:

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0. `lib/generationResume.ts` + its test still exist and still pass (removed in Task 12).

- [ ] **Step 20:** Commit

```bash
git add components/CertificateGenerator.tsx
git commit -m "$(cat <<'EOF'
feat(generator): derived run set, bare job marker, loud persistence failures

- Run set is needs-cert ∪ needs-pdf (∪ complete via checkbox), derived
  from participant docs — no more completedParticipantIds ledger.
- needs-pdf/complete re-render the SAME cert id and never mint a 2nd
  certificates doc.
- generationJobs doc is now {templateId, startedAt, status:"running"};
  written on start, deleted on clean finish, left on throw.
- Phase-3 driveLink batch-update now throws on !ok (was silent); cert-doc
  PATCH failures are counted and surfaced in a toast.
- One canonical Drive folder id resolved before the concurrent upload loop
  and passed to every uploadPDF.
- Resume skips the picker and auto-starts on job.templateId.
- Drops the "N of M done" partial-coverage toast and the OOS-1 latent
  fullyCovered miscount (that code path is gone).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `GenerationResumeBanner` + banner wiring — render from derived summary

**Files:**
- Modify: `components/admin/databases/GenerationResumeBanner.tsx`
- Modify: `components/admin/databases/DatabaseDetail.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`
- Modify: `components/admin/databases/useDatabaseManager.ts`

**Interfaces:**
- Consumes: `GenerationSummary` + `jobEffectiveStatus` (`@/lib/generationState`), `deriveGenerationSummary` over `participants` in the hook.
- Produces: `GenerationResumeBanner` props become `{ status: "running" | "interrupted"; summary: GenerationSummary; onResume: () => void; onDismiss: () => void }`.

- [ ] **Step 1: Rewrite `GenerationResumeBanner.tsx`**

```tsx
"use client";

import type { GenerationSummary } from "@/lib/generationState";

interface GenerationResumeBannerProps {
  status: "running" | "interrupted";
  summary: GenerationSummary;
  onResume: () => void;
  onDismiss: () => void;
}

export default function GenerationResumeBanner({ status, summary, onResume, onDismiss }: GenerationResumeBannerProps) {
  const left = summary.needsCert + summary.needsPdf;
  if (left === 0) return null; // nothing outstanding — derived truth wins over the job doc

  const stale = status === "interrupted";
  return (
    <div
      className="mb-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: stale ? "#fffbeb" : "#eff6ff", border: `1px solid ${stale ? "#fde68a" : "#bfdbfe"}` }}
    >
      <span className="material-symbols-outlined" style={{ color: stale ? "#d97706" : "#2563eb" }}>
        {stale ? "warning" : "progress_activity"}
      </span>
      <p className="text-sm flex-1" style={{ color: "#1b4332" }}>
        {stale
          ? `Generation was interrupted — ${summary.needsCert} still need a cert ID, ${summary.needsPdf} need a PDF.`
          : `Generation is running — ${summary.needsCert} need a cert ID, ${summary.needsPdf} need a PDF.`}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onResume}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
          style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
        >
          Resume
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: "#fff", border: "1px solid #e5ebe5", color: "#64748b" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `useDatabaseManager.ts`**

- Import: `import { deriveGenerationSummary, jobEffectiveStatus } from "@/lib/generationState";`
- Add a local dismiss flag: `const [resumeBannerDismissed, setResumeBannerDismissed] = useState(false);` — reset it to `false` in the existing `openDatabase` callback and the `[category]` reset effect (both already reset `generationJob`).
- Derive and expose:

```ts
  const generationSummary = deriveGenerationSummary(participants);
  const generationJobStatus = generationJob
    ? jobEffectiveStatus({ status: (generationJob as { status?: string }).status, startedAt: generationJob.startedAt })
    : null;
  const showResumeBanner =
    !!generationJob &&
    !resumeBannerDismissed &&
    generationSummary.needsCert + generationSummary.needsPdf > 0;
```

- Replace `discardGenerationJob` with a flag-only dismiss:

```ts
  const dismissResumeBanner = () => setResumeBannerDismissed(true);
```

  Remove the old `discardGenerationJob` (the `DELETE /api/generation-jobs/...` call) and its export. Keep `resumeGeneration` as-is (it already clears `selectedParticipants` and sets `generatorResumeMode` + opens the modal).
- Return additions: `generationSummary`, `generationJobStatus`, `showResumeBanner`, `dismissResumeBanner`. Remove `discardGenerationJob` from the return.

- [ ] **Step 3: `DatabaseManager.tsx`**

- Destructure `generationSummary`, `generationJobStatus`, `showResumeBanner`, `dismissResumeBanner` (drop `discardGenerationJob`).
- Update the `DatabaseDetail` props (`~:370-372`):

```tsx
          showResumeBanner={showResumeBanner}
          resumeBannerStatus={generationJobStatus}
          generationSummary={generationSummary}
          onResumeGeneration={resumeGeneration}
          onDismissResumeBanner={dismissResumeBanner}
```

- [ ] **Step 4: `DatabaseDetail.tsx`**

- Props: replace `generationJob?`, `onResumeGeneration?`, `onDiscardGeneration?` with:

```ts
  showResumeBanner?: boolean;
  resumeBannerStatus?: "running" | "interrupted" | null;
  generationSummary?: GenerationSummary;
  onResumeGeneration?: () => void;
  onDismissResumeBanner?: () => void;
```

  Import `import type { GenerationSummary } from "@/lib/generationState";` (drop the `GenerationJob` import if now unused).
- Replace the banner render block (`:199-207`):

```tsx
        {showResumeBanner && resumeBannerStatus && generationSummary && onResumeGeneration && onDismissResumeBanner && (
          <div className="px-6 pt-4">
            <GenerationResumeBanner
              status={resumeBannerStatus}
              summary={generationSummary}
              onResume={onResumeGeneration}
              onDismiss={onDismissResumeBanner}
            />
          </div>
        )}
```

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/admin/databases/GenerationResumeBanner.tsx components/admin/databases/DatabaseDetail.tsx components/admin/databases/DatabaseManager.tsx components/admin/databases/useDatabaseManager.ts
git commit -m "$(cat <<'EOF'
feat(admin): resume banner renders from derived generation summary

Banner shows needsCert / needsPdf from the live participant docs and
hides itself when nothing is outstanding. "Discard" becomes "Dismiss" —
it only clears the local flag now, never deletes the job doc (derived
state is the truth).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Slim `GenerationJob`, shrink the job route, delete `generationResume`

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/api/generation-jobs/[databaseId]/route.ts`
- Delete: `lib/generationResume.ts`, `tests/generationResume.test.ts`

**Interfaces:**
- Consumes: `jobEffectiveStatus` (`@/lib/generationState`).
- Produces: `GenerationJob` = `{ databaseId; templateId?; startedAt; status: "running" | "interrupted"; startedBy: string }`. GET returns `job` with `status` already normalized via `jobEffectiveStatus`.

**Precondition:** Tasks 10 and 11 removed every reader of `completedParticipantIds` / `total` / `phase` / `updatedAt`. Verify: `grep -rn "completedParticipantIds\|\.phase\|job\.total\|job\.updatedAt" app components lib` → no hits outside this task's files.

- [ ] **Step 1: `lib/types.ts`**

```ts
export interface GenerationJob {
  databaseId: string;
  /** Template the run started with — a resumed run re-locks to it. */
  templateId?: string;
  startedAt: string;
  status: "running" | "interrupted";
  startedBy: string;
}
```

- [ ] **Step 2: `app/api/generation-jobs/[databaseId]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { jobEffectiveStatus } from "@/lib/generationState";

function jobRef(databaseId: string) {
  return getAdminDb().collection("generationJobs").doc(databaseId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await params;
  const snap = await jobRef(databaseId).get();
  if (!snap.exists) return NextResponse.json({ error: "No job" }, { status: 404 });
  const data = snap.data() || {};
  return NextResponse.json({
    job: {
      databaseId,
      templateId: data.templateId,
      startedAt: data.startedAt,
      startedBy: data.startedBy,
      status: jobEffectiveStatus({ status: data.status, startedAt: data.startedAt }),
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await params;

  let body: { templateId?: unknown; startedAt?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    databaseId,
    startedBy: guard.session.email || "unknown",
  };
  if (typeof body.templateId === "string") patch.templateId = body.templateId;
  if (typeof body.startedAt === "string") patch.startedAt = body.startedAt;
  if (body.status === "running" || body.status === "interrupted") patch.status = body.status;
  if (!patch.startedAt) {
    const existing = await jobRef(databaseId).get();
    patch.startedAt = existing.exists
      ? existing.data()?.startedAt || new Date().toISOString()
      : new Date().toISOString();
  }

  await jobRef(databaseId).set(patch, { merge: true });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await params;
  await jobRef(databaseId).delete();
  return NextResponse.json({ success: true });
}
```

Confirm `guard.session.email` is the right accessor — check how the old route referenced it (`guard.session.email` at `:48`). Keep it identical.

- [ ] **Step 3: Delete the dead module + test**

```bash
git rm lib/generationResume.ts tests/generationResume.test.ts
```

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0. Vitest count drops by the 4 `remainingToGenerate` cases and gains nothing here (the `generationState` tests landed in Task 1).

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts app/api/generation-jobs/[databaseId]/route.ts
git commit -m "$(cat <<'EOF'
refactor(generation): slim GenerationJob to a bare run marker

Drop completedParticipantIds / total / phase / updatedAt — generation
progress is derived now. GET normalizes status via jobEffectiveStatus
(stale "running" -> "interrupted"). Delete the unused generationResume
module and its test.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: DB-card "Unfinished" badge

**Files:**
- Modify: `app/api/databases/route.ts`
- Modify: `components/admin/databases/DatabaseList.tsx`
- Modify: `components/admin/databases/useDatabaseManager.ts`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
- Consumes: `jobEffectiveStatus` (`@/lib/generationState`).
- Produces: each DB object from `GET /api/databases` gains `hasUnfinishedJob: boolean`. `DatabaseList` gets `onResumeDatabase: (db: Database) => void`.

- [ ] **Step 1: `app/api/databases/route.ts` GET**

After `allDocs` is built and before/with the `Promise.all` count loop, read the jobs collection once and tag each DB:

```ts
    const jobsSnap = await adminDb.collection("generationJobs").get();
    const unfinished = new Set<string>();
    jobsSnap.docs.forEach((j) => {
      const d = j.data() || {};
      // A job doc exists only while running or interrupted (deleted on clean
      // finish), so its presence alone marks the DB unfinished.
      if (jobEffectiveStatus({ status: d.status, startedAt: d.startedAt })) unfinished.add(j.id);
    });
```

  (`jobEffectiveStatus` always returns a truthy string, so `unfinished` ends up being every job-doc id — which is the intent: doc exists ⇒ unfinished.)

  Then in the `Promise.all` map return: `return { ...dbDoc, participantCount: ..., hasUnfinishedJob: unfinished.has(dbDoc.id) };` (both branches — success and the `catch` fallback).

  Add `import { jobEffectiveStatus } from "@/lib/generationState";`.

- [ ] **Step 2: `DatabaseList.tsx`**

- Add to props: `onResumeDatabase: (db: Database) => void;`
- In the card, after the category/rename/delete row (or below `db.subCategory • db.topic`), render:

```tsx
{(db as { hasUnfinishedJob?: boolean }).hasUnfinishedJob && (
  <button
    onClick={(e) => { e.stopPropagation(); onResumeDatabase(db); }}
    className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
    style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}
  >
    <span className="material-symbols-outlined text-sm">progress_activity</span>
    Unfinished — Resume
  </button>
)}
```

- [ ] **Step 3: `useDatabaseManager.ts`**

Add a `resumeDatabase` action that opens the DB *and* enters resume mode:

```ts
  const resumeDatabase = (db: Database) => {
    openDatabase(db);
    setSelectedParticipants([]);
    setGeneratorResumeMode(true);
    setShowGeneratorModal(true);
  };
```

Export it.

- [ ] **Step 4: `DatabaseManager.tsx`**

Destructure `resumeDatabase`; pass `onResumeDatabase={resumeDatabase}` to `<DatabaseList>`.

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Expected: all clean / exit 0.

- [ ] **Step 6: Manual reasoning check**

`openDatabase` fetches the job doc async; `resumeDatabase` sets `generatorResumeMode` synchronously right after. Confirm the generator modal opening before the job GET resolves is fine — `CertificateGenerator`'s resume path re-fetches the job itself (Task 10 Step 6) and its auto-start effect waits on `loadingTemplates`. If `selectedDatabase` isn't set synchronously by `openDatabase` (it calls `setSelectedDatabase(db)` — it is), the modal's `database={selectedDatabase}` would be stale for one render; acceptable (modal content renders after state flush).

- [ ] **Step 7: Commit**

```bash
git add app/api/databases/route.ts components/admin/databases/DatabaseList.tsx components/admin/databases/useDatabaseManager.ts components/admin/databases/DatabaseManager.tsx
git commit -m "$(cat <<'EOF'
feat(admin): "Unfinished — Resume" badge on database cards

GET /api/databases tags each DB with hasUnfinishedJob from one
generationJobs collection read; the card badge opens the generator in
resume mode.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Whole-plan verification + live smoke-test checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-08-29-plan-e1-generation-drive-reliability.md` (this file — fill in the checklist section below).
- Modify: `pharmacozyme-certs-main/CONTEXT.md` (session log entry).

- [ ] **Step 1: Full gate on the final commit**

Run: `npx tsc --noEmit` · `npx vitest run` · `npm run build`
Record the exact vitest pass count and build exit code.

- [ ] **Step 2: Grep sweep for stragglers**

```bash
grep -rn "completedParticipantIds\|remainingToGenerate\|generationResume\|deleteRowsByCertIds\|deleteRowsByEmail\|filterNewOnly\|showExistingWarning" app components lib tests
```

Expected: **zero hits** (matches only inside this plan doc / the spec are fine).

- [ ] **Step 3: Fill the live smoke-test checklist**

Complete the "Live smoke test (user runs after deploy + Apps Script redeploy)" section at the bottom of this file with concrete, ordered steps derived from the spec §11 list.

- [ ] **Step 4: CONTEXT.md session log**

Add a `## Session log — 2026-08-29 (Plan E1)` entry: branch, HEAD SHA, task count, gate result, and the two user-owed actions (Apps Script redeploy, blue-dot SHA check). Note the pre-existing `participants.certificateId` collection-group index exemption is still owed and still out of scope.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-08-29-plan-e1-generation-drive-reliability.md pharmacozyme-certs-main/CONTEXT.md
git commit -m "$(cat <<'EOF'
docs(e1): verification results + live smoke-test checklist

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**

| Spec section | Task(s) |
| --- | --- |
| §4.1 `lib/generationState.ts` | Task 1 |
| §4.2 slim `generationJobs` doc + route | Task 12 |
| §4.2 staleness-on-read | Task 1 (`jobEffectiveStatus`), Task 12 (GET applies it) |
| §4.3 derived breakdown, needs-cert ∪ needs-pdf, checkbox | Task 10 (10b, 10g) |
| §4.4 resume skips picker, auto-starts | Task 10 (10h) |
| §4.5 card badge → resume | Task 13 (ruling: existence-based, not counted) |
| §4.5 banner "Discard" → "Dismiss" (flag only) | Task 11 |
| §4.6 delete Plan D checkpoint logic / partial-coverage toast / OOS-1 | Task 10 (10c, 10f) |
| §5.1 canonical folder id before the loop | Task 10 (10d) |
| §5.2 `uploadPDF` folderId | Task 5 |
| §5.3 `/api/drive-upload` folderId | Task 6 |
| §5.4 `consolidateFolders` | Task 5 |
| §5.5 `/api/drive/consolidate` | Task 7 |
| §5.6 "Consolidate folders" button | Task 9 |
| §5.7 delete dead `deleteRowsBy*` helpers | Task 4 |
| §6.1 Phase-3 batch-update `.ok` throw | Task 10 (10e) |
| §6.2 cert-doc PATCH failure count in toast | Task 10 (10e) |
| §6.3 `resolveDriveFileId` + call sites | Task 3 (helper), Task 8 (participant routes), Task 10 (component `handleDeletePdfOnly` — see note) |
| §6.4 fire-and-forget audit | Task 8 Step 4 (reasoning check) |
| §7.1 `deleteRows` | Task 4 |
| §7.2 participant `[id]` DELETE → `deleteRows` | Task 8 |
| §7.3 bulk-delete → one `deleteRows` | Task 8 |
| §7.4 keep `clearCertIdsByEmail` for cert-only | Task 8 Step 4 (verified untouched) |
| §7.5 `handleDeletePdfOnly` uses `resolveDriveFileId` | **See gap note below** |
| §8 public live counts | Task 2 |
| §9 tests | Tasks 1, 3 (unit); Tasks 4, 5 (hand-traces); Task 14 (sweep) |
| §11 rollout / smoke checklist | Task 14 |

**Gap found & resolved:** §7.5 names `handleDeletePdfOnly` in `CertificateGenerator.tsx` (or wherever the "delete PDF only" participant action lives). Grep did not surface a `handleDeletePdfOnly` in the files read during planning — the cert/PDF delete actions were refactored into `components/admin/databases/` during Plan B. **Added to Task 8:** before Step 1, grep `handleDeletePdfOnly\|deletePdfOnly\|keepCert\|Delete PDF` across `components/` and `app/`; wherever a participant-scoped "delete just the PDF" path resolves a Drive file id by hand, switch it to `resolveDriveFileId`. If it already goes through `/api/participants/[id]?keepCert=true`, Task 8 Step 1 already covers it and no extra change is needed. Record what was found.

**Placeholder scan:** the "copy the sibling button's classes verbatim" instruction in Task 9 Step 2 is intentional (byte-identical-style rule from Plans B/C) — the implementer reads the adjacent button. No TBD/TODO left.

**Type consistency:** `GenerationSummary` shape (`needsCert`/`needsPdf`/`complete`/`total`) is identical in Task 1, Task 11, Task 13. `jobEffectiveStatus` signature identical in Tasks 1, 12, 13. `resolveDriveFileId` signature identical in Tasks 3, 8. `GenerationJob` post-slim shape identical in Task 11's consumption and Task 12's definition.

---

## Apps Script hand-traces

_(Filled in during Tasks 4 and 5.)_

### Task 4 hand-trace — `deleteRows`

**Column layout confirmed** (read `apps-script.js` `syncData` write block + `upsertRow`):
`syncData` mode `write` builds each row as `[certificateId, name, email, certificateUrl, status, issueDate, emailSent, driveLink, createdAt]` (`rows = data.map(p => [p.certificateId||"", p.name||"", p.email||"", ...])`). `upsertRow` builds the identical `rowData` array and scans col C (`getRange(2, 3, ...)`) for the email. `syncData` mode `read` maps `row[0]→certificateId`, `row[1]→name`, `row[2]→email`. So **col A (index 0) = certificateId, col B (index 1) = name, col C (index 2) = email**, row 1 is the bold header. The brief's `getRange(2, 1, lastRow - 1, 3)` + indices `[0]`/`[1]`/`[2]` is correct — no index adjustment needed.

**Case (a): 3 matches — certId hit, name+email hit, and a miss.**

Sheet: header at row 1, 5 data rows (rows 2–6), `lastRow = 6`.

| sheet row | i (values idx) | col A certId | col B name | col C email |
|-----------|----------------|--------------|------------|-------------|
| 2 | 0 | `""` | `Alice Smith` | `alice@x.com` |
| 3 | 1 | `PZ-100` | `Bob` | `bob@x.com` |
| 4 | 2 | `PZ-200` | `Carol` | `carol@x.com` |
| 5 | 3 | `PZ-300` | `Dave` | `dave@x.com` |
| 6 | 4 | `PZ-400` | `Eve` | `eve@x.com` |

`payload.matches = [ { certificateId: "PZ-300" }, { name: "Alice Smith", email: "alice@x.com" }, { certificateId: "PZ-999" } ]`

- Guards: `spreadsheetId`/`tabName` present; `matches.length === 3 ≠ 0` → continue.
- `openById(...).getSheetByName(tabName)` → sheet found. `lastRow = 6`, `6 > 1` → continue.
- `values = getRange(2, 1, 5, 3).getValues()` → the 5×3 grid above.
- Build maps: `match[0].certificateId "PZ-300"` truthy → `certIds = { "PZ-300": true }`. `match[1]` no certificateId, has name+email → `nameEmail = { "alice smith alice@x.com": true }`. `match[2].certificateId "PZ-999"` truthy → `certIds = { "PZ-300": true, "PZ-999": true }`.
- Reverse scan `i = 4 → 0`:
  - `i=4`: certId `"PZ-400"`, key `"eve eve@x.com"` → neither in maps → skip.
  - `i=3`: certId `"PZ-300"` → `certIds["PZ-300"] === true` → `rowsToDelete.push(3 + 2)` → `rowsToDelete = [5]`.
  - `i=2`: `"PZ-200"` / `"carol carol@x.com"` → skip.
  - `i=1`: `"PZ-100"` / `"bob bob@x.com"` → skip.
  - `i=0`: certId `""` (not a key — `certIds[""]` undefined; the `{ certificateId: "" }`-style match is filtered out by the `if (match.certificateId)` truthy check), key `"alice smith alice@x.com"` → `nameEmail[key] === true` → `rowsToDelete.push(0 + 2)` → `rowsToDelete = [5, 2]`.
  - `PZ-999` matched no row → silent no-op (as intended).
- Deletion loop, in array order: `sheet.deleteRow(5)` then `sheet.deleteRow(2)`. Order is **[5, 2]** — bottom-up, so deleting row 5 does not shift row 2.
- Return `{ success: true, deletedRows: 2 }`. **`deletedRows === 2` ✓, deletion order `[5, 2]` ✓.**

**Case (b): empty `matches`.**

`payload.matches` is `[]` (or absent → `payload.matches || []` yields `[]`).
- `spreadsheetId`/`tabName` present → first guard passes.
- `if (matches.length === 0) return { success: true, deletedRows: 0 };` → returns here.
- `SpreadsheetApp.openById(...)` is **never reached** — the guard is above the `openById` line. No Sheet I/O. Return `{ success: true, deletedRows: 0 }`. **✓**

**Case (c): header-only sheet (`lastRow <= 1`).**

`payload.matches = [ { certificateId: "PZ-1" } ]` (non-empty), `spreadsheetId`/`tabName` present.
- First guard passes; `matches.length === 1 ≠ 0` → continue.
- `openById(...).getSheetByName(tabName)` → sheet found (only the header row).
- `lastRow = sheet.getLastRow()` → `1` (or `0` for a truly empty tab). `if (lastRow <= 1) return { success: true, deletedRows: 0 };` → returns here.
- `getRange(2, 1, lastRow - 1, 3)` is **never reached** (would be a zero/negative-height range) — no read, no `deleteRow`. Return `{ success: true, deletedRows: 0 }`. **✓**

### Task 5 hand-trace — `uploadPDF` folderId + `consolidateFolders`

**Move API shipped: `f.moveTo(canonical)`** — the current DriveApp move API (V8 runtime, available since 2020). This project's Apps Script already uses modern DriveApp idioms and the user runs a live deployed web app, so there is no concrete reason to expect a pre-`moveTo` runtime. The documented fallback (`canonical.addFile(f); dupe.removeFile(f);`) was not used.

**Case (a): `uploadPDF` folder resolution.**

- **With `folderId`:** `payload = { pdfData, fileName, databaseName, folderId: "FID" }`.
  - `var folderId = payload.folderId` → `"FID"` (truthy).
  - `if (folderId)` → true → `folder = DriveApp.getFolderById("FID")`. `getOrCreateFolder` is **never called** (the `else` branch is skipped) — no `getFoldersByName` / `createFolder` / `setSharing` on the folder, so no check-then-act race under 5 concurrent uploads.
  - `folder.createFile(pdfBlob)` → file created in FID; `shareBestEffort(file)` shares the file only.
  - Return includes `folderId: folder.getId()` → `"FID"` (shape unchanged).
- **Without `folderId`:** `payload = { pdfData, fileName, databaseName: "DB" }`.
  - `var folderId = payload.folderId` → `undefined` (falsy).
  - `if (folderId)` → false → `else` → `folder = getOrCreateFolder("DB")`. `DriveApp.getFolderById` is **not** called with a caller id; the name-lookup/create path runs (first-upload fallback).
  - Return still includes `folderId: folder.getId()` (the resolved sub-folder id).

**Case (b): `consolidateFolders` over a parent with 4 folders.**

Parent (resolved: `DRIVE_FOLDER_ID` → `DriveApp.getFolderById` succeeds, so the `getFoldersByName(DRIVE_FOLDER_NAME)` fallback is skipped) contains:
`["Course A" (canonical, id=C, 2 files), "Course A" (dupe1, id=D1, 3 files), "Course A" (dupe2, id=D2, 0 files), "Course B" (id=B, 1 file)]`.
Call: `payload = { folderName: "Course A", canonicalFolderId: "C" }`.

- Guard: both present → continue.
- `canonical = DriveApp.getFolderById("C")` → the canonical folder. `movedFiles = 0`, `trashedFolders = 0`.
- `dupes = parent.getFoldersByName("Course A")` → iterator over `{C, D1, D2}` (order unspecified; "Course B" is **not** in this iterator — different name, never touched).
  - **C:** `dupe.getId() === "C"` → `continue`. Canonical is never moved into itself, never trashed.
  - **D1:** id ≠ "C". `files = dupe.getFiles()` → 3 files. Loop: each `f.moveTo(canonical)`, `movedFiles` → 1, 2, 3. `dupe.setTrashed(true)`; `trashedFolders` → 1. D1 is now empty and trashed.
  - **D2:** id ≠ "C". `files` → 0 files, inner `while` body never runs, `movedFiles` stays 3. `dupe.setTrashed(true)`; `trashedFolders` → 2. D2 trashed.
- Return `{ success: true, movedFiles: 3, trashedFolders: 2 }`. ✓
- Canonical folder ends with its original 2 + 3 moved = **5 files**. "Course B" and its 1 file are untouched. ✓ (Iteration order of C/D1/D2 does not matter: C always `continue`s, D1/D2 each contribute independently.)

**Case (c): `canonicalFolderId` points at a deleted folder.**

Call: `payload = { folderName: "Course A", canonicalFolderId: "GONE" }`.

- Guard passes (both truthy).
- Parent resolves fine.
- `var canonical = DriveApp.getFolderById("GONE")` → **throws** (`No item with the given ID could be found`). This is before any file move or trash, so nothing is mutated.
- The throw propagates out of `consolidateFolders`, is caught by `doPost`'s `try/catch`, and returned as `{ error: error.message }` with a 200 body — the Next.js route reads the `error` field and surfaces a 500 + toast. Acceptable per the brief; no partial consolidation occurred.

---

## Live smoke test (user runs after deploy + Apps Script redeploy)

_(Filled in during Task 14. Draft outline:)_

1. **Apps Script redeploy** — editor → Manage deployments → edit the web-app deployment → new version → Deploy. URL must be unchanged. Paste the current `apps-script.js` first.
2. **Vercel blue-dot SHA check** — Deployments tab, confirm the commit next to the live Production deployment == the pushed branch HEAD.
3. **Fresh generation, no existing folder** — a small test DB (3–4 participants), linked Sheet, no `driveFolderId`. Generate. Expect: exactly one Drive folder created, all PDFs in it, `driveLink` populated on every participant doc *and* in the Sheet, job doc gone, no "unfinished" badge.
4. **Interrupted + resume** — start a larger run, close the tab mid-Drive-upload. Reopen the DB: "Unfinished — Resume" badge on the card + banner in the detail view showing the real needsCert/needsPdf split. Click Resume: picker is skipped, run auto-starts, only the outstanding participants are processed, no duplicate cert ids, no duplicate `certificates` docs.
5. **Consolidate folders** — on a DB known to have duplicate folders (from before this fix), click "Consolidate folders". Expect the toast to report moved files + trashed folders; verify in Drive that one folder remains with all PDFs.
6. **Participant delete** — delete a participant that has a cert id. Expect the Sheet row to disappear (not just col A cleared) and the Drive PDF trashed.
7. **PDF-only orphan delete** — a participant with a `driveLink` but no `driveFileId` (older record): delete it / its PDF. Expect the Drive file trashed (was previously orphaned).
8. **Public page counts** — open `/verify` and `/official`; course cards show real participant counts, not 0.
