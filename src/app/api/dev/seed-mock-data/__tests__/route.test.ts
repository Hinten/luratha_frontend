import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { docStore, collectionMock } = vi.hoisted(() => {
  const sharedDocStore = new Map<string, unknown>();
  const sharedCollectionMock = vi.fn((collectionName: string) => ({
    doc: (id: string) => ({
      get: vi.fn(async () => ({ exists: sharedDocStore.has(`${collectionName}:${id}`) })),
      set: vi.fn(async (value: unknown) => {
        sharedDocStore.set(`${collectionName}:${id}`, value);
      }),
    }),
  }));

  return {
    docStore: sharedDocStore,
    collectionMock: sharedCollectionMock,
  };
});

vi.mock("@/src/lib/firebaseAdmin", () => ({
  adminDb: {
    collection: collectionMock,
  },
}));

vi.mock("@/src/lib/repositories/homeSeedMockData", () => ({
  buildHomeSeedCategories: () => [
    { id: "cat_1", name: "Vestidos", slug: "vestidos" },
    { id: "cat_2", name: "Blusas", slug: "blusas" },
  ],
  buildHomeSeedProducts: () => [
    {
      id: "prod_1",
      title: "Produto 1",
      slug: "produto-1",
      description: "Descrição 1",
      sku: "LURATHA_9001",
      status: "active",
      isPurchasable: true,
      brandName: "Luratha",
      category: [{ id: "cat_1", name: "Vestidos", slug: "vestidos" }],
      tags: [],
      materialTags: [],
      seasonalTags: [],
      price: { price: 100, priceMin: 100, priceMax: 120, currency: "BRL" },
      photoIds: ["https://placehold.co/600x750"],
      totalStock: 10,
      createdAt: "2026-04-15T00:00:00.000Z",
      updatedAt: "2026-04-15T00:00:00.000Z",
    },
  ],
}));

import { POST } from "@/src/app/api/dev/seed-mock-data/route";

describe("POST /api/dev/seed-mock-data", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    docStore.clear();
    collectionMock.mockClear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns 404 outside development mode", async () => {
    process.env.NODE_ENV = "production";

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.message).toBe("Not found");
  });

  it("seeds categories and products in development mode", async () => {
    process.env.NODE_ENV = "development";

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.categoriesCreated).toBe(2);
    expect(payload.productsCreated).toBe(1);
  });
});
