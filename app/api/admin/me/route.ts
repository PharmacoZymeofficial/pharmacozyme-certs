import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminDb } from "@/lib/firebase.admin";
import { verifySession, ADMIN_COOKIE } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Treat a missing field as `true` (skip auto-tutorial) so existing admins
  // don't get surprised by the tutorial re-opening.
  let tutorialSeen = true;
  try {
    const snap = await getAdminDb().collection("admins").doc(session.uid).get();
    if (snap.exists) tutorialSeen = snap.data()?.tutorialSeen !== false;
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    user: {
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      role: session.role,
      tutorialSeen,
    },
  });
}
