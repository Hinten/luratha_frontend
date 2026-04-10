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

  test("login page renders with heading", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("login page has email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
  });

  test("login page has submit button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
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

  test("login page has link to register page", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("link", { name: "Cadastre-se" }),
    ).toBeVisible();
  });

  // ── Register page ────────────────────────────────────────────────────────

  test("register page renders with heading", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Criar conta" }),
    ).toBeVisible();
  });

  test("register page has name, email and password fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("Nome completo")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  });

  test("register page has link to login page", async ({ page }) => {
    await page.goto("/register");
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

  test("successful registration redirects to home", async ({ page }) => {
    await page.goto("/register");
    const uniqueEmail = `test_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("Ana Lima");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL("/");
  });

  test("after registration, header shows user name and Sair", async ({
    page,
  }) => {
    await page.goto("/register");
    const uniqueEmail = `test_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("Ana Lima");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("/");

    // Desktop greeting is visible
    await expect(page.locator("header")).toContainText("Ana");
    await expect(
      page.getByRole("button", { name: "Sair da conta" }),
    ).toBeVisible();
  });

  test("successful login redirects to home", async ({ page }) => {
    // First register
    await page.goto("/register");
    const uniqueEmail = `login_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("Beatriz");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("/");

    // Logout via /logout
    await page.goto("/logout");
    await page.waitForURL("/");
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();

    // Login
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha").fill("senha123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL("/");
  });

  test("logout page clears auth state and redirects to home", async ({
    page,
  }) => {
    // Register and confirm we are logged in
    await page.goto("/register");
    const uniqueEmail = `logout_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("Carla");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("/");

    // Navigate to logout page
    await page.goto("/logout");
    await page.waitForURL("/");

    // Should now be logged out
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  });
});
