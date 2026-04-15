import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { buildMockProducts } from "@/src/lib/repositories/productsMockData";
import {
  ProductRepositoryError,
  createProductsRepository,
} from "@/src/lib/repositories/productsRepository";

const emulatorReady = process.env.FIRESTORE_EMULATOR_READY === "true";
if (!emulatorReady) {
  console.warn(
    `[productsRepository.emulator.test] skipped: ${process.env.FIRESTORE_EMULATOR_REASON ?? "emulator unavailable"}`,
  );
}

const describeWhenEmulator = emulatorReady ? describe : describe.skip;
const projectId = process.env.FIREBASE_PROJECT_ID ?? "luratha-96386";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [host, portString] = firestoreHost.split(":");
const port = Number(portString);

describeWhenEmulator("products repository (Firestore Emulator)", () => {
  let testEnv: RulesTestEnvironment;
  let db: Parameters<typeof createProductsRepository>[0];
  let repository: ReturnType<typeof createProductsRepository>;
  const [mockProduct] = buildMockProducts();

  beforeAll(async () => {
    const rules = await readFile(path.join(process.cwd(), "firestore.rules"), "utf8");
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host,
        port,
        rules,
      },
    });

    db = testEnv.authenticatedContext("admin-test-user", { admin: true }).firestore() as Parameters<
      typeof createProductsRepository
    >[0];
    repository = createProductsRepository(db);
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.clearFirestore();
    await testEnv.cleanup();
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
    ).rejects.toMatchObject({
      code: "validation",
      name: "ProductRepositoryError",
    } satisfies Partial<ProductRepositoryError>);
  });

  it("throws conflict when creating duplicate product ids", async () => {
    await repository.create(mockProduct);
    await expect(repository.create(mockProduct)).rejects.toMatchObject({
      code: "conflict",
      name: "ProductRepositoryError",
    } satisfies Partial<ProductRepositoryError>);
  });

  it("throws not_found when updating unknown product", async () => {
    await expect(
      repository.update("missing-product-id", {
        description: "should not exist",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      name: "ProductRepositoryError",
    } satisfies Partial<ProductRepositoryError>);
  });
});
