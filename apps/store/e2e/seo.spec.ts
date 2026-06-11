import { test, expect, type Page } from "@playwright/test";

// Requires Firestore fixtures seeded by globalSetup — skip when credentials are absent.
test.skip(
  process.env.E2E_CLOUD_SKIP === "1",
  "Firebase credentials not configured — cloud fixtures not seeded",
);

const PRIMARY_PRODUCT_SLUG = "vestido-bordado-floral-luratha-e2e-001";

/** Parses every JSON-LD block on the page and returns the flat list of @types. */
async function collectJsonLdTypes(page: Page): Promise<string[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types: string[] = [];
  for (const block of blocks) {
    // Intentionally unguarded: malformed JSON-LD should fail the test loudly.
    const parsed = JSON.parse(block) as unknown;
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      const type = (node as { "@type"?: unknown })["@type"];
      if (typeof type === "string") types.push(type);
    }
  }
  return types;
}

/** Asserts the head-level SEO essentials shared by every indexable page. */
async function expectCoreHeadTags(page: Page): Promise<void> {
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /luratha\.com\.br/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /.+/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /.+/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", /.+/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", /.+/);
}

test.describe("SEO / AEO / GEO — rendered pages", () => {
  test("home exposes Organization, WebSite and WebPage structured data", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Luratha/);
    await expectCoreHeadTags(page);

    const types = await collectJsonLdTypes(page);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "WebPage"]));
  });

  test("product page exposes a Product schema alongside the site schemas", async ({ page }) => {
    await page.goto(`/produto/${PRIMARY_PRODUCT_SLUG}`);

    await expect(page).toHaveTitle(/Vestido Bordado Floral/);
    await expectCoreHeadTags(page);

    const types = await collectJsonLdTypes(page);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "Product"]));
  });

  test("measurement reference page exposes a FAQPage schema", async ({ page }) => {
    await page.goto("/referencia-de-medidas");

    await expect(page).toHaveTitle(/Referência de Medidas/);
    await expectCoreHeadTags(page);

    const types = await collectJsonLdTypes(page);
    expect(types).toContain("FAQPage");
  });
});

test.describe("SEO / AEO / GEO — discovery resources", () => {
  test("robots.txt allows crawling and advertises the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("Sitemap:");
    expect(body).toContain("Disallow");
  });

  test("sitemap.xml lists canonical /categoria routes and no dead /colecao routes", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("/categoria/");
    expect(body).not.toContain("/colecao/");
  });

  test("llms.txt is served and free of dead /colecao routes", async ({ request }) => {
    const response = await request.get("/llms.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("Luratha");
    expect(body).not.toContain("/colecao");
  });
});
