import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { firestoreCollections } from "@/src/schemas/firestore";
import { buildMockProducts } from "@/src/lib/repositories/productsMockData";
import {
  ProductRepositoryError,
  createProductsRepository,
} from "@/src/lib/repositories/productsRepository";
import {
  clearFirestoreCollection,
  getFirestoreForEmulator,
} from "@/src/test/firestoreEmulator";

const emulatorReady = process.env.FIRESTORE_EMULATOR_READY === "true";
if (!emulatorReady) {
  console.warn(
    `[productsRepository.emulator.test] skipped: ${process.env.FIRESTORE_EMULATOR_REASON ?? "emulator unavailable"}`,
  );
}

const describeWhenEmulator = emulatorReady ? describe : describe.skip;

describeWhenEmulator("products repository (Firestore Emulator)", () => {
  const db = getFirestoreForEmulator();
  const repository = createProductsRepository(db);
  const [mockProduct] = buildMockProducts();

  beforeEach(async () => {
    await clearFirestoreCollection(db, firestoreCollections.products);
  });

  afterAll(async () => {
    await clearFirestoreCollection(db, firestoreCollections.products);
  });

  it("creates and reads a product", async () => {
    const created = await repository.create(mockProduct);

    expect(created.id).toBe(mockProduct.id);
    expect(created.slug).toBeTruthy();

    const loaded = await repository.getById(created.id);
    expect(loaded).toBeTruthy();
    expect(loaded?.id).toBe(mockProduct.id);
  });

  it("updates an existing product with validation", async () => {
    await repository.create(mockProduct);
    const updated = await repository.update(mockProduct.id, {
      description: "Descrição atualizada via teste de integração",
      searchText: "descricao atualizada teste integracao",
      searchableTokens: ["descricao", "atualizada", "integracao"],
      variants: [
        {
          ...mockProduct.variants[0],
          price: 319,
          stock: 10,
        },
      ],
      priceMin: 319,
      priceMax: 319,
      totalStock: 10,
    });

    expect(updated.description).toContain("atualizada");
    expect(updated.priceMin).toBe(319);
    expect(updated.totalStock).toBe(10);
  });

  it("deletes an existing product", async () => {
    await repository.create(mockProduct);
    await repository.delete(mockProduct.id);

    const loaded = await repository.getById(mockProduct.id);
    expect(loaded).toBeNull();
  });

  it("lists products with optional filters", async () => {
    const seeds = buildMockProducts();
    await repository.seedMockProducts(seeds);

    const all = await repository.list({ limit: 10 });
    const vestidos = await repository.list({
      categorySlug: "vestidos",
      status: "active",
      limit: 10,
    });

    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(vestidos.every((product) => product.categorySlug === "vestidos")).toBe(true);
  });

  it("throws validation error on invalid payload", async () => {
    await expect(
      repository.create({
        ...mockProduct,
        vectorEmbedding: undefined,
        searchEmbedding: undefined,
      }),
    ).rejects.toMatchObject<ProductRepositoryError>({
      code: "validation",
      name: "ProductRepositoryError",
    });
  });

  it("throws conflict when creating duplicate product ids", async () => {
    await repository.create(mockProduct);
    await expect(repository.create(mockProduct)).rejects.toMatchObject<ProductRepositoryError>({
      code: "conflict",
      name: "ProductRepositoryError",
    });
  });

  it("throws not_found when updating unknown product", async () => {
    await expect(
      repository.update("missing-product-id", {
        description: "should not exist",
      }),
    ).rejects.toMatchObject<ProductRepositoryError>({
      code: "not_found",
      name: "ProductRepositoryError",
    });
  });
});
