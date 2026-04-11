import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads successfully and shows the hero banner", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(page.getByRole("region", { name: "Banner principal" })).toBeVisible();
  });

  test("hero banner shows first slide title", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Peças feitas com amor para durar" })
    ).toBeVisible();
  });

  test("renders the header with logo", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await expect(header).toBeVisible();
    const logo = header.locator("img");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("alt", "Luratha");
  });

  test("renders the footer with copyright", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText("Luratha");
    await expect(footer).toContainText("Todos os direitos reservados");
  });

  test("renders category section with three categories", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Vestidos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Blusas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Calças" })).toBeVisible();
  });

  test("renders Lançamentos section with products", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver todos os lançamentos" })).toBeVisible();
  });

  test("renders Destaques section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Destaques" })).toBeVisible();
  });

  test("renders SALE section with link to /sale", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "SALE até 50% OFF" })
    ).toBeVisible();
    const saleLink = page.getByRole("link", { name: "Ver ofertas" }).first();
    await expect(saleLink).toHaveAttribute("href", "/sale");
  });

  test("hero banner next/prev navigation works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Próximo slide" }).click();
    await expect(
      page.getByRole("heading", { name: "Novas chegadas" })
    ).toBeVisible();
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
