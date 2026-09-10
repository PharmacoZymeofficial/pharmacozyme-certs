import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { callAppsScript, appsScriptConfigured } from "@/lib/appsScript";
import { rateLimit } from "@/lib/rateLimit";

const MAX_BYTES = 6 * 1024 * 1024; // client already downscales to ~1600x900 WebP

// Explicit allowlist: an echoed-back caller-controlled MIME (e.g. image/svg+xml) served
// from our own origin is stored XSS against admin sessions, so we never trust `file.type`
// or the stored `mimeType` beyond these three values.
const ALLOWED_COVER_MIME_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

// Coverless / not-found / gated responses are cheap to cache — this is what keeps a
// repeatedly-missed or gated cover from re-hitting Firestore on every request.
const NOT_FOUND_CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

type Ctx = { params: Promise<{ id: string }> };

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

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
    const extension = ALLOWED_COVER_MIME_TYPES[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: "Only image/webp, image/png, or image/jpeg files are allowed" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 400 });
    }

    const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const folderId = (snap.data()?.driveFolderId as string | undefined) || undefined;
    const prevCoverId = snap.data()?.coverImageId as string | undefined;

    const call = () =>
      callAppsScript("uploadDatabaseCover", {
        fileName: `cover-${id}-${Date.now()}.${extension}`,
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

    // Best-effort trash of the previous cover; never fail the request for it. Awaited so
    // the cleanup actually runs before the serverless invocation is frozen post-response.
    if (prevCoverId && prevCoverId !== res.fileId) {
      await callAppsScript("deletePDF", { fileId: prevCoverId }).catch(() => {});
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
      // Non-fatal: a leftover Drive file is better than a failed delete. Awaited so the
      // trash actually runs before the serverless invocation is frozen post-response.
      await callAppsScript("deletePDF", { fileId: coverId }).catch(() => {});
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
  // Public route: gate it the same way search-name and verify do, so an unauthenticated
  // caller can't burn the Apps Script/Drive quota that certificate generation and Sheet
  // sync also depend on.
  const ip = getClientIp(request);
  const { ok, retryAfter } = rateLimit(ip);
  if (!ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before retrying." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const { id } = await params;
    const snap = await getAdminDb().collection("databases").doc(id).get();
    const data = snap.exists ? snap.data() : undefined;
    const coverId = data?.coverImageId as string | undefined;
    if (!coverId) {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": NOT_FOUND_CACHE_CONTROL },
      });
    }

    // A draft (not-yet-live) database's cover is only visible to an authenticated admin
    // previewing it — anyone else gets the same 404 as a missing cover, so the 200-vs-404
    // split never confirms a draft database's existence to a certificate-ID holder.
    const isLive = data?.isLive === true;
    let isAdminPreview = false;
    if (!isLive) {
      const guard = await requireAdmin(request);
      if (!guard.ok) {
        return new NextResponse(null, {
          status: 404,
          headers: { "Cache-Control": NOT_FOUND_CACHE_CONTROL },
        });
      }
      isAdminPreview = true;
    }

    if (!appsScriptConfigured()) {
      return NextResponse.json({ error: "GOOGLE_APPS_SCRIPT_URL is not set" }, { status: 500 });
    }

    const res = await callAppsScript("getFileBytes", { fileId: coverId });
    if (!res?.success || !res.base64) {
      console.error("Cover GET: getFileBytes failed", { databaseId: id, coverId, res });
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": NOT_FOUND_CACHE_CONTROL },
      });
    }

    const bytes = Buffer.from(res.base64, "base64");
    const mimeType =
      res.mimeType && Object.prototype.hasOwnProperty.call(ALLOWED_COVER_MIME_TYPES, res.mimeType)
        ? res.mimeType
        : "image/webp";
    // An admin-only preview of a not-yet-live cover must never be cached by the shared
    // CDN — the public, live path keeps the long s-maxage.
    const cacheControl = isAdminPreview
      ? "private, max-age=60"
      : "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": cacheControl,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("Cover GET failed:", error);
    return new NextResponse(null, { status: 502 });
  }
}
