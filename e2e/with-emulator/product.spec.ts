import { test, expect } from "@playwright/test";

const PRIMARY_PRODUCT_SLUG = "vestido-bordado-floral-luratha-e2e-001";
const SECONDARY_PRODUCT_SLUGS = [
  "conjunto-saia-e-blusa-crochet-luratha-e2e-002",
  "moletom-bordado-slow-fashion-luratha-e2e-003",
];

test.describe("Product detail page", () => {
  test("loads the product page at /produto/[slug] with correct title", async ({
    page,
  }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    await expect(page).toHaveTitle(/Vestido Bordado Floral/);
  });

  test("renders the product name as h1", async ({ page }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Vestido Bordado Floral" })
    ).toBeVisible();
  });

  test("renders header and footer on the product page", async ({ page }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("renders the breadcrumb with Home, category link, and product name", async ({
    page,
  }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    const nav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Vestidos" })).toBeVisible();
    await expect(nav.getByText("Vestido Bordado Floral")).toBeVisible();
  });

  test("renders the product gallery main image", async ({ page }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    const mainImg = page.locator("img").first();
    await expect(mainImg).toBeVisible();
  });

  test("renders thumbnail buttons and allows switching the main image", async ({
    page,
  }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    const thumbBtns = page.getByRole("button", { name: /Ver imagem/ });
    await expect(thumbBtns.first()).toBeVisible();
    // Click the second thumbnail
    await thumbBtns.nth(1).click();
    // Verify the thumbnail button state changes
    await expect(thumbBtns.nth(1)).toHaveAttribute("aria-pressed", "true");
  });

  test("renders size selector buttons", async ({ page }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    const sizeGroup = page.getByRole("group", { name: "Selecione o tamanho" });
    await expect(sizeGroup.getByRole("button", { name: "PP", exact: true })).toBeVisible();
    await expect(sizeGroup.getByRole("button", { name: "M", exact: true })).toBeVisible();
    await expect(sizeGroup.getByRole("button", { name: "GG", exact: true })).toBeVisible();
  });

  test("shows an error when add-to-cart is clicked without selecting a size", async ({
    page,
  }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    await page.getByRole("button", { name: /Adicionar .* ao carrinho/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("Selecione um tamanho")).toBeVisible();
  });

  test("clears the size error after selecting a size", async ({ page }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    await page.getByRole("button", { name: /Adicionar .* ao carrinho/i }).click();
    await expect(page.getByText("Selecione um tamanho")).toBeVisible();
    await page.getByRole("group", { name: "Selecione o tamanho" }).getByRole("button", {
      name: "M",
      exact: true,
    }).click();
    await expect(page.getByText("Selecione um tamanho")).not.toBeVisible();
  });

  test("renders the price with discount badge", async ({ page }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    await expect(page.getByText(/OFF/)).toBeVisible();
    await expect(page.getByText(/R\$\s*289/)).toBeVisible();
  });

  test("returns 404 for an unknown product slug", async ({ page }) => {
    const response = await page.goto("/produto/slug-invalido");
    expect(response?.status()).toBe(404);
  });

  test("all 3 mock product detail pages load without errors", async ({
    page,
  }) => {
    const slugs = [PRIMARY_PRODUCT_SLUG, ...SECONDARY_PRODUCT_SLUGS];
    for (const slug of slugs) {
      const response = await page.goto(`/produto/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("the favorite button toggles state", async ({ page }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);
    const favBtn = page.getByRole("button", { name: "Adicionar aos favoritos" });
    await expect(favBtn).toBeVisible();
    await favBtn.click();
    await expect(
      page.getByRole("button", { name: "Remover dos favoritos" })
    ).toBeVisible();
  });
});
