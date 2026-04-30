import { describe, it, expect, vi, beforeEach } from "vitest";
import { FirebaseError } from "firebase/app";

// Capture the SDK call sequence so we can assert the fallback re-issues an
// unordered query and sorts in memory when Firestore reports a missing index.
const { getDocsMock, queryMock, orderByCalls, whereCalls } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  queryMock: vi.fn((..._args: unknown[]) => ({ kind: "query" })),
  orderByCalls: [] as Array<{ field: string; direction: string }>,
  whereCalls: [] as Array<{ field: string; op: string; value: unknown }>,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ kind: "collection" })),
  query: queryMock,
  where: vi.fn((field: string, op: string, value: unknown) => {
    whereCalls.push({ field, op, value });
    return { kind: "where", field, op, value };
  }),
  orderBy: vi.fn((field: string, direction: string) => {
    orderByCalls.push({ field, direction });
    return { kind: "orderBy", field, direction };
  }),
  limit: vi.fn(() => ({ kind: "limit" })),
  getDocs: getDocsMock,
  Timestamp: class { toDate() { return new Date(); } },
  VectorValue: class {},
}));

vi.mock("firebase/firestore/pipelines", () => ({
  and: vi.fn(),
  or: vi.fn(),
  field: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/src/lib/repositories/categoriesRepository", () => ({
  createCategoriesRepository: () => ({
    getBySlug: vi.fn(async (slug: string) =>
      slug === "vestidos" ? { id: "cat_vestidos", name: "Vestidos", slug: "vestidos" } : null,
    ),
  }),
}));

vi.mock("@/src/lib/embeddingService", () => ({
  createEmbeddingService: () => ({
    embed: vi.fn(async () => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]),
  }),
}));

import { createProductsSearchRepository } from "@/src/lib/repositories/productsSearchRepository";

function buildProductDoc(id: string, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id,
    data: () => ({
      id,
      slug: null,
      title: `Produto ${id}`,
      description: `Descrição ${id}`,
      sku: `LURATHA_${id.toUpperCase()}`,
      status: "active",
      isPurchasable: true,
      brandName: "Luratha",
      categoryId: "cat_vestidos",
      tags: [],
      materialTags: [],
      seasonalTags: [],
      price: { price: 100, salePrice: null, priceMin: 100, priceMax: 100, currency: "BRL" },
      totalStock: 5,
      ratingAverage: 4.5,
      reviewCount: 3,
      vectorEmbedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      searchEmbedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      variants: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }),
  };
}

describe("productsSearchRepository.executeCore", () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    queryMock.mockClear();
    orderByCalls.length = 0;
    whereCalls.length = 0;
  });

  it("falls back to in-memory sort when Firestore reports a missing composite index", async () => {
    // First call (ordered query) → fails with FAILED_PRECONDITION.
    // Second call (unordered query) → succeeds with two products in arbitrary order.
    const olderUpdatedAt = "2026-01-01T00:00:00.000Z";
    const newerUpdatedAt = "2026-04-29T00:00:00.000Z";
    getDocsMock
      .mockRejectedValueOnce(
        new FirebaseError("failed-precondition", "The query requires an index. ..."),
      )
      .mockResolvedValueOnce({
        docs: [
          buildProductDoc("prod_old", { updatedAt: olderUpdatedAt }),
          buildProductDoc("prod_new", { updatedAt: newerUpdatedAt }),
        ],
      });

    const repo = createProductsSearchRepository({} as never);
    const products = await repo.search({ categorySlug: "vestidos", sort: "newest", limit: 24 });

    // The retry must happen with the same WHERE clauses but no orderBy.
    expect(getDocsMock).toHaveBeenCalledTimes(2);
    expect(orderByCalls).toEqual([{ field: "updatedAt", direction: "desc" }]);

    // Products must come back sorted newest-first regardless of Firestore order.
    expect(products.map((entry) => entry.id)).toEqual(["prod_new", "prod_old"]);
  });

  it("does not fall back when the failure is not a missing-index error", async () => {
    getDocsMock.mockRejectedValueOnce(new Error("network unreachable"));

    const repo = createProductsSearchRepository({} as never);
    await expect(
      repo.search({ categorySlug: "vestidos", sort: "newest", limit: 24 }),
    ).rejects.toThrow();

    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });
});
