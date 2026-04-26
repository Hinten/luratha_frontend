import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { buildMockStock, buildMockProducts } from "@/src/lib/repositories/productsMockData";
import {
  StockRepositoryError,
  createStockRepository,
} from "@/src/lib/repositories/stockRepository";
import { DEFAULT_FIREBASE_PROJECT_ID } from "@/src/lib/firestore/environment";

const emulatorReady = process.env.FIRESTORE_EMULATOR_READY === "true";
if (!emulatorReady) {
  console.warn(
    `[stockRepository.emulator.test] skipped: ${process.env.FIRESTORE_EMULATOR_REASON ?? "emulator unavailable"}`,
  );
}

const describeWhenEmulator = emulatorReady ? describe : describe.skip;
const projectId = process.env.FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_PROJECT_ID;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [host, portString] = firestoreHost.split(":");
const port = Number(portString);
const EMULATOR_CONNECTION_TIMEOUT_MS = 500;

describeWhenEmulator("stock repository (Firestore Emulator)", () => {
  let testEnv: RulesTestEnvironment;
  let db: Parameters<typeof createStockRepository>[0];
  let repository: ReturnType<typeof createStockRepository>;
  let emulatorReachable = false;
  const mockStocks = buildMockStock();
  const [stockWithVariants, stockWithoutVariants] = mockStocks;
  const [productWithVariants, productWithoutVariants] = buildMockProducts();

  beforeAll(async () => {
    emulatorReachable = await isPortOpen(host, port, EMULATOR_CONNECTION_TIMEOUT_MS);
    if (!emulatorReachable) {
      console.warn("[stockRepository.emulator.test] skipped: emulator host is not reachable");
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
      typeof createStockRepository
    >[0];
    repository = createStockRepository(db);
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

  it("sets and reads stock for a simple product", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    const created = await repository.set(stockWithoutVariants);

    expect(created.productId).toBe(stockWithoutVariants.productId);
    expect(created.hasVariants).toBe(false);
    expect(created.variants).toBeNull();

    const loaded = await repository.getByProductId(stockWithoutVariants.productId);
    expect(loaded).toBeTruthy();
    expect(loaded?.quantity).toBe(stockWithoutVariants.quantity);
  });

  it("sets and reads stock for a product with variants", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    const created = await repository.set(stockWithVariants);

    expect(created.productId).toBe(stockWithVariants.productId);
    expect(created.hasVariants).toBe(true);
    expect(created.variants).not.toBeNull();
    expect(Object.keys(created.variants ?? {})).toHaveLength(1);

    const loaded = await repository.getByProductId(stockWithVariants.productId);
    expect(loaded?.variants?.LURATHA_101).toBe(12);
  });

  it("returns null when stock document does not exist", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    const result = await repository.getByProductId("non_existent_product");
    expect(result).toBeNull();
  });

  it("batch reads stock for multiple products in a single round-trip", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await repository.seedMockStock(mockStocks);

    const stockMap = await repository.getByProductIds([
      productWithVariants.id,
      productWithoutVariants.id,
    ]);

    expect(stockMap.size).toBe(2);
    expect(stockMap.get(productWithVariants.id)?.quantity).toBe(12);
    expect(stockMap.get(productWithoutVariants.id)?.quantity).toBe(7);
  });

  it("returns empty map when given empty product ids list", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    const result = await repository.getByProductIds([]);
    expect(result.size).toBe(0);
  });

  it("updates (overwrites) stock with set", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await repository.set(stockWithoutVariants);

    const updated = await repository.set({
      ...stockWithoutVariants,
      quantity: 3,
      updatedAt: new Date().toISOString(),
    });

    expect(updated.quantity).toBe(3);

    const loaded = await repository.getByProductId(stockWithoutVariants.productId);
    expect(loaded?.quantity).toBe(3);
  });

  it("deletes a stock document", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await repository.set(stockWithoutVariants);
    await repository.delete(stockWithoutVariants.productId);

    const loaded = await repository.getByProductId(stockWithoutVariants.productId);
    expect(loaded).toBeNull();
  });

  it("throws not_found when deleting non-existent stock", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await expect(repository.delete("non_existent_product")).rejects.toMatchObject({
      code: "not_found",
      name: "StockRepositoryError",
    } satisfies Partial<StockRepositoryError>);
  });

  it("throws validation error on invalid stock payload via seedMockStock", async () => {
    if (shouldSkipTests(repository, emulatorReachable)) return;
    await expect(
      repository.seedMockStock([
        {
          productId: "prod_x",
          sku: "LURATHA_999",
          quantity: 5,
          hasVariants: true,
          variants: null, // invalid: hasVariants=true but variants=null
          updatedAt: new Date().toISOString(),
        },
      ]),
    ).rejects.toMatchObject({
      code: "validation",
      name: "StockRepositoryError",
    } satisfies Partial<StockRepositoryError>);
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
  repository: ReturnType<typeof createStockRepository> | undefined,
  emulatorReachable: boolean,
): boolean {
  return !emulatorReachable || !repository;
}
