import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminUserProfileConverter } from "@/src/lib/firestore/adminUserProfileConverter";
import { firestoreCollections, validateUserProfile } from "@/src/schemas/firestore";

export const runtime = "nodejs";

/**
 * PUT /api/users/:id
 *
 * Upsert: cria o perfil se não existir, sobrescreve se existir. Usado
 * principalmente quando o usuário entra em /conta pela primeira vez —
 * o signup atual (mock localStorage) não cria o doc do Firestore, então
 * o /conta/dados precisa de um caminho idempotente para garantir que o
 * doc esteja lá antes de fazer PATCH.
 *
 * Servidor controla:
 *   - `id` é forçado para o :id da URL
 *   - `createdAt` é preservado se já existe; gerado se for criação
 *   - `updatedAt` sempre é atualizado
 */
export async function PUT(
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
  const now = new Date().toISOString();

  const merged: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
    id,
    createdAt: existing.exists ? existing.data()!.createdAt : now,
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

  return NextResponse.json(profile, { status: existing.exists ? 200 : 201 });
}
