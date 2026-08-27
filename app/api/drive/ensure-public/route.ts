import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { ensureDrivePublic } from "@/lib/driveCleanup";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { fileId, folderId } = await request.json();
    if (!fileId && !folderId) {
      return NextResponse.json({ error: "fileId or folderId is required" }, { status: 400 });
    }
    const { shared } = await ensureDrivePublic({ fileId, folderId });
    return NextResponse.json({ success: true, shared });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "ensure-public failed", details: msg }, { status: 500 });
  }
}
