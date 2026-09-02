import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { deleteDriveFile, resolveDriveFileId } from "@/lib/driveCleanup";
import { deleteCertificateCascade } from "@/lib/certCascade";

async function getSheetInfo(databaseId: string) {
  const dbSnap = await getAdminDb().collection("databases").doc(databaseId).get();
  if (!dbSnap.exists) return null;
  const d = dbSnap.data() || {};
  if (!d.sheetId) return null;
  return { spreadsheetId: d.sheetId, tabName: d.sheetTabName || "Participants" };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { databaseId } = body;

    if (!id) return NextResponse.json({ error: "Participant ID is required" }, { status: 400 });
    if (!databaseId) return NextResponse.json({ error: "Database ID is required" }, { status: 400 });

    const participantRef = getAdminDb()
      .collection("databases")
      .doc(databaseId)
      .collection("participants")
      .doc(id);

    const { databaseId: _omit, ...updateData } = body;
    await participantRef.update({ ...updateData, updatedAt: new Date().toISOString() });

    if (appsScriptConfigured()) {
      try {
        const sheet = await getSheetInfo(databaseId);
        if (sheet) {
          const snap = await participantRef.get();
          const p = snap.exists ? snap.data() : null;
          if (p) {
            await callAppsScript("upsertRow", {
              ...sheet,
              row: {
                certificateId: p.certificateId || "",
                name: p.name || "",
                email: p.email || "",
                certificateUrl: p.certificateUrl || "",
                status: p.status || "pending",
                issueDate: p.issueDate || "",
                emailSent: p.emailSent || false,
                driveLink: p.driveLink || "",
                createdAt: p.createdAt || "",
              },
            });
          }
        }
      } catch (syncErr) {
        console.error("Sheet upsert failed after participant update:", syncErr);
      }
    }

    return NextResponse.json({ success: true, message: "Participant updated" });
  } catch (error: any) {
    console.error("Error updating participant:", error);
    return NextResponse.json(
      { error: "Failed to update participant", details: error?.message || error?.toString() },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const databaseId = searchParams.get("databaseId");
    const keepPdf = searchParams.get("keepPdf") === "true";
    // ?keepCert=true → leave the linked certificate doc + its PDF untouched.
    // undo/redo round-trips a delete + re-POST and must stay reversible.
    const keepCert = searchParams.get("keepCert") === "true";

    if (!id) return NextResponse.json({ error: "Participant ID is required" }, { status: 400 });
    if (!databaseId) return NextResponse.json({ error: "Database ID is required" }, { status: 400 });

    const participantRef = getAdminDb()
      .collection("databases")
      .doc(databaseId)
      .collection("participants")
      .doc(id);
    const participantSnap = await participantRef.get();
    const participantData = participantSnap.exists ? participantSnap.data() : null;

    // Cascade the linked certificate doc + its Drive file first (best-effort).
    if (participantData?.certificateId && !keepCert) {
      await deleteCertificateCascade({
        uniqueCertId: participantData.certificateId,
        clearParticipant: false, // the participant is about to be deleted outright
        deleteDriveFile: !keepPdf,
      }).catch((e) => console.error("Cert cascade during participant delete failed:", e));
    }

    // Delete the participant's own Drive file — but only when the cert cascade above
    // did NOT already handle it (a cert'd participant's file is deleted by the cascade).
    if (!keepPdf && !(participantData?.certificateId && !keepCert)) {
      const fileId = resolveDriveFileId(participantData || {});
      if (fileId) await deleteDriveFile(fileId);
    }

    await participantRef.delete();

    // Remove the participant's Sheet row entirely (cert id if we have one, else
    // name+email). Best-effort — a redeploy of apps-script.js enables deleteRows.
    if (appsScriptConfigured()) {
      try {
        const sheet = await getSheetInfo(databaseId);
        if (sheet && participantData) {
          const match = participantData.certificateId
            ? { certificateId: participantData.certificateId }
            : { name: participantData.name || "", email: participantData.email || "" };
          await callAppsScript("deleteRows", { ...sheet, matches: [match] });
        }
      } catch (syncErr) {
        console.error("Sheet row delete failed after participant deletion:", syncErr);
      }
    }

    return NextResponse.json({ success: true, message: "Participant deleted" });
  } catch (error: any) {
    console.error("Error deleting participant:", error);
    return NextResponse.json(
      { error: "Failed to delete participant", details: error?.message },
      { status: 500 }
    );
  }
}
