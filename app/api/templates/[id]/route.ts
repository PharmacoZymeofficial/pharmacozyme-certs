import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { unlink } from "fs/promises";
import path from "path";

const TEMPLATES_DIR = path.join(process.cwd(), "public", "uploads", "templates");

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("fileName");

    console.log("Deleting template:", id, "fileName:", fileName);

    // Delete file from local storage if it exists
    if (fileName) {
      try {
        const filePath = path.join(TEMPLATES_DIR, fileName);
        await unlink(filePath);
        console.log("File deleted:", filePath);
      } catch (storageError) {
        console.error("Error deleting file from storage:", storageError);
      }
    }

    // Delete template from Firestore
    const templateRef = doc(db, "certificateTemplates", id);
    await deleteDoc(templateRef);
    console.log("Template deleted from Firestore:", id);

    return NextResponse.json({ success: true, message: "Template deleted" });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template", details: error?.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    const templateRef = doc(db, "certificateTemplates", id);
    await updateDoc(templateRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Template updated" });
  } catch (error: any) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template", details: error?.message },
      { status: 500 }
    );
  }
}
