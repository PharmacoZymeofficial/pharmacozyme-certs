import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc } from "firebase/firestore";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

async function callAppsScript(action: string, payload: any) {
  const body = { action, ...payload };
  
  console.log("Calling Apps Script:", action, JSON.stringify(body).substring(0, 200));

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body),
    redirect: "follow",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  console.log("Apps Script response:", text.substring(0, 300));

  try {
    return JSON.parse(text);
  } catch {
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(
        "Apps Script returned an HTML error page. Likely causes: " +
        "(1) URL ends in /dev instead of /exec, " +
        "(2) Web app access is not set to 'Anyone', " +
        "(3) Script not redeployed after code change. " +
        `HTTP status: ${response.status}`
      );
    }
    throw new Error(`Apps Script returned invalid JSON: ${text.substring(0, 150)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { databaseId, mode } = body;

    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }

    // Get database info from Firestore
    const databasesRef = collection(db, "databases");
    const dbSnap = await getDocs(databasesRef);
    const dbDoc = dbSnap.docs.find(d => d.id === databaseId);

    if (!dbDoc) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    const dbData = dbDoc.data();
    const spreadsheetId = dbData.sheetId;
    const tabName = dbData.sheetTabName || "Participants";

    if (!spreadsheetId) {
      return NextResponse.json({ error: "No linked Google Sheet" }, { status: 400 });
    }

    if (mode === "firebaseToSheets") {
      // Read from Firebase, write to Sheets
      const participantsRef = collection(db, "databases", databaseId, "participants");
      const participantsSnap = await getDocs(participantsRef);

      const participants = participantsSnap.docs.map(doc => doc.data() as any);

      // Sort by numeric serial at end of certificate ID (e.g. "Hamza-MDC-001" → 1)
      const getSerial = (id: string) => { const m = id?.match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
      const sortedParticipants = [...participants].sort((a: any, b: any) => {
        if (!a.certificateId && !b.certificateId) return 0;
        if (!a.certificateId) return 1;
        if (!b.certificateId) return -1;
        return getSerial(a.certificateId) - getSerial(b.certificateId);
      });

      const headerRow = ["name", "email", "certificateId", "certificateUrl", "status", "issueDate", "emailSent", "driveLink", "createdAt"];

      const result = await callAppsScript("syncData", {
        spreadsheetId,
        tabName,
        data: sortedParticipants,
        mode: "write",
        headers: headerRow,
        writeHeaders: true,
      });

      return NextResponse.json({
        success: true,
        mode: "firebaseToSheets",
        synced: result.rowsWritten,
      });

    } else if (mode === "sheetsToFirebase") {
      // Read from Sheets, write to Firebase
      const result = await callAppsScript("syncData", {
        spreadsheetId,
        tabName,
        mode: "read",
      });

      if (!result.data || result.data.length === 0) {
        return NextResponse.json({
          success: true,
          mode: "sheetsToFirebase",
          synced: 0,
        });
      }

      const participantsRef = collection(db, "databases", databaseId, "participants");

      // Fetch existing participants ONCE and index by name+email (same key as CSV import)
      const existingSnap = await getDocs(participantsRef);
      const existingByKey = new Map<string, any>();
      for (const d of existingSnap.docs) {
        const data = d.data();
        const name = (data.name || "").toLowerCase().trim();
        const email = (data.email || "").toLowerCase().trim();
        if (name || email) existingByKey.set(`${name}_${email}`, d);
      }

      let synced = 0;

      for (const p of result.data) {
        if (!p.name) continue;

        const nameKey = (p.name || "").toLowerCase().trim();
        const emailKey = (p.email || "").toLowerCase().trim();
        const key = `${nameKey}_${emailKey}`;
        const existing = existingByKey.get(key);

        const fields = {
          name: p.name,
          email: p.email || "",
          certificateId: p.certificateId || "",
          certificateUrl: p.certificateUrl || "",
          status: p.status || "pending",
          issueDate: p.issueDate || "",
          emailSent: p.emailSent || false,
          driveLink: p.driveLink || "",
        };

        if (existing) {
          await updateDoc(existing.ref, fields);
        } else {
          const newRef = await addDoc(participantsRef, { ...fields, createdAt: new Date().toISOString() });
          existingByKey.set(key, { ref: newRef });
        }
        synced++;
      }

      return NextResponse.json({
        success: true,
        mode: "sheetsToFirebase",
        synced,
      });

    } else if (mode === "updateCertIds") {
      // Fast targeted update: only writes column A (cert ID) matched by email.
      const updates = body.updates as Array<{ email: string; certificateId: string }>;
      if (!updates || updates.length === 0) {
        return NextResponse.json({ success: true, updated: 0 });
      }
      const result = await callAppsScript("updateCertIds", { spreadsheetId, tabName, updates });
      return NextResponse.json({ success: true, updated: result.updated ?? 0 });

    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
