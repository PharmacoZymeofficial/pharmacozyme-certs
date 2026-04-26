import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, writeBatch, collection, getDocs, getDoc } from "firebase/firestore";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

async function callAppsScript(action: string, payload: any) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...payload }),
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
  });
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.substring(0, 200)}`); }
}

// Two call signatures:
// A) Per-participant: { databaseId, updates: [{id, ...fields}] }
// B) Same fields for all: { databaseId, participantIds: string[], fields: Record<string, any> }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { databaseId } = body;

    if (!databaseId) return NextResponse.json({ error: "databaseId required" }, { status: 400 });

    const now = new Date().toISOString();
    const CHUNK = 500;

    if (Array.isArray(body.updates) && body.updates.length > 0) {
      const updates: Array<{ id: string; [key: string]: any }> = body.updates;
      for (let i = 0; i < updates.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const upd of updates.slice(i, i + CHUNK)) {
          const { id, ...fields } = upd;
          batch.update(doc(db, "databases", databaseId, "participants", id), { ...fields, updatedAt: now });
        }
        await batch.commit();
      }
      await syncAllToSheet(databaseId);
      return NextResponse.json({ success: true, updated: updates.length });
    }

    if (Array.isArray(body.participantIds) && body.participantIds.length > 0 && body.fields) {
      const ids: string[] = body.participantIds;
      const fields: Record<string, any> = body.fields;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const id of ids.slice(i, i + CHUNK)) {
          batch.update(doc(db, "databases", databaseId, "participants", id), { ...fields, updatedAt: now });
        }
        await batch.commit();
      }
      await syncAllToSheet(databaseId);
      return NextResponse.json({ success: true, updated: ids.length });
    }

    return NextResponse.json({ error: "Provide updates[] or participantIds+fields" }, { status: 400 });
  } catch (error: any) {
    console.error("Batch update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function syncAllToSheet(databaseId: string) {
  if (!APPS_SCRIPT_URL) return;
  try {
    const dbSnap = await getDoc(doc(db, "databases", databaseId));
    if (!dbSnap.exists()) return;
    const dbData = dbSnap.data();
    if (!dbData?.sheetId) return;

    const participantsSnap = await getDocs(collection(db, "databases", databaseId, "participants"));
    const all = participantsSnap.docs.map(d => d.data() as any);

    const getSerial = (id: string) => { const m = id?.match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
    const sorted = [...all].sort((a, b) => {
      if (!a.certificateId && !b.certificateId) return 0;
      if (!a.certificateId) return 1;
      if (!b.certificateId) return -1;
      return getSerial(a.certificateId) - getSerial(b.certificateId);
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
  } catch (err) {
    console.error("Sheet full-sync failed after batch-update:", err);
  }
}
