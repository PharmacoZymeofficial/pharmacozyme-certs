import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { jobEffectiveStatus } from "@/lib/generationState";

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
  const data = snap.data() || {};
  return NextResponse.json({
    job: {
      databaseId,
      templateId: data.templateId,
      startedAt: data.startedAt,
      startedBy: data.startedBy,
      status: jobEffectiveStatus({ status: data.status, startedAt: data.startedAt }),
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const { databaseId } = await params;

  let body: { templateId?: unknown; startedAt?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    databaseId,
    startedBy: guard.session.email || "unknown",
  };
  if (typeof body.templateId === "string") patch.templateId = body.templateId;
  if (typeof body.startedAt === "string") patch.startedAt = body.startedAt;
  if (body.status === "running" || body.status === "interrupted") patch.status = body.status;
  if (!patch.startedAt) {
    const existing = await jobRef(databaseId).get();
    patch.startedAt = existing.exists
      ? existing.data()?.startedAt || new Date().toISOString()
      : new Date().toISOString();
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
