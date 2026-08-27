import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript } from "@/lib/appsScript";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "createSheet":
        return NextResponse.json(
          await callAppsScript("createSheet", { databaseName: data.databaseName, subDatabases: data.subDatabases })
        );

      case "linkSheet":
        return NextResponse.json(
          await callAppsScript("linkSheet", { spreadsheetId: data.spreadsheetId, tabName: data.tabName })
        );

      case "getTabs":
        return NextResponse.json(await callAppsScript("getTabs", { spreadsheetId: data.spreadsheetId }));

      case "uploadPDF":
        return NextResponse.json(
          await callAppsScript("uploadPDF", {
            spreadsheetId: data.spreadsheetId,
            pdfData: data.pdfData,
            fileName: data.fileName,
            databaseName: data.databaseName,
          })
        );

      case "deletePDF":
        return NextResponse.json(await callAppsScript("deletePDF", { fileId: data.fileId }));

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Sheets API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "getTabs") {
      const spreadsheetId = searchParams.get("spreadsheetId");
      if (!spreadsheetId) {
        return NextResponse.json({ error: "spreadsheetId required" }, { status: 400 });
      }
      return NextResponse.json(await callAppsScript("getTabs", { spreadsheetId }));
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Sheets API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
