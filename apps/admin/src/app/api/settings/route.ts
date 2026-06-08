import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import { getSiteSettings, setSiteSettings } from "@luratha/repositories/siteSettingsRepository";

export const runtime = "nodejs";

/**
 * PATCH /api/settings
 *
 * Partial update of the global site settings document (`settings/global`).
 * Admin-only. Reads the current document fresh (bypassing the in-memory
 * cache), shallow-merges the JSON payload over it, and persists via
 * `setSiteSettings` — which re-stamps `id`/`updatedAt`, validates with Zod and
 * refreshes the cache.
 *
 * Merge order is `{ ...current, ...payload }`: keys absent from the payload
 * keep their stored value; the settings editor submits the full `shipping`
 * object, so that block is replaced wholesale.
 */
export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    throw err;
  }
  if (!user.isAdmin) {
    return NextResponse.json({ message: "Acesso restrito a administradores." }, { status: 403 });
  }

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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Corpo deve ser um objeto JSON." }, { status: 400 });
  }

  const current = await getSiteSettings({ forceFresh: true });
  const merged = { ...current, ...(body as Record<string, unknown>) };

  let saved;
  try {
    saved = await setSiteSettings(merged);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Configuração inválida.", errors: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  return NextResponse.json(saved, { status: 200 });
}
