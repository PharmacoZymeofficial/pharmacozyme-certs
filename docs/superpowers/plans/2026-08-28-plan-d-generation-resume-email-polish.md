# Plan D — Generation Resume, Email Counts, Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Make bulk certificate generation survive a browser reload via a Firestore job doc + chunked writes + a resume banner. (2) Replace optimistic email totals with a real per-recipient tally, a failed list, and a "Retry failed" action. (3) Fix the two genuine eslint findings.

**Architecture:** Generation stays client-driven. A `generationJobs/{databaseId}` doc is checkpointed after each render batch; cert-doc writes flush in chunks of 25 instead of one write at 65%. On database open, a banner offers Resume/Discard. Email: the send loop accumulates every recipient outcome, persists `emailError` on failures, and the modal shows a persistent `sent / failed / queued` panel with retry. Polish: `Math.random()` in render → `useMemo`; unescaped JSX quotes.

**Tech Stack:** Next.js 16 App Router, React 19, Firebase Admin SDK, `qrcode`, `@react-pdf/renderer`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-general-official-split-and-admin-ux-design.md` (§6, §7, §8)

**Runs after:** Plan B (edits the extracted `EmailModal`, `DatabaseDetail`, `useDatabaseManager`) and Plan A (reuses nothing but shares the branch). Plan C is independent of Plan D — either order after B.

## Global Constraints

- **This is NOT the Next.js you know** — App Router, Next 16. Read `node_modules/next/dist/docs/` first for unfamiliar APIs.
- API routes: `getAdminDb()` only, `requireAdmin` guard, no `firebase-admin/auth` import.
- `generationJobs` is API-only (Admin SDK) — it stays `if false` in `firestore.rules`. Do **not** add a rules block.
- Job-doc id = the `databaseId` (one active generation per database).
- Chunked writes change the failure profile: on a mid-run error, some certs are committed. Operator messaging must say "N of M written", never "generation failed" when N > 0.
- Email scope is **counts only** — no per-row status model, no provider webhooks. Keep the `emailSent` boolean + the yes/no column. Add only `emailError`.
- Tests: `tests/*.test.ts`, `npm test`. Type check `npx tsc --noEmit`. Build `npm run build`.
- Commit after every task. End messages with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Branch: `feat/general-official-split`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/types.ts` | **Modify.** Add `GenerationJob` interface; add `emailError?: string` to `Participant`. |
| `lib/generationResume.ts` | **New.** `remainingToGenerate(participants, completedIds)` — pure, tested. |
| `lib/emailOutcome.ts` | **New.** `tallyEmailOutcomes(results)` → `{ sent, failed, queued }` — pure, tested. |
| `app/api/generation-jobs/[databaseId]/route.ts` | **New.** GET / PUT / DELETE the job doc. |
| `components/CertificateGenerator.tsx` | **Modify.** Checkpoint job doc, chunk cert writes, resume mode. |
| `components/admin/databases/GenerationResumeBanner.tsx` | **New.** Resume/Discard banner. |
| `components/admin/databases/DatabaseDetail.tsx` | **Modify.** Render the banner. |
| `components/admin/databases/useDatabaseManager.ts` | **Modify.** Fetch the job doc on open; expose resume state + handlers. |
| `components/admin/databases/modals/EmailModal.tsx` | **Modify.** Persistent result panel + failed list + retry. |
| `components/admin/databases/useDatabaseManager.ts` | **Modify.** `handleSendEmails` accumulates outcomes, persists `emailError`, exposes `emailResult` + `retryFailed`. |
| `components/VerificationResult.tsx` | **Modify.** `Math.random()` → `useMemo`. |
| `app/admin/templates/page.tsx` | **Modify (T12).** "Make public" when a template upload reports `sharingFailed`. |
| `components/admin/databases/DatabaseDetail.tsx` | **Modify (T6, T12).** Resume banner + "Fix folder sharing" button. |
| `tests/generationResume.test.ts` | **New.** |
| `tests/emailOutcome.test.ts` | **New.** |

---

## Task 1: Types — `GenerationJob` + `Participant.emailError`

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces:
```ts
export interface GenerationJob {
  databaseId: string;
  total: number;
  completedParticipantIds: string[];
  phase: "rendering" | "drive-upload" | "sheet-sync";
  startedAt: string;
  updatedAt: string;
  startedBy: string;
}
```
- `Participant` gains `emailError?: string`.

- [ ] **Step 1: Edit `lib/types.ts`**

Add `emailError?: string;` to the `Participant` interface (next to `emailSentAt`). Append the `GenerationJob` interface at the end of the file.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add GenerationJob + Participant.emailError

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `lib/generationResume.ts` + tests

**Files:**
- Create: `lib/generationResume.ts`
- Test: `tests/generationResume.test.ts`

**Interfaces:**
- Produces: `remainingToGenerate(participants: Pick<Participant, "id" | "certificateId">[], completedIds: string[]): string[]` — returns the ids still needing generation: those NOT in `completedIds` AND without an existing `certificateId`.

- [ ] **Step 1: Failing test**

Create `tests/generationResume.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { remainingToGenerate } from "@/lib/generationResume";

describe("remainingToGenerate", () => {
  const ps = [
    { id: "a", certificateId: "" },
    { id: "b", certificateId: "" },
    { id: "c", certificateId: "PZ-2026-DEADBEEF" }, // already has a cert
    { id: "d", certificateId: "" },
  ];

  it("excludes completed ids and participants that already hold a certificateId", () => {
    expect(remainingToGenerate(ps, ["a"])).toEqual(["b", "d"]);
  });

  it("returns everything eligible when nothing is completed", () => {
    expect(remainingToGenerate(ps, [])).toEqual(["a", "b", "d"]);
  });

  it("returns [] when all are done", () => {
    expect(remainingToGenerate(ps, ["a", "b", "d"])).toEqual([]);
  });

  it("ignores participants without an id", () => {
    expect(remainingToGenerate([{ id: undefined, certificateId: "" }], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/generationResume.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

Create `lib/generationResume.ts`:

```ts
import type { Participant } from "@/lib/types";

/**
 * Ids still needing certificate generation: not already checkpointed as complete,
 * and not already carrying a certificateId. Used by the resume flow so a reloaded
 * generation continues instead of restarting or double-minting.
 */
export function remainingToGenerate(
  participants: Pick<Participant, "id" | "certificateId">[],
  completedIds: string[]
): string[] {
  const done = new Set(completedIds);
  return participants
    .filter((p): p is { id: string; certificateId?: string } => Boolean(p.id))
    .filter((p) => !done.has(p.id) && !p.certificateId)
    .map((p) => p.id);
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/generationResume.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/generationResume.ts tests/generationResume.test.ts
git commit -m "feat: add remainingToGenerate resume-filter helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `app/api/generation-jobs/[databaseId]/route.ts`

**Files:**
- Create: `app/api/generation-jobs/[databaseId]/route.ts`

**Interfaces:**
- `GET /api/generation-jobs/{databaseId}` → `{ job: GenerationJob }` or `404 { error }`.
- `PUT /api/generation-jobs/{databaseId}` body `Partial<GenerationJob>` → merges, sets `updatedAt`, returns `{ success: true }`.
- `DELETE /api/generation-jobs/{databaseId}` → `{ success: true }`.

- [ ] **Step 1: Write the route**

Create `app/api/generation-jobs/[databaseId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";

const PHASES = ["rendering", "drive-upload", "sheet-sync"] as const;

function jobRef(databaseId: string) {
  return getAdminDb().collection("generationJobs").doc(databaseId);
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ databaseId: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await ctx.params;
  const snap = await jobRef(databaseId).get();
  if (!snap.exists) return NextResponse.json({ error: "No job" }, { status: 404 });
  return NextResponse.json({ job: { databaseId, ...snap.data() } });
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ databaseId: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await ctx.params;

  const body = await request.json();
  const patch: Record<string, unknown> = { databaseId, updatedAt: new Date().toISOString() };

  if (typeof body.total === "number") patch.total = body.total;
  if (Array.isArray(body.completedParticipantIds)) {
    patch.completedParticipantIds = body.completedParticipantIds.filter((x: unknown) => typeof x === "string");
  }
  if (PHASES.includes(body.phase)) patch.phase = body.phase;
  if (typeof body.startedAt === "string") patch.startedAt = body.startedAt;
  patch.startedBy = guard.session.email || "unknown";
  if (!patch.startedAt) {
    const existing = await jobRef(databaseId).get();
    patch.startedAt = existing.exists ? existing.data()?.startedAt || patch.updatedAt : patch.updatedAt;
  }

  await jobRef(databaseId).set(patch, { merge: true });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ databaseId: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await ctx.params;
  await jobRef(databaseId).delete();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass; `/api/generation-jobs/[databaseId]` in the route list. (If `guard.session.email` is not typed, check `lib/session.ts` `SessionPayload` — it has `email`. If not, use `(guard.session as { email?: string }).email`.)

- [ ] **Step 3: Commit**

```bash
git add app/api/generation-jobs/[databaseId]/route.ts
git commit -m "feat(api): add generation-jobs/[databaseId] GET/PUT/DELETE

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `CertificateGenerator` — checkpoint + chunked writes

**Files:**
- Modify: `components/CertificateGenerator.tsx`

**Interfaces:**
- Consumes: `remainingToGenerate` from `@/lib/generationResume`; the `/api/generation-jobs/{id}` route.
- `CertificateGenerator` props gain: `resumeMode?: boolean` (when true, filter participants via the job's `completedParticipantIds` fetched on mount).

- [ ] **Step 1: Job doc at start**

In `startGeneration` (line ~515), after `participantsToGenerate` is computed (line ~531), add a helper and an initial checkpoint:

```ts
    const jobUrl = `/api/generation-jobs/${database.id}`;
    const completedIds: string[] = [];
    const checkpoint = async (phase: "rendering" | "drive-upload" | "sheet-sync") => {
      try {
        await fetch(jobUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            total: participantsToGenerate.length,
            completedParticipantIds: completedIds,
            phase,
            startedAt: new Date().toISOString(),
          }),
        });
      } catch { /* non-fatal — resume just won't be as fresh */ }
    };
    await checkpoint("rendering");
```

- [ ] **Step 2: Chunked writes in the render loop**

The render loop (lines ~604-676) currently pushes all results into `allResults` and does ONE `batch-update` at line ~697. Change it so that after each `RENDER_CONCURRENCY` batch completes, it immediately writes that batch's participant + cert docs and checkpoints:

Replace the single post-loop write (lines ~678-716) logic — move it inside the loop as a `flushChunk(batchResults)` call after `allResults.push(...)` at line ~674:

```ts
        const fresh = batchResults.filter((r) => r !== null) as RenderResult[];
        allResults.push(...fresh);

        if (fresh.length > 0) {
          const certDocs = fresh.map(({ participant, certId, verificationUrl }) => ({
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
          await fetch("/api/participants/batch-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              databaseId: database.id,
              updates: fresh.map(({ participant, certId, verificationUrl }) => ({
                id: participant.id,
                certificateId: certId,
                status: "generated",
                verificationUrl,
                certificateUrl: verificationUrl,
                issueDate,
                template: selectedTemplate,
                templateName: templateData?.name || "Standard",
              })),
              certDocs,
              skipSheetSync: true,
            }),
          });
          for (const r of fresh) if (r.participant.id) completedIds.push(r.participant.id);
          await checkpoint("rendering");
        }
```

Delete the old single batch write block that followed the loop (the `setCurrentGenerating("Saving to database…")` + `certDocs` map + `fetch("/api/participants/batch-update"...)` at lines ~678-716) since it's now done per-chunk. Keep `setGenerationProgress` updates.

- [ ] **Step 3: Phase + completion checkpoints**

- Before the Drive-upload loop (line ~719): `await checkpoint("drive-upload");`
- Before the sheet sync (line ~819): `await checkpoint("sheet-sync");`
- After `setGenerationProgress(100)` on success (line ~829): `await fetch(jobUrl, { method: "DELETE" }).catch(() => {});`
- In the `catch (err)` block (line ~855): change the toast to reflect partial progress:
  ```ts
  const written = completedIds.length;
  toast.error(
    written > 0
      ? `Generation interrupted — ${written} of ${participantsToGenerate.length} certificates written. Reopen this database to resume.`
      : "Failed to generate certificates: " + (err as Error).message
  );
  ```
  Do **not** delete the job doc on error — that's what enables resume.

- [ ] **Step 4: Resume mode**

Add `resumeMode?: boolean` to the component's props interface. When `resumeMode` is true, in `startGeneration` (or a new `resumeGeneration`), fetch the job doc first and filter:

```ts
    let participantsToGenerate = filterNewOnly
      ? sortedParticipants.filter((p) => !p.certificateId)
      : sortedParticipants;

    if (resumeMode) {
      try {
        const jr = await fetch(`/api/generation-jobs/${database.id}`);
        if (jr.ok) {
          const { job } = await jr.json();
          const remainingIds = new Set(
            remainingToGenerate(sortedParticipants, job.completedParticipantIds || [])
          );
          participantsToGenerate = sortedParticipants.filter((p) => p.id && remainingIds.has(p.id));
        }
      } catch { /* fall back to a full run */ }
    }
```

Import: `import { remainingToGenerate } from "@/lib/generationResume";`

(If the existing "existing certificates" warning at line ~504 blocks resume, skip it when `resumeMode`.)

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 6: Manual test**

Create a 6-person test database with a template. Start generation. Hard-reload the tab when the progress bar is ~40%. In Firestore, confirm `generationJobs/{dbId}` exists with a partial `completedParticipantIds`. Confirm the already-rendered participants have `status: "generated"` and a `certificateId`. (Resume UI is Task 5-6 — for now, verify the job doc + partial writes exist.)

- [ ] **Step 7: Commit**

```bash
git add components/CertificateGenerator.tsx
git commit -m "feat(generator): checkpoint generationJobs doc + chunked cert writes

A reload mid-run no longer loses rendered certs; resume mode filters completed ids.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `useDatabaseManager` — resume state

**Files:**
- Modify: `components/admin/databases/useDatabaseManager.ts`

**Interfaces:**
- Exposes:
  - `generationJob: GenerationJob | null`
  - `resumeGeneration: () => void` — opens the generator modal with `resumeMode`
  - `discardGenerationJob: () => Promise<void>` — DELETE the job doc, clear state
  - a `generatorResumeMode: boolean` flag passed to `<CertificateGenerator>`

- [ ] **Step 1: Fetch on open**

In the function that opens a database (`openDatabase` / where `setSelectedDatabase` + `fetchParticipants` happen), add:

```ts
    setGenerationJob(null);
    fetch(`/api/generation-jobs/${db.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGenerationJob(d?.job ?? null))
      .catch(() => {});
```

Add `const [generationJob, setGenerationJob] = useState<GenerationJob | null>(null);` and `const [generatorResumeMode, setGeneratorResumeMode] = useState(false);`.

- [ ] **Step 2: Handlers**

```ts
  const resumeGeneration = () => {
    setGeneratorResumeMode(true);
    setShowGeneratorModal(true);
  };

  const discardGenerationJob = async () => {
    if (!selectedDatabase?.id) return;
    await fetch(`/api/generation-jobs/${selectedDatabase.id}`, { method: "DELETE" }).catch(() => {});
    setGenerationJob(null);
  };
```

When the generator modal closes or `onGenerated` fires, `setGeneratorResumeMode(false)` and re-fetch the job doc (it's deleted on clean finish → banner disappears).

- [ ] **Step 3: Return them** — add `generationJob`, `resumeGeneration`, `discardGenerationJob`, `generatorResumeMode` to the hook's return object.

- [ ] **Step 4: Pass to the generator** — where `<CertificateGenerator>` is rendered in `DatabaseManager.tsx`, add `resumeMode={m.generatorResumeMode}`.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add components/admin/databases/useDatabaseManager.ts components/admin/databases/DatabaseManager.tsx
git commit -m "feat(admin/databases): wire generation-job resume state into the hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `GenerationResumeBanner` + render in `DatabaseDetail`

**Files:**
- Create: `components/admin/databases/GenerationResumeBanner.tsx`
- Modify: `components/admin/databases/DatabaseDetail.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx` (pass props)

**Interfaces:**
```ts
interface GenerationResumeBannerProps {
  job: GenerationJob;
  onResume: () => void;
  onDiscard: () => void;
}
export default function GenerationResumeBanner(props: GenerationResumeBannerProps): JSX.Element;
```

- [ ] **Step 1: Component**

```tsx
"use client";

import type { GenerationJob } from "@/lib/types";

interface GenerationResumeBannerProps {
  job: GenerationJob;
  onResume: () => void;
  onDiscard: () => void;
}

export default function GenerationResumeBanner({ job, onResume, onDiscard }: GenerationResumeBannerProps) {
  const done = job.completedParticipantIds?.length ?? 0;
  const stale = Date.now() - new Date(job.updatedAt).getTime() > 24 * 60 * 60 * 1000;

  return (
    <div
      className="mb-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: stale ? "#f8fafc" : "#fffbeb", border: `1px solid ${stale ? "#e2e8f0" : "#fde68a"}` }}
    >
      <span className="material-symbols-outlined" style={{ color: stale ? "#94a3b8" : "#d97706" }}>
        {stale ? "history" : "warning"}
      </span>
      <p className="text-sm flex-1" style={{ color: "#1b4332" }}>
        {stale
          ? `An old generation job is still recorded for this database (${done} of ${job.total} done, ${new Date(job.updatedAt).toLocaleDateString()}).`
          : `Generation was interrupted — ${done} of ${job.total} certificates done.`}
      </p>
      <div className="flex gap-2">
        {!stale && (
          <button
            onClick={onResume}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
          >
            Resume
          </button>
        )}
        <button
          onClick={onDiscard}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: "#fff", border: "1px solid #e5ebe5", color: "#64748b" }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it**

`DatabaseDetail` gains an optional `generationJob?: GenerationJob | null`, `onResumeGeneration?: () => void`, `onDiscardGeneration?: () => void`. Render `{generationJob && <GenerationResumeBanner job={generationJob} onResume={...} onDiscard={...} />}` just above the participants table region (below the detail header).

`DatabaseManager` passes `generationJob={m.generationJob}` etc.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 4: Manual test (end-to-end resume)**

6-person test DB. Start generation, hard-reload at ~40%. Reopen the database → banner shows "N of 6 done". Click **Resume** → generator opens, processes only the remaining participants, no duplicate cert IDs, banner gone on completion. Repeat and click **Discard** on a fresh job → banner clears, job doc deleted.

- [ ] **Step 5: Commit**

```bash
git add components/admin/databases/GenerationResumeBanner.tsx components/admin/databases/DatabaseDetail.tsx components/admin/databases/DatabaseManager.tsx
git commit -m "feat(admin/databases): generation resume banner (Resume / Discard)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `lib/emailOutcome.ts` + tests

**Files:**
- Create: `lib/emailOutcome.ts`
- Test: `tests/emailOutcome.test.ts`

**Interfaces:**
- Produces:
```ts
interface RecipientOutcome { email: string; ok: boolean; queued?: boolean; error?: string }
tallyEmailOutcomes(outcomes: RecipientOutcome[]): { sent: number; failed: number; queued: number };
```

- [ ] **Step 1: Failing test**

Create `tests/emailOutcome.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tallyEmailOutcomes } from "@/lib/emailOutcome";

describe("tallyEmailOutcomes", () => {
  it("counts sent, failed, queued distinctly", () => {
    expect(
      tallyEmailOutcomes([
        { email: "a@x.com", ok: true },
        { email: "b@x.com", ok: false, error: "550 rejected" },
        { email: "c@x.com", ok: false, queued: true },
        { email: "d@x.com", ok: true },
      ])
    ).toEqual({ sent: 2, failed: 1, queued: 1 });
  });

  it("a queued recipient is never also counted as failed", () => {
    const t = tallyEmailOutcomes([{ email: "a@x.com", ok: false, queued: true }]);
    expect(t.failed).toBe(0);
    expect(t.queued).toBe(1);
  });

  it("empty input is all zeros", () => {
    expect(tallyEmailOutcomes([])).toEqual({ sent: 0, failed: 0, queued: 0 });
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npx vitest run tests/emailOutcome.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Create `lib/emailOutcome.ts`:

```ts
export interface RecipientOutcome {
  email: string;
  ok: boolean;
  queued?: boolean;
  error?: string;
}

/** Roll per-recipient email results into a display tally. queued wins over failed. */
export function tallyEmailOutcomes(
  outcomes: RecipientOutcome[]
): { sent: number; failed: number; queued: number } {
  let sent = 0;
  let failed = 0;
  let queued = 0;
  for (const o of outcomes) {
    if (o.ok) sent++;
    else if (o.queued) queued++;
    else failed++;
  }
  return { sent, failed, queued };
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/emailOutcome.test.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/emailOutcome.ts tests/emailOutcome.test.ts
git commit -m "feat: add tallyEmailOutcomes helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `handleSendEmails` — accumulate outcomes, persist `emailError`

**Files:**
- Modify: `components/admin/databases/useDatabaseManager.ts` (the `handleSendEmails` function moved here in Plan B; currently `page.tsx:712-838`)

**Interfaces:**
- Exposes: `emailResult: { sent: number; failed: number; queued: number; failures: { email: string; name: string; error: string }[] } | null`, `retryFailed: () => void`.

- [ ] **Step 1: Don't bail the whole loop on one chunk**

In the chunk loop, the current `if (!response.ok) { ...; return; }` (lines ~757-763) abandons every remaining recipient. Replace with: record every recipient in that chunk as failed with the chunk error, then `continue`:

```ts
        if (!response.ok) {
          for (const p of chunk) {
            outcomes.push({ email: p.email, name: p.name, id: p.id, ok: false, error: result.error || `HTTP ${response.status}` });
          }
          continue;
        }
```

- [ ] **Step 2: Per-recipient outcome array**

Declare `const outcomes: { email: string; name: string; id?: string; ok: boolean; queued?: boolean; error?: string }[] = [];` before the loop. Inside, after reading `result`, map each chunk recipient using `result.results` (already `{ email, success }[]`) plus `result.errors` (`{ email, error }[]`) plus any `result.queued`/`quotaFailed` list the route returns:

```ts
        const errByEmail = new Map((result.errors || []).map((e: { email: string; error: string }) => [e.email, e.error]));
        const okEmails = new Set(((result.results || []) as { email: string; success: boolean }[]).filter((r) => r.success).map((r) => r.email));
        const queuedEmails = new Set((result.queued || result.quotaFailed || []).map((q: { email?: string } | string) => (typeof q === "string" ? q : q.email)));
        for (const p of chunk) {
          outcomes.push({
            email: p.email,
            name: p.name,
            id: p.id,
            ok: okEmails.has(p.email),
            queued: queuedEmails.has(p.email),
            error: errByEmail.get(p.email),
          });
        }
```

- [ ] **Step 3: Persist `emailError`**

After the loop, batch-update the failed (non-queued) participants:

```ts
      const failedIds = outcomes.filter((o) => !o.ok && !o.queued && o.id).map((o) => o.id!) ;
      if (failedIds.length > 0 && selectedDatabase?.id) {
        await fetch("/api/participants/batch-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            databaseId: selectedDatabase.id,
            participantIds: failedIds,
            fields: { emailError: "Last send failed" },
            skipSheetSync: true,
          }),
        }).catch(() => {});
      }
```
(And clear `emailError` for the ones that succeeded — extend the existing `emailSent: true` batch-update `fields` to `{ emailSent: true, emailError: "" }`.)

- [ ] **Step 4: Expose the result**

```ts
      const tally = tallyEmailOutcomes(outcomes);
      setEmailResult({
        ...tally,
        failures: outcomes.filter((o) => !o.ok && !o.queued).map((o) => ({ email: o.email, name: o.name, error: o.error || "Unknown error" })),
      });
```
Add `const [emailResult, setEmailResult] = useState<{ sent: number; failed: number; queued: number; failures: { email: string; name: string; error: string }[] } | null>(null);` and import `tallyEmailOutcomes`. Reset it to `null` in `openEmailModal`.

Replace the final toast (line ~827) with one built from `tally`:
```ts
      toast.success(`${tally.sent} sent${tally.failed ? `, ${tally.failed} failed` : ""}${tally.queued ? `, ${tally.queued} queued` : ""}.`);
```
Remove the `setShowEmailModal(false)` from the `finally` (line ~836) — keep the modal open so the result panel is visible; the user closes it.

- [ ] **Step 5: `retryFailed`**

```ts
  const retryFailed = () => {
    if (!emailResult?.failures.length) return;
    const failedEmails = new Set(emailResult.failures.map((f) => f.email));
    setSelectedParticipants(participants.filter((p) => failedEmails.has(p.email)).map((p) => p.id!).filter(Boolean));
    setEmailResult(null);
    handleSendEmails();
  };
```
Return `emailResult` and `retryFailed` from the hook.

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add components/admin/databases/useDatabaseManager.ts
git commit -m "feat(email): real per-recipient outcome tally + persist emailError

The send loop no longer abandons remaining recipients on one chunk failure.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `EmailModal` — result panel + failed list + retry

**Files:**
- Modify: `components/admin/databases/modals/EmailModal.tsx`
- Modify: `components/admin/databases/DatabaseManager.tsx` (pass `emailResult`, `onRetryFailed`)
- Modify: `components/admin/databases/ParticipantRow.tsx` (show a failed marker)

**Interfaces:**
- `EmailModal` props gain: `emailResult: { sent: number; failed: number; queued: number; failures: { email: string; name: string; error: string }[] } | null`, `onRetryFailed: () => void`.

- [ ] **Step 1: Result panel**

In `EmailModal`, when `emailResult` is set, render below the compose area (and hide the "Send" button, show "Close" + "Retry failed"):

```tsx
{emailResult && (
  <div className="mt-4 rounded-xl border border-gray-100 p-4">
    <p className="text-sm font-semibold text-brand-dark-green">
      {emailResult.sent} sent
      {emailResult.failed > 0 && <span className="text-red-600"> · {emailResult.failed} failed</span>}
      {emailResult.queued > 0 && <span className="text-amber-600"> · {emailResult.queued} queued</span>}
    </p>
    {emailResult.failures.length > 0 && (
      <>
        <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-gray-600 space-y-1">
          {emailResult.failures.map((f) => (
            <li key={f.email}><span className="font-medium">{f.name}</span> ({f.email}) — {f.error}</li>
          ))}
        </ul>
        <button
          onClick={onRetryFailed}
          className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer"
          style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
        >
          Retry failed ({emailResult.failures.length})
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: Row marker**

In `ParticipantRow.tsx`, in the "Emailed" cell: keep the yes/no, but when `participant.emailError` is set and `!participant.emailSent`, render a small red "failed" chip with `title={participant.emailError}`.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 4: Manual test**

Send to 3 test recipients, one with an invalid domain (`x@nonexistent.invalid`). Expect: panel shows `2 sent · 1 failed`, the failed one listed, "Retry failed (1)" re-sends only it. The failed row shows the red marker; a later success clears it.

- [ ] **Step 5: Commit**

```bash
git add components/admin/databases/modals/EmailModal.tsx components/admin/databases/DatabaseManager.tsx components/admin/databases/ParticipantRow.tsx
git commit -m "feat(email): result panel with failed list + retry, row failure marker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: `/api/email-stats` audit + `/api/send-email` counter check

**Files:**
- Read: `app/api/email-stats/route.ts`, `app/api/send-email/route.ts`

- [ ] **Step 1: Verify the counter is incremented only on real sends**

Read `app/api/send-email/route.ts`. Confirm the `email_stats/{today}` Firestore counter (`sent`, `brevo_*` keys) is incremented **only** for recipients that actually sent — not for queued/simulated/failed ones. The Resend no-key simulated path must **not** increment (per the shipped `ALLOW_SIMULATED_EMAIL` fix). If you find it over-counting, fix it: move the `FieldValue.increment` call after the per-recipient success check.

- [ ] **Step 2: Confirm `email-stats` reads real data**

`app/api/email-stats/route.ts` reads the Resend live API + the Firestore counters — no change needed if Step 1 is clean. Note the finding in the commit either way.

- [ ] **Step 3: Typecheck + build (only if you changed send-email)**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: Commit**

```bash
git add app/api/send-email/route.ts
git commit -m "fix(email): increment the daily counter only on confirmed sends"  # or: "chore: audited email-stats — counters already accurate"
```
(Use the no-op commit message form if nothing needed changing — or skip the commit and just note it in the report.)

---

## Task 11: Polish — `VerificationResult` + JSX quotes

**Files:**
- Modify: `components/VerificationResult.tsx`
- Modify: whichever files `npx eslint .` flags for `react/no-unescaped-entities` (from CONTEXT: `VerificationResult.tsx` + "a couple" others)

- [ ] **Step 1: `Math.random()` → stable memo**

In `components/VerificationResult.tsx`, the confetti map (lines ~92-104) calls `Math.random()` three times per item during render (`react-hooks/purity`). Precompute once:

```tsx
import { useMemo } from "react";
// inside the component:
const confetti = useMemo(
  () =>
    Array.from({ length: 22 }).map((_, i) => ({
      left: 5 + Math.random() * 90,
      fallDur: 0.7 + Math.random() * 1.3,
      delay: Math.random() * 0.5,
      rotate: Math.random() * 360,
      color: ["#22c55e", "#16a34a", "#4ade80", "#fbbf24", "#60a5fa", "#f472b6", "#a78bfa"][i % 7],
    })),
  []
);
```

Then render from `confetti`:
```tsx
{showConfetti && (
  <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden rounded-2xl">
    {confetti.map((c, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 rounded-sm"
        style={{
          left: `${c.left}%`,
          top: "-8px",
          background: c.color,
          animation: `fall ${c.fallDur}s ease-in ${c.delay}s forwards`,
          transform: `rotate(${c.rotate}deg)`,
        }}
      />
    ))}
  </div>
)}
```

- [ ] **Step 2: Run eslint, fix unescaped quotes**

Run: `npx eslint . 2>&1 | grep -E "no-unescaped-entities|purity"`
For each hit, replace a bare `"` inside JSX text with `&quot;` (or wrap the text in `{'"..."'}`). Only touch the flagged lines. Confirm the `purity` warning for `VerificationResult.tsx` is gone.

- [ ] **Step 3: Typecheck + build + test**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all pass. Confetti still animates on a successful verification (manual check on `/verify`).

- [ ] **Step 4: Commit**

```bash
git add components/VerificationResult.tsx
git commit -m "fix(polish): memoise confetti randomness, escape JSX quotes

Clears the react-hooks/purity finding from the security-pass eslint sweep.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Drive sharing UI (spec §10.2)

**Files:**
- Modify: `app/admin/templates/page.tsx`
- Modify: `components/admin/databases/DatabaseDetail.tsx`
- Modify: `components/admin/databases/useDatabaseManager.ts`

**Interfaces:**
- Consumes: `POST /api/drive/ensure-public { fileId?, folderId? }` (from Plan A Task 8).

- [ ] **Step 1: Templates page — "Make public"**

In `app/admin/templates/page.tsx`, the upload success handler (around line 523) reads `data.sharingFailed` (Plan A adds it to the response). When `data.success && data.sharingFailed`, show a non-blocking toast/alert with a button that calls:

```ts
await fetch("/api/drive/ensure-public", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fileId: data.template.driveFileId }),
});
```
then re-check. If the page has no toast system, add a small inline banner on the template card list ("Not public — Make public") gated on a per-template `sharingFailed` you store in state after upload.

- [ ] **Step 2: DatabaseDetail — "Fix folder sharing"**

`DatabaseDetail` gains `onFixFolderSharing?: () => void`. Render a small button in the Drive tool group (next to the existing Drive folder link, markers ~1803-1837) shown whenever `database.driveFolderId` is set:

```tsx
{database.driveFolderId && onFixFolderSharing && (
  <button onClick={onFixFolderSharing} className="text-xs text-blue-600 hover:underline cursor-pointer">
    Fix folder sharing
  </button>
)}
```

- [ ] **Step 3: Hook handler**

In `useDatabaseManager.ts`:

```ts
  const fixFolderSharing = async () => {
    if (!selectedDatabase?.driveFolderId) return;
    const res = await fetch("/api/drive/ensure-public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: selectedDatabase.driveFolderId }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.shared) toast.success("Folder is now shared with anyone who has the link.");
    else toast.error("Could not make the folder public — the bridge account may block link sharing.");
  };
```
Return it; `DatabaseManager` passes `onFixFolderSharing={m.fixFolderSharing}` to `DatabaseDetail`.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 5: Manual test (post Apps Script redeploy)**

On an already-public folder, "Fix folder sharing" returns success. Upload a template — if the bridge account allows link sharing there's no `sharingFailed` prompt (expected); if you can reproduce a restricted account, the "Make public" button appears and (on that account) reports it cannot override the policy.

- [ ] **Step 6: Commit**

```bash
git add app/admin/templates/page.tsx components/admin/databases/DatabaseDetail.tsx components/admin/databases/useDatabaseManager.ts components/admin/databases/DatabaseManager.tsx
git commit -m "feat(drive): Make public / Fix folder sharing UI actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Plan D verification + report

- [ ] **Step 1: Full automated gate**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; Vitest = prior count + `generationResume` (4) + `emailOutcome` (3); build succeeds.

- [ ] **Step 2: Manual pass (spec §11.2 items 6-7)**

6. Bulk generation: ~30-person test DB, reload mid-render → resume banner with correct count → Resume processes only the remainder, no duplicate IDs → Discard on a fresh job clears it.
7. Email: small list with one forced failure → panel shows `N sent · 1 failed`, failed listed, Retry re-sends only that one, row marker appears then clears on success.

- [ ] **Step 3: Report** — confirm each; note the email-stats audit outcome; list new files/collections (`generationJobs`). Remind: no new env vars, no rules change, but a Vercel deploy is needed and the blue-dot SHA must be verified (spec §11.4).

---

## Self-Review Notes

- **Spec §6 coverage:** `GenerationJob` type (T1), resume helper + tests (T2), job route (T3), checkpoint + chunked writes + resume mode (T4), hook state (T5), banner (T6). Stale >24h handling in the banner (T6). Partial-write messaging (T4 step 3). ✅
- **Spec §7 coverage:** `emailError` field (T1), tally helper + tests (T7), loop no longer bails + persists errors (T8), result panel + failed list + retry (T9), row marker (T9), email-stats audit (T10). ✅
- **Spec §8 coverage:** `Math.random()` → `useMemo` (T11), JSX quote escapes (T11). Navbar `<a>`→`Link` is in Plan C Task 10. `no-explicit-any` deliberately untouched. ✅
- **Spec §10.2 UI coverage:** "Make public" (templates) + "Fix folder sharing" (`DatabaseDetail`) — Task 12, consuming the `/api/drive/ensure-public` route and `sharingFailed` flag from Plan A. ✅
- **Type consistency:** `GenerationJob` (T1) used in T3/T5/T6. `remainingToGenerate` signature identical T2/T4. `tallyEmailOutcomes` / `RecipientOutcome` identical T7/T8. `emailResult` shape identical in T8 (producer), T9 (`EmailModal` prop), `DatabaseManager` (passthrough).
- **Ordering:** T1 before all. T2 before T4. T3 before T4/T5. T4 before T5 before T6. T7 before T8 before T9. T8 edits the Plan-B-extracted `useDatabaseManager` — Plan B must be done. T12 consumes Plan A's `/api/drive/ensure-public` — Plan A must be done.
