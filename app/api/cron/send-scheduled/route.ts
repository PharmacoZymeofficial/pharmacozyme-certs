import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireCronSecret } from "@/lib/requireAdmin";
import { runScheduledJob } from "@/lib/scheduledEmail";

export async function GET(request: NextRequest) {
  // CRON_SECRET is now required. Previously an unset var made this route public.
  const denied = requireCronSecret(request);
  if (denied) return denied;

  try {
    const now = new Date().toISOString();
    const snap = await getAdminDb()
      .collection("scheduled_emails")
      .where("status", "==", "pending")
      .where("scheduledAt", "<=", now)
      .get();

    let processed = 0;
    let failed = 0;

    for (const jobDoc of snap.docs) {
      const result = await runScheduledJob(jobDoc.id, jobDoc.data());
      if (result.ok) processed++;
      else failed++;
    }

    return NextResponse.json({ processed, failed, total: snap.docs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
