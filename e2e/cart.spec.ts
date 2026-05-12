import { test, expect, type Page } from "@playwright/test";

/** Cart item snapshot in the schema accepted by `validateCartItem`. */
type E2ECartItem = {
  id: string;
  userId: "guestcart";
  productId: string;
  variantId?: string;
  variantSku: string;
  productSlug: string;
  name: string;
  photoId: string;
  imageUrl: string;
  variantLabel?: string;
  unitPrice: number;
  quantity: number;
  currency: "BRL";
  addedAt: string;
  updatedAt: string;
};

async function openCartWithItems(page: Page, items: E2ECartItem[]) {
  await page.addInitScript((cartItems) => {
    localStorage.setItem("luratha_cart_v2", JSON.stringify(cartItems));
  }, items);
  await page.goto("/carrinho");
}

function buildItem(
  partial: {
    productId: string;
    variantId?: string;
    variantSku: string;
    productSlug: string;
    name: string;
    unitPrice: number;
    variantLabel?: string;
    quantity?: number;
  },
): E2ECartItem {
  const now = new Date().toISOString();
  const id = partial.variantId
    ? `${partial.productId}__${partial.variantId}`
    : partial.productId;
  return {
    id,
    userId: "guestcart",
    productId: partial.productId,
    variantId: partial.variantId,
    variantSku: partial.variantSku,
    productSlug: partial.productSlug,
    name: partial.name,
    photoId: `${partial.productId}-photo-1`,
    imageUrl: `https://firebasestorage.googleapis.com/v0/b/luratha-test/o/${partial.productSlug}.jpg?alt=media`,
    variantLabel: partial.variantLabel,
    unitPrice: partial.unitPrice,
    quantity: partial.quantity ?? 1,
    currency: "BRL",
    addedAt: now,
    updatedAt: now,
  };
}

test.describe("Cart (Carrinho)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure a clean cart state for each test
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("luratha_cart");
      localStorage.removeItem("luratha_cart_v2");
    });
  });

  test("empty cart renders title, heading, message and browse link", async ({ page }) => {
    await page.goto("/carrinho");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { name: "Meu Carrinho" }),
    ).toBeVisible();
    await expect(page.getByText("Seu carrinho está vazio")).toBeVisible();
    const browseLink = page.getByRole("link", { name: "Ver Categorias" });
    await expect(browseLink).toBeVisible();
    await expect(browseLink).toHaveAttribute("href", "/todas-as-pecas");
  });

  test("header cart link navigates to /carrinho with no badge when empty", async ({ page }) => {
    await page.goto("/");
    // With empty cart the badge span should not exist in the DOM
    const cartBadge = page.getByRole("link", { name: "Carrinho" }).locator("span");
    await expect(cartBadge).not.toBeVisible();

    await page.getByRole("link", { name: "Carrinho" }).click();
    await expect(page).toHaveURL(/\/carrinho/);
    await expect(
      page.getByRole("heading", { name: "Meu Carrinho" }),
    ).toBeVisible();
  });

  test("cart with items shows item rows and order summary", async ({ page }) => {
    await openCartWithItems(page, [
      buildItem({
        productId: "test-1",
        variantId: "var-m",
        variantSku: "TEST_VESTIDO_M",
        productSlug: "vestido-bordado-floral",
        name: "Vestido Bordado Floral",
        unitPrice: 389,
        variantLabel: "M",
      }),
    ]);

    await expect(page.getByText("Vestido Bordado Floral")).toBeVisible();
    // The cart row renders the variant label snapshot (e.g. "M" or "Azul / G").
    await expect(
      page.getByRole("list").getByText("M", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Resumo do pedido" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizar Compra" })).toBeVisible();
  });

  test("quantity stepper increases item count", async ({ page }) => {
    await openCartWithItems(page, [
      buildItem({
        productId: "test-1",
        variantId: "var-p",
        variantSku: "TEST_BLUSA_P",
        productSlug: "blusa-artesanal",
        name: "Blusa Artesanal",
        unitPrice: 150,
        variantLabel: "P",
      }),
    ]);

    const increaseBtn = page.getByRole("button", { name: "Aumentar quantidade" });
    await increaseBtn.click();

    await expect(page.getByLabel("Itens do carrinho").getByText("2")).toBeVisible();
  });

  test("remove button removes item from cart", async ({ page }) => {
    await openCartWithItems(page, [
      buildItem({
        productId: "test-1",
        variantId: "var-g",
        variantSku: "TEST_SAIA_G",
        productSlug: "saia-boho",
        name: "Saia Boho",
        unitPrice: 200,
        variantLabel: "G",
      }),
    ]);

    await page.getByRole("button", { name: /remover saia boho/i }).click();

    await expect(page.getByText("Seu carrinho está vazio")).toBeVisible();
  });
});
