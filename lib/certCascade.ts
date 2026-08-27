/**
 * The single "delete a certificate everywhere" routine.
 *
 * Used by DELETE /api/certificates, DELETE /api/certificates/[id], and the
 * participant + bulk delete routes. Deletes: the certificates doc(s), the Drive
 * PDF, and (unless clearParticipant === false) resets the linked participant and
 * clears the sheet cert-id cell. Drive + sheet steps are best-effort.
 */
import { getAdminDb } from "@/lib/firebase.admin";
import { deleteDriveFile, fileIdFromLink } from "@/lib/driveCleanup";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

interface CascadeOpts {
  certDocId?: string;
  uniqueCertId?: string;
  clearParticipant?: boolean; // default true
  deleteDriveFile?: boolean; // default true — only `=== false` opts out
}

export async function deleteCertificateCascade(
  opts: CascadeOpts
): Promise<{ deletedCertDocs: number; driveFileDeleted: boolean; participantCleared: boolean }> {
  const db = getAdminDb();
  const clearParticipant = opts.clearParticipant !== false;
  const dropDriveFile = opts.deleteDriveFile !== false;

  // Resolve the cert doc(s).
  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  if (opts.certDocId) {
    const snap = await db.collection("certificates").doc(opts.certDocId).get();
    if (snap.exists) docs = [snap as FirebaseFirestore.QueryDocumentSnapshot];
  } else if (opts.uniqueCertId) {
    const q = await db
      .collection("certificates")
      .where("uniqueCertId", "==", opts.uniqueCertId)
      .get();
    docs = q.docs;
  }

  let driveFileDeleted = false;
  let participantCleared = false;

  for (const doc of docs) {
    const data = doc.data() || {};
    const fileId = data.driveFileId || fileIdFromLink(data.driveLink) || fileIdFromLink(data.pdfUrl);
    if (dropDriveFile && fileId) {
      if (await deleteDriveFile(fileId)) driveFileDeleted = true;
    }

    if (clearParticipant && data.databaseId && data.participantId) {
      try {
        const pRef = db
          .collection("databases")
          .doc(data.databaseId)
          .collection("participants")
          .doc(data.participantId);
        const pSnap = await pRef.get();
        if (pSnap.exists) {
          const reset: Record<string, unknown> = {
            certificateId: "",
            certificateUrl: "",
            verificationUrl: "",
            status: "pending",
            emailSent: false,
            updatedAt: new Date().toISOString(),
          };
          // Keep the participant's PDF pointers when the caller opted to keep the file.
          if (dropDriveFile) {
            reset.driveLink = "";
            reset.driveFileId = "";
          }
          await pRef.update(reset);
          participantCleared = true;

          const email = pSnap.data()?.email;
          const dbSnap = await db.collection("databases").doc(data.databaseId).get();
          const dbData = dbSnap.data() || {};
          if (email && dbData.sheetId && appsScriptConfigured()) {
            await callAppsScript("clearCertIdsByEmail", {
              spreadsheetId: dbData.sheetId,
              tabName: dbData.sheetTabName || "Participants",
              emails: [email],
            }).catch((e) => console.error("Sheet cert-id clear failed:", e));
          }
        }
      } catch (err) {
        console.error("Participant reset after cert delete failed:", err);
      }
    }

    await doc.ref.delete();
  }

  return { deletedCertDocs: docs.length, driveFileDeleted, participantCleared };
}
