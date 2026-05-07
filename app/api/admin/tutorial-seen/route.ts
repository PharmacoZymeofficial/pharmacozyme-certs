import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

const ADMIN_COOKIE = "pz_admin_auth";

export async function POST() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ADMIN_COOKIE);
  if (!cookie?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (cookie.value === "authenticated") {
    return NextResponse.json({ success: true, legacy: true });
  }

  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const user = JSON.parse(decoded);
    if (!user.uid) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    await updateDoc(doc(db, "admins", user.uid), { tutorialSeen: true });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to mark tutorial seen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
