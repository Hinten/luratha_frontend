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

  test("/faq renders heading and key questions", async ({ page }) => {
    await page.goto("/faq");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Perguntas Frequentes/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Quais formas de pagamento/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Posso trocar ou devolver/i })
    ).toBeVisible();
  });

  test("/entrega renders heading and shipping topics", async ({ page }) => {
    await page.goto("/entrega");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Entrega e Frete/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Como o frete é calculado/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Como rastreio meu pedido/i })
    ).toBeVisible();
  });

  test("/politica-de-privacidade renders heading and LGPD sections", async ({ page }) => {
    await page.goto("/politica-de-privacidade");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Política de Privacidade/i })
    ).toBeVisible();
    await expect(page.getByText("Quais dados coletamos")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Encarregado pelo Tratamento de Dados/i })
    ).toBeVisible();
  });

  test("/termos-de-uso renders heading and key clauses", async ({ page }) => {
    await page.goto("/termos-de-uso");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Termos de Uso/i })
    ).toBeVisible();
    await expect(page.getByText("Aceitação dos termos")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: /Lei aplicável e foro/i })
    ).toBeVisible();
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
