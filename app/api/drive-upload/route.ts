import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript } from "@/lib/appsScript";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { pdfBytes, fileName, databaseName } = await request.json();

    if (!pdfBytes || !fileName) {
      return NextResponse.json({ error: "Missing pdfBytes or fileName" }, { status: 400 });
    }

    const base64Data =
      typeof pdfBytes === "string" ? pdfBytes : Buffer.from(pdfBytes).toString("base64");

    // Uses the Sheet owner's Drive quota.
    const result = await callAppsScript("uploadPDF", {
      pdfData: base64Data,
      fileName,
      databaseName: databaseName || "Certificates",
    });

    if (!result.success) {
      return NextResponse.json({ error: "Failed to upload to Drive", details: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      fileName: result.fileName,
      webViewLink: result.webViewLink,
      webContentLink: result.webContentLink,
    });
  } catch (error: any) {
    console.error("ERROR in Drive upload:", error);
    return NextResponse.json({ error: "Failed to upload to Google Drive", details: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const fileId = new URL(request.url).searchParams.get("fileId");
    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    const result = await callAppsScript("deletePDF", { fileId });

    if (!result.success) {
      return NextResponse.json({ error: "Failed to delete from Drive", details: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "File deleted from Google Drive" });
  } catch (error: any) {
    console.error("Error deleting from Drive:", error);
    return NextResponse.json({ error: "Failed to delete from Google Drive", details: error?.message }, { status: 500 });
  }
}
