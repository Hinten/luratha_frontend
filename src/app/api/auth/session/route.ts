import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/src/lib/firestore/firebaseAdmin";
import { SESSION_COOKIE_NAME } from "@/src/lib/auth/requireUser";

export const runtime = "nodejs";

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * POST /api/auth/session
 *
 * Trocar um Firebase ID token (vindo do client SDK após signIn/createUser) por
 * um session cookie HttpOnly. Aceita: { idToken: string }.
 * Responde com { uid, email, displayName, isAdmin } e seta o cookie `__session`
 * (nome obrigatório no Firebase App Hosting).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Corpo da requisição inválido. Esperado JSON." },
      { status: 400 },
    );
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
  } catch {
    return NextResponse.json(
      { message: "Token inválido ou expirado." },
      { status: 401 },
    );
  }

  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });
  } catch {
    return NextResponse.json(
      { message: "Falha ao criar a sessão." },
      { status: 500 },
    );
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
      isAdmin: decoded.admin === true,
    },
    { status: 200 },
  );
}

/**
 * DELETE /api/auth/session
 *
 * Limpa o cookie de sessão e revoga os refresh tokens do uid se possível.
 * Idempotente: sempre retorna 204, mesmo quando o cookie já era inválido.
 */
export async function DELETE() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie, false);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // cookie já inválido — apenas limpamos
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
