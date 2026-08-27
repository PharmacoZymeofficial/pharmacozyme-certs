import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase.admin";
import { requireAdmin } from "@/lib/requireAdmin";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const limitNum = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
  const type = searchParams.get("type"); // optional filter

  try {
    let ref = getAdminDb()
      .collection("activity_logs")
      .orderBy("timestamp", "desc")
      .limit(limitNum);

    const snap = await ref.get();
    let logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (type) logs = logs.filter((l: any) => l.type === type);
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const { type, databaseId, databaseName, count, details } = body;

    // Identity comes from the verified session, never from the request body —
    // otherwise the audit log is trivially forgeable.
    const logEntry = {
      type,
      adminName: guard.session.displayName,
      adminEmail: guard.session.email,
      databaseId: databaseId || "",
      databaseName: databaseName || "",
      count: count || 0,
      details: details || "",
      timestamp: new Date().toISOString(),
    };

    const docRef = await getAdminDb().collection("activity_logs").add(logEntry);
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
