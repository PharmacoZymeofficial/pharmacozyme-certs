import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, writeBatch, collection, getDocs } from "firebase/firestore";

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

// Updates many participants at once, then does a single sheet sync.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { databaseId, updates } = body as {
      databaseId: string;
      updates: Array<{ id: string; certificateId: string; status?: string }>;
    };

    if (!databaseId) return NextResponse.json({ error: "databaseId required" }, { status: 400 });
    if (!Array.isArray(updates) || updates.length === 0) return NextResponse.json({ error: "updates required" }, { status: 400 });

    const now = new Date().toISOString();

    // Firestore writeBatch max 500 ops — chunk if needed
    const CHUNK = 500;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const upd of updates.slice(i, i + CHUNK)) {
        const ref = doc(db, "databases", databaseId, "participants", upd.id);
        batch.update(ref, {
          certificateId: upd.certificateId,
          status: upd.status || "pending",
          updatedAt: now,
        });
      }
      await batch.commit();
    }

    // One sheet sync after all updates
    try {
      const dbRef = doc(db, "databases", databaseId);
      const dbSnap = await getDoc(dbRef);
      const dbData = dbSnap.exists() ? dbSnap.data() : null;

      if (dbData?.sheetId && APPS_SCRIPT_URL) {
        const participantsSnap = await getDocs(collection(db, "databases", databaseId, "participants"));
        const allParticipants = participantsSnap.docs.map(d => d.data() as any);

        const sorted = [...allParticipants].sort((a, b) => {
          if (!a.certificateId && !b.certificateId) return 0;
          if (!a.certificateId) return 1;
          if (!b.certificateId) return -1;
          const aNum = parseInt(a.certificateId.split("-").pop() || "0");
          const bNum = parseInt(b.certificateId.split("-").pop() || "0");
          return aNum - bNum;
        });

        await callAppsScript("syncData", {
          spreadsheetId: dbData.sheetId,
          tabName: dbData.sheetTabName || "Participants",
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
      }
    } catch (syncErr) {
      console.error("Sheet sync failed (IDs already saved):", syncErr);
    }

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error: any) {
    console.error("Batch update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
