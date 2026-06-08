import { test, expect } from "@playwright/test";

// Requires Firestore fixtures seeded by globalSetup — skip when credentials are absent.
test.skip(
  process.env.E2E_CLOUD_SKIP === "1",
  "Firebase credentials not configured — cloud fixtures not seeded",
);

test.describe("Category pages", () => {
  test("vestidos: title, h1, product grid and count", async ({ page }) => {
    await page.goto("/categoria/vestidos");
    await expect(page).toHaveTitle(/Vestidos.*Luratha/);
    await expect(page.getByRole("heading", { level: 1, name: "Vestidos" })).toBeVisible();
    await expect(
      page.getByTestId("product-grid").or(page.getByText("Nenhuma peça encontrada")).first(),
    ).toBeVisible();
    await expect(page.getByText(/produtos encontrados/)).toBeVisible();
  });

  test("calcas: breadcrumb with Home link and category name", async ({ page }) => {
    await page.goto("/categoria/calcas");
    const nav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByText("Calças")).toBeVisible();
  });

  test("saias: sort dropdown is rendered", async ({ page }) => {
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
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});

test.describe("Todas as Peças page", () => {
  test("renders title, h1, breadcrumb, product grid and count", async ({ page }) => {
    await page.goto("/todas-as-pecas");
    await expect(page).toHaveTitle(/Todas as Peças.*Luratha/);
    await expect(page.getByRole("heading", { level: 1, name: "Todas as Peças" })).toBeVisible();
    await expect(
      page.getByTestId("product-grid").or(page.getByText("Nenhuma peça encontrada")).first(),
    ).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();

    await expect(page.getByText(/produtos encontrados/)).toBeVisible();
  });
});

test.describe("Sale page", () => {
  test("renders title, h1, breadcrumb and discounted product count", async ({ page }) => {
    await page.goto("/sale");
    await expect(page).toHaveTitle(/Promoções.*Luratha/);
    await expect(page.getByRole("heading", { level: 1, name: "Promoções" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    await expect(page.getByText(/produtos? encontrado/)).toBeVisible();
  });
});

test.describe("Sort functionality", () => {
  test("updates the URL with sort param when dropdown changes", async ({ page }) => {
    await page.goto("/categoria/vestidos");
    const select = page.getByRole("combobox");
    await select.selectOption("menor-preco");
    // SortDropdown calls router.push, which triggers a server transition
    // (re-fetch of the categoria server component + Firestore query). On cold
    // CI runners that round-trip routinely takes more than the 5s default,
    // making the assertion flaky on first run but passing on retry. Bump the
    // timeout to absorb the cold-start cost without retries.
    await expect(page).toHaveURL(/sort=menor-preco/, { timeout: 15000 });
  });

  test("removes sort param when selecting Mais recentes", async ({ page }) => {
    await page.goto("/categoria/vestidos?sort=maior-preco");
    const select = page.getByRole("combobox");
    await select.selectOption("recentes");
    await expect(page).not.toHaveURL(/sort=/, { timeout: 15000 });
  });
});
