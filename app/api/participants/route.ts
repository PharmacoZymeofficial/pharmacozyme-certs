import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { sortParticipantsForSheet } from "@/lib/participantSort";

function toSheetRow(p: any) {
  return {
    certificateId: p.certificateId || "",
    name: p.name || "",
    email: p.email || "",
    certificateUrl: p.certificateUrl || "",
    status: p.status || "pending",
    issueDate: p.issueDate || "",
    emailSent: p.emailSent || false,
    driveLink: p.driveLink || "",
    createdAt: p.createdAt || "",
  };
}

async function getSheetInfo(databaseId: string) {
  const dbSnap = await getAdminDb().collection("databases").doc(databaseId).get();
  if (!dbSnap.exists) return null;
  const d = dbSnap.data() || {};
  if (!d.sheetId) return null;
  return { spreadsheetId: d.sheetId, tabName: d.sheetTabName || "Participants" };
}

/** Upsert a single row (add or update by email) without rewriting the sheet. */
async function upsertRowToSheet(databaseId: string, participant: any) {
  if (!appsScriptConfigured()) return;
  const sheet = await getSheetInfo(databaseId);
  if (!sheet) return;
  try {
    await callAppsScript("upsertRow", { ...sheet, row: toSheetRow(participant) });
  } catch (err) {
    console.error("Failed to upsert row to Sheets:", err);
  }
}

/** Full sync: read all participants from Firestore and rewrite the entire sheet. */
async function fullSyncToSheet(databaseId: string) {
  if (!appsScriptConfigured()) return;
  const sheet = await getSheetInfo(databaseId);
  if (!sheet) return;
  try {
    const snap = await getAdminDb()
      .collection("databases")
      .doc(databaseId)
      .collection("participants")
      .get();

    const all = snap.docs.map((d) => d.data() as any);
    const sorted = sortParticipantsForSheet(all);

    await callAppsScript("syncData", {
      ...sheet,
      data: sorted.map(toSheetRow),
      mode: "write",
    });
  } catch (err) {
    console.error("Failed to full-sync to Sheets:", err);
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const databaseId = new URL(request.url).searchParams.get("databaseId");
    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }

    const snap = await getAdminDb()
      .collection("databases")
      .doc(databaseId)
      .collection("participants")
      .get();

    const participants = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as { id: string; [key: string]: any }))
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

    return NextResponse.json({ participants });
  } catch (error: any) {
    console.error("Error fetching participants:", error);
    return NextResponse.json(
      { error: "Failed to fetch participants", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { databaseId } = body;

    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }

    const participantsRef = getAdminDb()
      .collection("databases")
      .doc(databaseId)
      .collection("participants");

    if (Array.isArray(body.participants)) {
      const results = { success: 0, failed: 0 };
      const addedParticipants: any[] = [];

      const existingSnap = await participantsRef.get();
      const existingByKey = new Map<string, any>();
      for (const d of existingSnap.docs) {
        const data = d.data();
        if (data.name && data.email) {
          const key = data.name.toLowerCase() + "_" + data.email.toLowerCase();
          existingByKey.set(key, { id: d.id, ref: d.ref, data });
        }
      }

      for (const participant of body.participants) {
        try {
          const importName = (participant.name || "").trim();
          const importEmail = (participant.email || "").toLowerCase();
          const existing = existingByKey.get(importName.toLowerCase() + "_" + importEmail);

          if (existing) {
            const nameChanged =
              existing.data.name !== importName || existing.data.email !== importEmail;
            const hasNewCustomFields =
              participant.customFields && Object.keys(participant.customFields).length > 0;

            if (nameChanged || hasNewCustomFields) {
              await existing.ref.update({
                name: importName,
                email: importEmail,
                ...(hasNewCustomFields ? { customFields: participant.customFields } : {}),
              });
            }
            addedParticipants.push({ id: existing.id, ...existing.data });
          } else {
            const importedCertId = participant.certificateId || "";
            const newParticipant = {
              name: importName,
              email: importEmail,
              certificateId: importedCertId,
              certificateUrl: "",
              driveLink: "",
              driveFileId: "",
              emailSent: false,
              issueDate: participant.issueDate || "",
              status: importedCertId ? "generated" : "pending",
              createdAt: new Date().toISOString(),
              customFields: participant.customFields || {},
            };
            const docRef = await participantsRef.add(newParticipant);
            addedParticipants.push({ id: docRef.id, ...newParticipant });
          }
          results.success++;
        } catch (err) {
          console.error("Error importing participant:", err);
          results.failed++;
        }
      }

      if (results.success > 0) {
        await fullSyncToSheet(databaseId);
      }

      return NextResponse.json({ success: true, results, participants: addedParticipants });
    }

    const newParticipant = {
      name: body.name,
      email: body.email,
      certificateId: "",
      certificateUrl: "",
      driveLink: "",
      driveFileId: "",
      emailSent: false,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const docRef = await participantsRef.add(newParticipant);
    const participantWithId = { id: docRef.id, ...newParticipant };

    await upsertRowToSheet(databaseId, participantWithId);

    return NextResponse.json({ success: true, id: docRef.id, participant: participantWithId });
  } catch (error: any) {
    console.error("Error creating participant:", error);
    return NextResponse.json(
      { error: "Failed to create participant", details: error?.message },
      { status: 500 }
    );
  }
}
