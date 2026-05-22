import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Firebase App Hosting only forwards the reserved `__session` cookie to the
// backend. Kept inline (not imported from @luratha/auth) so this Edge
// middleware never pulls in firebase-admin.
const SESSION_COOKIE = "__session";

/**
 * Shallow gate: redirects to /login when the session cookie is absent. The
 * actual session verification and `admin` custom-claim check happen in the
 * dashboard layout (a Node server component) via `requireUser()` — the Edge
 * runtime cannot run firebase-admin.
 */
export function middleware(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
