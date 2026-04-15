import { readFile } from "node:fs/promises";
import net from "node:net";
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
const EMULATOR_CONNECTION_TIMEOUT_MS = 500;

describeWhenEmulator("products repository (Firestore Emulator)", () => {
  let testEnv: RulesTestEnvironment;
  let db: Parameters<typeof createProductsRepository>[0];
  let repository: ReturnType<typeof createProductsRepository>;
  let emulatorReachable = false;
  const [mockProductWithVariants, mockProductWithoutVariants] = buildMockProducts();

  beforeAll(async () => {
    emulatorReachable = await isPortOpen(host, port, EMULATOR_CONNECTION_TIMEOUT_MS);
    if (!emulatorReachable) {
      console.warn("[productsRepository.emulator.test] skipped: emulator host is not reachable");
      return;
    }

    const rules = await readFile(path.join(process.cwd(), "firestore.rules"), "utf8");
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host,
        port,
        rules,
      },
    });

    db = testEnv.authenticatedContext("admin-test-user", { admin: true }).firestore() as unknown as Parameters<
      typeof createProductsRepository
    >[0];
    repository = createProductsRepository(db);
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.cleanup();
    }
  });

  it("creates and reads a product", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    const created = await repository.create(mockProductWithVariants);

    expect(created.id).toBe(mockProductWithVariants.id);
    expect(created.slug).toBeTruthy();

    const loaded = await repository.getById(created.id);
    expect(loaded).toBeTruthy();
    expect(loaded?.id).toBe(mockProductWithVariants.id);
  });

  it("reads products by slug for products with and without variants", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await repository.seedMockProducts([mockProductWithVariants, mockProductWithoutVariants]);

    const loadedWithVariants = await repository.getBySlug(mockProductWithVariants.slug);
    const loadedWithoutVariants = await repository.getBySlug(mockProductWithoutVariants.slug);

    expect(loadedWithVariants?.id).toBe(mockProductWithVariants.id);
    expect(loadedWithVariants?.variants?.length).toBeGreaterThan(0);

    expect(loadedWithoutVariants?.id).toBe(mockProductWithoutVariants.id);
    expect(loadedWithoutVariants?.variants).toBeUndefined();
  });

  it("updates an existing product with validation", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await repository.create(mockProductWithVariants);
    const updated = await repository.update(mockProductWithVariants.id, {
      description: "Descrição atualizada via teste de integração",
      title: "Vestido Linho Mock Atualizado",
      variants: [
        {
          ...mockProductWithVariants.variants![0],
          size: ["M"],
          stock: 10,
        },
      ],
      price: {
        ...mockProductWithVariants.price,
        price: 319,
        priceMin: 319,
        priceMax: 329,
      },
      totalStock: 10,
    });

    expect(updated.description).toContain("atualizada");
    expect(updated.price.price).toBe(319);
    expect(updated.totalStock).toBe(10);
  });

  it("deletes an existing product", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await repository.create(mockProductWithVariants);
    await repository.delete(mockProductWithVariants.id);

    const loaded = await repository.getById(mockProductWithVariants.id);
    expect(loaded).toBeNull();
  });

  it("lists products with optional filters", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    const seeds = buildMockProducts();
    await repository.seedMockProducts(seeds);

    const all = await repository.list({ limit: 10 });
    const vestidos = await repository.list({
      categorySlug: "vestidos",
      status: "active",
      limit: 10,
    });

    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(vestidos.every((product) => product.category[0]?.slug === "vestidos")).toBe(true);
  });

  it("throws validation error on invalid payload", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await expect(
      repository.create({
        ...mockProductWithVariants,
        vectorEmbedding: undefined,
        searchEmbedding: undefined,
      }),
    ).rejects.toMatchObject({
      code: "validation",
      name: "ProductRepositoryError",
    } satisfies Partial<ProductRepositoryError>);
  });

  it("throws conflict when creating duplicate product ids", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await repository.create(mockProductWithVariants);
    await expect(repository.create(mockProductWithVariants)).rejects.toMatchObject({
      code: "conflict",
      name: "ProductRepositoryError",
    } satisfies Partial<ProductRepositoryError>);
  });

  it("throws not_found when updating unknown product", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
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

async function isPortOpen(hostname: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port });
    const fail = (): void => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("timeout", fail);
    socket.once("error", fail);
  });
}

function shouldSkipTests(
  repository: ReturnType<typeof createProductsRepository> | undefined,
  emulatorReachable: boolean,
): boolean {
  return !emulatorReachable || !repository;
}
