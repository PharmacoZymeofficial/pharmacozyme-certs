import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://verify.pharmacozyme.com";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const snap = await getDocs(
      query(collection(db, "scheduled_emails"), where("status", "==", "pending"))
    );

    let processed = 0;
    for (const jobDoc of snap.docs) {
      const job = jobDoc.data();
      if (job.scheduledAt > now) continue;
      try {
        const response = await fetch(`${BASE_URL}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipients: job.recipients, subject: job.subject, message: job.message }),
        });
        const result = await response.json();
        await updateDoc(doc(db, "scheduled_emails", jobDoc.id), {
          status: "sent",
          sentAt: new Date().toISOString(),
          result: { sent: result.sent ?? 0, failed: result.failed ?? 0 },
        });
        processed++;
      } catch (err) {
        await updateDoc(doc(db, "scheduled_emails", jobDoc.id), {
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ processed, total: snap.docs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
