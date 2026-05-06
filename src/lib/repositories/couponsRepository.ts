import { FirebaseError } from "firebase/app";
import {
  type Firestore,
  type QueryConstraint,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  query,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { firestoreCollections, type Coupon, validateCoupon } from "@/src/schemas/firestore";
import { clientCouponConverter } from "@/src/lib/firestore/clientCouponConverter";

type CouponListFilters = {
  active?: boolean;
  limit?: number;
};

type CouponRepositoryErrorCode = "validation" | "not_found" | "unknown";

export class CouponRepositoryError extends Error {
  readonly code: CouponRepositoryErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: CouponRepositoryErrorCode, cause?: unknown) {
    super(message);
    this.name = "CouponRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

export interface CouponsRepository {
  getById(id: string): Promise<Coupon | null>;
  getByCode(code: string): Promise<Coupon | null>;
  list(filters?: CouponListFilters): Promise<Coupon[]>;
}

const MAX_LIST_LIMIT = 100;

export function createCouponsRepository(dbInstance: Firestore): CouponsRepository {
  const couponsCollectionRef = collection(dbInstance, firestoreCollections.coupons).withConverter(
    clientCouponConverter,
  );

  async function getById(id: string): Promise<Coupon | null> {
    try {
      const couponRef = doc(couponsCollectionRef, id);
      const snapshot = await getDoc(couponRef);

      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.data();
    } catch (error) {
      throw normalizeRepositoryError(error, `read coupon "${id}"`);
    }
  }

  async function getByCode(code: string): Promise<Coupon | null> {
    try {
      // Coupon schema uppercases the code on parse — match that here so
      // case-insensitive lookups still resolve.
      const normalized = code.trim().toUpperCase();
      const snapshot = await getDocs(
        query(couponsCollectionRef, where("code", "==", normalized), queryLimit(1)),
      );

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].data();
    } catch (error) {
      throw normalizeRepositoryError(error, `read coupon by code "${code}"`);
    }
  }

  async function list(filters: CouponListFilters = {}): Promise<Coupon[]> {
    try {
      const constraints: QueryConstraint[] = [];

      if (typeof filters.active === "boolean") {
        constraints.push(where("active", "==", filters.active));
      }

      const normalizedLimit = Math.max(1, Math.min(filters.limit ?? 24, MAX_LIST_LIMIT));
      constraints.push(queryLimit(normalizedLimit));

      const snapshot = await getDocs(query(couponsCollectionRef, ...constraints));
      return snapshot.docs.map((entry) => validateCoupon(entry.data()));
    } catch (error) {
      throw normalizeRepositoryError(error, "list coupons");
    }
  }

  return {
    getById,
    getByCode,
    list,
  };
}

function normalizeRepositoryError(error: unknown, action: string): CouponRepositoryError {
  if (error instanceof CouponRepositoryError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new CouponRepositoryError(
      `Validation failed while trying to ${action}`,
      "validation",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "not-found") {
    return new CouponRepositoryError(
      `Failed to ${action}: document not found`,
      "not_found",
      error,
    );
  }

  if (error instanceof Error) {
    return new CouponRepositoryError(`Failed to ${action}: ${error.message}`, "unknown", error);
  }

  return new CouponRepositoryError(`Failed to ${action} due to an unknown error`, "unknown", error);
}
