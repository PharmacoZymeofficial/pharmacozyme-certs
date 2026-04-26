import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

async function callAppsScript(action: string, payload: any) {
  const body = { action, ...payload };
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body),
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.substring(0, 200)}`);
  }
}

async function getSheetInfo(databaseId: string) {
  const dbSnap = await getDoc(doc(db, "databases", databaseId));
  if (!dbSnap.exists()) return null;
  const d = dbSnap.data();
  if (!d?.sheetId) return null;
  return { spreadsheetId: d.sheetId, tabName: d.sheetTabName || "Participants" };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { databaseId } = body;

    if (!id) return NextResponse.json({ error: "Participant ID is required" }, { status: 400 });
    if (!databaseId) return NextResponse.json({ error: "Database ID is required" }, { status: 400 });

    const participantRef = doc(db, "databases", databaseId, "participants", id);

    const { databaseId: _, ...updateData } = body;
    await updateDoc(participantRef, { ...updateData, updatedAt: new Date().toISOString() });

    // Sync updated participant to sheet via upsertRow
    if (APPS_SCRIPT_URL) {
      try {
        const sheet = await getSheetInfo(databaseId);
        if (sheet) {
          const snap = await getDoc(participantRef);
          const p = snap.exists() ? snap.data() : null;
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
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const databaseId = searchParams.get("databaseId");
    const deletePdf = searchParams.get("deletePdf") === "true";

    if (!id) return NextResponse.json({ error: "Participant ID is required" }, { status: 400 });
    if (!databaseId) return NextResponse.json({ error: "Database ID is required" }, { status: 400 });

    const participantRef = doc(db, "databases", databaseId, "participants", id);
    const participantSnap = await getDoc(participantRef);
    const participantData = participantSnap.exists() ? participantSnap.data() : null;

    // Delete PDF from Drive if requested
    if (deletePdf && APPS_SCRIPT_URL) {
      let fileId = participantData?.driveFileId;
      if (!fileId && participantData?.driveLink) {
        const match = participantData.driveLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
      }
      if (fileId) {
        try {
          await callAppsScript("deletePDF", { fileId });
        } catch (driveErr) {
          console.error("Failed to delete PDF from Drive:", driveErr);
        }
      }
    }

    await deleteDoc(participantRef);

    // Sync: clear only col A (cert ID) for this participant — never delete the row
    // Preserves pre-existing sheet data (Google Form responses etc.)
    if (APPS_SCRIPT_URL) {
      try {
        const sheet = await getSheetInfo(databaseId);
        const email = participantData?.email;
        if (sheet && email) {
          await callAppsScript("clearCertIdsByEmail", { ...sheet, emails: [email] });
        }
      } catch (syncErr) {
        console.error("Sheet clear failed after participant deletion:", syncErr);
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
