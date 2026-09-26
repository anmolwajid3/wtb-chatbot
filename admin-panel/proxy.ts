import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { STAFF_COOKIE } from "@/lib/brand";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (/\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|woff2?)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // Profile-holder routes authenticate with their own cookie.
  if (pathname.startsWith("/coach-login") || pathname.startsWith("/coach-portal")) {
    return NextResponse.next();
  }

  const isPublic =
    pathname === "/" || pathname.startsWith("/login") || pathname === "/admin" || pathname.startsWith("/join");
  const session = request.cookies.get(STAFF_COOKIE);
  const isLoginPage = pathname.startsWith("/login") || pathname === "/admin";
  const databaseDown = request.nextUrl.searchParams.get("error") === "db";

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && isLoginPage && !databaseDown) {
    return NextResponse.redirect(new URL("/home", request.url));
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-harbor-path", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|woff2?)$).*)"],
};
