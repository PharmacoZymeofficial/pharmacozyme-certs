# Plan C — General / Official Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the flat "General + Official mixed" experience into two public pages (`/verify` = General, `/official` = Official) with a hard category wall + redirect hint, and split admin database management into `[General] [Official]` tabs.

**Architecture:** Public pages are **forked** — `/official` is its own route with its own `OfficialSearch` / `OfficialDatabaseCards` components, identical in look to General on day one but free to diverge. Only mechanical leaf pieces (`ResultCard`, `SkeletonCard`, `IdlePlaceholder`, formatters) are shared. Three API routes gain an optional `category` filter; `/api/verify` returns a `mismatch` payload when a cert is found in the other category. Admin: `DatabaseManager` (from Plan B) takes a `category` prop; `page.tsx` becomes a tab shell driven by `?cat=`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Firebase Admin SDK, `firestore.indexes.json` composite index, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-general-official-split-and-admin-ux-design.md` (§4, §5.2, §11.2/11.4)

**Runs after:** Plan B (needs the extracted `DatabaseManager` + `useDatabaseManager`).

## Plan B handoff notes (from Plan B's final whole-branch review — read before Task 11/12)

The admin monolith is now `components/admin/databases/` — `DatabaseManager.tsx` (takes no props yet), `useDatabaseManager.ts` (the hook, argument-free), `DatabaseList.tsx`, `DatabaseDetail.tsx`, `ParticipantTable.tsx`, `ParticipantRow.tsx`, `BulkActionsBar.tsx`, `constants.ts`, `modals/*`. `app/admin/databases/page.tsx` is a 5-line server-component shell rendering `<DatabaseManager/>`.

- **Tab-bar seam:** insert the `[General] [Official]` bar in `DatabaseManager.tsx` between the closing `</header>` (~line 332) and the `{!selectedDatabase && <DatabaseList .../>}` block.
- **List filtering:** filter `databases` by category **in `DatabaseManager` before passing to `<DatabaseList>`** — do NOT parameterize `useDatabaseManager()` (keeping it argument-free avoids touching the byte-identical JSX region). `<DatabaseList databases={databases.filter(d => d.category === category)} />`.
- **Category default is hardcoded `"General"` in TWO places** in `useDatabaseManager.ts` — the `newDatabase` state initializer (~line 31) **and** the post-create reset (~line 370). Task 11 must make BOTH derive from the active `category`, or the create form silently snaps back to General while the user is on the Official tab.
- **New Task C0 (do FIRST, before Task 11): fix the `displayedRowsRef` render-time read.** `ParticipantTable.tsx` reads `displayedRowsRef.current` during render (the select-all `checked=` at ~line 308) and writes `displayedRowsRef.current = sorted` in the filter/sort IIFE (~line 422) — 4 `react-hooks/refs` eslint errors, and a real latent bug (select-all checkbox shows the previous row set for one paint after a filter/sort change). Carried verbatim from the monolith by Plan B. Fix: hoist the filter+sort into `const sorted = useMemo(() => {...}, [participants, sortBy, sortOrder, filterStatus, filterEmailed, participantSearch])` above the `return`, derive BOTH the `checked` value and the row `.map` from `sorted`, and keep `displayedRowsRef.current = sorted` in a `useEffect` (or drop the ref if nothing else reads it — `grep displayedRowsRef` first; the keyboard range-select in the `<tbody> onKeyDown` may use it). Verify: the 4 eslint errors clear, `tsc`/`vitest 38`/`build` stay green, keyboard range-select still works. This is a behavior FIX (removes the stale paint) — call that out; it's the one intentional behavior change, pre-approved by the Plan B review.
- Pre-existing warts Plan B deliberately left (do NOT fix as a side effect): 21 `no-explicit-any`, a `forEach(async)` race in `BulkActionsBar.tsx` "Mark as Emailed", 2 `no-unescaped-entities` in `CreateDatabaseModal.tsx`, an unused `const year` in `useDatabaseManager.ts`.

## Pre-merge data check

Run `node scripts/category-audit.mjs` (or the tsx form) against production before merge — backfill any `databases`/`certificates` doc whose `category` is not exactly General/Official; those docs silently vanish from the split UI.

## Global Constraints

- **This is NOT the Next.js you know** — App Router, Next 16. Read `node_modules/next/dist/docs/` first for unfamiliar APIs.
- Category is the literal string `"General"` or `"Official"` (matches `Database.category` in `lib/types.ts`). URL param `?cat=` uses lowercase `general` / `official`; map at the boundary.
- `SUB_CATS` split: General = `["Courses", "Workshops", "Webinars", "MED-Q"]`; Official = `["Central Team", "Sub Team", "Ambassadors", "Affiliates", "Mentors"]`.
- API routes: `getAdminDb()` only, `requireAdmin` for admin routes; `/api/verify`, `/api/search-name`, `/api/databases/public` stay **public** (no guard) by design.
- The composite index for `/api/search-name` must be deployed **before** the code that queries it — call this out in the report.
- QR / cert minting is untouched — `/certificate?certId=` is category-agnostic and stays that way.
- Tests: `tests/*.test.ts`, `npm test`. Type check `npx tsc --noEmit`. Build `npm run build`.
- Commit after every task. End messages with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Branch: `feat/general-official-split`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `components/verify/shared/format.ts` | **New.** `AVATAR_GRADIENTS`, `avatarGradient`, `initials`, `fmtDate`. |
| `components/verify/shared/ResultCard.tsx` | **New.** The name-search result card (moved verbatim from `VerifySearch.tsx`). |
| `components/verify/shared/SkeletonCard.tsx` | **New.** Moved verbatim. |
| `components/verify/shared/IdlePlaceholder.tsx` | **New.** Moved verbatim. |
| `components/verify/shared/CrossCategoryHint.tsx` | **New.** "This is an Official certificate — verify it at …" panel. |
| `components/VerifySearch.tsx` | **Modify.** General-scoped: `SUB_CATS` trimmed, all API calls send `category=General`, imports shared leaves, handles `mismatch`. |
| `components/PublicDatabaseCards.tsx` | **Modify.** Fetches `?category=General`. |
| `app/verify/page.tsx` | **Modify.** Passes General context; renders `CrossCategoryHint` on mismatch. |
| `components/OfficialSearch.tsx` | **New.** Fork of `VerifySearch.tsx`, Official-scoped. |
| `components/OfficialDatabaseCards.tsx` | **New.** Fork of `PublicDatabaseCards.tsx`, `?category=Official`. |
| `app/official/page.tsx` | **New.** Fork of `app/verify/page.tsx`, Official copy. |
| `components/Navbar.tsx` | **Modify.** `next/link`, add "Official", active state by path. |
| `app/api/databases/public/route.ts` | **Modify.** `?category=` filter. |
| `app/api/search-name/route.ts` | **Modify.** `?category=` filter. |
| `app/api/verify/route.ts` | **Modify.** `mismatch` payload on category mismatch. |
| `firestore.indexes.json` | **Modify.** `certificates` (category ASC, recipientName ASC) composite index. |
| `components/admin/databases/DatabaseManager.tsx` | **Modify.** Accept `category` prop, filter, lock create-modal category. |
| `app/admin/databases/page.tsx` | **Modify.** Tab shell driven by `?cat=`. |
| `components/admin/databases/CategoryTabs.tsx` | **New.** `[General (n)] [Official (n)]` bar. |
| `tests/categoryFilter.test.ts` | **New.** Unit tests for the category-normalise helper + mismatch detection. |
| `lib/category.ts` | **New.** `parseCategoryParam`, `isCategory`, `CATEGORY_SUBCATS`. |

---

## Task 1: `lib/category.ts` + tests

**Files:**
- Create: `lib/category.ts`
- Test: `tests/categoryFilter.test.ts`

**Interfaces:**
- Produces:
  - `type Category = "General" | "Official"`
  - `isCategory(v: unknown): v is Category`
  - `parseCategoryParam(v: string | null | undefined): Category | null` — accepts `general`/`General`/`GENERAL` etc.
  - `CATEGORY_SUBCATS: Record<Category, string[]>`

- [ ] **Step 1: Write the failing test**

Create `tests/categoryFilter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isCategory, parseCategoryParam, CATEGORY_SUBCATS } from "@/lib/category";

describe("category helpers", () => {
  it("isCategory accepts only the two exact strings", () => {
    expect(isCategory("General")).toBe(true);
    expect(isCategory("Official")).toBe(true);
    expect(isCategory("general")).toBe(false);
    expect(isCategory("")).toBe(false);
    expect(isCategory(undefined)).toBe(false);
  });

  it("parseCategoryParam normalises case and rejects junk", () => {
    expect(parseCategoryParam("general")).toBe("General");
    expect(parseCategoryParam("OFFICIAL")).toBe("Official");
    expect(parseCategoryParam("Official")).toBe("Official");
    expect(parseCategoryParam("")).toBeNull();
    expect(parseCategoryParam(null)).toBeNull();
    expect(parseCategoryParam("both")).toBeNull();
  });

  it("subcategory lists are disjoint and non-empty", () => {
    const g = new Set(CATEGORY_SUBCATS.General);
    const o = new Set(CATEGORY_SUBCATS.Official);
    expect(g.size).toBeGreaterThan(0);
    expect(o.size).toBeGreaterThan(0);
    for (const s of g) expect(o.has(s)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/categoryFilter.test.ts`
Expected: FAIL — cannot resolve `@/lib/category`.

- [ ] **Step 3: Implement**

Create `lib/category.ts`:

```ts
export type Category = "General" | "Official";

const ALL: Category[] = ["General", "Official"];

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (ALL as string[]).includes(v);
}

export function parseCategoryParam(v: string | null | undefined): Category | null {
  if (!v) return null;
  const lower = v.trim().toLowerCase();
  if (lower === "general") return "General";
  if (lower === "official") return "Official";
  return null;
}

export const CATEGORY_SUBCATS: Record<Category, string[]> = {
  General: ["Courses", "Workshops", "Webinars", "MED-Q"],
  Official: ["Central Team", "Sub Team", "Ambassadors", "Affiliates", "Mentors"],
};
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/categoryFilter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/category.ts tests/categoryFilter.test.ts
git commit -m "feat: add lib/category helpers (parse/validate/subcats)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `/api/databases/public` — `?category=` filter

**Files:**
- Modify: `app/api/databases/public/route.ts`

**Interfaces:**
- `GET /api/databases/public?category=General|Official` → same shape, filtered. No param = all live (unchanged).

- [ ] **Step 1: Add the filter**

In `app/api/databases/public/route.ts` `GET`, read the param and filter:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { parseCategoryParam } from "@/lib/category";

export async function GET(request: NextRequest) {
  try {
    const category = parseCategoryParam(new URL(request.url).searchParams.get("category"));
    let query = getAdminDb().collection("databases").where("isLive", "==", true);
    if (category) query = query.where("category", "==", category);
    const snap = await query.get();
    // ...existing .map + .sort unchanged...
```

(Change the function signature from `GET()` to `GET(request: NextRequest)`.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass. (`isLive == true` + `category ==` is an equality-only composite — Firestore builds it automatically, no index file entry needed. Confirm in local dev with a manual request if possible.)

- [ ] **Step 3: Commit**

```bash
git add app/api/databases/public/route.ts
git commit -m "feat(api): databases/public accepts ?category= filter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `firestore.indexes.json` — search-name composite index

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Add the index**

In `firestore.indexes.json`, add to the `indexes` array:

```json
{
  "collectionGroup": "certificates",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "category", "order": "ASCENDING" },
    { "fieldPath": "recipientName", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit + flag for deploy**

```bash
git add firestore.indexes.json
git commit -m "feat(firestore): add certificates (category, recipientName) index

Deploy with: firebase deploy --only firestore:indexes  — BEFORE Task 4 ships.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

In the task report: **the user must run `firebase deploy --only firestore:indexes` and wait for the index to finish building before the Task 4 code goes live**, else category-scoped name search 500s.

---

## Task 4: `/api/search-name` — `?category=` filter

**Files:**
- Modify: `app/api/search-name/route.ts`

**Interfaces:**
- `GET /api/search-name?name=&category=General|Official[&databaseId=][&subCategory=]` → scopes both search passes to the category.

- [ ] **Step 1: Add category scoping**

In `app/api/search-name/route.ts` `GET`:
- Parse `const category = parseCategoryParam(searchParams.get("category"));` (import from `@/lib/category`).
- Search 1 (certificates collection): when `category` is set, add `.where("category", "==", category)` to each `certRef` query alongside the `recipientName` range.
- Search 2 (participants): when `category` is set, `continue` past any `dbDoc` whose `dbData.category !== category` (add next to the existing `subCategory` skip at line ~100).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 3: Manual check (needs the deployed index)**

If a dev Firestore is available: `GET /api/search-name?name=test&category=General` returns only General results; `category=Official` only Official. If no dev Firestore, note it for the post-deploy manual pass (spec §11.2 item 1).

- [ ] **Step 4: Commit**

```bash
git add app/api/search-name/route.ts
git commit -m "feat(api): search-name scopes to ?category= (both passes)

Requires the certificates (category, recipientName) index deployed first.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `/api/verify` — `mismatch` payload

**Files:**
- Modify: `app/api/verify/route.ts`
- Test: `tests/categoryFilter.test.ts` (add a `mismatch` detection helper test)

**Interfaces:**
- Produces: on a **category** mismatch (not sub-category), `GET /api/verify?certId=&category=X` returns status 404 with
  `{ error: string, mismatch: true, actualCategory: "General" | "Official", certId: string }`.
- Sub-category mismatch behavior unchanged.

- [ ] **Step 1: Extract + test the mismatch helper**

Add to `lib/category.ts`:

```ts
/** Given the requested category filter and a cert's own category, is this a hard cross-category miss? */
export function isCategoryMismatch(
  requested: string | null | undefined,
  actual: string | null | undefined
): boolean {
  const req = parseCategoryParam(requested ?? null);
  return req !== null && isCategory(actual) && actual !== req;
}
```

Add to `tests/categoryFilter.test.ts`:

```ts
import { isCategoryMismatch } from "@/lib/category";

describe("isCategoryMismatch", () => {
  it("true only when both are valid categories and differ", () => {
    expect(isCategoryMismatch("General", "Official")).toBe(true);
    expect(isCategoryMismatch("official", "General")).toBe(true);
    expect(isCategoryMismatch("General", "General")).toBe(false);
    expect(isCategoryMismatch(null, "Official")).toBe(false);
    expect(isCategoryMismatch("General", "")).toBe(false);
  });
});
```

Run: `npx vitest run tests/categoryFilter.test.ts` — expect the new block to fail, then pass after adding the helper.

- [ ] **Step 2: Wire into the route**

In `app/api/verify/route.ts`, the two `validateCategoryMatch` / `categoryMismatch` helpers (lines ~61-72): when the mismatch is on **category** specifically, return the richer payload. Replace `categoryMismatch()` with:

```ts
    function categoryMismatch(certData: any) {
      if (isCategoryMismatch(filterCategory, certData?.category)) {
        return NextResponse.json(
          {
            error: `This certificate belongs to the ${certData.category} category.`,
            mismatch: true,
            actualCategory: certData.category,
            certId,
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Certificate found but does not match the selected category/subcategory." },
        { status: 404 }
      );
    }
```

Update both call sites (`if (!validateCategoryMatch(certData)) return categoryMismatch(certData);` and the participants-branch equivalent `return categoryMismatch(certificate);`). Import `isCategoryMismatch` from `@/lib/category`.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/verify/route.ts lib/category.ts tests/categoryFilter.test.ts
git commit -m "feat(api): verify returns mismatch payload on cross-category hit

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Extract shared verify leaves

**Files:**
- Create: `components/verify/shared/format.ts`, `ResultCard.tsx`, `SkeletonCard.tsx`, `IdlePlaceholder.tsx`
- Modify: `components/VerifySearch.tsx`

**Interfaces:**
- `format.ts`: `AVATAR_GRADIENTS: string[]`, `avatarGradient(name: string): string`, `initials(name: string): string`, `fmtDate(d: string): string`
- `ResultCard.tsx`: `export default function ResultCard({ result, index, onSelect }: { result: SearchResult; index: number; onSelect: (certId: string) => void }): JSX.Element` where `SearchResult` is exported from the same file (move the interface from `VerifySearch.tsx:8-18`).
- `SkeletonCard.tsx`: `export default function SkeletonCard({ delay }: { delay: number }): JSX.Element`
- `IdlePlaceholder.tsx`: `export default function IdlePlaceholder(): JSX.Element`

- [ ] **Step 1: Create `format.ts`** — move `AVATAR_GRADIENTS` (VerifySearch.tsx:50-57), `avatarGradient` (59-61), `initials` (63-68), `fmtDate` (70-83) verbatim, each `export`ed.

- [ ] **Step 2: Create the three components** — move `SkeletonCard` (87-114), `ResultCard` (116-205), `IdlePlaceholder` (207-235) into their files. Add `"use client"` to `ResultCard.tsx` (it uses `useState`). Each imports what it needs from `./format` and `@/lib/sfx`. Export the `SearchResult` interface from `ResultCard.tsx`.

- [ ] **Step 3: Update `VerifySearch.tsx`** — delete the moved code, import:
```ts
import ResultCard, { SearchResult } from "@/components/verify/shared/ResultCard";
import SkeletonCard from "@/components/verify/shared/SkeletonCard";
import IdlePlaceholder from "@/components/verify/shared/IdlePlaceholder";
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`. Manual: `/verify` → name search renders result cards, skeletons on load, idle placeholder before typing. No visual change.

- [ ] **Step 5: Commit**

```bash
git add components/verify/shared/ components/VerifySearch.tsx
git commit -m "refactor(verify): extract shared ResultCard/SkeletonCard/IdlePlaceholder/format

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Scope `VerifySearch` + `PublicDatabaseCards` to General

**Files:**
- Modify: `components/VerifySearch.tsx`
- Modify: `components/PublicDatabaseCards.tsx`

- [ ] **Step 1: VerifySearch — trim `SUB_CATS`**

Replace `SUB_CATS` (VerifySearch.tsx:38-48) with an import:
```ts
import { CATEGORY_SUBCATS } from "@/lib/category";
const SUB_CATS = CATEGORY_SUBCATS.General;
```

- [ ] **Step 2: VerifySearch — send `category=General` on API calls**

- The database dropdown fetch: `fetch("/api/databases/public?category=General")`.
- `search()` (name search): add `params.set("category", "General")` before the `fetch(\`/api/search-name?${params}\`)` call (~line 344).
- `handleIdSubmit` (~427-434): the `onVerify` call — the parent already forwards `category`/`subCategory` to `/api/verify`. Change the derived `cat` to always be `"General"`:
  ```ts
  const cat = "General";
  const sub = selectedDb?.subCategory || selectedSubCat || undefined;
  onVerify(certIdInput.trim(), cat, sub);
  ```

- [ ] **Step 3: PublicDatabaseCards — fetch General only**

Both `fetch("/api/databases/public")` calls (PublicDatabaseCards.tsx:253 and the one in VerifySearch already done) → `fetch("/api/databases/public?category=General")`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`. Manual: `/verify` shows only General sub-category chips and only General databases; searching an Official name returns nothing; entering an Official cert ID triggers the mismatch path (hint UI comes in Task 10 — for now confirm the network response is the `mismatch` 404).

- [ ] **Step 5: Commit**

```bash
git add components/VerifySearch.tsx components/PublicDatabaseCards.tsx
git commit -m "feat(verify): scope /verify to the General category

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `CrossCategoryHint` + wire into `/verify`

**Files:**
- Create: `components/verify/shared/CrossCategoryHint.tsx`
- Modify: `app/verify/page.tsx`
- Modify: `components/VerifySearch.tsx` (or `app/verify/page.tsx`, wherever the verify fetch response is handled — it's in `app/verify/page.tsx`'s `handleVerify`, lines ~60-91)

**Interfaces:**
```ts
interface CrossCategoryHintProps {
  actualCategory: "General" | "Official";
  certId: string;
  currentCategory: "General" | "Official";
}
export default function CrossCategoryHint(props: CrossCategoryHintProps): JSX.Element;
```

- [ ] **Step 1: Create the component**

`components/verify/shared/CrossCategoryHint.tsx`:

```tsx
"use client";

interface CrossCategoryHintProps {
  actualCategory: "General" | "Official";
  certId: string;
  currentCategory: "General" | "Official";
}

export default function CrossCategoryHint({ actualCategory, certId }: CrossCategoryHintProps) {
  const href =
    actualCategory === "Official"
      ? `/official?certId=${encodeURIComponent(certId)}`
      : `/verify?certId=${encodeURIComponent(certId)}`;

  return (
    <div
      className="max-w-2xl mx-auto rounded-2xl p-6 text-center"
      style={{ background: "#fff", border: "1px solid #e5ebe5", boxShadow: "0 8px 32px rgba(15,46,28,0.08)" }}
    >
      <span className="material-symbols-outlined text-3xl" style={{ color: "#52b788", fontVariationSettings: "'FILL' 1" }}>
        info
      </span>
      <p className="mt-3 text-sm text-gray-700">
        This is an <span className="font-semibold text-brand-dark-green">{actualCategory}</span> certificate.
      </p>
      <a
        href={href}
        className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 4px 16px rgba(34,197,94,0.30)" }}
      >
        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        Verify on the {actualCategory} page
        <span className="material-symbols-outlined text-base">arrow_forward</span>
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Capture `mismatch` in `handleVerify`**

In `app/verify/page.tsx`, `VerifyContent`: add state `const [mismatch, setMismatch] = useState<{ actualCategory: "General" | "Official"; certId: string } | null>(null);`

In `handleVerify`, after `const data = await response.json();` and before the `if (!response.ok) throw`:
```ts
      if (!response.ok) {
        if (data.mismatch && (data.actualCategory === "General" || data.actualCategory === "Official")) {
          setMismatch({ actualCategory: data.actualCategory, certId: data.certId || certId });
          setCertificate(null);
          return;
        }
        throw new Error(data.error || "Certificate not found. Please check the ID and try again.");
      }
```
Reset `setMismatch(null)` at the top of `handleVerify` next to `setCertificate(null)`, and in `handleClose`.

- [ ] **Step 3: Render it**

In the result section of `app/verify/page.tsx` (~184-209), render `<CrossCategoryHint>` when `mismatch` is set, in place of / alongside `<VerificationResult>`:
```tsx
{mismatch && (
  <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
    <CrossCategoryHint actualCategory={mismatch.actualCategory} certId={mismatch.certId} currentCategory="General" />
  </section>
)}
```
Adjust the `{(certificate || error || isLoading) && (...)}` guard so the hint and the normal result don't both show.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`. Manual: on `/verify`, enter a known Official cert ID → hint panel with a working link to `/official?certId=...`. Enter a real General ID → normal result, no hint.

- [ ] **Step 5: Commit**

```bash
git add components/verify/shared/CrossCategoryHint.tsx app/verify/page.tsx
git commit -m "feat(verify): show cross-category hint when a cert is in the other category

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Fork `OfficialSearch`, `OfficialDatabaseCards`, `app/official/page.tsx`

**Files:**
- Create: `components/OfficialSearch.tsx`
- Create: `components/OfficialDatabaseCards.tsx`
- Create: `app/official/page.tsx`

- [ ] **Step 1: `OfficialSearch.tsx`**

Copy `components/VerifySearch.tsx` verbatim → `components/OfficialSearch.tsx`. Then:
- `const SUB_CATS = CATEGORY_SUBCATS.Official;`
- Every `category=General` string → `category=Official` (the dropdown fetch, the `search()` param, the `handleIdSubmit` `cat`).
- Header copy: `"Find Your Certificate"` → `"Verify Official Recognition"`; the subtitle line → `"Search Official PharmacoZyme certificates by name or ID"`.
- Keep the same imports of the shared leaves.
- Rename the default export function `VerifySearch` → `OfficialSearch`.

- [ ] **Step 2: `OfficialDatabaseCards.tsx`**

Copy `components/PublicDatabaseCards.tsx` verbatim → `components/OfficialDatabaseCards.tsx`. Change both fetches to `?category=Official`. Rename export `PublicDatabaseCards` → `OfficialDatabaseCards`. (Leave `CATEGORY_CONFIG` — it already has an `Official` entry.)

- [ ] **Step 3: `app/official/page.tsx`**

Copy `app/verify/page.tsx` verbatim → `app/official/page.tsx`. Then:
- Import `OfficialSearch` / `OfficialDatabaseCards` instead of `VerifySearch` / `PublicDatabaseCards`.
- `handleVerify`: the mismatch branch — `currentCategory="Official"`, and the fetch already passes `category` from the search component; ensure the ID path sends `category=Official` (comes from `OfficialSearch`).
- `<CrossCategoryHint ... currentCategory="Official" />`.
- Hero copy: scroll-indicator label + any headline → Official wording. Keep the same hero video `src` for now (spec §4.1).
- Rename `VerifyPage` / `VerifyContent` → `OfficialPage` / `OfficialContent`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`. Manual: `/official` loads, shows only Official databases + Official chips; name search scoped to Official; entering a General cert ID → hint linking to `/verify`.

- [ ] **Step 5: Commit**

```bash
git add components/OfficialSearch.tsx components/OfficialDatabaseCards.tsx app/official/page.tsx
git commit -m "feat: add /official page (forked from /verify, Official-scoped)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Navbar — `next/link` + Official link

**Files:**
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Rewrite the nav links**

Make `Navbar.tsx` a client component (`"use client"` at top, `import { usePathname } from "next/navigation"; import Link from "next/link";`). Replace the single `<a href="/verify">` with:

```tsx
const pathname = usePathname();
// ...
<Link
  href="/verify"
  className={`flex items-center gap-1.5 font-body font-medium text-sm ${
    pathname === "/verify" ? "text-green-700 border-b-2 border-green-600 pb-1" : "text-stone-600 hover:text-green-600"
  } transition-colors`}
>
  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
  <span className="hidden md:inline">Verification</span>
</Link>
<Link
  href="/official"
  className={`flex items-center gap-1.5 font-body font-medium text-sm ${
    pathname === "/official" ? "text-green-700 border-b-2 border-green-600 pb-1" : "text-stone-600 hover:text-green-600"
  } transition-colors`}
>
  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
  <span className="hidden md:inline">Official</span>
</Link>
```
Keep the external logo `<a>` and the WhatsApp support `<a>` as raw anchors (they're external — correct).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build`. Manual: navbar shows Verification + Official; active underline follows the route; client-side nav between them works without a full reload.

- [ ] **Step 3: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat(nav): next/link internal nav + Official link with active state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Admin — `category` prop on `DatabaseManager`

**Files:**
- Modify: `components/admin/databases/DatabaseManager.tsx`
- Modify: `components/admin/databases/useDatabaseManager.ts`
- Modify: `components/admin/databases/modals/CreateDatabaseModal.tsx`

**Interfaces:**
- `DatabaseManager` becomes `export default function DatabaseManager({ category }: { category: "General" | "Official" }): JSX.Element`
- `useDatabaseManager(category: "General" | "Official")` — filters `databases` to `category`, defaults new-database `category` to it.

- [ ] **Step 1: Thread the prop**

- `DatabaseManager` accepts `{ category }`, passes to `useDatabaseManager(category)`.
- In `useDatabaseManager`: after `fetchDatabases` sets the raw list, expose a derived `databases` filtered to `d.category === category` (keep the raw list as `allDatabases` if a count is needed elsewhere). Selecting a database from another category should not be possible (list is filtered), but guard `openDatabase` to ignore a mismatch.
- `newDatabase` initial state `category` → `category` prop. When the create modal opens, force `newDatabase.category = category`.
- If `selectedDatabase` is set and the `category` prop changes (tab switch), call `closeDatabase()` and reset filters — do this in a `useEffect` on `category`.

- [ ] **Step 2: Lock the create modal category**

In `CreateDatabaseModal.tsx`, render the category field as read-only (show the value, disable the `<select>`), since it's fixed by the active tab.

- [ ] **Step 3: Temporary mount**

Until Task 12, update `app/admin/databases/page.tsx` shell to `<DatabaseManager category="General" />` just to keep the build green.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`. Manual smoke checklist from Plan B — everything still works, list shows General only, create modal category is locked to General.

- [ ] **Step 5: Commit**

```bash
git add components/admin/databases/
git commit -m "feat(admin/databases): DatabaseManager takes a category prop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Admin — `CategoryTabs` + `?cat=` shell

**Files:**
- Create: `components/admin/databases/CategoryTabs.tsx`
- Modify: `app/admin/databases/page.tsx`
- Modify: `components/admin/databases/useDatabaseManager.ts` (expose per-category counts)

**Interfaces:**
```ts
interface CategoryTabsProps {
  active: "General" | "Official";
  counts: { General: number; Official: number };
  onChange: (c: "General" | "Official") => void;
}
export default function CategoryTabs(props: CategoryTabsProps): JSX.Element;
```

- [ ] **Step 1: Counts endpoint**

`/api/databases` already returns all databases. Add a tiny client fetch in the shell (or reuse): the shell fetches `/api/databases` once, computes `{ General, Official }` counts. (Keep it simple — one fetch in the shell, passed to `CategoryTabs`.)

- [ ] **Step 2: `CategoryTabs.tsx`**

```tsx
"use client";

interface CategoryTabsProps {
  active: "General" | "Official";
  counts: { General: number; Official: number };
  onChange: (c: "General" | "Official") => void;
}

export default function CategoryTabs({ active, counts, onChange }: CategoryTabsProps) {
  return (
    <div className="flex items-center gap-1.5 mb-6 p-1 rounded-xl w-fit bg-gray-50 border border-gray-100">
      {(["General", "Official"] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
          style={{
            background: active === c ? "linear-gradient(135deg,#22c55e,#16a34a)" : "transparent",
            color: active === c ? "#fff" : "#4b5563",
            boxShadow: active === c ? "0 2px 10px rgba(34,197,94,0.30)" : "none",
          }}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: active === c ? "'FILL' 1" : "'FILL' 0" }}>
            {c === "Official" ? "workspace_premium" : "school"}
          </span>
          {c}
          <span className="text-xs opacity-70">({counts[c]})</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Shell with `?cat=`**

`app/admin/databases/page.tsx`:

```tsx
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import DatabaseManager from "@/components/admin/databases/DatabaseManager";
import CategoryTabs from "@/components/admin/databases/CategoryTabs";
import { parseCategoryParam } from "@/lib/category";

function Page() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = parseCategoryParam(params.get("cat")) ?? "General";
  const [counts, setCounts] = useState({ General: 0, Official: 0 });

  useEffect(() => {
    fetch("/api/databases")
      .then((r) => r.json())
      .then((d) => {
        const list = d.databases || [];
        setCounts({
          General: list.filter((x: { category?: string }) => x.category === "General").length,
          Official: list.filter((x: { category?: string }) => x.category === "Official").length,
        });
      })
      .catch(() => {});
  }, []);

  const setCat = (c: "General" | "Official") =>
    router.replace(`${pathname}?cat=${c.toLowerCase()}`);

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
      <CategoryTabs active={active} counts={counts} onChange={setCat} />
      <DatabaseManager key={active} category={active} />
    </div>
  );
}

export default function DatabaseManagementPage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
```

(The `key={active}` forces a clean remount on tab switch — simplest correct behavior. If the Plan B `DatabaseManager` already renders its own outer `p-4 …` wrapper, drop the duplicate padding from one side.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`. Manual: `/admin/databases` → General tab default, counts shown; click Official → URL becomes `?cat=official`, list swaps to Official, create modal locked to Official; refresh on `?cat=official` stays on Official; browser back returns to General.

- [ ] **Step 5: Full gate**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all green; Vitest = prior count + `categoryFilter` tests.

- [ ] **Step 6: Commit**

```bash
git add app/admin/databases/page.tsx components/admin/databases/CategoryTabs.tsx components/admin/databases/useDatabaseManager.ts
git commit -m "feat(admin/databases): General/Official tab shell driven by ?cat=

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Plan C verification + report

- [ ] **Step 1: Full automated gate**

Run: `npx tsc --noEmit && npm test && npm run build`

- [ ] **Step 2: Manual pass (spec §11.2 items 1-5)**

1. `/verify` = General DBs + General chips only; `/official` = Official only; name search scoped on each.
2. Official cert ID on `/verify` → hint + working `/official?certId=` link; reverse too.
3. `/verify/PZ-2026-XXXXXXXX` legacy redirect still resolves / shows hint.
4. `/admin/databases` defaults General; Official tab re-scopes, create locks category, counts correct.
5. Admin refactor smoke (create DB, add participants, import, inline edit, sort/filter, bulk select) still works.

- [ ] **Step 3: Report** — confirm each check; **remind the user**: deploy `firestore.indexes.json` (`firebase deploy --only firestore:indexes`) and wait for the index build before this ships, per spec §11.4.

---

## Self-Review Notes

- **Spec §4 coverage:** routes (T9), shared leaves (T6), General scoping (T7), Official fork (T9), API filters (T2/T4/T5), cross-category hint (T5 payload + T8 UI + T9 Official side), Navbar (T10). ✅
- **Spec §5.2 coverage:** `category` prop (T11), tabs + `?cat=` (T12), create-modal lock (T11). ✅
- **Spec §11.2/11.4:** index task (T3) + deploy reminders (T3, T13). ✅
- **Type consistency:** `Category` / `parseCategoryParam` / `isCategoryMismatch` / `CATEGORY_SUBCATS` from `lib/category.ts` used identically in T1-T5, T7, T9, T11, T12. `CrossCategoryHintProps` identical in T8 (def) and T8/T9 (use). `SearchResult` exported once from `ResultCard.tsx` (T6), imported by `VerifySearch` and `OfficialSearch`.
- **Ordering:** T3 (index) before T4 (query). T6 (shared leaves) before T7/T9 (consumers). T11 (`category` prop) before T12 (shell that passes it). Plan B before all of this (T11-12 edit extracted files).
- **Deferred:** distinct Official visual identity (spec decision: same design day one). "Make public" / "Fix folder sharing" buttons from Plan A §10 — wire into `DatabaseDetail` here or in Plan D; added as a note to Plan D Task list.
