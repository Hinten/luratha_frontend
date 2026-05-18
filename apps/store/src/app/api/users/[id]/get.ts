import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminUserProfileConverter } from "@/src/lib/firestore/adminUserProfileConverter";
import { firestoreCollections } from "@/src/schemas/firestore";
import { authErrorResponse, requireOwnerOrAdmin } from "@/src/lib/auth/requireUser";

export const runtime = "nodejs";

/**
 * GET /api/users/:id
 *
 * Fetches the user profile identified by :id. Returns 404 when no profile
 * exists for that uid, 200 with the profile on success. Requer que o uid da
 * sessão bata com :id, ou que o usuário tenha claim admin.
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

  const profileRef = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(id)
    .withConverter(adminUserProfileConverter);

  const snapshot = await profileRef.get();

  if (!snapshot.exists) {
    return NextResponse.json(
      { message: `Perfil de usuário com id "${id}" não encontrado.` },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot.data(), { status: 200 });
}
