import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firestore/firebaseAdmin";

export const SESSION_COOKIE_NAME = "__session";

export interface AuthedUser {
  uid: string;
  email: string | null;
  isAdmin: boolean;
}

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<AuthedUser> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) {
    throw new AuthError(401, "Não autenticado.");
  }
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      isAdmin: decoded.admin === true,
    };
  } catch {
    throw new AuthError(401, "Sessão inválida ou expirada.");
  }
}

export async function requireOwnerOrAdmin(targetUid: string): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.isAdmin || user.uid === targetUid) {
    return user;
  }
  throw new AuthError(403, "Acesso negado.");
}

export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  return null;
}
