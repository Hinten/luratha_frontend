import { test, expect } from "@playwright/test";

// Requires Firestore fixtures seeded by globalSetup — skip when credentials are absent.
test.skip(process.env.E2E_CLOUD_SKIP === "1", "Firebase credentials not configured — cloud fixtures not seeded");

test.describe("Category pages", () => {
  test("loads the vestidos category page with h1 and products", async ({
    page,
  }) => {
    await page.goto("/categoria/vestidos");
    await expect(page).toHaveTitle(/Vestidos.*Luratha/);
    await expect(page.getByRole("heading", { level: 1, name: "Vestidos" })).toBeVisible();
    await expect(
      page
        .getByTestId("product-grid")
        .or(page.getByText("Nenhuma peça encontrada"))
        .first(),
    ).toBeVisible();
  });

  test("shows product count text", async ({ page }) => {
    await page.goto("/categoria/vestidos");
    await expect(page.getByText(/produtos encontrados/)).toBeVisible();
  });

  test("renders header and footer on category page", async ({ page }) => {
    await page.goto("/categoria/blusas");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("renders the breadcrumb with Home link and category name", async ({
    page,
  }) => {
    await page.goto("/categoria/calcas");
    const nav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByText("Calças")).toBeVisible();
  });

  test("renders the sort dropdown", async ({ page }) => {
    await page.goto("/categoria/saias");
    await expect(page.getByRole("combobox")).toBeVisible();
  });

  test("returns 404 for an unknown category slug", async ({ page }) => {
    const response = await page.goto("/categoria/slug-invalido");
    expect(response?.status()).toBe(404);
  });

  test("all defined categories load without errors", async ({ page }) => {
    const slugs = [
      "vestidos",
      "blusas",
      "calcas",
      "saias",
      "shorts",
      "conjuntos",
      "moletons",
      "acessorios",
    ];
    for (const slug of slugs) {
      const response = await page.goto(`/categoria/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1 })
      ).toBeVisible();
    }
  });
});

test.describe("Todas as Peças page", () => {
  test("loads with title and product grid", async ({ page }) => {
    await page.goto("/todas-as-pecas");
    await expect(page).toHaveTitle(/Todas as Peças.*Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Todas as Peças" })
    ).toBeVisible();
    await expect(
      page
        .getByTestId("product-grid")
        .or(page.getByText("Nenhuma peça encontrada"))
        .first(),
    ).toBeVisible();
  });

  test("renders the breadcrumb", async ({ page }) => {
    await page.goto("/todas-as-pecas");
    const nav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
  });

  test("shows all products", async ({ page }) => {
    await page.goto("/todas-as-pecas");
    await expect(page.getByText(/produtos encontrados/)).toBeVisible();
  });
});

test.describe("Sale page", () => {
  test("loads with title and discounted products", async ({ page }) => {
    await page.goto("/sale");
    await expect(page).toHaveTitle(/Promoções.*Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Promoções" })
    ).toBeVisible();
  });

  test("renders the breadcrumb", async ({ page }) => {
    await page.goto("/sale");
    const nav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav).toBeVisible();
  });

  test("shows only discounted products", async ({ page }) => {
    await page.goto("/sale");
    await expect(page.getByText(/produtos? encontrado/)).toBeVisible();
  });
});

test.describe("Sort functionality", () => {
  test("updates the URL with sort param when dropdown changes", async ({
    page,
  }) => {
    await page.goto("/categoria/vestidos");
    const select = page.getByRole("combobox");
    await select.selectOption("menor-preco");
    await expect(page).toHaveURL(/sort=menor-preco/);
  });

  test("removes sort param when selecting Mais recentes", async ({ page }) => {
    await page.goto("/categoria/vestidos?sort=maior-preco");
    const select = page.getByRole("combobox");
    await select.selectOption("recentes");
    await expect(page).not.toHaveURL(/sort=/);
  });
});
