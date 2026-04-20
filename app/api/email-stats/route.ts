import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const statsSnap = await getDoc(doc(db, "email_stats", today));
    const sent = statsSnap.exists() ? (statsSnap.data().sent || 0) : 0;
    const limit = 100;
    return NextResponse.json({ sent, limit, remaining: limit - sent, date: today });
  } catch {
    return NextResponse.json({ sent: 0, limit: 100, remaining: 100, date: "" });
  }
}
