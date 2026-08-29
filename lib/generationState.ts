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
