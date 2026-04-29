import { test, expect } from "@playwright/test";

test.describe("Institutional Pages", () => {
  test("/sobre renders heading, brand values and manifesto", async ({ page }) => {
    await page.goto("/sobre");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Nossa História/i })
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Artesanal" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Versátil" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Sustentável" })).toBeVisible();
    await expect(page.getByText("Nosso Manifesto")).toBeVisible();
  });

  test("/contato renders heading, WhatsApp link and contact form", async ({ page }) => {
    await page.goto("/contato");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Fale Conosco/i })
    ).toBeVisible();

    const waLink = page.getByRole("link", { name: /WhatsApp/i }).first();
    await expect(waLink).toBeVisible();
    await expect(waLink).toHaveAttribute("href", expect.stringContaining("wa.me"));

    await expect(page.getByLabel("Nome")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Mensagem")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviar mensagem" })
    ).toBeVisible();
  });

  test("/politica-de-trocas renders heading and policy sections", async ({ page }) => {
    await page.goto("/politica-de-trocas");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Política de Trocas/i })
    ).toBeVisible();
    await expect(page.getByText("Prazo para Troca ou Devolução")).toBeVisible();
    await expect(page.getByText("Condições para Troca")).toBeVisible();
  });

  test("/referencia-de-medidas renders heading, table headers and all sizes", async ({ page }) => {
    await page.goto("/referencia-de-medidas");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Referência de Medidas/i })
    ).toBeVisible();

    await expect(page.getByRole("columnheader", { name: "Tamanho" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Busto (cm)" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cintura (cm)" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Quadril (cm)" })).toBeVisible();

    for (const size of ["PP", "P", "M", "G", "GG", "XGG"]) {
      await expect(page.getByRole("cell", { name: size, exact: true })).toBeVisible();
    }
  });
});
