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
