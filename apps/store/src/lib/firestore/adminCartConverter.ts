/**
 * Firestore DataConverters for the Cart model — admin SDK (firebase-admin/firestore).
 *
 * Two converters because Cart and CartItem live in separate paths:
 *   - `carts/{userId}`                — adminCartConverter
 *   - `carts/{userId}/items/{itemId}` — adminCartItemConverter
 */

import { type FirestoreDataConverter, Timestamp } from "firebase-admin/firestore";
import {
  type Cart,
  type CartItem,
  validateCart,
  validateCartItem,
} from "@luratha/schemas";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (
    typeof val === "object" &&
    val !== null &&
    "toDate" in val &&
    typeof (val as { toDate: unknown }).toDate === "function"
  ) {
    return (val as { toDate(): Date }).toDate().toISOString();
  }
  return val;
}

export const adminCartConverter: FirestoreDataConverter<Cart> = {
  toFirestore(cart: Cart) {
    const { updatedAt, ...rest } = cart;
    return {
      ...rest,
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateCart({
      ...data,
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};

export const adminCartItemConverter: FirestoreDataConverter<CartItem> = {
  toFirestore(item: CartItem) {
    const { addedAt, updatedAt, ...rest } = item;
    return {
      ...rest,
      addedAt: Timestamp.fromDate(new Date(addedAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateCartItem({
      ...data,
      addedAt: extractTimestamp(data.addedAt),
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
