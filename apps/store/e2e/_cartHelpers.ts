import { adminDb } from "@luratha/firestore/firebaseAdmin";
import {
  adminCartConverter,
  adminCartItemConverter,
} from "@luratha/firestore/adminCartConverter";
import { firestoreCollections, type CartItem } from "@luratha/schemas";

/**
 * Semeia o carrinho do user fixture diretamente no Firestore — o
 * `CartContext` (cliente) escuta via `onSnapshot` e o `CheckoutFlow` só
 * renderiza quando `cartReady && items.length > 0`. Mockar `localStorage` no
 * spec não basta: pra users logados o cart é Firestore-authoritativo
 * (localStorage só vale em modo guest).
 *
 * Cada chamada substitui o conteúdo prévio (delete + set), garantindo
 * isolamento entre testes do mesmo run.
 */

const DEFAULT_ITEM: Omit<CartItem, "userId" | "addedAt" | "updatedAt"> = {
  id: "prod_e2e_conjunto_crochet",
  productId: "prod_e2e_conjunto_crochet",
  variantSku: "LURATHA_E2E_002",
  productSlug: "conjunto-saia-e-blusa-crochet-luratha-e2e-002",
  name: "Conjunto Saia e Blusa Crochet",
  photoId: "img-e2e-002",
  imageUrl:
    "https://firebasestorage.googleapis.com/v0/b/luratha-test/o/conjunto-crochet.jpg?alt=media",
  unitPrice: 419,
  quantity: 1,
  currency: "BRL",
  dimensions: null,
};

export async function seedFixtureCart(uid: string): Promise<void> {
  await clearFixtureCart(uid);

  const now = new Date().toISOString();
  const items: CartItem[] = [
    {
      ...DEFAULT_ITEM,
      userId: uid,
      addedAt: now,
      updatedAt: now,
    },
  ];
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const cartRef = adminDb
    .collection(firestoreCollections.carts)
    .doc(uid)
    .withConverter(adminCartConverter);
  await cartRef.set({
    id: uid,
    userId: uid,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    discountTotal: 0,
    shippingTotal: 0,
    grandTotal: subtotal,
    currency: "BRL",
    recentMergeTokens: [],
    updatedAt: now,
  });

  const itemsCol = cartRef.collection(firestoreCollections.cartItems);
  await Promise.all(
    items.map((item) =>
      itemsCol.doc(item.id).withConverter(adminCartItemConverter).set(item),
    ),
  );
}

export async function clearFixtureCart(uid: string): Promise<void> {
  const cartRef = adminDb.collection(firestoreCollections.carts).doc(uid);
  const itemsSnap = await cartRef.collection(firestoreCollections.cartItems).get();
  await Promise.all(itemsSnap.docs.map((doc) => doc.ref.delete()));
  await cartRef.delete();
}
