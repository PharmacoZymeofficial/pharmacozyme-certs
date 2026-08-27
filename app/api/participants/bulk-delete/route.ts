import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { deleteDriveFile, fileIdFromLink } from "@/lib/driveCleanup";
import { deleteCertificateCascade } from "@/lib/certCascade";

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

    const db = getAdminDb();
    const col = db.collection("databases").doc(databaseId).collection("participants");
    const errors: string[] = [];
    let certDocsDeleted = 0;
    let driveFilesDeleted = 0;
    let deleted = 0;

    for (const pid of participantIds) {
      try {
        const snap = await col.doc(pid).get();
        const data = snap.exists ? snap.data() : null;

        if (data?.certificateId && deleteCerts) {
          const res = await deleteCertificateCascade({
            uniqueCertId: data.certificateId,
            clearParticipant: false,
          });
          certDocsDeleted += res.deletedCertDocs;
          if (res.driveFileDeleted) driveFilesDeleted++;
        }

        if (deletePdfs) {
          const fileId = data?.driveFileId || fileIdFromLink(data?.driveLink);
          if (fileId && !(data?.certificateId && deleteCerts)) {
            await deleteDriveFile(fileId);
            driveFilesDeleted++;
          }
        }

        await col.doc(pid).delete();
        deleted++;
      } catch (err) {
        errors.push(`${pid}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      certDocsDeleted,
      driveFilesDeleted,
      errors,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Bulk delete failed", details: msg }, { status: 500 });
  }
}
