import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { databaseId, databaseName } = await request.json();

    if (!databaseId || !databaseName) {
      return NextResponse.json({ error: "databaseId and databaseName are required" }, { status: 400 });
    }
    if (!appsScriptConfigured()) {
      return NextResponse.json({ error: "Apps Script not configured" }, { status: 500 });
    }

    const result = await callAppsScript("getFolder", { databaseName });

    if (!result.success || !result.folderId) {
      return NextResponse.json({ error: result.error || "Folder not found" }, { status: 404 });
    }

    await getAdminDb().collection("databases").doc(databaseId).update({
      driveFolderId: result.folderId,
      driveFolderUrl: result.folderUrl,
    });

    return NextResponse.json({ success: true, folderId: result.folderId, folderUrl: result.folderUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
