import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminAddressConverter } from "@luratha/firestore/adminAddressConverter";
import { firestoreCollections, validateAddress } from "@luratha/schemas";
import { authErrorResponse, requireOwnerOrAdmin } from "@luratha/auth/requireUser";

export const runtime = "nodejs";

/**
 * POST /api/users/:id/addresses
 *
 * Cria um endereço na subcoleção `userProfiles/:id/addresses`.
 *
 * Servidor controla:
 *   - `id`        — UUID gerado
 *   - `createdAt` / `updatedAt`
 *
 * Se `isDefault: true` for enviado, todos os outros endereços do usuário
 * têm `isDefault` desmarcado em batch para garantir um único default.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: userId } = await params;

  try {
    await requireOwnerOrAdmin(userId);
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
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
    return NextResponse.json(
      { message: "Corpo da requisição deve ser um objeto JSON." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  const input: Record<string, unknown> = {
    ...(body as Record<string, unknown>),
    id,
    createdAt: now,
    updatedAt: now,
  };

  let address;
  try {
    address = validateAddress(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do endereço inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  const collectionRef = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(userId)
    .collection(firestoreCollections.addresses);

  if (address.isDefault) {
    await unsetOtherDefaults(userId);
  }

  await collectionRef.doc(address.id).withConverter(adminAddressConverter).set(address);

  return NextResponse.json(address, { status: 201 });
}

/**
 * Marca como `isDefault: false` qualquer outro endereço do usuário, em batch.
 * Necessário para manter o invariante "no máximo um endereço default por usuário".
 */
export async function unsetOtherDefaults(userId: string, exceptId?: string): Promise<void> {
  const collectionRef = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(userId)
    .collection(firestoreCollections.addresses);

  const snapshot = await collectionRef.where("isDefault", "==", true).get();
  if (snapshot.empty) return;

  const batch = adminDb.batch();
  const now = Timestamp.fromDate(new Date());
  for (const docSnap of snapshot.docs) {
    if (exceptId && docSnap.id === exceptId) continue;
    batch.update(docSnap.ref, { isDefault: false, updatedAt: now });
  }
  await batch.commit();
}
