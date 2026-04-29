import { test, expect } from "@playwright/test";

test.describe("Authentication (Auth)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("luratha_auth");
      localStorage.removeItem("luratha_users");
    });
  });

  // ── Login page ──────────────────────────────────────────────────────────

  test("login page renders heading, fields, submit and register link", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cadastre-se" })).toBeVisible();
  });

  test("login page shows error for wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("naoexiste@test.com");
    await page.getByLabel("Senha").fill("wrongpassword");
    await page.getByRole("button", { name: "Entrar" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "incorretos" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("incorretos");
  });

  // ── Register page ────────────────────────────────────────────────────────

  test("register page renders heading, fields and login link", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(
      page.locator("main").getByRole("link", { name: "Entrar" }),
    ).toBeVisible();
  });

  test("register with mismatched passwords shows error", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nome completo").fill("Ana Lima");
    await page.getByLabel("E-mail").fill("ana@test.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("diferente");
    await page.getByRole("button", { name: "Criar conta" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "senhas" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("senhas");
  });

  test("successful registration redirects home and updates header", async ({ page }) => {
    await page.goto("/register");
    const uniqueEmail = `test_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("Ana Lima");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.locator("header")).toContainText("Ana");
    await expect(
      page.getByRole("button", { name: "Sair da conta" }),
    ).toBeVisible();
  });

  test("register → logout → login round-trip", async ({ page }) => {
    // Register
    await page.goto("/register");
    const uniqueEmail = `login_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("Beatriz");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("/");

    // Logout via /logout — should redirect home and clear session
    await page.goto("/logout");
    await page.waitForURL("/");
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

    // Login again with the same credentials
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha").fill("senha123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL("/");
  });
});
