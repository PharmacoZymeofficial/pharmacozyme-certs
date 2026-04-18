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

async function syncToSheets(databaseId: string, participants: any[]) {
  if (!APPS_SCRIPT_URL || !databaseId) return;
  
  const dbRef = doc(db, "databases", databaseId);
  const dbSnap = await getDoc(dbRef);
  if (!dbSnap.exists()) return;
  
  const dbData = dbSnap.data();
  const spreadsheetId = dbData?.sheetId;
  const tabName = dbData?.sheetTabName || "Participants";
  
  if (!spreadsheetId) return;
  
  try {
    // Sort by certificate ID serial number
    const sortedParticipants = [...participants].sort((a, b) => {
      if (!a.certificateId && !b.certificateId) return 0;
      if (!a.certificateId) return 1;
      if (!b.certificateId) return -1;
      const aNum = parseInt(a.certificateId.split("-").pop() || "0");
      const bNum = parseInt(b.certificateId.split("-").pop() || "0");
      return aNum - bNum;
    });
    
    const data = sortedParticipants.map(p => ({
      certificateId: p.certificateId || "",
      name: p.name || "",
      email: p.email || "",
      certificateUrl: p.certificateUrl || "",
      status: p.status || "pending",
      issueDate: p.issueDate || "",
      emailSent: p.emailSent || false,
      driveLink: p.driveLink || "",
      createdAt: p.createdAt || "",
    }));
    
    await callAppsScript("syncData", {
      spreadsheetId,
      tabName,
      data,
      mode: "write",
    });
    console.log(`Synced ${participants.length} participants to Sheets`);
  } catch (err) {
    console.error("Failed to sync to Sheets:", err);
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

      // Sync to Sheets
      if (results.success > 0) {
        await syncToSheets(databaseId, addedParticipants);
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

    // Sync to Sheets
    await syncToSheets(databaseId, [participantWithId]);

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
