import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("header, footer and floating WhatsApp button render with all links", async ({ page }) => {
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Coleção" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Sobre" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Contato" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Carrinho" })).toBeVisible();

    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: "Sobre" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Fale Conosco" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Política de Trocas" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Referência de Medidas" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Instagram" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Facebook" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "YouTube" })).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Falar no WhatsApp" })
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
});
