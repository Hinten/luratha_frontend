import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads successfully and shows heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
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
});
