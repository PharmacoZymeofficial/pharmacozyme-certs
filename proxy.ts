import { NextRequest, NextResponse } from "next/server";
import { verifySession, ADMIN_COOKIE } from "@/lib/session";

/**
 * Gate for the /admin UI.
 *
 * This previously checked only that the cookie was non-empty — `pz_admin_auth=x` was
 * enough to get in. It now verifies the HMAC signature and expiry.
 *
 * Note this is defence in depth for the UI shell only; the API routes enforce their own
 * auth via `requireAdmin`, because proxy matchers are easy to bypass in ways route
 * handlers are not.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = await verifySession(request.cookies.get(ADMIN_COOKIE)?.value);

    if (!session) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      const response = NextResponse.redirect(loginUrl);
      // Clear a stale or tampered cookie so the browser stops re-sending it.
      response.cookies.delete(ADMIN_COOKIE);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
