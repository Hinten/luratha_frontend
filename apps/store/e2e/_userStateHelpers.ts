import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { firestoreCollections } from "@luratha/schemas";

/**
 * Helpers de limpeza de state do MP test user reaproveitado entre runs.
 *
 * Diferente do `seedFixtureCart`/`clearFixtureCart` (que cuidam só do cart),
 * estes lidam com o resto do state que pode vazar entre runs do
 * `checkout-card-real.mp.spec.ts` (endereços criados via UI, orders pendentes
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
 * Deleta orders do user em estados NÃO-terminais — `pending`, `awaiting_pix`,
 * `awaiting_boleto`, `authorized`, `failed` e `unknown`. Preserva orders em
 * estados terminais (`paid`, `partially_refunded`, `in_dispute`, `refunded`,
 * `charged_back`) como histórico real.
 *
 * Por que esses: o `POST /api/orders` cria Order com `pending`; PIX/boleto
 * criados vão pra `awaiting_pix`/`awaiting_boleto`; cartão em análise de fraude
 * pra `authorized`; cartão rejeitado pra `failed`; status do MP não reconhecido
 * pra `unknown`. Todas são "lixo de teste" — não representam histórico real do
 * MP test user.
 */
export async function clearPendingOrdersFor(uid: string): Promise<void> {
  const snap = await adminDb
    .collection(firestoreCollections.orders)
    .where("userId", "==", uid)
    .where("paymentStatus", "in", [
      "pending",
      "awaiting_pix",
      "awaiting_boleto",
      "authorized",
      "failed",
      "unknown",
    ])
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}
