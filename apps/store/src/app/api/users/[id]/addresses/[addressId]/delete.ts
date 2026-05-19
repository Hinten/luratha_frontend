import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { firestoreCollections } from "@luratha/schemas";
import { authErrorResponse, requireOwnerOrAdmin } from "@/src/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * DELETE /api/users/:id/addresses/:addressId
 *
 * Remove o endereço. Não invalida pedidos antigos: o `shippingAddressPath` na
 * order vira uma referência morta — quem ler precisa tratar 404 graciosamente
 * (ex: exibir "endereço removido"). Quando emitirmos NF-e, fazemos snapshot
 * antes da emissão.
 */
export async function DELETE(
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
    .doc(addressId);

  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json(
      { message: `Endereço "${addressId}" não encontrado.` },
      { status: 404 },
    );
  }

  await ref.delete();
  return new NextResponse(null, { status: 204 });
}
