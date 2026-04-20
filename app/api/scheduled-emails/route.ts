import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, subject, message, scheduledAt } = body;
    if (!recipients?.length || !scheduledAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const docRef = await addDoc(collection(db, "scheduled_emails"), {
      recipients,
      subject,
      message,
      scheduledAt,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: docRef.id, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const snap = await getDocs(query(collection(db, "scheduled_emails"), orderBy("scheduledAt", "desc")));
    const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
