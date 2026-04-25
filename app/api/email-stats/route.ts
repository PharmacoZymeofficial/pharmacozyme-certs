import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const GMAIL_ACCOUNTS = [
  { email: "pharmacozymeofficial@gmail.com", label: "PharmacoZyme Official", key: "gmail_pharmacozymeofficial" },
  { email: "pz.academy9@gmail.com", label: "PZ Academy", key: "gmail_pz_academy9" },
  { email: "teampharmacozyme@gmail.com", label: "Team PharmacoZyme", key: "gmail_teampharmacozyme" },
];

const GMAIL_DAILY_LIMIT = 500;
const RESEND_DAILY_LIMIT = 100;

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  // Firestore stats doc (tracks both Resend and per-Gmail-account counts)
  let firestoreData: Record<string, number> = {};
  try {
    const statsSnap = await getDoc(doc(db, "email_stats", today));
    if (statsSnap.exists()) firestoreData = statsSnap.data() as Record<string, number>;
  } catch { /* non-fatal */ }

  // Resend: try live API first, fall back to Firestore counter
  let resendSent = firestoreData.sent || 0;
  let resendSource: "resend" | "local" = "local";
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey.startsWith("re_")) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      let counted = 0;
      let after: string | undefined;
      do {
        const res = await resend.emails.list(after ? { limit: 100, after } : { limit: 100 });
        if (res.error || !res.data?.data) break;
        const page = res.data.data;
        counted += page.filter((e: any) => (e.created_at || "").startsWith(today)).length;
        const oldest = page[page.length - 1];
        if (!oldest || !(oldest.created_at || "").startsWith(today)) break;
        after = res.data.has_more ? oldest.id : undefined;
      } while (after);
      resendSent = counted;
      resendSource = "resend";
    } catch { /* fall through */ }
  }

  // Per-Gmail-account stats (from Firestore counters set by send-email route)
  const gmailAccounts: Record<string, { sent: number; limit: number; remaining: number; label: string; email: string }> = {};
  for (const acct of GMAIL_ACCOUNTS) {
    const sent = firestoreData[acct.key] || 0;
    gmailAccounts[acct.email] = {
      sent,
      limit: GMAIL_DAILY_LIMIT,
      remaining: Math.max(0, GMAIL_DAILY_LIMIT - sent),
      label: acct.label,
      email: acct.email,
    };
  }

  return NextResponse.json({
    sent: resendSent,
    limit: RESEND_DAILY_LIMIT,
    remaining: Math.max(0, RESEND_DAILY_LIMIT - resendSent),
    date: today,
    source: resendSource,
    accounts: {
      resend: { sent: resendSent, limit: RESEND_DAILY_LIMIT, remaining: Math.max(0, RESEND_DAILY_LIMIT - resendSent), label: "Resend (default)", email: "noreply@certs.pharmacozyme.com" },
      ...gmailAccounts,
    },
  });
}
