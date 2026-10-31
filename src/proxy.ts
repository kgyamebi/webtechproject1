import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * This check only looks for a session cookie so navigation stays fast.
 * It is not proof of a valid session. Every workspace page asks the
 * database through auth.api.getSession before showing private data.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));
  const isWorkspace = pathname.startsWith("/workspace");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isWorkspace && !hasSessionCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isAuthPage && hasSessionCookie) {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/workspace/:path*", "/login", "/register"],
};
