/**
 * Best-effort Google Drive cleanup + sharing, via the Apps Script bridge.
 *
 * Deletion must never block or reverse a Firestore write — every network call
 * here logs and swallows its own errors. `deleteDriveFile` / `deleteDriveFolder`
 * return the bridge's `success` flag (`false` on any failure) so callers can
 * report an accurate result instead of "a fileId existed". `fileIdFromLink` and
 * `resolveDriveFileId` are pure functions and are unit-tested.
 */
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

// Re-export for backward compatibility
export { fileIdFromLink, resolveDriveFileId } from "./driveIds";

/** @returns true only when the bridge reported the delete succeeded. */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  if (!fileId || !appsScriptConfigured()) return false;
  try {
    const res = await callAppsScript<{ success?: boolean }>("deletePDF", { fileId });
    return Boolean(res?.success);
  } catch (err) {
    console.error(`Drive file delete failed for ${fileId}:`, err);
    return false;
  }
}

/** @returns true only when the bridge reported the delete succeeded. */
export async function deleteDriveFolder(folderId: string): Promise<boolean> {
  if (!folderId || !appsScriptConfigured()) return false;
  try {
    const res = await callAppsScript<{ success?: boolean }>("deleteFolder", { folderId });
    return Boolean(res?.success);
  } catch (err) {
    console.error(`Drive folder delete failed for ${folderId}:`, err);
    return false;
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
