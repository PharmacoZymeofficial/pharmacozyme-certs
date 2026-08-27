import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase.admin";
import { signSession, ADMIN_COOKIE, SESSION_MAX_AGE_SECONDS, AdminRole } from "@/lib/session";

const SUPER_ADMIN_EMAIL = "pharmacozymeofficial@gmail.com";

const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

// Best-effort, per-instance only. Serverless gives each instance its own Map, so this
// is a cheap first pass, NOT the real control — see the Vercel Firewall rule.
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + LOCKOUT_MS });
    return { allowed: true };
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 60000) };
  }
  record.count++;
  return { allowed: true };
}

/**
 * Exchanges a Firebase ID token for a signed admin session cookie.
 *
 * This route previously accepted `{uid, email}` straight from the request body and
 * issued a session for whatever it was told — posting the super admin's email was
 * enough to become super admin. It now requires a real Firebase ID token, verifies it
 * server-side, and additionally enforces the `admins/{uid}.status === "approved"`
 * check that only the client was doing before.
 *
 * The legacy shared-password flow has been removed: it granted `super_admin` outright
 * and defaulted to a password committed to the repo.
 */
export async function POST(request: NextRequest) {
  const ip = getIp(request);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rateCheck.retryAfter} minute(s).` },
      { status: 429 }
    );
  }

  let idToken: string | undefined;
  try {
    idToken = (await request.json())?.idToken;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  let uid: string;
  let email: string;
  let tokenName: string | undefined;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = (decoded.email || "").toLowerCase();
    tokenName = decoded.name as string | undefined;
  } catch {
    return NextResponse.json({ error: "Invalid or expired sign-in token" }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json({ error: "Account has no email address" }, { status: 401 });
  }

  // Approval gate — previously enforced only in client-side code, i.e. not at all.
  const adminSnap = await getAdminDb().collection("admins").doc(uid).get();
  if (!adminSnap.exists) {
    return NextResponse.json(
      { error: "No admin record found for this account. Ask a super admin to approve access." },
      { status: 403 }
    );
  }
  const adminData = adminSnap.data() || {};
  if (adminData.status !== "approved") {
    return NextResponse.json(
      { error: `Your account is ${adminData.status || "not approved"}. Ask a super admin to approve access.` },
      { status: 403 }
    );
  }

  // Role is derived server-side. It is never read from the request.
  const role: AdminRole = email === SUPER_ADMIN_EMAIL ? "super_admin" : "admin";
  const displayName = adminData.displayName || tokenName || email.split("@")[0];

  rateLimitMap.delete(ip);

  const token = await signSession({ uid, email, displayName, role });
  const response = NextResponse.json({
    success: true,
    user: { uid, email, displayName, role },
  });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
