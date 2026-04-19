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
      // Strip pdfBase64 from list response — only needed when loading for generation
      const { pdfBase64, ...rest } = data;
      return { id: docSnap.id, ...rest };
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

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");

    const templatesRef = collection(db, "certificateTemplates");
    const newTemplate = {
      name,
      description: description || "",
      category: category || "General",
      originalName: file.name,
      fileType: file.type || "application/pdf",
      fileSize: file.size,
      pdfBase64,
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

    // Store the serving URL so the template card knows where to load it from
    const fileUrl = `/api/templates/${docRef.id}/pdf`;
    await updateDoc(doc(templatesRef, docRef.id), { fileUrl });

    const { pdfBase64: _, ...templateMeta } = newTemplate;
    return NextResponse.json({
      success: true,
      id: docRef.id,
      template: { id: docRef.id, ...templateMeta, fileUrl },
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
