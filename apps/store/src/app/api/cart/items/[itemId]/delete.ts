import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import { CartRepositoryError, createCartsRepository } from "@luratha/repositories/cartsRepository";

export const runtime = "nodejs";

/**
 * DELETE /api/cart/items/:itemId
 *
 * Removes a single item from the authenticated user's cart and returns the
 * resulting cart snapshot.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const { itemId } = await params;
  const repository = createCartsRepository(adminDb);

  try {
    const snapshot = await repository.removeItem(authedUser.uid, itemId);
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    if (error instanceof CartRepositoryError && error.code === "not_found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof CartRepositoryError) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    throw error;
  }
}
