import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const limit = 100;

  // Try to get real count from Resend API
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey.startsWith("re_")) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      let sent = 0;
      let after: string | undefined;

      // Paginate through emails to count today's sends
      do {
        const res = await resend.emails.list(after ? { limit: 100, after } : { limit: 100 });
        if (res.error || !res.data?.data) break;
        const page = res.data.data;
        sent += page.filter((e: any) => (e.created_at || "").startsWith(today)).length;
        // Stop when oldest email on page is before today
        const oldest = page[page.length - 1];
        if (!oldest || !(oldest.created_at || "").startsWith(today)) break;
        after = res.data.has_more ? oldest.id : undefined;
      } while (after);

      return NextResponse.json({ sent, limit, remaining: Math.max(0, limit - sent), date: today, source: "resend" });
    } catch { /* fall through to Firestore */ }
  }

  // Fallback: app-tracked counter in Firestore
  try {
    const statsSnap = await getDoc(doc(db, "email_stats", today));
    const sent = statsSnap.exists() ? (statsSnap.data().sent || 0) : 0;
    return NextResponse.json({ sent, limit, remaining: Math.max(0, limit - sent), date: today, source: "local" });
  } catch {
    return NextResponse.json({ sent: 0, limit, remaining: limit, date: today, source: "local" });
  }
}
