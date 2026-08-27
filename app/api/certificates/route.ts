import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { deleteCertificateCascade } from "@/lib/certCascade";

/**
 * Admin-only. This endpoint returns every certificate document — including every
 * recipient's name and email — and was previously reachable unauthenticated.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const max = Math.min(parseInt(searchParams.get("limit") || "1000", 10) || 1000, 5000);

    const snap = await getAdminDb().collection("certificates").limit(max).get();
    const certificates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ certificates });
  } catch (error: any) {
    console.error("Error fetching certificates:", error);
    return NextResponse.json(
      { error: "Failed to fetch certificates", details: error?.message || "Unknown error", code: error?.code },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const newCert = { ...body, createdAt: new Date().toISOString() };
    const docRef = await getAdminDb().collection("certificates").add(newCert);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      certificate: { id: docRef.id, ...newCert },
    });
  } catch (error: any) {
    console.error("Error creating certificate:", error);
    return NextResponse.json(
      { error: "Failed to create certificate", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

// Delete certificate records by id or uniqueCertId. Called when a certificate is revoked.
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const uniqueCertId = searchParams.get("uniqueCertId") || undefined;
    const id = searchParams.get("id") || undefined;
    const clearParticipant = searchParams.get("clearParticipant") !== "false";
    // ?keepPdf=true → revoke the cert ID but leave the Drive PDF (and the
    // participant's driveLink/driveFileId) intact. Backs the "Delete ID Only" UX.
    const keepPdf = searchParams.get("keepPdf") === "true";

    if (!uniqueCertId && !id) {
      return NextResponse.json({ error: "id or uniqueCertId is required" }, { status: 400 });
    }

    const result = await deleteCertificateCascade({
      // When both are supplied, certDocId wins — the cascade resolves it first.
      certDocId: id,
      uniqueCertId,
      clearParticipant,
      deleteDriveFile: !keepPdf,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error deleting certificate:", error);
    return NextResponse.json({ error: "Failed to delete certificate", details: msg }, { status: 500 });
  }
}

// Update a certificate's driveLink / pdfUrl / driveFileId after Drive upload completes.
export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { uniqueCertId, driveLink, driveFileId, pdfUrl } = (await request.json()) || {};

    if (!uniqueCertId) {
      return NextResponse.json({ error: "uniqueCertId is required" }, { status: 400 });
    }

    const snap = await getAdminDb()
      .collection("certificates")
      .where("uniqueCertId", "==", uniqueCertId)
      .get();

    if (snap.empty) {
      return NextResponse.json({ success: false, updated: 0, message: "No matching certificate" });
    }

    const updates: Record<string, any> = {};
    if (driveLink !== undefined) updates.driveLink = driveLink || "";
    if (driveFileId !== undefined) updates.driveFileId = driveFileId || "";
    if (pdfUrl !== undefined) updates.pdfUrl = pdfUrl || driveLink || "";
    else if (driveLink !== undefined) updates.pdfUrl = driveLink || "";

    await Promise.all(snap.docs.map((d) => d.ref.update(updates)));

    return NextResponse.json({ success: true, updated: snap.size });
  } catch (error: any) {
    console.error("Error updating certificate:", error);
    return NextResponse.json(
      { error: "Failed to update certificate", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
