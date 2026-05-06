import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminAddressConverter } from "@/src/lib/firestore/adminAddressConverter";
import { firestoreCollections } from "@/src/schemas/firestore";

export const runtime = "nodejs";

/**
 * GET /api/users/:id/addresses
 *
 * Lista todos os endereços salvos do usuário. Retorna sempre 200 com array
 * (vazio quando não há endereços ou quando o usuário não existe — checagem
 * de existência fica para o middleware/auth em PR 6).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ref = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(id)
    .collection(firestoreCollections.addresses)
    .withConverter(adminAddressConverter);

  const snapshot = await ref.get();
  const addresses = snapshot.docs.map((d) => d.data());

  return NextResponse.json(addresses, { status: 200 });
}
