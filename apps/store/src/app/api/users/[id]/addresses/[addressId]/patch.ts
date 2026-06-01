import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminAddressConverter } from "@luratha/firestore/adminAddressConverter";
import { firestoreCollections, validateAddress } from "@luratha/schemas";
import { unsetOtherDefaults } from "@/src/app/api/users/[id]/addresses/post";
import { authErrorResponse, requireOwnerOrAdmin } from "@luratha/auth/requireUser";
import { lookupCep } from "@/src/lib/cep/viaCep";

export const runtime = "nodejs";

/**
 * PATCH /api/users/:id/addresses/:addressId
 *
 * Atualização parcial. Servidor preserva `id` e `createdAt`; reescreve
 * `updatedAt`. Se a atualização promover o endereço a default, desmarca
 * os outros via batch (ver helper em post.ts).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; addressId: string }> },
) {
  const { id: userId, addressId } = await params;

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

  const ref = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(userId)
    .collection(firestoreCollections.addresses)
    .doc(addressId)
    .withConverter(adminAddressConverter);

  const existing = await ref.get();
  if (!existing.exists) {
    return NextResponse.json(
      { message: `Endereço "${addressId}" não encontrado.` },
      { status: 404 },
    );
  }

  const existingData = existing.data()!;
  const payload = body as Record<string, unknown>;
  const now = new Date().toISOString();

  const merged: Record<string, unknown> = {
    ...existingData,
    ...payload,
    id: addressId,
    createdAt: existingData.createdAt,
    updatedAt: now,
  };

  // Se o CEP faz parte deste update, o servidor é autoritativo sobre o `ibgeCode`:
  // descarta o valor herdado do `existingData` (seria de outra cidade) para
  // recomputá-lo via ViaCEP mais abaixo. PATCHs que não tocam o CEP preservam o
  // `ibgeCode` atual pelo merge.
  const cepInPayload = "postalCode" in payload;
  if (cepInPayload) delete merged.ibgeCode;

  let address;
  try {
    address = validateAddress(merged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Dados do endereço inválidos.", errors: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }

  if (address.isDefault && !existingData.isDefault) {
    await unsetOtherDefaults(userId, addressId);
  }

  // Enriquecimento best-effort do `ibgeCode` via ViaCEP (necessário p/ NF-e), só
  // quando o CEP foi (re)enviado. NÃO bloqueia: a base do ViaCEP não é exaustiva e o
  // formato já foi validado. `not_found`/`error` → grava sem `ibgeCode` (o `merged`
  // já teve a chave removida acima, então nada a fazer). Espelha o POST.
  if (cepInPayload) {
    const cepLookup = await lookupCep(address.postalCode);
    if (cepLookup.status === "found" && /^\d{7}$/.test(cepLookup.ibge)) {
      address = { ...address, ibgeCode: cepLookup.ibge };
    }
  }

  await ref.set(address);

  return NextResponse.json(address, { status: 200 });
}
