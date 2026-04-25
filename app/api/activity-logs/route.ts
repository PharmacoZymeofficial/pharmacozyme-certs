import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "pz_admin_auth";

function getAdminFromCookie(cookieValue: string | undefined): { adminName: string; adminEmail: string } {
  let adminName = "Administrator";
  let adminEmail = "admin@pharmacozyme.com";
  if (!cookieValue || cookieValue === "authenticated") return { adminName, adminEmail };
  try {
    const decoded = Buffer.from(cookieValue, "base64").toString("utf-8");
    const user = JSON.parse(decoded);
    if (user.displayName) adminName = user.displayName;
    if (user.email) adminEmail = user.email;
  } catch { /* use defaults */ }
  return { adminName, adminEmail };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitNum = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const type = searchParams.get("type"); // optional filter

  try {
    const logsRef = collection(db, "activity_logs");
    const q = query(logsRef, orderBy("timestamp", "desc"), limit(limitNum));
    const snap = await getDocs(q);
    let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (type) logs = logs.filter((l: any) => l.type === type);
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, databaseId, databaseName, count, details } = body;

    const cookieStore = await cookies();
    const cookie = cookieStore.get(ADMIN_COOKIE);
    const { adminName, adminEmail } = getAdminFromCookie(cookie?.value);

    const logEntry = {
      type,
      adminName,
      adminEmail,
      databaseId: databaseId || "",
      databaseName: databaseName || "",
      count: count || 0,
      details: details || "",
      timestamp: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "activity_logs"), logEntry);
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
