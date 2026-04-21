import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://verify.pharmacozyme.com";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await updateDoc(doc(db, "scheduled_emails", id), {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.action !== "send_now") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const jobSnap = await getDoc(doc(db, "scheduled_emails", id));
    if (!jobSnap.exists()) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobSnap.data();
    if (job.status !== "pending") {
      return NextResponse.json({ error: "Job is not pending" }, { status: 400 });
    }

    const response = await fetch(`${BASE_URL}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: job.recipients,
        subject: job.subject,
        message: job.message,
      }),
    });

    const result = await response.json();

    await updateDoc(doc(db, "scheduled_emails", id), {
      status: "sent",
      sentAt: new Date().toISOString(),
      result: { sent: result.sent ?? 0, failed: result.failed ?? 0 },
    });

    return NextResponse.json({ success: true, sent: result.sent ?? 0, failed: result.failed ?? 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
