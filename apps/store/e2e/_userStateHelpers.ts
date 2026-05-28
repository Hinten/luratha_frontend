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
 * Deleta orders do user em estados NÃO-terminais — `pending`, `authorized`
 * e `failed`. Preserva orders em estados terminais (`paid`, `in_dispute`,
 * `refunded`, `charged_back`) como histórico real.
 *
 * Por que esses 3: o `POST /api/orders` cria Order com `pending`; cartão
 * em análise de fraude vai pra `authorized`; cartão rejeitado vai pra
 * `failed`. Todas são "lixo de teste" — não representam histórico real do
 * MP test user. Antes só limpávamos `pending`, então `authorized`/`failed`
 * acumulavam ao longo de runs sucessivas.
 */
export async function clearPendingOrdersFor(uid: string): Promise<void> {
  const snap = await adminDb
    .collection(firestoreCollections.orders)
    .where("userId", "==", uid)
    .where("paymentStatus", "in", ["pending", "authorized", "failed"])
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}
