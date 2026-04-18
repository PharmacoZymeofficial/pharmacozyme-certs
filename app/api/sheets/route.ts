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

  console.log("Apps Script response status:", response.status);
  const text = await response.text();
  console.log("Apps Script raw response:", text);
  
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("Sheets API received:", JSON.stringify(body));
    const action = body.action;
    const data = { ...body };
    delete data.action;

    console.log("Extracted action:", action, "Data:", JSON.stringify(data));

    switch (action) {
      case "createSheet": {
        const result = await callAppsScript("createSheet", {
          databaseName: data.databaseName,
          subDatabases: data.subDatabases,
        });
        return NextResponse.json(result);
      }

      case "linkSheet": {
        const result = await callAppsScript("linkSheet", {
          spreadsheetId: data.spreadsheetId,
          tabName: data.tabName,
        });
        return NextResponse.json(result);
      }

      case "getTabs": {
        const result = await callAppsScript("getTabs", {
          spreadsheetId: data.spreadsheetId,
        });
        return NextResponse.json(result);
      }

      case "uploadPDF": {
        const result = await callAppsScript("uploadPDF", {
          spreadsheetId: data.spreadsheetId,
          pdfData: data.pdfData,
          fileName: data.fileName,
          databaseName: data.databaseName,
        });
        return NextResponse.json(result);
      }

      case "deletePDF": {
        const result = await callAppsScript("deletePDF", {
          fileId: data.fileId,
        });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Sheets API error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "getTabs") {
      const spreadsheetId = searchParams.get("spreadsheetId");
      if (!spreadsheetId) {
        return NextResponse.json({ error: "spreadsheetId required" }, { status: 400 });
      }
      const result = await callAppsScript("getTabs", { spreadsheetId });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Sheets API error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
