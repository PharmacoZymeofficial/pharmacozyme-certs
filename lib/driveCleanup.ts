/**
 * Best-effort Google Drive cleanup + sharing, via the Apps Script bridge.
 *
 * Deletion must never block or reverse a Firestore write — every network call
 * here logs and swallows its own errors. `fileIdFromLink` is the one pure
 * function and is unit-tested.
 */
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

/** Pull a Drive file id out of the two link shapes the app stores. */
export function fileIdFromLink(link?: string | null): string | null {
  if (!link) return null;
  const byPath = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (byPath) return byPath[1];
  const byQuery = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (byQuery) return byQuery[1];
  return null;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  if (!fileId || !appsScriptConfigured()) return;
  try {
    await callAppsScript("deletePDF", { fileId });
  } catch (err) {
    console.error(`Drive file delete failed for ${fileId}:`, err);
  }
}

export async function deleteDriveFolder(folderId: string): Promise<void> {
  if (!folderId || !appsScriptConfigured()) return;
  try {
    await callAppsScript("deleteFolder", { folderId });
  } catch (err) {
    console.error(`Drive folder delete failed for ${folderId}:`, err);
  }
}

export async function ensureDrivePublic(
  target: { fileId?: string; folderId?: string }
): Promise<{ shared: boolean }> {
  if ((!target.fileId && !target.folderId) || !appsScriptConfigured()) {
    return { shared: false };
  }
  try {
    const res = await callAppsScript<{ success?: boolean; shared?: boolean }>(
      "ensurePublic",
      target
    );
    return { shared: Boolean(res?.shared ?? res?.success) };
  } catch (err) {
    console.error("ensureDrivePublic failed:", err);
    return { shared: false };
  }
}
