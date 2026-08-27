import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";
import { runScheduledJob } from "@/lib/scheduledEmail";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    await getAdminDb().collection("scheduled_emails").doc(id).update({
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = await request.json();

    // retry re-runs a job that previously failed; send_now runs a pending one early.
    if (body.action !== "send_now" && body.action !== "retry") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const jobSnap = await getAdminDb().collection("scheduled_emails").doc(id).get();
    if (!jobSnap.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobSnap.data()!;
    const allowed = body.action === "retry" ? ["failed", "partial"] : ["pending"];
    if (!allowed.includes(job.status)) {
      return NextResponse.json(
        { error: `Job is ${job.status}; expected one of: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await runScheduledJob(id, job);

    return NextResponse.json(
      { success: result.ok, sent: result.sent, failed: result.failed, error: result.error },
      { status: result.ok ? 200 : 502 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
