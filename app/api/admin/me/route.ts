import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
      },
    });
  }

  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const user = JSON.parse(decoded);
    if (user.uid && user.email) {
      return NextResponse.json({ user });
    }
  } catch {
    // invalid cookie
  }

  return NextResponse.json({ user: null }, { status: 401 });
}
