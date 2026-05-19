import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FirebaseAuthError } from "firebase-admin/auth";
import { adminAuth } from "@luratha/firestore/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@luratha/auth/requireUser";

export const runtime = "nodejs";

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * POST /api/auth/session
 *
 * Exchanges a Firebase ID token (from the client SDK sign-in) for an HttpOnly
 * `__session` cookie — but only for users carrying the `admin` custom claim.
 * Non-admins are rejected with 403 and no cookie is set.
 *
 * The cookie is set host-only (no `domain`), so the admin session stays
 * isolated from the storefront on its own subdomain — do NOT add `domain`.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Corpo da requisição inválido. Esperado JSON." },
        { status: 400 },
      );
    }
    throw err;
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { idToken?: unknown }).idToken !== "string"
  ) {
    return NextResponse.json(
      { message: "Campo 'idToken' (string) é obrigatório." },
      { status: 400 },
    );
  }

  const idToken = (body as { idToken: string }).idToken;

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch (err) {
    if (err instanceof FirebaseAuthError) {
      return NextResponse.json(
        { message: "Token inválido ou expirado." },
        { status: 401 },
      );
    }
    throw err;
  }

  if (decoded.admin !== true) {
    return NextResponse.json(
      { message: "Acesso restrito a administradores." },
      { status: 403 },
    );
  }

  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
  } catch (err) {
    if (err instanceof FirebaseAuthError) {
      return NextResponse.json(
        { message: "Falha ao criar a sessão." },
        { status: 500 },
      );
    }
    throw err;
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  return NextResponse.json(
    {
      uid: decoded.uid,
      email: decoded.email ?? null,
      displayName: decoded.name ?? null,
    },
    { status: 200 },
  );
}

/**
 * DELETE /api/auth/session
 *
 * Clears the session cookie and revokes the uid's refresh tokens when
 * possible. Idempotent: always returns 204.
 */
export async function DELETE() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie, false);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch (err) {
      if (!(err instanceof FirebaseAuthError)) {
        throw err;
      }
      // Cookie expired/revoked/invalid — proceed to clear it from the browser.
    }
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return new NextResponse(null, { status: 204 });
}
