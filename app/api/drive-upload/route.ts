import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || "";

async function callAppsScript(action: string, payload: any) {
  const body = {
    action,
    ...payload,
  };

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body),
    redirect: "follow",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apps Script error: ${errorText}`);
  }

  const text = await response.text();
  
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfBytes, fileName, databaseName, spreadsheetId, participantId } = body;

    if (!pdfBytes || !fileName) {
      return NextResponse.json(
        { error: "Missing pdfBytes or fileName" },
        { status: 400 }
      );
    }

    console.log("Drive upload request:", { fileName, databaseName, spreadsheetId });

    // Convert to base64 string for JSON transfer
    let base64Data: string;
    if (typeof pdfBytes === "string") {
      base64Data = pdfBytes;
    } else if (Array.isArray(pdfBytes)) {
      base64Data = Buffer.from(pdfBytes).toString("base64");
    } else {
      base64Data = Buffer.from(pdfBytes).toString("base64");
    }

    // Upload PDF via Apps Script (uses Sheet owner's quota)
    const result = await callAppsScript("uploadPDF", {
      pdfData: base64Data,
      fileName,
      databaseName: databaseName || "Certificates",
    });

    console.log("Upload result:", result);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to upload to Drive", details: result.error },
        { status: 500 }
      );
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
    return NextResponse.json(
      { error: "Failed to upload to Google Drive", details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 });
    }

    const result = await callAppsScript("deletePDF", { fileId });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to delete from Drive", details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "File deleted from Google Drive" });
  } catch (error: any) {
    console.error("Error deleting from Drive:", error);
    return NextResponse.json(
      { error: "Failed to delete from Google Drive", details: error?.message },
      { status: 500 }
    );
  }
}
