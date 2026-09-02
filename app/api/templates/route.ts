import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const snap = await getAdminDb()
      .collection("certificateTemplates")
      .orderBy("createdAt", "desc")
      .get();

    const templates = snap.docs.map((docSnap) => {
      const { pdfBase64: _pdfBase64, ...rest } = docSnap.data();
      // Always compute fileUrl from the doc ID so the iframe always has a valid URL.
      return { id: docSnap.id, ...rest, fileUrl: `/api/templates/${docSnap.id}/pdf` };
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates", details: error?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    if (!appsScriptConfigured()) {
      return NextResponse.json({ error: "GOOGLE_APPS_SCRIPT_URL environment variable not set" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;

    if (!file || !name) {
      return NextResponse.json({ error: "File and name are required" }, { status: 400 });
    }
    if (!file.type.includes("pdf")) {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 20MB" }, { status: 400 });
    }

    const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");

    let driveData: any;
    try {
      driveData = await callAppsScript("uploadTemplate", { fileName: file.name, base64Data });
    } catch {
      // One retry — Apps Script cold starts and transient hiccups are common.
      await new Promise((r) => setTimeout(r, 1500));
      driveData = await callAppsScript("uploadTemplate", { fileName: file.name, base64Data });
    }

    if (!driveData.success) {
      throw new Error(`Drive upload failed: ${driveData.error || JSON.stringify(driveData)}`);
    }

    const newTemplate = {
      name,
      description: description || "",
      category: category || "General",
      originalName: file.name,
      fileType: file.type || "application/pdf",
      fileSize: file.size,
      driveFileId: driveData.fileId,
      ...(base64Data.length <= 920_000 ? { pdfBase64: base64Data } : {}),
      fileUrl: driveData.previewUrl,
      viewUrl: driveData.viewUrl,
      isActive: true,
      usageCount: 0,
      positions: {
        name: { x: 50, y: 45, size: 48, color: "#1b4332" },
        certId: { x: 50, y: 30, size: 12, color: "#333333" },
        qr: { x: 85, y: 60, size: 12 },
      },
      createdAt: new Date().toISOString(),
    };

    const docRef = await getAdminDb().collection("certificateTemplates").add(newTemplate);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      template: { id: docRef.id, ...newTemplate },
      sharingFailed: driveData.shared === false,
    });
  } catch (error: any) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Failed to create template", details: error?.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id, positions } = await request.json();
    if (!id || !positions) {
      return NextResponse.json({ error: "ID and positions are required" }, { status: 400 });
    }

    await getAdminDb().collection("certificateTemplates").doc(id).update({ positions });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating template positions:", error);
    return NextResponse.json({ error: "Failed to update positions", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    const templateRef = getAdminDb().collection("certificateTemplates").doc(id);
    const snap = await templateRef.get();
    const driveFileId = snap.exists ? snap.data()?.driveFileId : null;

    if (driveFileId && appsScriptConfigured()) {
      // Non-fatal: a leftover Drive file is better than a failed delete.
      await callAppsScript("deleteTemplate", { fileId: driveFileId }).catch(() => {});
    }

    await templateRef.delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Failed to delete template", details: error?.message }, { status: 500 });
  }
}
