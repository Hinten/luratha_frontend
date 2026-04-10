import { test, expect } from "@playwright/test";

test.describe("Product detail page", () => {
  test("loads the product page at /produto/[slug] with correct title", async ({
    page,
  }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await expect(page).toHaveTitle(/Vestido Bordado Floral.*Luratha/);
  });

  test("renders the product name as h1", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await expect(
      page.getByRole("heading", { level: 1, name: "Vestido Bordado Floral" })
    ).toBeVisible();
  });

  test("renders header and footer on the product page", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("renders the breadcrumb with Home, category link, and product name", async ({
    page,
  }) => {
    await page.goto("/produto/vestido-bordado-floral");
    const nav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Vestidos" })).toBeVisible();
    await expect(nav.getByText("Vestido Bordado Floral")).toBeVisible();
  });

  test("renders the product gallery main image", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    const mainImg = page.locator("img").first();
    await expect(mainImg).toBeVisible();
  });

  test("renders thumbnail buttons and allows switching the main image", async ({
    page,
  }) => {
    await page.goto("/produto/vestido-bordado-floral");
    const thumbBtns = page.getByRole("button", { name: /Ver imagem/ });
    await expect(thumbBtns.first()).toBeVisible();
    // Click the second thumbnail
    await thumbBtns.nth(1).click();
    // Verify the thumbnail button state changes
    await expect(thumbBtns.nth(1)).toHaveAttribute("aria-pressed", "true");
  });

  test("renders size selector buttons", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await expect(page.getByRole("button", { name: "PP" })).toBeVisible();
    await expect(page.getByRole("button", { name: "M" })).toBeVisible();
    await expect(page.getByRole("button", { name: "GG" })).toBeVisible();
  });

  test("shows an error when add-to-cart is clicked without selecting a size", async ({
    page,
  }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await page.getByRole("button", { name: /ADICIONAR AO CARRINHO/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("Selecione um tamanho")).toBeVisible();
  });

  test("clears the size error after selecting a size", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await page.getByRole("button", { name: /ADICIONAR AO CARRINHO/i }).click();
    await expect(page.getByText("Selecione um tamanho")).toBeVisible();
    await page.getByRole("button", { name: "M" }).click();
    await expect(page.getByText("Selecione um tamanho")).not.toBeVisible();
  });

  test("renders the price with discount badge", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await expect(page.getByText(/OFF/)).toBeVisible();
    await expect(page.getByText(/R\$\s*289/)).toBeVisible();
  });

  test("renders the reviews section", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await expect(
      page.getByRole("region", { name: "Avaliações do produto" })
    ).toBeVisible();
  });

  test("renders the related products section", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    await expect(
      page.getByRole("region", { name: "Peças relacionadas" })
    ).toBeVisible();
  });

  test("returns 404 for an unknown product slug", async ({ page }) => {
    const response = await page.goto("/produto/slug-invalido");
    expect(response?.status()).toBe(404);
  });

  test("all 3 mock product detail pages load without errors", async ({
    page,
  }) => {
    const slugs = [
      "vestido-bordado-floral",
      "conjunto-saia-blusa-crochet",
      "moletom-bordado-slow-fashion",
    ];
    for (const slug of slugs) {
      const response = await page.goto(`/produto/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("the favorite button toggles state", async ({ page }) => {
    await page.goto("/produto/vestido-bordado-floral");
    const favBtn = page.getByRole("button", { name: "Adicionar aos favoritos" });
    await expect(favBtn).toBeVisible();
    await favBtn.click();
    await expect(
      page.getByRole("button", { name: "Remover dos favoritos" })
    ).toBeVisible();
  });
});
