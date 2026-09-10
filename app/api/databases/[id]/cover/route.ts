import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";

const MAX_BYTES = 6 * 1024 * 1024; // client already downscales to ~1600x900 WebP

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  if (!appsScriptConfigured()) {
    return NextResponse.json({ error: "GOOGLE_APPS_SCRIPT_URL is not set" }, { status: 500 });
  }

  try {
    const { id } = await params;
    const dbRef = getAdminDb().collection("databases").doc(id);
    const snap = await dbRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Database not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 400 });
    }

    const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const folderId = (snap.data()?.driveFolderId as string | undefined) || undefined;
    const prevCoverId = snap.data()?.coverImageId as string | undefined;

    const call = () =>
      callAppsScript("uploadDatabaseCover", {
        fileName: `cover-${id}-${Date.now()}.webp`,
        base64Data,
        mimeType: file.type,
        ...(folderId ? { folderId } : {}),
      });

    let res: any;
    try {
      res = await call();
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      res = await call();
    }
    if (!res?.success || !res.fileId) {
      throw new Error(`Cover upload failed: ${res?.error || JSON.stringify(res)}`);
    }

    const coverUpdatedAt = new Date().toISOString();
    await dbRef.update({ coverImageId: res.fileId, coverUpdatedAt });

    // Best-effort trash of the previous cover; never fail the request for it.
    if (prevCoverId && prevCoverId !== res.fileId) {
      callAppsScript("deletePDF", { fileId: prevCoverId }).catch(() => {});
    }

    return NextResponse.json({ success: true, coverImageId: res.fileId, coverUpdatedAt });
  } catch (error: any) {
    console.error("Cover POST failed:", error);
    return NextResponse.json({ error: error?.message || "Upload failed" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const dbRef = getAdminDb().collection("databases").doc(id);
    const snap = await dbRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Database not found" }, { status: 404 });

    const coverId = snap.data()?.coverImageId as string | undefined;
    if (coverId && appsScriptConfigured()) {
      callAppsScript("deletePDF", { fileId: coverId }).catch(() => {});
    }
    await dbRef.update({
      coverImageId: FieldValue.delete(),
      coverUpdatedAt: FieldValue.delete(),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cover DELETE failed:", error);
    return NextResponse.json({ error: error?.message || "Delete failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const snap = await getAdminDb().collection("databases").doc(id).get();
    const coverId = snap.exists ? (snap.data()?.coverImageId as string | undefined) : undefined;
    if (!coverId) return new NextResponse(null, { status: 404 });

    const res = await callAppsScript("getFileBytes", { fileId: coverId });
    if (!res?.success || !res.base64) return new NextResponse(null, { status: 404 });

    const bytes = Buffer.from(res.base64, "base64");
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": res.mimeType || "image/webp",
        "Cache-Control": "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400",
      },
    });
  } catch (error: any) {
    console.error("Cover GET failed:", error);
    return new NextResponse(null, { status: 502 });
  }
}
