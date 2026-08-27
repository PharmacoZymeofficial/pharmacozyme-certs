# Plan B — Admin Database Manager Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the 3,470-line single-component `app/admin/databases/page.tsx` into a focused component tree under `components/admin/databases/`, with **zero behavior change** and no category tabs yet (tabs are Plan C).

**Architecture:** Extract in dependency order — pure constants/helpers first, then leaf modals and rows (props threaded from the still-large parent), then the `useDatabaseManager` hook, then the list / detail / table containers. The page file ends as a thin shell rendering `<DatabaseManager />`. Every task ends green on `tsc` + `build` + `vitest` + a manual smoke pass.

**Tech Stack:** Next.js 16 App Router client components (`"use client"`), React 19, Tailwind v4, `xlsx` (SheetJS CDN build), the app's `useToast` / `useConfirm` / `sfx` utilities.

**Spec:** `docs/superpowers/specs/2026-08-27-general-official-split-and-admin-ux-design.md` (§5.1, §5.3)

## Global Constraints

- **This is NOT the Next.js you know** — App Router, Next 16. Read `node_modules/next/dist/docs/` before using an unfamiliar API.
- **Behavior-preserving only.** No UX changes, no new features, no bug fixes (even tempting ones) except where a move makes a line dead. If you spot a bug, note it in the task report, do not fix it here.
- This plan runs **after Plan A**. Plan A added imports/handlers to `page.tsx` delete paths — carry them along unchanged.
- Client components only. Keep `"use client"` at the top of every extracted file that uses hooks/handlers.
- Preserve exact class names, inline styles, `material-symbols-outlined` icon names, `sfx.*` calls, toast copy.
- No new dependencies.
- Type check: `npx tsc --noEmit`. Build: `npm run build`. Tests: `npm test` (must stay at the current pass count — this plan adds none).
- Commit after every task. End messages with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Branch: `feat/general-official-split`.

### Manual smoke checklist (run after every task that touches render)

1. `/admin/databases` loads, database cards render.
2. Create a database (modal opens, submits, appears in list).
3. Open a database → participant table renders.
4. Add one participant (single-add modal).
5. Import 2 rows via CSV paste.
6. Inline-edit a participant name, save.
7. Sort by a column; type in the participant search box.
8. Select 2 rows, open Bulk Actions menu (do not run destructive actions).
9. Open the Email modal, close it.
10. No console errors.

---

## File Structure (target)

```
components/admin/databases/
  DatabaseManager.tsx        - orchestrator: renders list OR detail; owns the hook
  useDatabaseManager.ts      - all state + data-fetch + handlers (the bulk of the monolith logic)
  constants.ts               - SENDER_IDENTITIES, categoryStructure, subCategoryShortMap, defaultCategories
  DatabaseList.tsx           - the database card grid + live toggle + inline rename + "create" trigger
  DatabaseDetail.tsx         - selected-db header, breadcrumb, Sheets/Drive tool groups, primary actions
  ParticipantTable.tsx       - sticky toolbar (actions/search/sort/filter chips) + <table>
  ParticipantRow.tsx         - one <tr>: inline edit, gen/issue/emailed status, row action dropdown
  BulkActionsBar.tsx         - bulk generate/send/delete/clear + bulk-target ("all"/"selected") flow
  modals/
    CreateDatabaseModal.tsx
    AddParticipantModal.tsx
    ImportModal.tsx
    EmailModal.tsx
    ExportModal.tsx
    IdFormatModal.tsx
    BulkTargetModal.tsx
app/admin/databases/page.tsx - thin shell: "use client"; export default () => <DatabaseManager />
```

The `page.tsx` current top-level component is `DatabaseManagementPage`. It becomes `DatabaseManager` in the new location; the file `page.tsx` re-exports a thin wrapper.

Region map of the current `page.tsx` (line numbers approximate — re-locate by the `{/* comment */}` markers, which are stable):

| Region | Lines | Goes to |
| --- | --- | --- |
| `SENDER_IDENTITIES`, `categoryStructure` | 11-31 | `constants.ts` |
| component state declarations | 37-120 | `useDatabaseManager.ts` |
| `undo` / `redo` / history helpers | 122-273 | `useDatabaseManager.ts` |
| data fetch (`fetchDatabases`, `fetchParticipants`, effects) | ~280-520 | `useDatabaseManager.ts` |
| create / add / import / email / export handlers | ~430-1110 | `useDatabaseManager.ts` (logic) + the modals (markup) |
| `handleDeleteCertificate/CertId/PdfOnly`, `handleDeleteDatabase` | ~880-1288 | `useDatabaseManager.ts` |
| `subCategoryShortMap` | 1291-1301 | `constants.ts` |
| loading skeleton | 1305-1341 | `DatabaseManager.tsx` |
| ID Format modal markup | 1392-1543 | `modals/IdFormatModal.tsx` |
| quiet refresh bar + header | 1544-1569 | `DatabaseManager.tsx` |
| breadcrumb | 1570-1584 | `DatabaseDetail.tsx` |
| database cards + live toggle | 1585-1735 | `DatabaseList.tsx` |
| selected-db detail header + tool groups | 1736-1857 | `DatabaseDetail.tsx` |
| participants table + sticky toolbar | 1858-2685 | `ParticipantTable.tsx` (+ `ParticipantRow.tsx` for the `<tr>` at ~2400-2680, + `BulkActionsBar.tsx` for ~1988-2178) |
| Create Database modal | 2686-2889 | `modals/CreateDatabaseModal.tsx` |
| Add Participant modal | 2890-2941 | `modals/AddParticipantModal.tsx` |
| Import modal | 2942-3102 | `modals/ImportModal.tsx` |
| Certificate Generator modal wrapper | 3103-3152 | stays in `DatabaseManager.tsx` (thin — wraps the existing `<CertificateGenerator>`) |
| Bulk Target modal | 3153-3209 | `modals/BulkTargetModal.tsx` |
| Email modal | 3210-3377 | `modals/EmailModal.tsx` |
| Export modal | 3378-end | `modals/ExportModal.tsx` |

---

## Task 1: Extract pure constants

**Files:**
- Create: `components/admin/databases/constants.ts`
- Modify: `app/admin/databases/page.tsx` (remove the moved consts, import them)
- Modify: `app/admin/categories/page.tsx` (import `defaultCategories` if you also centralize it — optional; skip if it risks scope creep)

**Interfaces:**
- Produces:
  - `export const SENDER_IDENTITIES: { name: string; email: string }[]`
  - `export const categoryStructure: Record<"General" | "Official", Record<string, string[]>>`
  - `export const subCategoryShortMap: Record<string, string>`

- [ ] **Step 1: Create the file**

Copy `SENDER_IDENTITIES` (page.tsx:11-15), `categoryStructure` (17-31), and `subCategoryShortMap` (1291-1301) verbatim into `components/admin/databases/constants.ts` with `export` on each.

- [ ] **Step 2: Replace in page.tsx**

Delete those three declarations from `page.tsx`. Add at the top:
```ts
import { SENDER_IDENTITIES, categoryStructure, subCategoryShortMap } from "@/components/admin/databases/constants";
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: pass. Run the manual smoke checklist (steps 1-4 suffice for a consts-only move).

- [ ] **Step 4: Commit**

```bash
git add components/admin/databases/constants.ts app/admin/databases/page.tsx
git commit -m "refactor(admin/databases): extract constants module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Move the page component to `DatabaseManager.tsx`, leave a shell

**Files:**
- Create: `components/admin/databases/DatabaseManager.tsx`
- Rewrite: `app/admin/databases/page.tsx`

**Interfaces:**
- Produces: `export default function DatabaseManager(): JSX.Element`

- [ ] **Step 1: Move the whole component**

Move the entire `DatabaseManagementPage` function (everything from `export default function DatabaseManagementPage() {` to its closing `}`) plus every import it needs into `components/admin/databases/DatabaseManager.tsx`. Rename the function to `DatabaseManager`. Keep `"use client"` as the first line. Fix relative import paths (they become `@/...` or `../../...` as appropriate — prefer `@/`).

- [ ] **Step 2: Rewrite page.tsx as a shell**

`app/admin/databases/page.tsx` becomes exactly:
```tsx
import DatabaseManager from "@/components/admin/databases/DatabaseManager";

export default function DatabaseManagementPage() {
  return <DatabaseManager />;
}
```
(No `"use client"` here — the child carries it.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: pass. Run the **full** manual smoke checklist.

- [ ] **Step 4: Commit**

```bash
git add app/admin/databases/page.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): move page component to DatabaseManager

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Extract `IdFormatModal`

**Files:**
- Create: `components/admin/databases/modals/IdFormatModal.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
- Produces:
```ts
interface IdFormatModalProps {
  open: boolean;
  onClose: () => void;
  // the id-format state + setters currently inline in the parent:
  idFormat: "app" | "name" | "custom";
  setIdFormat: (v: "app" | "name" | "custom") => void;
  idFormatCode: string; setIdFormatCode: (v: string) => void;
  idFormatCategoryNo: string; setIdFormatCategoryNo: (v: string) => void;
  idFormatCustomizeSubCat: boolean; setIdFormatCustomizeSubCat: (v: boolean) => void;
  idFormatAppSubCat: string; setIdFormatAppSubCat: (v: string) => void;
  idFormatCustomPrefix: string; setIdFormatCustomPrefix: (v: string) => void;
  onConfirm: () => void; // the existing "apply format" handler
  selectedDatabase: Database | null;
}
export default function IdFormatModal(props: IdFormatModalProps): JSX.Element | null;
```

- [ ] **Step 1: Create the component**

Move the JSX from the `{showIdFormatModal && ( ... )}` block (page markers `{/* ID Format Choice Modal */}` ~1392 to its close ~1543) into `IdFormatModal.tsx`. Return `null` when `!open`. Replace every reference to a parent state var / setter with the corresponding prop. Keep `"use client"`.

- [ ] **Step 2: Wire it in DatabaseManager**

Replace the inline block with:
```tsx
<IdFormatModal
  open={showIdFormatModal}
  onClose={() => setShowIdFormatModal(false)}
  idFormat={idFormat} setIdFormat={setIdFormat}
  idFormatCode={idFormatCode} setIdFormatCode={setIdFormatCode}
  idFormatCategoryNo={idFormatCategoryNo} setIdFormatCategoryNo={setIdFormatCategoryNo}
  idFormatCustomizeSubCat={idFormatCustomizeSubCat} setIdFormatCustomizeSubCat={setIdFormatCustomizeSubCat}
  idFormatAppSubCat={idFormatAppSubCat} setIdFormatAppSubCat={setIdFormatAppSubCat}
  idFormatCustomPrefix={idFormatCustomPrefix} setIdFormatCustomPrefix={setIdFormatCustomPrefix}
  onConfirm={/* existing handler name */}
  selectedDatabase={selectedDatabase}
/>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`. Manual: open a database → trigger the ID Format modal (Bulk Actions → Generate, or the ID format button), switch between the 3 format options, confirm it still applies. Smoke checklist.

- [ ] **Step 4: Commit**

```bash
git add components/admin/databases/modals/IdFormatModal.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract IdFormatModal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Extract `ExportModal`

**Files:**
- Create: `components/admin/databases/modals/ExportModal.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  participants: Participant[];
  selectedParticipants: string[];
  selectedDatabase: Database | null;
  // whatever the current export routine needs (xlsx is imported in the parent — move the import here)
}
export default function ExportModal(props: ExportModalProps): JSX.Element | null;
```

- [ ] **Step 1: Create** — move the `{showExportModal && (...)}` block (marker `{/* Export Modal */}` ~3378 to end) and its export/download logic. Move the `import * as XLSX from "xlsx"` to this file **if** no other extracted piece still needs it in the parent (ImportModal will — keep it in both or in a shared `lib/spreadsheet.ts`; simplest: leave the XLSX import in the parent until Task 6, then decide). For now, import XLSX in `ExportModal.tsx` too.
- [ ] **Step 2: Wire** — replace the inline block with `<ExportModal open={showExportModal} onClose={() => setShowExportModal(false)} participants={participants} selectedParticipants={selectedParticipants} selectedDatabase={selectedDatabase} />`.
- [ ] **Step 3: Verify** — `tsc` + `build`; manual: open a database, Export → download, confirm the file opens with the right rows. Smoke checklist.
- [ ] **Step 4: Commit**
```bash
git add components/admin/databases/modals/ExportModal.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract ExportModal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Extract `AddParticipantModal`

**Files:**
- Create: `components/admin/databases/modals/AddParticipantModal.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface AddParticipantModalProps {
  open: boolean;
  onClose: () => void;
  newParticipant: { name: string; email: string };
  setNewParticipant: (v: { name: string; email: string }) => void;
  bulkParticipants: string;
  setBulkParticipants: (v: string) => void;
  isAddingParticipant: boolean;
  onAddSingle: () => void;   // existing handler
  onAddBulk: () => void;     // existing handler
}
export default function AddParticipantModal(props: AddParticipantModalProps): JSX.Element | null;
```

- [ ] **Step 1: Create** — move the `{showParticipantModal && (...)}` block (marker `{/* Add Participant Modal */}` ~2890-2941).
- [ ] **Step 2: Wire** — replace with `<AddParticipantModal open={showParticipantModal} onClose={...} .../>`.
- [ ] **Step 3: Verify** — `tsc` + `build`; manual: add a single participant, add 2 via bulk paste. Smoke checklist.
- [ ] **Step 4: Commit**
```bash
git add components/admin/databases/modals/AddParticipantModal.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract AddParticipantModal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Extract `ImportModal`

**Files:**
- Create: `components/admin/databases/modals/ImportModal.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  importFile: File | null;
  setImportFile: (f: File | null) => void;
  importPreview: { name: string; email: string; certificateId?: string; issueDate?: string; status?: string }[];
  setImportPreview: (v: ImportModalProps["importPreview"]) => void;
  isImporting: boolean;
  bulkParticipants: string;
  setBulkParticipants: (v: string) => void;
  onParseFile: (f: File) => void;   // existing file-parse handler
  onConfirmImport: () => void;      // existing import handler
}
export default function ImportModal(props: ImportModalProps): JSX.Element | null;
```

- [ ] **Step 1: Create** — move the `{showImportModal && (...)}` block (marker `{/* Import Modal */}` ~2942-3102) and the `xlsx` parsing helper it uses. Import `* as XLSX from "xlsx"` here.
- [ ] **Step 2: Wire** — replace inline block. If the `XLSX` import is now unused in `DatabaseManager.tsx` (ExportModal took its copy in Task 4), remove it from the parent.
- [ ] **Step 3: Verify** — `tsc` + `build`; manual: import via CSV paste AND via file upload (`.xlsx`), confirm preview + confirm import. Smoke checklist.
- [ ] **Step 4: Commit**
```bash
git add components/admin/databases/modals/ImportModal.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract ImportModal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Extract `CreateDatabaseModal`

**Files:**
- Create: `components/admin/databases/modals/CreateDatabaseModal.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface CreateDatabaseModalProps {
  open: boolean;
  onClose: () => void;
  newDatabase: { name: string; category: "General" | "Official"; subCategory: string; topic: string; description: string };
  setNewDatabase: (v: CreateDatabaseModalProps["newDatabase"]) => void;
  isCreating: boolean;
  onCreate: () => void;             // existing handler
  // Google Sheet linking state the modal currently owns inline — thread all of it as props
}
export default function CreateDatabaseModal(props: CreateDatabaseModalProps): JSX.Element | null;
```

- [ ] **Step 1: Create** — move the `{showCreateModal && (...)}` block (marker `{/* Create Database Modal */}` ~2686-2889), including the Google Sheets linking sub-section (`{/* Google Sheets Linking */}` ~2746). Thread every sheet-linking state var/setter it touches as a prop.
- [ ] **Step 2: Wire** — replace inline block.
- [ ] **Step 3: Verify** — `tsc` + `build`; manual: create a database with and without a linked Sheet. Smoke checklist.
- [ ] **Step 4: Commit**
```bash
git add components/admin/databases/modals/CreateDatabaseModal.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract CreateDatabaseModal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Extract `BulkTargetModal` + `EmailModal`

**Files:**
- Create: `components/admin/databases/modals/BulkTargetModal.tsx`
- Create: `components/admin/databases/modals/EmailModal.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface BulkTargetModalProps {
  open: boolean;
  action: "generate" | "send" | null;
  selectedCount: number;
  totalCount: number;
  onChoose: (target: "all" | "selected") => void;
  onClose: () => void;
}

interface EmailModalProps {
  open: boolean;
  onClose: () => void;
  emailSubject: string; setEmailSubject: (v: string) => void;
  emailMessage: string; setEmailMessage: (v: string) => void;
  isSending: boolean;
  sendProgress: { current: number; total: number };
  emailStats: /* the existing emailStats shape from page.tsx:73-76 */;
  scheduleMode: boolean; setScheduleMode: (v: boolean) => void;
  scheduledAt: string; setScheduledAt: (v: string) => void;
  selectedSenderIndex: number; setSelectedSenderIndex: (v: number) => void;
  onSend: () => void;   // existing send handler
}
export default function EmailModal(props: EmailModalProps): JSX.Element | null;
export default function BulkTargetModal(props: BulkTargetModalProps): JSX.Element | null;
```

- [ ] **Step 1: Create both** — move `{showBulkTargetModal && (...)}` (marker ~3153-3209) and `{showEmailModal && (...)}` (marker ~3210-3377). `EmailModal` uses `SENDER_IDENTITIES` from `constants.ts`.
- [ ] **Step 2: Wire** — replace both inline blocks.
- [ ] **Step 3: Verify** — `tsc` + `build`; manual: open Email modal, toggle schedule mode, switch sender, close. Trigger Bulk Actions → Send → the target modal appears. Smoke checklist. **Do not actually send.**
- [ ] **Step 4: Commit**
```bash
git add components/admin/databases/modals/BulkTargetModal.tsx components/admin/databases/modals/EmailModal.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract BulkTargetModal + EmailModal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Extract `useDatabaseManager` hook

**Files:**
- Create: `components/admin/databases/useDatabaseManager.ts`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
- Produces: `export function useDatabaseManager(): { /* every state value, setter, and handler the render tree + modals need */ }`
- This is the largest single move. The hook returns one object; `DatabaseManager` destructures it and passes pieces down.

- [ ] **Step 1: Create the hook file**

Move into `useDatabaseManager.ts`: all `useState` / `useRef` declarations (page markers: the block starting `const [databases, setDatabases]` ~37 through `historyIndex` ~120), the `useToast()` / `useConfirm()` calls, the history helpers (`pushHistory`/`undo`/`redo`), every data-fetch function and `useEffect`, and every handler (`handleCreateDatabase`, `handleAddParticipant`, `handleImport`, `handleSendEmail`, `handleDeleteDatabase`, `handleDeleteCertificate`, `handleDeleteCertId`, `handleDeletePdfOnly`, cert-id edit handlers, sort/filter derived values, keyboard selection handlers, etc.).

End the hook with a single `return { ... }` listing everything. Keep it exhaustive — the compiler will tell you what's missing.

- [ ] **Step 2: Slim DatabaseManager**

`DatabaseManager.tsx` becomes: `const m = useDatabaseManager();` then the `if (m.isLoading) return <Skeleton/>;` and the main `return (...)` JSX, referencing `m.<name>` throughout. (A find/replace pass: bare `databases` → `m.databases`, etc. Work method­ically; `tsc` catches misses.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`. Run the **full** manual smoke checklist plus: undo/redo after an inline edit, delete a test certificate, delete a test database.

- [ ] **Step 4: Commit**

```bash
git add components/admin/databases/useDatabaseManager.ts components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract useDatabaseManager hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Extract `DatabaseList`

**Files:**
- Create: `components/admin/databases/DatabaseList.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface DatabaseListProps {
  databases: Database[];
  onOpen: (db: Database) => void;
  onToggleLive: (db: Database) => void;
  renamingDbId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onStartRename: (db: Database) => void;
  onCommitRename: (db: Database) => void;
  onCreate: () => void;                     // opens the create modal
  onDeleteDatabase: (db: Database) => void;
}
export default function DatabaseList(props: DatabaseListProps): JSX.Element;
```

- [ ] **Step 1: Create** — move the database-cards JSX (markers `{/* Database Cards — hidden when a database is open */}` ~1585 through ~1735, i.e. the whole `{!selectedDatabase && (...)}` card grid) into `DatabaseList.tsx`.
- [ ] **Step 2: Wire** — `{!m.selectedDatabase && <DatabaseList databases={m.databases} onOpen={m.openDatabase} ... />}`.
- [ ] **Step 3: Verify** — `tsc` + `build`; manual: list renders, live-toggle works, rename works, "create" opens the modal, delete-database works. Smoke checklist.
- [ ] **Step 4: Commit**
```bash
git add components/admin/databases/DatabaseList.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract DatabaseList

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Extract `DatabaseDetail`

**Files:**
- Create: `components/admin/databases/DatabaseDetail.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface DatabaseDetailProps {
  database: Database;
  onBack: () => void;               // breadcrumb / close
  onRename: (name: string) => void;
  isSyncingSheet: boolean;
  onSyncSheet: (dir: "firebaseToSheets" | "sheetsToFirebase") => void;
  isFindingFolder: boolean;
  onFindFolder: () => void;
  onOpenCreateSheet: () => void;
  children: React.ReactNode;         // the ParticipantTable slots in here
}
export default function DatabaseDetail(props: DatabaseDetailProps): JSX.Element;
```

- [ ] **Step 1: Create** — move the breadcrumb (`{/* Breadcrumb */}` ~1570) and the selected-db header + Sheets/Drive tool groups + primary actions (`{/* Selected Database Detail View */}` ~1736 through ~1857). Render `{props.children}` where the participants table currently follows.
- [ ] **Step 2: Wire** — `{m.selectedDatabase && <DatabaseDetail database={m.selectedDatabase} onBack={m.closeDatabase} ...><ParticipantTableRegionStillInline /></DatabaseDetail>}` (table extraction is next task; for now pass the still-inline table JSX as children).
- [ ] **Step 3: Verify** — `tsc` + `build`; manual: open a database, breadcrumb back works, Sheet sync buttons present, Drive folder button present, rename in detail header works. Smoke checklist.
- [ ] **Step 4: Commit**
```bash
git add components/admin/databases/DatabaseDetail.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract DatabaseDetail shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Extract `BulkActionsBar`

**Files:**
- Create: `components/admin/databases/BulkActionsBar.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface BulkActionsBarProps {
  selectedParticipants: string[];
  participants: Participant[];
  isGeneratingIds: boolean;
  isBulkDeleting: boolean;
  bulkDeleteLabel: string;
  onBulkGenerate: () => void;      // opens BulkTargetModal with action="generate"
  onBulkSend: () => void;          // opens BulkTargetModal with action="send"
  onBulkClearCerts: () => void;
  onBulkClearPdfs: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}
export default function BulkActionsBar(props: BulkActionsBarProps): JSX.Element | null;
```

- [ ] **Step 1: Create** — move the bulk-actions JSX (`{/* Bulk Actions */}` ~1988 through ~2178, the whole selected-rows action cluster). Return `null` when `selectedParticipants.length === 0`.
- [ ] **Step 2: Wire** — inside the sticky toolbar in `DatabaseManager` (or `ParticipantTable` after Task 13), render `<BulkActionsBar ... />`.
- [ ] **Step 3: Verify** — `tsc` + `build`; manual: select rows → bar appears; open each bulk menu; run **one safe** bulk op on a test database (e.g. clear selection). Smoke checklist.
- [ ] **Step 4: Commit**
```bash
git add components/admin/databases/BulkActionsBar.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract BulkActionsBar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Extract `ParticipantRow` then `ParticipantTable`

**Files:**
- Create: `components/admin/databases/ParticipantRow.tsx`
- Create: `components/admin/databases/ParticipantTable.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx`

**Interfaces:**
```ts
interface ParticipantRowProps {
  participant: Participant;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  editingName: string | null; editingEmail: string | null; editingCertId: string | null;
  tempCertId: string; setTempCertId: (v: string) => void;
  onStartEdit: (field: "name" | "email" | "certId", p: Participant) => void;
  onCommitEdit: (field: "name" | "email" | "certId", p: Participant, value: string) => void;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  onDeleteCertificate: (p: Participant) => void;
  onDeleteCertId: (p: Participant) => void;
  onDeletePdfOnly: (p: Participant) => void;
  onDeleteParticipant: (p: Participant) => void;
}

interface ParticipantTableProps {
  participants: Participant[];        // already filtered + sorted by the hook
  displayedRows: Participant[];
  participantSearch: string; setParticipantSearch: (v: string) => void;
  sortBy: "name" | "email" | "certId" | "date" | "status" | "sheet";
  sortOrder: "asc" | "desc";
  onSort: (col: ParticipantTableProps["sortBy"]) => void;
  filterStatus: "all" | "pending" | "id-only" | "generated" | "missing-drive";
  setFilterStatus: (v: ParticipantTableProps["filterStatus"]) => void;
  filterEmailed: "all" | "yes" | "no";
  setFilterEmailed: (v: ParticipantTableProps["filterEmailed"]) => void;
  selectedParticipants: string[];
  onSelectAll: () => void;
  rowProps: (p: Participant, index: number) => ParticipantRowProps; // builder from the hook
  toolbarSlot: React.ReactNode;      // <BulkActionsBar/> + primary action buttons
}
export default function ParticipantRow(props: ParticipantRowProps): JSX.Element;
export default function ParticipantTable(props: ParticipantTableProps): JSX.Element;
```

- [ ] **Step 1: ParticipantRow** — move the `<tr>...</tr>` for one participant (the `.map` body inside `{/* Table */}` ~2210, specifically the row markup ~2400-2680 including the `{/* Generation Status */}` / `{/* Issuance Status */}` / `{/* Emailed */}` cells). Thread props.
- [ ] **Step 2: Verify row** — `tsc` + `build`; manual: rows render, inline edits work, per-row dropdown + its delete actions work. Smoke.
- [ ] **Step 3: Commit row**
```bash
git add components/admin/databases/ParticipantRow.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "refactor(admin/databases): extract ParticipantRow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
- [ ] **Step 4: ParticipantTable** — move the sticky toolbar (`{/* Sticky toolbar */}` ~1881) + search + sort headers + filter chips (`{/* Filter chips */}` ~2180) + the `<table>` + the `.map(p => <ParticipantRow .../>)`. Accept `toolbarSlot` for the bulk bar + primary actions.
- [ ] **Step 5: Verify table** — `tsc` + `build`; **full** manual smoke checklist.
- [ ] **Step 6: Commit table**
```bash
git add components/admin/databases/ParticipantTable.tsx components/admin/databases/DatabaseManager.tsx components/admin/databases/DatabaseDetail.tsx
git commit -m "refactor(admin/databases): extract ParticipantTable

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Final tidy + full regression

**Files:**
- Modify: `components/admin/databases/DatabaseManager.tsx` (should now be < ~250 lines)

- [ ] **Step 1: Confirm the shape**

`DatabaseManager.tsx` should now be: `"use client"`, imports, `const m = useDatabaseManager()`, loading skeleton, and a `return` that composes `<DatabaseList>` / `<DatabaseDetail><ParticipantTable/></DatabaseDetail>` / all the modals / the `<CertificateGenerator>` modal wrapper. If any large JSX island remains inline, extract it following the same pattern.

- [ ] **Step 2: Dead code sweep**

`npx eslint components/admin/databases/` — remove any now-unused imports/vars it flags **in the new files only** (do not touch unrelated pre-existing lint debt).

- [ ] **Step 3: Full gate**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean, Vitest pass count unchanged from before Plan B, build succeeds.

- [ ] **Step 4: Full manual smoke** — every item in the checklist, plus: generate certificates for a 2-person test database end to end.

- [ ] **Step 5: Commit**

```bash
git add components/admin/databases/
git commit -m "refactor(admin/databases): final tidy after monolith split

page.tsx: 3470 lines -> ~10 files, largest ~250 lines. No behavior change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report** — list the new file tree, the before/after line counts, and confirm the smoke checklist passed. Note any bugs spotted-but-not-fixed for Plan C/D.

---

## Self-Review Notes

- **Spec §5.1 coverage:** every file in the target table has an extraction task (constants T1, DatabaseManager T2, IdFormatModal T3, ExportModal T4, AddParticipantModal T5, ImportModal T6, CreateDatabaseModal T7, BulkTargetModal+EmailModal T8, useDatabaseManager T9, DatabaseList T10, DatabaseDetail T11, BulkActionsBar T12, ParticipantRow+ParticipantTable T13). ✅
- **Spec §5.3 discipline:** pure consts first (T1), leaf modals (T3-8), hook (T9), containers (T10-13), tabs deferred to Plan C. Every task gated by tsc+build+smoke. ✅
- **No tabs / no category prop yet** — deliberately. Plan C adds `category` to `DatabaseManager` + the tab wrapper. Interfaces here don't mention `category`, which is correct for a behavior-preserving pass.
- **Placeholder check:** interfaces name real state vars from `page.tsx:37-120`; handlers reference real function names visible in the file. The executor must open `page.tsx` to get exact current handler names (they're not all quoted here because the file is the source of truth and names may have drifted) — this is called out in T3 step 2 and T9 step 1.
