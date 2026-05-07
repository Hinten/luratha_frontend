import { test, expect } from "@playwright/test";

const hasFirebaseConfig = !!process.env.FIREBASE_WEB_APP_CONFIG_BASE64;

test.describe("Auth middleware", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("unauthenticated visit to /conta redirects to /login with redirect param", async ({ page }) => {
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fconta/);
  });

  test("unauthenticated visit to /conta/pedidos/abc preserves full path", async ({ page }) => {
    await page.goto("/conta/pedidos/abc");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fconta%2Fpedidos%2Fabc/);
  });

  test("unauthenticated visit to /checkout redirects similarly", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/);
  });

  test("login page reads ?redirect and lands user there after sign-in", async ({ page }) => {
    test.skip(!hasFirebaseConfig, "Firebase web config required for live auth");
    // primeiro registra um usuário
    await page.goto("/register");
    const uniqueEmail = `__test_redirect_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("Marina");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("/");

    // logout
    await page.goto("/logout");
    await page.waitForURL("/");

    // visita protegida → redirect para login com redirect param
    await page.goto("/conta");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fconta/);

    // login deve voltar para /conta
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha").fill("senha123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL("/conta");
  });

  test("__session cookie is HttpOnly (not visible to document.cookie)", async ({ page }) => {
    test.skip(!hasFirebaseConfig, "Firebase web config required for live auth");
    await page.goto("/register");
    const uniqueEmail = `__test_httponly_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("HttpOnly Tester");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("/");

    const visibleCookies = await page.evaluate(() => document.cookie);
    expect(visibleCookies).not.toContain("__session");
  });

  test("/esqueci-senha renders, accepts e-mail, and shows generic success", async ({ page }) => {
    await page.goto("/esqueci-senha");
    await expect(page.getByRole("heading", { name: "Esqueci minha senha" })).toBeVisible();
    await page.getByLabel("E-mail").fill("alguem@test.com");
    await page.getByRole("button", { name: /Enviar link/i }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });
});
