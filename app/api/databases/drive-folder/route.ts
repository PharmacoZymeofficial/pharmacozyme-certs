import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

export async function POST(request: NextRequest) {
  try {
    const { databaseId, databaseName } = await request.json();

    if (!databaseId || !databaseName) {
      return NextResponse.json({ error: "databaseId and databaseName are required" }, { status: 400 });
    }

    if (!APPS_SCRIPT_URL) {
      return NextResponse.json({ error: "Apps Script not configured" }, { status: 500 });
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getFolder", databaseName }),
    });

    const text = await res.text();
    let result: any;
    try { result = JSON.parse(text); } catch {
      return NextResponse.json({ error: "Invalid Apps Script response" }, { status: 500 });
    }

    if (!result.success || !result.folderId) {
      return NextResponse.json({ error: result.error || "Folder not found" }, { status: 404 });
    }

    await updateDoc(doc(db, "databases", databaseId), {
      driveFolderId: result.folderId,
      driveFolderUrl: result.folderUrl,
    });

    return NextResponse.json({ success: true, folderId: result.folderId, folderUrl: result.folderUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
