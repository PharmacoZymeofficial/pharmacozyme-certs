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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { databaseId } = body;

    console.log("PUT /api/participants/[id] - updating participant:", id, "databaseId:", databaseId);
    console.log("Update data keys:", Object.keys(body));

    if (!id) {
      return NextResponse.json({ error: "Participant ID is required" }, { status: 400 });
    }

    if (!databaseId) {
      console.error("No databaseId provided in request body");
      return NextResponse.json({ error: "Database ID is required" }, { status: 400 });
    }

    // Use nested subcollection path
    const participantRef = doc(db, "databases", databaseId, "participants", id);
    
    // Remove databaseId from update data (it's not a field to store)
    const { databaseId: _, ...updateData } = body;
    
    await updateDoc(participantRef, {
      ...updateData,
      updatedAt: new Date().toISOString(),
    });

    console.log("Participant updated successfully:", id);
    return NextResponse.json({ success: true, message: "Participant updated" });
  } catch (error: any) {
    console.error("Error updating participant:", error);
    console.error("Error details:", error?.code, error?.message);
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

    if (!id) {
      return NextResponse.json({ error: "Participant ID is required" }, { status: 400 });
    }

    if (!databaseId) {
      return NextResponse.json({ error: "Database ID is required" }, { status: 400 });
    }

    console.log("DELETE /api/participants/[id] - deleting participant:", id, "deletePdf:", deletePdf);

    // Get participant data first to check for Drive link
    const participantRef = doc(db, "databases", databaseId, "participants", id);
    const participantSnap = await getDoc(participantRef);
    const participantData = participantSnap.exists() ? participantSnap.data() : null;

    // Delete PDF from Drive if requested
    if (deletePdf && APPS_SCRIPT_URL) {
      // Try driveFileId first, fall back to extracting from driveLink URL
      let fileId = participantData?.driveFileId;
      if (!fileId && participantData?.driveLink) {
        const match = participantData.driveLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
      }
      if (fileId) {
        try {
          await callAppsScript("deletePDF", { fileId });
          console.log("Deleted PDF from Drive:", fileId);
        } catch (driveErr) {
          console.error("Failed to delete PDF from Drive:", driveErr);
        }
      }
    }

    // Use nested subcollection path
    await deleteDoc(participantRef);

    // Targeted sheet sync: delete only this participant's row by cert ID
    if (participantData?.certificateId && APPS_SCRIPT_URL) {
      try {
        const dbRef = doc(db, "databases", databaseId);
        const dbSnap = await getDoc(dbRef);
        const dbData = dbSnap.exists() ? dbSnap.data() : null;
        if (dbData?.sheetId) {
          await callAppsScript("deleteRowsByCertIds", {
            spreadsheetId: dbData.sheetId,
            tabName: dbData.sheetTabName || "Participants",
            certIds: [participantData.certificateId],
          });
        }
      } catch (syncErr) {
        console.error("Failed to delete sheet row after participant deletion:", syncErr);
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
