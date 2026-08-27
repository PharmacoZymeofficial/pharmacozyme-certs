import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const { recipients, subject, message, scheduledAt, gmailEmail, senderName, replyTo } =
      await request.json();

    if (!recipients?.length || !scheduledAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const docRef = await getAdminDb().collection("scheduled_emails").add({
      recipients,
      subject,
      message,
      scheduledAt,
      // Persisted so the job sends via the same provider/sender the operator picked.
      gmailEmail: gmailEmail || null,
      senderName: senderName || null,
      replyTo: replyTo || null,
      status: "pending",
      createdAt: new Date().toISOString(),
      queuedBy: guard.session.email,
    });

    return NextResponse.json({ id: docRef.id, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const snap = await getAdminDb()
      .collection("scheduled_emails")
      .orderBy("scheduledAt", "desc")
      .get();

    const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
