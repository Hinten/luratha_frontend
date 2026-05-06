import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminUserProfileConverter } from "@/src/lib/firestore/adminUserProfileConverter";
import { firestoreCollections, validateUserProfile } from "@/src/schemas/firestore";

export const runtime = "nodejs";

/**
 * PATCH /api/users/:id
 *
 * Partially updates a user profile.
 *
 * Server-controlled (always preserved/overwritten):
 *   - `id`, `createdAt` are taken from the stored document
 *   - `updatedAt` is set to the current timestamp
 *
 * Returns 404 if no profile exists, 400 on validation failure, 200 with the
 * updated profile on success.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Corpo da requisição inválido. Esperado JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { message: "Corpo da requisição deve ser um objeto JSON." },
      { status: 400 },
    );
  }

  const profileRef = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(id)
    .withConverter(adminUserProfileConverter);

  const existing = await profileRef.get();
  if (!existing.exists) {
    return NextResponse.json(
      { message: `Perfil de usuário com id "${id}" não encontrado.` },
      { status: 404 },
    );
  }

  const existingData = existing.data()!;
  const payload = body as Record<string, unknown>;
  const now = new Date().toISOString();

  const merged: Record<string, unknown> = {
    ...existingData,
    ...payload,
    id,
    createdAt: existingData.createdAt,
    updatedAt: now,
  };

  let profile;
  try {
    profile = validateUserProfile(merged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do perfil inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Falha ao validar o perfil." }, { status: 400 });
  }

  await profileRef.set(profile);

  return NextResponse.json(profile, { status: 200 });
}
