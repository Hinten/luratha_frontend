import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMetadata } from "@/src/app/produto/[slug]/page";
import { makeSeoProduct } from "./productFixture";
import { SITE_URL, readCanonical, readOgImages, readTitleText } from "./seoAssertions";

const { getBySlugMock } = vi.hoisted(() => ({ getBySlugMock: vi.fn() }));

vi.mock("@luratha/firestore/firebaseSsrApp", () => ({
  getAuthenticatedAppForUser: vi.fn(async () => ({
    firestore: {},
    currentUser: null,
    firebaseServerApp: {},
  })),
}));

vi.mock("@luratha/repositories/productsRepository", () => ({
  ProductRepositoryError: class ProductRepositoryError extends Error {
    readonly code: "validation" | "not_found" | "conflict" | "unknown";
    constructor(message: string, code: "validation" | "not_found" | "conflict" | "unknown") {
      super(message);
      this.code = code;
    }
  },
  createProductsRepository: () => ({ getBySlug: getBySlugMock }),
}));

vi.mock("@luratha/repositories/categoriesRepository", () => ({
  createCategoriesRepository: () => ({ getById: vi.fn() }),
}));

vi.mock("@luratha/repositories/stockRepository", () => ({
  createStockRepository: () => ({ getByProductId: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// Page module imports these at the top — stub so importing it stays jsdom-safe.
vi.mock("@/src/components/produto/ProductDetailPage", () => ({ default: () => null }));
vi.mock("@/src/components/produto/ViewTracker", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("product page metadata (SEO)", () => {
  it("builds title, canonical and OG tags from the product", async () => {
    const product = makeSeoProduct();
    getBySlugMock.mockResolvedValueOnce(product);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: product.slug }),
    });

    expect(readTitleText(metadata)).toBe(product.title);
    expect(metadata.description).toBe(product.description.slice(0, 160));
    expect(readCanonical(metadata)).toBe(`${SITE_URL}/produto/${product.slug}`);

    const images = readOgImages(metadata);
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].url.length).toBeGreaterThan(0);
    expect(images[0].alt).toBe(product.title);
    expect(metadata.openGraph?.url).toBe(`${SITE_URL}/produto/${product.slug}`);
  });

  it("truncates the description to 160 characters", async () => {
    const product = makeSeoProduct();
    const longDescription = "a".repeat(300);
    getBySlugMock.mockResolvedValueOnce({ ...product, description: longDescription });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: product.slug }),
    });

    expect(metadata.description).toBe(longDescription.slice(0, 160));
    expect((metadata.description ?? "").length).toBe(160);
  });

  it("delegates to notFound for an unknown slug", async () => {
    getBySlugMock.mockResolvedValueOnce(null);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "slug-inexistente" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
