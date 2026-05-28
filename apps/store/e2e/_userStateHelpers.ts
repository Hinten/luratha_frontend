import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { firestoreCollections } from "@luratha/schemas";

/**
 * Helpers de limpeza de state do MP test user reaproveitado entre runs.
 *
 * Diferente do `seedFixtureCart`/`clearFixtureCart` (que cuidam só do cart),
 * estes lidam com o resto do state que pode vazar entre runs do
 * `checkout-card-real.spec.ts` (endereços criados via UI, orders pendentes
 * de tentativas anteriores). Cleanup explícito evita race do snapshot do
 * `CartContext` e dados acumulando ao longo de várias execuções.
 */

/**
 * Deleta todos os endereços do user (`userProfiles/{uid}/addresses/*`).
 *
 * Path conferido em `apps/store/src/app/api/users/[id]/addresses/post.ts:81-84`
 * — subcollection `addresses` sob `userProfiles/{uid}`.
 */
export async function clearUserAddresses(uid: string): Promise<void> {
  const col = adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(uid)
    .collection(firestoreCollections.addresses);
  const snap = await col.get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/**
 * Deleta orders do user com `paymentStatus === "pending"`. Não toca em orders
 * pagas, falhadas ou em disputa — preserva histórico real.
 *
 * Por que `pending` apenas: o `POST /api/orders` cria Order com status
 * `pending`. Se uma run anterior travou entre `/api/orders` e
 * `/api/checkout/payment-intent`, sobra Order pendente sem payment. Limpamos
 * essas pra não acumular lixo e pra `paymentApi` cloud test não confundir.
 */
export async function clearPendingOrdersFor(uid: string): Promise<void> {
  const snap = await adminDb
    .collection(firestoreCollections.orders)
    .where("userId", "==", uid)
    .where("paymentStatus", "==", "pending")
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}
