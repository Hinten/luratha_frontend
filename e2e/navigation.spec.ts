import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("header contains navigation links", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");

    await expect(header.getByRole("link", { name: "Coleção" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Sobre" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Contato" })).toBeVisible();
  });

  test("header has cart button", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Carrinho" })
    ).toBeVisible();
  });

  test("mobile hamburger menu opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const hamburger = page.getByRole("button", { name: "Abrir menu" });
    await expect(hamburger).toBeVisible();

    await hamburger.click();
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeVisible();

    await page.getByRole("button", { name: "Fechar menu" }).click();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
  });

  test("footer navigation links are present", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");

    await expect(footer.getByRole("link", { name: "Coleção" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Sobre" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Contato" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Privacidade" })).toBeVisible();
  });
});
