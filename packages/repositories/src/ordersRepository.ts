import { FirebaseError } from "firebase/app";
import {
  type Firestore,
  type QueryConstraint,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { firestoreCollections, type Order, validateOrder } from "@luratha/schemas";
import { clientOrderConverter } from "@luratha/firestore/clientOrderConverter";

type OrderListFilters = {
  status?: Order["status"];
  limit?: number;
};

type OrderUpdateInput = Partial<Omit<Order, "id" | "userId" | "createdAt">>;

type OrderRepositoryErrorCode = "validation" | "not_found" | "conflict" | "unknown";

export class OrderRepositoryError extends Error {
  readonly code: OrderRepositoryErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: OrderRepositoryErrorCode, cause?: unknown) {
    super(message);
    this.name = "OrderRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

export interface OrdersRepository {
  create(input: unknown): Promise<Order>;
  getById(id: string): Promise<Order | null>;
  update(id: string, patch: OrderUpdateInput): Promise<Order>;
  listByUser(userId: string, filters?: OrderListFilters): Promise<Order[]>;
  list(filters?: OrderListFilters): Promise<Order[]>;
}

const MAX_LIST_LIMIT = 100;

export function createOrdersRepository(dbInstance: Firestore): OrdersRepository {
  const ordersCollectionRef = collection(dbInstance, firestoreCollections.orders).withConverter(
    clientOrderConverter,
  );

  async function create(input: unknown): Promise<Order> {
    try {
      const parsed = validateOrder(input);
      const orderRef = doc(ordersCollectionRef, parsed.id);

      await runTransaction(dbInstance, async (transaction) => {
        const existing = await transaction.get(orderRef);
        if (existing.exists()) {
          throw new OrderRepositoryError(
            `Order with id "${parsed.id}" already exists`,
            "conflict",
          );
        }
        transaction.set(orderRef, parsed);
      });

      return parsed;
    } catch (error) {
      throw normalizeRepositoryError(error, "create order");
    }
  }

  async function getById(id: string): Promise<Order | null> {
    try {
      const orderRef = doc(ordersCollectionRef, id);
      const snapshot = await getDoc(orderRef);

      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.data();
    } catch (error) {
      throw normalizeRepositoryError(error, `read order "${id}"`);
    }
  }

  async function update(id: string, patch: OrderUpdateInput): Promise<Order> {
    try {
      const orderRef = doc(ordersCollectionRef, id);
      const snapshot = await getDoc(orderRef);

      if (!snapshot.exists()) {
        throw new OrderRepositoryError(`Order "${id}" was not found`, "not_found");
      }

      const current = snapshot.data();
      // Merge order: existing < payload < server-controlled fields.
      // Absent keys stay unchanged; null sets to null. Never use Object.assign here.
      const merged = validateOrder({
        ...current,
        ...patch,
        id: current.id,
        userId: current.userId,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(orderRef, merged);
      return merged;
    } catch (error) {
      throw normalizeRepositoryError(error, `update order "${id}"`);
    }
  }

  async function listByUser(
    userId: string,
    filters: OrderListFilters = {},
  ): Promise<Order[]> {
    try {
      const constraints: QueryConstraint[] = [
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
      ];

      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }

      const normalizedLimit = Math.max(1, Math.min(filters.limit ?? 24, MAX_LIST_LIMIT));
      constraints.push(queryLimit(normalizedLimit));

      const snapshot = await getDocs(query(ordersCollectionRef, ...constraints));
      return snapshot.docs.map((entry) => entry.data());
    } catch (error) {
      throw normalizeRepositoryError(error, `list orders for user "${userId}"`);
    }
  }

  async function list(filters: OrderListFilters = {}): Promise<Order[]> {
    try {
      const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];

      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }

      const normalizedLimit = Math.max(1, Math.min(filters.limit ?? 24, MAX_LIST_LIMIT));
      constraints.push(queryLimit(normalizedLimit));

      const snapshot = await getDocs(query(ordersCollectionRef, ...constraints));
      return snapshot.docs.map((entry) => entry.data());
    } catch (error) {
      throw normalizeRepositoryError(error, "list orders");
    }
  }

  return {
    create,
    getById,
    update,
    listByUser,
    list,
  };
}

function normalizeRepositoryError(error: unknown, action: string): OrderRepositoryError {
  if (error instanceof OrderRepositoryError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new OrderRepositoryError(
      `Validation failed while trying to ${action}`,
      "validation",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "already-exists") {
    return new OrderRepositoryError(
      `Failed to ${action}: document already exists`,
      "conflict",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "not-found") {
    return new OrderRepositoryError(
      `Failed to ${action}: document not found`,
      "not_found",
      error,
    );
  }

  if (error instanceof Error) {
    return new OrderRepositoryError(`Failed to ${action}: ${error.message}`, "unknown", error);
  }

  return new OrderRepositoryError(`Failed to ${action} due to an unknown error`, "unknown", error);
}
