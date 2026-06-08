import { test, expect } from "@playwright/test";

// Requires Firestore fixtures seeded by globalSetup — skip when credentials are absent.
test.skip(
  process.env.E2E_CLOUD_SKIP === "1",
  "Firebase credentials not configured — cloud fixtures not seeded",
);

test.describe("Home page", () => {
  test("renders title, header, footer and all main sections", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Luratha/);

    // Header + logo
    const header = page.locator("header");
    await expect(header).toBeVisible();
    const logo = header.locator("img");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("alt", "Luratha");

    // Hero banner with first slide
    await expect(page.getByRole("region", { name: "Banner principal" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Peças feitas com amor para durar" }),
    ).toBeVisible();

    // Categories (three)
    const categoriesTrack = page.getByTestId("categories-track");
    await expect(categoriesTrack.getByRole("link", { name: "Vestidos" })).toBeVisible();
    await expect(categoriesTrack.getByRole("link", { name: "Blusas" })).toBeVisible();
    await expect(categoriesTrack.getByRole("link", { name: "Calças" })).toBeVisible();

    // Lançamentos / Destaques / SALE
    await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver todos os lançamentos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Destaques" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SALE até 50% OFF" })).toBeVisible();
    const saleLink = page.getByRole("link", { name: "Ver ofertas" }).first();
    await expect(saleLink).toHaveAttribute("href", "/sale");

    // Footer
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText("Luratha");
    await expect(footer).toContainText("Todos os direitos reservados");
  });

  test("hero banner next/prev navigation works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Próximo slide" }).click();
    await expect(page.getByRole("heading", { name: "Novas chegadas" })).toBeVisible();
  });

  test("shows horizontal categories with arrow navigation on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const track = page.getByTestId("categories-track");
    await expect(track).toBeVisible();

    const initialScroll = await track.evaluate((el) => el.scrollLeft);
    await page.getByRole("button", { name: "Próximas categorias" }).click();

    await expect
      .poll(async () => track.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(initialScroll);
  });
});
