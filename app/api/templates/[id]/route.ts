import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const snap = await getAdminDb().collection("certificateTemplates").doc(id).get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ id: snap.id, ...snap.data() });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    await getAdminDb().collection("certificateTemplates").doc(id).delete();
    return NextResponse.json({ success: true, message: "Template deleted" });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Failed to delete template", details: error?.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    await getAdminDb()
      .collection("certificateTemplates")
      .doc(id)
      .update({ ...updates, updatedAt: new Date().toISOString() });

    return NextResponse.json({ success: true, message: "Template updated" });
  } catch (error: any) {
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Failed to update template", details: error?.message }, { status: 500 });
  }
}
