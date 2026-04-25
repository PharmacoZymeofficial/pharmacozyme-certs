import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";

// Firestore-only bulk update. Sheet sync is handled separately by the caller.
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

    // writeBatch max 500 ops — chunk at 500
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

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error: any) {
    console.error("Batch update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
