import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Coach routes have their own separate authentication (see coach-portal's
  // layout.tsx, which checks the wtb_coach_session cookie directly). They
  // must never be redirected by the STAFF login check below.
  if (pathname.startsWith("/coach-login") || pathname.startsWith("/coach-portal")) {
    return NextResponse.next();
  }

  const session = request.cookies.get("wtb_admin_session");
  const isLoginPage = pathname.startsWith("/login");

  if (!session && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
