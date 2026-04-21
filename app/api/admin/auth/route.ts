import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "pz_admin_auth";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "pharmacozyme2026";
const SUPER_ADMIN_EMAIL = "pharmacozymeofficial@gmail.com";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

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

function setCookieWithUser(response: NextResponse, user: object) {
  const encoded = Buffer.from(JSON.stringify(user)).toString("base64");
  response.cookies.set(ADMIN_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rateCheck.retryAfter} minute(s).` },
      { status: 429 }
    );
  }

  const body = await request.json();

  // Firebase Auth flow: client sends uid + email after successful Firebase sign-in
  if (body.uid && body.email) {
    const { uid, email, displayName } = body;
    const role: "super_admin" | "admin" = email === SUPER_ADMIN_EMAIL ? "super_admin" : "admin";
    const user = { uid, email, displayName: displayName || email.split("@")[0], role };
    rateLimitMap.delete(ip);
    const response = NextResponse.json({ success: true, user });
    setCookieWithUser(response, user);
    return response;
  }

  // Legacy password flow
  if (body.password) {
    if (body.password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    rateLimitMap.delete(ip);
    const user = {
      uid: "legacy",
      email: "admin@pharmacozyme.com",
      displayName: "Administrator",
      role: "super_admin" as const,
    };
    const response = NextResponse.json({ success: true });
    setCookieWithUser(response, user);
    return response;
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
