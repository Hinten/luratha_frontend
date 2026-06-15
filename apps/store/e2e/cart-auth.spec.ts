import { test, expect, type Page } from "@playwright/test";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCartConverter, adminCartItemConverter } from "@luratha/firestore/adminCartConverter";
import { firestoreCollections } from "@luratha/schemas";
import { login, logout, registerNewUserWithCredentials } from "./_authHelpers";
import { clearFixtureCart } from "./_cartHelpers";

/**
 * Migração do carrinho guest → sessão logada (issue #108).
 *
 * Cobre o contrato do carrinho híbrido:
 *  1. guest adiciona itens (localStorage `luratha_cart_v2`);
 *  2. login dispara `POST /api/cart/merge` → itens vão para `carts/{uid}`
 *     somados por productId+variantId, com preço/SKU/slug REFRESCADOS do
 *     catálogo (anti-spoof — o localStorage pode estar stale/adulterado);
 *  3. localStorage é limpo após o merge (items, token; marker gravado);
 *  4. logout volta ao estado guest (vazio, já que o storage foi limpo);
 *  5. novo login recarrega o carrinho do Firestore via onSnapshot;
 *  6. itens inválidos caem em `dropped[]` e não entram no cart do servidor;
 *  7. merge é idempotente — mesmo token não duplica quantidades (marker
 *     client-side E `recentMergeTokens` server-side).
 *
 * Roda contra o projeto cloud `luratha-96386` com os fixtures do
 * `seedE2eCloudFirestore` (globalSetup). Auto-skip sem credenciais.
 */

test.skip(process.env.E2E_CLOUD_SKIP === "1", "Cloud creds ausentes — fixtures não semeadas.");

/** Chaves do CartContext (apps/store/src/contexts/CartContext.tsx). */
const STORAGE_KEY = "luratha_cart_v2";
const GUEST_TOKEN_KEY = "luratha_cart_v2_token";
const LAST_MERGED_KEY = "luratha_cart_v2_last_merged";

// Data URL 1x1 PNG transparente — `imageUrl` precisa ser URL válida e o
// bucket de teste não existe (mesmo racional do _cartHelpers).
const IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Fixtures do seedE2eProducts (semeados pelo globalSetup do Playwright). */
const VESTIDO = {
  productId: "prod_e2e_vestido_bordado_floral",
  variantId: "var_luratha_e2e_001_v1",
  variantSku: "LURATHA_E2E_001_VARIANT",
  productSlug: "vestido-bordado-floral-luratha-e2e-001",
  name: "Vestido Bordado Floral",
  /** Preço de catálogo (salePrice) — o merge deve refrescar para este valor. */
  catalogPrice: 289,
} as const;
const CONJUNTO = {
  productId: "prod_e2e_conjunto_crochet",
  variantSku: "LURATHA_E2E_002",
  productSlug: "conjunto-saia-e-blusa-crochet-luratha-e2e-002",
  name: "Conjunto Saia e Blusa Crochet",
  catalogPrice: 419,
} as const;

interface GuestItemPartial {
  productId: string;
  variantId?: string;
  variantSku: string;
  productSlug: string;
  name: string;
  unitPrice: number;
  variantLabel?: string;
  quantity?: number;
}

/** Item no shape aceito por `validateCartItem` (hydrateGuestItems descarta inválidos). */
function buildGuestItem(partial: GuestItemPartial) {
  const now = new Date().toISOString();
  return {
    id: partial.variantId ? `${partial.productId}__${partial.variantId}` : partial.productId,
    userId: "guestcart",
    productId: partial.productId,
    ...(partial.variantId ? { variantId: partial.variantId } : {}),
    variantSku: partial.variantSku,
    productSlug: partial.productSlug,
    name: partial.name,
    photoId: `${partial.productId}-photo-1`,
    imageUrl: IMAGE_DATA_URL,
    ...(partial.variantLabel ? { variantLabel: partial.variantLabel } : {}),
    unitPrice: partial.unitPrice,
    quantity: partial.quantity ?? 1,
    currency: "BRL" as const,
    addedAt: now,
    updatedAt: now,
  };
}

/**
 * Escreve itens guest + token no localStorage e navega para remontar o
 * CartProvider. NÃO usa `addInitScript` — ele re-executa a cada navegação e
 * re-injetaria os itens depois que o merge limpasse o storage, corrompendo as
 * asserções de limpeza/idempotência.
 */
async function injectGuestCart(
  page: Page,
  items: ReturnType<typeof buildGuestItem>[],
  token: string,
): Promise<void> {
  await page.evaluate(
    ([storageKey, tokenKey, payload, tokenValue]) => {
      localStorage.setItem(storageKey, payload);
      localStorage.setItem(tokenKey, tokenValue);
    },
    [STORAGE_KEY, GUEST_TOKEN_KEY, JSON.stringify(items), token] as const,
  );
}

function waitForMergeResponse(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes("/api/cart/merge") && res.request().method() === "POST",
    { timeout: 20_000 },
  );
}

interface MergeResponseBody {
  items: Array<{
    id: string;
    productId: string;
    variantId?: string;
    variantSku: string;
    productSlug: string;
    unitPrice: number;
    quantity: number;
  }>;
  cart: { recentMergeTokens: string[] };
  dropped: Array<{ productId: string; variantId?: string; reason: string }>;
}

function cartItemsCollection(uid: string) {
  return adminDb
    .collection(firestoreCollections.carts)
    .doc(uid)
    .collection(firestoreCollections.cartItems)
    .withConverter(adminCartItemConverter);
}

async function readLocalStorage(page: Page): Promise<{
  items: string | null;
  token: string | null;
  lastMerged: string | null;
}> {
  return page.evaluate(
    ([storageKey, tokenKey, mergedKey]) => ({
      items: localStorage.getItem(storageKey),
      token: localStorage.getItem(tokenKey),
      lastMerged: localStorage.getItem(mergedKey),
    }),
    [STORAGE_KEY, GUEST_TOKEN_KEY, LAST_MERGED_KEY] as const,
  );
}

test.describe("Cart guest → logado (merge)", () => {
  // Jornada longa com register/login reais — serial e com folga de timeout.
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  let uid: string | null = null;
  let email = "";
  let password = "";

  test.afterAll(async () => {
    if (uid) await clearFixtureCart(uid);
  });

  test("jornada completa: merge no login, limpeza, logout, relogin e soma", async ({ page }) => {
    // ── 1. Guest monta o carrinho ─────────────────────────────────────────
    await page.goto("/");
    const firstToken = crypto.randomUUID();
    await injectGuestCart(
      page,
      [
        // unitPrice/slug stale de propósito — o merge refresca do catálogo.
        buildGuestItem({
          ...VESTIDO,
          unitPrice: 999,
          productSlug: "slug-stale",
          variantLabel: "M",
        }),
        buildGuestItem({ ...CONJUNTO, unitPrice: CONJUNTO.catalogPrice, quantity: 2 }),
      ],
      firstToken,
    );
    await page.goto("/carrinho");
    await expect(page.getByText(VESTIDO.name)).toBeVisible();
    await expect(page.getByText(CONJUNTO.name)).toBeVisible();

    // ── 2. Login (register) dispara o merge ───────────────────────────────
    const mergeWait = waitForMergeResponse(page);
    const credentials = await registerNewUserWithCredentials(page);
    uid = credentials.uid;
    email = credentials.email;
    password = credentials.password;

    const mergeResponse = await mergeWait;
    expect(mergeResponse.status()).toBe(200);
    const mergeBody = (await mergeResponse.json()) as MergeResponseBody;
    expect(mergeBody.dropped).toEqual([]);
    expect(mergeBody.cart.recentMergeTokens).toContain(firstToken);

    // ── 3. Itens no Firestore com preço/SKU/slug refrescados do catálogo ──
    const vestidoId = `${VESTIDO.productId}__${VESTIDO.variantId}`;
    const vestidoSnap = await cartItemsCollection(uid).doc(vestidoId).get();
    expect(vestidoSnap.exists).toBe(true);
    const vestidoItem = vestidoSnap.data()!;
    expect(vestidoItem.unitPrice).toBe(VESTIDO.catalogPrice); // 999 → 289
    expect(vestidoItem.variantSku).toBe(VESTIDO.variantSku);
    expect(vestidoItem.productSlug).toBe(VESTIDO.productSlug); // slug-stale → real
    expect(vestidoItem.quantity).toBe(1);

    const conjuntoSnap = await cartItemsCollection(uid).doc(CONJUNTO.productId).get();
    expect(conjuntoSnap.exists).toBe(true);
    expect(conjuntoSnap.data()!.quantity).toBe(2);

    const cartSnap = await adminDb
      .collection(firestoreCollections.carts)
      .doc(uid)
      .withConverter(adminCartConverter)
      .get();
    expect(cartSnap.data()!.recentMergeTokens).toContain(firstToken);

    // ── 4. localStorage limpo após o merge (marker gravado) ───────────────
    await expect
      .poll(async () => (await readLocalStorage(page)).token, { timeout: 10_000 })
      .toBeNull();
    const storage = await readLocalStorage(page);
    expect(JSON.parse(storage.items ?? "null")).toEqual([]);
    expect(JSON.parse(storage.lastMerged ?? "null")).toEqual({ token: firstToken, uid });

    // ── 5. Logout volta ao estado guest (vazio) ────────────────────────────
    await logout(page);
    await page.goto("/carrinho");
    await expect(page.getByText("Seu carrinho está vazio")).toBeVisible();
    const cartLink = page.getByRole("link", { name: "Carrinho" });
    await expect(cartLink.locator("span")).not.toBeVisible();

    // ── 6. Novo login recarrega o cart do Firestore via onSnapshot ────────
    await login(page, email, password);
    await expect(cartLink.locator("span")).toHaveText("3", { timeout: 15_000 });
    await page.goto("/carrinho");
    await expect(page.getByText(VESTIDO.name)).toBeVisible();
    await expect(page.getByText(CONJUNTO.name)).toBeVisible();

    // ── 7. Merge soma quantidades pela chave productId+variantId ──────────
    await logout(page);
    const secondToken = crypto.randomUUID();
    await injectGuestCart(
      page,
      [buildGuestItem({ ...VESTIDO, unitPrice: VESTIDO.catalogPrice, quantity: 3 })],
      secondToken,
    );
    const secondMergeWait = waitForMergeResponse(page);
    await login(page, email, password);
    const secondMerge = await secondMergeWait;
    expect(secondMerge.status()).toBe(200);

    const vestidoAfterSum = await cartItemsCollection(uid).doc(vestidoId).get();
    expect(vestidoAfterSum.data()!.quantity).toBe(1 + 3);

    // ── 8. Idempotência client-side: marker bloqueia re-merge da mesma leva ─
    // Re-injeta a MESMA leva (mesmo token) simulando uma limpeza que falhou;
    // o marker `last_merged` ainda aponta para {secondToken, uid} → o
    // CartContext nem chama o endpoint.
    await injectGuestCart(
      page,
      [buildGuestItem({ ...VESTIDO, unitPrice: VESTIDO.catalogPrice, quantity: 3 })],
      secondToken,
    );
    let mergeRequests = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/cart/merge") && req.method() === "POST") mergeRequests += 1;
    });
    await page.goto("/carrinho");
    await expect(page.getByText(VESTIDO.name)).toBeVisible();
    // Janela curta para um request indevido aparecer antes da asserção.
    await page.waitForTimeout(1_500);
    expect(mergeRequests).toBe(0);
    expect((await cartItemsCollection(uid).doc(vestidoId).get()).data()!.quantity).toBe(4);

    // ── 9. Idempotência server-side: recentMergeTokens deduplica o token ──
    // Sem o marker o cliente chama o merge de novo, mas o servidor reconhece
    // o token e devolve o snapshot atual sem somar.
    await page.evaluate((mergedKey) => localStorage.removeItem(mergedKey), LAST_MERGED_KEY);
    const replayWait = waitForMergeResponse(page);
    await page.goto("/carrinho");
    const replay = await replayWait;
    expect(replay.status()).toBe(200);
    expect((await cartItemsCollection(uid).doc(vestidoId).get()).data()!.quantity).toBe(4);
  });
});

test.describe("Cart merge — itens inválidos caem em dropped[]", () => {
  test.describe.configure({ timeout: 120_000 });

  let uid: string | null = null;

  test.afterAll(async () => {
    if (uid) await clearFixtureCart(uid);
  });

  test("produto inexistente e SKU divergente não entram no cart do servidor", async ({ page }) => {
    await page.goto("/");
    const token = crypto.randomUUID();
    await injectGuestCart(
      page,
      [
        // (a) produto que não existe no catálogo — shape válido p/ passar no
        // validateCartItem client-side e chegar ao endpoint.
        buildGuestItem({
          productId: "prod_e2e_nao_existe",
          variantSku: "LURATHA_E2E_999",
          productSlug: "produto-fantasma",
          name: "Produto Fantasma",
          unitPrice: 100,
        }),
        // (b) produto real com SKU divergente do catálogo.
        buildGuestItem({
          ...VESTIDO,
          variantSku: "LURATHA_E2E_999_X",
          unitPrice: VESTIDO.catalogPrice,
          variantLabel: "M",
        }),
        // (c) item válido — único que deve sobreviver.
        buildGuestItem({ ...CONJUNTO, unitPrice: CONJUNTO.catalogPrice }),
      ],
      token,
    );

    const mergeWait = waitForMergeResponse(page);
    uid = (await registerNewUserWithCredentials(page)).uid;
    const merge = await mergeWait;
    expect(merge.status()).toBe(200);

    const body = (await merge.json()) as MergeResponseBody;
    expect(body.dropped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: "prod_e2e_nao_existe", reason: "product_not_found" }),
        expect.objectContaining({ productId: VESTIDO.productId, reason: "sku_mismatch" }),
      ]),
    );
    expect(body.dropped).toHaveLength(2);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].productId).toBe(CONJUNTO.productId);

    // Server cart contém SÓ o item válido.
    const itemsSnap = await cartItemsCollection(uid).get();
    expect(itemsSnap.docs.map((d) => d.id)).toEqual([CONJUNTO.productId]);
  });
});
