import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { sortParticipantsForSheet } from "@/lib/participantSort";

// Two call signatures:
// A) Per-participant: { databaseId, updates: [{id, ...fields}] }
// B) Same fields for all: { databaseId, participantIds: string[], fields: Record<string, any> }
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { databaseId, skipSheetSync } = body;

    if (!databaseId) return NextResponse.json({ error: "databaseId required" }, { status: 400 });

    const adminDb = getAdminDb();
    const participantsRef = adminDb.collection("databases").doc(databaseId).collection("participants");
    const now = new Date().toISOString();
    const CHUNK = 500;

    if (Array.isArray(body.updates) && body.updates.length > 0) {
      const updates: Array<{ id: string; [key: string]: any }> = body.updates;
      const certDocs: any[] = Array.isArray(body.certDocs) ? body.certDocs : [];
      const certificatesRef = adminDb.collection("certificates");
      // Participant .update()s and their cert-doc .set()s go in ONE batch per
      // chunk, committed together — otherwise a certDocs failure after the
      // participant commit leaves a participant with a cert ID and no cert doc,
      // permanently unrepairable. 200 updates + up to 200 certDocs = 400 < 500.
      const COMBINED_CHUNK = 200;
      const chunkCount = Math.max(
        Math.ceil(updates.length / COMBINED_CHUNK),
        Math.ceil(certDocs.length / COMBINED_CHUNK)
      );
      for (let c = 0; c < chunkCount; c++) {
        const batch = adminDb.batch();
        for (const upd of updates.slice(c * COMBINED_CHUNK, (c + 1) * COMBINED_CHUNK)) {
          const { id, ...fields } = upd;
          batch.update(participantsRef.doc(id), { ...fields, updatedAt: now });
        }
        for (const certDoc of certDocs.slice(c * COMBINED_CHUNK, (c + 1) * COMBINED_CHUNK)) {
          batch.set(certificatesRef.doc(), certDoc);
        }
        await batch.commit();
      }

      if (!skipSheetSync) await syncAllToSheet(databaseId);
      return NextResponse.json({ success: true, updated: updates.length });
    }

    if (Array.isArray(body.participantIds) && body.participantIds.length > 0 && body.fields) {
      const ids: string[] = body.participantIds;
      const fields: Record<string, any> = body.fields;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const batch = adminDb.batch();
        for (const id of ids.slice(i, i + CHUNK)) {
          batch.update(participantsRef.doc(id), { ...fields, updatedAt: now });
        }
        await batch.commit();
      }
      if (!skipSheetSync) await syncAllToSheet(databaseId);
      return NextResponse.json({ success: true, updated: ids.length });
    }

    return NextResponse.json({ error: "Provide updates[] or participantIds+fields" }, { status: 400 });
  } catch (error: any) {
    console.error("Batch update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function syncAllToSheet(databaseId: string) {
  if (!appsScriptConfigured()) return;
  try {
    const adminDb = getAdminDb();
    const dbSnap = await adminDb.collection("databases").doc(databaseId).get();
    if (!dbSnap.exists) return;
    const dbData = dbSnap.data() || {};
    if (!dbData.sheetId) return;

    const participantsSnap = await adminDb
      .collection("databases")
      .doc(databaseId)
      .collection("participants")
      .get();
    const all = participantsSnap.docs.map((d) => d.data() as any);
    const sorted = sortParticipantsForSheet(all);

    await callAppsScript("syncData", {
      spreadsheetId: dbData.sheetId,
      tabName: dbData.sheetTabName || "Participants",
      // Key must be `participants` — the header-aware syncData write reads
      // `payload.participants` and ignores `data` (the pre-header-mapping key).
      participants: sorted.map((p) => ({
        certificateId: p.certificateId || "",
        name: p.name || "",
        email: p.email || "",
        certificateUrl: p.certificateUrl || "",
        status: p.status || "pending",
        issueDate: p.issueDate || "",
        emailSent: p.emailSent || false,
        driveLink: p.driveLink || "",
        createdAt: p.createdAt || "",
      })),
      mode: "write",
    });
  } catch (err) {
    console.error("Sheet full-sync failed after batch-update:", err);
  }
}
