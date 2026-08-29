import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";

const PHASES = ["rendering", "drive-upload", "sheet-sync"] as const;

function jobRef(databaseId: string) {
  return getAdminDb().collection("generationJobs").doc(databaseId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await params;
  const snap = await jobRef(databaseId).get();
  if (!snap.exists) return NextResponse.json({ error: "No job" }, { status: 404 });
  return NextResponse.json({ job: { databaseId, ...snap.data() } });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const patch: Record<string, unknown> = { databaseId, updatedAt: new Date().toISOString() };

  if (typeof body.total === "number") patch.total = body.total;
  if (Array.isArray(body.completedParticipantIds)) {
    patch.completedParticipantIds = body.completedParticipantIds.filter(
      (x: unknown) => typeof x === "string"
    );
  }
  if (PHASES.includes(body.phase)) patch.phase = body.phase;
  if (typeof body.templateId === "string") patch.templateId = body.templateId;
  if (typeof body.startedAt === "string") patch.startedAt = body.startedAt;
  patch.startedBy = guard.session.email || "unknown";
  if (!patch.startedAt) {
    const existing = await jobRef(databaseId).get();
    patch.startedAt = existing.exists
      ? existing.data()?.startedAt || patch.updatedAt
      : patch.updatedAt;
  }

  await jobRef(databaseId).set(patch, { merge: true });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await params;
  await jobRef(databaseId).delete();
  return NextResponse.json({ success: true });
}
