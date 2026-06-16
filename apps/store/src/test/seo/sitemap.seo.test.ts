import { describe, it, expect, vi, beforeEach } from "vitest";
import sitemap from "@/src/app/sitemap";
import { SITE_URL } from "./seoAssertions";

const { getCachedCategoriesMock } = vi.hoisted(() => ({
  getCachedCategoriesMock: vi.fn(),
}));

vi.mock("@/src/lib/queries/getCachedCategories", () => ({
  getCachedCategories: getCachedCategoriesMock,
}));

const STATIC_PATHS = [
  "/",
  "/sobre",
  "/contato",
  "/politica-de-trocas",
  "/referencia-de-medidas",
  "/todas-as-pecas",
  "/sale",
];

describe("sitemap (SEO)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedCategoriesMock.mockResolvedValue([
      { id: "cat_vestidos", name: "Vestidos", slug: "vestidos" },
      { id: "cat_blusas", name: "Blusas", slug: "blusas" },
    ]);
  });

  it("includes every static route as an absolute URL under SITE_URL", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const path of STATIC_PATHS) {
      expect(urls).toContain(`${SITE_URL}${path}`);
    }
    for (const url of urls) {
      expect(url.startsWith(SITE_URL)).toBe(true);
    }
  });

  it("maps categories to the canonical /categoria/{slug} route, never /colecao", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(`${SITE_URL}/categoria/vestidos`);
    expect(urls).toContain(`${SITE_URL}/categoria/blusas`);
    expect(urls.some((url) => url.includes("/colecao/"))).toBe(false);
  });

  it("gives the homepage top priority and a daily change frequency", async () => {
    const entries = await sitemap();
    const home = entries.find((entry) => entry.url === `${SITE_URL}/`);

    expect(home?.priority).toBe(1.0);
    expect(home?.changeFrequency).toBe("daily");
  });

  it("sets a concrete lastModified Date on every entry", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(STATIC_PATHS.length);
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});
