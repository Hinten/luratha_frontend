import { FirebaseError } from "firebase/app";
import {
  type Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { firestoreCollections, type Stock, validateStock } from "@/src/schemas/firestore";

type StockRepositoryErrorCode = "validation" | "not_found" | "unknown";

export class StockRepositoryError extends Error {
  readonly code: StockRepositoryErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: StockRepositoryErrorCode, cause?: unknown) {
    super(message);
    this.name = "StockRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

export interface StockRepository {
  getByProductId(productId: string): Promise<Stock | null>;
  getByProductIds(productIds: string[]): Promise<Map<string, Stock>>;
  set(stock: Stock): Promise<Stock>;
  delete(productId: string): Promise<void>;
  seedMockStock(stocks: unknown[]): Promise<Stock[]>;
}

export function createStockRepository(dbInstance: Firestore): StockRepository {
  const stockCollectionRef = collection(dbInstance, firestoreCollections.stock);

  async function getByProductId(productId: string): Promise<Stock | null> {
    try {
      const stockRef = doc(stockCollectionRef, productId);
      const snapshot = await getDoc(stockRef);

      if (!snapshot.exists()) {
        return null;
      }

      return validateStock(snapshot.data());
    } catch (error) {
      throw normalizeRepositoryError(error, `read stock for product "${productId}"`);
    }
  }

  async function getByProductIds(productIds: string[]): Promise<Map<string, Stock>> {
    if (productIds.length === 0) {
      return new Map();
    }

    try {
      const stockMap = new Map<string, Stock>();

      // Firestore `in` queries support up to 30 items per query
      const BATCH_SIZE = 30;
      for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
        const batch = productIds.slice(i, i + BATCH_SIZE);
        const snapshot = await getDocs(
          query(stockCollectionRef, where("productId", "in", batch)),
        );

        for (const doc of snapshot.docs) {
          const stock = validateStock(doc.data());
          stockMap.set(stock.productId, stock);
        }
      }

      return stockMap;
    } catch (error) {
      throw normalizeRepositoryError(error, `batch read stock for ${productIds.length} products`);
    }
  }

  async function set(stock: Stock): Promise<Stock> {
    try {
      const parsed = validateStock(stock);
      const stockRef = doc(stockCollectionRef, parsed.productId);
      await setDoc(stockRef, parsed);
      return parsed;
    } catch (error) {
      throw normalizeRepositoryError(error, `set stock for product "${stock.productId}"`);
    }
  }

  async function remove(productId: string): Promise<void> {
    try {
      const stockRef = doc(stockCollectionRef, productId);
      const snapshot = await getDoc(stockRef);
      if (!snapshot.exists()) {
        throw new StockRepositoryError(
          `Stock for product "${productId}" was not found`,
          "not_found",
        );
      }
      await deleteDoc(stockRef);
    } catch (error) {
      throw normalizeRepositoryError(error, `delete stock for product "${productId}"`);
    }
  }

  async function seedMockStock(stocks: unknown[]): Promise<Stock[]> {
    return Promise.all(
      stocks.map((candidate) => set(validateStock(candidate))),
    );
  }

  return {
    getByProductId,
    getByProductIds,
    set,
    delete: remove,
    seedMockStock,
  };
}

function normalizeRepositoryError(error: unknown, action: string): StockRepositoryError {
  if (error instanceof StockRepositoryError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new StockRepositoryError(
      `Validation failed while trying to ${action}`,
      "validation",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "not-found") {
    return new StockRepositoryError(
      `Failed to ${action}: document not found`,
      "not_found",
      error,
    );
  }

  if (error instanceof Error) {
    return new StockRepositoryError(`Failed to ${action}: ${error.message}`, "unknown", error);
  }

  return new StockRepositoryError(
    `Failed to ${action} due to an unknown error`,
    "unknown",
    error,
  );
}
