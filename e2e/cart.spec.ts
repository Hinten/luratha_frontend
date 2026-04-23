import { test, expect, type Page } from "@playwright/test";

type E2ECartItem = {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string;
  price: number;
  size: string;
  quantity: number;
};

async function openCartWithItems(page: Page, items: E2ECartItem[]) {
  await page.addInitScript((cartItems) => {
    localStorage.setItem("luratha_cart", JSON.stringify(cartItems));
  }, items);
  await page.goto("/carrinho");
}

test.describe("Cart (Carrinho)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure a clean cart state for each test
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("luratha_cart");
    });
  });

  test("cart page renders with title", async ({ page }) => {
    await page.goto("/carrinho");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { name: "Meu Carrinho" }),
    ).toBeVisible();
  });

  test("empty cart shows empty state message", async ({ page }) => {
    await page.goto("/carrinho");
    await expect(page.getByText("Seu carrinho está vazio")).toBeVisible();
  });

  test("empty cart shows link to browse products", async ({ page }) => {
    await page.goto("/carrinho");
    const browseLink = page.getByRole("link", { name: "Ver coleção" });
    await expect(browseLink).toBeVisible();
    await expect(browseLink).toHaveAttribute("href", "/colecao");
  });

  test("cart link in header navigates to /carrinho", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Carrinho" }).click();
    await expect(page).toHaveURL(/\/carrinho/);
    await expect(
      page.getByRole("heading", { name: "Meu Carrinho" }),
    ).toBeVisible();
  });

  test("header cart link has no badge when cart is empty", async ({ page }) => {
    await page.goto("/");
    // With empty cart the badge span should not exist in the DOM
    const cartBadge = page.getByRole("link", { name: "Carrinho" }).locator("span");
    await expect(cartBadge).not.toBeVisible();
  });

  test("cart with items shows item rows and order summary", async ({ page }) => {
    await openCartWithItems(page, [
      {
        productId: "test-1",
        name: "Vestido Bordado Floral",
        slug: "vestido-bordado-floral",
        imageUrl: "/images/vestido.jpg",
        price: 389,
        size: "M",
        quantity: 1,
      },
    ]);

    await expect(page.getByText("Vestido Bordado Floral")).toBeVisible();
    await expect(page.getByText("Tamanho: M")).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Resumo do pedido" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizar Compra" })).toBeVisible();
  });

  test("quantity stepper increases item count", async ({ page }) => {
    await openCartWithItems(page, [
      {
        productId: "test-1",
        name: "Blusa Artesanal",
        slug: "blusa-artesanal",
        imageUrl: "/images/blusa.jpg",
        price: 150,
        size: "P",
        quantity: 1,
      },
    ]);

    const increaseBtn = page.getByRole("button", { name: "Aumentar quantidade" });
    await increaseBtn.click();

    await expect(page.getByLabel("Itens do carrinho").getByText("2")).toBeVisible();
  });

  test("remove button removes item from cart", async ({ page }) => {
    await openCartWithItems(page, [
      {
        productId: "test-1",
        name: "Saia Boho",
        slug: "saia-boho",
        imageUrl: "/images/saia.jpg",
        price: 200,
        size: "G",
        quantity: 1,
      },
    ]);

    await page.getByRole("button", { name: /remover saia boho/i }).click();

    await expect(page.getByText("Seu carrinho está vazio")).toBeVisible();
  });
});
