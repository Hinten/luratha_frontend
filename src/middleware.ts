import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "__session";

/**
 * Edge middleware: presence-check do cookie de sessão.
 *
 * Roda apenas para rotas protegidas (matcher abaixo). Quando o cookie
 * `__session` está ausente, redireciona para `/login?redirect=<path>`. A
 * verificação autoritativa (assinatura, expiração, claims) acontece nos API
 * handlers e server components via `requireUser()` — `firebase-admin` é
 * Node-only e não roda em Edge runtime.
 */
export function middleware(req: NextRequest) {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie && sessionCookie.length > 0) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  const original = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = `?redirect=${encodeURIComponent(original)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/conta/:path*", "/checkout/:path*"],
};
