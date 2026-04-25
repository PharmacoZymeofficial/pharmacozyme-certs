import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";

// Two call signatures:
// A) Per-participant: { databaseId, updates: [{id, ...fields}] }
// B) Same fields for all: { databaseId, participantIds: string[], fields: Record<string, any> }
// Neither triggers a sheet sync — caller handles that separately.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { databaseId } = body;

    if (!databaseId) return NextResponse.json({ error: "databaseId required" }, { status: 400 });

    const now = new Date().toISOString();
    const CHUNK = 500;

    if (Array.isArray(body.updates) && body.updates.length > 0) {
      // Per-participant updates
      const updates: Array<{ id: string; [key: string]: any }> = body.updates;
      for (let i = 0; i < updates.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const upd of updates.slice(i, i + CHUNK)) {
          const { id, ...fields } = upd;
          const ref = doc(db, "databases", databaseId, "participants", id);
          batch.update(ref, { ...fields, updatedAt: now });
        }
        await batch.commit();
      }
      return NextResponse.json({ success: true, updated: updates.length });
    }

    if (Array.isArray(body.participantIds) && body.participantIds.length > 0 && body.fields) {
      // Same fields applied to all
      const ids: string[] = body.participantIds;
      const fields: Record<string, any> = body.fields;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const id of ids.slice(i, i + CHUNK)) {
          const ref = doc(db, "databases", databaseId, "participants", id);
          batch.update(ref, { ...fields, updatedAt: now });
        }
        await batch.commit();
      }
      return NextResponse.json({ success: true, updated: ids.length });
    }

    return NextResponse.json({ error: "Provide updates[] or participantIds+fields" }, { status: 400 });
  } catch (error: any) {
    console.error("Batch update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
