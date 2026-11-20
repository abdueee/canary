import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Runs before every page request (Next.js 16 calls this file proxy.ts).
//
// It only checks that a session cookie EXISTS. It does not validate it, since
// anyone can set a cookie by hand. Real protection is requireUser()/requireRole()
// on the server. This is just a fast redirect so signed-out visitors don't see
// a flash of a protected page.
const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname) || getSessionCookie(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip API routes (they return 401 themselves), Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
