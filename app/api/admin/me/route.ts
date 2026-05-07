import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const ADMIN_COOKIE = "pz_admin_auth";

export async function GET() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ADMIN_COOKIE);
  if (!cookie?.value) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Legacy "authenticated" value
  if (cookie.value === "authenticated") {
    return NextResponse.json({
      user: {
        uid: "legacy",
        email: "admin@pharmacozyme.com",
        displayName: "Administrator",
        role: "super_admin",
        tutorialSeen: true,
      },
    });
  }

  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const user = JSON.parse(decoded);
    if (user.uid && user.email) {
      // Fetch tutorialSeen from Firestore. Treat missing field as `true`
      // (skip auto-tutorial) so legacy admins don't get surprised.
      let tutorialSeen = true;
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          tutorialSeen = data.tutorialSeen !== false;
        }
      } catch {
        // ignore; default to true
      }
      return NextResponse.json({ user: { ...user, tutorialSeen } });
    }
  } catch {
    // invalid cookie
  }

  return NextResponse.json({ user: null }, { status: 401 });
}
