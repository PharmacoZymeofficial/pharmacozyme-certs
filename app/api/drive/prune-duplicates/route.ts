import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { buildKeepFileIds } from "@/lib/drivePrune";

// Trash the stale / orphaned / same-name duplicate certificate PDFs sitting in a
// database's Drive folder. The keep list is every participant's currently linked
// PDF id — anything else in the folder is dropped to Trash (recoverable 30 days).
//
// dryRun: true returns what WOULD be trashed without touching anything.
// Refuses when the keep list is empty (broken folder link -> pruning would wipe
// the whole folder).
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { databaseId, dryRun } = await request.json();
    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }
    if (!appsScriptConfigured()) {
      return NextResponse.json({ error: "Apps Script not configured" }, { status: 500 });
    }

    const db = getAdminDb();
    const snap = await db.collection("databases").doc(databaseId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }
    const data = snap.data() || {};
    if (!data.driveFolderId) {
      return NextResponse.json(
        { error: "This database has no Drive folder yet — generate certificates first." },
        { status: 400 }
      );
    }

    const partsSnap = await db
      .collection("databases")
      .doc(databaseId)
      .collection("participants")
      .get();
    const keepFileIds = buildKeepFileIds(partsSnap.docs.map((d) => d.data()));

    if (keepFileIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "No linked certificate files found for this database. Refusing to clean up — " +
            'the folder link may be broken. Run "Update" on the Drive folder first.',
        },
        { status: 400 }
      );
    }

    const result = await callAppsScript<{
      success?: boolean;
      dryRun?: boolean;
      keptCount?: number;
      candidateCount?: number;
      candidates?: { id: string; name: string }[];
      trashedCount?: number;
      error?: string;
    }>("pruneFolderDuplicates", {
      folderId: data.driveFolderId,
      keepFileIds,
      dryRun: dryRun === true,
    });

    if (!result?.success) {
      return NextResponse.json(
        { error: "Cleanup failed", details: result?.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Cleanup failed", details: msg }, { status: 500 });
  }
}
