import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, getDoc } from "firebase/firestore";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

async function callAppsScript(action: string, payload: any) {
  const body = { action, ...payload };
  console.log("Calling Apps Script:", action);
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body),
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
  });
  const text = await response.text();
  console.log("Apps Script response:", text.substring(0, 200));
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.substring(0, 100)}`);
  }
}

async function getSheetInfo(databaseId: string) {
  const dbSnap = await getDoc(doc(db, "databases", databaseId));
  if (!dbSnap.exists()) return null;
  const d = dbSnap.data();
  if (!d?.sheetId) return null;
  return { spreadsheetId: d.sheetId, tabName: d.sheetTabName || "Participants" };
}

// Upsert a single row (add or update by email)
async function upsertRowToSheet(databaseId: string, participant: any) {
  if (!APPS_SCRIPT_URL) return;
  const sheet = await getSheetInfo(databaseId);
  if (!sheet) return;
  try {
    await callAppsScript("upsertRow", {
      ...sheet,
      row: {
        certificateId: participant.certificateId || "",
        name: participant.name || "",
        email: participant.email || "",
        certificateUrl: participant.certificateUrl || "",
        status: participant.status || "pending",
        issueDate: participant.issueDate || "",
        emailSent: participant.emailSent || false,
        driveLink: participant.driveLink || "",
        createdAt: participant.createdAt || "",
      },
    });
  } catch (err) {
    console.error("Failed to upsert row to Sheets:", err);
  }
}

// Full sync: read ALL participants from Firestore, rewrite entire sheet
async function fullSyncToSheet(databaseId: string) {
  if (!APPS_SCRIPT_URL) return;
  const sheet = await getSheetInfo(databaseId);
  if (!sheet) return;
  try {
    const snap = await getDocs(collection(db, "databases", databaseId, "participants"));
    const all = snap.docs.map(d => d.data() as any);
    const getSerial = (id: string) => { const m = id?.match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
    const sorted = [...all].sort((a, b) => {
      if (!a.certificateId && !b.certificateId) return 0;
      if (!a.certificateId) return 1;
      if (!b.certificateId) return -1;
      return getSerial(a.certificateId) - getSerial(b.certificateId);
    });
    await callAppsScript("syncData", {
      ...sheet,
      data: sorted.map(p => ({
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
    console.log(`Full sync: ${all.length} participants → Sheets`);
  } catch (err) {
    console.error("Failed to full-sync to Sheets:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const databaseId = searchParams.get("databaseId");

    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }

    // Use nested subcollection: /databases/{dbId}/participants
    const participantsRef = collection(db, "databases", databaseId, "participants");
    const querySnapshot = await getDocs(participantsRef);

    const participants = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as { id: string; [key: string]: any })).sort((a, b) => {
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
  try {
    const body = await request.json();
    const { databaseId } = body;

    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }

    // Use nested subcollection
    const participantsRef = collection(db, "databases", databaseId, "participants");

    // Handle bulk import
    if (Array.isArray(body.participants)) {
      const results = { success: 0, failed: 0 };
      const addedParticipants: any[] = [];

      // Get existing participants to match by name + email
      const existingSnap = await getDocs(participantsRef);
      const existingByKey: Record<string, any> = {};
      for (const doc of existingSnap.docs) {
        const data = doc.data();
        if (data.name && data.email) {
          const key = `${data.name.toLowerCase()}_${data.email.toLowerCase()}`;
          existingByKey[key] = { ...data, id: doc.id };
        }
      }

      for (const participant of body.participants) {
        try {
          const importName = (participant.name || "").trim();
          const importEmail = (participant.email || "").toLowerCase();
          const key = `${importName.toLowerCase()}_${importEmail}`;
          const existingParticipant = existingByKey[key];
          
          // If participant with same name + email exists, keep their data as is
          if (existingParticipant) {
            // Update only if name changed (preserve all certificate data)
            if (existingParticipant.name !== importName || existingParticipant.email !== importEmail) {
              const existingDoc = existingSnap.docs.find(d => d.id === existingParticipant.id);
              if (existingDoc) {
                await updateDoc(existingDoc.ref, {
                  name: importName,
                  email: importEmail,
                });
              }
            }
            addedParticipants.push(existingParticipant);
          } else {
            // Create new participant - use imported certificateId if provided
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
            };
            const docRef = await addDoc(participantsRef, newParticipant);
            addedParticipants.push({ id: docRef.id, ...newParticipant });
          }
          results.success++;
        } catch (err) {
          console.error("Error importing participant:", err);
          results.failed++;
        }
      }

      // Full sync after bulk import (rewrites sheet with all participants)
      if (results.success > 0) {
        await fullSyncToSheet(databaseId);
      }

      return NextResponse.json({ success: true, results, participants: addedParticipants });
    }

    // Single participant
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

    const docRef = await addDoc(participantsRef, newParticipant);
    const participantWithId = { id: docRef.id, ...newParticipant };

    // Upsert single row to sheet (does not wipe existing rows)
    await upsertRowToSheet(databaseId, participantWithId);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      participant: participantWithId,
    });
  } catch (error: any) {
    console.error("Error creating participant:", error);
    return NextResponse.json(
      { error: "Failed to create participant", details: error?.message },
      { status: 500 }
    );
  }
}
