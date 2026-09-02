import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript } from "@/lib/appsScript";
import { sortParticipantsForSheet } from "@/lib/participantSort";
import { MANAGED_FIELDS } from "@/lib/sheetSchema";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { databaseId, mode } = body;

    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const dbSnap = await adminDb.collection("databases").doc(databaseId).get();

    if (!dbSnap.exists) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const dbData = dbSnap.data() || {};
    const spreadsheetId = dbData.sheetId;
    const tabName = dbData.sheetTabName || "Participants";

    if (!spreadsheetId) {
      return NextResponse.json({ error: "No linked Google Sheet" }, { status: 400 });
    }

    if (mode === "firebaseToSheets") {
      const participantsSnap = await adminDb
        .collection("databases")
        .doc(databaseId)
        .collection("participants")
        .get();

      const participants = participantsSnap.docs.map((d) => d.data() as any);
      const sortedParticipants = sortParticipantsForSheet(participants);

      // Send only the managed fields; the Apps Script row-matches by name+email and
      // preserves every custom column it finds. No headers/writeHeaders anymore.
      const rows = sortedParticipants.map((p) => {
        const row: Record<string, string | boolean> = {};
        for (const field of MANAGED_FIELDS) {
          if (field === "emailSent") row[field] = !!p.emailSent;
          else if (field === "status") row[field] = p.status || "pending";
          else row[field] = p[field] || "";
        }
        return row;
      });

      const result = await callAppsScript("syncData", {
        spreadsheetId,
        tabName,
        mode: "write",
        participants: rows,
      });

      return NextResponse.json({ success: true, mode: "firebaseToSheets", synced: result.rowsWritten });
    } else if (mode === "sheetsToFirebase") {
      const result = await callAppsScript("syncData", { spreadsheetId, tabName, mode: "read" });

      if (!result.data || result.data.length === 0) {
        return NextResponse.json({ success: true, mode: "sheetsToFirebase", synced: 0 });
      }

      const participantsRef = adminDb.collection("databases").doc(databaseId).collection("participants");
      const existingSnap = await participantsRef.get();
      const existingByKey = new Map<string, any>();
      for (const d of existingSnap.docs) {
        const data = d.data();
        const name = (data.name || "").toLowerCase().trim();
        const email = (data.email || "").toLowerCase().trim();
        if (name || email) existingByKey.set(`${name}_${email}`, d);
      }

      let synced = 0;

      for (const rec of result.data as any[]) {
        if (!rec.name) continue;

        const nameKey = (rec.name || "").toLowerCase().trim();
        const emailKey = (rec.email || "").toLowerCase().trim();
        const key = `${nameKey}_${emailKey}`;
        const existing = existingByKey.get(key);

        const fields = {
          name: rec.name,
          email: rec.email || "",
          certificateId: rec.certificateId || "",
          certificateUrl: rec.certificateUrl || "",
          status: rec.status || "pending",
          issueDate: rec.issueDate || "",
          emailSent: !!rec.emailSent,
          driveLink: rec.driveLink || "",
          customFields: (rec.custom && typeof rec.custom === "object") ? rec.custom : {},
        };

        if (existing) {
          await existing.ref.update(fields);
        } else {
          const newRef = await participantsRef.add({ ...fields, createdAt: new Date().toISOString() });
          existingByKey.set(key, { ref: newRef });
        }
        synced++;
      }

      return NextResponse.json({ success: true, mode: "sheetsToFirebase", synced });
    } else if (mode === "updateCertIds") {
      const updates = body.updates as Array<{ email: string; certificateId: string }>;
      if (!updates || updates.length === 0) {
        return NextResponse.json({ success: true, updated: 0 });
      }
      const result = await callAppsScript("updateCertIds", { spreadsheetId, tabName, updates });
      return NextResponse.json({
        success: true,
        updated: result.updated ?? 0,
        ...(result.error ? { error: result.error } : {}),
      });
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
