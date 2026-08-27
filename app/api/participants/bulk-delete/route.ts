import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { deleteDriveFile, fileIdFromLink } from "@/lib/driveCleanup";
import { deleteCertificateCascade } from "@/lib/certCascade";

const MAX_IDS = 500;
const CHUNK = 5;

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { databaseId, participantIds, deleteCerts = true, deletePdfs = true } =
      await request.json();

    if (!databaseId || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { error: "databaseId and a non-empty participantIds array are required" },
        { status: 400 }
      );
    }

    if (participantIds.length > MAX_IDS) {
      return NextResponse.json(
        { error: `Too many participants — cap is ${MAX_IDS} per request` },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const col = db.collection("databases").doc(databaseId).collection("participants");

    // Read the database doc once for the sheet clear at the end.
    const dbSnap = await db.collection("databases").doc(databaseId).get();
    const dbData = dbSnap.exists ? dbSnap.data() || {} : {};

    const errors: string[] = [];
    const deletedEmails: string[] = [];

    type Result = { deleted: number; certDocs: number; driveFiles: number };

    const handleOne = async (pid: string): Promise<Result> => {
      const res: Result = { deleted: 0, certDocs: 0, driveFiles: 0 };
      try {
        const snap = await col.doc(pid).get();
        const data = snap.exists ? snap.data() : null;

        if (data?.certificateId && deleteCerts) {
          const cascade = await deleteCertificateCascade({
            uniqueCertId: data.certificateId,
            clearParticipant: false,
            deleteDriveFile: deletePdfs,
          });
          res.certDocs += cascade.deletedCertDocs;
          if (cascade.driveFileDeleted) res.driveFiles++;
        }

        if (deletePdfs && !(data?.certificateId && deleteCerts)) {
          const fileId = data?.driveFileId || fileIdFromLink(data?.driveLink);
          if (fileId && (await deleteDriveFile(fileId))) res.driveFiles++;
        }

        await col.doc(pid).delete();
        res.deleted++;
        if (data?.email) deletedEmails.push(data.email);
      } catch (err) {
        errors.push(`${pid}: ${err instanceof Error ? err.message : String(err)}`);
      }
      return res;
    };

    const totals: Result = { deleted: 0, certDocs: 0, driveFiles: 0 };
    for (let i = 0; i < participantIds.length; i += CHUNK) {
      const batch = participantIds.slice(i, i + CHUNK);
      const results = await Promise.all(batch.map((pid: string) => handleOne(pid)));
      for (const r of results) {
        totals.deleted += r.deleted;
        totals.certDocs += r.certDocs;
        totals.driveFiles += r.driveFiles;
      }
    }

    // One batched sheet clear for every deleted participant (per-item cascade ran
    // with clearParticipant:false, so the sheet clear must happen once here).
    if (deletedEmails.length > 0 && dbData.sheetId && appsScriptConfigured()) {
      await callAppsScript("clearCertIdsByEmail", {
        spreadsheetId: dbData.sheetId,
        tabName: dbData.sheetTabName || "Participants",
        emails: deletedEmails,
      }).catch((e) => console.error("Bulk-delete sheet clear failed:", e));
    }

    return NextResponse.json({
      success: true,
      deleted: totals.deleted,
      certDocsDeleted: totals.certDocs,
      driveFilesDeleted: totals.driveFiles,
      errors,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Bulk delete failed", details: msg }, { status: 500 });
  }
}
