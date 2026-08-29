import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

// Merge any duplicate Drive folders for a database into its canonical
// driveFolderId. Refuses if the database has no canonical folder id yet —
// there is no safe target to consolidate into.
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { databaseId } = await request.json();
    if (!databaseId) {
      return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
    }
    if (!appsScriptConfigured()) {
      return NextResponse.json({ error: "Apps Script not configured" }, { status: 500 });
    }

    const snap = await getAdminDb().collection("databases").doc(databaseId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }
    const data = snap.data() || {};
    if (!data.driveFolderId) {
      return NextResponse.json(
        { error: "This database has no canonical Drive folder yet — generate certificates first." },
        { status: 400 }
      );
    }

    const result = await callAppsScript<{
      success?: boolean;
      movedFiles?: number;
      trashedFolders?: number;
      error?: string;
    }>("consolidateFolders", {
      folderName: data.name || "",
      canonicalFolderId: data.driveFolderId,
    });

    if (!result?.success) {
      return NextResponse.json(
        { error: "Consolidation failed", details: result?.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      movedFiles: result.movedFiles || 0,
      trashedFolders: result.trashedFolders || 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Consolidation failed", details: msg }, { status: 500 });
  }
}
