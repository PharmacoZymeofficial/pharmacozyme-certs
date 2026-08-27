import { NextRequest, NextResponse } from "next/server";
import { sessionFromCookieHeader, SessionPayload } from "@/lib/session";

export type AdminGuardResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

/**
 * Gate for admin-only API routes.
 *
 * Before this existed, admin routes were entirely ungated — cert delete/update,
 * participant batch-update, database mutation, template upload, bulk email, and the
 * full-PII certificate list were all reachable unauthenticated.
 *
 * Usage:
 *   const guard = await requireAdmin(request);
 *   if (!guard.ok) return guard.response;
 *   // guard.session.uid / .email / .role are now trusted
 */
export async function requireAdmin(request: NextRequest): Promise<AdminGuardResult> {
  const session = await sessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

/** Same, but additionally requires the super-admin role (user management, destructive ops). */
export async function requireSuperAdmin(request: NextRequest): Promise<AdminGuardResult> {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard;
  if (guard.session.role !== "super_admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 }),
    };
  }
  return guard;
}

/**
 * Auth for the Vercel Cron self-call. The cron cannot present an admin cookie, so it
 * authenticates with CRON_SECRET instead. Required, not optional — the previous
 * `if (process.env.CRON_SECRET)` meant an unset var silently made the route public.
 */
export function requireCronSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
