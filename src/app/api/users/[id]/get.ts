import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminUserProfileConverter } from "@/src/lib/firestore/adminUserProfileConverter";
import { firestoreCollections } from "@/src/schemas/firestore";

export const runtime = "nodejs";

/**
 * GET /api/users/:id
 *
 * Fetches the user profile identified by :id. Returns 404 when no profile
 * exists for that uid, 200 with the profile on success.
 *
 * Authorization (own-profile or admin) is enforced by the route middleware
 * once it lands in PR 6. Until then, this endpoint is intentionally permissive
 * so the cloud test suite can exercise it directly.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
