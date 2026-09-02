/**
 * Pure helpers for resolving Google Drive file IDs from participant records.
 * No runtime imports — only type imports for Participant.
 */
import type { Participant } from "@/lib/types";

/** Pull a Drive file id out of the two link shapes the app stores. */
export function fileIdFromLink(link?: string | null): string | null {
  if (!link) return null;
  const byPath = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (byPath) return byPath[1];
  const byQuery = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byQuery) return byQuery[1];
  return null;
}

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
