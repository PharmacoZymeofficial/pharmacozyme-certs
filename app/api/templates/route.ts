import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";

export async function GET() {
  try {
    const templatesRef = collection(db, "certificateTemplates");
    const q = query(templatesRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const templates = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const { pdfBase64, ...rest } = data;
      // Always compute fileUrl from doc ID so the iframe always has a valid URL
      return { id: docSnap.id, ...rest, fileUrl: `/api/templates/${docSnap.id}/pdf` };
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    if (!appsScriptUrl) {
      return NextResponse.json({ error: "APPS_SCRIPT_URL environment variable not set" }, { status: 500 });
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

    // Upload to Google Drive via Apps Script
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const driveRes = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "uploadTemplate", fileName: file.name, base64Data }),
    });
    const driveData = await driveRes.json();
    if (!driveData.success) {
      throw new Error(driveData.error || "Drive upload failed");
    }

    const templatesRef = collection(db, "certificateTemplates");
    const newTemplate = {
      name,
      description: description || "",
      category: category || "General",
      originalName: file.name,
      fileType: file.type || "application/pdf",
      fileSize: file.size,
      driveFileId: driveData.fileId,
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

    const docRef = await addDoc(templatesRef, newTemplate);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      template: { id: docRef.id, ...newTemplate },
    });
  } catch (error: any) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template", details: error?.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, positions } = body;

    if (!id || !positions) {
      return NextResponse.json({ error: "ID and positions are required" }, { status: 400 });
    }

    const templateRef = doc(db, "certificateTemplates", id);
    await updateDoc(templateRef, { positions });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating template positions:", error);
    return NextResponse.json(
      { error: "Failed to update positions", details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    const templateRef = doc(db, "certificateTemplates", id);

    // Delete the Drive file if one exists
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    const snap = await import("firebase/firestore").then(m => m.getDoc(templateRef));
    const driveFileId = snap.exists() ? snap.data()?.driveFileId : null;
    if (driveFileId && appsScriptUrl) {
      await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteTemplate", fileId: driveFileId }),
      }).catch(() => {}); // non-fatal
    }

    await deleteDoc(templateRef);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template", details: error?.message },
      { status: 500 }
    );
  }
}
