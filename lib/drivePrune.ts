/**
 * Pure helper for the "Remove duplicate files" action.
 *
 * The Apps Script side trashes every PDF in a database's Drive folder whose id
 * is NOT in the keep list. The keep list is the Drive file id of each
 * participant's *current* certificate PDF, straight from Firestore — so a stale
 * re-generated copy, an orphan, or a same-name duplicate all fall outside it
 * and get trashed. An empty keep list means the folder link is broken; callers
 * must refuse to prune in that case rather than wipe the whole folder.
 */
import type { Participant } from "@/lib/types";
import { resolveDriveFileId } from "@/lib/driveIds";

/** Distinct Drive file ids of the certificate PDFs currently linked to participants. */
export function buildKeepFileIds(
  participants: Pick<Participant, "driveFileId" | "driveLink">[]
): string[] {
  const ids = new Set<string>();
  for (const p of participants) {
    const id = resolveDriveFileId(p);
    if (id) ids.add(id);
  }
  return [...ids];
}
