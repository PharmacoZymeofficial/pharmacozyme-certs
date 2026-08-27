import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { deleteCertificateCascade } from "@/lib/certCascade";

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Certificate ID is required" }, { status: 400 });
    }
    const result = await deleteCertificateCascade({ certDocId: id });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    return NextResponse.json({ error: "Failed to delete certificate" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id, ...data } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Certificate ID is required" }, { status: 400 });
    }

    await getAdminDb()
      .collection("certificates")
      .doc(id)
      .update({ ...data, updatedAt: new Date().toISOString() });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating certificate:", error);
    return NextResponse.json({ error: "Failed to update certificate" }, { status: 500 });
  }
}
