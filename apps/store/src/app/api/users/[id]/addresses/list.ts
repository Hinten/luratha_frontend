import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminAddressConverter } from "@luratha/firestore/adminAddressConverter";
import { firestoreCollections } from "@luratha/schemas";
import { authErrorResponse, requireOwnerOrAdmin } from "@luratha/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/users/:id/addresses
 *
 * Lista todos os endereços salvos do usuário. Retorna sempre 200 com array
 * (vazio quando não há endereços). Requer que o uid da sessão bata com :id
 * ou que o usuário tenha claim admin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireOwnerOrAdmin(id);
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const ref = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(id)
    .collection(firestoreCollections.addresses)
    .withConverter(adminAddressConverter);

  const snapshot = await ref.get();
  const addresses = snapshot.docs.map((d) => d.data());

  return NextResponse.json(addresses, { status: 200 });
}
