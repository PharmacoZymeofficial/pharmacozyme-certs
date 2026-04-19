import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const templateRef = doc(db, "certificateTemplates", id);
    const snap = await getDoc(templateRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ id: snap.id, ...snap.data() });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const templateRef = doc(db, "certificateTemplates", id);
    await deleteDoc(templateRef);
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
    await updateDoc(templateRef, { ...updates, updatedAt: new Date().toISOString() });

    return NextResponse.json({ success: true, message: "Template updated" });
  } catch (error: any) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template", details: error?.message },
      { status: 500 }
    );
  }
}
