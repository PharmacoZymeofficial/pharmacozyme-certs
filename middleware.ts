import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "pz_admin_auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login" || pathname === "/admin/login/") return NextResponse.next();

  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
