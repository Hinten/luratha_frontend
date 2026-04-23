import { test, expect } from "@playwright/test";

test.describe("Institutional Pages", () => {
  test.describe("/sobre", () => {
    test("loads and shows the heading", async ({ page }) => {
      await page.goto("/sobre");
      await expect(page).toHaveTitle(/Luratha/);
      await expect(
        page.getByRole("heading", { level: 1, name: /Nossa História/i })
      ).toBeVisible();
    });

    test("renders header and footer", async ({ page }) => {
      await page.goto("/sobre");
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
    });

    test("shows brand values section", async ({ page }) => {
      await page.goto("/sobre");
      await expect(page.getByRole("heading", { level: 3, name: "Artesanal" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: "Versátil" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: "Sustentável" })).toBeVisible();
    });

    test("shows manifesto section", async ({ page }) => {
      await page.goto("/sobre");
      await expect(page.getByText("Nosso Manifesto")).toBeVisible();
    });
  });

  test.describe("/contato", () => {
    test("loads and shows the heading", async ({ page }) => {
      await page.goto("/contato");
      await expect(page).toHaveTitle(/Luratha/);
      await expect(
        page.getByRole("heading", { level: 1, name: /Fale Conosco/i })
      ).toBeVisible();
    });

    test("renders header and footer", async ({ page }) => {
      await page.goto("/contato");
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
    });

    test("shows WhatsApp contact link", async ({ page }) => {
      await page.goto("/contato");
      const waLink = page.getByRole("link", { name: /WhatsApp/i }).first();
      await expect(waLink).toBeVisible();
      await expect(waLink).toHaveAttribute("href", expect.stringContaining("wa.me"));
    });

    test("shows contact form", async ({ page }) => {
      await page.goto("/contato");
      await expect(page.getByLabel("Nome")).toBeVisible();
      await expect(page.getByLabel("E-mail")).toBeVisible();
      await expect(page.getByLabel("Mensagem")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Enviar mensagem" })
      ).toBeVisible();
    });
  });

  test.describe("/politica-de-trocas", () => {
    test("loads and shows the heading", async ({ page }) => {
      await page.goto("/politica-de-trocas");
      await expect(page).toHaveTitle(/Luratha/);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /Política de Trocas/i,
        })
      ).toBeVisible();
    });

    test("renders header and footer", async ({ page }) => {
      await page.goto("/politica-de-trocas");
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
    });

    test("shows policy sections", async ({ page }) => {
      await page.goto("/politica-de-trocas");
      await expect(page.getByText("Prazo para Troca ou Devolução")).toBeVisible();
      await expect(page.getByText("Condições para Troca")).toBeVisible();
    });
  });

  test.describe("/referencia-de-medidas", () => {
    test("loads and shows the heading", async ({ page }) => {
      await page.goto("/referencia-de-medidas");
      await expect(page).toHaveTitle(/Luratha/);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /Referência de Medidas/i,
        })
      ).toBeVisible();
    });

    test("renders header and footer", async ({ page }) => {
      await page.goto("/referencia-de-medidas");
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
    });

    test("shows size chart table with all sizes", async ({ page }) => {
      await page.goto("/referencia-de-medidas");
      for (const size of ["PP", "P", "M", "G", "GG", "XGG"]) {
        await expect(page.getByRole("cell", { name: size, exact: true })).toBeVisible();
      }
    });

    test("shows column headers", async ({ page }) => {
      await page.goto("/referencia-de-medidas");
      await expect(page.getByRole("columnheader", { name: "Tamanho" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Busto (cm)" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Cintura (cm)" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Quadril (cm)" })).toBeVisible();
    });
  });
});
