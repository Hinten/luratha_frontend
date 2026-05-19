import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminAddressConverter } from "@/src/lib/firestore/adminAddressConverter";
import { firestoreCollections } from "@luratha/schemas";
import { authErrorResponse, requireOwnerOrAdmin } from "@/src/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/users/:id/addresses/:addressId
 *
 * Retorna o endereço específico ou 404 se não existir.
 */
export async function GET(
  _request: Request,
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

  const ref = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(userId)
    .collection(firestoreCollections.addresses)
    .doc(addressId)
    .withConverter(adminAddressConverter);

  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json(
      { message: `Endereço "${addressId}" não encontrado.` },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot.data(), { status: 200 });
}
