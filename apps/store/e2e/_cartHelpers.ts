import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCartConverter, adminCartItemConverter } from "@luratha/firestore/adminCartConverter";
import { firestoreCollections, type CartItem } from "@luratha/schemas";
import { expect, type Page } from "@playwright/test";

/**
 * Semeia o carrinho do user fixture diretamente no Firestore — o
 * `CartContext` (cliente) escuta via `onSnapshot` e o `CheckoutFlow` só
 * renderiza quando `cartReady && items.length > 0`. Mockar `localStorage` no
 * spec não basta: pra users logados o cart é Firestore-authoritativo
 * (localStorage só vale em modo guest).
 *
 * Cada chamada substitui o conteúdo prévio (delete + set), garantindo
 * isolamento entre testes do mesmo run.
 *
 * IMPORTANTE: navegar para `/checkout` imediatamente após este awaits pode
 * causar redirect pra `/carrinho` se o snapshot do Firestore ainda não tiver
 * propagado pro browser. Use `waitForCartHydrated(page)` antes do
 * `page.goto("/checkout")` pra garantir que o CartContext absorveu os items.
 */

const DEFAULT_ITEM: Omit<CartItem, "userId" | "addedAt" | "updatedAt"> = {
  id: "prod_e2e_conjunto_crochet",
  productId: "prod_e2e_conjunto_crochet",
  variantSku: "LURATHA_E2E_002",
  productSlug: "conjunto-saia-e-blusa-crochet-luratha-e2e-002",
  name: "Conjunto Saia e Blusa Crochet",
  photoId: "img-e2e-002",
  // Data URL 1x1 PNG transparente — evita 404 no console (o bucket
  // `luratha-test` não existe; antes pollui logs E2E com [browser:error]).
  imageUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
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
    items.map((item) => itemsCol.doc(item.id).withConverter(adminCartItemConverter).set(item)),
  );
}

export async function clearFixtureCart(uid: string): Promise<void> {
  const cartRef = adminDb.collection(firestoreCollections.carts).doc(uid);
  const itemsSnap = await cartRef.collection(firestoreCollections.cartItems).get();
  await Promise.all(itemsSnap.docs.map((doc) => doc.ref.delete()));
  await cartRef.delete();
}

/**
 * Espera o snapshot reativo do `CartContext` entregar os items semeados ao
 * browser. Usa o badge numérico do link "Carrinho" no header como sentinel
 * — ele só renderiza quando `totalItems > 0`.
 *
 * Sem esta espera, navegar pra `/checkout` antes do snapshot propagar
 * dispara o guard `cartReady && items.length === 0` no CheckoutFlow e
 * redireciona pra `/carrinho` antes do step "Seus dados" aparecer.
 */
export async function waitForCartHydrated(page: Page): Promise<void> {
  const cartLink = page.getByRole("link", { name: "Carrinho" });
  await expect(cartLink).toBeVisible({ timeout: 10_000 });
  // O badge é um <span> filho do link com o texto do count. Aguarda aparecer.
  await expect(cartLink.locator("span")).toBeVisible({ timeout: 15_000 });
}

/**
 * Navega para `/checkout` via client-side push (em vez de full reload via
 * `page.goto`) clicando em "Finalizar Compra" dentro de `/carrinho`.
 * Isso preserva o estado do `CartContext` (que vive no root layout), evitando
 * o ciclo "re-mount → re-subscribe Firestore → race com redirect /carrinho"
 * que acontece num `page.goto("/checkout")` direto.
 *
 * Pré-requisito: cart já populado (use `waitForCartHydrated` antes).
 */
export async function goToCheckoutViaCart(page: Page): Promise<void> {
  await page.goto("/carrinho");
  const finalizar = page.getByRole("button", { name: /Finalizar Compra/i });
  await expect(finalizar).toBeEnabled({ timeout: 15_000 });
  await finalizar.click();
  await expect(page).toHaveURL("/checkout", { timeout: 10_000 });
}
